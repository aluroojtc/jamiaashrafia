/**
 * Jamia Ashrafia LMS - Meeting controls (the host's Meeting Settings in a live class or a public meeting)
 *
 * The host (moderator) decides, while the meeting runs:
 *   chat            the chat box is on or off for everyone
 *   rename          participants may change the name they joined with
 *   unmute          participants may unmute themselves (otherwise they raise a hand and the host lets them speak)
 *   video           participants may turn on their camera (otherwise the host lets them, one by one)
 *   recordRequests  participants may ask to record the meeting to their own computer; each request waits
 *                   for the host to allow it
 *
 * The settings are kept per meeting room, so they hold when the host reloads or rejoins. Everyone's meeting tab
 * (live.html for classes and the host of a public meeting, meet.html for public meeting guests) asks for them
 * every few seconds and applies them (js/meeting-controls.js). Unmute and camera are enforced by the meeting
 * server itself (Jitsi's audio/video moderation, switched by the host's tab), chat and names by each tab.
 *
 * Recording requests live in memory only: they belong to one sitting of a meeting and are not needed afterwards.
 * Recordings to a computer never reach this server; it only records who was allowed.
 *
 * Who is asking is decided as for joining:
 *   { sessionId }                              a live class: its host, or an enrolled student
 *   { publicMeetingId }                        the host of a public meeting (holder of the permission)
 *   { code, guestId, guestName, guestKey }     a public meeting guest, with the key the join gave them
 */

const db = require('../database/db');
const audit = require('./audit');
const publicMeetings = require('./public-meetings');

const DEFAULTS = Object.freeze({ chat: true, rename: true, unmute: true, video: true, recordRequests: false });
const KEYS = Object.keys(DEFAULTS);
const LABELS = {
    chat: ['Chat on', 'Chat off'],
    rename: ['participants may rename themselves', 'participants may not rename themselves'],
    unmute: ['participants may unmute themselves', 'participants may not unmute themselves'],
    video: ['participants may turn on their camera', 'participants may not turn on their camera'],
    recordRequests: ['participants may ask to record to their computer', 'participants may not ask to record']
};
// A class's access check is repeated by every tab every few seconds; its answer is reused for this long
const ACCESS_CACHE_MS = 30 * 1000;
const MAX_REQUESTS_PER_ROOM = 300;
const REQUEST_STATUSES = ['pending', 'allowed', 'denied', 'recording'];

let schemaReady = null;

function ensureSchema() {
    if (!schemaReady) {
        schemaReady = db.query(`CREATE TABLE IF NOT EXISTS meeting_controls (
            room_name VARCHAR(120) PRIMARY KEY,
            settings TEXT NOT NULL,
            updated_by VARCHAR(120) NULL,
            updated_at DATETIME(3) NOT NULL
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

// ---------------------------------------------------------------------------
// Settings, per meeting room
// ---------------------------------------------------------------------------

const settingsCache = new Map(); // room -> settings

function merge(stored) {
    const out = { ...DEFAULTS };
    for (const k of KEYS) if (stored && typeof stored[k] === 'boolean') out[k] = stored[k];
    return out;
}

async function loadSettings(room) {
    if (settingsCache.has(room)) return settingsCache.get(room);
    await ensureSchema();
    const [rows] = await db.query(`SELECT settings FROM meeting_controls WHERE room_name = ? LIMIT 1`, [room]);
    let stored = null;
    try { stored = rows.length ? JSON.parse(rows[0].settings) : null; } catch (e) { /* unreadable: defaults */ }
    const settings = merge(stored);
    settingsCache.set(room, settings);
    if (settingsCache.size > 2000) settingsCache.delete(settingsCache.keys().next().value);
    return settings;
}

async function saveSettings(room, settings, actorId) {
    await ensureSchema();
    await db.query(`INSERT INTO meeting_controls (room_name, settings, updated_by, updated_at) VALUES (?, ?, ?, NOW(3))
        ON DUPLICATE KEY UPDATE settings = VALUES(settings), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)`,
    [room, JSON.stringify(settings), actorId || null]);
    settingsCache.set(room, settings);
}

// ---------------------------------------------------------------------------
// Requests to record to a computer, per meeting room (memory only)
// ---------------------------------------------------------------------------

const requests = new Map(); // room -> Map(personKey -> { id, name, status, at })
let requestSeq = 0;

function roomRequests(room, create) {
    let list = requests.get(room);
    if (!list && create) {
        list = new Map();
        requests.set(room, list);
    }
    return list || new Map();
}

function requestJson(r) {
    return r ? { id: r.id, name: r.name, status: r.status, at: new Date(r.at).toISOString() } : null;
}

// What the host's tab shows: everyone waiting, allowed or recording (refused ones drop out)
function hostList(room) {
    return [...roomRequests(room).values()].filter(r => r.status !== 'denied').sort((a, b) => a.at - b.at).map(requestJson);
}

// ---------------------------------------------------------------------------
// Who is asking, and about which room
// ---------------------------------------------------------------------------

const accessCache = new Map(); // `${userId}|${sessionId}` -> { at, room, isHost, title }

async function classTarget(req, deps, sessionId, fresh) {
    const who = deps.caller(req);
    if (!who.id) throw fail(401, 'Please sign in.');
    const key = `${who.id}|${sessionId}`;
    const cached = accessCache.get(key);
    let decided = !fresh && cached && Date.now() - cached.at < ACCESS_CACHE_MS ? cached : null;
    if (!decided) {
        const d = await deps.decideVirtualAccess(req, String(sessionId));
        if (d.status !== 200) {
            accessCache.delete(key);
            throw fail(d.status, d.message || 'You cannot join this class.');
        }
        decided = { at: Date.now(), room: deps.meetingRoomName(d.session), isHost: !!d.isHost, title: d.session.title || '' };
        accessCache.set(key, decided);
        if (accessCache.size > 5000) {
            for (const [k, v] of accessCache) if (Date.now() - v.at > ACCESS_CACHE_MS) accessCache.delete(k);
        }
    }
    return {
        room: decided.room, isHost: decided.isHost, title: decided.title, kind: 'class',
        person: { key: `u:${who.id}`, id: who.id, name: (who.user && who.user.name) || who.id }
    };
}

async function resolveTarget(req, deps, body, fresh = false) {
    if (body.sessionId) return classTarget(req, deps, body.sessionId, fresh);
    if (body.publicMeetingId) {
        const who = deps.caller(req);
        if (!who.id) throw fail(401, 'Please sign in.');
        const m = await publicMeetings.recordingTarget(req, deps, body.publicMeetingId);
        return {
            room: m.roomName, isHost: true, title: m.title, kind: 'public',
            person: { key: `u:${who.id}`, id: who.id, name: (who.user && who.user.name) || who.id }
        };
    }
    if (body.code) {
        const g = await publicMeetings.guestTarget(body.code, body.guestId, body.guestName, body.guestKey);
        return { room: g.roomName, isHost: false, title: g.title, kind: 'public', person: { key: `g:${g.guestId}`, id: g.guestId, name: g.guestName } };
    }
    throw fail(400, 'No meeting given.');
}

function requireHost(t) {
    if (!t.isHost) throw fail(403, 'Only the host can change the meeting settings.');
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// POST /api/meeting-controls/state  the settings; the host also gets the recording requests, a participant their own
async function handleState(req, res, deps) {
    const body = await deps.readJson(req);
    const t = await resolveTarget(req, deps, body);
    const settings = await loadSettings(t.room);
    const out = { success: true, isHost: t.isHost, settings };
    if (t.isHost) out.requests = hostList(t.room);
    else out.request = requestJson(roomRequests(t.room).get(t.person.key));
    deps.sendJson(res, 200, out);
}

// POST /api/meeting-controls/settings  { ...target, settings: { chat, rename, unmute, video, recordRequests } }  host only
async function handleSettings(req, res, deps) {
    const body = await deps.readJson(req);
    const t = await resolveTarget(req, deps, body, true);
    requireHost(t);
    const before = await loadSettings(t.room);
    const after = merge({ ...before, ...(body.settings && typeof body.settings === 'object' ? body.settings : {}) });
    const changed = KEYS.filter(k => after[k] !== before[k]);
    if (changed.length) {
        await saveSettings(t.room, after, t.person.id);
        // Turning requests off withdraws every permission given; the tabs recording stop and save what they have
        if (!after.recordRequests) requests.delete(t.room);
        await audit.log({
            req, action: 'meeting.settings', entityType: t.kind === 'class' ? 'virtual_class' : 'public_meeting', entityId: t.room,
            summary: `Meeting settings for "${t.title}": ${changed.map(k => LABELS[k][after[k] ? 0 : 1]).join(', ')}`,
            before, after
        });
    }
    deps.sendJson(res, 200, { success: true, settings: after, requests: hostList(t.room) });
}

// POST /api/meeting-controls/request  { ...target, cancel? }  a participant asks to record to their computer
async function handleRequest(req, res, deps) {
    const body = await deps.readJson(req);
    const t = await resolveTarget(req, deps, body);
    if (t.isHost) throw fail(400, 'The host can record without asking.');
    const list = roomRequests(t.room, true);
    if (body.cancel) {
        list.delete(t.person.key);
        deps.sendJson(res, 200, { success: true, request: null });
        return;
    }
    const settings = await loadSettings(t.room);
    if (!settings.recordRequests) throw fail(403, 'The host does not allow requests to record.');
    let r = list.get(t.person.key);
    if (!r || r.status === 'denied') {
        if (!r && list.size >= MAX_REQUESTS_PER_ROOM) throw fail(429, 'Too many requests in this meeting. Please try again later.');
        r = { id: `rr${Date.now().toString(36)}${(++requestSeq).toString(36)}`, name: t.person.name, status: 'pending', at: Date.now() };
        list.set(t.person.key, r);
    }
    deps.sendJson(res, 200, { success: true, request: requestJson(r) });
}

// POST /api/meeting-controls/answer  { ...target, requestId, allow }  host only; allow:false also withdraws a permission
async function handleAnswer(req, res, deps) {
    const body = await deps.readJson(req);
    const t = await resolveTarget(req, deps, body, true);
    requireHost(t);
    const r = [...roomRequests(t.room).values()].find(x => x.id === String(body.requestId || ''));
    if (!r) throw fail(404, 'This request is no longer waiting. The participant may have left or cancelled it.');
    const allow = body.allow === true;
    if (allow && r.status === 'pending') r.status = 'allowed';
    if (!allow) r.status = 'denied';
    if (allow) {
        await audit.log({
            req, action: 'meeting.local_recording_allowed', entityType: t.kind === 'class' ? 'virtual_class' : 'public_meeting', entityId: t.room,
            summary: `Allowed ${r.name} to record "${t.title}" to their computer`
        });
    }
    deps.sendJson(res, 200, { success: true, requests: hostList(t.room) });
}

// POST /api/meeting-controls/recording  { ...target, on }  a participant's tab says it started or stopped recording
async function handleRecording(req, res, deps) {
    const body = await deps.readJson(req);
    const t = await resolveTarget(req, deps, body);
    if (t.isHost) {
        deps.sendJson(res, 200, { success: true, request: null });
        return;
    }
    const r = roomRequests(t.room).get(t.person.key);
    if (body.on === true) {
        if (!r || !['allowed', 'recording'].includes(r.status)) throw fail(403, 'The host has not allowed you to record.');
        r.status = 'recording';
    } else if (r && r.status === 'recording') {
        r.status = 'allowed';
    }
    deps.sendJson(res, 200, { success: true, request: requestJson(r) });
}

// Paths anyone may call without signing in (guests of a public meeting); each still checks who is asking
const GUEST_API = ['POST /api/meeting-controls/state', 'POST /api/meeting-controls/request', 'POST /api/meeting-controls/recording'];

async function route(req, res, url, deps) {
    const p = url.pathname;
    if (!p.startsWith('/api/meeting-controls/') || req.method !== 'POST') return false;
    if (p === '/api/meeting-controls/state') { await handleState(req, res, deps); return true; }
    if (p === '/api/meeting-controls/settings') { await handleSettings(req, res, deps); return true; }
    if (p === '/api/meeting-controls/request') { await handleRequest(req, res, deps); return true; }
    if (p === '/api/meeting-controls/answer') { await handleAnswer(req, res, deps); return true; }
    if (p === '/api/meeting-controls/recording') { await handleRecording(req, res, deps); return true; }
    throw fail(404, 'Not found');
}

module.exports = { route, ensureSchema, DEFAULTS, GUEST_API, REQUEST_STATUSES };
