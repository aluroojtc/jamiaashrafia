/**
 * Jamia Ashrafia LMS - Public meeting tests (Online Classes > Start Public Meeting)
 *
 * Creates throw-away accounts and roles (ids starting with "pmtest_"), switches the meeting service to token
 * sign-in with a test secret for the run, checks the public meeting rules through the real HTTP API, then
 * removes everything it created and restores the meeting service settings.
 *
 *   npm run test:public-meetings
 */

const http = require('http');
const crypto = require('crypto');
const db = require('./database/db');
const auth = require('./server/auth');

const TEST_PORT = 3057;
process.env.PORT = TEST_PORT;
// How long a host's closed tab waits before an empty meeting ends (shortened for this run)
const EMPTY_GRACE_MS = 400;
process.env.PUBLIC_MEETING_EMPTY_GRACE_MS = String(EMPTY_GRACE_MS);

const P = `pmtest_${Date.now().toString(36)}_`;
const R = P.toUpperCase();
const roleIds = { opener: `${R}OPENER`, plainAdmin: `${R}ADMIN` };
const ids = { superAdmin: `${P}super`, opener: `${P}opener`, plainAdmin: `${P}admin`, teacher: `${P}t1`, student: `${P}s1`, classA: `${P}clsA`, vcA: `${P}vcA` };
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

async function login(id) {
    const r = await request('POST', '/api/auth/login', { body: { identifier: `${id}@test.local`, password: passwords[id] } });
    const set = [].concat(r.headers['set-cookie'] || []).find(c => c.startsWith(`${auth.COOKIE_NAME}=`));
    return set ? set.split(';')[0] : null;
}

async function insertRecord(collection, rec) {
    await db.query(
        `INSERT INTO lms_records (collection, id, data, deleted, updated_by, updated_at) VALUES (?, ?, ?, 0, 'pmtest', NOW(3))
         ON DUPLICATE KEY UPDATE data = VALUES(data), deleted = 0`,
        [collection, rec.id, JSON.stringify(rec)]
    );
}

async function createUser(id, fields) {
    await insertRecord('users', { id, status: 'ACTIVE', name: `Test ${id.slice(-6)}`, email: `${id}@test.local`, ...fields });
    if (fields.role === 'SUPER_ADMIN') await db.query(`INSERT IGNORE INTO super_admins (user_id, granted_by) VALUES (?, 'pmtest')`, [id]);
    passwords[id] = auth.temporaryPassword(12);
    await auth.setPassword(null, id, passwords[id], false);
}

async function createRole(id, name, permissions) {
    await db.query(`INSERT INTO roles (id, name, scope, is_system, status, version, updated_by) VALUES (?, ?, 'ALL', 0, 'ACTIVE', 1, 'pmtest')`, [id, name]);
    for (const perm of permissions) await db.query(`INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)`, [id, perm]);
}

// Checks the HS256 signature with the test secret and returns the payload (null when it does not verify)
function verifyJwt(token) {
    const [h, p, s] = String(token || '').split('.');
    if (!h || !p || !s) return null;
    const expected = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
    if (expected !== s) return null;
    return JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
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
    await db.query(`DELETE FROM public_meetings WHERE title LIKE ?`, [`${P}%`]).catch(() => {});
    await db.query(`DELETE FROM lms_records WHERE id LIKE ?`, [like]);
    await db.query(`DELETE FROM user_credentials WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM auth_sessions WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM super_admins WHERE user_id LIKE ?`, [like]);
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
        await putSettingRow('meeting', JSON.stringify({ domain: 'meet.example.test', embed: false, authMode: 'JWT', appId: 'pmtest_app', jaasKeyId: '' }));
        await putSettingRow('meetingSecrets', JSON.stringify({ appSecret: SECRET }));

        await createRole(roleIds.opener, 'Pmtest opener', ['virtual_classes.view', 'virtual_classes.public_meeting']);
        await createRole(roleIds.plainAdmin, 'Pmtest admin', require('./server/permissions').DEFAULT_PERMISSIONS.ACADEMIC_ADMIN);
        await createUser(ids.superAdmin, { role: 'SUPER_ADMIN' });
        await createUser(ids.opener, { role: roleIds.opener });
        await createUser(ids.plainAdmin, { role: roleIds.plainAdmin });
        await createUser(ids.teacher, { role: 'TEACHER' });
        await createUser(ids.student, { role: 'STUDENT', classId: ids.classA });
        await insertRecord('classes', { id: ids.classA, name: 'Pmtest A', teacherId: ids.teacher, courseTeachers: [] });
        await insertRecord('virtualClasses', { id: ids.vcA, title: 'Pmtest live', classId: ids.classA, hostId: ids.teacher, status: 'UPCOMING' });
        await require('./server/roles').load();

        const sess = {};
        for (const key of ['superAdmin', 'opener', 'plainAdmin', 'teacher', 'student']) sess[key] = await login(ids[key]);
        check('Test accounts can sign in', Object.values(sess).every(Boolean));

        // --- Who may start one ---------------------------------------------------------------------
        check('Signed-out visitors cannot list public meetings', (await request('GET', '/api/public-meetings')).status === 401);
        check('Signed-out visitors cannot start one', (await request('POST', '/api/public-meetings', { body: { title: `${P}x` } })).status === 401);
        check('A teacher cannot start one', (await request('POST', '/api/public-meetings', { cookie: sess.teacher, body: { title: `${P}x` } })).status === 403);
        check('A student cannot start one', (await request('POST', '/api/public-meetings', { cookie: sess.student, body: { title: `${P}x` } })).status === 403);
        check('An Admin without the permission cannot start one', (await request('POST', '/api/public-meetings', { cookie: sess.plainAdmin, body: { title: `${P}x` } })).status === 403);
        check('A title is required', (await request('POST', '/api/public-meetings', { cookie: sess.opener, body: { title: '  ' } })).status === 400);

        const created = await request('POST', '/api/public-meetings', { cookie: sess.opener, body: { title: `${P}Parents meeting`, hours: 3 } });
        check('A holder of the permission starts one', created.status === 201 && created.body.success, JSON.stringify(created.body));
        const meeting = created.body.meeting;
        const code = (/\/meet\/([A-Za-z0-9_-]+)$/.exec(meeting.link) || [])[1];
        check('It gets a /meet/<code> link with an unguessable code', !!code && code.length >= 24);
        check('It runs for the chosen time', Math.abs(Date.parse(meeting.expiresAt) - Date.parse(meeting.createdAt) - 3 * 3600 * 1000) < 2000);
        const room = created.body.join.roomPath;
        check('It has its own room, apart from class rooms', /^JamiaPublic[0-9a-f]{24}$/.test(room));
        const hostToken = verifyJwt(created.body.join.token);
        check('The starter gets a moderator token for that room', hostToken && hostToken.moderator === true && hostToken.room === room.toLowerCase());
        check('Super Admin can start one too', (await request('POST', '/api/public-meetings', { cookie: sess.superAdmin, body: { title: `${P}Bayan`, hours: 1 } })).status === 201);
        const [vc] = await db.query(`SELECT COUNT(*) AS n FROM lms_records WHERE collection = 'virtualClasses' AND data LIKE ?`, [`%${P}Parents%`]);
        check('No online class record is created', Number(vc[0].n) === 0);

        // --- The public link -----------------------------------------------------------------------
        const page = await request('GET', `/meet/${code}`);
        check('The link opens the join page without signing in', page.status === 200 && String(page.body).includes('Join Meeting'));
        const look = await request('POST', '/api/public-meetings/lookup', { body: { code } });
        check('The join page sees the title and that it is open', look.status === 200 && look.body.meeting.active === true && look.body.meeting.title === `${P}Parents meeting`);
        check('The lookup does not reveal the room or a token', !JSON.stringify(look.body).includes(room) && !('token' in look.body.meeting));
        check('A wrong code is refused', (await request('POST', '/api/public-meetings/lookup', { body: { code: 'A'.repeat(24) } })).status === 404);
        check('A malformed code is refused', (await request('POST', '/api/public-meetings/lookup', { body: { code: "x' OR 1=1 --" } })).status === 404);
        check('A guest must give a name', (await request('POST', '/api/public-meetings/join', { body: { code, name: ' ' } })).status === 400);

        const joined = await request('POST', '/api/public-meetings/join', { body: { code, name: 'Abdullah <b>' } });
        const guestToken = verifyJwt(joined.body.join && joined.body.join.token);
        check('A guest gets a token without signing in', joined.status === 200 && !!guestToken, JSON.stringify(joined.body));
        check('The guest token is for this room only', guestToken && guestToken.room === room.toLowerCase());
        check('The guest is not a moderator', guestToken && guestToken.moderator === false && guestToken.context.user.moderator === false);
        check('The guest is named as a guest, without markup', guestToken && guestToken.context.user.name === 'Abdullah b (Guest)');
        check('The guest token ends when the meeting ends', guestToken && guestToken.exp * 1000 <= Date.parse(meeting.expiresAt) + 2000);

        const listed = await request('GET', '/api/public-meetings', { cookie: sess.superAdmin });
        check('Holders of the permission see it listed', listed.status === 200 && listed.body.meetings.some(m => m.id === meeting.id && m.status === 'ACTIVE'));
        const rejoin = await request('POST', `/api/public-meetings/${meeting.id}/host`, { cookie: sess.superAdmin });
        check('Another holder can join as host', rejoin.status === 200 && verifyJwt(rejoin.body.join.token).moderator === true);
        check('A teacher cannot join as host', (await request('POST', `/api/public-meetings/${meeting.id}/host`, { cookie: sess.teacher })).status === 403);

        // --- The host's tab: its way in, and asking whether the meeting is still open ------------------
        check('The host tab page opens', (await request('GET', `/live.html?publicMeeting=${meeting.id}`)).status === 200);
        const status = await request('GET', `/api/public-meetings/${meeting.id}`, { cookie: sess.opener });
        check('The host tab can ask whether it is still open', status.status === 200 && status.body.meeting.status === 'ACTIVE', JSON.stringify(status.body));
        check('A teacher cannot ask', (await request('GET', `/api/public-meetings/${meeting.id}`, { cookie: sess.teacher })).status === 403);
        check('Signed-out visitors cannot ask', (await request('GET', `/api/public-meetings/${meeting.id}`)).status === 401);
        check('An unknown meeting is not found', (await request('GET', '/api/public-meetings/pmeet_nosuch', { cookie: sess.opener })).status === 404);

        // --- The host's tab closing with nobody else inside --------------------------------------------
        const emptyMeeting = (await request('POST', '/api/public-meetings', { cookie: sess.opener, body: { title: `${P}Empty room`, hours: 1 } })).body.meeting;
        const emptyCode = (/\/meet\/([A-Za-z0-9_-]+)$/.exec(emptyMeeting.link) || [])[1];
        const statusOf = async id => (await request('GET', `/api/public-meetings/${id}`, { cookie: sess.opener })).body.meeting.status;
        const pause = ms => new Promise(r => setTimeout(r, ms));
        check('A teacher cannot report the tab closing', (await request('POST', `/api/public-meetings/${emptyMeeting.id}/left`, { cookie: sess.teacher })).status === 403);
        check('Signed-out visitors cannot report it', (await request('POST', `/api/public-meetings/${emptyMeeting.id}/left`)).status === 401);
        check('The tab closing is accepted', (await request('POST', `/api/public-meetings/${emptyMeeting.id}/left`, { cookie: sess.opener })).status === 202);
        check('The meeting does not end at once (it could be a reload)', await statusOf(emptyMeeting.id) === 'ACTIVE');
        await request('POST', `/api/public-meetings/${emptyMeeting.id}/host`, { cookie: sess.opener });
        await pause(EMPTY_GRACE_MS + 300);
        check('The host coming back keeps it open', await statusOf(emptyMeeting.id) === 'ACTIVE');
        await request('POST', `/api/public-meetings/${emptyMeeting.id}/left`, { cookie: sess.opener });
        await request('POST', '/api/public-meetings/join', { body: { code: emptyCode, name: 'Early guest' } });
        await pause(EMPTY_GRACE_MS + 300);
        check('A guest coming in keeps it open', await statusOf(emptyMeeting.id) === 'ACTIVE');
        await request('POST', `/api/public-meetings/${emptyMeeting.id}/left`, { cookie: sess.opener });
        await pause(EMPTY_GRACE_MS + 300);
        check('Otherwise it ends by itself', await statusOf(emptyMeeting.id) === 'ENDED');
        check('The link then stops working', (await request('POST', '/api/public-meetings/join', { body: { code: emptyCode, name: 'Late guest' } })).status === 410);
        const auditRows = (await db.query(`SELECT actor_id FROM audit_log WHERE action = 'public_meeting.end' AND entity_id = ?`, [emptyMeeting.id]))[0];
        check('Ending it by itself is logged against the host', auditRows.length === 1 && auditRows[0].actor_id === ids.opener, JSON.stringify(auditRows));
        const endedList = await request('GET', '/api/public-meetings', { cookie: sess.opener });
        const endedRow = endedList.body.meetings.find(m => m.id === emptyMeeting.id);
        check('The lobby list shows it ended, with the time', endedRow && endedRow.status === 'ENDED' && !!endedRow.endedAt, JSON.stringify(endedRow));

        // --- Ending it -----------------------------------------------------------------------------
        check('A teacher cannot end it', (await request('POST', `/api/public-meetings/${meeting.id}/end`, { cookie: sess.teacher })).status === 403);
        const ended = await request('POST', `/api/public-meetings/${meeting.id}/end`, { cookie: sess.opener });
        check('The starter ends it', ended.status === 200 && ended.body.meeting.status === 'ENDED');
        const after = await request('POST', '/api/public-meetings/lookup', { body: { code } });
        check('The join page then says it has ended', after.status === 200 && after.body.meeting.active === false);
        check('Guests can no longer get a token', (await request('POST', '/api/public-meetings/join', { body: { code, name: 'Late guest' } })).status === 410);
        check('Nobody can rejoin as host', (await request('POST', `/api/public-meetings/${meeting.id}/host`, { cookie: sess.opener })).status === 410);

        await db.query(`UPDATE public_meetings SET expires_at = NOW(3) - INTERVAL 1 MINUTE WHERE title = ?`, [`${P}Bayan`]);
        const [[expired]] = await db.query(`SELECT code FROM public_meetings WHERE title = ?`, [`${P}Bayan`]);
        check('An expired link no longer admits guests', (await request('POST', '/api/public-meetings/join', { body: { code: expired.code, name: 'Guest' } })).status === 410);

        // --- Classes are unchanged -----------------------------------------------------------------
        const classToken = await request('POST', '/api/virtual-class/join-token', { cookie: sess.teacher, body: { sessionId: ids.vcA } });
        const ct = verifyJwt(classToken.body.token);
        const expectedRoom = `JamiaAshrafia${ids.vcA.replace(/[^a-zA-Z0-9]/g, '')}${ids.vcA.replace(/[^a-zA-Z0-9]/g, '').slice(-6)}`.toLowerCase();
        check('A class host still gets the class room token', classToken.status === 200 && ct && ct.room === expectedRoom && ct.moderator === true, JSON.stringify(classToken.body));
        check('A student still cannot enter a class before it starts', (await request('POST', '/api/virtual-class/join-token', { cookie: sess.student, body: { sessionId: ids.vcA } })).status === 403);
        check('Class join tokens still need sign-in', (await request('POST', '/api/virtual-class/join-token', { body: { sessionId: ids.vcA } })).status === 401);
    } catch (err) {
        failed++;
        console.error('[ERROR]', err);
    } finally {
        await cleanup(backup);
    }

    console.log(`\n${passed} passed, ${failed} failed. Test data removed.`);
    process.exit(failed ? 1 : 0);
}

run();
