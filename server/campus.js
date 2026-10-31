/**
 * JAMIA ASHRAFIA LAHORE - CAMPUS (LOCATION) ACCESS
 *
 * Campuses are the branches set up in Institution Setup. Which campuses a person works with sits on their account:
 *   branchId     - home campus. For a student, their one primary campus (always the campus of their class).
 *   allCampuses  - staff and teachers: true = every campus, now and in future
 *   campusIds    - staff and teachers without allCampuses: the campuses they work at (home campus included)
 * The Super Admin always has every campus.
 *
 * Records follow a campus too: classes carry branchId; courses carry campusIds (empty = taught at every campus);
 * class-bound records (timetable, online classes, assignments, exams ...) follow their class; records about one
 * person (attendance, challans, loans, submissions) follow that person. Library books, fee structures and
 * donations belong to the whole institution.
 *
 * Campus access is checked on top of the permission scopes in server/access-policy.js: a permission held for the
 * whole institution (ALL) reaches every record of the person's campuses, not every record.
 */

const db = require('../database/db');

const ALL = 'ALL';
let defaultCache = { at: 0, id: '' };

/** The default campus: the main campus of the institution profile, else the first one set up ('' when none). */
async function defaultCampusId(force) {
    if (!force && Date.now() - defaultCache.at < 30000) return defaultCache.id;
    let id = '';
    try {
        const [[t]] = await db.query(`SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'branches'`);
        if (Number(t.c)) {
            let main = 'b1';
            const [s] = await db.query(`SELECT setting_value FROM system_settings WHERE setting_key = 'institution'`).catch(() => [[]]);
            if (s.length) {
                try {
                    const inst = JSON.parse(s[0].setting_value);
                    if (inst && inst.mainBranchId !== undefined) main = inst.mainBranchId;
                } catch (e) { /* keep b1 */ }
            }
            const [rows] = await db.query(`SELECT id FROM branches ORDER BY (id = ?) DESC, id LIMIT 1`, [main || '']);
            id = rows.length ? rows[0].id : '';
        }
    } catch (e) {
        id = defaultCache.id;
    }
    defaultCache = { at: Date.now(), id };
    return id;
}

function uniq(list) {
    return Array.from(new Set((list || []).map(x => String(x || '').trim()).filter(Boolean)));
}

/** Campuses an account works with: 'ALL' or a list of branch ids. */
function accountCampuses(user, fallback) {
    if (!user) return [];
    if (user.role === 'SUPER_ADMIN') return ALL;
    if (user.role === 'STUDENT') return uniq([user.branchId || fallback]);
    if (user.allCampuses === true) return ALL;
    const ids = uniq([...(Array.isArray(user.campusIds) ? user.campusIds : []), user.branchId]);
    return ids.length ? ids : uniq([fallback]);
}

/** What the signed-in person may reach: null = every campus, else a Set of branch ids. */
function allowedSet(user, isSuperAdmin, fallback) {
    if (isSuperAdmin) return null;
    const c = accountCampuses(user, fallback);
    return c === ALL ? null : new Set(c);
}

// Every campus of the record is one the person may use ('ALL' records need every campus)
function within(allowed, campuses) {
    if (!allowed || campuses === null) return true;
    if (campuses === ALL) return false;
    return campuses.every(c => allowed.has(c));
}

// The record is at one of the person's campuses at least ('ALL' records are at every campus)
function overlaps(allowed, campuses) {
    if (!allowed || campuses === null || campuses === ALL) return true;
    return campuses.some(c => allowed.has(c));
}

/**
 * Brings an account's campus fields into shape before it is checked and saved:
 * a student has exactly one campus, the campus of their class; staff keep their home campus among their campuses.
 */
function normalizeAccount(user, classBranch, fallback) {
    if (!user || !user.role || user.role === 'SUPER_ADMIN') return user;
    if (user.role === 'STUDENT') {
        delete user.allCampuses;
        delete user.campusIds;
        const fromClass = user.classId ? classBranch(user.classId) : null;
        user.branchId = fromClass || user.branchId || fallback || null;
        return user;
    }
    if (user.allCampuses === true) {
        user.campusIds = uniq(user.campusIds);
        if (!user.branchId) user.branchId = fallback || null;
        return user;
    }
    user.allCampuses = false;
    const ids = uniq(Array.isArray(user.campusIds) ? user.campusIds : []);
    if (!user.branchId || !ids.includes(user.branchId)) user.branchId = ids[0] || user.branchId || fallback || null;
    user.campusIds = uniq([...ids, user.branchId]);
    return user;
}

// ---------------------------------------------------------------------------
// Migration (idempotent: only records without campus fields are touched; nothing is removed)
// ---------------------------------------------------------------------------

/**
 * Gives existing records a campus:
 *   classes without a campus        -> default campus
 *   students                         -> the campus of their class, else the default campus
 *   teachers without campus access   -> home campus plus the campuses of every class they teach (they keep their classes)
 *   other staff without campus access-> every campus (what they could see before), home campus = default
 *   admission applications without a campus -> default campus
 * Courses without campusIds stay shared by every campus. Returns counts of changed records.
 */
async function migrate(log = () => {}) {
    const fallback = await defaultCampusId(true);
    const counts = { classes: 0, students: 0, teachers: 0, staff: 0, admissions: 0 };
    if (!fallback) return counts;

    const load = async collection => {
        const [rows] = await db.query(`SELECT id, data FROM lms_records WHERE collection = ? AND deleted = 0`, [collection]);
        return rows.map(r => ({ id: r.id, rec: JSON.parse(r.data) }));
    };
    const save = (collection, rec) => db.query(
        `UPDATE lms_records SET data = ?, updated_by = 'campus-migration', updated_at = NOW(3) WHERE collection = ? AND id = ?`,
        [JSON.stringify(rec), collection, rec.id]);

    const classes = await load('classes');
    for (const { rec } of classes) {
        if (rec.branchId) continue;
        rec.branchId = fallback;
        await save('classes', rec);
        counts.classes++;
    }
    const classBranch = new Map(classes.map(({ rec }) => [rec.id, rec.branchId]));
    const taughtAt = new Map();
    classes.forEach(({ rec }) => {
        const teachers = [rec.teacherId, ...(rec.courseTeachers || []).map(ct => ct && ct.teacherId)].filter(Boolean);
        teachers.forEach(t => taughtAt.set(t, uniq([...(taughtAt.get(t) || []), rec.branchId])));
    });

    for (const { rec } of await load('users')) {
        if (!rec.role || rec.role === 'SUPER_ADMIN') continue;
        if (rec.role === 'STUDENT') {
            const want = (rec.classId && classBranch.get(rec.classId)) || rec.branchId || fallback;
            if (rec.branchId === want) continue;
            // A student whose class is at another campus moves with the class (the class decides what they see)
            rec.branchId = want;
            await save('users', rec);
            counts.students++;
            continue;
        }
        if (rec.allCampuses === true || Array.isArray(rec.campusIds)) continue;
        const isTeacher = rec.role === 'TEACHER';
        rec.branchId = rec.branchId || fallback;
        if (isTeacher) {
            rec.allCampuses = false;
            rec.campusIds = uniq([rec.branchId, ...(taughtAt.get(rec.id) || [])]);
            counts.teachers++;
        } else {
            rec.allCampuses = true;
            rec.campusIds = [];
            counts.staff++;
        }
        await save('users', rec);
    }

    const [[adm]] = await db.query(`SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_admissions'`);
    if (Number(adm.c)) {
        const [r] = await db.query(`UPDATE student_admissions SET branch_id = ? WHERE branch_id IS NULL OR branch_id = ''`, [fallback]);
        counts.admissions = r.affectedRows || 0;
    }
    const changed = Object.values(counts).reduce((a, b) => a + b, 0);
    if (changed) log(`[Campus] Gave existing records a campus: ${JSON.stringify(counts)}`);
    return counts;
}

module.exports = { ALL, defaultCampusId, accountCampuses, allowedSet, within, overlaps, normalizeAccount, uniq, migrate };
