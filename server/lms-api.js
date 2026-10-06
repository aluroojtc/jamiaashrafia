/**
 * JAMIA ASHRAFIA LAHORE - SHARED LMS API (MySQL / MariaDB backed)
 * - Multi-user record store (classes, courses, assignments, exams, fees, library, timetable, virtual classes)
 * - Server-side login, sessions and password changes (see server/auth.js)
 * - File uploads (assignments, exam papers, e-books, payment proofs, course material)
 * - Targeted notifications (role / class / individual user) with per-user read state
 * - Admissions open/closed settings, public application status tracker
 *
 * The caller is always the user of the session cookie (req.auth, set in server.js); request headers
 * never decide who someone is. Which records they may read or change is decided in server/access-policy.js.
 *
 * handle(req, res) resolves to true when the request was answered here,
 * otherwise server.js continues with its own routes and static files.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../database/db');
const auth = require('./auth');
const policy = require('./access-policy');
const roles = require('./roles');
const audit = require('./audit');

const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads');
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_JSON_BYTES = 8 * 1024 * 1024;

const ALLOWED_UPLOAD_EXT = new Set([
    '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif',
    '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.zip',
    '.mp3', '.m4a', '.mp4', '.webm'
]);

// Collections shared between all users through the record store
const SYNC_COLLECTIONS = [
    'users', 'classes', 'courses', 'courseMaterials', 'assignments', 'assignmentSubmissions',
    'exams', 'examSubmissions', 'examResults', 'timetables', 'libraryBooks', 'libraryLoans',
    'feeStructures', 'feeChallans', 'donations', 'virtualClasses', 'virtualClassRecordings', 'attendance'
];

// Private per-student collections: tells a student's browser to drop other people's copies (e.g. seed data)
const STUDENT_SCOPED = {
    assignmentSubmissions: 'studentId',
    examSubmissions: 'studentId',
    feeChallans: 'studentId',
    libraryLoans: 'userId',
    attendance: 'userId',
    donations: 'donorUserId'
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendJson(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=UTF-8' });
    res.end(JSON.stringify(payload));
}

function readBody(req, limit) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > limit) {
                reject(Object.assign(new Error('Payload too large'), { status: 413 }));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

async function readJson(req) {
    const buf = await readBody(req, MAX_JSON_BYTES);
    if (!buf.length) return {};
    try {
        return JSON.parse(buf.toString('utf8'));
    } catch (e) {
        throw Object.assign(new Error('Invalid JSON payload'), { status: 400 });
    }
}

// The signed-in user of this request (resolved from the session cookie in server.js)
function caller(req) {
    const a = req.auth;
    return a ? { id: a.id, role: a.role, user: a.user, auth: a } : { id: '', role: '', user: null, auth: null };
}

// What the caller may do: { scope, permissions:Set, isSuperAdmin } (see server/roles.js)
function effective(req) {
    return roles.effectiveForAuth(req.auth);
}

function can(req, permission) {
    return !!req.auth && effective(req).permissions.has(permission);
}

function newId(prefix) {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// Schema (created on first use so existing installs upgrade automatically)
// ---------------------------------------------------------------------------

let schemaPromise = null;

async function columnExists(table, column) {
    const [rows] = await db.query(
        `SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    return rows[0].c > 0;
}

function ensureSchema() {
    if (!schemaPromise) {
        schemaPromise = (async () => {
            await db.query(`CREATE TABLE IF NOT EXISTS lms_records (
                collection VARCHAR(64) NOT NULL,
                id VARCHAR(120) NOT NULL,
                data LONGTEXT NOT NULL,
                deleted TINYINT(1) NOT NULL DEFAULT 0,
                updated_by VARCHAR(120) NULL,
                updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                PRIMARY KEY (collection, id),
                INDEX idx_lms_records_updated (updated_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

            await db.query(`CREATE TABLE IF NOT EXISTS user_credentials (
                user_id VARCHAR(120) PRIMARY KEY,
                password_hash VARCHAR(255) NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

            await db.query(`CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value LONGTEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

            await db.query(`CREATE TABLE IF NOT EXISTS notifications (
                id VARCHAR(50) PRIMARY KEY,
                sender_id VARCHAR(50) NULL,
                target_role VARCHAR(50) NOT NULL DEFAULT 'ACADEMIC_ADMIN',
                target_user_id VARCHAR(50) NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                category VARCHAR(50) DEFAULT 'ADMISSION',
                is_read TINYINT(1) DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

            if (!(await columnExists('notifications', 'target_class_id'))) {
                await db.query(`ALTER TABLE notifications ADD COLUMN target_class_id VARCHAR(50) NULL`);
            }
            if (!(await columnExists('notifications', 'sender_name'))) {
                await db.query(`ALTER TABLE notifications ADD COLUMN sender_name VARCHAR(255) NULL`);
            }
            if (!(await columnExists('notifications', 'link_route'))) {
                await db.query(`ALTER TABLE notifications ADD COLUMN link_route VARCHAR(100) NULL`);
            }

            await db.query(`CREATE TABLE IF NOT EXISTS notification_reads (
                notification_id VARCHAR(50) NOT NULL,
                user_id VARCHAR(120) NOT NULL,
                read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (notification_id, user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

            await auth.ensureAuthSchema();
            await audit.ensureAuditSchema();
            await roles.ensureRolesSchema();
        })().catch(err => {
            schemaPromise = null;
            throw err;
        });
    }
    return schemaPromise;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const DEFAULT_ADMISSION_SETTINGS = {
    isOpen: true,
    session: '1447-1448 AH / 2026-2027',
    startDate: '2026-09-01',
    deadline: '2026-10-31',
    registrationFee: 1000,
    admissionFee: 5000,
    message: 'Admissions are open for Dars-e-Nizami, Hifz-ul-Quran, Takhassus and Alimiyyah (Lil Bannat).',
    closedMessage: 'Admissions are currently closed. Please check back when the next session opens.',
    openPrograms: []
};

async function getSetting(key, fallback) {
    await ensureSchema();
    const [rows] = await db.query(`SELECT setting_value FROM system_settings WHERE setting_key = ?`, [key]);
    if (!rows.length) return fallback;
    try {
        return JSON.parse(rows[0].setting_value);
    } catch (e) {
        return fallback;
    }
}

async function saveSetting(key, value) {
    await ensureSchema();
    await db.query(
        `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, JSON.stringify(value)]
    );
}

async function getAdmissionSettings() {
    const stored = await getSetting('admissions', null);
    const settings = { ...DEFAULT_ADMISSION_SETTINGS, ...(stored || {}) };
    // An open window automatically closes after the deadline day has passed
    const today = new Date().toISOString().slice(0, 10);
    settings.isAcceptingApplications = !!settings.isOpen
        && (!settings.deadline || today <= settings.deadline)
        && (!settings.startDate || today >= settings.startDate);
    return settings;
}

// ---------------------------------------------------------------------------
// Record store
// ---------------------------------------------------------------------------

async function loadRecord(collection, id) {
    const [rows] = await db.query(`SELECT data, deleted FROM lms_records WHERE collection = ? AND id = ?`, [collection, id]);
    if (!rows.length) return null;
    return { data: JSON.parse(rows[0].data), deleted: !!rows[0].deleted };
}

async function loadCollection(collection) {
    await ensureSchema();
    const [rows] = await db.query(`SELECT data FROM lms_records WHERE collection = ? AND deleted = 0`, [collection]);
    return rows.map(r => JSON.parse(r.data));
}

async function handleStorePull(req, res, url) {
    const who = caller(req);
    if (!who.id) {
        sendJson(res, 401, { success: false, error: 'Please sign in.' });
        return;
    }
    await ensureSchema();
    const since = url.searchParams.get('since');
    const [[{ now }]] = await db.query(`SELECT DATE_FORMAT(NOW(3), '%Y-%m-%d %H:%i:%s.%f') AS now`);

    let rows;
    if (since) {
        [rows] = await db.query(
            `SELECT collection, id, data, deleted FROM lms_records WHERE updated_at >= ?`,
            [since]
        );
    } else {
        [rows] = await db.query(`SELECT collection, id, data, deleted FROM lms_records`);
    }

    const ctx = await policy.buildContext(who, loadCollection);
    const collections = {};
    const deleted = {};
    const present = new Set();
    rows.forEach(r => {
        present.add(r.collection);
        if (r.deleted) {
            (deleted[r.collection] = deleted[r.collection] || []).push(r.id);
            return;
        }
        // Deny by default: only records this user may see, with fields they may not see removed
        const rec = policy.readable(ctx, r.collection, JSON.parse(r.data));
        if (rec) (collections[r.collection] = collections[r.collection] || []).push(rec);
    });

    sendJson(res, 200, {
        success: true,
        serverTime: now,
        full: !since,
        presentCollections: since ? undefined : Array.from(present),
        scope: ctx.isStudent ? { ...STUDENT_SCOPED, examResults: 'studentId' } : undefined,
        collections,
        deleted
    });
}

// Super Admin accounts are edited only by a Super Admin, and nobody becomes Super Admin through a record save:
// that goes through /api/super-admins (password re-entry, audited). The first one is made with `npm run bootstrap-admin`.
function superAdminWriteAllowed(collection, who, incoming, existing, ctx) {
    if (collection !== 'users') return true;
    const wasSuper = !!existing && existing.role === 'SUPER_ADMIN';
    if (incoming.role === 'SUPER_ADMIN' && !wasSuper) return false;
    if (wasSuper) return ctx.isSuperAdmin;
    return true;
}

// Login identifiers (email, username, roll number) must belong to exactly one account
function identifierClash(record, users) {
    const norm = v => String(v || '').trim().toLowerCase();
    const mine = ['email', 'username', 'rollNo'].map(f => norm(record[f])).filter(Boolean);
    if (!mine.length) return null;
    const other = users.find(u => u.id !== record.id && ['email', 'username', 'rollNo'].some(f => norm(u[f]) && mine.includes(norm(u[f]))));
    return other ? 'This email, username or roll number is already used by another account.' : null;
}

// Audit entries for record changes that matter (accounts, results, payments, old attendance)
function auditRecordChange(req, collection, existing, record, extra = {}) {
    const by = a => a || {};
    const before = by(existing);
    const pending = [];
    const entry = (action, summary, b, a) => pending.push({ req, action, entityType: collection, entityId: record.id, summary, before: b, after: a });

    if (collection === 'users') {
        const label = `${record.name || record.id} (${record.role})`;
        if (!existing) entry('user.create', `Created account ${label}`, null, { role: record.role, status: record.status });
        else {
            if (before.role !== record.role) entry('user.role_change', `Changed role of ${record.name || record.id}: ${before.role} → ${record.role}`, { role: before.role }, { role: record.role });
            if ((before.status || 'ACTIVE') !== (record.status || 'ACTIVE')) entry('user.status_change', `${record.name || record.id}: ${before.status || 'ACTIVE'} → ${record.status}`, { status: before.status }, { status: record.status });
        }
        if (extra.passwordSet && existing) entry('user.password_reset', `Temporary password set for ${label}`, null, null);
        if (extra.rolesChange) entry('user.roles_change', `Additional roles of ${record.name || record.id}: ${extra.rolesChange.before.join(', ') || 'none'} → ${extra.rolesChange.after.join(', ') || 'none'}`, { additionalRoles: extra.rolesChange.before }, { additionalRoles: extra.rolesChange.after });
    }
    if (collection === 'exams' && !!before.resultsPublished !== !!record.resultsPublished) {
        entry(record.resultsPublished ? 'exam.results_publish' : 'exam.results_unpublish', `${record.resultsPublished ? 'Published' : 'Withdrew'} results of ${record.title || record.id}`,
            { resultsPublished: !!before.resultsPublished }, { resultsPublished: !!record.resultsPublished });
    }
    if (collection === 'examResults' && existing && !!before.published !== !!record.published && !record.published) {
        entry('exam.result_unpublish', `Withdrew result ${record.id}`, { published: true }, { published: false });
    }
    if (collection === 'examResults' && existing && before.published && JSON.stringify(before.marksObtained) !== JSON.stringify(record.marksObtained)) {
        entry('exam.result_change', `Changed marks of a published result (${record.studentName || record.studentId})`, { marksObtained: before.marksObtained }, { marksObtained: record.marksObtained });
    }
    if (collection === 'feeChallans' && existing && before.status !== record.status && (record.status === 'PAID' || before.status === 'PAID')) {
        entry('fee.challan_verify', `Challan ${record.challanNumber || record.id}: ${before.status} → ${record.status}`, { status: before.status }, { status: record.status, netPayable: record.netPayable });
    }
    if (collection === 'feeChallans' && existing && JSON.stringify(before.scholarshipWaiver || 0) !== JSON.stringify(record.scholarshipWaiver || 0)) {
        entry('fee.waiver', `Waiver on challan ${record.challanNumber || record.id}`, { scholarshipWaiver: before.scholarshipWaiver }, { scholarshipWaiver: record.scholarshipWaiver });
    }
    if (collection === 'donations' && existing && before.status === 'PENDING_CONFIRMATION' && record.status !== 'PENDING_CONFIRMATION') {
        entry('donation.confirm', `Confirmed donation ${record.receiptNo || record.id} (${record.amount})`, { status: before.status }, { status: record.status });
    }
    if (collection === 'attendance' && existing && JSON.stringify(before.status) !== JSON.stringify(record.status)) {
        const ageDays = Math.floor((Date.now() - Date.parse(`${String(record.date || '').slice(0, 10)}T00:00:00Z`)) / 86400000);
        if (ageDays > 7) entry('attendance.correct', `Corrected attendance of ${record.userName || record.userId} on ${record.date}: ${before.status} → ${record.status}`, { status: before.status }, { status: record.status });
    }
    return Promise.all(pending.map(e => audit.log(e)));
}

async function handleStoreSync(req, res) {
    const who = caller(req);
    if (!who.id) {
        sendJson(res, 401, { success: false, error: 'Please sign in.' });
        return;
    }
    await ensureSchema();
    const body = await readJson(req);
    const upserts = body.upserts || {};
    const deletes = body.deletes || {};
    const result = { accepted: {}, rejected: {}, errors: {} };
    const reject = (collection, id, message) => {
        (result.rejected[collection] = result.rejected[collection] || []).push(id);
        if (message) (result.errors[collection] = result.errors[collection] || {})[id] = message;
    };
    const ctx = await policy.buildContext(who, loadCollection);
    let allUsers = null;
    const revoke = new Set();
    const audits = [];

    const conn = await db.getConnection();
    try {
        for (const collection of Object.keys(upserts)) {
            if (!SYNC_COLLECTIONS.includes(collection) || !Array.isArray(upserts[collection])) continue;
            for (const raw of upserts[collection]) {
                if (!raw || typeof raw !== 'object' || !raw.id) continue;
                const id = String(raw.id).slice(0, 120);
                const [rows] = await conn.execute(`SELECT data, deleted FROM lms_records WHERE collection = ? AND id = ?`, [collection, id]);
                const existing = rows.length && !rows[0].deleted ? JSON.parse(rows[0].data) : null;
                const incoming = { ...raw, id };

                if (!superAdminWriteAllowed(collection, who, incoming, existing, ctx)) {
                    reject(collection, id, incoming.role === 'SUPER_ADMIN' && !(existing && existing.role === 'SUPER_ADMIN')
                        ? 'Super Admin can only be given with "Make Super Admin" on the Users page.'
                        : 'Only the Super Admin can change a Super Admin account.');
                    continue;
                }
                if (!policy.canWrite(ctx, collection, incoming, existing)) {
                    reject(collection, id, ctx.reason);
                    continue;
                }

                let record = policy.prepareWrite(ctx, collection, incoming, existing);
                if (collection === 'users' && existing && existing.role === 'SUPER_ADMIN') {
                    // Super Admin's profile is editable, but the account always stays an active Super Admin
                    record.role = 'SUPER_ADMIN';
                    record.status = 'ACTIVE';
                }

                let passwordSet = false;
                let rolesChange = null;
                if (collection === 'users') {
                    allUsers = allUsers || await loadCollection('users');
                    const clash = identifierClash(record, allUsers);
                    if (clash) {
                        reject(collection, id, clash);
                        continue;
                    }
                    const password = record.password !== undefined && record.password !== null ? String(record.password) : '';
                    delete record.password;
                    // Staff with the reset-password permission set temporary passwords for other people; the person must
                    // change it at next sign-in. Everyone changes their own through /api/auth/change-password.
                    if (password && id !== who.id) {
                        if (!policy.canSetPassword(ctx, existing || record, !existing)) {
                            reject(collection, id, 'You are not allowed to set this person\'s password.');
                            continue;
                        }
                        const problem = auth.passwordProblem(password);
                        if (problem) {
                            reject(collection, id, problem);
                            continue;
                        }
                        await auth.setPassword(conn, id, password, true);
                        passwordSet = true;
                        revoke.add(id);
                    }
                    if (auth.INACTIVE_STATUSES.includes(record.status)) revoke.add(id);
                    // Additional roles live in user_roles; the record only carries them as a request
                    const extraBefore = existing ? roles.additionalRolesOf(existing) : [];
                    const extraAfter = Array.isArray(record.additionalRoles)
                        ? Array.from(new Set(record.additionalRoles.map(r => String(r).toUpperCase())))
                        : extraBefore;
                    delete record.additionalRoles;
                    if (record.role !== 'SUPER_ADMIN' || !existing) await roles.setUserRoles(conn, id, record.role, extraAfter, who.id);
                    rolesChange = JSON.stringify(extraBefore.slice().sort()) !== JSON.stringify(extraAfter.slice().sort()) ? { before: extraBefore, after: extraAfter } : null;
                    allUsers = allUsers.filter(u => u.id !== id).concat(record);
                }

                await conn.execute(
                    `INSERT INTO lms_records (collection, id, data, deleted, updated_by, updated_at)
                     VALUES (?, ?, ?, 0, ?, NOW(3))
                     ON DUPLICATE KEY UPDATE data = VALUES(data), deleted = 0, updated_by = VALUES(updated_by), updated_at = NOW(3)`,
                    [collection, id, JSON.stringify(record), who.id]
                );
                policy.noteWrite(ctx, collection, record);
                audits.push([collection, existing, record, { passwordSet, rolesChange }]);
                (result.accepted[collection] = result.accepted[collection] || []).push(id);
            }
        }

        for (const collection of Object.keys(deletes)) {
            if (!SYNC_COLLECTIONS.includes(collection) || !Array.isArray(deletes[collection])) continue;
            for (const rawId of deletes[collection]) {
                const id = String(rawId).slice(0, 120);
                const [rows] = await conn.execute(`SELECT data, deleted FROM lms_records WHERE collection = ? AND id = ?`, [collection, id]);
                if (!rows.length || rows[0].deleted) {
                    (result.accepted[collection] = result.accepted[collection] || []).push(id);
                    continue;
                }
                const existing = JSON.parse(rows[0].data);
                if (!policy.canDelete(ctx, collection, existing)) {
                    reject(collection, id, ctx.reason);
                    continue;
                }
                await conn.execute(
                    `UPDATE lms_records SET deleted = 1, updated_by = ?, updated_at = NOW(3) WHERE collection = ? AND id = ?`,
                    [who.id, collection, id]
                );
                if (collection === 'users') {
                    revoke.add(id);
                    await roles.removeUserRoles(conn, id);
                    await audit.log({ req, action: 'user.delete', entityType: 'users', entityId: id, summary: `Deleted account ${existing.name || id} (${existing.role})`, before: { role: existing.role, name: existing.name } });
                }
                (result.accepted[collection] = result.accepted[collection] || []).push(id);
            }
        }
    } finally {
        conn.release();
    }

    for (const [collection, existing, record, extra] of audits) {
        await auditRecordChange(req, collection, existing, record, extra);
    }
    // A reset password or a deactivated / deleted account ends that person's open sessions
    for (const userId of revoke) {
        await auth.revokeUserSessions(userId, userId === who.id ? req : null);
    }

    sendJson(res, 200, { success: true, ...result });
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

function publicUser(user) {
    const copy = { ...user };
    delete copy.password;
    return copy;
}

async function handleLogin(req, res) {
    await ensureSchema();
    const body = await readJson(req);
    const identifier = String(body.identifier || '').trim().toLowerCase().slice(0, 200);
    const password = String(body.password || '');
    if (!identifier || !password) {
        sendJson(res, 400, { success: false, error: 'Username / ID and password are required.' });
        return;
    }

    const ip = auth.clientIp(req);
    const wait = auth.lockedFor(ip, identifier);
    if (wait) {
        sendJson(res, 429, { success: false, error: `Too many failed sign-in attempts. Try again in ${Math.ceil(wait / 60)} minute(s).` });
        return;
    }

    const users = await loadCollection('users');
    if (!users.length) {
        sendJson(res, 503, { success: false, error: 'The user directory is not set up yet. An administrator must run "npm run bootstrap-admin" on the server.' });
        return;
    }

    // Prefer an exact email / username match over roll number or internal id
    const fields = ['email', 'username', 'rollNo', 'id'];
    let user = null;
    for (const f of fields) {
        user = users.find(u => u[f] && String(u[f]).toLowerCase() === identifier);
        if (user) break;
    }
    const cred = user ? await auth.getCredential(user.id) : null;
    // Same answer for an unknown account, an account without a password and a wrong password
    if (!user || !cred || !auth.verifyPassword(password, cred.password_hash)) {
        auth.recordFailure(ip, identifier);
        await audit.log({ req, actor: { id: user ? user.id : null, role: user ? user.role : null }, action: 'auth.login_failed', entityType: 'users', entityId: user ? user.id : null, summary: `Failed sign-in for "${identifier.slice(0, 80)}"` });
        sendJson(res, 401, { success: false, error: 'Incorrect username or password. Please check your details or contact the Academic Office.' });
        return;
    }
    if (auth.INACTIVE_STATUSES.includes(user.status)) {
        sendJson(res, 403, { success: false, error: `This account is currently ${user.status}. Please contact the Academic Office.` });
        return;
    }

    auth.clearFailures(ip, identifier);
    await auth.createSession(req, res, user.id);
    await audit.log({ req, actor: { id: user.id, role: user.role }, action: 'auth.login', entityType: 'users', entityId: user.id, summary: `Signed in${Number(cred.must_change) ? ' with a temporary password' : ''}` });
    sendJson(res, 200, {
        success: true,
        user: publicUser(user),
        mustChangePassword: !!Number(cred.must_change)
    });
}

async function handleLogout(req, res) {
    await ensureSchema();
    if (req.auth) await audit.log({ req, action: 'auth.logout', entityType: 'users', entityId: req.auth.id, summary: 'Signed out' });
    await auth.destroySession(req, res);
    sendJson(res, 200, { success: true, status: 'success', message: 'Logged out successfully' });
}

// "Who am I?" — answers user: null when signed out (the login page asks this on every visit)
async function handleMe(req, res) {
    if (!req.auth) {
        sendJson(res, 200, { success: true, user: null });
        return;
    }
    const eff = effective(req);
    const describe = id => {
        const r = roles.getRole(id);
        return { id, name: r ? r.name : id, urduTitle: r ? r.urduTitle : '', badgeClass: r ? r.badgeClass : 'info', scope: r ? r.scope : 'SELF' };
    };
    sendJson(res, 200, {
        success: true,
        user: { ...req.auth.user, additionalRoles: roles.additionalRolesOf(req.auth.user) },
        mustChangePassword: req.auth.mustChange,
        isSuperAdmin: eff.isSuperAdmin,
        role: eff.isSuperAdmin ? { id: roles.SUPER_ADMIN, name: 'Super Admin (Mohtamim)', scope: 'ALL' } : describe(eff.roleId),
        roles: eff.isSuperAdmin ? [{ id: roles.SUPER_ADMIN, name: 'Super Admin (Mohtamim)', scope: 'ALL' }] : eff.roleIds.map(describe),
        scope: eff.scope,
        permissions: Array.from(eff.permissions).sort(),
        scopes: Object.fromEntries(eff.scopes),
        preview: req.auth.preview || null
    });
}

async function handleChangePassword(req, res) {
    const who = caller(req);
    if (!who.id) {
        sendJson(res, 401, { success: false, error: 'Please sign in.' });
        return;
    }
    const body = await readJson(req);
    const current = String(body.currentPassword || '');
    const next = String(body.newPassword || '');

    const ip = auth.clientIp(req);
    const throttleKey = `change:${who.id}`;
    const wait = auth.lockedFor(ip, throttleKey);
    if (wait) {
        sendJson(res, 429, { success: false, error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} minute(s).` });
        return;
    }
    const cred = await auth.getCredential(who.id);
    if (!cred || !auth.verifyPassword(current, cred.password_hash)) {
        auth.recordFailure(ip, throttleKey);
        sendJson(res, 400, { success: false, error: 'Your current password is not correct.' });
        return;
    }
    const problem = auth.passwordProblem(next);
    if (problem) {
        sendJson(res, 400, { success: false, error: problem });
        return;
    }
    if (next === current) {
        sendJson(res, 400, { success: false, error: 'Choose a password different from your current one.' });
        return;
    }
    auth.clearFailures(ip, throttleKey);
    await auth.setPassword(null, who.id, next, false);
    // Other devices signed in with the old password are signed out
    await auth.revokeUserSessions(who.id, req);
    await audit.log({ req, action: 'auth.password_change', entityType: 'users', entityId: who.id, summary: 'Changed own password' });
    sendJson(res, 200, { success: true, message: 'Password changed.' });
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

async function handleUpload(req, res) {
    const who = caller(req);
    if (!who.id) {
        sendJson(res, 401, { success: false, error: 'Login required to upload files' });
        return;
    }
    const originalName = decodeURIComponent(String(req.headers['x-file-name'] || 'file')).replace(/[\\/]/g, '_');
    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_UPLOAD_EXT.has(ext)) {
        sendJson(res, 415, { success: false, error: `File type ${ext || '(none)'} is not allowed. Upload PDF, Word, Excel, PowerPoint, image, audio/video or ZIP files.` });
        return;
    }
    const buf = await readBody(req, MAX_UPLOAD_BYTES);
    if (!buf.length) {
        sendJson(res, 400, { success: false, error: 'Empty file' });
        return;
    }

    const month = new Date().toISOString().slice(0, 7);
    const dir = path.join(UPLOAD_DIR, month);
    fs.mkdirSync(dir, { recursive: true });
    const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_\-]+/g, '_').slice(0, 60) || 'file';
    const storedName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${base}${ext}`;
    fs.writeFileSync(path.join(dir, storedName), buf);

    sendJson(res, 201, {
        success: true,
        file: {
            url: `uploads/${month}/${storedName}`,
            name: originalName,
            size: buf.length,
            type: String(req.headers['content-type'] || 'application/octet-stream'),
            uploadedBy: who.id,
            uploadedAt: new Date().toISOString()
        }
    });
}

// ---------------------------------------------------------------------------
// Notifications (targeted, per-user read state)
// ---------------------------------------------------------------------------

async function handleNotificationsGet(req, res, url) {
    const who = caller(req);
    if (!who.role) {
        sendJson(res, 401, { error: '401 Unauthorized', message: 'Authentication required.' });
        return;
    }
    await ensureSchema();

    // Notices this user has sent (teachers / office staff review their broadcasts)
    if (url.searchParams.get('sent') === '1') {
        const [sent] = await db.query(
            `SELECT n.id, n.sender_name AS senderName, n.target_role AS targetRole, n.target_user_id AS targetUserId,
                    n.target_class_id AS targetClassId, n.title, n.message, n.category,
                    DATE_FORMAT(n.created_at, '%Y-%m-%d %H:%i') AS time,
                    (SELECT COUNT(*) FROM notification_reads r WHERE r.notification_id = n.id) AS readCount
             FROM notifications n WHERE n.sender_id = ? ORDER BY n.created_at DESC LIMIT 100`,
            [who.id || '__none__']
        );
        sendJson(res, 200, { status: 'success', notifications: sent });
        return;
    }
    // Classes come from the server's own records, never from the request
    const classIds = await policy.notificationClassIds(who, loadCollection);

    let roleList = [who.role, 'ALL'];
    if (who.role === 'SUPER_ADMIN') roleList = ['SUPER_ADMIN', 'ACADEMIC_ADMIN', 'ALL'];
    // "Students and teachers" notices reach everyone using the student or teacher portal (own-records or teaching scope)
    if (effective(req).scope !== 'ALL') roleList.push('STUDENTS_AND_TEACHERS');

    const params = [who.id || '__none__'];
    let where = `(n.target_user_id = ?)`;
    where += ` OR (n.target_user_id IS NULL AND n.target_class_id IS NULL AND (n.target_role IS NULL OR n.target_role IN (${roleList.map(() => '?').join(',')})))`;
    params.push(...roleList);
    if (classIds.length) {
        where += ` OR (n.target_user_id IS NULL AND n.target_class_id IN (${classIds.map(() => '?').join(',')}) AND (n.target_role IN (?, 'ALL')))`;
        params.push(...classIds, who.role);
    }

    const [rows] = await db.query(
        `SELECT n.id, n.sender_id AS senderId, n.sender_name AS senderName, n.target_role AS targetRole,
                n.target_user_id AS targetUserId, n.target_class_id AS targetClassId, n.link_route AS linkRoute,
                n.title, n.message, n.category,
                (n.is_read = 1 OR r.user_id IS NOT NULL) AS isRead,
                DATE_FORMAT(n.created_at, '%Y-%m-%d %H:%i') AS time, n.created_at AS createdAt
         FROM notifications n
         LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
         WHERE ${where}
         ORDER BY n.created_at DESC LIMIT 100`,
        [who.id || '__none__', ...params]
    );
    rows.forEach(r => {
        r.isRead = !!Number(r.isRead);
        r.sender = r.senderName || (r.category === 'ADMISSION' ? 'Online Admissions Portal' : 'Jamia Ashrafia Administration');
    });
    sendJson(res, 200, { status: 'success', unreadCount: rows.filter(r => !r.isRead).length, notifications: rows });
}

async function insertNotification(n) {
    await ensureSchema();
    const id = n.id || newId('notif');
    await db.query(
        `INSERT INTO notifications (id, sender_id, sender_name, target_role, target_user_id, target_class_id, link_route, title, message, category, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
        [id, n.senderId || null, n.senderName || null, n.targetRole || 'ALL', n.targetUserId || null, n.targetClassId || null,
            n.linkRoute || null, String(n.title).slice(0, 255), String(n.message), n.category || 'GENERAL']
    );
    return id;
}

async function handleNotificationsPost(req, res) {
    const who = caller(req);
    if (!who.id || !who.role) {
        sendJson(res, 401, { success: false, error: 'Authentication required' });
        return;
    }
    const body = await readJson(req);
    const items = Array.isArray(body.notifications) ? body.notifications : [body];
    let classScope = null;
    const ids = [];
    for (const n of items) {
        if (!n || !n.title || !n.message) continue;
        const targetRole = String(n.targetRole || 'ALL').toUpperCase();
        if (n.targetUserId) {
            // Workflow notices to one person ("assignment submitted", "book issued") or a direct message
            if (!can(req, 'notifications.send_individual') && !isOfficeRole(targetRoleOfUser(await loadRecord('users', String(n.targetUserId))))) {
                sendJson(res, 403, { success: false, error: 'You are not allowed to send messages to individuals.' });
                return;
            }
        } else if (n.targetClassId) {
            if (!can(req, 'notifications.send_class')) {
                sendJson(res, 403, { success: false, error: 'You are not allowed to notify classes.' });
                return;
            }
            classScope = classScope || await policy.buildContext(who, loadCollection);
            // Class notices follow the scope the notify-class permission is held with
            if (!classScope.wide('notifications.send_class') && !classScope.teachingClassIds.has(n.targetClassId)) {
                sendJson(res, 403, { success: false, error: 'You can only notify classes you teach.' });
                return;
            }
        } else if (isOfficeRole(targetRole)) {
            // Anyone may alert an office inbox (library requests, payment proofs ...)
        } else if (targetRole === 'ALL' ? !can(req, 'notifications.broadcast_all') : !can(req, 'notifications.broadcast_role')) {
            sendJson(res, 403, { success: false, error: 'You are not allowed to broadcast to this audience.' });
            return;
        }
        // Only those who make institution-wide announcements may sign as an office (e.g. "Academic Office")
        const senderName = can(req, 'notifications.broadcast_all') && n.senderName ? n.senderName : ((who.user && who.user.name) || n.senderName);
        ids.push(await insertNotification({ ...n, targetRole, senderId: who.id, senderName }));
    }
    sendJson(res, 201, { success: true, ids });
}

// Office inboxes: Super Admin and every whole-institution staff role (Admin, Finance, Library ...)
function isOfficeRole(roleId) {
    if (roleId === roles.SUPER_ADMIN) return true;
    const r = roles.getRole(roleId);
    return !!r && r.scope === 'ALL';
}

function targetRoleOfUser(rec) {
    return rec && !rec.deleted ? rec.data.role : null;
}

async function handleNotificationsRead(req, res) {
    const who = caller(req);
    if (!who.id) {
        sendJson(res, 401, { error: '401 Unauthorized' });
        return;
    }
    await ensureSchema();
    const body = await readJson(req);
    const userId = who.id;
    const ids = body.markAll ? (body.ids || []) : [body.id || body.notificationId].filter(Boolean);
    for (const id of ids) {
        if (body.unread) {
            await db.query(`DELETE FROM notification_reads WHERE notification_id = ? AND user_id = ?`, [id, userId]);
            await db.query(`UPDATE notifications SET is_read = 0 WHERE id = ? AND target_user_id = ?`, [id, userId]);
        } else {
            await db.query(`INSERT IGNORE INTO notification_reads (notification_id, user_id) VALUES (?, ?)`, [id, userId]);
        }
    }
    sendJson(res, 200, { success: true, status: 'success', updated: ids.length });
}

// ---------------------------------------------------------------------------
// Admissions settings & public status tracker
// ---------------------------------------------------------------------------

async function handleAdmissionStatus(req, res, url) {
    await ensureSchema();
    const appNo = String(url.searchParams.get('applicationNo') || '').trim();
    const verify = String(url.searchParams.get('verify') || '').replace(/\D/g, '');
    if (!appNo || verify.length < 4) {
        sendJson(res, 400, { success: false, error: 'Provide the application number and the CNIC / passport / phone used when applying.' });
        return;
    }
    const [rows] = await db.query(
        `SELECT application_no AS applicationNo, candidate_name AS name, program_id AS programId, branch_id AS branchId,
                status, DATE_FORMAT(interview_date, '%Y-%m-%d %H:%i') AS interviewDate, allotted_roll_number AS allottedRollNo,
                cnic_bform AS cnic, passport_number AS passport, phone, DATE_FORMAT(created_at, '%Y-%m-%d') AS appliedAt
         FROM student_admissions WHERE application_no = ? LIMIT 1`,
        [appNo]
    );
    const rec = rows[0];
    const digits = v => String(v || '').replace(/\D/g, '');
    if (!rec || ![digits(rec.cnic), digits(rec.passport), digits(rec.phone)].some(d => d && d.endsWith(verify))) {
        sendJson(res, 404, { success: false, error: 'No application matches these details.' });
        return;
    }
    delete rec.cnic; delete rec.passport; delete rec.phone;
    sendJson(res, 200, { success: true, application: rec });
}

// ---------------------------------------------------------------------------
// Virtual classroom access (uses the shared record store, not hard-coded maps)
// ---------------------------------------------------------------------------

async function handleVirtualVerify(req, res) {
    const body = await readJson(req);
    const who = caller(req);
    if (!who.id) {
        sendJson(res, 401, { error: '401 Unauthorized', message: 'Please sign in.' });
        return;
    }

    const sessionRec = body.sessionId ? await loadRecord('virtualClasses', String(body.sessionId)) : null;
    const session = sessionRec && !sessionRec.deleted ? sessionRec.data : null;
    if (!session) {
        // Fail closed: a class the server does not know cannot be authorised
        sendJson(res, 404, { error: '404 Not Found', message: 'This online class is not available on the server yet. Please wait a few seconds and try again.' });
        return;
    }

    const eff = effective(req);
    const allowHost = () => sendJson(res, 200, { status: 'success', authorized: true, isHost: true, session });
    if (eff.permissions.has('virtual_classes.manage') && eff.scope === 'ALL') return allowHost();

    if (eff.permissions.has('virtual_classes.host') && eff.scope !== 'SELF') {
        if (eff.scope === 'ALL' || session.hostId === who.id) return allowHost();
        const clsRec = session.classId ? await loadRecord('classes', session.classId) : null;
        const cls = clsRec && !clsRec.deleted ? clsRec.data : null;
        const teaches = cls && (cls.teacherId === who.id || (cls.courseTeachers || []).some(ct => ct.teacherId === who.id));
        if (teaches) return allowHost();
    }

    const enrolledClass = who.user ? who.user.classId : null;
    if (eff.permissions.has('virtual_classes.join') && enrolledClass && enrolledClass === session.classId) {
        sendJson(res, 200, { status: 'success', authorized: true, isHost: false, session });
        return;
    }
    const message = eff.permissions.has('virtual_classes.host')
        ? 'Access Denied: You are not assigned to instruct or moderate this classroom.'
        : 'Access Denied: You are not enrolled in this class, so this live session is restricted.';
    sendJson(res, 403, { error: '403 Forbidden', message });
}

// ---------------------------------------------------------------------------
// Roles & permissions, audit log
// ---------------------------------------------------------------------------

async function handleRoles(req, res, url) {
    const p = url.pathname;
    const m = req.method;
    const user = req.auth.user;
    const send = result => sendJson(res, result.ok ? 200 : result.status, result.ok ? { success: true, ...result } : { success: false, error: result.error, currentVersion: result.currentVersion });

    if (p === '/api/roles/catalog' && m === 'GET') {
        sendJson(res, 200, { success: true, ...roles.catalogPayload() });
        return;
    }
    if (p === '/api/roles' && m === 'GET') {
        // Role names are shown everywhere; what each role may do only to those who manage roles
        sendJson(res, 200, { success: true, ...(await roles.list(can(req, 'roles.view'))) });
        return;
    }
    if (p === '/api/roles' && m === 'POST') {
        send(await roles.createRole(user, await readJson(req), req));
        return;
    }
    const id = decodeURIComponent(p.replace('/api/roles/', '')).toUpperCase();
    if (m === 'PUT') {
        send(await roles.updateRole(user, id, await readJson(req), req));
        return;
    }
    if (m === 'DELETE') {
        send(await roles.deleteRole(user, id, req));
        return;
    }
    sendJson(res, 405, { success: false, error: 'Method not allowed' });
}

async function handleAudit(req, res, url) {
    if (!can(req, 'audit.view')) {
        sendJson(res, 403, { success: false, error: 'You are not allowed to see the audit log.' });
        return;
    }
    const q = url.searchParams;
    const entries = await audit.list({
        limit: q.get('limit'), before: q.get('before'), action: q.get('action'),
        actor: q.get('actor'), entityType: q.get('entityType'), entityId: q.get('entityId')
    });
    sendJson(res, 200, { success: true, entries });
}

// ---------------------------------------------------------------------------
// Super Admin grants and role preview
// ---------------------------------------------------------------------------

// POST /api/super-admins          { userId, password }            make someone Super Admin
// POST /api/super-admins/revoke   { userId, newRole, password }   take Super Admin away (never the last one)
async function handleSuperAdmins(req, res, url) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { success: false, error: 'Method not allowed' });
        return;
    }
    const body = await readJson(req);
    const actor = req.auth.preview ? null : req.auth.user;
    if (!actor) {
        sendJson(res, 403, { success: false, error: 'Leave the role preview first.' });
        return;
    }
    const result = url.pathname === '/api/super-admins/revoke'
        ? await roles.revokeSuperAdmin(actor, String(body.userId || ''), body.newRole, body.password, req)
        : await roles.grantSuperAdmin(actor, String(body.userId || ''), body.password, req);
    sendJson(res, result.ok ? 200 : result.status, result.ok ? { success: true } : { success: false, error: result.error });
}

// POST /api/preview { roleId, userId? }  see the portal as a role sees it (read-only)
// DELETE /api/preview                     back to your own view
async function handlePreview(req, res) {
    const real = req.auth.realUser || req.auth.user;
    if (req.method === 'DELETE') {
        if (req.auth.preview) {
            await auth.setPreview(req, null, null);
            await audit.log({ req, actor: { id: real.id, role: real.role }, action: 'preview.end', entityType: 'role', entityId: req.auth.preview.roleId, summary: `Ended preview of ${req.auth.preview.roleId}` });
        }
        sendJson(res, 200, { success: true });
        return;
    }
    if (req.method !== 'POST') {
        sendJson(res, 405, { success: false, error: 'Method not allowed' });
        return;
    }
    if (!roles.isSuperAdminUser(real)) {
        sendJson(res, 403, { success: false, error: 'Only a Super Admin can preview roles.' });
        return;
    }
    const body = await readJson(req);
    const roleId = String(body.roleId || '').toUpperCase();
    const role = roles.getRole(roleId);
    if (!role) {
        sendJson(res, 404, { success: false, error: 'Role not found.' });
        return;
    }
    // Preview through a real person of that role (their classes / own records), or with no one's records
    const users = await loadCollection('users');
    let target = null;
    if (body.userId) {
        target = users.find(u => u.id === body.userId && roles.rolesOfUser(u).includes(roleId));
        if (!target) {
            sendJson(res, 400, { success: false, error: 'That person does not hold this role.' });
            return;
        }
    } else {
        target = users.find(u => roles.rolesOfUser(u).includes(roleId) && !auth.INACTIVE_STATUSES.includes(u.status)) || null;
    }
    await auth.setPreview(req, roleId, target ? target.id : null);
    await audit.log({
        req, actor: { id: real.id, role: real.role }, action: 'preview.start', entityType: 'role', entityId: roleId,
        summary: `Previewing ${role.name}${target ? ` as ${target.name || target.id}` : ''} (read-only)`
    });
    sendJson(res, 200, { success: true, roleId, userId: target ? target.id : null });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function route(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const p = url.pathname;
    const m = req.method;

    if (p === '/api/store' && m === 'GET') { await handleStorePull(req, res, url); return true; }
    if (p === '/api/store/sync' && m === 'POST') { await handleStoreSync(req, res); return true; }
    if (p === '/api/auth/login' && m === 'POST') { await handleLogin(req, res); return true; }
    if (p === '/api/auth/logout' && m === 'POST') { await handleLogout(req, res); return true; }
    if (p === '/api/auth/me' && m === 'GET') { await handleMe(req, res); return true; }
    if (p === '/api/auth/change-password' && m === 'POST') { await handleChangePassword(req, res); return true; }
    if (p === '/api/roles' || p.startsWith('/api/roles/')) { await handleRoles(req, res, url); return true; }
    if (p === '/api/audit' && m === 'GET') { await handleAudit(req, res, url); return true; }
    if (p.startsWith('/api/super-admins')) { await handleSuperAdmins(req, res, url); return true; }
    if (p === '/api/preview') { await handlePreview(req, res); return true; }
    if (p === '/api/permissions') {
        // Replaced by /api/roles (roles and their permissions are stored in their own tables)
        sendJson(res, 410, { success: false, error: 'This endpoint was replaced by /api/roles. Reload the portal.' });
        return true;
    }
    if (p === '/api/uploads' && m === 'POST') { await handleUpload(req, res); return true; }

    if (p === '/api/notifications' && m === 'GET') { await handleNotificationsGet(req, res, url); return true; }
    if (p === '/api/notifications' && m === 'POST') { await handleNotificationsPost(req, res); return true; }
    if (p === '/api/notifications/read' && m === 'POST') { await handleNotificationsRead(req, res); return true; }

    if (p === '/api/settings/admissions' && m === 'GET') {
        sendJson(res, 200, { success: true, settings: await getAdmissionSettings() });
        return true;
    }
    if (p === '/api/settings/admissions' && m === 'POST') {
        if (!can(req, 'settings.admissions')) {
            sendJson(res, 403, { success: false, error: 'You are not allowed to open or close admissions.' });
            return true;
        }
        const body = await readJson(req);
        const current = await getAdmissionSettings();
        const next = { ...current, ...body };
        delete next.isAcceptingApplications;
        next.registrationFee = Math.max(0, Number(next.registrationFee) || 0);
        next.admissionFee = Math.max(0, Number(next.admissionFee) || 0);
        next.isOpen = !!next.isOpen;
        await saveSetting('admissions', next);
        await audit.log({ req, action: 'settings.admissions', entityType: 'settings', entityId: 'admissions', summary: `Admissions ${next.isOpen ? 'open' : 'closed'} (deadline ${next.deadline || '—'})`, before: current, after: next });
        sendJson(res, 200, { success: true, settings: await getAdmissionSettings() });
        return true;
    }
    // Live classroom service: public meet.jit.si cannot be embedded (5-minute limit), so it opens in a new tab;
    // a self-hosted Jitsi or JaaS domain may be embedded inside the portal
    if (p === '/api/settings/meeting' && m === 'GET') {
        sendJson(res, 200, { success: true, settings: { domain: 'meet.jit.si', embed: false, ...(await getSetting('meeting', {})) } });
        return true;
    }
    if (p === '/api/settings/meeting' && m === 'POST') {
        if (!can(req, 'settings.meetings')) {
            sendJson(res, 403, { success: false, error: 'You are not allowed to change the live classroom service.' });
            return true;
        }
        const body = await readJson(req);
        const domain = String(body.domain || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
            sendJson(res, 400, { success: false, error: 'Enter a valid domain, e.g. meet.jit.si or meet.yourschool.org' });
            return true;
        }
        const settings = { domain, embed: !!body.embed && domain !== 'meet.jit.si' };
        await saveSetting('meeting', settings);
        await audit.log({ req, action: 'settings.meetings', entityType: 'settings', entityId: 'meeting', summary: `Live class service: ${domain}`, after: settings });
        sendJson(res, 200, { success: true, settings });
        return true;
    }
    if (p === '/api/admissions/status' && m === 'GET') { await handleAdmissionStatus(req, res, url); return true; }
    if (p === '/api/admissions' && m === 'POST') {
        // Gate public applications on the admissions window; the original handler then stores them
        const settings = await getAdmissionSettings();
        // Office staff may still record applications while the public window is closed
        if (!settings.isAcceptingApplications && !can(req, 'settings.admissions') && !can(req, 'admissions.update')) {
            sendJson(res, 403, { success: false, status: 'error', error: settings.closedMessage || 'Admissions are currently closed.' });
            return true;
        }
        return false;
    }

    if (p === '/api/virtual-class/verify-access' && m === 'POST') { await handleVirtualVerify(req, res); return true; }

    return false;
}

async function handle(req, res) {
    try {
        return await route(req, res);
    } catch (err) {
        const status = err.status || 500;
        if (status === 500) console.error('[LMS API]', req.method, req.url, err);
        if (!res.headersSent) {
            const dbDown = /ECONNREFUSED|ER_ACCESS_DENIED|ER_BAD_DB|PROTOCOL_CONNECTION_LOST|ETIMEDOUT/.test(String(err.code || err.message));
            sendJson(res, dbDown ? 503 : status, {
                success: false,
                error: dbDown ? 'Database unavailable' : (status === 500 ? 'Server error' : err.message),
                fallback: dbDown
            });
        }
        return true;
    }
}

module.exports = { handle, getSetting, saveSetting, ensureSchema, SYNC_COLLECTIONS };
