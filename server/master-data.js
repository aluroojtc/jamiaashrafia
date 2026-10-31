/**
 * JAMIA ASHRAFIA LAHORE - MASTER DATA, INSTITUTION PROFILE & RECORDING RETENTION
 *
 * - Branches, departments, academic programmes and sessions live in their own SQL tables. Everyone may read
 *   them (the public admission form needs them); changing them needs settings.master_data.
 * - The institution profile (name, contact details, current leadership) is a setting; changing it needs
 *   settings.master_data as well.
 * - Recording retention: how long lecture recordings are kept, and the clean-up that removes expired ones
 *   from the record store and the uploads folder (settings.recordings).
 *
 * Nothing here is edited in code: the Super Admin manages it from Institution Setup in the portal.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../database/db');
const audit = require('./audit');

const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads');

// ---------------------------------------------------------------------------
// Entity definitions: API field -> column, with validation rules
// ---------------------------------------------------------------------------

// type: text | int | bool | date; required; max (characters); upper (stored upper-case); min (int)
const ENTITIES = {
    branches: {
        table: 'branches', label: 'branch', idPrefix: 'br',
        fields: {
            code: { col: 'code', type: 'text', required: true, max: 30, upper: true },
            name: { col: 'name', type: 'text', required: true, max: 255 },
            urduName: { col: 'urdu_name', type: 'text', max: 255 },
            address: { col: 'address', type: 'text', max: 1000, notNull: true },
            city: { col: 'city', type: 'text', max: 100 },
            isWomens: { col: 'is_womens_branch', type: 'bool' },
            contactPhone: { col: 'contact_phone', type: 'text', max: 50 },
            contactEmail: { col: 'contact_email', type: 'text', max: 100 },
            established: { col: 'established_year', type: 'int', min: 1800, max: 2100 },
            students: { col: 'student_count', type: 'int', min: 0, max: 1000000 }
        }
    },
    departments: {
        table: 'departments', label: 'department', idPrefix: 'dept',
        fields: {
            code: { col: 'code', type: 'text', required: true, max: 50, upper: true },
            name: { col: 'name', type: 'text', required: true, max: 255 },
            urduName: { col: 'urdu_name', type: 'text', max: 255, notNull: true },
            description: { col: 'description', type: 'text', max: 4000 }
        }
    },
    programs: {
        table: 'academic_programs', label: 'programme', idPrefix: 'prog',
        fields: {
            departmentId: { col: 'department_id', type: 'text', required: true, max: 50 },
            code: { col: 'code', type: 'text', required: true, max: 50, upper: true },
            name: { col: 'name', type: 'text', required: true, max: 255 },
            urduName: { col: 'urdu_name', type: 'text', max: 255, notNull: true },
            durationYears: { col: 'duration_years', type: 'int', required: true, min: 1, max: 20 },
            wifaqEquivalence: { col: 'wifaq_equivalence', type: 'text', max: 255 },
            description: { col: 'description', type: 'text', max: 4000 }
        }
    },
    sessions: {
        table: 'academic_sessions', label: 'academic session', idPrefix: 'sess',
        fields: {
            name: { col: 'name', type: 'text', required: true, max: 100 },
            startDate: { col: 'start_date', type: 'date', required: true },
            endDate: { col: 'end_date', type: 'date', required: true },
            isCurrent: { col: 'is_current', type: 'bool' }
        }
    }
};

const ROUTES = {
    '/api/branches': 'branches',
    '/api/departments': 'departments',
    '/api/programs': 'programs',
    '/api/sessions': 'sessions'
};

function fail(status, error) {
    return Object.assign(new Error(error), { status, expose: true });
}

// Turns a request body into column values. partial: only the fields present (updates)
function columnsFrom(entity, body, partial) {
    const out = {};
    for (const [key, f] of Object.entries(entity.fields)) {
        const present = Object.prototype.hasOwnProperty.call(body, key);
        if (!present) {
            if (partial) continue;
            if (f.required) throw fail(400, `${key} is required.`);
            out[f.col] = f.type === 'bool' ? 0 : (f.notNull ? '' : null);
            continue;
        }
        const raw = body[key];
        if (f.type === 'bool') {
            out[f.col] = raw ? 1 : 0;
        } else if (f.type === 'int') {
            if (raw === '' || raw === null || raw === undefined) {
                if (f.required) throw fail(400, `${key} is required.`);
                out[f.col] = null;
            } else {
                const n = Number(raw);
                if (!Number.isInteger(n) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) {
                    throw fail(400, `${key} must be a whole number${f.min !== undefined ? ` from ${f.min}` : ''}${f.max !== undefined ? ` to ${f.max}` : ''}.`);
                }
                out[f.col] = n;
            }
        } else if (f.type === 'date') {
            const v = String(raw || '').trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw fail(400, `${key} must be a date (YYYY-MM-DD).`);
            out[f.col] = v;
        } else {
            let v = String(raw === null || raw === undefined ? '' : raw).trim();
            if (f.upper) v = v.toUpperCase();
            if (f.required && !v) throw fail(400, `${key} is required.`);
            if (f.max && v.length > f.max) throw fail(400, `${key} is too long (at most ${f.max} characters).`);
            out[f.col] = v || (f.notNull ? '' : null);
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// What still uses a record (a record in use cannot be deleted)
// ---------------------------------------------------------------------------

async function usageOf(kind, id, loadCollection) {
    const uses = [];
    const count = (n, what) => { if (n) uses.push(`${n} ${what}`); };
    if (kind === 'branches') {
        const users = await loadCollection('users');
        count(users.filter(u => u.branchId === id && u.role === 'STUDENT').length, 'student(s)');
        count(users.filter(u => u.role !== 'STUDENT' && (u.branchId === id || (Array.isArray(u.campusIds) && u.campusIds.includes(id)))).length, 'staff / teacher account(s)');
        count((await loadCollection('classes')).filter(c => c.branchId === id).length, 'class(es)');
        count((await loadCollection('courses')).filter(c => Array.isArray(c.campusIds) && c.campusIds.includes(id)).length, 'course(s)');
        const [[a]] = await db.query(`SELECT COUNT(*) AS n FROM student_admissions WHERE branch_id = ?`, [id]);
        count(Number(a.n), 'admission application(s)');
    } else if (kind === 'departments') {
        const [[p]] = await db.query(`SELECT COUNT(*) AS n FROM academic_programs WHERE department_id = ?`, [id]);
        count(Number(p.n), 'programme(s)');
    } else if (kind === 'programs') {
        count((await loadCollection('classes')).filter(c => c.programId === id).length, 'class(es)');
        count((await loadCollection('courses')).filter(c => c.programId === id).length, 'course(s)');
        count((await loadCollection('feeStructures')).filter(f => f.programId === id).length, 'fee structure(s)');
        const [[a]] = await db.query(`SELECT COUNT(*) AS n FROM student_admissions WHERE program_id = ?`, [id]);
        count(Number(a.n), 'admission application(s)');
    }
    return uses;
}

async function loadRow(entity, id) {
    const [rows] = await db.query(`SELECT * FROM ${entity.table} WHERE id = ?`, [id]);
    return rows[0] || null;
}

// POST /api/<kind>, PUT /api/<kind>/:id, DELETE /api/<kind>/:id
async function handleMasterWrite(req, res, url, deps) {
    const base = Object.keys(ROUTES).find(r => url.pathname === r || url.pathname.startsWith(`${r}/`));
    const kind = ROUTES[base];
    const entity = ENTITIES[kind];
    const id = decodeURIComponent(url.pathname.slice(base.length + 1));
    const m = req.method;

    if (!deps.can(req, 'settings.master_data')) {
        deps.sendJson(res, 403, { success: false, error: 'You are not allowed to change branches, programmes, departments or sessions.' });
        return;
    }
    if ((m === 'POST' && id) || (m !== 'POST' && !id)) {
        deps.sendJson(res, 405, { success: false, error: 'Method not allowed' });
        return;
    }

    if (m === 'DELETE') {
        const existing = await loadRow(entity, id);
        if (!existing) throw fail(404, `This ${entity.label} does not exist.`);
        if (kind === 'sessions' && Number(existing.is_current)) throw fail(409, 'This is the current session. Make another session current before deleting it.');
        const uses = await usageOf(kind, id, deps.loadCollection);
        if (kind === 'branches' && (await getInstitution(deps)).mainBranchId === id) uses.push('the institution profile (it is the main campus)');
        if (uses.length) throw fail(409, `This ${entity.label} is still used by ${uses.join(', ')}. Move them first, then delete it.`);
        await db.query(`DELETE FROM ${entity.table} WHERE id = ?`, [id]);
        await audit.log({ req, action: `master.${kind}_delete`, entityType: kind, entityId: id, summary: `Deleted ${entity.label} ${existing.name}`, before: existing });
        deps.sendJson(res, 200, { success: true });
        return;
    }

    const body = await deps.readJson(req);
    const existing = m === 'PUT' || m === 'PATCH' ? await loadRow(entity, id) : null;
    if ((m === 'PUT' || m === 'PATCH') && !existing) throw fail(404, `This ${entity.label} does not exist.`);
    const cols = columnsFrom(entity, body || {}, !!existing);

    if (kind === 'programs' && cols.department_id !== undefined) {
        if (!(await loadRow(ENTITIES.departments, cols.department_id))) throw fail(400, 'Choose an existing department.');
    }
    if (kind === 'sessions') {
        const start = cols.start_date || (existing && toDate(existing.start_date));
        const end = cols.end_date || (existing && toDate(existing.end_date));
        if (start && end && start > end) throw fail(400, 'The session must end after it starts.');
    }

    const conn = await db.getConnection();
    let newId = id;
    try {
        await conn.beginTransaction();
        // Only one session is the current one
        if (kind === 'sessions' && cols.is_current === 1) await conn.execute(`UPDATE academic_sessions SET is_current = 0`);
        if (existing) {
            const keys = Object.keys(cols);
            if (keys.length) {
                await conn.execute(`UPDATE ${entity.table} SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map(k => cols[k]), id]);
            }
        } else {
            newId = `${entity.idPrefix}_${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
            const keys = ['id', ...Object.keys(cols)];
            await conn.execute(`INSERT INTO ${entity.table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, [newId, ...Object.values(cols)]);
        }
        await conn.commit();
    } catch (err) {
        await conn.rollback().catch(() => {});
        if (err.code === 'ER_DUP_ENTRY') throw fail(409, `Another ${entity.label} already uses this code.`);
        throw err;
    } finally {
        conn.release();
    }

    const after = await loadRow(entity, newId);
    await audit.log({
        req, action: `master.${kind}_${existing ? 'update' : 'create'}`, entityType: kind, entityId: newId,
        summary: `${existing ? 'Updated' : 'Created'} ${entity.label} ${after ? after.name : newId}`, before: existing, after
    });
    deps.sendJson(res, existing ? 200 : 201, { success: true, id: newId });
}

function toDate(v) {
    if (!v) return null;
    if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    return String(v).slice(0, 10);
}

// ---------------------------------------------------------------------------
// Institution profile
// ---------------------------------------------------------------------------

// Starting values until the Super Admin saves the profile (then the saved one is used)
const DEFAULT_INSTITUTION = {
    name: 'Jamia Ashrafia Lahore',
    urduName: 'جامعہ اشرفیہ، لاہور',
    motto: 'Knowledge & Piety',
    established: 1947,
    mainCampus: 'Ferozepur Road, Lahore',
    website: 'https://jamiaashrafia.org',
    phone: '',
    email: '',
    affiliation: 'Wifaq-ul-Madaris Al-Arabia Pakistan',
    // Campus that new accounts and records start with (the main campus of the original setup; '' = the first one listed)
    mainBranchId: 'b1',
    // Where fees and donations are paid (shown on challans and the public admission form)
    bankName: 'Meezan Bank / HBL',
    bankAccountTitle: 'Jamia Ashrafia Lahore',
    bankAccountNumber: '0142-7901452203',
    leadership: [
        { office: 'Principal / Mohtamim', name: 'Maulana Fazl-ur-Raheem Ashrafi' },
        { office: 'Nazim-e-Taleemat', name: 'Maulana Hafiz Ajwad Ubaid' },
        { office: 'Sheikh-ul-Hadith', name: 'Qari Arshad Ubaid' }
    ]
};

const INSTITUTION_TEXT = {
    name: 255, urduName: 255, motto: 255, mainCampus: 500, website: 255, phone: 50, email: 100, affiliation: 255,
    bankName: 150, bankAccountTitle: 150, bankAccountNumber: 60
};

async function getInstitution(deps) {
    return { ...DEFAULT_INSTITUTION, ...((await deps.getSetting('institution', null)) || {}) };
}

async function handleInstitution(req, res, deps) {
    if (req.method === 'GET') {
        deps.sendJson(res, 200, { success: true, institution: await getInstitution(deps) });
        return;
    }
    if (!deps.can(req, 'settings.master_data')) {
        deps.sendJson(res, 403, { success: false, error: 'You are not allowed to change the institution profile.' });
        return;
    }
    const body = await deps.readJson(req);
    const current = await getInstitution(deps);
    const next = { ...current };
    for (const [key, max] of Object.entries(INSTITUTION_TEXT)) {
        if (body[key] !== undefined) next[key] = String(body[key] || '').trim().slice(0, max);
    }
    if (!next.name) throw fail(400, 'The institution name is required.');
    if (next.website && !/^https?:\/\//i.test(next.website)) throw fail(400, 'The website must start with http:// or https://');
    if (body.mainBranchId !== undefined) {
        const id = String(body.mainBranchId || '').trim();
        if (id && !(await loadRow(ENTITIES.branches, id))) throw fail(400, 'Choose an existing campus as the main campus.');
        next.mainBranchId = id;
    }
    if (body.established !== undefined) {
        const year = body.established === '' || body.established === null ? null : Number(body.established);
        if (year !== null && (!Number.isInteger(year) || year < 1000 || year > 2100)) throw fail(400, 'Enter the year the institution was established.');
        next.established = year;
    }
    if (body.leadership !== undefined) {
        if (!Array.isArray(body.leadership)) throw fail(400, 'Leadership must be a list.');
        next.leadership = body.leadership.slice(0, 30)
            .map(l => ({ office: String((l && l.office) || '').trim().slice(0, 150), name: String((l && l.name) || '').trim().slice(0, 150) }))
            .filter(l => l.name);
    }
    await deps.saveSetting('institution', next);
    await audit.log({ req, action: 'settings.institution', entityType: 'settings', entityId: 'institution', summary: 'Updated the institution profile', before: current, after: next });
    deps.sendJson(res, 200, { success: true, institution: next });
}

// ---------------------------------------------------------------------------
// Recording retention & clean-up
// ---------------------------------------------------------------------------

// Nothing is removed automatically until the Super Admin turns the nightly clean-up on
const DEFAULT_RECORDING_SETTINGS = {
    retentionDays: 90,
    allowStudentDownload: false,
    autoCleanupEnabled: false,
    storageQuotaGB: 50,
    lastCleanupDate: null
};
const RETENTION_CHOICES = [0, 30, 60, 90, 180, 365];

function sizeOf(rec) {
    return Math.max(0, Number(rec.fileSizeBytes) || 0);
}

async function getRecordingSettings(deps) {
    const settings = { ...DEFAULT_RECORDING_SETTINGS, ...((await deps.getSetting('recordings', null)) || {}) };
    const recordings = await deps.loadCollection('virtualClassRecordings');
    settings.usedBytes = recordings.reduce((s, r) => s + sizeOf(r), 0);
    settings.recordingCount = recordings.length;
    return settings;
}

function expired(rec, retentionDays, today) {
    if (!retentionDays || rec.autoDeleteProtected) return false;
    const date = String(rec.recordedDate || rec.createdAt || '').slice(0, 10);
    const t = Date.parse(`${date}T00:00:00Z`);
    if (Number.isNaN(t)) return false;
    return Math.floor((Date.parse(`${today}T00:00:00Z`) - t) / 86400000) > retentionDays;
}

// An uploaded file is only removed when it really lies inside the uploads folder
function removeUploadedFile(url) {
    const rel = String(url || '');
    if (!rel.startsWith('uploads/')) return;
    const file = path.resolve(UPLOAD_DIR, rel.slice('uploads/'.length));
    if (!file.startsWith(UPLOAD_DIR + path.sep)) return;
    fs.promises.unlink(file).catch(() => {});
}

/** Removes recordings older than the retention period. actorReq: the request when run by a person (for the audit log). */
async function cleanupRecordings(deps, actorReq) {
    const settings = await getRecordingSettings(deps);
    const today = new Date().toISOString().slice(0, 10);
    const recordings = await deps.loadCollection('virtualClassRecordings');
    const purge = recordings.filter(r => expired(r, settings.retentionDays, today));
    for (const rec of purge) {
        await db.query(
            `UPDATE lms_records SET deleted = 1, updated_by = ?, updated_at = NOW(3) WHERE collection = 'virtualClassRecordings' AND id = ?`,
            [actorReq && actorReq.auth ? actorReq.auth.id : 'retention', rec.id]
        );
        removeUploadedFile(rec.videoUrl);
    }
    const stored = { ...((await deps.getSetting('recordings', null)) || {}), lastCleanupDate: today };
    await deps.saveSetting('recordings', stored);
    await audit.log({
        req: actorReq || null, actor: actorReq ? undefined : { id: null, role: 'SYSTEM' },
        action: 'recordings.cleanup', entityType: 'virtualClassRecordings', entityId: null,
        summary: `Recording clean-up removed ${purge.length} recording(s) older than ${settings.retentionDays || '∞'} days`
    });
    return { purgedCount: purge.length, activeCount: recordings.length - purge.length };
}

async function handleRecordingSettings(req, res, deps) {
    if (req.method === 'GET') {
        deps.sendJson(res, 200, { success: true, settings: await getRecordingSettings(deps) });
        return;
    }
    if (!deps.can(req, 'settings.recordings')) {
        deps.sendJson(res, 403, { success: false, error: 'You are not allowed to change recording retention.' });
        return;
    }
    const body = await deps.readJson(req);
    const current = { ...DEFAULT_RECORDING_SETTINGS, ...((await deps.getSetting('recordings', null)) || {}) };
    const next = { ...current };
    if (body.retentionDays !== undefined) {
        const days = Number(body.retentionDays);
        if (!RETENTION_CHOICES.includes(days)) throw fail(400, `Retention must be one of ${RETENTION_CHOICES.join(', ')} days (0 keeps recordings permanently).`);
        next.retentionDays = days;
    }
    ['allowStudentDownload', 'autoCleanupEnabled'].forEach(k => { if (body[k] !== undefined) next[k] = !!body[k]; });
    if (body.storageQuotaGB !== undefined) {
        const gb = Number(body.storageQuotaGB);
        if (!(gb > 0 && gb <= 100000)) throw fail(400, 'Enter the storage quota in GB.');
        next.storageQuotaGB = gb;
    }
    await deps.saveSetting('recordings', next);
    await audit.log({ req, action: 'settings.recordings', entityType: 'settings', entityId: 'recordings', summary: `Recording retention: ${next.retentionDays || 'permanent'} days, nightly clean-up ${next.autoCleanupEnabled ? 'on' : 'off'}`, before: current, after: next });
    deps.sendJson(res, 200, { success: true, settings: await getRecordingSettings(deps) });
}

async function handleRecordingCleanup(req, res, deps) {
    if (!deps.can(req, 'settings.recordings')) {
        deps.sendJson(res, 403, { success: false, error: 'You are not allowed to run recording clean-up.' });
        return;
    }
    const result = await cleanupRecordings(deps, req);
    deps.sendJson(res, 200, {
        success: true,
        message: `Clean-up finished: ${result.purgedCount} expired recording(s) removed.`,
        ...result,
        settings: await getRecordingSettings(deps)
    });
}

// Runs the clean-up once a day when the Super Admin has turned it on
async function nightlyCleanup(deps) {
    const settings = { ...DEFAULT_RECORDING_SETTINGS, ...((await deps.getSetting('recordings', null)) || {}) };
    const today = new Date().toISOString().slice(0, 10);
    if (!settings.autoCleanupEnabled || settings.lastCleanupDate === today) return;
    await cleanupRecordings(deps, null);
}

// ---------------------------------------------------------------------------
// Router (deps: sendJson, readJson, can, loadCollection, getSetting, saveSetting)
// ---------------------------------------------------------------------------

async function route(req, res, url, deps) {
    const p = url.pathname;
    const m = req.method;
    const base = Object.keys(ROUTES).find(r => p === r || p.startsWith(`${r}/`));
    // Reading the lists stays with the public GET routes in server.js
    if (base && !(m === 'GET')) { await handleMasterWrite(req, res, url, deps); return true; }
    if (p === '/api/settings/institution' && (m === 'GET' || m === 'POST')) { await handleInstitution(req, res, deps); return true; }
    if (p === '/api/settings/recordings' && (m === 'GET' || m === 'POST')) { await handleRecordingSettings(req, res, deps); return true; }
    if (p === '/api/virtual-class/cleanup' && m === 'POST') { await handleRecordingCleanup(req, res, deps); return true; }
    return false;
}

module.exports = { route, nightlyCleanup, cleanupRecordings, ENTITIES };
