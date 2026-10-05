/**
 * JAMIA ASHRAFIA LAHORE - SHARED LMS API (MySQL / MariaDB backed)
 * - Multi-user record store (classes, courses, assignments, exams, fees, library, timetable, virtual classes)
 * - Server-side login with hashed credentials
 * - File uploads (assignments, exam papers, e-books, payment proofs, course material)
 * - Targeted notifications (role / class / individual user) with per-user read state
 * - Admissions open/closed settings, public application status tracker
 *
 * handle(req, res) resolves to true when the request was answered here,
 * otherwise server.js continues with its own routes and static files.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../database/db');

const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads');
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const DEFAULT_PASSWORD = 'ashrafia123';

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

const ADMIN_ROLES = ['SUPER_ADMIN', 'ACADEMIC_ADMIN'];

// Which collections each role may write. Students/teachers are further limited to their own records below.
const WRITE_POLICY = {
    STUDENT: ['users', 'assignmentSubmissions', 'examSubmissions', 'libraryLoans', 'feeChallans', 'attendance', 'donations'],
    TEACHER: ['users', 'courseMaterials', 'assignments', 'assignmentSubmissions', 'exams', 'examSubmissions', 'examResults',
        'attendance', 'virtualClasses', 'virtualClassRecordings', 'libraryLoans', 'donations'],
    ACCOUNTANT: ['users', 'feeStructures', 'feeChallans', 'donations', 'attendance'],
    LIBRARIAN: ['users', 'libraryBooks', 'libraryLoans', 'attendance']
};

// Fields a student may never set themselves (grades, verification, issue dates ...)
const STUDENT_PROTECTED = {
    assignmentSubmissions: ['isGraded', 'marksObtained', 'feedback', 'wifaqGrade', 'gradedBy', 'gradedAt', 'returnedFile'],
    examSubmissions: ['isMarked', 'questionMarks', 'marksObtained', 'remarks', 'markedBy', 'markedAt'],
    libraryLoans: ['issuedAt', 'issuedBy', 'dueDate', 'returnedAt', 'fine'],
    users: ['role', 'status', 'classId', 'rollNo', 'branchId', 'program', 'assignedCourses', 'designation'],
    feeChallans: ['tuitionFee', 'hostelMessFee', 'examFee', 'registrationFee', 'admissionFee', 'otherFee', 'items',
        'scholarshipWaiver', 'netPayable', 'paidAt', 'bankRef', 'verifiedBy', 'verifiedAt', 'studentId', 'challanNumber', 'dueDate']
};
const STAFF_SELF_PROTECTED = ['role', 'status', 'assignedCourses'];

// Which field ties a record to its owner, for student-level writes
const OWNER_FIELD = {
    users: 'id',
    assignmentSubmissions: 'studentId',
    examSubmissions: 'studentId',
    libraryLoans: 'userId',
    feeChallans: 'studentId',
    attendance: 'userId'
};

// Private per-student collections: a student only downloads records they own
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

function caller(req) {
    return {
        id: String(req.headers['x-user-id'] || '').trim(),
        role: String(req.headers['x-user-role'] || '').trim().toUpperCase()
    };
}

function isAdmin(role) {
    return ADMIN_ROLES.includes(role);
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
    const [scheme, salt, hash] = String(stored || '').split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const test = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return expected.length === test.length && crypto.timingSafeEqual(expected, test);
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

function stripSecrets(collection, record) {
    if (collection !== 'users' || !record) return record;
    const copy = { ...record };
    delete copy.password;
    return copy;
}

async function handleStorePull(req, res, url) {
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

    const who = caller(req);
    const isStudent = who.role === 'STUDENT';
    const collections = {};
    const deleted = {};
    const present = new Set();
    rows.forEach(r => {
        present.add(r.collection);
        if (r.deleted) {
            (deleted[r.collection] = deleted[r.collection] || []).push(r.id);
            return;
        }
        let rec = stripSecrets(r.collection, JSON.parse(r.data));
        if (isStudent) {
            // Students only receive their own private records ...
            const ownerField = STUDENT_SCOPED[r.collection];
            if (ownerField && rec[ownerField] !== who.id) return;
            // ... and never the answer key of an exam whose results are not yet published
            if (r.collection === 'exams' && !rec.resultsPublished && Array.isArray(rec.questions)) {
                rec = { ...rec, questions: rec.questions.map(q => { const c = { ...q }; delete c.correctIndex; return c; }) };
            }
            if (r.collection === 'examResults' && !rec.published) return;
        }
        (collections[r.collection] = collections[r.collection] || []).push(rec);
    });

    sendJson(res, 200, {
        success: true,
        serverTime: now,
        full: !since,
        presentCollections: since ? undefined : Array.from(present),
        scope: isStudent ? { ...STUDENT_SCOPED, examResults: 'studentId' } : undefined,
        collections,
        deleted
    });
}

function applyOwnRecordRules(collection, role, userId, incoming, existing) {
    const protectedFields = role === 'STUDENT'
        ? (STUDENT_PROTECTED[collection] || [])
        : (collection === 'users' ? STAFF_SELF_PROTECTED : []);
    const merged = { ...incoming };
    // Links to the assignment / exam / book and the owner never change after creation
    if (existing) {
        ['assignmentId', 'examId', 'bookId', 'studentId', 'userId', 'donorUserId'].forEach(f => {
            if (Object.prototype.hasOwnProperty.call(existing, f)) merged[f] = existing[f];
        });
    }
    protectedFields.forEach(f => {
        if (existing && Object.prototype.hasOwnProperty.call(existing, f)) merged[f] = existing[f];
        else delete merged[f];
    });

    if (role === 'STUDENT' && collection === 'feeChallans') {
        // Students may only submit payment proof for verification
        const allowedStatus = ['VERIFICATION_PENDING'];
        merged.status = allowedStatus.includes(incoming.status) ? incoming.status : (existing ? existing.status : 'PENDING');
    }
    if (role === 'STUDENT' && collection === 'libraryLoans') {
        const allowedStatus = ['REQUESTED', 'CANCELLED'];
        merged.status = allowedStatus.includes(incoming.status) ? incoming.status : (existing ? existing.status : 'REQUESTED');
    }
    if (collection === 'attendance' && !existing && role !== 'TEACHER') {
        merged.userId = userId;
    }
    return merged;
}

function canWriteRecord(collection, who, incoming, existing) {
    if (isAdmin(who.role)) return true;
    const allowed = WRITE_POLICY[who.role] || ['users'];
    if (!allowed.includes(collection)) return false;

    // Teachers manage their own teaching data; attendance & grading of any student is allowed
    if (who.role === 'TEACHER') {
        if (collection === 'users') return incoming.id === who.id;
        if (collection === 'libraryLoans') return (existing || incoming).userId === who.id;
        return true;
    }
    if (who.role === 'ACCOUNTANT' || who.role === 'LIBRARIAN') {
        if (collection === 'users') return incoming.id === who.id;
        return true;
    }

    // Students: donations are create-only, everything else must belong to them
    if (collection === 'donations') return !existing;
    const ownerField = OWNER_FIELD[collection];
    if (!ownerField) return false;
    const owner = existing ? existing[ownerField] : incoming[ownerField];
    return owner === who.id && incoming[ownerField] === who.id;
}

async function handleStoreSync(req, res) {
    const who = caller(req);
    if (!who.id || !who.role) {
        sendJson(res, 401, { success: false, error: 'Authentication headers missing' });
        return;
    }
    await ensureSchema();
    const body = await readJson(req);
    const upserts = body.upserts || {};
    const deletes = body.deletes || {};
    const result = { accepted: {}, rejected: {} };

    const conn = await db.getConnection();
    try {
        for (const collection of Object.keys(upserts)) {
            if (!SYNC_COLLECTIONS.includes(collection) || !Array.isArray(upserts[collection])) continue;
            for (const raw of upserts[collection]) {
                if (!raw || typeof raw !== 'object' || !raw.id) continue;
                const id = String(raw.id).slice(0, 120);
                const [rows] = await conn.execute(`SELECT data, deleted FROM lms_records WHERE collection = ? AND id = ?`, [collection, id]);
                const existing = rows.length ? JSON.parse(rows[0].data) : null;

                if (!canWriteRecord(collection, who, raw, existing)) {
                    (result.rejected[collection] = result.rejected[collection] || []).push(id);
                    continue;
                }

                let record = { ...raw, id };
                if (!isAdmin(who.role)) {
                    const ownRules = who.role === 'STUDENT' || collection === 'users';
                    if (ownRules) record = applyOwnRecordRules(collection, who.role, who.id, record, existing);
                }

                if (collection === 'users') {
                    if (record.password) {
                        const canSetPassword = isAdmin(who.role) || record.id === who.id;
                        if (canSetPassword) {
                            await conn.execute(
                                `INSERT INTO user_credentials (user_id, password_hash) VALUES (?, ?)
                                 ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
                                [record.id, hashPassword(record.password)]
                            );
                        }
                    }
                    delete record.password;
                }

                await conn.execute(
                    `INSERT INTO lms_records (collection, id, data, deleted, updated_by, updated_at)
                     VALUES (?, ?, ?, 0, ?, NOW(3))
                     ON DUPLICATE KEY UPDATE data = VALUES(data), deleted = 0, updated_by = VALUES(updated_by), updated_at = NOW(3)`,
                    [collection, id, JSON.stringify(record), who.id]
                );
                (result.accepted[collection] = result.accepted[collection] || []).push(id);
            }
        }

        for (const collection of Object.keys(deletes)) {
            if (!SYNC_COLLECTIONS.includes(collection) || !Array.isArray(deletes[collection])) continue;
            for (const rawId of deletes[collection]) {
                const id = String(rawId).slice(0, 120);
                const [rows] = await conn.execute(`SELECT data FROM lms_records WHERE collection = ? AND id = ?`, [collection, id]);
                if (!rows.length) {
                    (result.accepted[collection] = result.accepted[collection] || []).push(id);
                    continue;
                }
                const existing = JSON.parse(rows[0].data);
                const allowed = isAdmin(who.role)
                    || (who.role !== 'STUDENT' && (WRITE_POLICY[who.role] || []).includes(collection) && collection !== 'users')
                    || (who.role === 'STUDENT' && collection === 'libraryLoans' && existing.userId === who.id && existing.status === 'REQUESTED');
                if (!allowed) {
                    (result.rejected[collection] = result.rejected[collection] || []).push(id);
                    continue;
                }
                await conn.execute(
                    `UPDATE lms_records SET deleted = 1, updated_by = ?, updated_at = NOW(3) WHERE collection = ? AND id = ?`,
                    [who.id, collection, id]
                );
                (result.accepted[collection] = result.accepted[collection] || []).push(id);
            }
        }
    } finally {
        conn.release();
    }

    sendJson(res, 200, { success: true, ...result });
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

async function handleLogin(req, res) {
    await ensureSchema();
    const body = await readJson(req);
    const identifier = String(body.identifier || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!identifier || !password) {
        sendJson(res, 400, { success: false, error: 'Username / ID and password are required.' });
        return;
    }

    const users = await loadCollection('users');
    if (!users.length) {
        // Store not seeded yet: let the browser fall back to its local directory
        sendJson(res, 503, { success: false, error: 'User directory not initialised on server yet.', fallback: true });
        return;
    }

    const user = users.find(u =>
        (u.rollNo && u.rollNo.toLowerCase() === identifier) ||
        (u.email && u.email.toLowerCase() === identifier) ||
        (u.id && u.id.toLowerCase() === identifier) ||
        (u.username && u.username.toLowerCase() === identifier)
    );
    if (!user) {
        sendJson(res, 401, { success: false, error: 'No account found for this Username / Roll No / Email.' });
        return;
    }

    const [cred] = await db.query(`SELECT password_hash FROM user_credentials WHERE user_id = ?`, [user.id]);
    const ok = cred.length ? verifyPassword(password, cred[0].password_hash) : password === DEFAULT_PASSWORD;
    if (!ok) {
        sendJson(res, 401, { success: false, error: 'Incorrect password. Please verify your credentials or contact the administrator.' });
        return;
    }
    if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
        sendJson(res, 403, { success: false, error: `This account is currently ${user.status}. Please contact the Academic Office.` });
        return;
    }

    sendJson(res, 200, {
        success: true,
        token: crypto.randomBytes(24).toString('hex'),
        user: stripSecrets('users', user),
        mustChangePassword: !cred.length
    });
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
    const classIds = String(req.headers['x-user-class'] || '').split(',').map(s => s.trim()).filter(Boolean);

    let roleList = [who.role, 'ALL'];
    if (who.role === 'SUPER_ADMIN') roleList = ['SUPER_ADMIN', 'ACADEMIC_ADMIN', 'ALL'];
    if (who.role === 'STUDENT' || who.role === 'TEACHER') roleList.push('STUDENTS_AND_TEACHERS');

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
    const ids = [];
    for (const n of items) {
        if (!n || !n.title || !n.message) continue;
        const targetRole = String(n.targetRole || 'ALL').toUpperCase();
        // Broadcasts to whole roles / everyone are for staff; anyone may notify an individual (e.g. "assignment submitted")
        const isBroadcast = !n.targetUserId;
        if (isBroadcast && !isAdmin(who.role)) {
            const teacherClassNotice = who.role === 'TEACHER' && n.targetClassId;
            const accountsNotice = who.role === 'ACCOUNTANT' && ['STUDENT', 'ALL'].includes(targetRole);
            // Anyone may alert the office inboxes (library requests, payment proofs, ...)
            const officeNotice = !n.targetClassId && ['ACADEMIC_ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT', 'LIBRARIAN'].includes(targetRole);
            if (!teacherClassNotice && !accountsNotice && !officeNotice) {
                sendJson(res, 403, { success: false, error: 'You are not allowed to broadcast to this audience.' });
                return;
            }
        }
        ids.push(await insertNotification({ ...n, targetRole, senderId: who.id }));
    }
    sendJson(res, 201, { success: true, ids });
}

async function handleNotificationsRead(req, res) {
    const who = caller(req);
    if (!who.role) {
        sendJson(res, 401, { error: '401 Unauthorized' });
        return;
    }
    await ensureSchema();
    const body = await readJson(req);
    const userId = who.id || who.role;
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
    const role = who.role || String(body.role || '').toUpperCase();
    const userId = who.id || body.userId;

    const sessionRec = body.sessionId ? await loadRecord('virtualClasses', body.sessionId) : null;
    const session = sessionRec && !sessionRec.deleted ? sessionRec.data : null;
    if (!session) {
        // Unknown on server (e.g. store not seeded yet): trust the class supplied by the browser
        return false;
    }

    if (isAdmin(role)) {
        sendJson(res, 200, { status: 'success', authorized: true, isHost: true, session });
        return true;
    }

    const userRec = userId ? await loadRecord('users', userId) : null;
    const user = userRec ? userRec.data : null;
    const clsRec = session.classId ? await loadRecord('classes', session.classId) : null;
    const cls = clsRec ? clsRec.data : null;

    if (role === 'TEACHER') {
        const teachesCourse = cls && Array.isArray(cls.courseTeachers) && cls.courseTeachers.some(ct => ct.teacherId === userId);
        if (session.hostId === userId || (cls && cls.teacherId === userId) || teachesCourse) {
            sendJson(res, 200, { status: 'success', authorized: true, isHost: true, session });
        } else {
            sendJson(res, 403, { error: '403 Forbidden', message: 'Access Denied: You are not assigned to instruct or moderate this classroom.' });
        }
        return true;
    }

    const enrolledClass = user ? user.classId : body.userClassId;
    if (enrolledClass && enrolledClass === session.classId) {
        sendJson(res, 200, { status: 'success', authorized: true, isHost: false, session });
    } else {
        sendJson(res, 403, { error: '403 Forbidden', message: 'Access Denied: You are not enrolled in this class, so this live session is restricted.' });
    }
    return true;
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
    if (p === '/api/uploads' && m === 'POST') { await handleUpload(req, res); return true; }

    if (p === '/api/notifications' && m === 'GET') { await handleNotificationsGet(req, res, url); return true; }
    if (p === '/api/notifications' && m === 'POST') { await handleNotificationsPost(req, res); return true; }
    if (p === '/api/notifications/read' && m === 'POST') { await handleNotificationsRead(req, res); return true; }

    if (p === '/api/settings/admissions' && m === 'GET') {
        sendJson(res, 200, { success: true, settings: await getAdmissionSettings() });
        return true;
    }
    if (p === '/api/settings/admissions' && m === 'POST') {
        const who = caller(req);
        if (!isAdmin(who.role)) {
            sendJson(res, 403, { success: false, error: 'Only administrators can open or close admissions.' });
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
        const who = caller(req);
        if (!isAdmin(who.role)) {
            sendJson(res, 403, { success: false, error: 'Only administrators can change the live classroom service.' });
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
        sendJson(res, 200, { success: true, settings });
        return true;
    }
    if (p === '/api/admissions/status' && m === 'GET') { await handleAdmissionStatus(req, res, url); return true; }
    if (p === '/api/admissions' && m === 'POST') {
        // Gate public applications on the admissions window; the original handler then stores them
        const settings = await getAdmissionSettings();
        const who = caller(req);
        if (!settings.isAcceptingApplications && !isAdmin(who.role)) {
            sendJson(res, 403, { success: false, status: 'error', error: settings.closedMessage || 'Admissions are currently closed.' });
            return true;
        }
        return false;
    }

    if (p === '/api/virtual-class/verify-access' && m === 'POST') {
        // Body is consumed here, so answer even when the session is unknown to the store
        const handled = await handleVirtualVerify(req, res);
        if (!handled) sendJson(res, 200, { status: 'success', authorized: true, unverified: true });
        return true;
    }

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
