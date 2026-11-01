/**
 * Jamia Ashrafia LMS - Role location access tests ("All locations" / "Own locations only")
 *
 * Sets up three throw-away campuses with a class at each, a role for all locations and a role for own locations,
 * and accounts holding them, then checks through the real HTTP API with real sessions: who reaches which campus,
 * who may create or switch a role to all locations, who may give such a role to someone, that switching a role
 * moves its holders' accounts along, teacher types, and the one-time setting of roles made before this option
 * (nobody's access may change). Everything created is removed (ids start with "loctest_").
 *
 *   npm run test:locations
 */

const http = require('http');
const db = require('./database/db');
const auth = require('./server/auth');
const catalog = require('./server/permissions');

const TEST_PORT = 3059;
process.env.PORT = TEST_PORT;

const P = `loctest_${Date.now().toString(36)}_`;
const R = P.toUpperCase();
const B = { A: `${P}bA`, B: `${P}bB`, C: `${P}bC` };
const ROLE_ALL = `${R}ALLROLE`;
const ROLE_OWN = `${R}OWNROLE`;
const ids = {
    super: `${P}super`, allUser: `${P}all`, ownUser: `${P}own`, clsA: `${P}clsA`, clsB: `${P}clsB`, clsC: `${P}clsC`,
    newByOwn: `${P}newbyown`, newByAll: `${P}newbyall`, teacher: `${P}teacher`,
    legacyAll: `${P}legacyall`, legacyMixedAll: `${P}lmall`, legacyMixedOwn: `${P}lmown`
};
const passwords = {};
const cookies = {};
let passed = 0;
let failed = 0;

function check(name, ok, detail) {
    if (ok) { passed++; console.log(`[PASS] ${name}`); }
    else { failed++; console.log(`[FAIL] ${name}${detail !== undefined ? ` -> ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`); }
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
const as = (who, method, path, body) => request(method, path, { cookie: cookies[who], body });

async function insertRecord(collection, rec) {
    await db.query(
        `INSERT INTO lms_records (collection, id, data, deleted, updated_by, updated_at) VALUES (?, ?, ?, 0, 'loctest', NOW(3))
         ON DUPLICATE KEY UPDATE data = VALUES(data), deleted = 0`,
        [collection, rec.id, JSON.stringify(rec)]
    );
}

async function stored(collection, id) {
    const [rows] = await db.query(`SELECT data FROM lms_records WHERE collection = ? AND id = ?`, [collection, id]);
    return rows.length ? JSON.parse(rows[0].data) : null;
}

async function createUser(id, fields) {
    await insertRecord('users', { id, status: 'ACTIVE', name: `Loc ${id.slice(-6)}`, email: `${id}@test.local`, ...fields });
    if (fields.role === 'SUPER_ADMIN') await db.query(`INSERT IGNORE INTO super_admins (user_id, granted_by) VALUES (?, 'loctest')`, [id]);
    passwords[id] = auth.temporaryPassword(12);
    await auth.setPassword(null, id, passwords[id], false);
}

async function login(id) {
    const r = await request('POST', '/api/auth/login', { body: { identifier: `${id}@test.local`, password: passwords[id] } });
    const set = [].concat(r.headers['set-cookie'] || []).find(c => c.startsWith(`${auth.COOKIE_NAME}=`));
    return set ? set.split(';')[0] : null;
}

async function campusesOf(who) {
    const r = await as(who, 'GET', '/api/auth/me');
    return r.body.campuses;
}

async function classesSeen(who) {
    const r = await as(who, 'GET', '/api/store');
    return new Set((r.body.collections.classes || []).map(c => c.id).filter(id => id.startsWith(P)));
}

async function cleanup() {
    const like = `${P}%`;
    await db.query(`DELETE FROM lms_records WHERE id LIKE ?`, [like]);
    await db.query(`DELETE FROM user_credentials WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM auth_sessions WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM super_admins WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM user_roles WHERE user_id LIKE ? OR role_id LIKE ?`, [like, `${R}%`]);
    await db.query(`DELETE FROM role_permissions WHERE role_id LIKE ?`, [`${R}%`]);
    await db.query(`DELETE FROM roles WHERE id LIKE ?`, [`${R}%`]);
    await db.query(`DELETE FROM branches WHERE id LIKE ?`, [like]);
    await db.query(`DELETE FROM audit_log WHERE entity_id LIKE ? OR actor_id LIKE ? OR summary LIKE ?`, [like, like, `%${R}%`]);
    await require('./server/roles').load();
}

async function run() {
    if (!(await db.testConnection())) process.exit(1);
    require('./server');
    await new Promise(r => setTimeout(r, 1500));
    await require('./server/lms-api').ensureSchema();
    const roles = require('./server/roles');
    try {
        for (const [key, id] of Object.entries(B)) {
            await db.query(`INSERT INTO branches (id, code, name, address, city) VALUES (?, ?, ?, 'Test address', 'Lahore')`, [id, `${R}${key}`, `Loctest campus ${key}`]);
        }
        await createUser(ids.super, { role: 'SUPER_ADMIN' });
        await insertRecord('classes', { id: ids.clsA, name: 'Loctest A', branchId: B.A, courseTeachers: [] });
        await insertRecord('classes', { id: ids.clsB, name: 'Loctest B', branchId: B.B, courseTeachers: [] });
        await insertRecord('classes', { id: ids.clsC, name: 'Loctest C', branchId: B.C, courseTeachers: [] });
        await roles.load();
        cookies.super = await login(ids.super);

        // --- Creating roles with a location choice
        const perms = catalog.DEFAULT_PERMISSIONS.ACADEMIC_ADMIN.concat(['roles.view', 'roles.create', 'roles.update', 'users.create']);
        let r = await as('super', 'POST', '/api/roles', { id: ROLE_ALL, name: 'Loctest All', scope: 'ALL', campusScope: 'ALL', permissions: perms });
        check('A role can be created for all locations', r.status === 200 && r.body.role && r.body.role.campusScope === 'ALL', r.body);
        r = await as('super', 'POST', '/api/roles', { id: ROLE_OWN, name: 'Loctest Own', scope: 'ALL', campusScope: 'OWN', permissions: perms });
        check('A role can be created for own locations only', r.status === 200 && r.body.role && r.body.role.campusScope === 'OWN', r.body);
        r = await as('super', 'GET', '/api/roles');
        check('The roles list shows each role\'s location access', (r.body.roles || []).some(x => x.id === ROLE_ALL && x.campusScope === 'ALL') && (r.body.roles || []).some(x => x.id === ROLE_OWN && x.campusScope === 'OWN'));

        await createUser(ids.allUser, { role: ROLE_ALL, branchId: B.A, campusIds: [B.A], allCampuses: false });
        await createUser(ids.ownUser, { role: ROLE_OWN, branchId: B.A, campusIds: [B.A], allCampuses: true });
        cookies.allUser = await login(ids.allUser);
        cookies.ownUser = await login(ids.ownUser);

        // --- Who reaches which campus
        let c = await campusesOf('allUser');
        check('All locations: the person reaches every campus (even with one campus on the account)', c && c.all === true, c);
        c = await campusesOf('ownUser');
        check('Own locations: the person reaches only their assigned campus (an old "all campuses" tick no longer counts)', c && c.all === false && c.ids.length === 1 && c.ids[0] === B.A, c);
        let seen = await classesSeen('allUser');
        check('All locations: classes of every campus are visible', seen.has(ids.clsA) && seen.has(ids.clsB) && seen.has(ids.clsC), Array.from(seen));
        seen = await classesSeen('ownUser');
        check('Own locations: only classes of the assigned campus are visible', seen.has(ids.clsA) && !seen.has(ids.clsB) && !seen.has(ids.clsC), Array.from(seen));
        r = await as('ownUser', 'POST', '/api/store/sync', { upserts: { classes: [{ id: ids.clsB, name: 'Loctest B renamed', branchId: B.B, courseTeachers: [] }] } });
        check('Own locations: a class at another campus cannot be changed', (r.body.rejected.classes || []).includes(ids.clsB), r.body);

        // A second campus on the account widens an own-locations person
        r = await as('super', 'POST', '/api/store/sync', { upserts: { users: [{ ...(await stored('users', ids.ownUser)), campusIds: [B.A, B.B] }] } });
        check('Campuses can be added to an own-locations account', (r.body.accepted.users || []).includes(ids.ownUser), r.body);
        seen = await classesSeen('ownUser');
        check('… and the person then reaches exactly those campuses', seen.has(ids.clsA) && seen.has(ids.clsB) && !seen.has(ids.clsC), Array.from(seen));
        check('The account keeps "every campus" off while its role is own locations', (await stored('users', ids.ownUser)).allCampuses === false);

        // --- Who may give all-locations access
        r = await as('ownUser', 'POST', '/api/roles', { id: `${R}SNEAKY`, name: 'Loctest sneaky', scope: 'ALL', campusScope: 'ALL', permissions: ['users.view'] });
        check('Someone without every location cannot create an all-locations role', r.status === 403, r.body);
        r = await as('ownUser', 'POST', '/api/roles', { id: `${R}NARROW`, name: 'Loctest narrow', scope: 'ALL', campusScope: 'OWN', permissions: ['users.view'] });
        check('… but can create an own-locations role', r.status === 200 && r.body.role.campusScope === 'OWN', r.body);
        r = await as('ownUser', 'PUT', `/api/roles/${R}NARROW`, { version: r.body.role && r.body.role.version, campusScope: 'ALL' });
        check('… and cannot switch a role to all locations', r.status === 403, r.body);
        r = await as('ownUser', 'POST', '/api/store/sync', { upserts: { users: [{ id: ids.newByOwn, name: 'Loctest new', email: `${ids.newByOwn}@test.local`, role: ROLE_ALL, status: 'ACTIVE', branchId: B.A, campusIds: [B.A] }] } });
        check('Someone without every location cannot give a person an all-locations role', (r.body.rejected.users || []).includes(ids.newByOwn)
            && /every campus|all campuses/i.test(((r.body.errors || {}).users || {})[ids.newByOwn] || ''), r.body);
        r = await as('allUser', 'POST', '/api/store/sync', { upserts: { users: [{ id: ids.newByAll, name: 'Loctest new 2', email: `${ids.newByAll}@test.local`, role: ROLE_ALL, status: 'ACTIVE', branchId: B.A, campusIds: [B.A] }] } });
        const newRec = await stored('users', ids.newByAll);
        check('Someone with every location can, and the new account is marked every campus', (r.body.accepted.users || []).includes(ids.newByAll) && newRec && newRec.allCampuses === true, r.body);

        // --- Switching a role moves its holders
        let role = (await as('super', 'GET', '/api/roles')).body.roles.find(x => x.id === ROLE_OWN);
        r = await as('super', 'PUT', `/api/roles/${ROLE_OWN}`, { version: role.version, campusScope: 'ALL' });
        check('The Super Admin switches a role to all locations', r.status === 200 && r.body.role.campusScope === 'ALL', r.body);
        check('Its holders\' accounts follow (every campus)', (await stored('users', ids.ownUser)).allCampuses === true);
        c = await campusesOf('ownUser');
        seen = await classesSeen('ownUser');
        check('… and they reach every campus at once', c.all === true && seen.has(ids.clsC), c);
        role = (await as('super', 'GET', '/api/roles')).body.roles.find(x => x.id === ROLE_OWN);
        r = await as('super', 'PUT', `/api/roles/${ROLE_OWN}`, { version: role.version, campusScope: 'OWN' });
        const back = await stored('users', ids.ownUser);
        check('Switching back to own locations returns them to the campuses on their account', r.status === 200 && back.allCampuses === false
            && back.campusIds.includes(B.A) && back.campusIds.includes(B.B) && !back.campusIds.includes(B.C), back);
        seen = await classesSeen('ownUser');
        check('… and they no longer reach the other campus', !seen.has(ids.clsC), Array.from(seen));
        const [logs] = await db.query(`SELECT summary FROM audit_log WHERE entity_id = ? AND action = 'role.update' ORDER BY id DESC LIMIT 1`, [ROLE_OWN]);
        check('The change is in the audit log', logs.length && /locations all locations → own locations/.test(logs[0].summary), logs);

        // --- Teacher types
        r = await as('super', 'POST', '/api/permission-groups/teachers', { id: `${R}TT`, name: 'Loctest teacher type', campusScope: 'ALL', permissions: ['classes.view'] });
        check('A teacher type can be set to all locations', r.status === 200 && (r.body.role || r.body.group || {}).campusScope === 'ALL', r.body);
        await createUser(ids.teacher, { role: 'TEACHER', branchId: B.A, campusIds: [B.A], allCampuses: false });
        r = await as('super', 'PUT', `/api/permission-groups/teachers/members/${encodeURIComponent(ids.teacher)}`, { group: `${R}TT` });
        check('The teacher is moved to that type, and the account follows', r.status === 200 && (await stored('users', ids.teacher)).allCampuses === true, r.body);
        cookies.teacher = await login(ids.teacher);
        c = await campusesOf('teacher');
        check('A teacher of that type reaches every campus', c && c.all === true, { status: r.status, c });

        // --- Roles made before this option: their holders keep exactly the access they had
        await db.query(`INSERT INTO roles (id, name, scope, is_system, status, version, updated_by) VALUES (?, 'Loctest legacy all', 'ALL', 0, 'ACTIVE', 1, 'loctest')`, [`${R}LEGALL`]);
        await db.query(`INSERT INTO roles (id, name, scope, is_system, status, version, updated_by) VALUES (?, 'Loctest legacy mixed', 'ALL', 0, 'ACTIVE', 1, 'loctest')`, [`${R}LEGMIX`]);
        await createUser(ids.legacyAll, { role: `${R}LEGALL`, branchId: B.A, allCampuses: true, campusIds: [] });
        await createUser(ids.legacyMixedAll, { role: `${R}LEGMIX`, branchId: B.A, allCampuses: true, campusIds: [] });
        await createUser(ids.legacyMixedOwn, { role: `${R}LEGMIX`, branchId: B.B, allCampuses: false, campusIds: [B.B] });
        await roles.load();
        const reachBefore = {};
        for (const id of [ids.legacyAll, ids.legacyMixedAll, ids.legacyMixedOwn]) {
            cookies[id] = await login(id);
            reachBefore[id] = await classesSeen(id);
        }
        check('Before: a role without the setting follows each account', reachBefore[ids.legacyMixedAll].has(ids.clsC) && !reachBefore[ids.legacyMixedOwn].has(ids.clsA));
        await roles.settleCampusScopes();
        const legacy = (await as('super', 'GET', '/api/roles')).body.roles;
        check('A role whose holders all had every campus becomes all locations', legacy.find(x => x.id === `${R}LEGALL`).campusScope === 'ALL');
        check('A role with mixed holders becomes own locations', legacy.find(x => x.id === `${R}LEGMIX`).campusScope === 'OWN');
        const keptAll = await stored('users', ids.legacyMixedAll);
        check('A holder who had every campus keeps them as an explicit list', keptAll.allCampuses === false && [B.A, B.B, B.C].every(b => keptAll.campusIds.includes(b)), keptAll);
        let same = true;
        for (const id of [ids.legacyAll, ids.legacyMixedAll, ids.legacyMixedOwn]) {
            const after = await classesSeen(id);
            if (after.size !== reachBefore[id].size || [...after].some(x => !reachBefore[id].has(x))) same = false;
        }
        check('Nobody\'s access changed when the setting was filled in', same);
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
