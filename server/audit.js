/**
 * JAMIA ASHRAFIA LAHORE - AUDIT LOG
 * Append-only record of security-relevant events, written by the server only.
 * Passwords and password hashes are never written here.
 */

const db = require('../database/db');

async function ensureAuditSchema() {
    await db.query(`CREATE TABLE IF NOT EXISTS audit_log (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        actor_id VARCHAR(120) NULL,
        actor_role VARCHAR(60) NULL,
        action VARCHAR(64) NOT NULL,
        entity_type VARCHAR(64) NULL,
        entity_id VARCHAR(120) NULL,
        summary VARCHAR(500) NULL,
        before_json LONGTEXT NULL,
        after_json LONGTEXT NULL,
        ip VARCHAR(64) NULL,
        user_agent VARCHAR(255) NULL,
        INDEX idx_audit_time (occurred_at),
        INDEX idx_audit_actor (actor_id),
        INDEX idx_audit_entity (entity_type, entity_id),
        INDEX idx_audit_action (action)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

const SECRET_KEYS = ['password', 'password_hash', 'passwordHash', 'token'];

function clean(value) {
    if (value === undefined || value === null) return null;
    const copy = JSON.parse(JSON.stringify(value));
    const strip = o => {
        if (!o || typeof o !== 'object') return;
        SECRET_KEYS.forEach(k => { if (k in o) o[k] = '[removed]'; });
        Object.values(o).forEach(strip);
    };
    strip(copy);
    return JSON.stringify(copy).slice(0, 60000);
}

function requestInfo(req) {
    if (!req) return { ip: null, ua: null };
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return {
        ip: (fwd || (req.socket && req.socket.remoteAddress) || '').slice(0, 64) || null,
        ua: String(req.headers['user-agent'] || '').slice(0, 255) || null
    };
}

/**
 * log({ req, actor: { id, role }, action, entityType, entityId, summary, before, after })
 * Never throws: an audit failure is reported on the console and does not undo the action.
 */
async function log(entry) {
    try {
        const { ip, ua } = requestInfo(entry.req);
        const actor = entry.actor || (entry.req && entry.req.auth) || {};
        await db.query(
            `INSERT INTO audit_log (actor_id, actor_role, action, entity_type, entity_id, summary, before_json, after_json, ip, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [actor.id || null, actor.role || null, String(entry.action).slice(0, 64), entry.entityType || null,
                entry.entityId ? String(entry.entityId).slice(0, 120) : null, entry.summary ? String(entry.summary).slice(0, 500) : null,
                clean(entry.before), clean(entry.after), ip, ua]
        );
    } catch (err) {
        console.error('[Audit] Could not record', entry.action, err.message);
    }
}

async function list({ limit = 100, before = null, action = null, actor = null, entityType = null, entityId = null } = {}) {
    const where = [];
    const params = [];
    if (before) { where.push('id < ?'); params.push(Number(before)); }
    if (action) { where.push('action LIKE ?'); params.push(`${action}%`); }
    if (actor) { where.push('actor_id = ?'); params.push(actor); }
    if (entityType) { where.push('entity_type = ?'); params.push(entityType); }
    if (entityId) { where.push('entity_id = ?'); params.push(entityId); }
    const n = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const [rows] = await db.query(
        `SELECT id, DATE_FORMAT(occurred_at, '%Y-%m-%d %H:%i:%s') AS occurredAt, actor_id AS actorId, actor_role AS actorRole,
                action, entity_type AS entityType, entity_id AS entityId, summary, before_json AS beforeJson, after_json AS afterJson, ip
         FROM audit_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ${n}`,
        params
    );
    return rows.map(r => ({
        ...r,
        before: r.beforeJson ? JSON.parse(r.beforeJson) : null,
        after: r.afterJson ? JSON.parse(r.afterJson) : null,
        beforeJson: undefined,
        afterJson: undefined
    }));
}

module.exports = { ensureAuditSchema, log, list };
