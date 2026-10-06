/**
 * JAMIA ASHRAFIA LAHORE - SERVER-SIDE AUTHENTICATION
 * - Sessions: random token in an HttpOnly cookie, only its SHA-256 hash is stored
 * - The signed-in user is always loaded from the database, never taken from request headers
 * - Login throttling, password policy, forced password change, session revocation
 */

const crypto = require('crypto');
const db = require('../database/db');

const COOKIE_NAME = 'jamia_sid';
const SESSION_HOURS = 12;
const MIN_PASSWORD_LENGTH = 8;

// Login throttling: 5 failures within 15 minutes locks that identifier (and, separately, the IP) for 15 minutes
const MAX_FAILURES = 5;
const IP_MAX_FAILURES = 20;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const failures = new Map(); // key -> { count, first, lockedUntil }

const INACTIVE_STATUSES = ['SUSPENDED', 'INACTIVE'];

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

async function columnExists(table, column) {
    const [rows] = await db.query(
        `SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    return rows[0].c > 0;
}

// Called from lms-api ensureSchema() after user_credentials exists
async function ensureAuthSchema() {
    await db.query(`CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash CHAR(64) PRIMARY KEY,
        user_id VARCHAR(120) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        ip VARCHAR(64) NULL,
        user_agent VARCHAR(255) NULL,
        INDEX idx_auth_sessions_user (user_id),
        INDEX idx_auth_sessions_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    if (!(await columnExists('auth_sessions', 'preview_role'))) {
        await db.query(`ALTER TABLE auth_sessions ADD COLUMN preview_role VARCHAR(60) NULL, ADD COLUMN preview_user VARCHAR(120) NULL`);
    }
    if (!(await columnExists('user_credentials', 'must_change'))) {
        await db.query(`ALTER TABLE user_credentials ADD COLUMN must_change TINYINT(1) NOT NULL DEFAULT 0`);
    }
}

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

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

// Returns an error message, or null when the password is acceptable
function passwordProblem(password) {
    const p = String(password || '');
    if (p.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (p.length > 200) return 'Password is too long.';
    if (/^(.)\1+$/.test(p)) return 'Password cannot be a single repeated character.';
    return null;
}

// Readable temporary password (no 0/O, 1/l/I) for accounts created or reset by an administrator
function temporaryPassword(length = 10) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(length);
    return Array.from(bytes, b => chars[b % chars.length]).join('');
}

// mustChange: the user has to choose a new password at next sign-in
async function setPassword(conn, userId, password, mustChange) {
    await (conn || db).query(
        `INSERT INTO user_credentials (user_id, password_hash, must_change) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), must_change = VALUES(must_change)`,
        [userId, hashPassword(password), mustChange ? 1 : 0]
    );
}

async function getCredential(userId) {
    const [rows] = await db.query(`SELECT password_hash, must_change FROM user_credentials WHERE user_id = ?`, [userId]);
    return rows[0] || null;
}

// ---------------------------------------------------------------------------
// Login throttling
// ---------------------------------------------------------------------------

function clientIp(req) {
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return fwd || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function entry(key) {
    const now = Date.now();
    let e = failures.get(key);
    if (!e || (now - e.first > FAILURE_WINDOW_MS && (!e.lockedUntil || e.lockedUntil < now))) {
        e = { count: 0, first: now, lockedUntil: 0 };
        failures.set(key, e);
    }
    return e;
}

// Seconds until the identifier / IP may try again, or 0 when not locked
function lockedFor(ip, identifier) {
    const now = Date.now();
    const keys = [`id:${identifier}`, `ip:${ip}`];
    let wait = 0;
    keys.forEach(k => {
        const e = failures.get(k);
        if (e && e.lockedUntil > now) wait = Math.max(wait, Math.ceil((e.lockedUntil - now) / 1000));
    });
    return wait;
}

function recordFailure(ip, identifier) {
    const now = Date.now();
    [[`id:${identifier}`, MAX_FAILURES], [`ip:${ip}`, IP_MAX_FAILURES]].forEach(([k, max]) => {
        const e = entry(k);
        e.count += 1;
        if (e.count >= max) e.lockedUntil = now + FAILURE_WINDOW_MS;
    });
}

function clearFailures(ip, identifier) {
    failures.delete(`id:${identifier}`);
    // The IP counter is left alone so one valid account cannot be used to reset guessing on others
}

// Forget stale entries so the map cannot grow without bound
setInterval(() => {
    const now = Date.now();
    failures.forEach((e, k) => {
        if (now - e.first > FAILURE_WINDOW_MS && e.lockedUntil < now) failures.delete(k);
    });
}, FAILURE_WINDOW_MS).unref();

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

function tokenHash(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function parseCookies(req) {
    const out = {};
    String(req.headers.cookie || '').split(';').forEach(part => {
        const i = part.indexOf('=');
        if (i < 0) return;
        const k = part.slice(0, i).trim();
        if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
    });
    return out;
}

function isHttps(req) {
    return !!(req.socket && req.socket.encrypted) || String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
}

function sessionCookie(req, token, maxAgeSeconds) {
    const parts = [
        `${COOKIE_NAME}=${token ? encodeURIComponent(token) : ''}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Strict',
        `Max-Age=${maxAgeSeconds}`
    ];
    if (isHttps(req)) parts.push('Secure');
    return parts.join('; ');
}

async function createSession(req, res, userId) {
    // A new sign-in always gets a new token; any session this browser held before is ended
    const previous = parseCookies(req)[COOKIE_NAME];
    if (previous) await db.query(`DELETE FROM auth_sessions WHERE token_hash = ?`, [tokenHash(previous)]);
    const token = crypto.randomBytes(32).toString('hex');
    await db.query(
        `INSERT INTO auth_sessions (token_hash, user_id, expires_at, ip, user_agent)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?, ?)`,
        [tokenHash(token), userId, SESSION_HOURS, clientIp(req).slice(0, 64), String(req.headers['user-agent'] || '').slice(0, 255)]
    );
    res.setHeader('Set-Cookie', sessionCookie(req, token, SESSION_HOURS * 3600));
    // Opportunistic cleanup of expired sessions
    db.query(`DELETE FROM auth_sessions WHERE expires_at < NOW()`).catch(() => {});
}

async function destroySession(req, res) {
    const token = parseCookies(req)[COOKIE_NAME];
    if (token) await db.query(`DELETE FROM auth_sessions WHERE token_hash = ?`, [tokenHash(token)]);
    res.setHeader('Set-Cookie', sessionCookie(req, '', 0));
}

// Ends every session of a user (deactivation, password reset). keepReq keeps the caller's own session.
async function revokeUserSessions(userId, keepReq) {
    const keep = keepReq ? parseCookies(keepReq)[COOKIE_NAME] : null;
    if (keep) {
        await db.query(`DELETE FROM auth_sessions WHERE user_id = ? AND token_hash <> ?`, [userId, tokenHash(keep)]);
    } else {
        await db.query(`DELETE FROM auth_sessions WHERE user_id = ?`, [userId]);
    }
}

async function loadUser(userId) {
    const [rows] = await db.query(
        `SELECT data FROM lms_records WHERE collection = 'users' AND id = ? AND deleted = 0`,
        [userId]
    );
    return rows.length ? JSON.parse(rows[0].data) : null;
}

/**
 * Resolves the session cookie to { id, role, user, mustChange } or null.
 * A deleted or deactivated account has no valid session, whatever its cookie says.
 */
async function resolveSession(req) {
    const token = parseCookies(req)[COOKIE_NAME];
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const hash = tokenHash(token);
    const [rows] = await db.query(
        `SELECT s.user_id, s.last_seen_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE) AS stale, c.must_change, s.preview_role, s.preview_user
         FROM auth_sessions s LEFT JOIN user_credentials c ON c.user_id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > NOW()`,
        [hash]
    );
    if (!rows.length) return null;
    const user = await loadUser(rows[0].user_id);
    if (!user || INACTIVE_STATUSES.includes(user.status)) {
        await db.query(`DELETE FROM auth_sessions WHERE token_hash = ?`, [hash]);
        return null;
    }
    if (Number(rows[0].stale)) {
        db.query(`UPDATE auth_sessions SET last_seen_at = NOW() WHERE token_hash = ?`, [hash]).catch(() => {});
    }
    const safeUser = { ...user };
    delete safeUser.password;
    return {
        id: String(user.id),
        role: String(user.role || '').toUpperCase(),
        user: safeUser,
        mustChange: !!Number(rows[0].must_change),
        // A Super Admin looking at the portal as a role sees it (server.js applies this, read-only)
        previewRequest: rows[0].preview_role ? { roleId: rows[0].preview_role, userId: rows[0].preview_user || null } : null
    };
}

async function setPreview(req, roleId, userId) {
    const token = parseCookies(req)[COOKIE_NAME];
    if (!token) return;
    await db.query(`UPDATE auth_sessions SET preview_role = ?, preview_user = ? WHERE token_hash = ?`, [roleId || null, userId || null, tokenHash(token)]);
}

module.exports = {
    COOKIE_NAME,
    MIN_PASSWORD_LENGTH,
    INACTIVE_STATUSES,
    ensureAuthSchema,
    hashPassword,
    verifyPassword,
    passwordProblem,
    temporaryPassword,
    setPassword,
    getCredential,
    clientIp,
    lockedFor,
    recordFailure,
    clearFailures,
    createSession,
    destroySession,
    revokeUserSessions,
    resolveSession,
    setPreview,
    loadUser
};
