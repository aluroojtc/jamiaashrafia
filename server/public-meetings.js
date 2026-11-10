/**
 * Jamia Ashrafia LMS - Public meetings (Online Classes page, "Start Public Meeting")
 *
 * An administrator holding 'virtual_classes.public_meeting' starts a meeting on the same meeting service as the
 * live classes and gets a public link (/meet/<code>). Anyone with the link can join as a guest without an LMS
 * account: the join page asks for a name and this server signs a guest (non-moderator) meeting token for that
 * one room. Only the administrator who starts it, or another holder of the permission, enters as moderator.
 *
 * Kept apart from the classes: own table, own room names (JamiaPublic...), no class, timetable, attendance or
 * campus records are touched. The link stops working when the meeting is ended or its time runs out; guest
 * tokens never outlive the meeting's end time.
 *
 * The host's meeting runs in a portal tab (live.html?publicMeeting=<id>), as a class does: recording works as for
 * classes (server/class-recordings.js) and the tab reports here when the meeting ends. It ends when a host ends it
 * for everyone (in the meeting, in the tab's bar, or in the lobby), or when the last person in it, a host, leaves.
 */

const crypto = require('crypto');
const db = require('../database/db');
const audit = require('./audit');

const PERMISSION = 'virtual_classes.public_meeting';
const ROOM_PREFIX = 'JamiaPublic';
const DURATIONS_HOURS = [1, 2, 3, 4, 6, 8, 12];
const MAX_ACTIVE = 10;
// Wrong or old links from one address: at most this many lookups per window
const LOOKUP_LIMIT = 60;
const LOOKUP_WINDOW_MS = 10 * 60 * 1000;
// The host's tab was closed with nobody else in the meeting: it ends after this long, unless the host comes back (a reload)
const EMPTY_TAB_GRACE_MS = Number(process.env.PUBLIC_MEETING_EMPTY_GRACE_MS) || 20 * 1000;
// Signs the key a guest gets on joining, which their tab shows for the meeting settings and recording requests
// (server/meeting-controls.js). New at every server start: a guest then rejoins from the link.
const GUEST_KEY_SECRET = crypto.randomBytes(32);

let schemaReady = null;

function ensureSchema() {
    if (!schemaReady) {
        schemaReady = db.query(`CREATE TABLE IF NOT EXISTS public_meetings (
            id VARCHAR(60) PRIMARY KEY,
            code VARCHAR(64) NOT NULL,
            room_name VARCHAR(120) NOT NULL,
            title VARCHAR(200) NOT NULL,
            created_by VARCHAR(120) NOT NULL,
            created_by_name VARCHAR(255) NULL,
            status VARCHAR(20) NOT NULL,
            created_at DATETIME(3) NOT NULL,
            expires_at DATETIME(3) NOT NULL,
            ended_at DATETIME(3) NULL,
            ended_by VARCHAR(120) NULL,
            UNIQUE KEY uq_public_meeting_code (code),
            INDEX idx_public_meeting_status (status)
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

function clientIp(req) {
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return fwd || (req.socket && req.socket.remoteAddress) || '';
}

const lookups = new Map(); // ip -> { count, since }

function checkLookupLimit(req) {
    const ip = clientIp(req);
    const now = Date.now();
    const entry = lookups.get(ip);
    if (!entry || now - entry.since > LOOKUP_WINDOW_MS) {
        lookups.set(ip, { count: 1, since: now });
        if (lookups.size > 5000) {
            for (const [k, v] of lookups) if (now - v.since > LOOKUP_WINDOW_MS) lookups.delete(k);
        }
        return;
    }
    entry.count += 1;
    if (entry.count > LOOKUP_LIMIT) throw fail(429, 'Too many attempts. Please wait a few minutes and open the link again.');
}

function isActive(row) {
    return row.status === 'ACTIVE' && new Date(row.expires_at).getTime() > Date.now();
}

// The link code arrives in URLs and request bodies: only the characters it is made of
function cleanCode(code) {
    const s = String(code || '');
    return /^[A-Za-z0-9_-]{20,64}$/.test(s) ? s : '';
}

function publicLink(req, code) {
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || (req.socket && req.socket.encrypted ? 'https' : 'http');
    return `${proto}://${host}/meet/${code}`;
}

function toJson(req, row) {
    return {
        id: row.id,
        title: row.title,
        createdBy: row.created_by,
        createdByName: row.created_by_name,
        createdAt: new Date(row.created_at).toISOString(),
        expiresAt: new Date(row.expires_at).toISOString(),
        endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : null,
        status: isActive(row) ? 'ACTIVE' : row.status === 'ACTIVE' ? 'EXPIRED' : row.status,
        link: publicLink(req, row.code)
    };
}

// What a browser needs to open the room: the service domain, the room path and a token (null without sign-in)
async function joinInfo(deps, row, user, isHost) {
    const settings = await deps.getMeetingSettings();
    const secrets = settings.authMode === 'NONE' ? {} : await deps.getSetting('meetingSecrets', {});
    const ttl = Math.max(60, Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000));
    let token = null;
    try {
        token = deps.roomToken(settings, secrets, row.room_name, user, isHost, ttl);
    } catch (e) {
        throw fail(500, 'The meeting sign-in is not set up correctly. Ask the administrator to check the classroom service settings.');
    }
    return {
        domain: settings.domain,
        roomPath: settings.authMode === 'JAAS' ? `${settings.appId}/${row.room_name}` : row.room_name,
        token
    };
}

async function loadById(id) {
    const [rows] = await db.query(`SELECT * FROM public_meetings WHERE id = ? LIMIT 1`, [String(id || '').slice(0, 60)]);
    if (!rows.length) throw fail(404, 'Public meeting not found.');
    return rows[0];
}

async function loadByCode(code) {
    const c = cleanCode(code);
    const [rows] = c ? await db.query(`SELECT * FROM public_meetings WHERE code = ? LIMIT 1`, [c]) : [[]];
    if (!rows.length) throw fail(404, 'This meeting link is not valid. Check that you copied the whole link.');
    return rows[0];
}

function requirePermission(req, deps) {
    if (!deps.can(req, PERMISSION)) throw fail(403, 'You are not allowed to start or manage public meetings.');
}

const pendingEnds = new Map(); // meeting id -> timer (see EMPTY_TAB_GRACE_MS)

function cancelPendingEnd(id) {
    clearTimeout(pendingEnds.get(id));
    pendingEnds.delete(id);
}

// actor: { id, role }. A recording still running in the meeting is marked stopped, so its decision is not left waiting.
async function endMeeting(row, deps, actor, req) {
    cancelPendingEnd(row.id);
    if (row.status !== 'ACTIVE') return;
    await db.query(`UPDATE public_meetings SET status = 'ENDED', ended_at = NOW(3), ended_by = ? WHERE id = ?`, [actor.id, row.id]);
    await audit.log({ req: req || null, actor, action: 'public_meeting.end', entityType: 'public_meeting', entityId: row.id, summary: `Ended public meeting "${row.title}"` });
    await deps.stopRecordingsOf(row.id);
}

/** A meeting as server/class-recordings.js records it: only holders of the permission, only while it is open. */
async function recordingTarget(req, deps, id) {
    requirePermission(req, deps);
    await ensureSchema();
    const row = await loadById(id);
    if (!isActive(row)) throw fail(410, 'This public meeting has ended.');
    return { id: row.id, title: row.title, roomName: row.room_name };
}

function guestKey(meetingId, guestId, guestName) {
    return crypto.createHmac('sha256', GUEST_KEY_SECRET).update(`${meetingId}|${guestId}|${guestName}`).digest('base64url');
}

/** A guest of an open meeting, as server/meeting-controls.js sees them: checked against the key the join gave. */
async function guestTarget(code, guestId, guestName, key) {
    await ensureSchema();
    const row = await loadByCode(code);
    if (!isActive(row)) throw fail(410, 'This meeting has ended.');
    const id = String(guestId || '');
    const name = String(guestName || '');
    const expected = Buffer.from(guestKey(row.id, id, name));
    const given = Buffer.from(String(key || ''));
    if (!/^guest_[0-9a-f]{12}$/.test(id) || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
        throw fail(403, 'Open the meeting link again to use this.');
    }
    return { id: row.id, title: row.title, roomName: row.room_name, guestId: id, guestName: name };
}

/** The meeting held in a room (a recording arrived for it); null when there is none. */
async function findByRoom(roomName) {
    await ensureSchema();
    const [rows] = await db.query(`SELECT * FROM public_meetings WHERE room_name = ? LIMIT 1`, [String(roomName || '').slice(0, 120)]);
    return rows[0] || null;
}

// GET /api/public-meetings  meetings still open plus the last few that ended
async function handleList(req, res, deps) {
    requirePermission(req, deps);
    await ensureSchema();
    const [rows] = await db.query(`SELECT * FROM public_meetings ORDER BY created_at DESC LIMIT 20`);
    deps.sendJson(res, 200, { success: true, meetings: rows.map(r => toJson(req, r)) });
}

// POST /api/public-meetings  { title, hours }  starts a meeting; returns its link and the host's way in
async function handleCreate(req, res, deps) {
    requirePermission(req, deps);
    await ensureSchema();
    const body = await deps.readJson(req);
    const title = String(body.title || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!title) throw fail(400, 'Enter a title for the meeting.');
    const hours = DURATIONS_HOURS.includes(Number(body.hours)) ? Number(body.hours) : 2;
    const [[{ n }]] = await db.query(`SELECT COUNT(*) AS n FROM public_meetings WHERE status = 'ACTIVE' AND expires_at > NOW(3)`);
    if (Number(n) >= MAX_ACTIVE) throw fail(409, `${MAX_ACTIVE} public meetings are already open. End one before starting another.`);

    const who = deps.caller(req);
    const now = new Date();
    const row = {
        id: deps.newId('pmeet'),
        code: crypto.randomBytes(18).toString('base64url'),
        room_name: `${ROOM_PREFIX}${crypto.randomBytes(12).toString('hex')}`,
        title,
        created_by: who.id,
        created_by_name: (who.user && who.user.name) || who.id,
        status: 'ACTIVE',
        created_at: now,
        expires_at: new Date(now.getTime() + hours * 3600 * 1000),
        ended_at: null
    };
    await db.query(`INSERT INTO public_meetings (id, code, room_name, title, created_by, created_by_name, status, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.code, row.room_name, row.title, row.created_by, row.created_by_name, row.status, row.created_at, row.expires_at]);
    await audit.log({ req, action: 'public_meeting.start', entityType: 'public_meeting', entityId: row.id, summary: `Started public meeting "${title}" (${hours} h)` });
    const meeting = toJson(req, row);
    const join = await joinInfo(deps, row, { id: who.id, ...(who.user || {}) }, true);
    deps.sendJson(res, 201, { success: true, meeting, join });
}

// POST /api/public-meetings/:id/host  the moderator's way (back) into an open meeting
async function handleHost(req, res, deps, id) {
    requirePermission(req, deps);
    await ensureSchema();
    const row = await loadById(id);
    if (!isActive(row)) throw fail(410, 'This public meeting has ended.');
    cancelPendingEnd(row.id);
    const who = deps.caller(req);
    const join = await joinInfo(deps, row, { id: who.id, ...(who.user || {}) }, true);
    deps.sendJson(res, 200, { success: true, meeting: toJson(req, row), join });
}

// GET /api/public-meetings/:id  whether it is still open (asked by the host's tab)
async function handleGet(req, res, deps, id) {
    requirePermission(req, deps);
    await ensureSchema();
    deps.sendJson(res, 200, { success: true, meeting: toJson(req, await loadById(id)) });
}

// POST /api/public-meetings/:id/end  the link stops working at once
async function handleEnd(req, res, deps, id) {
    requirePermission(req, deps);
    await ensureSchema();
    const row = await loadById(id);
    await endMeeting(row, deps, req.auth, req);
    deps.sendJson(res, 200, { success: true, meeting: toJson(req, await loadById(id)) });
}

// POST /api/public-meetings/:id/left  the host's tab is closing with nobody else in the meeting.
// A reload looks the same from here, so it only ends if the host does not come back (handleHost).
async function handleLeft(req, res, deps, id) {
    requirePermission(req, deps);
    await ensureSchema();
    const row = await loadById(id);
    if (isActive(row)) {
        cancelPendingEnd(row.id);
        const actor = { id: req.auth.id, role: req.auth.role };
        const timer = setTimeout(() => {
            pendingEnds.delete(row.id);
            endMeeting(row, deps, actor).catch(err => console.warn('[Public meetings] Could not end an empty meeting:', err.message));
        }, EMPTY_TAB_GRACE_MS);
        timer.unref();
        pendingEnds.set(row.id, timer);
    }
    deps.sendJson(res, 202, { success: true });
}

// POST /api/public-meetings/lookup  { code }  (no sign-in) what the join page shows before the name is entered
async function handleLookup(req, res, deps) {
    checkLookupLimit(req);
    await ensureSchema();
    const body = await deps.readJson(req);
    const row = await loadByCode(body.code);
    deps.sendJson(res, 200, {
        success: true,
        meeting: { title: row.title, hostName: row.created_by_name, active: isActive(row), expiresAt: new Date(row.expires_at).toISOString() }
    });
}

// POST /api/public-meetings/join  { code, name }  (no sign-in) a guest token for this one room
async function handleJoin(req, res, deps) {
    checkLookupLimit(req);
    await ensureSchema();
    const body = await deps.readJson(req);
    const row = await loadByCode(body.code);
    if (!isActive(row)) throw fail(410, 'This meeting has ended.');
    const name = String(body.name || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (name.length < 2) throw fail(400, 'Enter your name.');
    cancelPendingEnd(row.id); // someone is coming in, so it is not empty after all
    const guest = { id: `guest_${crypto.randomBytes(6).toString('hex')}`, name: `${name} (Guest)` };
    const join = await joinInfo(deps, row, guest, false);
    deps.sendJson(res, 200, {
        success: true, title: row.title, displayName: guest.name, join,
        guest: { id: guest.id, name: guest.name, key: guestKey(row.id, guest.id, guest.name) }
    });
}

async function route(req, res, url, deps) {
    const p = url.pathname;
    const m = req.method;
    if (p !== '/api/public-meetings' && !p.startsWith('/api/public-meetings/')) return false;
    if (p === '/api/public-meetings' && m === 'GET') { await handleList(req, res, deps); return true; }
    if (p === '/api/public-meetings' && m === 'POST') { await handleCreate(req, res, deps); return true; }
    if (p === '/api/public-meetings/lookup' && m === 'POST') { await handleLookup(req, res, deps); return true; }
    if (p === '/api/public-meetings/join' && m === 'POST') { await handleJoin(req, res, deps); return true; }
    const match = /^\/api\/public-meetings\/([^/]+)(?:\/(host|end|left))?$/.exec(p);
    if (match) {
        const id = decodeURIComponent(match[1]);
        if (!match[2] && m === 'GET') { await handleGet(req, res, deps, id); return true; }
        if (match[2] === 'host' && m === 'POST') { await handleHost(req, res, deps, id); return true; }
        if (match[2] === 'end' && m === 'POST') { await handleEnd(req, res, deps, id); return true; }
        if (match[2] === 'left' && m === 'POST') { await handleLeft(req, res, deps, id); return true; }
    }
    throw fail(404, 'Not found');
}

module.exports = { route, ensureSchema, recordingTarget, guestTarget, findByRoom, PERMISSION, ROOM_PREFIX };
