/**
 * JAMIA ASHRAFIA LAHORE - SAMPLE DATA CLEAN-UP (Super Admin only)
 *
 * Earlier versions of the portal shipped demonstration records (teachers, students, classes, online classes,
 * attendance ...) inside the browser code, and the first administrator to sign in copied them into the shared
 * record store. They are recognised here by the ids those versions used, so the Super Admin can review and
 * remove them from Institution Setup -> Data Clean-up. Applications left behind by automated tests are listed
 * too. Nothing is removed without the Super Admin ticking it, and record-store entries are only marked deleted.
 *
 * The real Super Admin account is never offered, whatever its id.
 */

const db = require('../database/db');
const auth = require('./auth');
const roles = require('./roles');
const audit = require('./audit');

const days = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'];
// Ids of the sample records shipped with portal versions up to October 2026
const SAMPLE_IDS = {
    users: ['u_nazim', 'u_accountant', 'u_teacher_1', 'u_teacher_2', 'u_student_1', 'u_student_2', 'u_student_3',
        'u_student_4', 'u_student_5', 'u_student_6', 'u_student_7', 'u_student_8'],
    classes: ['cls_dawra_a', 'cls_dawra_b', 'cls_aaliyah', 'cls_ifta', 'cls_hifz_3', 'cls_hifz', 'cls_qiraat', 'cls_women_alim'],
    courses: ['c_bukhari_1', 'c_tirmidhi', 'c_hidayah', 'c_banking', 'c_tajweed'],
    assignments: ['asg_1', 'asg_2'],
    assignmentSubmissions: ['sub_1'],
    exams: ['ex_1', 'ex_2', 'ex_3'],
    examResults: ['res_1', 'res_2'],
    timetables: days.flatMap(d => [1, 2, 3, 4, 5].map(n => `tt_${d}_${n}`)),
    libraryBooks: ['bk_1', 'bk_2', 'bk_3', 'bk_4'],
    libraryLoans: ['loan_1', 'loan_2'],
    feeStructures: ['fs_p1', 'fs_p2', 'fs_p3', 'fs_p4', 'fs_p5'],
    feeChallans: ['ch_1', 'ch_2'],
    donations: ['don_1', 'don_2', 'don_3'],
    virtualClasses: ['vc_101', 'vc_102', 'vc_103', 'vc_104', 'vc_105', 'vc_106'],
    virtualClassRecordings: ['rec_201', 'rec_202', 'rec_203', 'rec_204'],
    attendance: ['att_today_1', 'att_today_2', 'att_today_3', 'att_today_4', 'att_today_5',
        'att_yest_1', 'att_yest_2', 'att_yest_3', 'att_yest_4', 'att_yest_5', 'att_yest_6',
        'att_prev_1', 'att_prev_2', 'att_prev_3']
};
const SAMPLE_ADMISSION_IDS = ['adm_101', 'adm_102', 'adm_103', 'adm_104', 'adm_105'];
// Names the automated test suites and earlier browser checks gave their applications
const TEST_APPLICATION_NAMES = /^((Ahmad Raza|John Doe) Test \d+|Browser Flow (Test|Live) \d+|Duplicate Attempt)$/;

const LABELS = {
    users: 'Accounts (teachers, students, staff)', classes: 'Classes', courses: 'Courses / kitabs', assignments: 'Assignments',
    assignmentSubmissions: 'Assignment submissions', exams: 'Exams', examSubmissions: 'Exam papers handed in', examResults: 'Exam results',
    timetables: 'Timetable periods', libraryBooks: 'Library books', libraryLoans: 'Library loans', feeStructures: 'Fee structures',
    feeChallans: 'Fee challans', donations: 'Donations', virtualClasses: 'Online classes (Zoom / live dars)',
    virtualClassRecordings: 'Lecture recordings', attendance: 'Attendance records', courseMaterials: 'Course material'
};

// Fields through which a record points at a class, person or other record
const LINK_FIELDS = ['classId', 'userId', 'studentId', 'teacherId', 'hostId', 'courseId', 'assignmentId', 'examId', 'bookId', 'sessionId', 'donorUserId'];

function describe(collection, r) {
    const name = r.name || r.title || r.periodName || r.userName || r.studentName || r.donorName || r.challanNumber || r.receiptNo || r.id;
    const extra = {
        users: r.role, classes: r.section, attendance: [r.date, r.className].filter(Boolean).join(' • '),
        timetables: [r.day, r.startTime].filter(Boolean).join(' '), virtualClasses: r.hostTeacher, feeChallans: r.studentName
    }[collection];
    return extra && extra !== name ? `${name} — ${extra}` : String(name);
}

async function liveRecords() {
    const [rows] = await db.query(`SELECT collection, id, data, updated_by AS updatedBy, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i') AS updatedAt FROM lms_records WHERE deleted = 0`);
    return rows.map(r => ({ ...r, data: JSON.parse(r.data) }));
}

/** Everything that can be offered: sample records, records that only point at sample records, test applications */
async function findCandidates() {
    const rows = await liveRecords();
    const isSample = r => (SAMPLE_IDS[r.collection] || []).includes(r.id)
        && !(r.collection === 'users' && (r.data.role === roles.SUPER_ADMIN || roles.isSuperAdminUser(r.data)));
    const sample = rows.filter(isSample);
    const sampleIds = new Set(sample.map(r => r.id));

    // Records made later that belong to a sample class, person or record (e.g. a check-in to a sample class).
    // Shown separately and not ticked: they may be real.
    const linked = rows.filter(r => !isSample(r) && r.collection !== 'users'
        && LINK_FIELDS.some(f => r.data[f] && sampleIds.has(r.data[f])));

    const [sampleApps] = await db.query(
        `SELECT id, application_no AS applicationNo, candidate_name AS name, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS createdAt
         FROM student_admissions WHERE id IN (${SAMPLE_ADMISSION_IDS.map(() => '?').join(',')})`, SAMPLE_ADMISSION_IDS);
    const [allApps] = await db.query(
        `SELECT id, application_no AS applicationNo, candidate_name AS name, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS createdAt FROM student_admissions`);
    const testApps = allApps.filter(a => TEST_APPLICATION_NAMES.test(String(a.name || '').trim()));
    return { sample, linked, sampleApps, testApps };
}

function group(kind, list) {
    const by = {};
    list.forEach(r => (by[r.collection] = by[r.collection] || []).push({
        collection: r.collection, id: r.id, label: describe(r.collection, r.data), updatedAt: r.updatedAt, updatedBy: r.updatedBy
    }));
    return Object.entries(by).map(([collection, records]) => ({ kind, collection, label: LABELS[collection] || collection, records }));
}

function appGroup(kind, label, apps) {
    return apps.length ? [{
        kind, collection: 'admissions', label,
        records: apps.map(a => ({ collection: 'admissions', id: a.id, label: `${a.name} — ${a.applicationNo} (${a.status})`, updatedAt: a.createdAt }))
    }] : [];
}

async function handleList(req, res, deps) {
    const c = await findCandidates();
    deps.sendJson(res, 200, {
        success: true,
        groups: [
            ...group('sample', c.sample),
            ...appGroup('sample', 'Sample admission applications', c.sampleApps),
            ...appGroup('test', 'Applications left by automated tests', c.testApps),
            ...group('linked', c.linked)
        ]
    });
}

async function handleRemove(req, res, deps) {
    const body = await deps.readJson(req);
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) {
        deps.sendJson(res, 400, { success: false, error: 'Tick at least one record to remove.' });
        return;
    }
    // Only what the review offered can be removed here
    const c = await findCandidates();
    const offered = new Set([...c.sample, ...c.linked].map(r => `${r.collection}:${r.id}`)
        .concat([...c.sampleApps, ...c.testApps].map(a => `admissions:${a.id}`)));
    const chosen = items.map(i => `${i && i.collection}:${i && i.id}`).filter(k => offered.has(k));
    const removed = {};
    const revoke = [];

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        for (const key of chosen) {
            const [collection, ...rest] = key.split(':');
            const id = rest.join(':');
            if (collection === 'admissions') {
                const [[app]] = await conn.execute(`SELECT application_no AS applicationNo FROM student_admissions WHERE id = ?`, [id]);
                await conn.execute(`DELETE FROM student_admissions WHERE id = ?`, [id]);
                if (app) await deps.deleteAdmissionNotices(conn, app.applicationNo);
            } else {
                await conn.execute(`UPDATE lms_records SET deleted = 1, updated_by = ?, updated_at = NOW(3) WHERE collection = ? AND id = ?`, [req.auth.id, collection, id]);
                if (collection === 'users') {
                    await roles.removeUserRoles(conn, id);
                    await conn.execute(`DELETE FROM user_credentials WHERE user_id = ?`, [id]);
                    revoke.push(id);
                }
            }
            removed[collection] = (removed[collection] || 0) + 1;
        }
        await conn.commit();
    } catch (err) {
        await conn.rollback().catch(() => {});
        throw err;
    } finally {
        conn.release();
    }
    for (const id of revoke) await auth.revokeUserSessions(id, null);
    const total = Object.values(removed).reduce((a, b) => a + b, 0);
    await audit.log({
        req, action: 'data.sample_cleanup', entityType: 'lms_records', entityId: null,
        summary: `Removed ${total} sample / test record(s): ${Object.entries(removed).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}`,
        after: { removed: chosen }
    });
    deps.sendJson(res, 200, { success: true, removed, total });
}

async function route(req, res, url, deps) {
    const p = url.pathname;
    if (p !== '/api/admin/sample-data' && p !== '/api/admin/sample-data/remove') return false;
    const real = req.auth.realUser || req.auth.user;
    if (!roles.isSuperAdminUser(real) || req.auth.preview) {
        deps.sendJson(res, 403, { success: false, error: 'Only the Super Admin can review and remove sample data.' });
        return true;
    }
    if (p === '/api/admin/sample-data' && req.method === 'GET') { await handleList(req, res, deps); return true; }
    if (p === '/api/admin/sample-data/remove' && req.method === 'POST') { await handleRemove(req, res, deps); return true; }
    deps.sendJson(res, 405, { success: false, error: 'Method not allowed' });
    return true;
}

module.exports = { route, SAMPLE_IDS };
