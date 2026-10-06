/**
 * JAMIA ASHRAFIA LAHORE - ROLES STORE
 *
 * Tables: roles, role_permissions, permissions (a read-only mirror of the catalog for reporting).
 * The first start after this upgrade imports the roles that existed before (system_settings keys
 * roleDefinitions / rolePermissions, which are kept untouched as a backup), giving each role the
 * permissions that reproduce what it could already do.
 *
 * People hold roles through user_roles (their main role, kept on the user record as `role`, plus any additional
 * roles). Their permissions are the union of all their roles; each permission keeps the widest data scope among
 * the roles that grant it, so a teacher who is also Librarian manages all loans but still marks only their classes.
 *
 * Super Admin holds every permission with whole-institution scope, in code. Who is Super Admin is recorded in
 * the super_admins table, changed only through grantSuperAdmin / revokeSuperAdmin (password re-entry, audited,
 * and there is always at least one).
 */

const db = require('../database/db');
const catalog = require('./permissions');
const audit = require('./audit');
const auth = require('./auth');

const SUPER_ADMIN = 'SUPER_ADMIN';
const CORE_ROLE_IDS = Object.keys(catalog.SYSTEM_ROLES);
const ROLE_ID_PATTERN = /^[A-Z][A-Z0-9_]{1,59}$/;
const BADGES = ['gold', 'primary', 'success', 'info', 'warning'];

// Module switches each role had by default before roles were stored in the database
const LEGACY_DEFAULT_MODULES = {
    STUDENT: ['classes', 'assignments', 'exams', 'timetable', 'virtual_class', 'notifications', 'library', 'attendance', 'fees', 'heritage'],
    TEACHER: ['classes', 'assignments', 'exams', 'timetable', 'virtual_class', 'notifications', 'library', 'teachers', 'students', 'attendance', 'heritage'],
    ACADEMIC_ADMIN: ['classes', 'assignments', 'exams', 'timetable', 'virtual_class', 'notifications', 'library', 'teachers', 'students',
        'attendance', 'reports', 'roles', 'admissions', 'heritage'],
    ACCOUNTANT: ['notifications', 'attendance', 'reports', 'fees', 'heritage']
};
// Which catalog modules an old module switch covered
const LEGACY_MODULE_TO_CATALOG = {
    students: ['students'], teachers: ['teachers'], classes: ['classes'], timetable: ['timetable'], attendance: ['attendance'],
    assignments: ['assignments'], exams: ['exams'], virtual_class: ['virtual_classes'], library: ['library'],
    fees: ['fees', 'donations'], admissions: ['admissions'], reports: ['reports'], roles: ['roles'], users: ['users'],
    heritage: ['general'], security: ['settings']
};
// Permissions everyone in the role keeps whatever modules were switched off (receiving and own giving)
const ALWAYS_KEPT = new Set(['donations.give', 'attendance.self_checkin', 'notifications.send_individual']);

let cache = null; // Map id -> role
let assignments = new Map(); // user id -> [role ids] (main role first)
let superAdmins = new Set(); // user ids

// ---------------------------------------------------------------------------
// Schema & import
// ---------------------------------------------------------------------------

async function ensureRolesSchema() {
    await db.query(`CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(60) PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        urdu_title VARCHAR(120) NULL,
        badge_class VARCHAR(20) NOT NULL DEFAULT 'info',
        description TEXT NULL,
        scope VARCHAR(16) NOT NULL DEFAULT 'ALL',
        is_system TINYINT(1) NOT NULL DEFAULT 0,
        status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
        version INT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        updated_by VARCHAR(120) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await db.query(`CREATE TABLE IF NOT EXISTS role_permissions (
        role_id VARCHAR(60) NOT NULL,
        permission VARCHAR(80) NOT NULL,
        PRIMARY KEY (role_id, permission)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await db.query(`CREATE TABLE IF NOT EXISTS permissions (
        perm_key VARCHAR(80) PRIMARY KEY,
        module VARCHAR(40) NOT NULL,
        label VARCHAR(160) NOT NULL,
        dangerous TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    // Mirror of the catalog (code is the source of truth)
    await db.query(`DELETE FROM permissions`);
    for (const p of catalog.CATALOG) {
        await db.query(`INSERT INTO permissions (perm_key, module, label, dangerous) VALUES (?, ?, ?, ?)`, [p.key, p.module, p.label, p.dangerous ? 1 : 0]);
    }

    await db.query(`CREATE TABLE IF NOT EXISTS user_roles (
        user_id VARCHAR(120) NOT NULL,
        role_id VARCHAR(60) NOT NULL,
        is_primary TINYINT(1) NOT NULL DEFAULT 0,
        scope_type VARCHAR(20) NOT NULL DEFAULT 'GLOBAL',
        scope_id VARCHAR(120) NOT NULL DEFAULT '',
        granted_by VARCHAR(120) NULL,
        granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, role_id, scope_type, scope_id),
        INDEX idx_user_roles_role (role_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await db.query(`CREATE TABLE IF NOT EXISTS super_admins (
        user_id VARCHAR(120) PRIMARY KEY,
        granted_by VARCHAR(120) NULL,
        granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    const [[{ n }]] = await db.query(`SELECT COUNT(*) AS n FROM roles`);
    if (!Number(n)) await importLegacyRoles();
    await ensureSystemRoles();
    await seedTemplatesOnce();
    await backfillAssignments();
    await load();
    // Another server process (or a direct database change) may edit roles; pick that up within seconds
    if (!reloadTimer) reloadTimer = setInterval(() => load().catch(() => {}), 15000);
    if (reloadTimer.unref) reloadTimer.unref();
}
let reloadTimer = null;

async function getSettingJson(key) {
    const [rows] = await db.query(`SELECT setting_value FROM system_settings WHERE setting_key = ?`, [key]);
    if (!rows.length) return null;
    try { return JSON.parse(rows[0].setting_value); } catch (e) { return null; }
}

// Permissions that reproduce a role's old access: its built-in defaults limited to the modules that were
// switched on, plus read access for modules switched on beyond its defaults
function legacyPermissionsFor(roleId, moduleMap) {
    const enabled = moduleMap
        ? Object.keys(moduleMap).filter(m => moduleMap[m] === true)
        : (LEGACY_DEFAULT_MODULES[roleId] || []);
    const enabledCatalogModules = new Set(enabled.flatMap(m => LEGACY_MODULE_TO_CATALOG[m] || []));
    const result = new Set();
    const defaults = catalog.DEFAULT_PERMISSIONS[roleId];
    if (defaults) {
        defaults.forEach(key => {
            const p = catalog.CATALOG.find(c => c.key === key);
            const mod = p ? p.module : '';
            // Modules that never had a switch (settings, notifications) stay as they were
            const hadSwitch = Object.values(LEGACY_MODULE_TO_CATALOG).some(list => list.includes(mod));
            if (ALWAYS_KEPT.has(key) || !hadSwitch || enabledCatalogModules.has(mod)) result.add(key);
        });
    }
    enabled.forEach(m => (catalog.LEGACY_MODULE_PERMISSIONS[m] || []).forEach(k => {
        // Old switches only opened pages; for Teacher / Student never beyond their portal
        if (catalog.ROLE_CEILING[roleId] && !catalog.ROLE_CEILING[roleId].has(k)) return;
        result.add(k);
    }));
    return Array.from(result).filter(catalog.isKnown);
}

async function importLegacyRoles() {
    const defs = (await getSettingJson('roleDefinitions')) || [];
    const moduleMaps = (await getSettingJson('rolePermissions')) || {};
    const oldFormat = Object.values(moduleMaps).some(p => p && typeof p === 'object' && 'permissions' in p);
    const [userRows] = await db.query(`SELECT JSON_UNQUOTE(JSON_EXTRACT(data, '$.role')) AS role FROM lms_records WHERE collection = 'users' AND deleted = 0`);
    const ids = new Set([...CORE_ROLE_IDS, ...defs.map(d => d && d.id), ...Object.keys(moduleMaps), ...userRows.map(r => r.role)]);
    ids.delete(SUPER_ADMIN);
    ids.delete(null);
    ids.delete(undefined);
    ids.delete('');

    for (const id of ids) {
        if (!ROLE_ID_PATTERN.test(id)) continue;
        const def = defs.find(d => d && d.id === id) || {};
        const sys = catalog.SYSTEM_ROLES[id] || {};
        const legacyAccountant = id === 'ACCOUNTANT' ? {
            name: 'Finance Officer (Accountant)', urduTitle: 'ناظم مالیات', badgeClass: 'warning',
            description: 'Fee structures, challans, payment verification and the donations ledger.'
        } : {};
        const role = {
            id,
            name: def.name || def.title || sys.name || legacyAccountant.name || id.replace(/_/g, ' '),
            urduTitle: def.urduTitle || sys.urduTitle || legacyAccountant.urduTitle || '',
            badgeClass: BADGES.includes(def.badgeClass) ? def.badgeClass : (sys.badgeClass || legacyAccountant.badgeClass || 'info'),
            description: def.description || sys.description || legacyAccountant.description || '',
            scope: sys.scope || 'ALL',
            isSystem: CORE_ROLE_IDS.includes(id)
        };
        // The old server merged saved switches over its defaults (and gave Admin the Roles page after an older format)
        const saved = moduleMaps[id] && typeof moduleMaps[id] === 'object' ? moduleMaps[id] : null;
        const defaultsMap = Object.fromEntries((LEGACY_DEFAULT_MODULES[id] || []).map(m => [m, true]));
        const merged = saved || LEGACY_DEFAULT_MODULES[id] ? { ...defaultsMap, ...(saved || {}) } : null;
        if (merged && oldFormat && id === 'ACADEMIC_ADMIN') merged.roles = true;
        const permissions = legacyPermissionsFor(id, merged);
        await insertRole(role, permissions, 'import');
        await audit.log({
            actor: { id: 'system', role: 'SYSTEM' }, action: 'role.import', entityType: 'role', entityId: id,
            summary: `Imported role ${role.name} with ${permissions.length} permission(s)`,
            before: { modules: moduleMaps[id] || null }, after: { scope: role.scope, permissions }
        });
    }
    console.log(`[Roles] Imported ${ids.size} role(s) into the roles table (old settings kept as backup)`);
}

// Admin, Teacher and Student always exist
async function ensureSystemRoles() {
    for (const id of CORE_ROLE_IDS) {
        const [rows] = await db.query(`SELECT id FROM roles WHERE id = ?`, [id]);
        if (rows.length) {
            await db.query(`UPDATE roles SET is_system = 1, scope = ? WHERE id = ?`, [catalog.SYSTEM_ROLES[id].scope, id]);
            continue;
        }
        const sys = catalog.SYSTEM_ROLES[id];
        await insertRole({ id, ...sys, isSystem: true }, catalog.DEFAULT_PERMISSIONS[id], 'system');
    }
}

// Examination Officer and Librarian are created once; deleting them later is respected.
// The Accountant role is renamed Finance Officer unless an administrator already gave it another name.
async function seedTemplatesOnce() {
    const [done] = await db.query(`SELECT setting_value FROM system_settings WHERE setting_key = 'roleTemplatesSeeded'`);
    if (done.length) return;
    for (const [id, t] of Object.entries(catalog.TEMPLATE_ROLES)) {
        const [rows] = await db.query(`SELECT id FROM roles WHERE id = ?`, [id]);
        if (rows.length) continue;
        await insertRole({ id, ...t, isSystem: false }, t.permissions.filter(catalog.isKnown), 'template');
        await audit.log({ actor: { id: 'system', role: 'SYSTEM' }, action: 'role.create', entityType: 'role', entityId: id, summary: `Created template role ${t.name}`, after: { scope: t.scope, permissions: t.permissions } });
    }
    const [acct] = await db.query(`SELECT name FROM roles WHERE id = 'ACCOUNTANT'`);
    if (acct.length && /^(Accountant|Accountant \/ Donor|Accountant \(Nazim-e-Maliyat \/ Donor\))$/i.test(String(acct[0].name).trim())) {
        await db.query(`UPDATE roles SET name = 'Finance Officer (Accountant)', urdu_title = 'ناظم مالیات', version = version + 1, updated_by = 'system' WHERE id = 'ACCOUNTANT'`);
        await audit.log({ actor: { id: 'system', role: 'SYSTEM' }, action: 'role.update', entityType: 'role', entityId: 'ACCOUNTANT', summary: 'Renamed Accountant / Donor to Finance Officer (Accountant)', before: { name: acct[0].name }, after: { name: 'Finance Officer (Accountant)' } });
    }
    await db.query(`INSERT INTO system_settings (setting_key, setting_value) VALUES ('roleTemplatesSeeded', 'true')`);
}

// Every account gets its main role as a user_roles row; existing Super Admin accounts become super_admins rows
async function backfillAssignments() {
    const [users] = await db.query(
        `SELECT id, JSON_UNQUOTE(JSON_EXTRACT(data, '$.role')) AS role FROM lms_records WHERE collection = 'users' AND deleted = 0`
    );
    const [[{ admins }]] = await db.query(`SELECT COUNT(*) AS admins FROM super_admins`);
    for (const u of users) {
        const role = String(u.role || '').toUpperCase();
        if (role === SUPER_ADMIN) {
            if (!Number(admins)) await db.query(`INSERT IGNORE INTO super_admins (user_id, granted_by) VALUES (?, 'migration')`, [u.id]);
            continue;
        }
        if (!role) continue;
        const [has] = await db.query(`SELECT 1 FROM user_roles WHERE user_id = ? AND is_primary = 1 LIMIT 1`, [u.id]);
        if (!has.length) {
            await db.query(`INSERT IGNORE INTO user_roles (user_id, role_id, is_primary, granted_by) VALUES (?, ?, 1, 'migration')`, [u.id, role]);
        }
    }
}

async function insertRole(role, permissions, by) {
    await db.query(
        `INSERT INTO roles (id, name, urdu_title, badge_class, description, scope, is_system, status, version, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, ?)`,
        [role.id, role.name, role.urduTitle || '', role.badgeClass || 'info', role.description || '', role.scope || 'ALL', role.isSystem ? 1 : 0, by]
    );
    for (const p of new Set(permissions)) {
        await db.query(`INSERT IGNORE INTO role_permissions (role_id, permission) VALUES (?, ?)`, [role.id, p]);
    }
}

// ---------------------------------------------------------------------------
// Cache & effective permissions
// ---------------------------------------------------------------------------

async function load() {
    const [rows] = await db.query(`SELECT * FROM roles`);
    const [perms] = await db.query(`SELECT role_id, permission FROM role_permissions`);
    const next = new Map();
    rows.forEach(r => next.set(r.id, {
        id: r.id,
        name: r.name,
        urduTitle: r.urdu_title || '',
        badgeClass: r.badge_class,
        description: r.description || '',
        scope: catalog.SCOPES[r.scope] ? r.scope : 'SELF',
        isSystem: !!r.is_system,
        status: r.status,
        version: r.version,
        updatedAt: r.updated_at,
        granted: new Set()
    }));
    perms.forEach(p => { const r = next.get(p.role_id); if (r && catalog.isKnown(p.permission)) r.granted.add(p.permission); });
    next.forEach(r => { r.permissions = catalog.expand(Array.from(r.granted)); });
    cache = next;

    const [ur] = await db.query(`SELECT user_id, role_id, is_primary FROM user_roles ORDER BY is_primary DESC, granted_at ASC`);
    const nextAssignments = new Map();
    ur.forEach(row => {
        const list = nextAssignments.get(row.user_id) || [];
        if (!list.includes(row.role_id)) list.push(row.role_id);
        nextAssignments.set(row.user_id, list);
    });
    assignments = nextAssignments;
    const [sa] = await db.query(`SELECT user_id FROM super_admins`);
    superAdmins = new Set(sa.map(r => r.user_id));
    return cache;
}

function getRole(id) {
    return cache ? cache.get(id) || null : null;
}

const ALL_PERMISSIONS = new Set(catalog.CATALOG.map(p => p.key));
const ALL_SCOPES = new Map(catalog.CATALOG.map(p => [p.key, 'ALL']));

// Super Admin needs both: the account's role says so, and the protected super_admins table confirms it
function isSuperAdminUser(user) {
    return !!user && String(user.role || '').toUpperCase() === SUPER_ADMIN && superAdmins.has(user.id);
}

// Roles a person holds: the main role on their record first, then additional roles from user_roles
function rolesOfUser(user) {
    if (!user) return [];
    const main = String(user.role || '').toUpperCase();
    const extra = (assignments.get(user.id) || []).filter(id => id !== main && id !== SUPER_ADMIN);
    return (main && main !== SUPER_ADMIN ? [main] : []).concat(extra);
}

function additionalRolesOf(user) {
    return rolesOfUser(user).slice(String(user && user.role || '').toUpperCase() === SUPER_ADMIN ? 0 : 1);
}

/**
 * What a user may do: { roleId, roleIds, scope, scopes: Map(permission -> scope), permissions:Set, isSuperAdmin }
 * opts.onlyRole limits it to one role (used when previewing a role).
 */
function effectiveFor(user, opts = {}) {
    const main = String((user && user.role) || '').toUpperCase();
    if (!opts.onlyRole && isSuperAdminUser(user)) {
        return { roleId: SUPER_ADMIN, roleIds: [SUPER_ADMIN], scope: 'ALL', scopes: ALL_SCOPES, permissions: ALL_PERMISSIONS, isSuperAdmin: true };
    }
    const roleIds = opts.onlyRole ? [opts.onlyRole] : rolesOfUser(user);
    const scopes = new Map();
    roleIds.forEach(id => {
        const role = getRole(id);
        // Unknown or switched-off roles give nothing
        if (!role || role.status !== 'ACTIVE') return;
        role.permissions.forEach(p => {
            const current = scopes.get(p);
            if (!current || catalog.SCOPE_RANK[role.scope] > catalog.SCOPE_RANK[current]) scopes.set(p, role.scope);
        });
    });
    const mainRole = getRole(opts.onlyRole || main);
    return {
        roleId: opts.onlyRole || main,
        roleIds,
        // The main role decides which portal the person uses
        scope: mainRole && mainRole.status === 'ACTIVE' ? mainRole.scope : 'SELF',
        scopes,
        permissions: new Set(scopes.keys()),
        isSuperAdmin: false
    };
}

// Effective permissions for a signed-in session (a Super Admin previewing a role sees only that role)
function effectiveForAuth(a) {
    if (!a) return effectiveFor(null);
    return a.preview ? effectiveFor(a.user, { onlyRole: a.preview.roleId }) : effectiveFor(a.user);
}

// ---------------------------------------------------------------------------
// Who is more powerful
// ---------------------------------------------------------------------------

// Power over others: permissions held with more than own-records scope, leaving out self-service ones
function authorityOf(eff) {
    const out = new Map();
    eff.scopes.forEach((scope, p) => {
        if (catalog.SELF_SERVICE.has(p) || scope === 'SELF') return;
        out.set(p, catalog.SCOPE_RANK[scope]);
    });
    return out;
}

function roleAuthority(role) {
    const out = new Map();
    if (!role || role.scope === 'SELF') return out;
    role.permissions.forEach(p => { if (!catalog.SELF_SERVICE.has(p)) out.set(p, catalog.SCOPE_RANK[role.scope]); });
    return out;
}

// Permissions in `target` the actor lacks (or holds only with a narrower scope)
function missingAuthority(actorEff, target) {
    if (actorEff.isSuperAdmin) return [];
    const mine = authorityOf(actorEff);
    const missing = [];
    target.forEach((rank, p) => { if (!mine.has(p) || mine.get(p) < rank) missing.push(p); });
    return missing;
}

function canManagePerson(actorEff, targetUser) {
    if (actorEff.isSuperAdmin) return true;
    if (isSuperAdminUser(targetUser)) return false;
    return !missingAuthority(actorEff, authorityOf(effectiveFor(targetUser))).length;
}

function canAssignRole(actorEff, roleId) {
    if (roleId === SUPER_ADMIN) return false; // only through grantSuperAdmin
    if (actorEff.isSuperAdmin) return true;
    const role = getRole(roleId);
    return !!role && !missingAuthority(actorEff, roleAuthority(role)).length;
}

// Holders of each role: the main role on account records plus additional roles in user_roles (counted once per person)
async function holderCounts() {
    const [rows] = await db.query(
        `SELECT role_id, COUNT(DISTINCT user_id) AS n FROM (
            SELECT id AS user_id, JSON_UNQUOTE(JSON_EXTRACT(data, '$.role')) AS role_id FROM lms_records WHERE collection = 'users' AND deleted = 0
            UNION
            SELECT ur.user_id, ur.role_id FROM user_roles ur
            JOIN lms_records r ON r.collection = 'users' AND r.id = ur.user_id AND r.deleted = 0
         ) h GROUP BY role_id`
    );
    return new Map(rows.map(r => [r.role_id, Number(r.n)]));
}

async function userCount(roleId) {
    return (await holderCounts()).get(roleId) || 0;
}

async function list(includePermissions) {
    const counts = await holderCounts();
    const userCount = id => counts.get(id) || 0;
    const out = Array.from(cache.values()).map(r => ({
        id: r.id, name: r.name, urduTitle: r.urduTitle, badgeClass: r.badgeClass, description: r.description,
        scope: r.scope, isSystem: r.isSystem, status: r.status, version: r.version, userCount: userCount(r.id),
        ...(includePermissions ? { permissions: Array.from(r.granted).sort(), warnings: catalog.sodWarnings(r.permissions) } : {})
    }));
    out.sort((a, b) => (b.isSystem - a.isSystem) || a.name.localeCompare(b.name));
    return { superAdminUsers: superAdmins.size, roles: out };
}

// ---------------------------------------------------------------------------
// Role assignments (written when an account record is saved)
// ---------------------------------------------------------------------------

async function setUserRoles(conn, userId, mainRole, additional, by) {
    const main = String(mainRole || '').toUpperCase();
    const extra = Array.from(new Set((additional || []).map(r => String(r).toUpperCase()))).filter(r => r && r !== main && r !== SUPER_ADMIN);
    const q = (sql, params) => (conn || db).query(sql, params);
    await q(`DELETE FROM user_roles WHERE user_id = ? AND scope_type = 'GLOBAL'`, [userId]);
    if (main && main !== SUPER_ADMIN) await q(`INSERT INTO user_roles (user_id, role_id, is_primary, granted_by) VALUES (?, ?, 1, ?)`, [userId, main, by]);
    for (const r of extra) await q(`INSERT INTO user_roles (user_id, role_id, is_primary, granted_by) VALUES (?, ?, 0, ?)`, [userId, r, by]);
    // Keep this process's view current at once (others reload within seconds)
    assignments.set(userId, (main && main !== SUPER_ADMIN ? [main] : []).concat(extra));
}

async function removeUserRoles(conn, userId) {
    await (conn || db).query(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
    assignments.delete(userId);
}

// ---------------------------------------------------------------------------
// Super Admin grants
// ---------------------------------------------------------------------------

async function loadUserRecord(userId) {
    const [rows] = await db.query(`SELECT data FROM lms_records WHERE collection = 'users' AND id = ? AND deleted = 0`, [userId]);
    return rows.length ? JSON.parse(rows[0].data) : null;
}

async function saveUserRecord(record, by) {
    await db.query(
        `UPDATE lms_records SET data = ?, updated_by = ?, updated_at = NOW(3) WHERE collection = 'users' AND id = ?`,
        [JSON.stringify(record), by, record.id]
    );
}

async function confirmPassword(actorUser, password) {
    const cred = await auth.getCredential(actorUser.id);
    return !!cred && auth.verifyPassword(String(password || ''), cred.password_hash);
}

function activeSuperAdminCount() {
    return superAdmins.size;
}

async function grantSuperAdmin(actorUser, targetId, password, req) {
    if (!isSuperAdminUser(actorUser)) return fail(403, 'Only a Super Admin can make someone a Super Admin.');
    if (!(await confirmPassword(actorUser, password))) return fail(403, 'Your password is not correct.');
    const target = await loadUserRecord(targetId);
    if (!target) return fail(404, 'Account not found.');
    if (isSuperAdminUser(target)) return fail(409, 'This person is already a Super Admin.');
    if (['STUDENT'].includes(String(target.role).toUpperCase())) return fail(400, 'Student accounts cannot be made Super Admin.');
    if (auth.INACTIVE_STATUSES.includes(target.status)) return fail(400, 'Activate the account first.');
    const before = { role: target.role, additionalRoles: additionalRolesOf(target) };
    await db.query(`INSERT INTO super_admins (user_id, granted_by) VALUES (?, ?)`, [target.id, actorUser.id]);
    // The previous main role is kept as an additional role, so removing Super Admin later restores it
    await setUserRoles(null, target.id, SUPER_ADMIN, [String(target.role).toUpperCase(), ...before.additionalRoles], actorUser.id);
    target.role = SUPER_ADMIN;
    target.status = 'ACTIVE';
    target.additionalRoles = additionalRolesOf(target);
    await saveUserRecord(target, actorUser.id);
    await load();
    await audit.log({ req, action: 'superadmin.grant', entityType: 'users', entityId: target.id, summary: `Made ${target.name || target.id} a Super Admin`, before, after: { role: SUPER_ADMIN } });
    return { ok: true };
}

async function revokeSuperAdmin(actorUser, targetId, newRole, password, req) {
    if (!isSuperAdminUser(actorUser)) return fail(403, 'Only a Super Admin can remove Super Admin rights.');
    if (!(await confirmPassword(actorUser, password))) return fail(403, 'Your password is not correct.');
    const target = await loadUserRecord(targetId);
    if (!target || !isSuperAdminUser(target)) return fail(404, 'This person is not a Super Admin.');
    if (activeSuperAdminCount() <= 1) return fail(409, 'There must always be at least one Super Admin. Make someone else Super Admin first.');
    const role = String(newRole || '').toUpperCase();
    if (!getRole(role) || role === SUPER_ADMIN) return fail(400, 'Choose the role this person will have instead.');
    await db.query(`DELETE FROM super_admins WHERE user_id = ?`, [target.id]);
    const keep = additionalRolesOf(target).filter(r => r !== role);
    await setUserRoles(null, target.id, role, keep, actorUser.id);
    target.role = role;
    target.additionalRoles = keep;
    await saveUserRecord(target, actorUser.id);
    await load();
    await auth.revokeUserSessions(target.id, target.id === actorUser.id ? req : null);
    await audit.log({ req, action: 'superadmin.revoke', entityType: 'users', entityId: target.id, summary: `Removed Super Admin rights from ${target.name || target.id}; new role ${role}`, before: { role: SUPER_ADMIN }, after: { role, additionalRoles: keep } });
    return { ok: true };
}

// ---------------------------------------------------------------------------
// Changes (every rule is checked here, whatever the browser allowed)
// ---------------------------------------------------------------------------

function fail(status, error, extra) {
    return { ok: false, status, error, ...(extra || {}) };
}

function cleanText(v, max) {
    return String(v === undefined || v === null ? '' : v).trim().slice(0, max);
}

// Every permission changed must be one the editor holds themselves (Super Admin holds all)
function beyondEditor(eff, keys) {
    return keys.filter(k => !eff.permissions.has(k));
}

function beyondCeiling(roleId, keys) {
    const ceiling = catalog.ROLE_CEILING[roleId];
    return ceiling ? keys.filter(k => !ceiling.has(k)) : [];
}

async function createRole(actorUser, body, req) {
    const eff = effectiveFor(actorUser);
    if (!eff.permissions.has('roles.create')) return fail(403, 'You are not allowed to create roles.');
    const id = cleanText(body.id, 60).toUpperCase();
    const name = cleanText(body.name, 120);
    if (!ROLE_ID_PATTERN.test(id)) return fail(400, 'The role identifier must start with a letter and use only A-Z, 0-9 and _ (e.g. EXAM_OFFICER).');
    if (id === SUPER_ADMIN) return fail(400, 'SUPER_ADMIN is reserved.');
    if (getRole(id)) return fail(409, `A role with the identifier ${id} already exists.`);
    if (!name) return fail(400, 'Give the role a name.');
    const scope = catalog.SCOPES[body.scope] ? body.scope : 'ALL';
    if (scope === 'ALL' && eff.scope !== 'ALL') return fail(403, 'Only whole-institution staff can create a role with whole-institution scope.');
    const permissions = Array.from(new Set((body.permissions || []).filter(catalog.isKnown)));
    const denied = beyondEditor(eff, permissions);
    if (denied.length) return fail(403, `You can only give permissions you hold yourself: ${denied.join(', ')}`);

    const role = {
        id, name, scope, isSystem: false,
        urduTitle: cleanText(body.urduTitle, 120),
        badgeClass: BADGES.includes(body.badgeClass) ? body.badgeClass : 'info',
        description: cleanText(body.description, 1000)
    };
    await insertRole(role, permissions, actorUser.id);
    await load();
    await audit.log({ req, action: 'role.create', entityType: 'role', entityId: id, summary: `Created role ${name}`, after: { ...role, permissions } });
    return { ok: true, role: (await list(true)).roles.find(r => r.id === id) };
}

async function updateRole(actorUser, id, body, req) {
    const eff = effectiveFor(actorUser);
    if (!eff.permissions.has('roles.update')) return fail(403, 'You are not allowed to change roles.');
    const role = getRole(id);
    if (id === SUPER_ADMIN) return fail(400, 'Super Admin always has full access and cannot be changed.');
    if (!role) return fail(404, 'Role not found.');
    if (!eff.isSuperAdmin && rolesOfUser(actorUser).includes(id)) return fail(403, 'Only the Super Admin can change a role you hold yourself.');
    // A role that can do more than the editor is out of their reach (e.g. a custom role cannot reshape Admin)
    const above = missingAuthority(eff, roleAuthority(role));
    if (above.length) return fail(403, `This role can do things you cannot (${above.slice(0, 5).join(', ')}${above.length > 5 ? ' …' : ''}), so you cannot change it.`);
    if (Number(body.version) !== role.version) {
        return fail(409, 'Someone else changed this role while you were editing it. Reload it and make your change again.', { currentVersion: role.version });
    }

    const add = Array.from(new Set((body.add || []).filter(catalog.isKnown))).filter(k => !role.granted.has(k));
    const remove = Array.from(new Set((body.remove || []).filter(k => role.granted.has(k))));
    const denied = beyondEditor(eff, add.concat(remove));
    if (denied.length) return fail(403, `You can only change permissions you hold yourself: ${denied.join(', ')}`);
    const overCeiling = beyondCeiling(id, add);
    if (overCeiling.length) return fail(400, `The ${role.name} role cannot hold: ${overCeiling.join(', ')}`);

    let scope = role.scope;
    if (body.scope && body.scope !== role.scope) {
        if (role.isSystem) return fail(400, 'The data scope of Admin, Teacher and Student is fixed.');
        if (!catalog.SCOPES[body.scope]) return fail(400, 'Unknown data scope.');
        if (body.scope === 'ALL' && eff.scope !== 'ALL') return fail(403, 'Only whole-institution staff can give a role whole-institution scope.');
        scope = body.scope;
    }
    const next = {
        name: body.name !== undefined ? cleanText(body.name, 120) || role.name : role.name,
        urduTitle: body.urduTitle !== undefined ? cleanText(body.urduTitle, 120) : role.urduTitle,
        badgeClass: BADGES.includes(body.badgeClass) ? body.badgeClass : role.badgeClass,
        description: body.description !== undefined ? cleanText(body.description, 1000) : role.description,
        status: role.isSystem ? 'ACTIVE' : (body.status === 'INACTIVE' ? 'INACTIVE' : (body.status === 'ACTIVE' ? 'ACTIVE' : role.status))
    };

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [res] = await conn.query(
            `UPDATE roles SET name = ?, urdu_title = ?, badge_class = ?, description = ?, scope = ?, status = ?, version = version + 1, updated_by = ?
             WHERE id = ? AND version = ?`,
            [next.name, next.urduTitle, next.badgeClass, next.description, scope, next.status, actorUser.id, id, role.version]
        );
        if (!res.affectedRows) {
            await conn.rollback();
            return fail(409, 'Someone else changed this role while you were editing it. Reload it and make your change again.');
        }
        for (const k of add) await conn.query(`INSERT IGNORE INTO role_permissions (role_id, permission) VALUES (?, ?)`, [id, k]);
        for (const k of remove) await conn.query(`DELETE FROM role_permissions WHERE role_id = ? AND permission = ?`, [id, k]);
        await conn.commit();
    } catch (err) {
        await conn.rollback().catch(() => {});
        throw err;
    } finally {
        conn.release();
    }
    await load();
    await audit.log({
        req, action: 'role.update', entityType: 'role', entityId: id,
        summary: `Changed role ${next.name}: +${add.length} / -${remove.length} permission(s)${scope !== role.scope ? `, scope ${role.scope} → ${scope}` : ''}`,
        before: { name: role.name, scope: role.scope, status: role.status, permissions: Array.from(role.granted).sort() },
        after: { name: next.name, scope, status: next.status, added: add, removed: remove }
    });
    return { ok: true, role: (await list(true)).roles.find(r => r.id === id) };
}

async function deleteRole(actorUser, id, req) {
    const eff = effectiveFor(actorUser);
    if (!eff.permissions.has('roles.delete')) return fail(403, 'You are not allowed to delete roles.');
    const role = getRole(id);
    if (id === SUPER_ADMIN || CORE_ROLE_IDS.includes(id)) return fail(400, 'Super Admin, Admin, Teacher and Student cannot be deleted.');
    if (!role) return fail(404, 'Role not found.');
    if (!eff.isSuperAdmin && rolesOfUser(actorUser).includes(id)) return fail(403, 'You cannot delete a role you hold.');
    if (missingAuthority(eff, roleAuthority(role)).length) return fail(403, 'This role can do things you cannot, so you cannot delete it.');
    const denied = beyondEditor(eff, Array.from(role.granted));
    if (denied.length) return fail(403, 'This role holds permissions you do not have, so you cannot delete it.');
    const holders = await userCount(id);
    if (holders) return fail(409, `${holders} user(s) still hold this role. Give them another role first.`);
    await db.query(`DELETE FROM role_permissions WHERE role_id = ?`, [id]);
    await db.query(`DELETE FROM roles WHERE id = ?`, [id]);
    await load();
    await audit.log({ req, action: 'role.delete', entityType: 'role', entityId: id, summary: `Deleted role ${role.name}`, before: { name: role.name, scope: role.scope, permissions: Array.from(role.granted) } });
    return { ok: true };
}

function catalogPayload() {
    return {
        scopes: catalog.SCOPES,
        modules: catalog.MODULES.map(([key, label, description]) => ({ key, label, description })),
        permissions: catalog.CATALOG,
        defaults: catalog.DEFAULT_PERMISSIONS,
        ceilings: Object.fromEntries(Object.entries(catalog.ROLE_CEILING).map(([k, v]) => [k, Array.from(v)])),
        coreRoleIds: CORE_ROLE_IDS,
        sodPairs: catalog.SOD_PAIRS.map(([a, b, message]) => ({ permissions: [a, b], message })),
        selfService: Array.from(catalog.SELF_SERVICE)
    };
}

module.exports = {
    SUPER_ADMIN,
    CORE_ROLE_IDS,
    ensureRolesSchema,
    load,
    getRole,
    effectiveFor,
    effectiveForAuth,
    isSuperAdminUser,
    rolesOfUser,
    additionalRolesOf,
    authorityOf,
    roleAuthority,
    missingAuthority,
    canManagePerson,
    canAssignRole,
    setUserRoles,
    removeUserRoles,
    grantSuperAdmin,
    revokeSuperAdmin,
    activeSuperAdminCount,
    list,
    createRole,
    updateRole,
    deleteRole,
    catalogPayload,
    legacyPermissionsFor
};
