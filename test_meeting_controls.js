/**
 * Jamia Ashrafia LMS - Meeting controls tests (the host's Meeting Settings in a class or public meeting)
 *
 * Creates throw-away accounts (ids starting with "mctest_"), switches the meeting service to token sign-in with a
 * test secret for the run, checks who may read and change the settings and the recording requests through the
 * real HTTP API, then removes everything it created and restores the meeting service settings.
 *
 *   npm run test:meeting-controls
 */

const http = require('http');
const crypto = require('crypto');
const db = require('./database/db');
const auth = require('./server/auth');

const TEST_PORT = 3058;
process.env.PORT = TEST_PORT;

const P = `mctest_${Date.now().toString(36)}_`;
const R = P.toUpperCase();
const roleIds = { opener: `${R}OPENER` };
const ids = { opener: `${P}opener`, teacher: `${P}t1`, student: `${P}s1`, outsider: `${P}s2`, classA: `${P}clsA`, classB: `${P}clsB`, vcA: `${P}vcA` };
const passwords = {};
const SECRET = crypto.randomBytes(24).toString('hex');

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
    if (ok) passed++; else failed++;
    console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${ok ? '' : ` ${detail}`}`);
}

function request(method, path, { cookie, body } = {}) {
    return new Promise((resolve, reject) => {
        const data = body === undefined ? null : JSON.stringify(body);
        const req = http.request({
            hostname: '127.0.0.1', port: TEST_PORT, path, method,
            headers: {
                ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
                ...(cookie ? { Cookie: cookie } : {})
            }
        }, res => {
            let raw = '';
            res.on('data', c => { raw += c; });
            res.on('end', () => {
                let parsed = raw;
                try { parsed = JSON.parse(raw); } catch (e) { /* plain text */ }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

const mc = (path, body, cookie) => request('POST', `/api/meeting-controls/${path}`, { cookie, body });

async function login(id) {
    const r = await request('POST', '/api/auth/login', { body: { identifier: `${id}@test.local`, password: passwords[id] } });
    const set = [].concat(r.headers['set-cookie'] || []).find(c => c.startsWith(`${auth.COOKIE_NAME}=`));
    return set ? set.split(';')[0] : null;
}

async function insertRecord(collection, rec) {
    await db.query(
        `INSERT INTO lms_records (collection, id, data, deleted, updated_by, updated_at) VALUES (?, ?, ?, 0, 'mctest', NOW(3))
         ON DUPLICATE KEY UPDATE data = VALUES(data), deleted = 0`,
        [collection, rec.id, JSON.stringify(rec)]
    );
}

async function createUser(id, fields) {
    await insertRecord('users', { id, status: 'ACTIVE', name: `Test ${id.slice(-6)}`, email: `${id}@test.local`, ...fields });
    passwords[id] = auth.temporaryPassword(12);
    await auth.setPassword(null, id, passwords[id], false);
}

async function createRole(id, name, permissions) {
    await db.query(`INSERT INTO roles (id, name, scope, is_system, status, version, updated_by) VALUES (?, ?, 'ALL', 0, 'ACTIVE', 1, 'mctest')`, [id, name]);
    for (const perm of permissions) await db.query(`INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)`, [id, perm]);
}

async function getSettingRow(key) {
    const [rows] = await db.query(`SELECT setting_value FROM system_settings WHERE setting_key = ?`, [key]);
    return rows.length ? rows[0].setting_value : null;
}

async function putSettingRow(key, value) {
    if (value === null) await db.query(`DELETE FROM system_settings WHERE setting_key = ?`, [key]);
    else await db.query(`INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [key, value]);
}

async function cleanup(backup) {
    const like = `${P}%`;
    await db.query(`DELETE FROM meeting_controls WHERE updated_by LIKE ?`, [like]).catch(() => {});
    await db.query(`DELETE FROM public_meetings WHERE title LIKE ?`, [like]).catch(() => {});
    await db.query(`DELETE FROM lms_records WHERE id LIKE ?`, [like]);
    await db.query(`DELETE FROM user_credentials WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM auth_sessions WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM user_roles WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM role_permissions WHERE role_id LIKE ?`, [`${R}%`]);
    await db.query(`DELETE FROM roles WHERE id LIKE ?`, [`${R}%`]);
    await db.query(`DELETE FROM audit_log WHERE actor_id LIKE ? OR summary LIKE ?`, [like, `%${P}%`]);
    for (const [key, value] of Object.entries(backup)) await putSettingRow(key, value);
}

async function run() {
    if (!(await db.testConnection())) process.exit(1);
    require('./server');
    await new Promise(r => setTimeout(r, 1200));

    const backup = { meeting: await getSettingRow('meeting'), meetingSecrets: await getSettingRow('meetingSecrets') };
    try {
        await putSettingRow('meeting', JSON.stringify({ domain: 'meet.example.test', embed: true, authMode: 'JWT', appId: 'mctest_app', jaasKeyId: '' }));
        await putSettingRow('meetingSecrets', JSON.stringify({ appSecret: SECRET }));

        await createRole(roleIds.opener, 'Mctest opener', ['virtual_classes.view', 'virtual_classes.public_meeting']);
        await createUser(ids.opener, { role: roleIds.opener });
        await createUser(ids.teacher, { role: 'TEACHER' });
        await createUser(ids.student, { role: 'STUDENT', classId: ids.classA });
        await createUser(ids.outsider, { role: 'STUDENT', classId: ids.classB });
        await insertRecord('classes', { id: ids.classA, name: 'Mctest A', teacherId: ids.teacher, courseTeachers: [] });
        await insertRecord('classes', { id: ids.classB, name: 'Mctest B', teacherId: null, courseTeachers: [] });
        await insertRecord('virtualClasses', { id: ids.vcA, title: `${P}Fiqh live`, classId: ids.classA, hostId: ids.teacher, status: 'LIVE' });
        await require('./server/roles').load();

        const sess = {};
        for (const key of ['opener', 'teacher', 'student', 'outsider']) sess[key] = await login(ids[key]);
        check('Test accounts can sign in', Object.values(sess).every(Boolean));
        const cls = { sessionId: ids.vcA };

        // --- A class: who may read and change the settings --------------------------------------------
        const first = await mc('state', cls, sess.student);
        check('An enrolled student reads the settings', first.status === 200 && first.body.isHost === false, JSON.stringify(first.body));
        check('They start as before: chat, names, microphones and cameras allowed; no recording requests',
            JSON.stringify(first.body.settings) === JSON.stringify({ chat: true, rename: true, unmute: true, video: true, recordRequests: false }));
        check('The student is not shown anyone\'s requests', !('requests' in first.body));
        const hostState = await mc('state', cls, sess.teacher);
        check('The class teacher is the host', hostState.status === 200 && hostState.body.isHost === true && Array.isArray(hostState.body.requests));
        check('A student of another class cannot read them', (await mc('state', cls, sess.outsider)).status === 403);
        check('Signed-out visitors cannot read a class\'s settings', (await mc('state', cls)).status === 401);
        check('A student cannot change them', (await mc('settings', { ...cls, settings: { chat: false } }, sess.student)).status === 403);
        check('Signed-out visitors cannot change them', (await mc('settings', { ...cls, settings: { chat: false } })).status === 401);
        check('No meeting given is refused', (await mc('state', {}, sess.student)).status === 400);

        const changed = await mc('settings', { ...cls, settings: { chat: false, rename: false, unmute: false, video: false, extra: 'x', recordRequests: 'yes' } }, sess.teacher);
        check('The host changes them', changed.status === 200 && changed.body.settings.chat === false && changed.body.settings.rename === false
            && changed.body.settings.unmute === false && changed.body.settings.video === false, JSON.stringify(changed.body));
        check('Only known settings with yes/no values are kept', !('extra' in changed.body.settings) && changed.body.settings.recordRequests === false);
        const seen = await mc('state', cls, sess.student);
        check('The student gets the new settings', seen.body.settings.chat === false && seen.body.settings.unmute === false);
        const [stored] = await db.query(`SELECT settings FROM meeting_controls WHERE updated_by = ?`, [ids.teacher]);
        check('They are kept on the server, so they hold when the host rejoins', stored.length === 1 && JSON.parse(stored[0].settings).chat === false);
        const [logged] = await db.query(`SELECT summary FROM audit_log WHERE action = 'meeting.settings' AND actor_id = ?`, [ids.teacher]);
        check('The change is in the audit log', logged.length === 1 && /Chat off/.test(logged[0].summary) && /may not unmute/.test(logged[0].summary), JSON.stringify(logged));
        await mc('settings', { ...cls, settings: { chat: false } }, sess.teacher);
        const [logged2] = await db.query(`SELECT id FROM audit_log WHERE action = 'meeting.settings' AND actor_id = ?`, [ids.teacher]);
        check('Saving without a change adds nothing to the log', logged2.length === 1);

        // --- A class: asking to record to the computer -------------------------------------------------
        check('Asking to record is refused while the host does not allow it', (await mc('request', cls, sess.student)).status === 403);
        check('The host does not ask', (await mc('request', cls, sess.teacher)).status === 400);
        await mc('settings', { ...cls, settings: { recordRequests: true } }, sess.teacher);
        const asked = await mc('request', cls, sess.student);
        check('Once allowed, a student asks', asked.status === 200 && asked.body.request.status === 'pending', JSON.stringify(asked.body));
        const again = await mc('request', cls, sess.student);
        check('Asking twice keeps one request', again.body.request.id === asked.body.request.id);
        check('Recording before the host answers is refused', (await mc('recording', { ...cls, on: true }, sess.student)).status === 403);
        const hostSees = (await mc('state', cls, sess.teacher)).body.requests;
        check('The host sees the request, with the student\'s name', hostSees.length === 1 && hostSees[0].status === 'pending' && hostSees[0].name === `Test ${ids.student.slice(-6)}`, JSON.stringify(hostSees));
        check('A student cannot answer it', (await mc('answer', { ...cls, requestId: asked.body.request.id, allow: true }, sess.student)).status === 403);
        check('An unknown request is not found', (await mc('answer', { ...cls, requestId: 'rrnope', allow: true }, sess.teacher)).status === 404);
        const allowed = await mc('answer', { ...cls, requestId: asked.body.request.id, allow: true }, sess.teacher);
        check('The host allows it', allowed.status === 200 && allowed.body.requests[0].status === 'allowed');
        check('The student sees it allowed', (await mc('state', cls, sess.student)).body.request.status === 'allowed');
        const [allowLog] = await db.query(`SELECT id FROM audit_log WHERE action = 'meeting.local_recording_allowed' AND actor_id = ?`, [ids.teacher]);
        check('Allowing is in the audit log', allowLog.length === 1);
        check('The student starts recording', (await mc('recording', { ...cls, on: true }, sess.student)).body.request.status === 'recording');
        check('The host sees them recording', (await mc('state', cls, sess.teacher)).body.requests[0].status === 'recording');
        check('Stopping keeps the permission', (await mc('recording', { ...cls, on: false }, sess.student)).body.request.status === 'allowed');
        await mc('answer', { ...cls, requestId: asked.body.request.id, allow: false }, sess.teacher);
        check('The host withdraws it', (await mc('state', cls, sess.student)).body.request.status === 'denied');
        check('Recording is then refused', (await mc('recording', { ...cls, on: true }, sess.student)).status === 403);
        check('A refused request drops out of the host\'s list', (await mc('state', cls, sess.teacher)).body.requests.length === 0);
        check('The student may ask again', (await mc('request', cls, sess.student)).body.request.status === 'pending');
        check('Cancelling removes the request', (await mc('request', { ...cls, cancel: true }, sess.student)).body.request === null);
        await mc('request', cls, sess.student);
        await mc('settings', { ...cls, settings: { recordRequests: false } }, sess.teacher);
        check('Turning requests off withdraws every request', (await mc('state', cls, sess.student)).body.request === null
            && (await mc('state', cls, sess.teacher)).body.requests.length === 0);

        // --- A public meeting: the host and the guests -------------------------------------------------
        const created = await request('POST', '/api/public-meetings', { cookie: sess.opener, body: { title: `${P}Parents meeting`, hours: 1 } });
        const meeting = created.body.meeting;
        const code = (/\/meet\/([A-Za-z0-9_-]+)$/.exec(meeting.link) || [])[1];
        const pub = { publicMeetingId: meeting.id };
        const joined = await request('POST', '/api/public-meetings/join', { body: { code, name: 'Abdullah' } });
        const g = joined.body.guest || {};
        check('A guest joining gets a key for the meeting settings', joined.status === 200 && /^guest_[0-9a-f]{12}$/.test(g.id) && g.name === 'Abdullah (Guest)' && !!g.key, JSON.stringify(joined.body));
        const guest = { code, guestId: g.id, guestName: g.name, guestKey: g.key };
        const gState = await mc('state', guest);
        check('The guest reads the settings without signing in', gState.status === 200 && gState.body.isHost === false && gState.body.settings.chat === true, JSON.stringify(gState.body));
        check('A wrong key is refused', (await mc('state', { ...guest, guestKey: 'x'.repeat(43) })).status === 403);
        check('Another name with the same key is refused', (await mc('state', { ...guest, guestName: 'Host (Guest)' })).status === 403);
        check('A made-up guest is refused', (await mc('state', { ...guest, guestId: 'guest_000000000000' })).status === 403);
        check('A wrong code is refused', (await mc('state', { ...guest, code: 'A'.repeat(24) })).status === 404);
        check('A guest cannot change the settings', (await mc('settings', { ...guest, settings: { chat: false } })).status === 401);
        check('The meeting\'s host reads them as host', (await mc('state', pub, sess.opener)).body.isHost === true);
        check('A teacher is not its host', (await mc('state', pub, sess.teacher)).status === 403);
        await mc('settings', { ...pub, settings: { chat: false, recordRequests: true } }, sess.opener);
        check('The guest gets the host\'s settings', (await mc('state', guest)).body.settings.chat === false);
        check('The class keeps its own settings', (await mc('state', cls, sess.student)).body.settings.recordRequests === false);
        const gAsk = await mc('request', guest);
        check('A guest asks to record', gAsk.status === 200 && gAsk.body.request.status === 'pending');
        const pubRequests = (await mc('state', pub, sess.opener)).body.requests;
        check('The host sees the guest\'s request', pubRequests.length === 1 && pubRequests[0].name === 'Abdullah (Guest)');
        await mc('answer', { ...pub, requestId: gAsk.body.request.id, allow: true }, sess.opener);
        check('The guest is allowed', (await mc('recording', { ...guest, on: true })).body.request.status === 'recording');

        await request('POST', `/api/public-meetings/${meeting.id}/end`, { cookie: sess.opener });
        check('Once the meeting ends, its guests are told so', (await mc('state', guest)).status === 410);
        check('And its host can no longer change the settings', (await mc('settings', { ...pub, settings: { chat: true } }, sess.opener)).status === 410);
    } finally {
        await cleanup(backup);
    }
    console.log(`\n${passed} passed, ${failed} failed. Test data removed.`);
    process.exit(failed ? 1 : 0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
