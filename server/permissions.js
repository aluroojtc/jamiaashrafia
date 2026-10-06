/**
 * JAMIA ASHRAFIA LAHORE - PERMISSION CATALOG
 *
 * The single list of everything a role can be allowed to do. Permissions are named <module>.<action>
 * (or <module>.<resource>.<action>). The database only stores which role holds which permission;
 * labels, descriptions, danger flags and dependencies live here, in code.
 *
 * Data scope is not part of a permission's name. It belongs to the role:
 *   ALL      - the whole institution (office staff)
 *   TEACHING - classes the person teaches (class teacher or teaching a kitab there), and their own records
 *   SELF     - only the person's own records and their own class's material
 */

const SCOPES = {
    ALL: { label: 'Whole institution', description: 'Records of every class, student and staff member.' },
    TEACHING: { label: 'Classes they teach', description: 'Only classes where this person is class teacher or teaches a kitab, plus their own records.' },
    SELF: { label: 'Own records only', description: 'Only this person\'s own records and their own class\'s material (the student portal).' }
};

const MODULES = [
    ['users', 'Users', 'System user accounts (office staff)'],
    ['roles', 'Roles & Permissions', 'Who may do what'],
    ['settings', 'Settings & Master Data', 'Admission window, live classes, recordings, branches and sessions'],
    ['audit', 'Audit Log', 'Record of security-relevant changes'],
    ['admissions', 'Admissions', 'Online applications, interviews and enrolment'],
    ['students', 'Students', 'Student records and accounts'],
    ['teachers', 'Teachers', 'Faculty records and accounts'],
    ['classes', 'Classes & Courses', 'Classes, kitabs, enrolment and teaching allocation'],
    ['timetable', 'Timetable', 'Lecture periods'],
    ['attendance', 'Attendance', 'Daily and class attendance'],
    ['assignments', 'Assignments', 'Homework and checking'],
    ['exams', 'Exams & Results', 'Papers, marking and results'],
    ['fees', 'Fees', 'Fee structures, challans and payments'],
    ['donations', 'Donations', 'Zakat, Sadaqah and other donations'],
    ['library', 'Library', 'Maktaba catalogue and loans'],
    ['notifications', 'Notifications', 'Sending notices and announcements'],
    ['virtual_classes', 'Online Classes', 'Live classes and recordings'],
    ['reports', 'Reports', 'Institution reports'],
    ['general', 'General', 'Pages open to most users']
];

// [key, label, description, { dangerous, implies }]
const P = [
    ['users.view', 'View staff accounts', 'See full records of office staff accounts.'],
    ['users.create', 'Create staff accounts', 'Add new staff accounts with a role.', { implies: ['users.view'] }],
    ['users.update', 'Edit staff accounts', 'Change staff names, contact details and designation.', { implies: ['users.view'] }],
    ['users.deactivate', 'Deactivate staff accounts', 'Switch staff accounts between active and inactive.', { implies: ['users.view'] }],
    ['users.delete', 'Delete staff accounts', 'Remove staff accounts.', { dangerous: true, implies: ['users.view'] }],
    ['users.reset_password', 'Reset staff passwords', 'Give a staff member a temporary password.', { dangerous: true, implies: ['users.view'] }],
    ['users.assign_roles', 'Change anyone\'s role', 'Move a person to a different role.', { dangerous: true, implies: ['users.view', 'roles.view'] }],
    ['users.export', 'Export staff list', 'Download staff accounts as a spreadsheet.', { implies: ['users.view'] }],

    ['roles.view', 'View roles', 'See roles and what each may do.'],
    ['roles.create', 'Create roles', 'Add roles. Only permissions you hold yourself can be given.', { dangerous: true, implies: ['roles.view'] }],
    ['roles.update', 'Edit roles', 'Change a role\'s permissions. Only permissions you hold yourself can be changed.', { dangerous: true, implies: ['roles.view'] }],
    ['roles.delete', 'Delete roles', 'Remove custom roles that nobody holds.', { dangerous: true, implies: ['roles.view'] }],

    ['settings.admissions', 'Admission window', 'Open or close admissions, set fees and deadlines.'],
    ['settings.meetings', 'Live class service', 'Choose the online meeting service.'],
    ['settings.recordings', 'Recording retention', 'Set how long recordings are kept and run clean-up.', { dangerous: true }],
    ['settings.architecture', 'System architecture page', 'Open the technical architecture page.'],

    ['audit.view', 'View audit log', 'See who changed roles, passwords, results and payments.'],

    ['admissions.view', 'View applications', 'See admission applications.'],
    ['admissions.update', 'Edit applications', 'Correct application details.', { implies: ['admissions.view'] }],
    ['admissions.schedule_interview', 'Schedule interviews', 'Set interview dates and scores.', { implies: ['admissions.view'] }],
    ['admissions.decide', 'Approve or reject', 'Approve or reject applications.', { implies: ['admissions.view'] }],
    ['admissions.enroll', 'Enrol applicants', 'Turn an approved application into a student account.', { implies: ['admissions.view', 'students.create'] }],
    ['admissions.export', 'Export applications', 'Download applications.', { implies: ['admissions.view'] }],

    ['students.view', 'View students', 'See student records (within the role\'s data scope).'],
    ['students.view_sensitive', 'View identity documents', 'See CNIC / B-Form, passport and other personal details.', { dangerous: true, implies: ['students.view'] }],
    ['students.create', 'Register students', 'Create student accounts.', { implies: ['students.view'] }],
    ['students.update', 'Edit students', 'Change student details.', { implies: ['students.view'] }],
    ['students.deactivate', 'Suspend students', 'Suspend or reactivate student accounts.', { implies: ['students.view'] }],
    ['students.delete', 'Delete students', 'Remove student accounts.', { dangerous: true, implies: ['students.view'] }],
    ['students.reset_password', 'Reset student passwords', 'Give a student a temporary password.', { implies: ['students.view'] }],
    ['students.export', 'Export students', 'Download student lists with contact details.', { dangerous: true, implies: ['students.view'] }],

    ['teachers.view', 'View faculty', 'See the faculty directory.'],
    ['teachers.create', 'Register teachers', 'Create teacher accounts.', { implies: ['teachers.view'] }],
    ['teachers.update', 'Edit teachers', 'Change teacher details.', { implies: ['teachers.view'] }],
    ['teachers.deactivate', 'Deactivate teachers', 'Switch teacher accounts between active and inactive.', { implies: ['teachers.view'] }],
    ['teachers.delete', 'Delete teachers', 'Remove teacher accounts.', { dangerous: true, implies: ['teachers.view'] }],
    ['teachers.reset_password', 'Reset teacher passwords', 'Give a teacher a temporary password.', { implies: ['teachers.view'] }],

    ['classes.view', 'View classes & kitabs', 'See classes and the kitabs taught in them.'],
    ['classes.manage', 'Manage classes', 'Create, edit and delete classes.', { implies: ['classes.view'] }],
    ['classes.enroll', 'Enrol students in classes', 'Move students into or out of a class.', { implies: ['classes.view', 'students.view'] }],
    ['classes.assign_teachers', 'Allocate teachers', 'Choose class teachers and who teaches each kitab.', { implies: ['classes.view'] }],
    ['courses.manage', 'Manage kitabs / courses', 'Create, edit and delete courses.', { implies: ['classes.view'] }],
    ['courses.materials.manage', 'Upload course material', 'Add and remove lecture notes and files.', { implies: ['classes.view'] }],

    ['timetable.view', 'View timetable', 'See lecture periods.'],
    ['timetable.manage', 'Manage timetable', 'Add, change and remove periods.', { implies: ['timetable.view'] }],

    ['attendance.view', 'View attendance', 'See attendance records (within the role\'s data scope).'],
    ['attendance.self_checkin', 'Daily check-in', 'Record one\'s own arrival and departure.'],
    ['attendance.mark', 'Mark attendance', 'Mark students present, late or absent.', { implies: ['attendance.view'] }],
    ['attendance.correct', 'Correct old attendance', 'Change attendance older than 7 days.', { dangerous: true, implies: ['attendance.mark'] }],
    ['attendance.export', 'Export attendance', 'Download attendance records.', { implies: ['attendance.view'] }],

    ['assignments.view', 'View assignments', 'See assignments (within the role\'s data scope).'],
    ['assignments.create', 'Create assignments', 'Publish new assignments.', { implies: ['assignments.view'] }],
    ['assignments.update', 'Edit assignments', 'Change assignments.', { implies: ['assignments.view'] }],
    ['assignments.delete', 'Delete assignments', 'Remove assignments and their submissions.', { implies: ['assignments.view'] }],
    ['assignments.grade', 'Check & grade work', 'Mark submissions and give feedback.', { implies: ['assignments.view'] }],
    ['assignments.submit', 'Submit assignments', 'Hand in one\'s own work.', { implies: ['assignments.view'] }],

    ['exams.view', 'View exams', 'See exam schedules and papers (answer keys excluded).'],
    ['exams.create', 'Create exams', 'Set new exams and quizzes.', { implies: ['exams.view'] }],
    ['exams.update', 'Edit exams', 'Change exam details.', { implies: ['exams.view'] }],
    ['exams.delete', 'Delete exams', 'Remove exams with their papers and results.', { dangerous: true, implies: ['exams.view'] }],
    ['exams.questions.manage', 'Write papers & answer keys', 'Write questions and see answer keys.', { implies: ['exams.view'] }],
    ['exams.schedule', 'Open & close exams', 'Start and end online papers.', { implies: ['exams.view'] }],
    ['exams.attempt', 'Sit exams', 'Attempt online papers.', { implies: ['exams.view'] }],
    ['exams.mark', 'Mark papers', 'Enter marks and remarks.', { implies: ['exams.view'] }],
    ['exams.results.approve', 'Approve results', 'Confirm marks before publication.', { implies: ['exams.mark'] }],
    ['exams.results.publish', 'Publish results', 'Make results visible to students.', { dangerous: true, implies: ['exams.mark'] }],
    ['exams.results.unpublish', 'Withdraw results', 'Hide results that were published.', { dangerous: true, implies: ['exams.mark'] }],

    ['fees.structures.view', 'View fee structures', 'See fee amounts per programme.'],
    ['fees.structures.manage', 'Manage fee structures', 'Change fee amounts.', { implies: ['fees.structures.view'] }],
    ['fees.challans.view', 'View fee challans', 'See fee challans (others\' challans need whole-institution scope).'],
    ['fees.challans.generate', 'Issue & edit challans', 'Create, edit and cancel fee challans.', { implies: ['fees.challans.view'] }],
    ['fees.challans.verify', 'Verify payments', 'Mark challans as paid after checking payment proof.', { dangerous: true, implies: ['fees.challans.view'] }],
    ['fees.challans.submit_proof', 'Upload payment proof', 'Submit proof of payment for one\'s own challan.', { implies: ['fees.challans.view'] }],
    ['fees.waivers.grant', 'Grant waivers', 'Give scholarships and fee concessions.', { dangerous: true, implies: ['fees.challans.generate'] }],
    ['fees.export', 'Export fee records', 'Download fee records.', { implies: ['fees.challans.view'] }],

    ['donations.view', 'View donations ledger', 'See donations (anonymous donors stay hidden).'],
    ['donations.view_donor_identity', 'See anonymous donors', 'See who gave anonymous donations.', { dangerous: true, implies: ['donations.view'] }],
    ['donations.record', 'Record donations', 'Enter donations received by the office.', { implies: ['donations.view'] }],
    ['donations.confirm', 'Confirm donations', 'Confirm that a reported donation was received.', { dangerous: true, implies: ['donations.view'] }],
    ['donations.give', 'Donate through the portal', 'Report one\'s own donation for confirmation.'],

    ['library.catalog.view', 'Search the library', 'See the catalogue.'],
    ['library.catalog.manage', 'Manage the catalogue', 'Add, edit and remove books.', { implies: ['library.catalog.view'] }],
    ['library.loans.view', 'View all loans', 'See who has which book.', { implies: ['library.catalog.view'] }],
    ['library.loans.issue', 'Issue & return books', 'Issue books and record returns.', { implies: ['library.loans.view'] }],
    ['library.fines.manage', 'Manage fines', 'Set and waive library fines.', { implies: ['library.loans.issue'] }],
    ['library.request', 'Request books', 'Ask to borrow a book.', { implies: ['library.catalog.view'] }],

    ['notifications.send_individual', 'Message individuals', 'Send a notice to a particular person.'],
    ['notifications.send_class', 'Notify a class', 'Send a notice to the students of a class (within the role\'s data scope).'],
    ['notifications.broadcast_role', 'Notify a whole role', 'Send a notice to everyone in a role, e.g. all students.'],
    ['notifications.broadcast_all', 'Announce to everyone', 'Send an announcement to every user.', { dangerous: true }],

    ['virtual_classes.view', 'See online classes', 'See scheduled and live classes (within the role\'s data scope).'],
    ['virtual_classes.join', 'Join online classes', 'Attend live classes of one\'s own class.', { implies: ['virtual_classes.view'] }],
    ['virtual_classes.host', 'Host online classes', 'Schedule and teach live classes (within the role\'s data scope).', { implies: ['virtual_classes.view'] }],
    ['virtual_classes.manage', 'Manage all online classes', 'Host or end any class.', { implies: ['virtual_classes.host'] }],
    ['recordings.view', 'Watch recordings', 'Watch lecture recordings (within the role\'s data scope).'],
    ['recordings.download', 'Download recordings', 'Download lecture recordings.', { implies: ['recordings.view'] }],
    ['recordings.manage', 'Manage recordings', 'Add and remove recordings.', { implies: ['recordings.view'] }],

    ['reports.academic', 'Academic reports', 'Student, faculty and results reports.'],
    ['reports.attendance', 'Attendance reports', 'Attendance summaries.'],
    ['reports.finance', 'Finance reports', 'Fee and donation summaries.'],
    ['reports.admissions', 'Admission reports', 'Admission statistics.'],
    ['reports.library', 'Library reports', 'Library statistics.'],
    ['reports.export', 'Export reports', 'Download reports.'],

    ['heritage.view', 'Institutional heritage', 'Open the history and branches page.']
];

const CATALOG = P.map(([key, label, description, opts = {}]) => ({
    key,
    module: key.split('.')[0] === 'courses' ? 'classes'
        : key.split('.')[0] === 'recordings' ? 'virtual_classes'
            : key.split('.')[0] === 'heritage' ? 'general'
                : key.split('.')[0],
    label,
    description,
    dangerous: !!opts.dangerous,
    implies: opts.implies || []
}));
const BY_KEY = new Map(CATALOG.map(p => [p.key, p]));

function isKnown(key) {
    return BY_KEY.has(key);
}

// A set of permissions plus everything they imply (e.g. exams.update brings exams.view)
function expand(keys) {
    const out = new Set();
    const visit = k => {
        if (out.has(k) || !BY_KEY.has(k)) return;
        out.add(k);
        BY_KEY.get(k).implies.forEach(visit);
    };
    (keys || []).forEach(visit);
    return out;
}

// ---------------------------------------------------------------------------
// Built-in roles
// ---------------------------------------------------------------------------

// Super Admin never appears here: it holds everything, in code (see roles.js).
const SYSTEM_ROLES = {
    ACADEMIC_ADMIN: {
        name: 'Admin', urduTitle: 'ناظم تعلیمات', badgeClass: 'info', scope: 'ALL',
        description: 'Administrative oversight of admissions, class allocations, syllabus, timetables, and academic rosters.'
    },
    TEACHER: {
        name: 'Teacher (Sheikh-ul-Hadith)', urduTitle: 'استاذ / شیخ الحدیث', badgeClass: 'success', scope: 'TEACHING',
        description: 'Faculty access for assigned kitabs, live dars, assignment grading, and attendance marking.'
    },
    STUDENT: {
        name: 'Student (Talib-e-Ilm)', urduTitle: 'طالب علم', badgeClass: 'primary', scope: 'SELF',
        description: 'Scholar access for daily dars, attendance check-in, homework submissions, and results.'
    }
};

// Defaults reproduce what each role could do before the permission catalog existed
const DEFAULT_PERMISSIONS = {
    ACADEMIC_ADMIN: [
        'roles.view', 'roles.create', 'roles.update', 'roles.delete',
        'settings.admissions', 'settings.meetings',
        'admissions.view', 'admissions.update', 'admissions.schedule_interview', 'admissions.decide', 'admissions.enroll', 'admissions.export',
        'students.view', 'students.view_sensitive', 'students.create', 'students.update', 'students.deactivate', 'students.delete',
        'students.reset_password', 'students.export',
        'teachers.view', 'teachers.create', 'teachers.update', 'teachers.deactivate', 'teachers.reset_password',
        'classes.view', 'classes.manage', 'classes.enroll', 'classes.assign_teachers', 'courses.manage', 'courses.materials.manage',
        'timetable.view', 'timetable.manage',
        'attendance.view', 'attendance.self_checkin', 'attendance.mark', 'attendance.correct', 'attendance.export',
        'assignments.view', 'assignments.create', 'assignments.update', 'assignments.delete', 'assignments.grade',
        'exams.view', 'exams.create', 'exams.update', 'exams.delete', 'exams.questions.manage', 'exams.schedule', 'exams.mark',
        'exams.results.approve', 'exams.results.publish', 'exams.results.unpublish',
        'fees.structures.view', 'fees.challans.view', 'donations.view',
        'library.catalog.view', 'library.catalog.manage', 'library.loans.view', 'library.loans.issue', 'library.fines.manage', 'library.request',
        'notifications.send_individual', 'notifications.send_class', 'notifications.broadcast_role', 'notifications.broadcast_all',
        'virtual_classes.view', 'virtual_classes.join', 'virtual_classes.host', 'virtual_classes.manage',
        'recordings.view', 'recordings.download', 'recordings.manage',
        'reports.academic', 'reports.attendance', 'reports.admissions', 'reports.library', 'reports.export',
        'donations.give', 'heritage.view'
    ],
    TEACHER: [
        'students.view', 'teachers.view',
        'classes.view', 'courses.materials.manage', 'timetable.view',
        'attendance.view', 'attendance.self_checkin', 'attendance.mark',
        'assignments.view', 'assignments.create', 'assignments.update', 'assignments.delete', 'assignments.grade',
        'exams.view', 'exams.create', 'exams.update', 'exams.delete', 'exams.questions.manage', 'exams.schedule', 'exams.mark',
        'exams.results.publish',
        'library.catalog.view', 'library.request',
        'notifications.send_individual', 'notifications.send_class',
        'virtual_classes.view', 'virtual_classes.join', 'virtual_classes.host', 'recordings.view', 'recordings.manage',
        'donations.give', 'heritage.view'
    ],
    STUDENT: [
        'classes.view', 'timetable.view',
        'attendance.view', 'attendance.self_checkin',
        'assignments.view', 'assignments.submit',
        'exams.view', 'exams.attempt',
        'fees.structures.view', 'fees.challans.view', 'fees.challans.submit_proof',
        'library.catalog.view', 'library.request',
        'notifications.send_individual',
        'virtual_classes.view', 'virtual_classes.join', 'recordings.view',
        'donations.give', 'heritage.view'
    ],
    // Not system roles, but these ids had powers written into the code; they keep them
    ACCOUNTANT: [
        'fees.structures.view', 'fees.structures.manage', 'fees.challans.view', 'fees.challans.generate', 'fees.challans.verify',
        'fees.waivers.grant', 'fees.export',
        'donations.view', 'donations.view_donor_identity', 'donations.record', 'donations.confirm', 'donations.give',
        'attendance.view', 'attendance.self_checkin',
        'notifications.send_individual', 'notifications.broadcast_role',
        'reports.finance', 'reports.attendance', 'heritage.view'
    ],
    LIBRARIAN: [
        'library.catalog.view', 'library.catalog.manage', 'library.loans.view', 'library.loans.issue', 'library.fines.manage', 'library.request',
        'attendance.self_checkin', 'notifications.send_individual', 'reports.library', 'heritage.view'
    ]
};

// The most a Student or Teacher role can ever hold, whatever is ticked (they are portals, not office roles)
const ROLE_CEILING = {
    STUDENT: new Set(DEFAULT_PERMISSIONS.STUDENT.concat(['recordings.download'])),
    TEACHER: new Set(DEFAULT_PERMISSIONS.TEACHER.concat([
        'courses.manage', 'students.view_sensitive', 'exams.results.approve', 'exams.results.unpublish', 'recordings.download',
        'attendance.export', 'reports.academic', 'reports.attendance'
    ]))
};

// Module switches from the old Roles screen -> read permissions (used once, when importing custom roles)
const LEGACY_MODULE_PERMISSIONS = {
    students: ['students.view'],
    users: ['users.view'],
    roles: ['roles.view', 'roles.create', 'roles.update', 'roles.delete'],
    attendance: ['attendance.view', 'attendance.self_checkin'],
    reports: ['reports.academic', 'reports.attendance'],
    classes: ['classes.view'],
    assignments: ['assignments.view'],
    exams: ['exams.view'],
    timetable: ['timetable.view'],
    virtual_class: ['virtual_classes.view', 'recordings.view'],
    notifications: [],
    library: ['library.catalog.view', 'library.loans.view', 'library.request'],
    admissions: ['admissions.view'],
    teachers: ['teachers.view'],
    fees: ['fees.structures.view', 'fees.challans.view', 'donations.view'],
    heritage: ['heritage.view'],
    security: ['settings.architecture']
};

// Old capability names still used by pages that have not been converted (accepted for one release)
const LEGACY_ALIASES = {
    'admissions:manage': 'admissions.update', 'admissions:approve': 'admissions.decide', 'admissions:apply': null,
    'classes:manage': 'classes.manage', 'courses:manage': 'courses.manage', 'teachers:manage': 'teachers.update',
    'timetable:manage': 'timetable.manage', 'exams:manage': 'exams.update', 'exams:grade': 'exams.mark',
    'exams:results_publish': 'exams.results.publish', 'exams:submit': 'exams.attempt',
    'assignments:create': 'assignments.create', 'assignments:grade': 'assignments.grade', 'assignments:submit': 'assignments.submit',
    'attendance:mark': 'attendance.mark', 'attendance:checkin': 'attendance.self_checkin',
    'notifications:broadcast': 'notifications.broadcast_role', 'notifications:class': 'notifications.send_class',
    'virtual_class:host': 'virtual_classes.host', 'virtual_class:join': 'virtual_classes.join',
    'library:view': 'library.catalog.view', 'library:borrow': 'library.request', 'library:search_reserve': 'library.request',
    'library:manage': 'library.loans.issue', 'fees:manage': 'fees.structures.manage', 'challan:generate': 'fees.challans.generate',
    'challan:verify': 'fees.challans.verify', 'challan:download': 'fees.challans.view', 'donations:record': 'donations.record',
    'donations:receipt': 'donations.view', 'zakat:audit': 'reports.finance', 'results:view': 'exams.view',
    'classes:view_assigned': 'classes.view', 'classes:view_enrolled': 'classes.view'
};

// How wide a data scope reaches (whole institution > classes taught > own records)
const SCOPE_RANK = { SELF: 1, TEACHING: 2, ALL: 3 };

// Things people do for themselves. They give no power over anyone else, so they are left out when deciding
// whether one person (or role) is more powerful than another.
const SELF_SERVICE = new Set(['assignments.submit', 'exams.attempt', 'fees.challans.submit_proof', 'attendance.self_checkin',
    'donations.give', 'library.request', 'virtual_classes.join', 'notifications.send_individual', 'heritage.view']);

// Pairs one person should preferably not hold together (the institution may still choose to allow it)
const SOD_PAIRS = [
    ['exams.mark', 'exams.results.publish', 'The same person marks papers and publishes the results.'],
    ['fees.challans.generate', 'fees.challans.verify', 'The same person issues challans and confirms they were paid.'],
    ['fees.waivers.grant', 'fees.challans.verify', 'The same person grants waivers and confirms payments.'],
    ['donations.record', 'donations.confirm', 'The same person records donations and confirms they were received.'],
    ['roles.update', 'users.assign_roles', 'The same person defines what roles may do and gives roles to people.']
];

function sodWarnings(keys) {
    const set = keys instanceof Set ? keys : new Set(keys || []);
    return SOD_PAIRS.filter(([a, b]) => set.has(a) && set.has(b)).map(([a, b, text]) => ({ permissions: [a, b], message: text }));
}

// Ready-made roles created once (they can be edited, or deleted while nobody holds them)
const TEMPLATE_ROLES = {
    EXAM_OFFICER: {
        name: 'Examination Officer (Nazim-e-Imtihanat)', urduTitle: 'ناظم امتحانات', badgeClass: 'primary', scope: 'ALL',
        description: 'Schedules exams, approves and publishes results, and manages exam papers across all classes.',
        permissions: ['exams.view', 'exams.create', 'exams.update', 'exams.questions.manage', 'exams.schedule', 'exams.mark',
            'exams.results.approve', 'exams.results.publish', 'exams.results.unpublish', 'students.view', 'classes.view',
            'timetable.view', 'reports.academic', 'reports.export', 'notifications.send_individual', 'notifications.send_class',
            'attendance.self_checkin', 'heritage.view']
    },
    LIBRARIAN: {
        name: 'Librarian (Nazim-e-Kutub Khana)', urduTitle: 'ناظم کتب خانہ', badgeClass: 'success', scope: 'ALL',
        description: 'Maintains the Maktaba catalogue, issues and receives books and manages fines.',
        permissions: DEFAULT_PERMISSIONS.LIBRARIAN
    }
};

module.exports = {
    SCOPE_RANK,
    SELF_SERVICE,
    SOD_PAIRS,
    sodWarnings,
    TEMPLATE_ROLES,
    SCOPES,
    MODULES,
    CATALOG,
    isKnown,
    expand,
    SYSTEM_ROLES,
    DEFAULT_PERMISSIONS,
    ROLE_CEILING,
    LEGACY_MODULE_PERMISSIONS,
    LEGACY_ALIASES
};
