/**
 * JAMIA ASHRAFIA LAHORE - RECORD ACCESS POLICIES
 *
 * For every shared collection: who may read a record, who may create, change or delete it, and which
 * fields they may not touch. Decisions come only from the caller's permissions (server/permissions.js), each
 * checked against the data scope it is held with (a person may hold several roles):
 *   ALL      - any record
 *   TEACHING - records of classes the person teaches (class teacher or teaching a kitab there), and their own
 *   SELF     - the person's own records and their own class's material
 * Deny by default: a collection or action not handled here is refused.
 *
 * Account types: user records of students and teachers are governed by students.* and teachers.*;
 * every other account by users.*. Nobody may manage a person more powerful than themselves or give a role
 * stronger than their own (server/roles.js). Super Admin accounts are changed only by a Super Admin.
 */

const roles = require('./roles');

const SECRET_USER_FIELDS = ['password'];
const SENSITIVE_USER_FIELDS = ['cnic', 'cnicBform', 'bForm', 'passport', 'passportNumber', 'guardianCnic',
    'dateOfBirth', 'dob', 'address', 'permanentAddress', 'bloodGroup'];
const STAFF_DIRECTORY_FIELDS = ['id', 'name', 'urduName', 'role', 'designation', 'avatar', 'status', 'email',
    'branchId', 'assignedCourses', 'specialization', 'sanad', 'bio', 'gender'];

// Fields a person may never set on their own records
const OWN_PROTECTED = {
    assignmentSubmissions: ['isGraded', 'marksObtained', 'feedback', 'wifaqGrade', 'gradedBy', 'gradedAt', 'returnedFile', 'resubmitRequested'],
    examSubmissions: ['isMarked', 'questionMarks', 'marksObtained', 'remarks', 'markedBy', 'markedAt'],
    libraryLoans: ['issuedAt', 'issuedBy', 'dueDate', 'returnedAt', 'fine', 'finePaid'],
    feeChallans: ['tuitionFee', 'hostelMessFee', 'examFee', 'registrationFee', 'admissionFee', 'otherFee', 'items',
        'scholarshipWaiver', 'netPayable', 'paidAt', 'bankRef', 'verifiedBy', 'verifiedAt', 'studentId', 'challanNumber', 'dueDate'],
    donations: ['confirmedBy', 'confirmedAt', 'verifiedBy', 'verifiedAt']
};
const SELF_SCOPE_PROTECTED = ['role', 'additionalRoles', 'status', 'classId', 'rollNo', 'branchId', 'program', 'assignedCourses',
    'designation', 'email', 'username'];
const STAFF_SELF_PROTECTED = ['role', 'additionalRoles', 'status', 'assignedCourses', 'branchId', 'designation', 'classId', 'rollNo',
    'email', 'username'];
const IMMUTABLE_LINKS = ['assignmentId', 'examId', 'bookId', 'studentId', 'userId', 'donorUserId'];
const ENROLMENT_FIELDS = ['classId', 'branchId', 'program'];
const IGNORED_DIFF_FIELDS = ['password', 'updatedAt', 'lastSeenAt'];

const OWNER_FIELD = {
    users: 'id',
    assignmentSubmissions: 'studentId',
    examSubmissions: 'studentId',
    libraryLoans: 'userId',
    feeChallans: 'studentId',
    attendance: 'userId',
    donations: 'donorUserId'
};

// Low-sensitivity reference data every signed-in user may read
const SHARED_REFERENCE = ['classes', 'courses', 'timetables', 'libraryBooks', 'feeStructures', 'courseMaterials'];
// Office work that needs student names, when held for the whole institution
const STUDENT_DIRECTORY_PERMISSIONS = ['fees.challans.view', 'fees.challans.generate', 'library.loans.view', 'admissions.view',
    'attendance.view', 'classes.enroll', 'reports.academic', 'reports.attendance', 'reports.finance'];
const ATTENDANCE_EDIT_WINDOW_DAYS = 7;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Everything the rules need about the caller, built once per request.
 * who: { id, role, user, auth }; load(collection) returns all live records of a collection.
 */
async function buildContext(who, load) {
    const user = who.user || { id: who.id, role: who.role };
    const eff = who.auth ? roles.effectiveForAuth(who.auth) : roles.effectiveFor(user);
    const ctx = {
        id: who.id,
        user,
        eff,
        roleId: eff.roleId,
        scope: eff.scope, // the main role's scope: which portal the person uses
        perms: eff.permissions,
        isSuperAdmin: eff.isSuperAdmin,
        teachingClassIds: new Set(),
        ownClassIds: new Set(user.classId ? [user.classId] : []),
        courseIds: new Set(),
        teachingStudentIds: new Set(),
        studentClass: new Map(),
        assignmentInfo: new Map(),
        examInfo: new Map(),
        reason: null
    };
    ctx.can = p => ctx.perms.has(p);
    ctx.scopeFor = p => (eff.scopes && eff.scopes.get(p)) || null;
    // Held for the whole institution
    ctx.wide = p => ctx.scopeFor(p) === 'ALL';

    const scopes = new Set(eff.scopes ? eff.scopes.values() : []);
    if (eff.isSuperAdmin || (!scopes.has('TEACHING') && !scopes.has('SELF'))) return ctx;

    if (scopes.has('TEACHING')) {
        (await load('classes')).forEach(c => {
            const teaches = (c.courseTeachers || []).filter(ct => ct.teacherId === ctx.id);
            if (c.teacherId === ctx.id || teaches.length) ctx.teachingClassIds.add(c.id);
            teaches.forEach(ct => ctx.courseIds.add(ct.courseId));
        });
        (user.assignedCourses || []).forEach(id => ctx.courseIds.add(id));
        (await load('users')).forEach(u => {
            if (u.role !== 'STUDENT') return;
            ctx.studentClass.set(u.id, u.classId);
            if (ctx.teachingClassIds.has(u.classId)) ctx.teachingStudentIds.add(u.id);
        });
    }
    (await load('assignments')).forEach(a => ctx.assignmentInfo.set(a.id, { classId: a.classId, teacherId: a.teacherId }));
    (await load('exams')).forEach(e => ctx.examInfo.set(e.id, { classId: e.classId, createdBy: e.createdBy, status: e.status }));
    return ctx;
}

// Class ids a user receives class-targeted notifications for
async function notificationClassIds(who, load) {
    const ctx = await buildContext(who, load);
    if (ctx.scope === 'ALL') return [];
    return Array.from(new Set([...ctx.teachingClassIds, ...ctx.ownClassIds]));
}

function deny(ctx, reason) {
    if (reason) ctx.reason = reason;
    return false;
}

// ---------------------------------------------------------------------------
// Scope helpers (scope = the scope the relevant permission is held with)
// ---------------------------------------------------------------------------

// A class-bound record (assignment, exam, online class ...); `mine` covers records the person created or hosts
function classInScope(ctx, scope, classId, mine) {
    if (!scope) return false;
    if (scope === 'ALL') return true;
    if (scope === 'TEACHING') return !!mine || (!!classId && ctx.teachingClassIds.has(classId));
    return !!classId && (classId === 'all' || ctx.ownClassIds.has(classId));
}

// A record about a particular student
function studentInScope(ctx, scope, studentId) {
    if (scope === 'ALL') return true;
    if (scope === 'TEACHING') return ctx.teachingStudentIds.has(studentId);
    if (scope === 'SELF') return studentId === ctx.id;
    return false;
}

function assignmentInScope(ctx, scope, assignmentId) {
    if (scope === 'ALL') return true;
    const a = ctx.assignmentInfo.get(assignmentId);
    return !!a && classInScope(ctx, scope, a.classId, scope === 'TEACHING' && a.teacherId === ctx.id);
}

function examInScope(ctx, scope, examId) {
    if (scope === 'ALL') return true;
    const e = ctx.examInfo.get(examId);
    return !!e && classInScope(ctx, scope, e.classId, scope === 'TEACHING' && e.createdBy === ctx.id);
}

function examRecordInScope(ctx, scope, exam) {
    return !!exam && classInScope(ctx, scope, exam.classId, scope === 'TEACHING' && exam.createdBy === ctx.id);
}

// Scope that reaches other people's records (TEACHING or ALL)
function beyondSelf(scope) {
    return scope === 'ALL' || scope === 'TEACHING';
}

function owns(ctx, collection, rec) {
    const field = OWNER_FIELD[collection];
    return !!field && !!rec && rec[field] === ctx.id;
}

// Students, teachers and other staff accounts are managed with different permissions
function accountFamily(role) {
    if (role === 'STUDENT') return 'students';
    if (role === 'TEACHER') return 'teachers';
    return 'users';
}

function changedFields(before, after) {
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    return Array.from(keys).filter(k => !IGNORED_DIFF_FIELDS.includes(k)
        && JSON.stringify(before ? before[k] : undefined) !== JSON.stringify(after ? after[k] : undefined));
}

function daysAgo(dateStr) {
    const d = Date.parse(`${String(dateStr || '').slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(d)) return 0;
    return Math.floor((Date.now() - d) / 86400000);
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

function pick(rec, fields) {
    const out = {};
    fields.forEach(f => { if (rec[f] !== undefined) out[f] = rec[f]; });
    return out;
}

function without(rec, fields) {
    const out = { ...rec };
    fields.forEach(f => { delete out[f]; });
    return out;
}

function withoutAnswerKey(exam) {
    if (!Array.isArray(exam.questions)) return exam;
    return { ...exam, questions: exam.questions.map(q => without(q, ['correctIndex', 'answerKey', 'modelAnswer'])) };
}

function anonymousDonation(d) {
    return { ...without(d, ['email', 'phone', 'donorUserId', 'reference', 'proof']), donorName: 'Anonymous' };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

// Additional roles come from user_roles, never from the stored record
function withRoles(u, out) {
    return { ...out, additionalRoles: roles.additionalRolesOf(u) };
}

function readableUser(ctx, u) {
    if (u.id === ctx.id || ctx.isSuperAdmin) return withRoles(u, without(u, SECRET_USER_FIELDS));
    if (u.role === 'STUDENT') {
        const viaStudents = ctx.can('students.view') && studentInScope(ctx, ctx.scopeFor('students.view'), u.id);
        const viaOffice = STUDENT_DIRECTORY_PERMISSIONS.some(ctx.wide);
        if (!viaStudents && !viaOffice) return null;
        const sensitive = ctx.can('students.view_sensitive') && studentInScope(ctx, ctx.scopeFor('students.view_sensitive'), u.id);
        return withRoles(u, without(u, sensitive ? SECRET_USER_FIELDS : SECRET_USER_FIELDS.concat(SENSITIVE_USER_FIELDS)));
    }
    const full = u.role === 'TEACHER'
        ? ['teachers.create', 'teachers.update', 'teachers.deactivate', 'teachers.reset_password'].some(ctx.wide)
        : ctx.wide('users.view');
    return withRoles(u, full ? without(u, SECRET_USER_FIELDS) : pick(u, STAFF_DIRECTORY_FIELDS));
}

/** Returns the record as this user may see it, or null when it must not be sent at all. */
function readable(ctx, collection, rec) {
    if (!rec) return null;
    if (collection === 'users') return readableUser(ctx, rec);
    if (ctx.isSuperAdmin) return rec;
    if (SHARED_REFERENCE.includes(collection)) return rec;
    const s = ctx.scopeFor;
    const teachingMine = (scope, field) => scope === 'TEACHING' && rec[field] === ctx.id;

    switch (collection) {
        case 'assignments': {
            const sc = s('assignments.view');
            return classInScope(ctx, sc, rec.classId, teachingMine(sc, 'teacherId')) ? rec : null;
        }
        case 'assignmentSubmissions': {
            if (owns(ctx, collection, rec)) return rec;
            const sc = s('assignments.view');
            return beyondSelf(sc) && assignmentInScope(ctx, sc, rec.assignmentId) ? rec : null;
        }
        case 'exams': {
            const sc = s('exams.view');
            if (!examRecordInScope(ctx, sc, rec)) return null;
            // Answer keys: for those who write this paper, and for students once results are out
            const qs = s('exams.questions.manage');
            const keys = (beyondSelf(qs) && examRecordInScope(ctx, qs, rec)) || (sc === 'SELF' && !!rec.resultsPublished);
            return keys ? rec : withoutAnswerKey(rec);
        }
        case 'examSubmissions': {
            if (owns(ctx, collection, rec)) return rec;
            const sc = s('exams.mark');
            return beyondSelf(sc) && examInScope(ctx, sc, rec.examId) ? rec : null;
        }
        case 'examResults': {
            if (owns(ctx, collection, rec)) return rec.published ? rec : null;
            const ms = s('exams.mark');
            if (beyondSelf(ms) && (examInScope(ctx, ms, rec.examId) || classInScope(ctx, ms, rec.classId))) return rec;
            return (ctx.wide('exams.view') || ctx.wide('reports.academic')) && rec.published ? rec : null;
        }
        case 'feeChallans':
            if (owns(ctx, collection, rec)) return rec;
            return ctx.wide('fees.challans.view') ? rec : null;
        case 'donations':
            if (owns(ctx, collection, rec)) return rec;
            if (!ctx.wide('donations.view')) return null;
            return rec.isAnonymous && !ctx.wide('donations.view_donor_identity') ? anonymousDonation(rec) : rec;
        case 'libraryLoans':
            if (owns(ctx, collection, rec)) return rec;
            return ctx.wide('library.loans.view') ? rec : null;
        case 'attendance': {
            if (owns(ctx, collection, rec)) return rec;
            const sc = s('attendance.view');
            if (sc === 'ALL') return rec;
            if (sc !== 'TEACHING') return null;
            return ctx.teachingStudentIds.has(rec.userId) || (rec.role === 'STUDENT' && ctx.teachingClassIds.has(rec.classId)) ? rec : null;
        }
        case 'virtualClasses': {
            const sc = s('virtual_classes.view');
            return classInScope(ctx, sc, rec.classId, teachingMine(sc, 'hostId')) ? rec : null;
        }
        case 'virtualClassRecordings': {
            const sc = s('recordings.view');
            return classInScope(ctx, sc, rec.classId, teachingMine(sc, 'teacherId')) ? rec : null;
        }
        default:
            return null;
    }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

function dayDiff(a, b) {
    return Math.abs((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
}

// Self check-in: only today's own record, PRESENT or LATE; afterwards only the check-out time may change
function selfAttendanceAllowed(ctx, incoming, existing) {
    if (!ctx.can('attendance.self_checkin')) return deny(ctx, 'Your role does not use daily check-in.');
    if (incoming.userId !== ctx.id) return false;
    if (existing) return existing.userId === ctx.id;
    const today = new Date().toISOString().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(String(incoming.date || '')) && dayDiff(incoming.date, today) <= 1
        && ['PRESENT', 'LATE'].includes(incoming.status);
}

function markableAttendance(ctx, rec) {
    if (!rec || rec.userId === ctx.id) return false;
    const sc = ctx.scopeFor('attendance.mark');
    if (sc === 'ALL') return true;
    if (sc !== 'TEACHING') return false;
    return ctx.teachingStudentIds.has(rec.userId) || ctx.teachingClassIds.has(ctx.studentClass.get(rec.userId));
}

function oldAttendanceAllowed(ctx, ...records) {
    const old = records.some(r => r && daysAgo(r.date) > ATTENDANCE_EDIT_WINDOW_DAYS);
    return !old || ctx.can('attendance.correct') || deny(ctx, `Attendance older than ${ATTENDANCE_EDIT_WINDOW_DAYS} days can only be corrected by staff with that permission.`);
}

function roleExists(roleId) {
    return roleId === 'SUPER_ADMIN' || !!roles.getRole(roleId);
}

// A permission held with enough scope to act on this account
function accountPermissionInScope(ctx, family, permission, target) {
    const sc = ctx.scopeFor(permission);
    return family === 'students' ? studentInScope(ctx, sc, target.id) : sc === 'ALL';
}

function canWriteUser(ctx, incoming, existing) {
    // Own profile: always editable, protected fields are kept as stored (prepareWrite)
    if (incoming.id === ctx.id) return !!existing && existing.id === ctx.id;

    const family = accountFamily((existing || incoming).role);
    const newFamily = accountFamily(incoming.role);
    if (incoming.role && !roleExists(incoming.role)) return deny(ctx, `There is no role called ${incoming.role}.`);
    const extra = Array.isArray(incoming.additionalRoles) ? incoming.additionalRoles.map(r => String(r).toUpperCase()) : null;
    const unknown = (extra || []).find(r => !roleExists(r) || r === 'SUPER_ADMIN');
    if (unknown) return deny(ctx, `${unknown} cannot be given as an additional role.`);

    // Roles being given now: the main role (new account or changed) and additional roles not held before
    const before = existing ? roles.rolesOfUser(existing) : [];
    const given = [];
    if (!existing || incoming.role !== existing.role) given.push(incoming.role);
    if (extra) extra.filter(r => !before.includes(r)).forEach(r => given.push(r));
    const removedExtra = extra && existing ? roles.additionalRolesOf(existing).filter(r => !extra.includes(r)) : [];
    const rolesChanging = (existing && incoming.role !== existing.role) || (extra && (given.length > (existing ? 0 : 1) || removedExtra.length));

    if (rolesChanging && !ctx.wide('users.assign_roles')) return deny(ctx, 'You are not allowed to change anyone\'s roles.');
    const tooStrong = given.find(r => r && !roles.canAssignRole(ctx.eff, r));
    if (tooStrong) return deny(ctx, `You cannot give the role ${tooStrong}: it can do things you cannot.`);

    if (!existing) {
        return ctx.wide(`${newFamily}.create`) || deny(ctx, 'You are not allowed to create this kind of account.');
    }

    // Nobody manages a person more powerful than themselves
    if (!roles.canManagePerson(ctx.eff, existing)) return deny(ctx, 'This person can do things you cannot, so you cannot change their account.');

    const changed = changedFields(existing, incoming).filter(f => f !== 'role' && f !== 'additionalRoles');
    if (!changed.length) return true;
    if (family === 'students' && changed.every(f => ENROLMENT_FIELDS.includes(f)) && accountPermissionInScope(ctx, family, 'classes.enroll', existing)) return true;
    if (changed.includes('status') && !accountPermissionInScope(ctx, family, `${family}.deactivate`, existing)) {
        return deny(ctx, 'You are not allowed to activate or deactivate this account.');
    }
    const other = changed.filter(f => f !== 'status');
    return !other.length || accountPermissionInScope(ctx, family, `${family}.update`, existing) || deny(ctx, 'You are not allowed to edit this account.');
}

/** Whether the caller may give this account a (temporary) password. */
function canSetPassword(ctx, target, isNew) {
    if (!target || target.id === ctx.id) return false;
    if (ctx.isSuperAdmin) return true;
    const family = accountFamily(target.role);
    if (isNew) return ctx.wide(`${family}.create`);
    return accountPermissionInScope(ctx, family, `${family}.reset_password`, target) && roles.canManagePerson(ctx.eff, target);
}

/** Whether the caller may create (existing = null) or change this record. Sets ctx.reason when there is something to explain. */
function canWrite(ctx, collection, incoming, existing) {
    ctx.reason = null;
    if (ctx.isSuperAdmin) return true;
    const can = ctx.can;
    const s = ctx.scopeFor;
    const wide = ctx.wide;

    if (collection === 'users') return canWriteUser(ctx, incoming, existing);

    // The person's own records first
    if (collection === 'attendance' && (incoming.userId === ctx.id || (existing && existing.userId === ctx.id))) {
        return selfAttendanceAllowed(ctx, incoming, existing);
    }
    if (collection === 'donations' && !wide('donations.record')) {
        return can('donations.give') && !existing && (incoming.donorUserId === undefined || incoming.donorUserId === null || incoming.donorUserId === ctx.id);
    }
    if (collection === 'libraryLoans' && !wide('library.loans.issue')) {
        return can('library.request') && incoming.userId === ctx.id && (!existing || existing.userId === ctx.id);
    }
    if (collection === 'feeChallans' && (owns(ctx, collection, existing) || owns(ctx, collection, incoming)) && !wide('fees.challans.generate')) {
        // Challans exist already; the student may only add payment proof (prepareWrite)
        return can('fees.challans.submit_proof') && !!existing && owns(ctx, collection, existing);
    }
    if (collection === 'assignmentSubmissions' && (incoming.studentId === ctx.id || (existing && existing.studentId === ctx.id))) {
        if (!can('assignments.submit')) return false;
        if (existing && existing.studentId !== ctx.id) return false;
        if (existing && existing.isGraded) return deny(ctx, 'This work has already been checked. Ask your teacher to return it for resubmission.');
        const a = ctx.assignmentInfo.get(incoming.assignmentId || (existing && existing.assignmentId));
        return (!!a && classInScope(ctx, 'SELF', a.classId)) || deny(ctx, 'This assignment is not for your class.');
    }
    if (collection === 'examSubmissions' && (incoming.studentId === ctx.id || (existing && existing.studentId === ctx.id))) {
        if (!can('exams.attempt')) return false;
        if (existing && existing.studentId !== ctx.id) return false;
        const e = ctx.examInfo.get(incoming.examId || (existing && existing.examId));
        if (!e || !classInScope(ctx, 'SELF', e.classId)) return deny(ctx, 'This exam is not for your class.');
        if (!existing) return e.status === 'OPEN' || deny(ctx, 'This exam is not open.');
        return existing.status !== 'SUBMITTED' || deny(ctx, 'This paper has already been submitted.');
    }

    switch (collection) {
        case 'assignments': {
            if (!existing) {
                const sc = s('assignments.create');
                return beyondSelf(sc) && classInScope(ctx, sc, incoming.classId);
            }
            const sc = s('assignments.update');
            const mine = sc === 'TEACHING' && existing.teacherId === ctx.id;
            return beyondSelf(sc) && classInScope(ctx, sc, existing.classId, mine) && classInScope(ctx, sc, incoming.classId, mine);
        }
        case 'assignmentSubmissions': {
            // Checking work; submissions are created by students
            const sc = s('assignments.grade');
            return !!existing && beyondSelf(sc) && assignmentInScope(ctx, sc, existing.assignmentId);
        }
        case 'exams': {
            const sc = s(existing ? 'exams.update' : 'exams.create');
            if (!beyondSelf(sc)) return false;
            const scoped = (!existing || examRecordInScope(ctx, sc, existing)) && classInScope(ctx, sc, incoming.classId, !!existing && examRecordInScope(ctx, sc, existing));
            if (!scoped) return false;
            const before = existing || {};
            if (!!incoming.resultsPublished !== !!before.resultsPublished) {
                const needed = incoming.resultsPublished ? 'exams.results.publish' : 'exams.results.unpublish';
                if (!beyondSelf(s(needed))) return deny(ctx, incoming.resultsPublished ? 'You are not allowed to publish results.' : 'You are not allowed to withdraw published results.');
            }
            if (existing && incoming.status !== before.status && !beyondSelf(s('exams.schedule'))) return deny(ctx, 'You are not allowed to open or close exams.');
            if (JSON.stringify(incoming.questions || null) !== JSON.stringify(before.questions || null) && !beyondSelf(s('exams.questions.manage'))) {
                return deny(ctx, 'You are not allowed to write exam papers.');
            }
            return true;
        }
        case 'examSubmissions': {
            const sc = s('exams.mark');
            return !!existing && beyondSelf(sc) && examInScope(ctx, sc, existing.examId);
        }
        case 'examResults': {
            const sc = s('exams.mark');
            if (!beyondSelf(sc)) return false;
            if (!examInScope(ctx, sc, incoming.examId) || (existing && !examInScope(ctx, sc, existing.examId))) return false;
            const was = !!(existing && existing.published);
            if (!!incoming.published && !was && !beyondSelf(s('exams.results.publish'))) return deny(ctx, 'You are not allowed to publish results.');
            if (!incoming.published && was && !beyondSelf(s('exams.results.unpublish'))) return deny(ctx, 'You are not allowed to withdraw published results.');
            return true;
        }
        case 'attendance':
            return markableAttendance(ctx, incoming) && (!existing || markableAttendance(ctx, existing))
                && oldAttendanceAllowed(ctx, incoming, existing);
        case 'courseMaterials': {
            const sc = s('courses.materials.manage');
            const ok = r => classInScope(ctx, sc, r.classId) || (sc === 'TEACHING' && ctx.courseIds.has(r.courseId));
            return beyondSelf(sc) && ok(incoming) && (!existing || ok(existing));
        }
        case 'classes': {
            if (!existing) return wide('classes.manage');
            const changed = changedFields(existing, incoming);
            if (changed.every(f => ['teacherId', 'courseTeachers'].includes(f)) && wide('classes.assign_teachers')) return true;
            return wide('classes.manage');
        }
        case 'courses':
            return wide('courses.manage');
        case 'timetables':
            return wide('timetable.manage');
        case 'feeStructures':
            return wide('fees.structures.manage');
        case 'feeChallans': {
            if (!existing) return wide('fees.challans.generate');
            const changed = changedFields(existing, incoming);
            const paidChange = changed.includes('status') && (incoming.status === 'PAID' || existing.status === 'PAID');
            if (paidChange && !wide('fees.challans.verify')) return deny(ctx, 'You are not allowed to verify payments.');
            if (changed.includes('scholarshipWaiver') && !wide('fees.waivers.grant')) return deny(ctx, 'You are not allowed to grant waivers.');
            // Accepting or rejecting payment proof is verification work; any other change is editing the challan
            const verification = ['status', 'verifiedBy', 'verifiedAt', 'paidAt', 'bankRef', 'verificationNote', 'rejectionReason'];
            if (changed.every(f => verification.includes(f))) return wide('fees.challans.verify') || wide('fees.challans.generate');
            return wide('fees.challans.generate');
        }
        case 'donations': {
            if (!existing) return true; // donations.record checked above
            const confirming = existing.status === 'PENDING_CONFIRMATION' && incoming.status && incoming.status !== 'PENDING_CONFIRMATION';
            return !confirming || wide('donations.confirm') || deny(ctx, 'You are not allowed to confirm donations.');
        }
        case 'libraryBooks':
            return wide('library.catalog.manage');
        case 'libraryLoans': {
            if (!existing) return true; // library.loans.issue checked above
            const fineChange = changedFields(existing, incoming).some(f => ['fine', 'finePaid'].includes(f));
            return !fineChange || wide('library.fines.manage') || deny(ctx, 'You are not allowed to change library fines.');
        }
        case 'virtualClasses': {
            const hs = s('virtual_classes.host');
            const ok = r => wide('virtual_classes.manage')
                || (beyondSelf(hs) && classInScope(ctx, hs, r.classId, hs === 'TEACHING' && r.hostId === ctx.id));
            return ok(incoming) && (!existing || ok(existing));
        }
        case 'virtualClassRecordings': {
            const sc = s('recordings.manage');
            const ok = r => classInScope(ctx, sc, r.classId, sc === 'TEACHING' && r.teacherId === ctx.id);
            return beyondSelf(sc) && ok(incoming) && (!existing || ok(existing));
        }
        default:
            return false;
    }
}

/** Forces protected fields back to their stored values before an accepted write is saved. */
function prepareWrite(ctx, collection, incoming, existing) {
    if (ctx.isSuperAdmin) return incoming;
    const merged = { ...incoming };
    const wide = ctx.wide;

    if (existing) {
        IMMUTABLE_LINKS.forEach(f => {
            if (Object.prototype.hasOwnProperty.call(existing, f)) merged[f] = existing[f];
        });
    }
    const keep = fields => fields.forEach(f => {
        if (existing && Object.prototype.hasOwnProperty.call(existing, f)) merged[f] = existing[f];
        else delete merged[f];
    });

    if (collection === 'users') {
        if (incoming.id === ctx.id) {
            keep(ctx.scope === 'SELF' ? SELF_SCOPE_PROTECTED : STAFF_SELF_PROTECTED);
            merged.additionalRoles = roles.additionalRolesOf(existing || incoming);
        }
        return merged;
    }

    const ownRecord = owns(ctx, collection, existing || incoming);
    const manages = {
        libraryLoans: wide('library.loans.issue'),
        feeChallans: wide('fees.challans.generate'),
        donations: wide('donations.record'),
        assignmentSubmissions: false,
        examSubmissions: false
    };
    if (ownRecord && OWN_PROTECTED[collection] && !manages[collection]) keep(OWN_PROTECTED[collection]);

    if (collection === 'feeChallans' && ownRecord && !manages.feeChallans) {
        // The student may only submit payment proof for verification
        merged.status = incoming.status === 'VERIFICATION_PENDING' ? 'VERIFICATION_PENDING' : (existing ? existing.status : 'PENDING');
    }
    if (collection === 'libraryLoans' && !manages.libraryLoans) {
        merged.status = ['REQUESTED', 'CANCELLED'].includes(incoming.status) ? incoming.status : (existing ? existing.status : 'REQUESTED');
        if (!existing) merged.userId = ctx.id;
    }
    if (collection === 'donations' && !manages.donations) {
        keep(OWN_PROTECTED.donations);
        merged.donorUserId = ctx.id;
        merged.status = 'PENDING_CONFIRMATION';
    }
    if (collection === 'attendance' && (existing ? existing.userId : incoming.userId) === ctx.id) {
        if (existing) {
            // After checking in, only the check-out time can be added
            const out = { ...existing };
            if (incoming.checkOutTime && !existing.checkOutTime) out.checkOutTime = String(incoming.checkOutTime).slice(0, 20);
            out.updatedAt = new Date().toISOString();
            return out;
        }
        merged.userId = ctx.id;
        merged.role = ctx.user.role || ctx.roleId;
        merged.userName = ctx.user.name || merged.userName;
        merged.session = incoming.session === 'VIRTUAL_CLASS' ? 'VIRTUAL_CLASS' : 'DAILY_ACADEMIC';
        if (ctx.scope === 'SELF' && ctx.user.classId) merged.classId = ctx.user.classId;
    }
    return merged;
}

// Keeps scope maps current within one sync batch (an exam created a moment ago, then its results)
function noteWrite(ctx, collection, rec) {
    if (!rec) return;
    if (collection === 'assignments') ctx.assignmentInfo.set(rec.id, { classId: rec.classId, teacherId: rec.teacherId });
    if (collection === 'exams') ctx.examInfo.set(rec.id, { classId: rec.classId, createdBy: rec.createdBy, status: rec.status });
}

/** Whether the caller may delete this stored record. */
function canDelete(ctx, collection, existing) {
    ctx.reason = null;
    if (collection === 'users' && (existing.role === 'SUPER_ADMIN' || existing.id === ctx.id)) return false;
    if (ctx.isSuperAdmin) return true;
    const s = ctx.scopeFor;
    const wide = ctx.wide;
    const mine = (sc, field) => sc === 'TEACHING' && existing[field] === ctx.id;

    // Anyone may withdraw their own library request before it is issued
    if (collection === 'libraryLoans' && existing.userId === ctx.id && existing.status === 'REQUESTED') return true;

    switch (collection) {
        case 'users': {
            const family = accountFamily(existing.role);
            return wide(`${family}.delete`) && (roles.canManagePerson(ctx.eff, existing) || deny(ctx, 'This person can do things you cannot.'));
        }
        case 'assignments': {
            const sc = s('assignments.delete');
            return beyondSelf(sc) && classInScope(ctx, sc, existing.classId, mine(sc, 'teacherId'));
        }
        case 'assignmentSubmissions': {
            const sc = s('assignments.delete');
            return beyondSelf(sc) && assignmentInScope(ctx, sc, existing.assignmentId);
        }
        case 'exams': {
            const sc = s('exams.delete');
            return beyondSelf(sc) && examRecordInScope(ctx, sc, existing);
        }
        case 'examSubmissions':
        case 'examResults': {
            const sc = s('exams.delete');
            return beyondSelf(sc) && examInScope(ctx, sc, existing.examId);
        }
        case 'courseMaterials': {
            const sc = s('courses.materials.manage');
            return beyondSelf(sc) && (classInScope(ctx, sc, existing.classId) || (sc === 'TEACHING' && ctx.courseIds.has(existing.courseId)));
        }
        case 'attendance':
            return markableAttendance(ctx, existing) && oldAttendanceAllowed(ctx, existing);
        case 'classes': return wide('classes.manage');
        case 'courses': return wide('courses.manage');
        case 'timetables': return wide('timetable.manage');
        case 'feeStructures': return wide('fees.structures.manage');
        case 'feeChallans': return wide('fees.challans.generate');
        case 'donations': return wide('donations.record');
        case 'libraryBooks': return wide('library.catalog.manage');
        case 'libraryLoans': return wide('library.loans.issue');
        case 'virtualClasses': {
            const hs = s('virtual_classes.host');
            return wide('virtual_classes.manage') || (beyondSelf(hs) && classInScope(ctx, hs, existing.classId, mine(hs, 'hostId')));
        }
        case 'virtualClassRecordings': {
            const sc = s('recordings.manage');
            return beyondSelf(sc) && classInScope(ctx, sc, existing.classId, mine(sc, 'teacherId'));
        }
        default:
            return false;
    }
}

module.exports = {
    OWNER_FIELD,
    buildContext,
    notificationClassIds,
    readable,
    canWrite,
    canSetPassword,
    prepareWrite,
    noteWrite,
    canDelete,
    accountFamily
};
