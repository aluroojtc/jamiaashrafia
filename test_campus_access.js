/**
 * Jamia Ashrafia LMS - Campus (location) access tests
 *
 * Sets up three throw-away campuses (A, B, C) with classes, courses, timetable periods, attendance, online classes
 * and admission applications at each, and accounts for: the Super Admin, an Admin of every campus, an Admin of
 * campus A only, a Teacher of campuses A and B, a Teacher of campus C and students at A and C. Every rule is checked
 * through the real HTTP API with real sessions (what a browser or a hand-made request would get), then everything
 * created is removed (ids start with "camptest_").
 *
 *   npm run test:campus
 */

const http = require('http');
const db = require('./database/db');
const auth = require('./server/auth');
const catalog = require('./server/permissions');

const TEST_PORT = 3057;
process.env.PORT = TEST_PORT;

const P = `camptest_${Date.now().toString(36)}_`;
const R = P.toUpperCase();
const ADMIN_ROLE = `${R}ADMIN`;
const B = { A: `${P}bA`, B: `${P}bB`, C: `${P}bC` };
const ids = {
    super: `${P}super`, adminAll: `${P}adminall`, adminA: `${P}admina`, teacherAB: `${P}tab`, teacherC: `${P}tc`,
    studentA: `${P}sa`, studentC: `${P}sc`,
    clsA: `${P}clsA`, clsB: `${P}clsB`, clsC: `${P}clsC`,
    courseA: `${P}crsA`, courseC: `${P}crsC`, courseAll: `${P}crsAll`,
    ttA: `${P}ttA`, ttC: `${P}ttC`, attA: `${P}attA`, attC: `${P}attC`, vcA: `${P}vcA`, vcC: `${P}vcC`,
    admA: `${P}admA`, admC: `${P}admC`
};
const passwords = {};

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
        `INSERT INTO lms_records (collection, id, data, deleted, updated_by, updated_at) VALUES (?, ?, ?, 0, 'camptest', NOW(3))
         ON DUPLICATE KEY UPDATE data = VALUES(data), deleted = 0`,
        [collection, rec.id, JSON.stringify(rec)]
    );
}

async function stored(collection, id) {
    const [rows] = await db.query(`SELECT data, deleted FROM lms_records WHERE collection = ? AND id = ?`, [collection, id]);
    return rows.length ? { ...JSON.parse(rows[0].data), _deleted: !!rows[0].deleted } : null;
}

async function createUser(id, fields) {
    await insertRecord('users', { id, status: 'ACTIVE', name: `Camp ${id.slice(-6)}`, email: `${id}@test.local`, ...fields });
    if (fields.role === 'SUPER_ADMIN') await db.query(`INSERT IGNORE INTO super_admins (user_id, granted_by) VALUES (?, 'camptest')`, [id]);
    passwords[id] = auth.temporaryPassword(12);
    await auth.setPassword(null, id, passwords[id], false);
}

async function setupFixtures() {
    for (const [key, id] of Object.entries(B)) {
        await db.query(`INSERT INTO branches (id, code, name, address, city) VALUES (?, ?, ?, 'Test address', 'Lahore')`, [id, `${R}${key}`, `Camptest campus ${key}`]);
    }
    await db.query(`INSERT INTO roles (id, name, scope, is_system, status, version, updated_by) VALUES (?, 'Camptest Admin', 'ALL', 0, 'ACTIVE', 1, 'camptest')`, [ADMIN_ROLE]);
    for (const perm of catalog.DEFAULT_PERMISSIONS.ACADEMIC_ADMIN) await db.query(`INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)`, [ADMIN_ROLE, perm]);

    await createUser(ids.super, { role: 'SUPER_ADMIN' });
    await createUser(ids.adminAll, { role: ADMIN_ROLE, branchId: B.A, allCampuses: true, campusIds: [] });
    await createUser(ids.adminA, { role: ADMIN_ROLE, branchId: B.A, allCampuses: false, campusIds: [B.A] });
    await createUser(ids.teacherAB, { role: 'TEACHER', branchId: B.A, allCampuses: false, campusIds: [B.A, B.B] });
    await createUser(ids.teacherC, { role: 'TEACHER', branchId: B.C, allCampuses: false, campusIds: [B.C] });
    await createUser(ids.studentA, { role: 'STUDENT', classId: ids.clsA, branchId: B.A, rollNo: `${P}RA` });
    await createUser(ids.studentC, { role: 'STUDENT', classId: ids.clsC, branchId: B.C, rollNo: `${P}RC` });

    await insertRecord('classes', { id: ids.clsA, name: 'Camptest A', branchId: B.A, teacherId: ids.teacherAB, courseTeachers: [] });
    await insertRecord('classes', { id: ids.clsB, name: 'Camptest B', branchId: B.B, teacherId: ids.teacherAB, courseTeachers: [] });
    await insertRecord('classes', { id: ids.clsC, name: 'Camptest C', branchId: B.C, teacherId: ids.teacherC, courseTeachers: [] });
    await insertRecord('courses', { id: ids.courseA, title: 'Camptest kitab A', code: `${R}KA`, campusIds: [B.A] });
    await insertRecord('courses', { id: ids.courseC, title: 'Camptest kitab C', code: `${R}KC`, campusIds: [B.C] });
    await insertRecord('courses', { id: ids.courseAll, title: 'Camptest kitab all', code: `${R}KALL`, campusIds: [] });
    await insertRecord('timetables', { id: ids.ttA, classId: ids.clsA, day: 'MONDAY', startTime: '08:00', endTime: '09:00', teacherId: ids.teacherAB });
    await insertRecord('timetables', { id: ids.ttC, classId: ids.clsC, day: 'MONDAY', startTime: '08:00', endTime: '09:00', teacherId: ids.teacherC });
    const today = new Date().toISOString().slice(0, 10);
    await insertRecord('attendance', { id: ids.attA, userId: ids.studentA, role: 'STUDENT', classId: ids.clsA, date: today, status: 'PRESENT' });
    await insertRecord('attendance', { id: ids.attC, userId: ids.studentC, role: 'STUDENT', classId: ids.clsC, date: today, status: 'PRESENT' });
    await insertRecord('virtualClasses', { id: ids.vcA, title: 'Camptest live A', classId: ids.clsA, hostId: ids.teacherAB, status: 'LIVE' });
    await insertRecord('virtualClasses', { id: ids.vcC, title: 'Camptest live C', classId: ids.clsC, hostId: ids.teacherC, status: 'LIVE' });
    for (const [id, branch] of [[ids.admA, B.A], [ids.admC, B.C]]) {
        await db.query(
            `INSERT INTO student_admissions (id, application_no, candidate_name, father_name, phone, branch_id, status) VALUES (?, ?, ?, 'Camptest Father', '+92 300 0000000', ?, 'UNDER_REVIEW')`,
            [id, `${id}_APP`, `Camptest Applicant ${id}`, branch]);
    }
    await require('./server/roles').load();
}

async function cleanup() {
    const like = `${P}%`;
    await db.query(`DELETE FROM lms_records WHERE id LIKE ?`, [like]);
    await db.query(`DELETE FROM user_credentials WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM auth_sessions WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM notifications WHERE sender_id LIKE ?`, [like]);
    await db.query(`DELETE FROM student_admissions WHERE id LIKE ?`, [like]);
    await db.query(`DELETE FROM super_admins WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM user_roles WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM role_permissions WHERE role_id LIKE ?`, [`${R}%`]);
    await db.query(`DELETE FROM roles WHERE id LIKE ?`, [`${R}%`]);
    await db.query(`DELETE FROM branches WHERE id LIKE ?`, [like]);
    await db.query(`DELETE FROM audit_log WHERE entity_id LIKE ? OR actor_id LIKE ? OR summary LIKE ?`, [like, like, `%${P}%`]);
}

async function run() {
    if (!(await db.testConnection())) process.exit(1);
    require('./server');
    await new Promise(r => setTimeout(r, 1200));
    // Start-up migration has run before the fixtures exist (fixtures carry their own campuses)
    await require('./server/lms-api').ensureSchema();

    let passed = 0;
    let failed = 0;
    const check = (name, ok, detail = '') => {
        if (ok) { passed++; console.log(`[PASS] ${name}`); } else { failed++; console.error(`[FAIL] ${name} ${detail}`); }
    };

    try {
        await setupFixtures();
        const sess = {};
        for (const key of ['super', 'adminAll', 'adminA', 'teacherAB', 'teacherC', 'studentA', 'studentC']) sess[key] = await login(ids[key]);
        check('All test accounts signed in', Object.values(sess).every(Boolean));

        const call = (key, method, path, body) => request(method, path, { cookie: sess[key], body });
        const pull = async key => (await call(key, 'GET', '/api/store')).body.collections || {};
        const has = (list, id) => (list || []).some(r => r.id === id);
        const sync = (key, upserts, deletes) => call(key, 'POST', '/api/store/sync', { upserts: upserts || {}, deletes: deletes || {} });
        const accepted = (r, coll, id) => r.status === 200 && (r.body.accepted[coll] || []).includes(id);
        const rejected = (r, coll, id) => r.status === 200 && (r.body.rejected[coll] || []).includes(id);

        // --- Who has which campuses ------------------------------------------------------
        const meA = (await call('adminA', 'GET', '/api/auth/me')).body;
        check('Single-campus Admin: /api/auth/me lists only campus A', meA.campuses && !meA.campuses.all && meA.campuses.ids.join() === B.A, JSON.stringify(meA.campuses));
        check('All-campus Admin: /api/auth/me says all campuses', (await call('adminAll', 'GET', '/api/auth/me')).body.campuses.all === true);
        check('Super Admin: /api/auth/me says all campuses', (await call('super', 'GET', '/api/auth/me')).body.campuses.all === true);
        const meS = (await call('studentA', 'GET', '/api/auth/me')).body;
        check('Student has exactly one campus', meS.campuses.ids.length === 1 && meS.campuses.ids[0] === B.A);

        // --- Reads -------------------------------------------------------------------------
        const sup = await pull('super');
        check('Super Admin receives classes of every campus', [ids.clsA, ids.clsB, ids.clsC].every(id => has(sup.classes, id)));
        const all = await pull('adminAll');
        check('All-campus Admin receives classes, courses, timetable, attendance and online classes of every campus',
            has(all.classes, ids.clsC) && has(all.courses, ids.courseC) && has(all.timetables, ids.ttC) && has(all.attendance, ids.attC) && has(all.virtualClasses, ids.vcC));

        const a = await pull('adminA');
        check('Single-campus Admin receives own campus class', has(a.classes, ids.clsA));
        check('Single-campus Admin does not receive classes of other campuses', !has(a.classes, ids.clsB) && !has(a.classes, ids.clsC));
        check('Single-campus Admin receives own-campus and all-campus courses only', has(a.courses, ids.courseA) && has(a.courses, ids.courseAll) && !has(a.courses, ids.courseC));
        check('Single-campus Admin receives own-campus timetable only', has(a.timetables, ids.ttA) && !has(a.timetables, ids.ttC));
        check('Single-campus Admin receives own-campus attendance only', has(a.attendance, ids.attA) && !has(a.attendance, ids.attC));
        check('Single-campus Admin receives own-campus online classes only', has(a.virtualClasses, ids.vcA) && !has(a.virtualClasses, ids.vcC));
        check('Single-campus Admin receives own-campus students only', has(a.users, ids.studentA) && !has(a.users, ids.studentC));
        check('Single-campus Admin does not receive a teacher of another campus', !has(a.users, ids.teacherC));
        check('Single-campus Admin sees a teacher who also works at their campus', has(a.users, ids.teacherAB));

        const t = await pull('teacherAB');
        check('Multi-campus Teacher receives classes of both campuses', has(t.classes, ids.clsA) && has(t.classes, ids.clsB));
        check('Multi-campus Teacher does not receive another campus\'s class, timetable or online class',
            !has(t.classes, ids.clsC) && !has(t.timetables, ids.ttC) && !has(t.virtualClasses, ids.vcC));
        check('Multi-campus Teacher does not receive students of another campus', !has(t.users, ids.studentC));

        const s = await pull('studentA');
        check('Student receives own campus class and courses', has(s.classes, ids.clsA) && has(s.courses, ids.courseA) && has(s.courses, ids.courseAll));
        check('Student does not receive another campus\'s classes, courses or timetable', !has(s.classes, ids.clsC) && !has(s.courses, ids.courseC) && !has(s.timetables, ids.ttC));

        // --- Writes by the single-campus Admin ---------------------------------------------
        const newC = `${P}newC`;
        check('Single-campus Admin cannot create a class at another campus', rejected(await sync('adminA', { classes: [{ id: newC, name: 'X', branchId: B.C }] }), 'classes', newC));
        const newA = `${P}newA`;
        check('Single-campus Admin can create a class at own campus', accepted(await sync('adminA', { classes: [{ id: newA, name: 'Own', branchId: B.A, courseTeachers: [] }] }), 'classes', newA));
        const editC = await sync('adminA', { classes: [{ ...(await stored('classes', ids.clsC)), name: 'Hijacked' }] });
        check('Single-campus Admin cannot change another campus\'s class (direct API call)', rejected(editC, 'classes', ids.clsC) && (await stored('classes', ids.clsC)).name === 'Camptest C');
        const moveOut = await sync('adminA', { classes: [{ ...(await stored('classes', ids.clsA)), branchId: B.C }] });
        check('Single-campus Admin cannot move a class to another campus', rejected(moveOut, 'classes', ids.clsA));
        check('Single-campus Admin cannot delete another campus\'s class', rejected(await sync('adminA', {}, { classes: [ids.clsC] }), 'classes', ids.clsC));
        const ttNew = `${P}ttNew`;
        check('Single-campus Admin cannot add a period to another campus\'s timetable',
            rejected(await sync('adminA', { timetables: [{ id: ttNew, classId: ids.clsC, day: 'TUESDAY', startTime: '10:00', endTime: '11:00' }] }), 'timetables', ttNew));
        const attNew = `${P}attNew`;
        check('Single-campus Admin cannot mark attendance at another campus',
            rejected(await sync('adminA', { attendance: [{ id: attNew, userId: ids.studentC, role: 'STUDENT', classId: ids.clsC, date: new Date().toISOString().slice(0, 10), status: 'ABSENT' }] }), 'attendance', attNew));
        check('Single-campus Admin cannot delete another campus\'s online class', rejected(await sync('adminA', {}, { virtualClasses: [ids.vcC] }), 'virtualClasses', ids.vcC));
        check('Single-campus Admin cannot change a course of every campus', rejected(await sync('adminA', { courses: [{ ...(await stored('courses', ids.courseAll)), title: 'X' }] }), 'courses', ids.courseAll));
        const crsNew = `${P}crsNew`;
        check('Single-campus Admin can add a course for own campus', accepted(await sync('adminA', { courses: [{ id: crsNew, title: 'Own kitab', code: `${R}KN`, campusIds: [B.A] }] }), 'courses', crsNew));
        const brk = `${P}break`;
        await sync('adminA', { timetables: [{ id: brk, classId: 'all', day: 'MONDAY', startTime: '12:00', endTime: '12:30', isBreak: true }] });
        check('A whole-day period made by a single-campus Admin belongs to their campus', ((await stored('timetables', brk)) || {}).branchId === B.A);

        // Students and accounts
        const moveStudent = await sync('adminA', { users: [{ ...(await stored('users', ids.studentA)), classId: ids.clsC }] });
        check('Single-campus Admin cannot move a student into another campus\'s class', rejected(moveStudent, 'users', ids.studentA) && (await stored('users', ids.studentA)).classId === ids.clsA);
        check('Single-campus Admin cannot edit a student of another campus', rejected(await sync('adminA', { users: [{ ...(await stored('users', ids.studentC)), name: 'X' }] }), 'users', ids.studentC));
        check('Single-campus Admin cannot edit a teacher who also works at another campus',
            rejected(await sync('adminA', { users: [{ ...(await stored('users', ids.teacherAB)), designation: 'X' }] }), 'users', ids.teacherAB));
        const tNew = `${P}tnew`;
        check('Single-campus Admin cannot give a new teacher another campus',
            rejected(await sync('adminA', { users: [{ id: tNew, role: 'TEACHER', name: 'T', email: `${tNew}@test.local`, branchId: B.A, campusIds: [B.A, B.C] }] }), 'users', tNew));
        check('Single-campus Admin cannot give "all campuses"',
            rejected(await sync('adminA', { users: [{ id: tNew, role: 'TEACHER', name: 'T', email: `${tNew}@test.local`, branchId: B.A, allCampuses: true }] }), 'users', tNew));
        check('Single-campus Admin can register a teacher for own campus',
            accepted(await sync('adminA', { users: [{ id: tNew, role: 'TEACHER', name: 'T', email: `${tNew}@test.local`, branchId: B.A, campusIds: [B.A] }] }), 'users', tNew));
        const self = await sync('adminA', { users: [{ ...(await stored('users', ids.adminA)), allCampuses: true, campusIds: [B.A, B.C] }] });
        const selfAfter = await stored('users', ids.adminA);
        check('Nobody widens their own campuses', accepted(self, 'users', ids.adminA) && selfAfter.allCampuses === false && selfAfter.campusIds.join() === B.A);

        // --- All-campus Admin and the Super Admin -----------------------------------------
        check('All-campus Admin can change a class at any campus', accepted(await sync('adminAll', { classes: [{ ...(await stored('classes', ids.clsC)), room: 'Hall 2' }] }), 'classes', ids.clsC));
        const sc = await sync('adminAll', { users: [{ ...(await stored('users', ids.studentA)), branchId: B.C }] });
        check('A student\'s campus always follows their class', accepted(sc, 'users', ids.studentA) && (await stored('users', ids.studentA)).branchId === B.A);
        const wrongTeacher = await sync('super', { classes: [{ ...(await stored('classes', ids.clsA)), teacherId: ids.teacherC }] });
        check('Nobody (not even the Super Admin) places a teacher on a class at a campus they do not work at', rejected(wrongTeacher, 'classes', ids.clsA));

        // --- Admissions -------------------------------------------------------------------
        const admList = (await call('adminA', 'GET', '/api/admissions')).body.admissions || [];
        check('Single-campus Admin lists only own-campus admission applications', admList.some(x => x.id === ids.admA) && !admList.some(x => x.id === ids.admC));
        check('Single-campus Admin cannot open another campus\'s application', (await call('adminA', 'GET', `/api/admissions/${ids.admC}`)).status === 404);
        check('Single-campus Admin cannot change another campus\'s application', (await call('adminA', 'PUT', `/api/admissions/${ids.admC}`, { name: 'X' })).status === 404);
        check('Single-campus Admin cannot move an application to another campus', (await call('adminA', 'PUT', `/api/admissions/${ids.admA}`, { branchId: B.C })).status === 403);
        const allList = (await call('adminAll', 'GET', '/api/admissions')).body.admissions || [];
        check('All-campus Admin lists applications of every campus', allList.some(x => x.id === ids.admA) && allList.some(x => x.id === ids.admC));

        // --- Online classes (Virtual Dars) ------------------------------------------------
        const verify = (key, id) => call(key, 'POST', '/api/virtual-class/verify-access', { sessionId: id });
        check('Single-campus Admin cannot enter another campus\'s online class', (await verify('adminA', ids.vcC)).status === 403);
        check('Single-campus Admin moderates an own-campus online class', (await verify('adminA', ids.vcA)).body.isHost === true);
        check('Multi-campus Teacher hosts own class', (await verify('teacherAB', ids.vcA)).body.isHost === true);
        check('Multi-campus Teacher cannot enter another campus\'s online class', (await verify('teacherAB', ids.vcC)).status === 403);
        check('Student cannot enter another campus\'s online class', (await verify('studentA', ids.vcC)).status === 403);
        check('Student cannot get a meeting token for another campus\'s class', (await call('studentA', 'POST', '/api/virtual-class/join-token', { sessionId: ids.vcC })).status === 403);

        // --- Notifications ----------------------------------------------------------------
        const note = await call('adminA', 'POST', '/api/notifications', { title: 'Camptest', message: `Camptest ${P}`, targetClassId: ids.clsC });
        check('Single-campus Admin cannot notify another campus\'s class', note.status === 403);

        // --- A record moved out of reach leaves the browser's copy ------------------------
        const first = await call('adminA', 'GET', '/api/store');
        await sync('super', { classes: [{ ...(await stored('classes', newA)), branchId: B.C }] });
        const later = (await call('adminA', 'GET', `/api/store?since=${encodeURIComponent(first.body.serverTime)}`)).body;
        check('Incremental pull tells the single-campus Admin a class left their campus', ((later.deleted || {}).classes || []).includes(newA) && !has((later.collections || {}).classes, newA));

        // --- Migration --------------------------------------------------------------------
        const campus = require('./server/campus');
        const legacyClass = `${P}legacyCls`;
        const legacyTeacher = `${P}legacyT`;
        const legacyStaff = `${P}legacyStaff`;
        await insertRecord('classes', { id: legacyClass, name: 'Legacy', teacherId: legacyTeacher, courseTeachers: [] });
        await insertRecord('classes', { id: `${P}legacyClsB`, name: 'Legacy B', branchId: B.B, courseTeachers: [{ courseId: 'x', teacherId: legacyTeacher }] });
        await insertRecord('users', { id: legacyTeacher, role: 'TEACHER', name: 'Legacy teacher' });
        await insertRecord('users', { id: legacyStaff, role: ADMIN_ROLE, name: 'Legacy admin' });
        await campus.migrate();
        const fallback = await campus.defaultCampusId(true);
        const lt = await stored('users', legacyTeacher);
        check('Migration gives an old class the default campus', (await stored('classes', legacyClass)).branchId === fallback);
        check('Migration keeps an old teacher at every campus they teach', lt.allCampuses === false && lt.campusIds.includes(fallback) && lt.campusIds.includes(B.B));
        check('Migration keeps old staff at every campus (as before)', (await stored('users', legacyStaff)).allCampuses === true);
        const again = await campus.migrate();
        check('Migration is idempotent (nothing changes on a second run)', Object.values(again).every(n => n === 0), JSON.stringify(again));
    } catch (err) {
        failed++;
        console.error('[FAIL] Test run stopped:', err);
    } finally {
        await cleanup();
    }
    console.log(`\n${passed} passed, ${failed} failed. Test data removed.`);
    process.exit(failed ? 1 : 0);
}

run();
