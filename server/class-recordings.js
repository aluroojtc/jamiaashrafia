/**
 * Jamia Ashrafia LMS - Live class recordings (Jibri on the school's own Jitsi server)
 *
 * The host presses Start Recording in the portal: the portal records a "capture" here, then asks Jitsi to
 * record the room to a file (Jibri). Stop Recording, or the class ending, stops it. The host then chooses
 * Save Recording or Do Not Save. Jibri writes the MP4 into its own folder (/srv/recordings/<random>/);
 * the scan below moves it into the LMS's private recordings folder and matches it to its capture by room.
 *
 *   capture status:  RECORDING -> STOPPED -> READY (file here, no decision yet) -> SAVED | DISCARDED
 *                    (a decision can come before the file; it is applied when the file arrives)  FAILED
 *
 * Saved recordings become ordinary 'virtualClassRecordings' records, so the existing access rules apply:
 * only students of the class (and staff within their scope) can see them, and the video itself is only
 * streamed through /api/class-recordings/video/<id>, which checks the same rules on every request.
 * The files are never under /uploads (any signed-in user can open those by link).
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const db = require('../database/db');
const policy = require('./access-policy');
const audit = require('./audit');

const RECORDINGS_DIR = path.resolve(process.env.CLASS_RECORDINGS_DIR || path.resolve(__dirname, '..', 'recordings'));
const PENDING_DIR = path.join(RECORDINGS_DIR, 'pending');
const JIBRI_DIR = path.resolve(process.env.JIBRI_RECORDINGS_DIR || '/srv/recordings');
// A recording still marked RECORDING after this long is treated as abandoned (the recorder is free again)
const STALE_RECORDING_MS = 8 * 3600 * 1000;
// Without Jibri's finalize marker, a file is taken once it has not changed for this long
const QUIET_FILE_MS = 2 * 60 * 1000;
const OPEN_STATUSES = ['RECORDING', 'STOPPED', 'READY'];

let schemaReady = null;

function ensureSchema() {
    if (!schemaReady) {
        schemaReady = db.query(`CREATE TABLE IF NOT EXISTS class_recording_captures (
            id VARCHAR(60) PRIMARY KEY,
            session_id VARCHAR(120) NOT NULL,
            class_id VARCHAR(120) NULL,
            room_name VARCHAR(190) NOT NULL,
            started_by VARCHAR(120) NOT NULL,
            started_by_name VARCHAR(255) NULL,
            status VARCHAR(20) NOT NULL,
            decision VARCHAR(10) NULL,
            decided_by VARCHAR(120) NULL,
            title VARCHAR(255) NULL,
            file_bytes BIGINT NULL,
            duration_seconds INT NULL,
            recording_id VARCHAR(120) NULL,
            error VARCHAR(500) NULL,
            started_at DATETIME(3) NOT NULL,
            stopped_at DATETIME(3) NULL,
            file_at DATETIME(3) NULL,
            decided_at DATETIME(3) NULL,
            INDEX idx_capture_status (status),
            INDEX idx_capture_session (session_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).catch(err => {
            schemaReady = null;
            throw err;
        });
    }
    return schemaReady;
}

function fail(status, message) {
    return Object.assign(new Error(message), { status });
}

// Ids are made here, but a recording id also arrives in URLs: never let it reach outside the folder
function safeId(id) {
    const s = String(id || '');
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(s)) throw fail(404, 'Recording not found.');
    return s;
}

function videoPath(recordingId) {
    return path.join(RECORDINGS_DIR, `${safeId(recordingId)}.mp4`);
}

function pendingPath(captureId) {
    return path.join(PENDING_DIR, `${safeId(captureId)}.mp4`);
}

/** Removes a saved recording's video file (deleted by a manager or by the retention clean-up). */
function removeRecordingFile(recordingId) {
    let file;
    try { file = videoPath(recordingId); } catch (e) { return; }
    fs.promises.unlink(file).catch(() => {});
}

function captureOut(row) {
    if (!row) return null;
    return {
        id: row.id, sessionId: row.session_id, classId: row.class_id, startedBy: row.started_by, startedByName: row.started_by_name,
        status: row.status, decision: row.decision, title: row.title, fileBytes: row.file_bytes ? Number(row.file_bytes) : 0,
        durationSeconds: row.duration_seconds || 0, recordingId: row.recording_id, error: row.error,
        startedAt: row.started_at, stoppedAt: row.stopped_at, fileAt: row.file_at, decidedAt: row.decided_at,
        hasFile: !!row.file_at
    };
}

async function loadCapture(id) {
    const [rows] = await db.query(`SELECT * FROM class_recording_captures WHERE id = ?`, [String(id || '')]);
    return rows[0] || null;
}

function formatDuration(seconds) {
    const s = Math.max(0, Math.round(seconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h) return `${h} hr ${m} min`;
    return m ? `${m} min` : `${s % 60} sec`;
}

// Length of the video (ffprobe comes with Jibri's ffmpeg); null when it cannot be read
function probeDuration(file) {
    return new Promise(resolve => {
        execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { timeout: 20000 }, (err, out) => {
            const n = Number(String(out || '').trim());
            resolve(!err && n > 0 ? Math.round(n) : null);
        });
    });
}

async function moveFile(from, to) {
    await fs.promises.mkdir(path.dirname(to), { recursive: true });
    try {
        await fs.promises.rename(from, to);
    } catch (err) {
        if (err.code !== 'EXDEV') throw err;
        await fs.promises.copyFile(from, to);
        await fs.promises.unlink(from);
    }
}

// ---------------------------------------------------------------------------
// Who may do what
// ---------------------------------------------------------------------------

// Recording needs both: hosting this class (as for the live room) and "Manage recordings" over its class
async function mayRecord(req, deps, session) {
    const ctx = await policy.buildContext(deps.caller(req), deps.loadCollection);
    const probe = { id: '__new__', classId: session.classId, teacherId: deps.caller(req).id };
    if (session.branchId) probe.branchId = session.branchId;
    policy.assignCampus(ctx, 'virtualClassRecordings', probe, null);
    return policy.canWrite(ctx, 'virtualClassRecordings', probe, null);
}

// The person who started it decides; so does anyone managing recordings for the whole institution
function mayDecide(req, deps, row) {
    const who = deps.caller(req);
    if (row.started_by === who.id) return true;
    const eff = deps.effective(req);
    return eff.scope === 'ALL' && eff.permissions.has('recordings.manage');
}

// ---------------------------------------------------------------------------
// Publishing a saved recording
// ---------------------------------------------------------------------------

// req: the request of the person saving it, or null when the file arrived after their decision
async function publish(row, deps, req) {
    const recordingId = `rec_${row.id.replace(/^cap_/, '')}`;
    await moveFile(pendingPath(row.id), videoPath(recordingId));
    const sessionRec = await deps.loadRecord('virtualClasses', row.session_id);
    const session = sessionRec && !sessionRec.deleted ? sessionRec.data : {};
    const started = new Date(row.started_at);
    const pad = n => String(n).padStart(2, '0');
    const local = new Date(started.getTime() - started.getTimezoneOffset() * 60000).toISOString();
    const record = {
        id: recordingId,
        sessionId: row.session_id,
        captureId: row.id,
        source: 'LIVE_RECORDING',
        title: row.title || session.title || 'Class recording',
        urduTitle: session.urduTitle || '',
        teacherId: session.hostId || row.started_by,
        teacherName: session.hostTeacher || row.started_by_name || '',
        recordedBy: row.started_by,
        classId: session.classId || row.class_id,
        className: session.className || '',
        courseId: session.courseId || '',
        courseName: session.courseName || '',
        branchId: session.branchId,
        campusIds: session.campusIds,
        recordedDate: local.slice(0, 10),
        recordedTime: `${pad(started.getHours())}:${pad(started.getMinutes())}`,
        durationSeconds: row.duration_seconds || 0,
        durationFormatted: formatDuration(row.duration_seconds),
        videoUrl: `/api/class-recordings/video/${recordingId}`,
        externalUrl: null,
        mimeType: 'video/mp4',
        fileSizeBytes: Number(row.file_bytes) || 0,
        viewsCount: 0,
        createdAt: new Date().toISOString()
    };
    Object.keys(record).forEach(k => record[k] === undefined && delete record[k]);
    await db.query(
        `INSERT INTO lms_records (collection, id, data, deleted, updated_by, updated_at) VALUES ('virtualClassRecordings', ?, ?, 0, ?, NOW(3))
         ON DUPLICATE KEY UPDATE data = VALUES(data), deleted = 0, updated_by = VALUES(updated_by), updated_at = NOW(3)`,
        [recordingId, JSON.stringify(record), row.decided_by || row.started_by]
    );
    await db.query(`UPDATE class_recording_captures SET status = 'SAVED', recording_id = ? WHERE id = ?`, [recordingId, row.id]);
    if (record.classId) {
        await deps.insertNotification({
            senderId: row.decided_by || row.started_by, senderName: record.teacherName || null,
            targetRole: 'STUDENT', targetClassId: record.classId, linkRoute: 'class-recordings', category: 'LIVE_CLASS',
            title: `Class recording ready: ${record.title}`,
            message: `The recording of "${record.title}" (${record.recordedDate}, ${record.durationFormatted}) is ready. Open Class Recordings to watch it.`
        });
    }
    await audit.log({
        req: req || null, actor: req ? undefined : { id: row.decided_by || row.started_by, role: 'SYSTEM' },
        action: 'recordings.save', entityType: 'virtualClassRecordings', entityId: recordingId,
        summary: `Saved the live class recording "${record.title}" (${record.durationFormatted}, ${Math.round(record.fileSizeBytes / 1048576)} MB)`
    });
    return recordingId;
}

async function discardFile(row) {
    await fs.promises.unlink(pendingPath(row.id)).catch(() => {});
    await db.query(`UPDATE class_recording_captures SET status = 'DISCARDED' WHERE id = ?`, [row.id]);
}

// ---------------------------------------------------------------------------
// Picking up Jibri's files
// ---------------------------------------------------------------------------

// "<room>_2026-11-01-06-30-12.mp4" -> start time (Jibri runs on this server, so it names files in the same local clock)
function fileStartTime(name) {
    const m = /_(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.mp4$/i.exec(name);
    if (!m) return null;
    const t = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`).getTime();
    return Number.isNaN(t) ? null : t;
}

async function readJibriFolder(dir) {
    const entries = await fs.promises.readdir(dir).catch(() => []);
    const mp4 = entries.find(e => e.toLowerCase().endsWith('.mp4'));
    if (!mp4) return null;
    const file = path.join(dir, mp4);
    const stat = await fs.promises.stat(file).catch(() => null);
    if (!stat || !stat.size) return null;
    const finalized = entries.includes('.finalized');
    if (!finalized && Date.now() - stat.mtimeMs < QUIET_FILE_MS) return null; // still being written
    let room = '';
    if (entries.includes('metadata.json')) {
        try {
            const meta = JSON.parse(await fs.promises.readFile(path.join(dir, 'metadata.json'), 'utf8'));
            room = String(meta.meeting_url || '').split('?')[0].split('/').filter(Boolean).pop() || '';
        } catch (e) { /* fall back to the file name */ }
    }
    if (!room) room = mp4.replace(/_\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.mp4$/i, '');
    if (!entries.includes('metadata.json') && !finalized) return null;
    return { dir, file, size: stat.size, room: room.toLowerCase(), startedAt: fileStartTime(mp4) || stat.mtimeMs - 0 };
}

let scanning = null;

/** Moves finished Jibri recordings to their captures (safe to call often; runs one scan at a time). */
function scan(deps) {
    if (!scanning) scanning = runScan(deps).catch(err => console.warn('[Recordings] Scan failed:', err.message)).finally(() => { scanning = null; });
    return scanning;
}

async function runScan(deps) {
    await ensureSchema();
    const [waiting] = await db.query(
        `SELECT * FROM class_recording_captures WHERE file_at IS NULL AND status IN ('RECORDING', 'STOPPED', 'DISCARDED') ORDER BY started_at`);
    if (!waiting.length) return;
    const folders = await fs.promises.readdir(JIBRI_DIR, { withFileTypes: true }).catch(() => []);
    const used = new Set();
    for (const entry of folders) {
        if (!entry.isDirectory()) continue;
        const dir = path.join(JIBRI_DIR, entry.name);
        if (path.dirname(dir) !== JIBRI_DIR) continue;
        const found = await readJibriFolder(dir);
        if (!found) continue;
        // The capture of this room whose start is closest to the file's start
        const candidates = waiting.filter(w => !used.has(w.id) && w.room_name === found.room);
        if (!candidates.length) continue;
        const capture = candidates.sort((a, b) => Math.abs(new Date(a.started_at) - found.startedAt) - Math.abs(new Date(b.started_at) - found.startedAt))[0];
        used.add(capture.id);
        await importFile(capture, found, deps);
    }
}

async function importFile(capture, found, deps) {
    await moveFile(found.file, pendingPath(capture.id));
    await fs.promises.rm(found.dir, { recursive: true, force: true }).catch(() => {});
    const stoppedAt = capture.stopped_at ? new Date(capture.stopped_at) : new Date();
    const duration = (await probeDuration(pendingPath(capture.id)))
        || Math.max(1, Math.round((stoppedAt - new Date(capture.started_at)) / 1000));
    await db.query(
        `UPDATE class_recording_captures SET file_at = NOW(3), file_bytes = ?, duration_seconds = ?,
            stopped_at = COALESCE(stopped_at, NOW(3)), status = IF(status = 'DISCARDED', 'DISCARDED', 'READY') WHERE id = ?`,
        [found.size, duration, capture.id]);
    const row = await loadCapture(capture.id);
    console.log(`[Recordings] Received the recording of ${row.session_id} (${Math.round(found.size / 1048576)} MB)`);
    if (row.decision === 'DISCARD') await discardFile(row);
    else if (row.decision === 'SAVE') await publish(row, deps);
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function handleStart(req, res, deps) {
    const body = await deps.readJson(req);
    const access = await deps.decideVirtualAccess(req, body.sessionId);
    if (access.status !== 200) throw fail(access.status, access.message);
    if (!access.isHost) throw fail(403, 'Only the host of this class can record it.');
    const session = access.session;
    if (!(await mayRecord(req, deps, session))) throw fail(403, 'Your role is not allowed to record this class (it needs "Manage recordings").');
    const settings = await deps.getMeetingSettings();
    if (settings.authMode === 'JAAS' || settings.domain === 'meet.jit.si' || !settings.embed) {
        throw fail(400, 'Recording works with the school\'s own Jitsi server shown inside the portal.');
    }
    await ensureSchema();
    const who = deps.caller(req);
    // One recorder: a recording still running elsewhere keeps it busy (unless it has been running for hours)
    const [running] = await db.query(
        `SELECT * FROM class_recording_captures WHERE status = 'RECORDING' AND started_at > NOW(3) - INTERVAL ? SECOND ORDER BY started_at DESC`,
        [Math.round(STALE_RECORDING_MS / 1000)]);
    const mine = running.find(r => r.session_id === session.id);
    if (mine) { deps.sendJson(res, 200, { success: true, capture: captureOut(mine) }); return; }
    if (running.length) throw fail(409, 'The recorder is busy recording another class. Try again when that recording stops.');
    const id = deps.newId('cap');
    await db.query(
        `INSERT INTO class_recording_captures (id, session_id, class_id, room_name, started_by, started_by_name, status, title, started_at)
         VALUES (?, ?, ?, ?, ?, ?, 'RECORDING', ?, NOW(3))`,
        [id, session.id, session.classId || null, deps.meetingRoomName(session).toLowerCase(), who.id, (who.user && who.user.name) || null, String(session.title || '').slice(0, 255)]);
    await audit.log({ req, action: 'recordings.start', entityType: 'virtualClasses', entityId: session.id, summary: `Started recording "${session.title || session.id}"` });
    deps.sendJson(res, 201, { success: true, capture: captureOut(await loadCapture(id)) });
}

async function ownCapture(req, deps, id) {
    await ensureSchema();
    const row = await loadCapture(id);
    if (!row || !mayDecide(req, deps, row)) throw fail(404, 'Recording not found.');
    return row;
}

async function handleStop(req, res, deps, id) {
    const row = await ownCapture(req, deps, id);
    if (row.status === 'RECORDING') {
        await db.query(`UPDATE class_recording_captures SET status = 'STOPPED', stopped_at = NOW(3) WHERE id = ?`, [row.id]);
        await audit.log({ req, action: 'recordings.stop', entityType: 'virtualClasses', entityId: row.session_id, summary: `Stopped recording "${row.title || row.session_id}"` });
    }
    scan(deps);
    deps.sendJson(res, 200, { success: true, capture: captureOut(await loadCapture(row.id)) });
}

// The meeting reported that recording could not start (e.g. the recorder is not running)
async function handleFail(req, res, deps, id) {
    const row = await ownCapture(req, deps, id);
    const body = await deps.readJson(req);
    if (row.status === 'RECORDING' && !row.file_at) {
        await db.query(`UPDATE class_recording_captures SET status = 'FAILED', stopped_at = NOW(3), error = ? WHERE id = ?`,
            [String(body.error || 'Recording could not start').slice(0, 500), row.id]);
    }
    deps.sendJson(res, 200, { success: true, capture: captureOut(await loadCapture(row.id)) });
}

async function handleDecision(req, res, deps, id) {
    const row = await ownCapture(req, deps, id);
    const body = await deps.readJson(req);
    if (['SAVED', 'DISCARDED'].includes(row.status) || row.decision) throw fail(409, 'A decision was already made for this recording.');
    if (row.status === 'FAILED') throw fail(409, 'This recording failed, so there is nothing to save.');
    const save = body.save === true;
    if (!save && body.confirmDiscard !== true) throw fail(400, 'Confirm that the recording should be discarded.');
    const title = String(body.title || '').trim().slice(0, 255);
    await db.query(
        `UPDATE class_recording_captures SET decision = ?, decided_by = ?, decided_at = NOW(3), title = COALESCE(NULLIF(?, ''), title),
            status = IF(status = 'RECORDING', 'STOPPED', status), stopped_at = COALESCE(stopped_at, NOW(3)) WHERE id = ?`,
        [save ? 'SAVE' : 'DISCARD', deps.caller(req).id, title, row.id]);
    let updated = await loadCapture(row.id);
    if (save && updated.file_at) await publish(updated, deps, req);
    if (!save) {
        await discardFile(updated);
        await audit.log({ req, action: 'recordings.discard', entityType: 'virtualClasses', entityId: row.session_id, summary: `Discarded the recording of "${row.title || row.session_id}"` });
    }
    if (!updated.file_at) scan(deps);
    updated = await loadCapture(row.id);
    deps.sendJson(res, 200, { success: true, capture: captureOut(updated) });
}

async function handleGet(req, res, deps, id) {
    await scan(deps);
    const row = await ownCapture(req, deps, id);
    deps.sendJson(res, 200, { success: true, capture: captureOut(row) });
}

// Recordings waiting for this person's decision, or still being processed after "Save"
async function handlePending(req, res, deps) {
    await ensureSchema();
    await scan(deps);
    const [rows] = await db.query(
        `SELECT * FROM class_recording_captures
         WHERE status IN (${OPEN_STATUSES.map(() => '?').join(',')}) AND (decision IS NULL OR decision = 'SAVE')
         ORDER BY started_at DESC LIMIT 50`, OPEN_STATUSES);
    deps.sendJson(res, 200, { success: true, captures: rows.filter(r => mayDecide(req, deps, r)).map(captureOut) });
}

// Streams a saved recording to someone allowed to see it (byte ranges, so the player can seek)
async function handleVideo(req, res, deps, recordingId, url) {
    const id = safeId(recordingId);
    const rec = await deps.loadRecord('virtualClassRecordings', id);
    const ctx = await policy.buildContext(deps.caller(req), deps.loadCollection);
    if (!rec || rec.deleted || !policy.readable(ctx, 'virtualClassRecordings', rec.data)) throw fail(404, 'Recording not found.');
    const download = url.searchParams.get('download') === '1';
    if (download && !deps.can(req, 'recordings.download')) {
        const settings = (await deps.getSetting('recordings', {})) || {};
        if (!(settings.allowStudentDownload && deps.can(req, 'recordings.view'))) throw fail(403, 'You are not allowed to download recordings.');
    }
    const file = videoPath(id);
    const stat = await fs.promises.stat(file).catch(() => null);
    if (!stat) throw fail(404, 'The video file of this recording is missing.');

    const headers = {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${String(rec.data.title || id).replace(/[^\w\- ]+/g, '').trim().slice(0, 80) || id}.mp4"`
    };
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
    let start = 0;
    let end = stat.size - 1;
    if (range && (range[1] || range[2])) {
        if (range[1]) {
            start = Number(range[1]);
            if (range[2]) end = Math.min(end, Number(range[2]));
        } else {
            start = Math.max(0, stat.size - Number(range[2]));
        }
        if (start > end || start >= stat.size) {
            res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
            res.end();
            return;
        }
        res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    } else {
        res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    }
    if (req.method === 'HEAD') { res.end(); return; }
    // One view per person per opening (the first request of the player, not every seek)
    if (!range || start === 0) countView(id, deps.caller(req).id);
    fs.createReadStream(file, { start, end }).pipe(res);
}

const recentViews = new Map();
function countView(recordingId, userId) {
    const key = `${recordingId}:${userId}`;
    const now = Date.now();
    if (now - (recentViews.get(key) || 0) < 30 * 60 * 1000) return;
    recentViews.set(key, now);
    if (recentViews.size > 5000) recentViews.clear();
    db.query(
        `UPDATE lms_records SET data = JSON_SET(data, '$.viewsCount', COALESCE(JSON_EXTRACT(data, '$.viewsCount'), 0) + 1), updated_at = NOW(3)
         WHERE collection = 'virtualClassRecordings' AND id = ? AND deleted = 0`, [recordingId]).catch(() => {});
}

/**
 * deps: sendJson, readJson, can, caller, effective, loadCollection, loadRecord, getSetting, newId,
 *       insertNotification, decideVirtualAccess, getMeetingSettings, meetingRoomName
 */
async function route(req, res, url, deps) {
    const p = url.pathname;
    const m = req.method;
    if (!p.startsWith('/api/class-recordings')) return false;
    if (p === '/api/class-recordings/start' && m === 'POST') { await handleStart(req, res, deps); return true; }
    if (p === '/api/class-recordings/pending' && m === 'GET') { await handlePending(req, res, deps); return true; }
    // Jibri's finalize script asks for a scan as soon as a file is complete (nothing is read from the request)
    if (p === '/api/class-recordings/scan' && m === 'POST') { scan(deps); deps.sendJson(res, 202, { success: true }); return true; }
    let match = /^\/api\/class-recordings\/video\/([^/]+)$/.exec(p);
    if (match && (m === 'GET' || m === 'HEAD')) { await handleVideo(req, res, deps, decodeURIComponent(match[1]), url); return true; }
    match = /^\/api\/class-recordings\/([^/]+)(?:\/(stop|fail|decision))?$/.exec(p);
    if (match) {
        const id = decodeURIComponent(match[1]);
        if (!match[2] && m === 'GET') { await handleGet(req, res, deps, id); return true; }
        if (match[2] === 'stop' && m === 'POST') { await handleStop(req, res, deps, id); return true; }
        if (match[2] === 'fail' && m === 'POST') { await handleFail(req, res, deps, id); return true; }
        if (match[2] === 'decision' && m === 'POST') { await handleDecision(req, res, deps, id); return true; }
    }
    throw fail(404, 'Not found');
}

/** Checks for finished recordings every 30 seconds while any are expected. */
function startWatcher(deps) {
    const timer = setInterval(() => scan(deps), 30 * 1000);
    timer.unref();
    return timer;
}

module.exports = { route, scan, startWatcher, removeRecordingFile, ensureSchema, RECORDINGS_DIR, JIBRI_DIR, formatDuration };
