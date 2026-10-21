/**
 * Jamia Ashrafia LMS - Authentication & Authorization Regression Tests (Phase 1)
 *
 * Creates throw-away accounts and records (ids starting with "sectest_"), checks every Phase 1 rule
 * through the real HTTP API with real sessions, then removes everything it created.
 *
 * The tests never depend on the role rows of the live database, which administrators may change at any
 * time. They create their own roles: an Admin with the approved Admin permissions (the code default in
 * server/permissions.js), a finance role, a librarian role and a role manager. A drift report at the end
 * says how the live roles differ from the approved defaults; it is information, not a failure.
 *
 *   npm run test:security
 */

const http = require('http');
const db = require('./database/db');
const auth = require('./server/auth');
const catalog = require('./server/permissions');

const TEST_PORT = 3056;
process.env.PORT = TEST_PORT;

const P = `sectest_${Date.now().toString(36)}_`;
const R = P.toUpperCase();
// Throw-away roles (removed afterwards)
const roleIds = { admin: `${R}ADMIN`, finance: `${R}FINANCE`, librarian: `${R}LIBRARIAN`, roleMgr: `${R}ROLEMGR`, typeMgr: `${R}TYPEMGR` };
const ids = {
    admin: `${P}admin`, superAdmin: `${P}super`, t1: `${P}t1`, t2: `${P}t2`, s1: `${P}s1`, s2: `${P}s2`,
    acct: `${P}acct`, custom: `${P}custom`, noCred: `${P}nocred`,
    classA: `${P}clsA`, classB: `${P}clsB`, examB: `${P}examB`, resultB: `${P}resB`, attS1: `${P}attS1`,
    donation: `${P}don`, vcB: `${P}vcB`,
    coord: `${P}coord`, classC: `${P}clsC`, examC: `${P}examC`, resultC: `${P}resC`,
    assignA: `${P}asgA`, subA: `${P}subA`, examAClosed: `${P}examAx`, examAOpen: `${P}examAo`, admission: `${P}adm`,
    mgr: `${P}mgr`, clerk: `${P}clerk`, deputy: `${P}deputy`, loanS2: `${P}loanS2`, roleMgr: `${P}rolemgr`, typeMgr: `${P}typemgr`
};
const passwords = {};

function request(method, path, { cookie, body, headers } = {}) {
    return new Promise((resolve, reject) => {
        const data = body === undefined ? null : JSON.stringify(body);
        const req = http.request({
            hostname: '127.0.0.1', port: TEST_PORT, path, method,
            headers: {
                ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
                ...(cookie ? { Cookie: cookie } : {}),
                ...(headers || {})
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

async function login(identifier, password) {
    const r = await request('POST', '/api/auth/login', { body: { identifier, password } });
    const set = [].concat(r.headers['set-cookie'] || []).find(c => c.startsWith(`${auth.COOKIE_NAME}=`));
    return { ...r, cookie: set ? set.split(';')[0] : null, setCookie: set || '' };
}

async function insertRecord(collection, rec) {
    await db.query(
        `INSERT INTO lms_records (collection, id, data, deleted, updated_by, updated_at) VALUES (?, ?, ?, 0, 'sectest', NOW(3))
         ON DUPLICATE KEY UPDATE data = VALUES(data), deleted = 0`,
        [collection, rec.id, JSON.stringify(rec)]
    );
}

async function stored(collection, id) {
    const [rows] = await db.query(`SELECT data, deleted FROM lms_records WHERE collection = ? AND id = ?`, [collection, id]);
    return rows.length ? { ...JSON.parse(rows[0].data), _deleted: !!rows[0].deleted } : null;
}

async function createUser(id, fields, withPassword = true) {
    await insertRecord('users', { id, status: 'ACTIVE', name: `Test ${id.slice(-6)}`, email: `${id}@test.local`, ...fields });
    // Super Admin authority needs the protected super_admins row as well as the role
    if (fields.role === 'SUPER_ADMIN') await db.query(`INSERT IGNORE INTO super_admins (user_id, granted_by) VALUES (?, 'sectest')`, [id]);
    if (withPassword) {
        passwords[id] = auth.temporaryPassword(12);
        await auth.setPassword(null, id, passwords[id], false);
    }
}

async function createRole(id, name, scope, permissions) {
    await db.query(`INSERT INTO roles (id, name, scope, is_system, status, version, updated_by) VALUES (?, ?, ?, 0, 'ACTIVE', 1, 'sectest')`, [id, name, scope]);
    for (const perm of permissions) await db.query(`INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)`, [id, perm]);
}

async function setupFixtures() {
    await createRole(roleIds.admin, 'Sectest Admin', 'ALL', catalog.DEFAULT_PERMISSIONS.ACADEMIC_ADMIN);
    await createRole(roleIds.finance, 'Sectest finance officer', 'ALL', catalog.DEFAULT_PERMISSIONS.ACCOUNTANT);
    await createRole(roleIds.librarian, 'Sectest librarian', 'ALL', catalog.DEFAULT_PERMISSIONS.LIBRARIAN);
    await createRole(roleIds.roleMgr, 'Sectest role manager', 'ALL', ['roles.view', 'roles.create', 'roles.update', 'exams.view', 'exams.mark', 'classes.view']);
    await createRole(roleIds.typeMgr, 'Sectest type assigner', 'ALL', ['students.view', 'students.update', 'students.assign_group']);

    await createUser(ids.superAdmin, { role: 'SUPER_ADMIN' });
    await createUser(ids.admin, { role: roleIds.admin });
    await createUser(ids.t1, { role: 'TEACHER' });
    await createUser(ids.t2, { role: 'TEACHER' });
    await createUser(ids.s1, { role: 'STUDENT', classId: ids.classA, rollNo: `${P}R1`, cnic: '35201-0000000-1' });
    await createUser(ids.s2, { role: 'STUDENT', classId: ids.classB, rollNo: `${P}R2`, cnic: '35201-0000000-2' });
    await createUser(ids.acct, { role: roleIds.finance });
    await createUser(ids.custom, { role: 'SECTEST_CUSTOM_ROLE' });
    await createUser(ids.noCred, { role: 'STUDENT', classId: ids.classA }, false);
    await createUser(ids.coord, { role: `${P.toUpperCase()}COORD` });
    await createUser(ids.mgr, { role: `${P.toUpperCase()}STAFFMGR` });
    await createUser(ids.clerk, { role: `${P.toUpperCase()}NOTHING` });
    await createUser(ids.deputy, { role: roleIds.admin });
    await createUser(ids.roleMgr, { role: roleIds.roleMgr });
    await createUser(ids.typeMgr, { role: roleIds.typeMgr });

    await insertRecord('classes', { id: ids.classA, name: 'Sectest A', teacherId: ids.t1, courseTeachers: [] });
    await insertRecord('classes', { id: ids.classB, name: 'Sectest B', teacherId: ids.t2, courseTeachers: [] });
    await insertRecord('exams', {
        id: ids.examB, title: 'Sectest exam', classId: ids.classB, createdBy: ids.t2, resultsPublished: false,
        questions: [{ text: 'Q1', options: ['a', 'b'], correctIndex: 1 }]
    });
    await insertRecord('examResults', { id: ids.resultB, examId: ids.examB, studentId: ids.s2, marksObtained: 10, published: false });
    await insertRecord('attendance', {
        id: ids.attS1, userId: ids.s1, role: 'STUDENT', classId: ids.classA, date: '2026-09-01', status: 'ABSENT', session: 'DAILY_ACADEMIC'
    });
    await insertRecord('donations', { id: ids.donation, donorName: 'Sectest donor', amount: 1000, status: 'CONFIRMED', isAnonymous: true });
    await insertRecord('virtualClasses', { id: ids.vcB, title: 'Sectest live', classId: ids.classB, hostId: ids.t2 });

    // Phase 2 fixtures
    await insertRecord('classes', { id: ids.classC, name: 'Sectest C', teacherId: ids.coord, courseTeachers: [] });
    await insertRecord('exams', { id: ids.examC, title: 'Sectest exam C', classId: ids.classC, createdBy: ids.coord, status: 'CLOSED', resultsPublished: false });
    await insertRecord('examResults', { id: ids.resultC, examId: ids.examC, studentId: ids.s2, marksObtained: 10, published: false });
    await insertRecord('libraryLoans', { id: ids.loanS2, userId: ids.s2, bookId: 'b1', status: 'ISSUED' });
    await insertRecord('assignments', { id: ids.assignA, title: 'Sectest homework', classId: ids.classA, teacherId: ids.t1, maxMarks: 10 });
    await insertRecord('assignmentSubmissions', { id: ids.subA, assignmentId: ids.assignA, studentId: ids.s1, submissionText: 'x', isGraded: true, marksObtained: 8 });
    await insertRecord('exams', { id: ids.examAClosed, title: 'Sectest scheduled', classId: ids.classA, createdBy: ids.t1, status: 'SCHEDULED', mode: 'ONLINE' });
    await insertRecord('exams', { id: ids.examAOpen, title: 'Sectest open', classId: ids.classA, createdBy: ids.t1, status: 'OPEN', mode: 'ONLINE' });
    await db.query(
        `INSERT INTO student_admissions (id, application_no, candidate_name, father_name, phone, cnic_bform, status) VALUES (?, ?, 'Sectest Applicant', 'Sectest Father', '+92 300 0000000', '35201-0000000-9', 'UNDER_REVIEW')`,
        [ids.admission, `${P}APP`]
    );
    // The server picks up the test roles and Super Admin row now rather than at its next periodic reload
    await require('./server/roles').load();
}

async function cleanup(settingsBackup) {
    const all = Object.values(ids);
    const like = `${P}%`;
    await db.query(`DELETE FROM lms_records WHERE id LIKE ?`, [like]);
    await db.query(`DELETE FROM user_credentials WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM auth_sessions WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM notifications WHERE sender_id LIKE ?`, [like]);
    await db.query(`DELETE FROM student_admissions WHERE id LIKE ?`, [like]);
    await db.query(`DELETE FROM super_admins WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM user_roles WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM user_permission_overrides WHERE user_id LIKE ?`, [like]);
    const roleLike = `${P.toUpperCase()}%`;
    await db.query(`DELETE FROM role_permissions WHERE role_id LIKE ?`, [roleLike]);
    await db.query(`DELETE FROM roles WHERE id LIKE ?`, [roleLike]);
    // Institution setup records made by the tests (codes / names carry the test prefix)
    await db.query(`DELETE FROM academic_programs WHERE code LIKE ?`, [roleLike]);
    await db.query(`DELETE FROM departments WHERE code LIKE ?`, [roleLike]);
    await db.query(`DELETE FROM branches WHERE code LIKE ?`, [roleLike]);
    await db.query(`DELETE FROM academic_sessions WHERE name LIKE ?`, [like]);
    await db.query(`DELETE FROM notifications WHERE message LIKE ?`, [`%${P}%`]);
    await db.query(`DELETE FROM student_admissions WHERE candidate_name LIKE ?`, [`Sectest Applicant ${P}%`]);
    // Test-only audit entries (real entries are never removed by the application)
    await db.query(`DELETE FROM audit_log WHERE entity_id LIKE ? OR entity_id LIKE ? OR actor_id LIKE ? OR summary LIKE ?`, [like, roleLike, like, `%${P}%`]);
    for (const [key, value] of Object.entries(settingsBackup)) {
        if (value === undefined) await db.query(`DELETE FROM system_settings WHERE setting_key = ?`, [key]);
        else await db.query(`UPDATE system_settings SET setting_value = ? WHERE setting_key = ?`, [value, key]);
    }
    return all.length;
}

async function run() {
    if (!(await db.testConnection())) process.exit(1);
    require('./server');
    await new Promise(r => setTimeout(r, 1200));

    // Role settings are restored exactly as they were
    const settingsBackup = {};
    for (const key of ['roleDefinitions', 'rolePermissions', 'institution', 'recordings']) {
        const [rows] = await db.query(`SELECT setting_value FROM system_settings WHERE setting_key = ?`, [key]);
        settingsBackup[key] = rows.length ? rows[0].setting_value : undefined;
    }

    let passed = 0;
    let failed = 0;
    const check = (name, ok, detail = '') => {
        if (ok) { passed++; console.log(`[PASS] ${name}`); } else { failed++; console.error(`[FAIL] ${name} ${detail}`); }
    };

    try {
        await setupFixtures();

        // --- No session -------------------------------------------------------------------
        for (const [m, p] of [['GET', '/api/store'], ['POST', '/api/store/sync'], ['GET', '/api/permissions'], ['GET', '/api/notifications'],
            ['GET', '/api/settings/meeting'], ['GET', '/uploads/2026-10/x.pdf'], ['GET', '/api/admissions'], ['POST', '/api/virtual-class/verify-access']]) {
            const r = await request(m, p, { body: m === 'POST' ? {} : undefined });
            check(`No session: ${m} ${p} is refused`, r.status === 401, `(got ${r.status})`);
        }
        const spoof = await request('GET', '/api/store', { headers: { 'X-User-Role': 'SUPER_ADMIN', 'X-User-Id': ids.superAdmin } });
        check('Identity headers alone grant nothing', spoof.status === 401, `(got ${spoof.status})`);
        const takeover = await request('POST', '/api/store/sync', {
            headers: { 'X-User-Role': 'SUPER_ADMIN', 'X-User-Id': ids.superAdmin },
            body: { upserts: { users: [{ id: ids.superAdmin, role: 'SUPER_ADMIN', password: 'Pwned-12345' }] } }
        });
        check('Password takeover by headers is refused', takeover.status === 401 && (await login(`${ids.superAdmin}@test.local`, 'Pwned-12345')).status === 401);
        for (const p of ['/api/attendance/checkin', '/api/virtual-class/join', '/api/virtual-class/create', '/api/virtual-class/session-status']) {
            const r = await request('POST', p, { body: {} });
            check(`Legacy endpoint ${p} is not reachable without a session`, r.status === 401, `(got ${r.status})`);
        }
        const health = await request('GET', '/api/health');
        check('API sends no wildcard CORS header', health.status === 200 && !health.headers['access-control-allow-origin']);

        // --- Login ------------------------------------------------------------------------
        const wrong = await login(`${ids.s1}@test.local`, 'not-the-password');
        const unknown = await login(`nobody-${P}@test.local`, 'whatever123');
        check('Wrong password and unknown account get the same answer', wrong.status === 401 && unknown.status === 401 && wrong.body.error === unknown.body.error);
        check('Account without a password cannot use the old default', (await login(`${ids.noCred}@test.local`, 'ashrafia123')).status === 401);
        let locked = null;
        for (let i = 0; i < 6; i++) locked = await login(`lock-${P}@test.local`, `bad-${i}`);
        check('Repeated failures lock the identifier', locked.status === 429, `(got ${locked.status})`);

        const sess = {};
        for (const key of ['superAdmin', 'admin', 't1', 't2', 's1', 's2', 'acct', 'custom']) {
            const r = await login(`${ids[key]}@test.local`, passwords[ids[key]]);
            sess[key] = r.cookie;
            if (key === 'admin') {
                check('Session cookie is HttpOnly and SameSite=Strict', /HttpOnly/i.test(r.setCookie) && /SameSite=Strict/i.test(r.setCookie));
                check('Login response carries no bearer token', r.body && r.body.token === undefined);
            }
        }
        check('All test accounts signed in', Object.values(sess).every(Boolean));

        const pull = async key => (await request('GET', '/api/store', { cookie: sess[key] })).body.collections || {};
        const has = (list, id) => (list || []).some(r => r.id === id);

        // --- Reads ------------------------------------------------------------------------
        const sPull = await pull('s1');
        check('Student does not receive other students', !has(sPull.users, ids.s2));
        check('Student receives own record with own CNIC', (sPull.users || []).some(u => u.id === ids.s1 && u.cnic));
        check('Student does not receive another class\'s exam', !has(sPull.exams, ids.examB));
        check('Student does not receive donations of others', !has(sPull.donations, ids.donation));
        const spoofPull = await request('GET', '/api/store', { cookie: sess.s1, headers: { 'X-User-Role': 'SUPER_ADMIN', 'X-User-Id': ids.superAdmin } });
        check('Student session with Super Admin headers still gets student data', !has(spoofPull.body.collections.users, ids.s2));

        const tPull = await pull('t1');
        check('Teacher receives students of own class without CNIC', (tPull.users || []).some(u => u.id === ids.s1 && !u.cnic));
        check('Teacher does not receive students of other classes', !has(tPull.users, ids.s2));
        check('Teacher does not receive another class\'s exam', !has(tPull.exams, ids.examB));
        check('Teacher does not receive the donation ledger', !has(tPull.donations, ids.donation));
        const t2Pull = await pull('t2');
        check('Teacher receives own class exam with answer key', (t2Pull.exams || []).some(e => e.id === ids.examB && e.questions[0].correctIndex === 1));

        const aPull = await pull('acct');
        check('Finance role receives the donation ledger', has(aPull.donations, ids.donation));
        check('Finance role receives no exam answer keys', !(aPull.exams || []).some(e => (e.questions || []).some(q => 'correctIndex' in q)));
        check('Finance role receives no unpublished results', !has(aPull.examResults, ids.resultB));
        check('Finance role does not receive student CNICs', !(aPull.users || []).some(u => u.role === 'STUDENT' && u.cnic));

        const cPull = await pull('custom');
        check('Custom role without modules receives no students', !(cPull.users || []).some(u => u.role === 'STUDENT'));
        check('Custom role without modules receives no donations or exams', !has(cPull.donations, ids.donation) && !has(cPull.exams, ids.examB));
        check('Nobody receives password fields', ![sPull, tPull, aPull, cPull].some(c => (c.users || []).some(u => 'password' in u)));

        // --- Writes -----------------------------------------------------------------------
        const sync = (key, upserts, deletes) => request('POST', '/api/store/sync', { cookie: sess[key], body: { upserts: upserts || {}, deletes: deletes || {} } });
        const rejected = (r, coll, id) => r.status === 200 && (r.body.rejected[coll] || []).includes(id);
        const accepted = (r, coll, id) => r.status === 200 && (r.body.accepted[coll] || []).includes(id);

        const examEdit = await sync('t1', { exams: [{ ...(await stored('exams', ids.examB)), title: 'Hijacked' }] });
        check('Teacher cannot edit another class\'s exam', rejected(examEdit, 'exams', ids.examB));
        const ownExamId = `${P}examA`;
        const ownExam = await sync('t1', { exams: [{ id: ownExamId, title: 'Own exam', classId: ids.classA, createdBy: ids.t1 }] });
        check('Teacher can create an exam for own class', accepted(ownExam, 'exams', ownExamId));
        const publish = await sync('t1', { examResults: [{ id: ids.resultB, examId: ids.examB, studentId: ids.s2, published: true }] });
        check('Teacher cannot publish another class\'s results', rejected(publish, 'examResults', ids.resultB) && !(await stored('examResults', ids.resultB)).published);
        const delExam = await sync('t1', {}, { exams: [ids.examB] });
        check('Teacher cannot delete another class\'s exam', rejected(delExam, 'exams', ids.examB));
        const donationEdit = await sync('t1', { donations: [{ id: ids.donation, amount: 1 }] });
        check('Teacher cannot edit the donation ledger', rejected(donationEdit, 'donations', ids.donation) && (await stored('donations', ids.donation)).amount === 1000);

        const attEdit = await sync('s1', { attendance: [{ ...(await stored('attendance', ids.attS1)), status: 'PRESENT' }] });
        check('Student cannot change attendance a teacher marked', (await stored('attendance', ids.attS1)).status === 'ABSENT', JSON.stringify(attEdit.body));
        const backdated = `${P}attOld`;
        const back = await sync('s1', { attendance: [{ id: backdated, userId: ids.s1, date: '2026-01-01', status: 'PRESENT' }] });
        check('Student cannot add backdated attendance', rejected(back, 'attendance', backdated));
        const today = new Date().toISOString().slice(0, 10);
        const checkin = `${P}attToday`;
        const ci = await sync('s1', { attendance: [{ id: checkin, userId: ids.s1, date: today, status: 'PRESENT', userName: '<img src=x onerror=alert(1)>' }] });
        check('Student can check in for today', accepted(ci, 'attendance', checkin));
        check('Self check-in stores the account name, not a typed one', (await stored('attendance', checkin)).userName === `Test ${ids.s1.slice(-6)}`);
        const foreignPledge = `${P}pledgeX`;
        const fp = await sync('s1', { donations: [{ id: foreignPledge, amount: 500, donorUserId: ids.s2 }] });
        check('Student cannot record a donation in someone else\'s name', rejected(fp, 'donations', foreignPledge));
        const pledge = `${P}pledge`;
        await sync('s1', { donations: [{ id: pledge, amount: 500, status: 'RECEIVED', confirmedBy: ids.s1 }] });
        const pledgeRec = await stored('donations', pledge);
        check('Student donation is a pending pledge in their own name', pledgeRec && pledgeRec.status === 'PENDING_CONFIRMATION' && pledgeRec.donorUserId === ids.s1 && !pledgeRec.confirmedBy);
        const otherUser = await sync('s1', { users: [{ ...(await stored('users', ids.s2)), name: 'Changed' }] });
        check('Student cannot edit another user', rejected(otherUser, 'users', ids.s2));
        await sync('s1', { users: [{ ...(await stored('users', ids.s1)), role: 'ACADEMIC_ADMIN', password: 'SelfSet-12345' }] });
        check('Student cannot change own role', (await stored('users', ids.s1)).role === 'STUDENT');
        check('Own password cannot be changed through record sync', (await login(`${ids.s1}@test.local`, 'SelfSet-12345')).status === 401);

        // --- Admin limits -----------------------------------------------------------------
        const editSuper = await sync('admin', { users: [{ ...(await stored('users', ids.superAdmin)), name: 'Renamed' }] });
        check('Admin cannot edit a Super Admin account', rejected(editSuper, 'users', ids.superAdmin));
        const newSuper = `${P}newsuper`;
        const makeSuper = await sync('admin', { users: [{ id: newSuper, role: 'SUPER_ADMIN', name: 'X', email: `${newSuper}@test.local` }] });
        check('Admin cannot create a Super Admin', rejected(makeSuper, 'users', newSuper));
        const dupId = `${P}dup`;
        const dup = await sync('admin', { users: [{ id: dupId, role: 'STUDENT', name: 'Dup', email: `${ids.s2}@test.local` }] });
        check('Duplicate login email is refused with a reason', rejected(dup, 'users', dupId) && !!(dup.body.errors.users || {})[dupId]);
        const weak = await sync('admin', { users: [{ ...(await stored('users', ids.s2)), password: 'short' }] });
        check('Admin cannot set a password shorter than 8 characters', rejected(weak, 'users', ids.s2));

        // --- Three domains: system roles, student types, teacher types --------------------
        {
            const call = (key, method, path, body) => request(method, path, { cookie: sess[key], body });
            const meOf = async key => (await call(key, 'GET', '/api/auth/me')).body;
            const online = `${R}ONLINE`;
            const assist = `${R}ASSIST`;
            const today = new Date().toISOString().slice(0, 10);
            const cat = (await call('superAdmin', 'GET', '/api/roles/catalog')).body;
            check('Catalog describes the three domains and their ceilings', !!(cat.domains && cat.domains.STUDENT && cat.domainCeilings && cat.domainCeilings.TEACHER));
            const sysList = (await call('admin', 'GET', '/api/roles')).body.roles || [];
            check('Every role is labelled with its domain', sysList.length && sysList.every(r => ['SYSTEM', 'STUDENT', 'TEACHER'].includes(r.domain))
                && sysList.find(r => r.id === 'STUDENT').domain === 'STUDENT' && sysList.find(r => r.id === 'TEACHER').domain === 'TEACHER');

            check('Admin cannot create a student type', (await call('admin', 'POST', '/api/permission-groups/students', { id: `${R}BYADMIN`, name: 'X', permissions: [] })).status === 403);
            const mkS = await call('superAdmin', 'POST', '/api/permission-groups/students', { id: online, name: 'Sectest Online Student', permissions: ['classes.view', 'virtual_classes.join', 'recordings.view', 'timetable.view'] });
            check('Super Admin creates a student type', mkS.status === 200 && mkS.body.role && mkS.body.role.domain === 'STUDENT' && mkS.body.role.scope === 'SELF', JSON.stringify(mkS.body));
            const badS = await call('superAdmin', 'POST', '/api/permission-groups/students', { id: `${R}BADS`, name: 'Bad', permissions: ['classes.view', 'users.view'] });
            check('A student type cannot hold office permissions, even for the Super Admin', badS.status === 400);
            const mkT = await call('superAdmin', 'POST', '/api/permission-groups/teachers', { id: assist, name: 'Sectest Assistant Teacher', permissions: ['classes.view', 'attendance.view', 'attendance.mark'] });
            check('Super Admin creates a teacher type', mkT.status === 200 && mkT.body.role && mkT.body.role.domain === 'TEACHER' && mkT.body.role.scope === 'TEACHING', JSON.stringify(mkT.body));
            check('A teacher type cannot hold system user management', (await call('superAdmin', 'POST', '/api/permission-groups/teachers', { id: `${R}BADT`, name: 'Bad', permissions: ['users.update'] })).status === 400);
            check('Student types are not changed through the system Roles API', (await call('superAdmin', 'PUT', `/api/roles/${online}`, { version: 1, add: [] })).status === 400
                && (await call('superAdmin', 'PUT', '/api/roles/STUDENT', { version: 1, add: [] })).status === 400);
            const sysRole = await call('superAdmin', 'POST', '/api/roles', { id: `${R}SYS`, name: 'Sectest system role', permissions: [] });
            check('The Roles API only creates system roles', sysRole.status === 200 && sysRole.body.role.domain === 'SYSTEM');
            const groupsForAdmin = await call('admin', 'GET', '/api/permission-groups/students');
            check('Staff who see students can read the student types, without individual overrides', groupsForAdmin.status === 200
                && groupsForAdmin.body.groups.some(g => g.id === online) && groupsForAdmin.body.overrides === undefined);
            check('Students cannot read the type definitions', (await call('s1', 'GET', '/api/permission-groups/students')).status === 403);

            // Account kinds never mix
            const asStaff = `${P}asstaff`;
            const r1 = await sync('superAdmin', { users: [{ id: asStaff, role: online, name: 'X', email: `${asStaff}@test.local` }] });
            check('A student type cannot be used as a system user role (not even by the Super Admin)', rejected(r1, 'users', asStaff));
            const r2 = await sync('superAdmin', { users: [{ ...(await stored('users', ids.s2)), role: 'TEACHER' }] });
            check('A student account cannot be turned into a teacher account', rejected(r2, 'users', ids.s2) && (await stored('users', ids.s2)).role === 'STUDENT');
            const r3 = await sync('superAdmin', { users: [{ ...(await stored('users', ids.t2)), role: roleIds.admin }] });
            check('A teacher account cannot be turned into a system user', rejected(r3, 'users', ids.t2) && (await stored('users', ids.t2)).role === 'TEACHER');
            const r4 = await sync('superAdmin', { users: [{ ...(await stored('users', ids.s2)), additionalRoles: [roleIds.librarian] }] });
            check('Students cannot hold additional (system) roles', rejected(r4, 'users', ids.s2));
            const r5 = await sync('superAdmin', { users: [{ ...(await stored('users', ids.t2)), additionalRoles: [online] }] });
            check('A student type cannot be given as an additional role', rejected(r5, 'users', ids.t2));
            const r6 = await sync('superAdmin', { users: [{ ...(await stored('users', ids.s2)), permissionGroup: assist }] });
            check('A student cannot be put in a teacher type', rejected(r6, 'users', ids.s2));

            // Choosing a type needs the Super Admin or students.assign_group
            const r7 = await sync('admin', { users: [{ ...(await stored('users', ids.s2)), permissionGroup: online }] });
            check('Admin without the assign permission cannot change a student type', rejected(r7, 'users', ids.s2) && (await meOf('s2')).roles[0].id === 'STUDENT');
            sess.typeMgr = (await login(`${ids.typeMgr}@test.local`, passwords[ids.typeMgr])).cookie;
            const r8 = await sync('typeMgr', { users: [{ ...(await stored('users', ids.s2)), permissionGroup: online }] });
            check('Staff with students.assign_group can change a student type', accepted(r8, 'users', ids.s2), JSON.stringify(r8.body));
            const meOnline = await meOf('s2');
            check('A student receives exactly the permissions of their type', meOnline.roles[0].id === online && meOnline.scope === 'SELF'
                && meOnline.permissions.includes('virtual_classes.join') && !meOnline.permissions.includes('exams.attempt') && !meOnline.permissions.includes('assignments.submit'),
                JSON.stringify(meOnline.permissions));
            const sPull2 = (await request('GET', '/api/store', { cookie: sess.s2 })).body.collections || {};
            check('The student portal sees its own type on its record', ((sPull2.users || []).find(u => u.id === ids.s2) || {}).permissionGroup === online);
            const ci2 = `${P}attS2`;
            const blocked = await sync('s2', { attendance: [{ id: ci2, userId: ids.s2, date: today, status: 'PRESENT' }] });
            check('The server refuses what the type does not allow (daily check-in)', rejected(blocked, 'attendance', ci2));
            await sync('s2', { users: [{ ...(await stored('users', ids.s2)), permissionGroup: 'STUDENT' }] });
            check('A student cannot change their own type', (await meOf('s2')).roles[0].id === online);

            // Individual overrides (Super Admin only, within the student ceiling)
            check('Admin cannot set individual permissions', (await call('admin', 'PUT', `/api/permission-groups/students/members/${ids.s2}`, { allow: ['attendance.self_checkin'] })).status === 403);
            check('Individual permissions stay inside the student ceiling', (await call('superAdmin', 'PUT', `/api/permission-groups/students/members/${ids.s2}`, { allow: ['users.view'] })).status === 400);
            const ov = await call('superAdmin', 'PUT', `/api/permission-groups/students/members/${ids.s2}`, { allow: ['attendance.self_checkin'], deny: ['recordings.view'] });
            const meOv = await meOf('s2');
            check('An individual allow and deny change the effective permissions', ov.status === 200 && meOv.permissions.includes('attendance.self_checkin') && !meOv.permissions.includes('recordings.view'), JSON.stringify(ov.body));
            const nowOk = await sync('s2', { attendance: [{ id: ci2, userId: ids.s2, date: today, status: 'PRESENT' }] });
            check('The server then allows the individually allowed action', accepted(nowOk, 'attendance', ci2));
            const sa = await call('superAdmin', 'GET', '/api/permission-groups/students');
            check('The Super Admin sees individual overrides', (((sa.body.overrides || {})[ids.s2] || {}).allow || []).includes('attendance.self_checkin'));
            const [auditRows] = await db.query(`SELECT action FROM audit_log WHERE entity_id = ? AND action IN ('user.group_change', 'user.permissions_change')`, [ids.s2]);
            check('Type changes and individual permissions are audited', auditRows.some(r => r.action === 'user.group_change') && auditRows.some(r => r.action === 'user.permissions_change'));

            // Teacher types
            const tt = await call('superAdmin', 'PUT', `/api/permission-groups/teachers/members/${ids.t2}`, { group: assist });
            const meT2 = await meOf('t2');
            check('A teacher receives only the permissions of their type', tt.status === 200 && meT2.roles[0].id === assist && meT2.scope === 'TEACHING'
                && meT2.permissions.includes('attendance.mark') && !meT2.permissions.includes('exams.create') && !meT2.permissions.includes('users.view'));
            const tExam = `${P}examByAssist`;
            const tEx = await sync('t2', { exams: [{ id: tExam, title: 'Not allowed', classId: ids.classB, createdBy: ids.t2 }] });
            check('The server refuses exam creation to a teacher type without it', rejected(tEx, 'exams', tExam));
            check('A type in use cannot be deleted', (await call('superAdmin', 'DELETE', `/api/permission-groups/teachers/${assist}`)).status === 409);
            check('The default student type cannot be deleted', (await call('superAdmin', 'DELETE', '/api/permission-groups/students/STUDENT')).status === 400);
            const meSA2 = await meOf('superAdmin');
            check('Super Admin still holds everything, including the new type permissions', meSA2.isSuperAdmin && meSA2.permissions.includes('students.assign_group') && meSA2.permissions.includes('teachers.assign_group'));

            // Back to the default types for the checks that follow
            await call('superAdmin', 'PUT', `/api/permission-groups/students/members/${ids.s2}`, { group: 'STUDENT', allow: [], deny: [] });
            await call('superAdmin', 'PUT', `/api/permission-groups/teachers/members/${ids.t2}`, { group: 'TEACHER', allow: [], deny: [] });
            check('Moving people back restores the default type', (await meOf('s2')).roles[0].id === 'STUDENT' && (await meOf('t2')).permissions.includes('exams.create'));
            check('An empty type can be deleted', (await call('superAdmin', 'DELETE', `/api/permission-groups/teachers/${assist}`)).status === 200);
            await db.query(`DELETE FROM lms_records WHERE collection = 'attendance' AND id = ?`, [ci2]);
        }
        // --- Phase 2: roles, permissions, workflow rules, audit --------------------------
        const api = (key, method, path, body) => request(method, path, { cookie: sess[key], body });
        sess.roleMgr = (await login(`${ids.roleMgr}@test.local`, passwords[ids.roleMgr])).cookie;
        check('Old /api/permissions endpoint is retired', (await api('admin', 'GET', '/api/permissions')).status === 410);

        const me = async key => (await api(key, 'GET', '/api/auth/me')).body;
        const meS = await me('s1');
        const meT = await me('t1');
        const meA = await me('admin');
        const meSA = await me('superAdmin');
        check('/api/me: student has own-records scope and can sit exams but not mark', meS.scope === 'SELF' && meS.permissions.includes('exams.attempt') && !meS.permissions.includes('exams.mark'));
        check('/api/me: teacher has teaching scope and can mark', meT.scope === 'TEACHING' && meT.permissions.includes('exams.mark'));
        check('/api/me: Admin has institution scope but no staff-account, role-editing or audit permissions', meA.scope === 'ALL'
            && !meA.permissions.includes('users.update') && !meA.permissions.includes('roles.create') && !meA.permissions.includes('audit.view'));
        check('/api/me: Super Admin holds everything', meSA.isSuperAdmin === true && meSA.permissions.includes('audit.view') && meSA.permissions.includes('users.assign_roles'));

        const coordId = `${R}COORD`;
        check('Admin cannot create roles (Super Admin only)', (await api('admin', 'POST', '/api/roles', { id: `${R}BYADMIN`, name: 'By admin', permissions: [] })).status === 403);
        const mk = await api('roleMgr', 'POST', '/api/roles', { id: coordId, name: 'Sectest coordinator', scope: 'TEACHING', permissions: ['exams.view', 'exams.mark', 'classes.view'] });
        check('A role manager can create a role with permissions they hold', mk.status === 200 && mk.body.role && mk.body.role.version === 1, JSON.stringify(mk.body));
        const mkBad = await api('roleMgr', 'POST', '/api/roles', { id: `${R}BAD`, name: 'Bad', permissions: ['users.update'] });
        check('Nobody can give a permission they do not hold', mkBad.status === 403);
        check('Role identifiers are unique', (await api('roleMgr', 'POST', '/api/roles', { id: coordId, name: 'Again' })).status === 409);
        const stale = await api('roleMgr', 'PUT', `/api/roles/${coordId}`, { version: 99, add: ['exams.results.publish'] });
        check('Editing a role with an old version is refused', stale.status === 409);

        const roleList = (await api('superAdmin', 'GET', '/api/roles')).body.roles;
        const versionOf = id => (roleList.find(r => r.id === id) || {}).version;
        const ceiling = await api('superAdmin', 'PUT', '/api/roles/TEACHER', { version: versionOf('TEACHER'), add: ['fees.challans.verify'] });
        check('The Teacher role can never hold office permissions', ceiling.status === 400);
        const ownRole = await api('roleMgr', 'PUT', `/api/roles/${roleIds.roleMgr}`, { version: versionOf(roleIds.roleMgr), add: [] });
        check('Nobody but the Super Admin can edit the role they hold', ownRole.status === 403);
        const adminEdit = await api('admin', 'PUT', `/api/roles/${roleIds.admin}`, { version: versionOf(roleIds.admin), add: [] });
        check('Admin cannot edit roles', adminEdit.status === 403);
        const namesOnly = (await api('s1', 'GET', '/api/roles')).body.roles;
        check('Students see role names but not what roles may do', namesOnly.length > 0 && namesOnly.every(r => r.permissions === undefined));

        // A custom office role gets real powers from its permissions alone
        const finId = `${R}FIN`;
        await api('superAdmin', 'POST', '/api/roles', { id: finId, name: 'Sectest fees clerk', scope: 'ALL', permissions: ['fees.challans.view', 'fees.challans.generate', 'donations.view'] });
        await insertRecord('users', { ...(await stored('users', ids.custom)), role: finId });
        const chId = `${P}ch1`;
        const mkCh = await sync('custom', { feeChallans: [{ id: chId, studentId: ids.s1, status: 'PENDING', netPayable: 100 }] });
        check('Custom role with fee permissions can issue a challan', accepted(mkCh, 'feeChallans', chId), JSON.stringify(mkCh.body));
        const payCh = await sync('custom', { feeChallans: [{ ...(await stored('feeChallans', chId)), status: 'PAID' }] });
        check('Marking a challan paid needs the verify permission (with a reason)', rejected(payCh, 'feeChallans', chId) && /verify/i.test((payCh.body.errors.feeChallans || {})[chId] || ''));
        const finPull = (await request('GET', '/api/store', { cookie: sess.custom })).body.collections || {};
        const anon = (finPull.donations || []).find(d => d.id === ids.donation);
        check('Anonymous donors stay hidden without the donor-identity permission', anon && anon.donorName === 'Anonymous');
        const acctPull = (await request('GET', '/api/store', { cookie: sess.acct })).body.collections || {};
        check('Finance role with the donor-identity permission sees anonymous donors', (acctPull.donations || []).some(d => d.id === ids.donation && d.donorName === 'Sectest donor'));
        check('A role somebody holds cannot be deleted', (await api('superAdmin', 'DELETE', `/api/roles/${finId}`)).status === 409);
        await api('superAdmin', 'POST', '/api/roles', { id: `${R}EMPTY`, name: 'Sectest empty', permissions: [] });
        check('An unused custom role can be deleted', (await api('superAdmin', 'DELETE', `/api/roles/${R}EMPTY`)).status === 200);
        check('Default roles cannot be deleted', (await api('superAdmin', 'DELETE', '/api/roles/TEACHER')).status === 400);

        // Teaching-scope custom role: may mark but not publish
        const coordLogin = await login(`${ids.coord}@test.local`, passwords[ids.coord]);
        sess.coord = coordLogin.cookie;
        const markC = await sync('coord', { examResults: [{ ...(await stored('examResults', ids.resultC)), marksObtained: 15 }] });
        check('Custom teaching role can mark results of its class', accepted(markC, 'examResults', ids.resultC), JSON.stringify(markC.body));
        const pubC = await sync('coord', { examResults: [{ ...(await stored('examResults', ids.resultC)), published: true }] });
        check('Publishing results needs the publish permission', rejected(pubC, 'examResults', ids.resultC) && !(await stored('examResults', ids.resultC)).published);
        const coordPull = (await request('GET', '/api/store', { cookie: sess.coord })).body.collections || {};
        check('Custom teaching role sees only its own class', !(coordPull.users || []).some(u => u.id === ids.s1) && (coordPull.exams || []).every(e => e.classId === ids.classC));

        // Account management by family
        const acctRec = await stored('users', ids.acct);
        const staffReset = await sync('admin', { users: [{ ...acctRec, password: 'Temporary-123' }] });
        check('Admin cannot reset an office-staff password', rejected(staffReset, 'users', ids.acct));
        const staffEdit = await sync('admin', { users: [{ ...acctRec, designation: 'Changed by admin' }] });
        check('Admin cannot edit office-staff accounts', rejected(staffEdit, 'users', ids.acct));
        const promote = await sync('admin', { users: [{ ...(await stored('users', ids.s2)), role: 'ACADEMIC_ADMIN' }] });
        check('Admin cannot change anyone\'s role', rejected(promote, 'users', ids.s2) && (await stored('users', ids.s2)).role === 'STUDENT');
        const studentEdit = await sync('admin', { users: [{ ...(await stored('users', ids.s2)), name: 'Renamed student' }] });
        check('Admin can edit student records', accepted(studentEdit, 'users', ids.s2));
        const deact = await sync('admin', { users: [{ ...(await stored('users', ids.custom)), status: 'INACTIVE' }] });
        check('Admin cannot deactivate office-staff accounts', rejected(deact, 'users', ids.custom));

        // Workflow rules
        const oldAtt = await sync('t1', { attendance: [{ ...(await stored('attendance', ids.attS1)), status: 'PRESENT' }] });
        check('Teachers cannot change attendance older than 7 days', rejected(oldAtt, 'attendance', ids.attS1) && (await stored('attendance', ids.attS1)).status === 'ABSENT');
        const fixAtt = await sync('admin', { attendance: [{ ...(await stored('attendance', ids.attS1)), status: 'LEAVE' }] });
        check('Staff with the correction permission can fix old attendance', accepted(fixAtt, 'attendance', ids.attS1));
        const graded = await sync('s1', { assignmentSubmissions: [{ ...(await stored('assignmentSubmissions', ids.subA)), submissionText: 'changed' }] });
        check('Checked work cannot be changed by the student', rejected(graded, 'assignmentSubmissions', ids.subA));
        const notOpen = `${P}subClosed`;
        const closedSub = await sync('s1', { examSubmissions: [{ id: notOpen, examId: ids.examAClosed, studentId: ids.s1, status: 'IN_PROGRESS' }] });
        check('A paper cannot be started while the exam is not open', rejected(closedSub, 'examSubmissions', notOpen));
        const openSub = `${P}subOpen`;
        await sync('s1', { examSubmissions: [{ id: openSub, examId: ids.examAOpen, studentId: ids.s1, status: 'IN_PROGRESS', answers: {} }] });
        const submitted = await sync('s1', { examSubmissions: [{ ...(await stored('examSubmissions', openSub)), status: 'SUBMITTED', answers: { 0: 1 } }] });
        check('A paper can be started and submitted while the exam is open', accepted(submitted, 'examSubmissions', openSub));
        const afterSubmit = await sync('s1', { examSubmissions: [{ ...(await stored('examSubmissions', openSub)), answers: { 0: 0 } }] });
        check('A submitted paper cannot be changed', rejected(afterSubmit, 'examSubmissions', openSub));

        const admOffId = `${R}ADMOFF`;
        await api('superAdmin', 'POST', '/api/roles', { id: admOffId, name: 'Sectest admissions clerk', scope: 'ALL', permissions: ['admissions.view', 'admissions.update'] });
        await insertRecord('users', { ...(await stored('users', ids.coord)), role: admOffId });
        const decide = await request('PUT', `/api/admissions/${ids.admission}`, { cookie: sess.coord, body: { status: 'APPROVED' } });
        check('Approving an application needs the decide permission', decide.status === 403, `(got ${decide.status})`);
        const edit = await request('PUT', `/api/admissions/${ids.admission}`, { cookie: sess.coord, body: { phone: '+92 300 0000001' } });
        check('Correcting application details needs only the update permission', edit.status === 200, `(got ${edit.status} ${JSON.stringify(edit.body)})`);

        const studentBroadcast = await api('s2', 'POST', '/api/notifications', { title: 'Hi', message: 'All', targetRole: 'STUDENT' });
        check('Students cannot broadcast to a role', studentBroadcast.status === 403);
        const otherClass = await api('t1', 'POST', '/api/notifications', { title: 'Hi', message: 'Class', targetRole: 'STUDENT', targetClassId: ids.classB });
        const ownClass = await api('t1', 'POST', '/api/notifications', { title: 'Hi', message: 'Class', targetRole: 'STUDENT', targetClassId: ids.classA });
        check('Teachers can notify only classes they teach', otherClass.status === 403 && ownClass.status === 201);

        check('Admin cannot read the audit log', (await api('admin', 'GET', '/api/audit')).status === 403);
        const log = (await api('superAdmin', 'GET', `/api/audit?limit=200`)).body.entries || [];
        check('Audit log records role creation', log.some(e => e.action === 'role.create' && e.entityId === coordId));
        check('Audit log records attendance corrections', log.some(e => e.action === 'attendance.correct' && e.entityId === ids.attS1));
        check('Editing application details is not logged as a decision', !log.some(e => e.action === 'admission.status' && e.entityId === ids.admission));


        // --- Phase 3: multiple roles, escalation, Super Admin grants, preview -------------
        const rolesNow = (await api('superAdmin', 'GET', '/api/roles')).body.roles;
        check('Admin, Teacher and Student always exist as system roles', ['ACADEMIC_ADMIN', 'TEACHER', 'STUDENT'].every(id => rolesNow.some(r => r.id === id && r.isSystem)));

        // Teacher who is also Librarian: library powers institution-wide, teaching powers still only for own classes
        const giveLib = await sync('superAdmin', { users: [{ ...(await stored('users', ids.t1)), additionalRoles: [roleIds.librarian] }] });
        check('Super Admin can give an additional role', accepted(giveLib, 'users', ids.t1), JSON.stringify(giveLib.body));
        const meT1 = await me('t1');
        check('/api/me lists both roles and keeps teaching scope for exams', meT1.roles.map(r => r.id).join() === `TEACHER,${roleIds.librarian}`
            && meT1.scopes['library.loans.issue'] === 'ALL' && meT1.scopes['exams.mark'] === 'TEACHING' && meT1.scope === 'TEACHING');
        const bookId = `${P}book`;
        check('Additional role adds its powers (teacher-librarian adds a book)', accepted(await sync('t1', { libraryBooks: [{ id: bookId, title: 'Sectest kitab' }] }), 'libraryBooks', bookId));
        const t1Pull2 = (await request('GET', '/api/store', { cookie: sess.t1 })).body.collections || {};
        check('Teacher-librarian sees everyone\'s loans', has(t1Pull2.libraryLoans, ids.loanS2));
        check('Additional role does not widen teaching powers', rejected(await sync('t1', { exams: [{ ...(await stored('exams', ids.examB)), title: 'Still not mine' }] }), 'exams', ids.examB));
        const saPull = (await request('GET', '/api/store', { cookie: sess.superAdmin })).body.collections || {};
        check('Additional roles come from the server in user records', (saPull.users || []).some(u => u.id === ids.t1 && (u.additionalRoles || []).includes(roleIds.librarian)));
        check('Additional roles cannot be given through one\'s own profile', rejected(await sync('s1', { users: [{ ...(await stored('users', ids.s1)), additionalRoles: ['ACADEMIC_ADMIN'] }] }), 'users', ids.s1)
            || !((await me('s1')).roles || []).some(r => r.id === 'ACADEMIC_ADMIN'));

        // A staff manager with limited powers: cannot hand out or reach anything stronger than themselves
        const mgrRole = `${R}STAFFMGR`;
        const mkMgr = await api('superAdmin', 'POST', '/api/roles', { id: mgrRole, name: 'Sectest staff manager', scope: 'ALL',
            permissions: ['users.view', 'users.create', 'users.update', 'users.reset_password', 'users.assign_roles', 'roles.view', 'roles.update'] });
        check('Separation-of-duty warnings come back with the role', mkMgr.status === 200 && (mkMgr.body.role.warnings || []).some(w => w.permissions.includes('users.assign_roles')));
        await api('superAdmin', 'POST', '/api/roles', { id: `${R}NOTHING`, name: 'Sectest no permissions', scope: 'ALL', permissions: [] });
        sess.mgr = (await login(`${ids.mgr}@test.local`, passwords[ids.mgr])).cookie;
        sess.clerk = (await login(`${ids.clerk}@test.local`, passwords[ids.clerk])).cookie;
        const strongerRole = await sync('mgr', { users: [{ ...(await stored('users', ids.clerk)), role: roleIds.finance }] });
        check('Nobody can give a role stronger than their own', rejected(strongerRole, 'users', ids.clerk) && /cannot/.test((strongerRole.body.errors.users || {})[ids.clerk] || ''));
        const resetAdmin = await sync('mgr', { users: [{ ...(await stored('users', ids.admin)), password: 'Temporary-123' }] });
        check('Nobody can reset the password of someone more powerful', rejected(resetAdmin, 'users', ids.admin));
        const resetClerk = await sync('mgr', { users: [{ ...(await stored('users', ids.clerk)), password: auth.temporaryPassword(10) }] });
        check('A weaker person\'s password can be reset', accepted(resetClerk, 'users', ids.clerk), JSON.stringify(resetClerk.body));
        const reshapeAdmin = await api('mgr', 'PUT', `/api/roles/${roleIds.admin}`, { version: versionOf(roleIds.admin), remove: ['roles.view'] });
        check('A role cannot be edited by someone it outranks', reshapeAdmin.status === 403);
        const liteRole = `${R}LITE`;
        await api('superAdmin', 'POST', '/api/roles', { id: liteRole, name: 'Sectest directory reader', scope: 'ALL', permissions: ['users.view'] });
        const giveLite = await sync('mgr', { users: [{ ...(await stored('users', ids.clerk)), additionalRoles: [liteRole] }] });
        check('Roles weaker than oneself can be given', accepted(giveLite, 'users', ids.clerk)
            && (((await request('GET', '/api/store', { cookie: sess.superAdmin })).body.collections.users || []).find(u => u.id === ids.clerk) || {}).additionalRoles.includes(liteRole), JSON.stringify(giveLite.body));

        // Super Admin: never through a record save; grant and removal need the password; there is always one
        check('Nobody becomes Super Admin through a record save', rejected(await sync('superAdmin', { users: [{ ...(await stored('users', ids.deputy)), role: 'SUPER_ADMIN' }] }), 'users', ids.deputy));
        check('Granting Super Admin needs the right password', (await api('superAdmin', 'POST', '/api/super-admins', { userId: ids.deputy, password: 'wrong-password' })).status === 403);
        check('Only a Super Admin can grant Super Admin', (await api('admin', 'POST', '/api/super-admins', { userId: ids.deputy, password: passwords[ids.admin] })).status === 403);
        const grant = await api('superAdmin', 'POST', '/api/super-admins', { userId: ids.deputy, password: passwords[ids.superAdmin] });
        sess.deputy = (await login(`${ids.deputy}@test.local`, passwords[ids.deputy])).cookie;
        check('Super Admin can be granted', grant.status === 200 && (await me('deputy')).isSuperAdmin === true, JSON.stringify(grant.body));
        const revoke = await api('deputy', 'POST', '/api/super-admins/revoke', { userId: ids.superAdmin, newRole: roleIds.admin, password: passwords[ids.deputy] });
        check('Super Admin can be removed by another Super Admin', revoke.status === 200 && (await stored('users', ids.superAdmin)).role === roleIds.admin);
        // Temporarily hide any other Super Admins so the deputy is the last one, then restore them
        const [otherAdmins] = await db.query(`SELECT * FROM super_admins WHERE user_id <> ?`, [ids.deputy]);
        try {
            await db.query(`DELETE FROM super_admins WHERE user_id <> ?`, [ids.deputy]);
            await require('./server/roles').load();
            const last = await api('deputy', 'POST', '/api/super-admins/revoke', { userId: ids.deputy, newRole: roleIds.admin, password: passwords[ids.deputy] });
            check('The last Super Admin cannot be removed', last.status === 409);
        } finally {
            for (const row of otherAdmins) {
                await db.query(`INSERT IGNORE INTO super_admins (user_id, granted_by, granted_at) VALUES (?, ?, ?)`, [row.user_id, row.granted_by, row.granted_at]);
            }
            await require('./server/roles').load();
        }
        // Give the test Super Admin back its rights for the remaining checks
        await api('deputy', 'POST', '/api/super-admins', { userId: ids.superAdmin, password: passwords[ids.deputy] });
        sess.superAdmin = (await login(`${ids.superAdmin}@test.local`, passwords[ids.superAdmin])).cookie;

        // Preview: see the portal as a student, read-only, then return
        check('Only a Super Admin can preview roles', (await api('admin', 'POST', '/api/preview', { roleId: 'STUDENT' })).status === 403);
        const pv = await api('deputy', 'POST', '/api/preview', { roleId: 'STUDENT', userId: ids.s2 });
        const meP = await me('deputy');
        check('Preview shows the chosen role and person', pv.status === 200 && meP.preview && meP.preview.roleId === 'STUDENT' && meP.user.id === ids.s2 && meP.scope === 'SELF' && !meP.isSuperAdmin);
        const pvPull = (await request('GET', '/api/store', { cookie: sess.deputy })).body.collections || {};
        check('Preview data is what that student sees', !has(pvPull.users, ids.s1) && has(pvPull.users, ids.s2));
        const pvWrite = await request('POST', '/api/store/sync', { cookie: sess.deputy, body: { upserts: {} } });
        check('Nothing can be changed during a preview', pvWrite.status === 403 && pvWrite.body.previewReadOnly === true);
        await api('deputy', 'DELETE', '/api/preview');
        check('Leaving the preview restores the Super Admin view', (await me('deputy')).isSuperAdmin === true);
        const log3 = (await api('deputy', 'GET', '/api/audit?limit=200')).body.entries || [];
        check('Audit log records Super Admin grants, removals and previews',
            ['superadmin.grant', 'superadmin.revoke', 'preview.start', 'preview.end', 'user.roles_change'].every(a => log3.some(e => e.action === a)));

        // --- Three-role model: Super Admin controls everything, Admin only what it was given ---
        const stuId = `${P}saStudent`;
        const teaId = `${P}saTeacher`;
        const clsId = `${P}saClass`;
        const crsId = `${P}saCourse`;
        const saCreate = await sync('superAdmin', {
            users: [{ id: stuId, role: 'STUDENT', name: 'Sectest SA student', email: `${stuId}@test.local`, classId: ids.classA },
                { id: teaId, role: 'TEACHER', name: 'Sectest SA teacher', email: `${teaId}@test.local` }],
            classes: [{ id: clsId, name: 'Sectest SA class', courseTeachers: [] }],
            courses: [{ id: crsId, title: 'Sectest SA kitab', code: `${R}K1` }]
        });
        check('Super Admin can create students, teachers, classes and courses',
            ['users:' + stuId, 'users:' + teaId, 'classes:' + clsId, 'courses:' + crsId].every(k => { const [c, id] = k.split(':'); return accepted(saCreate, c, id); }), JSON.stringify(saCreate.body));
        const saEdit = await sync('superAdmin', {
            users: [{ ...(await stored('users', stuId)), name: 'Sectest SA student (edited)' }],
            classes: [{ ...(await stored('classes', clsId)), name: 'Sectest SA class (edited)' }],
            courses: [{ ...(await stored('courses', crsId)), title: 'Sectest SA kitab (edited)' }]
        });
        check('Super Admin can edit students, classes and courses', accepted(saEdit, 'users', stuId) && accepted(saEdit, 'classes', clsId) && accepted(saEdit, 'courses', crsId), JSON.stringify(saEdit.body));
        const saDecide = await request('PUT', `/api/admissions/${ids.admission}`, { cookie: sess.superAdmin, body: { status: 'APPROVED' } });
        check('Super Admin can decide admission applications', saDecide.status === 200, `(got ${saDecide.status})`);

        const adminDelStudent = await sync('admin', {}, { users: [stuId] });
        check('Admin cannot delete a student through the API', rejected(adminDelStudent, 'users', stuId) && !!(await stored('users', stuId)) && !(await stored('users', stuId))._deleted);
        const adminDelTeacher = await sync('admin', {}, { users: [teaId] });
        check('Admin cannot delete a teacher through the API', rejected(adminDelTeacher, 'users', teaId) && !(await stored('users', teaId))._deleted);
        const adminStaff = `${P}byAdmin`;
        check('Admin cannot create staff (Admin) accounts', rejected(await sync('admin', { users: [{ id: adminStaff, role: roleIds.admin, name: 'X', email: `${adminStaff}@test.local` }] }), 'users', adminStaff));
        const adminWork = await sync('admin', {
            users: [{ ...(await stored('users', stuId)), name: 'Sectest SA student (edited by Admin)' }],
            classes: [{ ...(await stored('classes', clsId)), room: 'Hall 2' }]
        });
        check('Admin can still edit students and classes it is allowed to', accepted(adminWork, 'users', stuId) && accepted(adminWork, 'classes', clsId), JSON.stringify(adminWork.body));
        check('Admin cannot purge recordings', (await api('admin', 'POST', '/api/virtual-class/cleanup', {})).status === 403);
        const adminDonations = (await request('GET', '/api/store', { cookie: sess.admin })).body.collections || {};
        check('Admin does not see who gave anonymous donations', (adminDonations.donations || []).some(d => d.id === ids.donation && d.donorName === 'Anonymous'));

        const saDelete = await sync('superAdmin', {}, { users: [stuId, teaId], classes: [clsId], courses: [crsId] });
        check('Super Admin can delete students, teachers, classes and courses',
            accepted(saDelete, 'users', stuId) && accepted(saDelete, 'users', teaId) && accepted(saDelete, 'classes', clsId) && accepted(saDelete, 'courses', crsId), JSON.stringify(saDelete.body));
        check('A deleted account keeps no password', !(await auth.getCredential(stuId)));

        // --- Institution setup: branches, departments, programmes, sessions, profile -----------
        check('Signed out: nobody can add a campus', (await request('POST', '/api/branches', { body: { code: `${R}X`, name: 'X' } })).status === 401);
        check('Admin cannot add a campus (institution setup is for the Super Admin)', (await api('admin', 'POST', '/api/branches', { code: `${R}X`, name: 'X' })).status === 403);
        const brNew = await api('superAdmin', 'POST', '/api/branches', { code: `${R}BR`, name: 'Sectest campus', city: 'Lahore', established: 2026 });
        const brId = brNew.body.id;
        check('Super Admin can add a campus', brNew.status === 201 && !!brId, JSON.stringify(brNew.body));
        check('Campus codes are unique', (await api('superAdmin', 'POST', '/api/branches', { code: `${R}BR`, name: 'Dup' })).status === 409);
        check('Campus fields are validated', (await api('superAdmin', 'PUT', `/api/branches/${brId}`, { established: 'abc' })).status === 400);
        await api('superAdmin', 'PUT', `/api/branches/${brId}`, { name: 'Sectest campus (renamed)' });
        const listed = ((await request('GET', '/api/branches')).body.branches || []).find(b => b.id === brId);
        check('Campus changes appear in the public list at once', !!listed && listed.name === 'Sectest campus (renamed)');
        check('Admin cannot delete a campus', (await api('admin', 'DELETE', `/api/branches/${brId}`)).status === 403);
        await insertRecord('classes', { id: `${P}clsBr`, name: 'Sectest class on campus', branchId: brId, courseTeachers: [] });
        const brInUse = await api('superAdmin', 'DELETE', `/api/branches/${brId}`);
        check('A campus that classes still use cannot be deleted', brInUse.status === 409 && /class/.test(brInUse.body.error || ''), JSON.stringify(brInUse.body));
        await db.query(`DELETE FROM lms_records WHERE id = ?`, [`${P}clsBr`]);
        check('An unused campus can be deleted', (await api('superAdmin', 'DELETE', `/api/branches/${brId}`)).status === 200
            && !((await request('GET', '/api/branches')).body.branches || []).some(b => b.id === brId));
        const dep = await api('superAdmin', 'POST', '/api/departments', { code: `${R}D`, name: 'Sectest department' });
        const prog = await api('superAdmin', 'POST', '/api/programs', { code: `${R}P`, name: 'Sectest programme', departmentId: dep.body.id, durationYears: 2 });
        check('Super Admin can add departments and programmes', dep.status === 201 && prog.status === 201, JSON.stringify([dep.body, prog.body]));
        check('A programme needs an existing department', (await api('superAdmin', 'POST', '/api/programs', { code: `${R}Q`, name: 'X', departmentId: `${P}none`, durationYears: 2 })).status === 400);
        check('A department with programmes cannot be deleted', (await api('superAdmin', 'DELETE', `/api/departments/${dep.body.id}`)).status === 409);
        check('Programmes and departments can be removed in order', (await api('superAdmin', 'DELETE', `/api/programs/${prog.body.id}`)).status === 200
            && (await api('superAdmin', 'DELETE', `/api/departments/${dep.body.id}`)).status === 200);
        check('A session must end after it starts', (await api('superAdmin', 'POST', '/api/sessions', { name: `${P}session`, startDate: '2031-01-01', endDate: '2030-01-01' })).status === 400);
        const current = ((await request('GET', '/api/sessions')).body.sessions || []).find(s => s.isCurrent);
        if (current) check('The current session cannot be deleted', (await api('superAdmin', 'DELETE', `/api/sessions/${current.id}`)).status === 409);
        check('Anyone can read the institution profile (public admission form)', (await request('GET', '/api/settings/institution')).status === 200);
        check('Admin cannot change the institution profile', (await api('admin', 'POST', '/api/settings/institution', { motto: 'x' })).status === 403);
        const prof = await api('superAdmin', 'POST', '/api/settings/institution', { motto: `${P}motto`, leadership: [{ office: 'Mohtamim', name: 'Sectest' }] });
        check('Super Admin can change the institution profile', prof.status === 200 && prof.body.institution.motto === `${P}motto` && prof.body.institution.leadership.length === 1);
        check('The main campus must exist', (await api('superAdmin', 'POST', '/api/settings/institution', { mainBranchId: `${P}none` })).status === 400);

        // --- Recording retention ---------------------------------------------------------------
        check('Admin cannot change recording retention', (await api('admin', 'POST', '/api/settings/recordings', { retentionDays: 30 })).status === 403);
        check('Retention periods are validated', (await api('superAdmin', 'POST', '/api/settings/recordings', { retentionDays: 45 })).status === 400);
        const recSet = await api('superAdmin', 'POST', '/api/settings/recordings', { allowStudentDownload: true });
        check('Super Admin can change recording settings', recSet.status === 200 && recSet.body.settings.allowStudentDownload === true);
        check('Recording storage use is computed from the recordings', typeof recSet.body.settings.usedBytes === 'number' && typeof recSet.body.settings.recordingCount === 'number');
        // The clean-up itself runs on test recordings only, so real recordings are never touched by the tests
        const recs = [
            { id: `${P}recOld`, title: 'old', recordedDate: '2020-01-01', fileSizeBytes: 10 },
            { id: `${P}recKeep`, title: 'kept', recordedDate: '2020-01-01', autoDeleteProtected: true },
            { id: `${P}recNew`, title: 'new', recordedDate: new Date().toISOString().slice(0, 10) }
        ];
        for (const r of recs) await insertRecord('virtualClassRecordings', r);
        const purge = await require('./server/master-data').cleanupRecordings({
            loadCollection: async () => recs, getSetting: async () => ({ retentionDays: 30 }), saveSetting: async () => {}
        }, { auth: { id: ids.superAdmin, role: 'SUPER_ADMIN' }, headers: {} });
        check('Retention clean-up removes only expired, unprotected recordings', purge.purgedCount === 1
            && (await stored('virtualClassRecordings', `${P}recOld`))._deleted
            && !(await stored('virtualClassRecordings', `${P}recKeep`))._deleted && !(await stored('virtualClassRecordings', `${P}recNew`))._deleted);

        // --- Admissions: numbering, campus check, deleting ------------------------------------
        const branch0 = ((await request('GET', '/api/branches')).body.branches || [])[0];
        const prog0 = ((await request('GET', '/api/programs')).body.programs || [])[0];
        const appBody = { name: `Sectest Applicant ${P}1`, fatherName: 'Sectest Father', phone: '+92 300 0000002', cnic: '35201-0000003-1', programId: prog0 && prog0.id };
        // Sent as office staff, who may record applications whatever the public admission window says
        check('An application needs an existing campus', (await api('superAdmin', 'POST', '/api/admissions', { ...appBody, branchId: `${P}none` })).status === 400);
        if (branch0 && prog0) {
            const app = await api('superAdmin', 'POST', '/api/admissions', { ...appBody, branchId: branch0.id });
            const appNo = app.body.record && app.body.record.applicationNo;
            check('Application numbers follow the current year', app.status === 201 && new RegExp(`^ASH-ADM-${new Date().getFullYear()}-\\d{3,}$`).test(appNo || ''), JSON.stringify(app.body));
            const [[notice]] = await db.query(`SELECT COUNT(*) AS n FROM notifications WHERE message LIKE ?`, [`%(${appNo})%`]);
            check('Admin cannot delete applications', (await api('admin', 'DELETE', `/api/admissions/${app.body.record.id}`)).status === 403);
            const appDel = await api('superAdmin', 'DELETE', `/api/admissions/${app.body.record.id}`);
            const [[gone]] = await db.query(`SELECT COUNT(*) AS n FROM student_admissions WHERE id = ?`, [app.body.record.id]);
            const [[noticeGone]] = await db.query(`SELECT COUNT(*) AS n FROM notifications WHERE message LIKE ?`, [`%(${appNo})%`]);
            check('Super Admin can delete an application, with its notice', appDel.status === 200 && !Number(gone.n) && Number(notice.n) === 1 && !Number(noticeGone.n));
        }

        // --- Sample data clean-up --------------------------------------------------------------
        const testAppId = `${P}testapp`;
        await db.query(`INSERT INTO student_admissions (id, application_no, candidate_name, father_name, phone, status) VALUES (?, ?, 'John Doe Test 424242', 'Richard Doe', '+44 0000', 'APPLIED')`, [testAppId, `${P}APP2`]);
        check('Admin cannot review sample data', (await api('admin', 'GET', '/api/admin/sample-data')).status === 403);
        const review = await api('superAdmin', 'GET', '/api/admin/sample-data');
        const offered = (review.body.groups || []).flatMap(g => g.records.map(r => `${g.kind}:${r.collection}:${r.id}`));
        check('Sample data review lists applications left by tests', offered.includes(`test:admissions:${testAppId}`), JSON.stringify(offered.slice(0, 5)));
        check('Sample data review never offers a Super Admin account', !offered.some(k => k.endsWith(`:users:${ids.superAdmin}`)) && !(review.body.groups || []).some(g => g.collection === 'users' && g.records.some(r => /SUPER_ADMIN/.test(r.label))));
        const removeRes = await api('superAdmin', 'POST', '/api/admin/sample-data/remove', { items: [{ collection: 'admissions', id: testAppId }, { collection: 'users', id: ids.s1 }] });
        const [[testAppGone]] = await db.query(`SELECT COUNT(*) AS n FROM student_admissions WHERE id = ?`, [testAppId]);
        check('Sample data clean-up removes what was offered and nothing else', removeRes.status === 200 && removeRes.body.total === 1 && !Number(testAppGone.n) && !(await stored('users', ids.s1))._deleted, JSON.stringify(removeRes.body));

        // --- Password reset, forced change, session revocation -----------------------------
        const tempPwd = auth.temporaryPassword(10);
        await sync('admin', { users: [{ ...(await stored('users', ids.s1)), password: tempPwd }] });
        check('Admin password reset ends the person\'s open sessions', (await request('GET', '/api/store', { cookie: sess.s1 })).status === 401);
        const relog = await login(`${ids.s1}@test.local`, tempPwd);
        check('Reset password works and must be changed', relog.status === 200 && relog.body.mustChangePassword === true);
        const blocked = await request('GET', '/api/store', { cookie: relog.cookie });
        check('Temporary password blocks the portal until changed', blocked.status === 403 && blocked.body.mustChangePassword === true);
        const badCurrent = await request('POST', '/api/auth/change-password', { cookie: relog.cookie, body: { currentPassword: 'nope', newPassword: 'NewPassword-1' } });
        const tooShort = await request('POST', '/api/auth/change-password', { cookie: relog.cookie, body: { currentPassword: tempPwd, newPassword: 'abc' } });
        check('Change password checks the current password and the policy', badCurrent.status === 400 && tooShort.status === 400);
        const changed = await request('POST', '/api/auth/change-password', { cookie: relog.cookie, body: { currentPassword: tempPwd, newPassword: 'NewPassword-1' } });
        check('Password change unlocks the portal', changed.status === 200 && (await request('GET', '/api/store', { cookie: relog.cookie })).status === 200);

        await sync('superAdmin', { users: [{ ...(await stored('users', ids.custom)), status: 'INACTIVE' }] });
        check('Deactivated account loses its session at once', (await request('GET', '/api/store', { cookie: sess.custom })).status === 401);

        // --- Virtual classes, notifications, logout ----------------------------------------
        const unknownVc = await request('POST', '/api/virtual-class/verify-access', { cookie: relog.cookie, body: { sessionId: `${P}none` } });
        check('Unknown online class is not authorised', unknownVc.status === 404 && !unknownVc.body.authorized);
        const otherVc = await request('POST', '/api/virtual-class/verify-access', { cookie: sess.t1, body: { sessionId: ids.vcB, role: 'SUPER_ADMIN' } });
        check('Teacher cannot open another class\'s online class', otherVc.status === 403);
        const okVc = await request('POST', '/api/virtual-class/verify-access', { cookie: sess.s2, body: { sessionId: ids.vcB } });
        check('Enrolled student can open their online class', okVc.status === 200 && okVc.body.authorized === true);

        await request('POST', '/api/notifications', { cookie: relog.cookie, body: { title: 'Notice', message: 'Hi', targetRole: 'ACADEMIC_ADMIN', senderName: 'Hazrat Mohtamim' } });
        const [notes] = await db.query(`SELECT sender_name FROM notifications WHERE sender_id = ? ORDER BY created_at DESC LIMIT 1`, [ids.s1]);
        check('Notices are signed with the sender\'s own name', notes.length && notes[0].sender_name === `Test ${ids.s1.slice(-6)}`);

        const upload = await request('GET', '/uploads/2026-10/does-not-exist.pdf', { cookie: sess.t2 });
        check('Signed-in users can reach uploads', upload.status === 404, `(got ${upload.status})`);

        await request('POST', '/api/auth/logout', { cookie: sess.t2 });
        check('Logout ends the session', (await request('GET', '/api/store', { cookie: sess.t2 })).status === 401);
    } catch (err) {
        failed++;
        console.error('[ERROR]', err);
    } finally {
        await cleanup(settingsBackup);
    }

    // How the live roles differ from the approved code defaults (configuration, not a test failure)
    try {
        const [rows] = await db.query(`SELECT role_id, permission FROM role_permissions WHERE role_id IN ('ACADEMIC_ADMIN', 'TEACHER', 'STUDENT')`);
        for (const roleId of ['ACADEMIC_ADMIN', 'TEACHER', 'STUDENT']) {
            const live = new Set(rows.filter(r => r.role_id === roleId).map(r => r.permission));
            const approved = new Set(catalog.DEFAULT_PERMISSIONS[roleId]);
            const extra = [...live].filter(k => !approved.has(k));
            const lacking = [...approved].filter(k => !live.has(k));
            console.log(extra.length || lacking.length
                ? `[CONFIG] Live ${roleId} differs from the approved defaults: +${extra.length} (${extra.join(', ') || '-'}) / -${lacking.length} (${lacking.join(', ') || '-'})`
                : `[CONFIG] Live ${roleId} matches the approved defaults`);
        }
    } catch (e) { /* the report is information only */ }

    console.log(`\n${passed} passed, ${failed} failed. Test data removed.`);
    process.exit(failed ? 1 : 0);
}

run();
