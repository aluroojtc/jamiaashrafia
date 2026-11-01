/**
 * Jamia Ashrafia LMS - Live class recording tests
 *
 * Runs the whole recording workflow through the real HTTP API with real sessions: a teacher starts and stops
 * recording, the recorder (Jibri) drops its MP4 into its folder (simulated here with a small file in a temporary
 * folder), the teacher saves or discards it, students of the class are notified and can stream it (with byte
 * ranges for seeking) while students of other classes, other teachers and signed-out visitors cannot. Also checks
 * a decision made before the file arrives, a failed start, the one-recorder limit, deleting a recording (its file
 * goes too) and that the live classroom sign-in still works. Everything created is removed (ids start with
 * "rectest_"); the live classroom settings are restored.
 *
 *   npm run test:recordings
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rectest-'));
process.env.JIBRI_RECORDINGS_DIR = path.join(TMP, 'jibri');
process.env.CLASS_RECORDINGS_DIR = path.join(TMP, 'lms');
fs.mkdirSync(process.env.JIBRI_RECORDINGS_DIR, { recursive: true });

const TEST_PORT = 3058;
process.env.PORT = TEST_PORT;

const db = require('./database/db');
const auth = require('./server/auth');

const P = `rectest_${Date.now().toString(36)}_`;
const ids = {
    super: `${P}super`, teacherA: `${P}ta`, teacherB: `${P}tb`, studentA: `${P}sa`, studentB: `${P}sb`,
    clsA: `${P}clsA`, clsB: `${P}clsB`, vcA: `${P}vcA`, vcB: `${P}vcB`
};
const passwords = {};
const cookies = {};
let failed = 0;
let passed = 0;

function check(name, ok, detail) {
    if (ok) { passed++; console.log(`[PASS] ${name}`); }
    else { failed++; console.log(`[FAIL] ${name}${detail !== undefined ? ` -> ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`); }
}

function request(method, urlPath, { cookie, body, headers = {} } = {}) {
    return new Promise((resolve, reject) => {
        const data = body === undefined ? null : JSON.stringify(body);
        const req = http.request({
            hostname: '127.0.0.1', port: TEST_PORT, path: urlPath, method,
            headers: {
                ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
                ...(cookie ? { Cookie: cookie } : {}),
                ...headers
            }
        }, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const buf = Buffer.concat(chunks);
                let parsed = buf.toString('utf8');
                try { parsed = JSON.parse(parsed); } catch (e) { /* not JSON */ }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: buf });
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

const as = (who, method, urlPath, body, headers) => request(method, urlPath, { cookie: cookies[who], body, headers });

async function insertRecord(collection, rec) {
    await db.query(
        `INSERT INTO lms_records (collection, id, data, deleted, updated_by, updated_at) VALUES (?, ?, ?, 0, 'rectest', NOW(3))
         ON DUPLICATE KEY UPDATE data = VALUES(data), deleted = 0`,
        [collection, rec.id, JSON.stringify(rec)]
    );
}

async function stored(collection, id) {
    const [rows] = await db.query(`SELECT data, deleted FROM lms_records WHERE collection = ? AND id = ?`, [collection, id]);
    return rows.length ? { ...JSON.parse(rows[0].data), _deleted: !!rows[0].deleted } : null;
}

async function createUser(id, fields) {
    await insertRecord('users', { id, status: 'ACTIVE', name: `Rectest ${id.slice(-2)}`, email: `${id}@test.local`, ...fields });
    if (fields.role === 'SUPER_ADMIN') await db.query(`INSERT IGNORE INTO super_admins (user_id, granted_by) VALUES (?, 'rectest')`, [id]);
    passwords[id] = auth.temporaryPassword(12);
    await auth.setPassword(null, id, passwords[id], false);
}

async function login(id) {
    const r = await request('POST', '/api/auth/login', { body: { identifier: `${id}@test.local`, password: passwords[id] } });
    const set = [].concat(r.headers['set-cookie'] || []).find(c => c.startsWith(`${auth.COOKIE_NAME}=`));
    return set ? set.split(';')[0] : null;
}

// Same room name as server/lms-api.js meetingRoomName (Jitsi lower-cases it)
function roomOf(session) {
    return `JamiaAshrafia${String(session.meetingUuid || session.id).replace(/[^a-zA-Z0-9]/g, '')}${String(session.id).replace(/[^a-zA-Z0-9]/g, '').slice(-6)}`.toLowerCase();
}

// What Jibri leaves behind: /srv/recordings/<random>/<room>_<time>.mp4, metadata.json and (from our finalize script) .finalized
let fileSeq = 0;
function dropJibriFile(session, bytes = 300 * 1024) {
    const dir = path.join(process.env.JIBRI_RECORDINGS_DIR, `jibri${Date.now()}${fileSeq++}`);
    fs.mkdirSync(dir);
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
    const content = Buffer.alloc(bytes);
    for (let i = 0; i < bytes; i++) content[i] = i % 251;
    fs.writeFileSync(path.join(dir, `${roomOf(session)}_${stamp}.mp4`), content);
    fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({ meeting_url: `https://meet.test.local/${roomOf(session)}`, participants: [] }));
    fs.writeFileSync(path.join(dir, '.finalized'), '');
    return { dir, content };
}

// The finalize call starts a scan; the pending list waits for the scan in progress
async function scanNow() {
    const r = await request('POST', '/api/class-recordings/scan');
    await as('super', 'GET', '/api/class-recordings/pending');
    return r;
}

let savedMeeting;
let savedSecrets;

async function setupFixtures() {
    const [rows] = await db.query(`SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('meeting', 'meetingSecrets')`);
    savedMeeting = rows.find(r => r.setting_key === 'meeting') || null;
    savedSecrets = rows.find(r => r.setting_key === 'meetingSecrets') || null;
    const put = (k, v) => db.query(`INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [k, JSON.stringify(v)]);
    await put('meeting', { domain: 'meet.test.local', embed: true, authMode: 'JWT', appId: 'rectest', jaasKeyId: '' });
    await put('meetingSecrets', { appSecret: 'rectest-secret-0123456789abcdef' });

    await createUser(ids.super, { role: 'SUPER_ADMIN' });
    await createUser(ids.teacherA, { role: 'TEACHER' });
    await createUser(ids.teacherB, { role: 'TEACHER' });
    await createUser(ids.studentA, { role: 'STUDENT', classId: ids.clsA, rollNo: `${P}RA` });
    await createUser(ids.studentB, { role: 'STUDENT', classId: ids.clsB, rollNo: `${P}RB` });
    await insertRecord('classes', { id: ids.clsA, name: 'Rectest Class A', teacherId: ids.teacherA, courseTeachers: [] });
    await insertRecord('classes', { id: ids.clsB, name: 'Rectest Class B', teacherId: ids.teacherB, courseTeachers: [] });
    await insertRecord('virtualClasses', { id: ids.vcA, title: 'Rectest Sahih Bukhari dars', classId: ids.clsA, className: 'Rectest Class A', hostId: ids.teacherA, hostTeacher: 'Rectest ta', status: 'LIVE', isLive: true, meetingUuid: `${P}uuidA` });
    await insertRecord('virtualClasses', { id: ids.vcB, title: 'Rectest Fiqh dars', classId: ids.clsB, className: 'Rectest Class B', hostId: ids.teacherB, hostTeacher: 'Rectest tb', status: 'LIVE', isLive: true, meetingUuid: `${P}uuidB` });
    await require('./server/roles').load();
}

async function cleanup() {
    const like = `${P}%`;
    await db.query(`DELETE FROM lms_records WHERE id LIKE ? OR (collection = 'virtualClassRecordings' AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.sessionId')) LIKE ?)`, [like, like]);
    await db.query(`DELETE FROM class_recording_captures WHERE session_id LIKE ?`, [like]);
    const [notes] = await db.query(`SELECT id FROM notifications WHERE target_class_id LIKE ? OR sender_id LIKE ?`, [like, like]);
    for (const n of notes) await db.query(`DELETE FROM notification_reads WHERE notification_id = ?`, [n.id]);
    await db.query(`DELETE FROM notifications WHERE target_class_id LIKE ? OR sender_id LIKE ?`, [like, like]);
    await db.query(`DELETE FROM user_credentials WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM auth_sessions WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM super_admins WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM user_roles WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM audit_log WHERE entity_id LIKE ? OR actor_id LIKE ? OR summary LIKE ?`, [like, like, '%Rectest%']);
    for (const [key, row] of [['meeting', savedMeeting], ['meetingSecrets', savedSecrets]]) {
        if (row) await db.query(`UPDATE system_settings SET setting_value = ? WHERE setting_key = ?`, [row.setting_value, key]);
        else if (row === null) await db.query(`DELETE FROM system_settings WHERE setting_key = ?`, [key]);
    }
    fs.rmSync(TMP, { recursive: true, force: true });
}

async function run() {
    if (!(await db.testConnection())) process.exit(1);
    require('./server');
    await new Promise(r => setTimeout(r, 1500));
    await require('./server/lms-api').ensureSchema();
    try {
        await setupFixtures();
        for (const id of Object.keys(ids).filter(k => passwords[ids[k]])) cookies[id] = await login(ids[id]);
        check('Everyone can sign in', Object.values(cookies).every(Boolean), Object.keys(cookies).filter(k => !cookies[k]));
        const sessionA = await stored('virtualClasses', ids.vcA);
        const sessionB = await stored('virtualClasses', ids.vcB);

        // --- Who may start a recording
        let r = await as('studentA', 'POST', '/api/class-recordings/start', { sessionId: ids.vcA });
        check('A student cannot start recording', r.status === 403, r.status);
        r = await as('teacherB', 'POST', '/api/class-recordings/start', { sessionId: ids.vcA });
        check('A teacher cannot record another teacher\'s class', r.status === 403, r.status);
        r = await request('POST', '/api/class-recordings/start', { body: { sessionId: ids.vcA } });
        check('Signed-out visitors cannot start recording', r.status === 401, r.status);

        r = await as('teacherA', 'POST', '/api/class-recordings/start', { sessionId: ids.vcA });
        check('The host starts recording', r.status === 201 && r.body.capture && r.body.capture.status === 'RECORDING', r.body);
        const cap1 = r.body.capture.id;
        r = await as('teacherA', 'POST', '/api/class-recordings/start', { sessionId: ids.vcA });
        check('Pressing Start again returns the same recording', r.status === 200 && r.body.capture.id === cap1, r.body);
        r = await as('teacherB', 'POST', '/api/class-recordings/start', { sessionId: ids.vcB });
        check('A second class is told the recorder is busy', r.status === 409 && /busy/i.test(r.body.error), r.body);

        r = await as('studentA', 'POST', `/api/class-recordings/${cap1}/stop`);
        check('A student cannot stop the recording', r.status === 404, r.status);
        r = await as('teacherB', 'GET', '/api/class-recordings/pending');
        check('Another teacher does not see the recording waiting for a decision', r.status === 200 && !r.body.captures.some(c => c.id === cap1), r.body);

        // --- Stop, file arrives, Save
        r = await as('teacherA', 'POST', `/api/class-recordings/${cap1}/stop`);
        check('The host stops recording', r.status === 200 && r.body.capture.status === 'STOPPED', r.body);
        r = await as('super', 'GET', '/api/class-recordings/pending');
        check('The Super Admin sees it waiting for a decision', r.body.captures && r.body.captures.some(c => c.id === cap1 && !c.decision), r.body);

        const jibri1 = dropJibriFile(sessionA);
        r = await scanNow();
        check('The recorder\'s finalize call is accepted without signing in', r.status === 202, r.status);
        r = await as('teacherA', 'GET', `/api/class-recordings/${cap1}`);
        check('The recorder\'s file is picked up', r.body.capture && r.body.capture.status === 'READY' && r.body.capture.hasFile && r.body.capture.fileBytes === jibri1.content.length, r.body);
        check('The recorder\'s folder is cleaned up', !fs.existsSync(jibri1.dir));

        r = await as('teacherA', 'POST', `/api/class-recordings/${cap1}/decision`, { save: false });
        check('Do Not Save needs the second confirmation', r.status === 400, r.status);
        r = await as('teacherB', 'POST', `/api/class-recordings/${cap1}/decision`, { save: true, title: 'x' });
        check('Another teacher cannot decide', r.status === 404, r.status);
        r = await as('teacherA', 'POST', `/api/class-recordings/${cap1}/decision`, { save: true, title: 'Rectest Bukhari — Kitab al-Ilm' });
        check('Save Recording publishes it', r.status === 200 && r.body.capture.status === 'SAVED' && r.body.capture.recordingId, r.body);
        const rec1 = r.body.capture.recordingId;
        r = await as('teacherA', 'POST', `/api/class-recordings/${cap1}/decision`, { save: false, confirmDiscard: true });
        check('A saved recording cannot then be discarded through the dialog', r.status === 409, r.status);

        const record = await stored('virtualClassRecordings', rec1);
        check('The recording is attached to its class and session', record && record.classId === ids.clsA && record.sessionId === ids.vcA && record.source === 'LIVE_RECORDING' && record.title === 'Rectest Bukhari — Kitab al-Ilm', record);
        check('The video is stored privately, outside /uploads', fs.existsSync(path.join(process.env.CLASS_RECORDINGS_DIR, `${rec1}.mp4`)) && !String(record.videoUrl).includes('uploads'), record && record.videoUrl);

        const [notes] = await db.query(`SELECT * FROM notifications WHERE target_class_id = ? AND link_route = 'class-recordings'`, [ids.clsA]);
        check('Students of the class are notified', notes.length === 1 && notes[0].target_role === 'STUDENT', notes);
        r = await as('studentA', 'GET', '/api/notifications');
        check('The student sees the notification', (r.body.notifications || []).some(n => n.linkRoute === 'class-recordings'), r.body);
        r = await as('studentB', 'GET', '/api/notifications');
        check('A student of another class does not', !(r.body.notifications || []).some(n => n.linkRoute === 'class-recordings' && n.targetClassId === ids.clsA), r.body);

        // --- Who can watch
        r = await as('studentA', 'GET', '/api/store');
        check('The enrolled student receives the recording', (r.body.collections.virtualClassRecordings || []).some(x => x.id === rec1));
        r = await as('studentB', 'GET', '/api/store');
        check('A student of another class does not receive it', !(r.body.collections.virtualClassRecordings || []).some(x => x.id === rec1));

        r = await as('studentA', 'GET', `/api/class-recordings/video/${rec1}`);
        check('The enrolled student can stream the video', r.status === 200 && r.raw.length === jibri1.content.length && r.raw.equals(jibri1.content) && r.headers['content-type'] === 'video/mp4', r.status);
        r = await as('studentA', 'GET', `/api/class-recordings/video/${rec1}`, undefined, { Range: 'bytes=1000-1999' });
        check('Seeking works (byte ranges)', r.status === 206 && r.raw.length === 1000 && r.raw.equals(jibri1.content.subarray(1000, 2000)) && r.headers['content-range'] === `bytes 1000-1999/${jibri1.content.length}`, r.headers);
        r = await as('studentB', 'GET', `/api/class-recordings/video/${rec1}`);
        check('A student of another class cannot stream it', r.status === 404, r.status);
        r = await as('teacherB', 'GET', `/api/class-recordings/video/${rec1}`);
        check('A teacher of another class cannot stream it', r.status === 404, r.status);
        r = await request('GET', `/api/class-recordings/video/${rec1}`);
        check('Signed-out visitors cannot stream it', r.status === 401, r.status);
        r = await as('studentA', 'GET', `/api/class-recordings/video/${rec1}?download=1`);
        check('Students cannot download unless downloads are allowed', r.status === 403, r.status);
        r = await as('super', 'GET', `/api/class-recordings/video/${rec1}?download=1`);
        check('Staff with the download permission can download', r.status === 200 && /attachment/.test(r.headers['content-disposition'] || ''), r.headers);
        r = await as('studentA', 'GET', `/api/class-recordings/video/..%2F..%2Fpackage.json`);
        check('Paths outside the recordings folder are refused', r.status === 404, r.status);
        r = await as('studentA', 'GET', `/recordings/${rec1}.mp4`);
        check('The recordings folder is not served as static files', r.status === 404, r.status);
        await new Promise(res => setTimeout(res, 300));
        check('Views are counted', ((await stored('virtualClassRecordings', rec1)) || {}).viewsCount >= 1);

        // --- Do Not Save before the file arrives: the file is deleted when it comes
        r = await as('teacherA', 'POST', '/api/class-recordings/start', { sessionId: ids.vcA });
        const cap2 = r.body.capture && r.body.capture.id;
        check('The recorder is free again after a recording stops', r.status === 201 && cap2 && cap2 !== cap1, r.body);
        await as('teacherA', 'POST', `/api/class-recordings/${cap2}/stop`);
        r = await as('teacherA', 'POST', `/api/class-recordings/${cap2}/decision`, { save: false, confirmDiscard: true });
        check('Confirm Do Not Save discards it', r.status === 200 && r.body.capture.status === 'DISCARDED', r.body);
        const jibri2 = dropJibriFile(sessionA);
        await scanNow();
        const pendingFiles = fs.existsSync(path.join(process.env.CLASS_RECORDINGS_DIR, 'pending')) ? fs.readdirSync(path.join(process.env.CLASS_RECORDINGS_DIR, 'pending')) : [];
        check('A discarded recording\'s file is permanently deleted when it arrives', !fs.existsSync(jibri2.dir) && !pendingFiles.length, pendingFiles);
        const [[c2]] = await db.query(`SELECT status, recording_id FROM class_recording_captures WHERE id = ?`, [cap2]);
        check('No recording is published for it', c2.status === 'DISCARDED' && !c2.recording_id, c2);

        // --- Save before the file arrives: published when it comes
        r = await as('teacherA', 'POST', '/api/class-recordings/start', { sessionId: ids.vcA });
        const cap3 = r.body.capture.id;
        await as('teacherA', 'POST', `/api/class-recordings/${cap3}/stop`);
        r = await as('teacherA', 'POST', `/api/class-recordings/${cap3}/decision`, { save: true, title: 'Rectest saved early' });
        check('Saving before the video is ready waits for it', r.status === 200 && r.body.capture.decision === 'SAVE' && r.body.capture.status === 'STOPPED', r.body);
        dropJibriFile(sessionA, 64 * 1024);
        await scanNow();
        const [[c3]] = await db.query(`SELECT status, recording_id FROM class_recording_captures WHERE id = ?`, [cap3]);
        check('It is published when the video arrives', c3.status === 'SAVED' && !!c3.recording_id && !!(await stored('virtualClassRecordings', c3.recording_id)), c3);

        // --- A recorder that never starts
        r = await as('teacherA', 'POST', '/api/class-recordings/start', { sessionId: ids.vcA });
        const cap4 = r.body.capture.id;
        r = await as('teacherA', 'POST', `/api/class-recordings/${cap4}/fail`, { error: 'service-unavailable' });
        check('A failed start is recorded', r.body.capture && r.body.capture.status === 'FAILED', r.body);
        r = await as('teacherA', 'POST', `/api/class-recordings/${cap4}/decision`, { save: true, title: 'x' });
        check('A failed recording cannot be saved', r.status === 409, r.status);
        r = await as('teacherB', 'POST', '/api/class-recordings/start', { sessionId: ids.vcB });
        check('After a failed start the recorder is free for others', r.status === 201, r.body);
        if (r.body.capture) await as('teacherB', 'POST', `/api/class-recordings/${r.body.capture.id}/fail`, { error: 'test' });

        // --- Managing: deleting a recording removes its video
        r = await as('studentA', 'POST', '/api/store/sync', { deletes: { virtualClassRecordings: [rec1] } });
        check('A student cannot delete a recording', (r.body.rejected.virtualClassRecordings || []).includes(rec1), r.body);
        r = await as('teacherA', 'POST', '/api/store/sync', { deletes: { virtualClassRecordings: [rec1] } });
        await new Promise(res => setTimeout(res, 300));
        check('The class teacher can delete it, and its video file goes too', (r.body.accepted.virtualClassRecordings || []).includes(rec1) && !fs.existsSync(path.join(process.env.CLASS_RECORDINGS_DIR, `${rec1}.mp4`)), r.body);
        r = await as('studentA', 'GET', `/api/class-recordings/video/${rec1}`);
        check('A deleted recording can no longer be streamed', r.status === 404, r.status);

        // --- The live classroom itself is unchanged
        r = await as('teacherA', 'POST', '/api/virtual-class/join-token', { sessionId: ids.vcA });
        check('The live classroom sign-in still works for the host', r.status === 200 && typeof r.body.token === 'string' && r.body.isHost === true, r.body);
        r = await as('studentA', 'POST', '/api/virtual-class/join-token', { sessionId: ids.vcA });
        check('… and for an enrolled student', r.status === 200 && typeof r.body.token === 'string' && r.body.isHost === false, r.body);
        r = await as('studentB', 'POST', '/api/virtual-class/join-token', { sessionId: ids.vcA });
        check('… and still refuses students of other classes', r.status === 403, r.status);

        // --- A bare meeting link (meet.<domain>/<room>) comes back to the portal as live.html?room=<room>
        r = await as('studentA', 'POST', '/api/virtual-class/verify-access', { room: roomOf(sessionA) });
        check('A room link opens its class for an enrolled student', r.status === 200 && r.body.session && r.body.session.id === ids.vcA && r.body.isHost === false, r.body);
        r = await as('teacherA', 'POST', '/api/virtual-class/verify-access', { room: roomOf(sessionA).toUpperCase() });
        check('… and for the host, whatever the letter case', r.status === 200 && r.body.isHost === true, r.body);
        r = await as('studentB', 'POST', '/api/virtual-class/verify-access', { room: roomOf(sessionA) });
        check('… but not for students of other classes', r.status === 403, r.status);
        r = await request('POST', '/api/virtual-class/verify-access', { body: { room: roomOf(sessionA) } });
        check('… nor for signed-out visitors', r.status === 401, r.status);
        r = await as('studentA', 'POST', '/api/virtual-class/verify-access', { room: 'JamiaAshrafiaNoSuchRoom' });
        check('An unknown room link is not found', r.status === 404, r.status);
    } catch (err) {
        failed++;
        console.error('[ERROR]', err);
    } finally {
        await cleanup();
    }
    console.log(`\n${passed} passed, ${failed} failed. Test data removed.`);
    process.exit(failed ? 1 : 0);
}

run();
