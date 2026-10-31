/**
 * JAMIA ASHRAFIA LAHORE - EXECUTIVE REPORTS MODULE
 * Comprehensive Multi-Category Reporting Engine:
 * Student, Teacher, Attendance, Academic, Assignment, Exam, Admission, Fee, Library & Online Class Reports
 * Searchable, Filterable, with CSV & PDF/Print Export Options
 */

const ReportsModule = {
    activeCategory: 'STUDENTS',

    categories: [
        { id: 'STUDENTS', perm: 'reports.academic', label: 'Student Reports', icon: 'fas fa-user-graduate', urdu: 'رپورٹ برائے طلبہ' },
        { id: 'TEACHERS', perm: 'reports.academic', label: 'Teacher Reports', icon: 'fas fa-chalkboard-teacher', urdu: 'رپورٹ برائے اساتذہ' },
        { id: 'ATTENDANCE', perm: 'reports.attendance', label: 'Attendance Reports', icon: 'fas fa-calendar-check', urdu: 'رپورٹ حاضری و اوقات' },
        { id: 'CLASSES', perm: 'reports.academic', label: 'Class & Course Reports', icon: 'fas fa-book', urdu: 'رپورٹ نصاب و کتب' },
        { id: 'ASSIGNMENTS', perm: 'reports.academic', label: 'Assignment Reports', icon: 'fas fa-edit', urdu: 'رپورٹ واجبات و تمرینات' },
        { id: 'EXAMS', perm: 'reports.academic', label: 'Exam & Result Reports', icon: 'fas fa-award', urdu: 'رپورٹ وفاق امتحانات' },
        { id: 'ADMISSIONS', perm: 'reports.admissions', label: 'Admission Reports', icon: 'fas fa-user-plus', urdu: 'رپورٹ داخلہ امیدواران' },
        { id: 'FEES', perm: 'reports.finance', label: 'Fee & Payment Reports', icon: 'fas fa-hand-holding-heart', urdu: 'رپورٹ مالیات و صدقات' },
        { id: 'LIBRARY', perm: 'reports.library', label: 'Library Reports', icon: 'fas fa-book-reader', urdu: 'رپورٹ مکتبہ اشرفیہ' },
        { id: 'ONLINE_CLASSES', perm: 'reports.academic', label: 'Online Class Reports', icon: 'fas fa-video', urdu: 'رپورٹ زوم دروس' }
    ],

    render() {
        const user = window.AuthRBAC.currentUser;
        const role = window.AuthRBAC.getRole();

        // RBAC Enforcement
        if (!window.AuthRBAC.canAccessModule('reports')) {
            return `
                <div class="card" style="border: 2px solid var(--danger); text-align: center; padding: 48px 24px;">
                    <i class="fas fa-lock" style="font-size: 3rem; color: var(--danger); margin-bottom: 16px;"></i>
                    <h2>403 - Permission Denied</h2>
                    <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto 20px;">
                        Your active role does not have authorization to access Jamia Ashrafia Executive Reports.
                    </p>
                    <button class="btn btn-gold" onclick="App.navigate('dashboard')">Return to Dashboard</button>
                </div>
            `;
        }

        // Each report category needs its own permission (academic, attendance, admissions, finance, library)
        const allowed = this.categories.filter(c => window.AuthRBAC.can(c.perm));
        const cat = allowed.find(c => c.id === this.activeCategory) || allowed[0];
        if (!cat) return `<div class="card">${window.App.dashEmpty('No reports are available to your role.')}</div>`;
        this.activeCategory = cat.id;

        return `
            <!-- HEADER -->
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-chart-line" style="color: var(--gold-400);"></i>
                        Jamia Ashrafia Executive Academic & Operational Reports
                    </h1>
                    <p>Searchable institutional analytics, cross-modular audit summaries, and accredited Wifaq reporting data</p>
                </div>
                <div class="view-actions">
                    ${window.AuthRBAC.can('reports.export') ? `<button class="btn btn-secondary btn-sm" onclick="ReportsModule.exportCSV()">
                        <i class="fas fa-file-csv"></i> Export Current Report (CSV)
                    </button>` : ''}
                    <button class="btn btn-gold btn-sm" onclick="window.print()">
                        <i class="fas fa-print"></i> Print Official Report
                    </button>
                </div>
            </div>

            <!-- REPORT CATEGORY NAVIGATION BAR -->
            <div class="card" style="padding: 14px; margin-bottom: 20px; overflow-x: auto;">
                <div style="display: flex; gap: 8px; flex-wrap: nowrap; min-width: 900px;">
                    ${allowed.map(c => `
                        <button class="btn ${this.activeCategory === c.id ? 'btn-gold' : 'btn-secondary'} btn-sm" 
                                onclick="ReportsModule.setCategory('${Lms.esc(c.id)}')" 
                                style="white-space: nowrap; font-size: 0.8rem; padding: 8px 14px;">
                            <i class="${Lms.esc(c.icon)}"></i> ${Lms.esc(c.label)}
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- ACTIVE REPORT VIEWPORT -->
            ${this.renderActiveReportContent(cat)}
        `;
    },

    setCategory(catId) {
        this.activeCategory = catId;
        const viewport = document.getElementById('main-content-viewport');
        if (viewport) viewport.innerHTML = this.render();
    },

    // RENDER: Report content based on active category
    renderActiveReportContent(cat) {
        const reports = {
            STUDENTS: () => this.renderStudentReport(),
            TEACHERS: () => this.renderTeacherReport(),
            ATTENDANCE: () => this.renderAttendanceReport(),
            CLASSES: () => this.renderClassReport(),
            ASSIGNMENTS: () => this.renderAssignmentReport(),
            EXAMS: () => this.renderExamReport(),
            ADMISSIONS: () => this.renderAdmissionReport(),
            FEES: () => this.renderFeeReport(),
            LIBRARY: () => this.renderLibraryReport(),
            ONLINE_CLASSES: () => this.renderOnlineClassReport()
        };
        const contentHtml = (reports[this.activeCategory] || reports.STUDENTS)();

        return `
            <div class="card">
                <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h3 class="card-title">
                            <i class="${cat.icon}"></i> ${cat.label}
                        </h3>
                    </div>
                </div>

                ${contentHtml}
            </div>
        `;
    },

    // Table id of a report (the filter bar and the CSV export use it)
    tableId(cat) {
        return `report-${String(cat || this.activeCategory).toLowerCase()}`;
    },

    // A report table with its filter bar; rows carry data-f-* values for the filters
    reportTable(filters, headers, rows, empty) {
        const id = this.tableId();
        return `
            ${Lms.filterBar(id, filters)}
            <div class="table-responsive">
                <table class="data-table" id="${id}">
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody>
                        ${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}" style="text-align: center; color: var(--text-muted); padding: 30px;">${empty}</td></tr>`}
                    </tbody>
                </table>
            </div>
        `;
    },

    statusOptions(list) {
        return list.map(v => [v, v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ')]);
    },

    // 1. STUDENT REPORT
    renderStudentReport() {
        const students = (window.LmsData.users || []).filter(u => u.role === 'STUDENT');
        const boarder = s => !!(s.hostel && s.hostel.toLowerCase().includes('hostel'));
        return this.reportTable({
            search: 'Search name, roll no or class...',
            selects: [
                Lms.classFilter(),
                { key: 'status', label: 'All statuses', options: this.statusOptions(['ACTIVE', 'SUSPENDED', 'INACTIVE', 'GRADUATED']) },
                { key: 'residence', label: 'Hostel and day scholars', options: [['HOSTEL', 'Hostel'], ['DAY', 'Day Scholar']] },
                Lms.genderFilter(),
                Lms.campusFilter()
            ],
            date: { key: 'date', label: 'Enrollment date' }
        }, ['Roll Number', 'Scholar Name', 'Class', 'Hostel / Boarding', 'Enrollment Date', 'Attendance Pct', 'Status'], students.map(s => {
            const pct = Lms.attendancePct(s.id);
            const status = s.status || 'ACTIVE';
            return `
                <tr data-f-class="${Lms.esc(s.classId || '')}" data-f-status="${Lms.esc(status)}" data-f-residence="${boarder(s) ? 'HOSTEL' : 'DAY'}"
                    data-f-gender="${Lms.GENDERS[s.gender] ? s.gender : 'NONE'}" data-f-campus="${Lms.esc(s.branchId || '')}" data-f-date="${Lms.isoDate(s.enrollmentDate)}">
                    <td><span class="status-pill primary" style="font-family: monospace;">${Lms.esc(s.rollNo || 'N/A')}</span></td>
                    <td><div style="font-weight: 700; color: var(--primary-950);">${Lms.esc(Lms.localName(s.name, s.urduName))}</div></td>
                    <td>${Lms.getClass(s.classId) ? Lms.esc(Lms.className(s.classId)) : 'Not assigned'}</td>
                    <td style="color: var(--text-muted); font-size: 0.82rem;">${Lms.esc(s.hostel || 'Day Scholar')}</td>
                    <td>${Lms.esc(s.enrollmentDate || '—')}</td>
                    <td>${pct === null ? '<span style="color: var(--text-muted);">—</span>' : `<strong style="color: var(--primary-600);">${pct}%</strong>`}</td>
                    <td><span class="status-pill ${status === 'ACTIVE' ? 'success' : status === 'GRADUATED' ? 'gold' : 'danger'}">${Lms.esc(status)}</span></td>
                </tr>`;
        }), 'No students registered yet.');
    },

    // 2. TEACHER REPORT
    renderTeacherReport() {
        const teachers = (window.LmsData.users || []).filter(u => u.role === 'TEACHER');
        return this.reportTable({
            search: 'Search name, designation, specialization or email...',
            selects: [
                { key: 'status', label: 'All statuses', options: [['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']] },
                Lms.classFilter(null, 'All classes taught'),
                Lms.genderFilter(),
                Lms.campusFilter()
            ]
        }, ['Teacher Name', 'Designation / Chair', 'Specialization', 'Official Email', 'Accredited Sanad', 'Classes Taught'], teachers.map(t => {
            const classIds = Lms.teacherClassIds(t.id);
            return `
                <tr data-f-status="${t.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'}" data-f-class="${Lms.esc(classIds.join('|'))}"
                    data-f-gender="${Lms.GENDERS[t.gender] ? t.gender : 'NONE'}" data-f-campus="${Lms.campusValues(t)}">
                    <td><div style="font-weight: 700; color: var(--primary-950);">${Lms.esc(Lms.localName(t.name, t.urduName))}</div></td>
                    <td><span class="status-pill gold">${Lms.esc(t.designation || 'Teacher')}</span></td>
                    <td style="color: var(--text-secondary);">${Lms.esc(t.specialization || '—')}</td>
                    <td style="font-size: 0.82rem; color: var(--text-muted);">${Lms.esc(t.email || '—')}</td>
                    <td>${t.sanad || t.qualification ? `<span class="status-pill success">${Lms.esc(t.sanad || t.qualification)}</span>` : '—'}</td>
                    <td style="font-size: 0.82rem;">${classIds.length ? classIds.map(id => Lms.esc(Lms.className(id))).join(', ') : '—'}</td>
                </tr>`;
        }), 'No teachers registered yet.');
    },

    // 3. ATTENDANCE REPORT
    renderAttendanceReport() {
        const records = (window.LmsData.attendance || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
        const sessions = Array.from(new Set(records.map(r => r.session || 'DAILY'))).sort();
        return this.reportTable({
            search: 'Search name, ID or class...',
            selects: [
                { key: 'role', label: 'Everyone', options: [['STUDENT', 'Students'], ['TEACHER', 'Teachers'], ['STAFF', 'Staff']] },
                { key: 'status', label: 'All statuses', options: [['PRESENT', 'Present'], ['LATE', 'Late'], ['ABSENT', 'Absent']] },
                Lms.classFilter(),
                sessions.length > 1 ? { key: 'session', label: 'All sessions', options: sessions.map(v => [v, v]) } : null,
                Lms.campusFilter()
            ],
            date: { key: 'date', label: 'Date' }
        }, ['Date', 'Name / Scholar', 'Role', 'Class / Dept', 'Check-In Time', 'Check-Out Time', 'Punctuality Status', 'Session'], records.map(r => {
            const classId = r.classId || (r.role === 'STUDENT' ? (Lms.user(r.userId) || {}).classId : '');
            const cls = classId && Lms.getClass(classId);
            return `
                <tr data-f-role="${r.role === 'STUDENT' || r.role === 'TEACHER' ? r.role : 'STAFF'}" data-f-status="${Lms.esc(r.status)}" data-f-class="${Lms.esc(classId || '')}" data-f-session="${Lms.esc(r.session || 'DAILY')}"
                    data-f-campus="${cls ? Lms.esc(cls.branchId || '') : Lms.campusValues(Lms.user(r.userId))}" data-f-date="${Lms.esc(r.date)}" data-f-search="${Lms.esc(r.identifier || '')}">
                    <td><strong>${Lms.esc(r.date)}</strong></td>
                    <td style="font-weight: 700; color: var(--primary-950);">${Lms.esc(r.userName)}</td>
                    <td><span class="status-pill ${r.role === 'TEACHER' ? 'success' : 'primary'}">${Lms.esc(r.role)}</span></td>
                    <td style="font-size: 0.82rem; color: var(--text-secondary);">${Lms.esc(cls ? Lms.className(classId) : (r.className || 'General'))}</td>
                    <td style="color: ${r.status === 'LATE' ? 'var(--warning)' : 'var(--primary-300)'};">${Lms.esc(r.checkInTime || '—')}</td>
                    <td style="color: var(--text-muted);">${Lms.esc(r.checkOutTime || '—')}</td>
                    <td><span class="status-pill ${r.status === 'PRESENT' ? 'success' : (r.status === 'LATE' ? 'warning' : 'danger')}">${Lms.esc(r.status)}</span></td>
                    <td style="font-size: 0.8rem; color: var(--text-muted);">${Lms.esc(r.session || 'DAILY')}</td>
                </tr>`;
        }), 'No attendance recorded yet.');
    },

    // 4. CLASS & COURSE REPORT
    renderClassReport() {
        const courses = window.LmsData.courses || [];
        const programs = (window.LmsData.programs || []).filter(p => courses.some(c => c.programId === p.id));
        const years = Array.from(new Set(courses.map(c => String(c.year || '')).filter(Boolean))).sort();
        return this.reportTable({
            search: 'Search code, kitab or author...',
            selects: [
                { key: 'program', label: 'All programs', options: programs.map(p => [p.id, p.name]) },
                { key: 'year', label: 'All years', options: years.map(y => [y, I18n.t('Year {n}', { n: y })]) }
            ]
        }, ['Course Code', 'Kitab Title', 'Author / Imam', 'Program', 'Dars-e-Nizami Year', 'Credit Hours'], courses.map(c => `
            <tr data-f-program="${Lms.esc(c.programId || '')}" data-f-year="${Lms.esc(c.year || '')}">
                <td><span class="status-pill primary" style="font-family: monospace;">${Lms.esc(c.code)}</span></td>
                <td style="font-weight: 700; color: var(--primary-950);">${Lms.esc(Lms.localName(c.title, c.urduTitle))}</td>
                <td style="color: var(--text-muted); font-size: 0.82rem;">${Lms.esc(c.kitabAuthor || '—')}</td>
                <td style="font-size: 0.82rem;">${Lms.esc((Lms.program(c.programId) || {}).name || '—')}</td>
                <td>${c.year ? I18n.t('Year {n}', { n: Lms.esc(c.year) }) : '—'}</td>
                <td><strong>${Lms.esc(c.credits || 0)} Credits</strong></td>
            </tr>`), 'No courses yet.');
    },

    // 5. ASSIGNMENTS REPORT
    renderAssignmentReport() {
        const assignments = window.LmsData.assignments || [];
        const subs = window.LmsData.assignmentSubmissions || [];
        const courseIds = Array.from(new Set(assignments.map(a => a.courseId).filter(Boolean)));
        return this.reportTable({
            search: 'Search title, class, kitab or teacher...',
            selects: [
                Lms.classFilter(Array.from(new Set(assignments.map(a => a.classId)))),
                courseIds.length > 1 ? { key: 'course', label: 'All kitabs', options: courseIds.map(id => [id, Lms.courseTitle(id)]) } : null,
                { key: 'state', label: 'All assignments', options: [['OPEN', 'Open (not yet due)'], ['PAST', 'Past due date']] }
            ],
            date: { key: 'date', label: 'Due date' }
        }, ['Assignment Title', 'Class / Course', 'Assigned By', 'Due Date', 'Total Marks', 'Submissions Received'], assignments.map(a => {
            const count = subs.filter(s => s.assignmentId === a.id).length;
            return `
                <tr data-f-class="${Lms.esc(a.classId || '')}" data-f-course="${Lms.esc(a.courseId || '')}" data-f-state="${a.dueDate < Lms.today() ? 'PAST' : 'OPEN'}" data-f-date="${Lms.isoDate(a.dueDate)}">
                    <td style="font-weight: 700; color: var(--primary-950);">${Lms.esc(a.title)}</td>
                    <td>${Lms.esc(Lms.className(a.classId))}<div style="font-size: 0.75rem; color: var(--text-muted);">${Lms.esc(Lms.courseTitle(a.courseId))}</div></td>
                    <td style="color: var(--text-secondary);">${Lms.esc(Lms.userName(a.teacherId))}</td>
                    <td>${Lms.fmtDate(a.dueDate)}</td>
                    <td><span class="status-pill gold">${Lms.esc(a.maxMarks || 0)} Marks</span></td>
                    <td><strong style="color: var(--primary-300);">${count} Submitted</strong></td>
                </tr>`;
        }), 'No assignments yet.');
    },

    // 6. EXAM & WIFAQ RESULT REPORT
    renderExamReport() {
        const exams = (window.LmsData.exams || []).slice().sort((a, b) => String(b.examDate).localeCompare(String(a.examDate)));
        const ex = window.ExamsModule;
        return this.reportTable({
            search: 'Search exam title, class or kitab...',
            selects: [
                ex ? { key: 'type', label: 'All exam types', options: Object.entries(ex.EXAM_TYPES) } : null,
                Lms.classFilter(Array.from(new Set(exams.map(e => e.classId)))),
                ex ? { key: 'status', label: 'All statuses', options: ex.statusOptions } : null
            ],
            date: { key: 'date', label: 'Exam date' }
        }, ['Examination Title', 'Type', 'Class / Kitab', 'Exam Date', 'Total / Passing Marks', 'Status'], exams.map(e => `
            <tr data-f-type="${Lms.esc(e.examType || '')}" data-f-class="${Lms.esc(e.classId || '')}" data-f-status="${ex ? ex.statusKey(e) : ''}" data-f-date="${Lms.isoDate(e.examDate)}">
                <td style="font-weight: 700; color: var(--primary-950);">${Lms.esc(e.title)}</td>
                <td>${Lms.esc(ex ? (ex.EXAM_TYPES[e.examType] || e.examType || '—') : (e.examType || '—'))}</td>
                <td>${Lms.esc(Lms.className(e.classId))}<div style="font-size: 0.75rem; color: var(--text-muted);">${Lms.esc(Lms.courseTitle(e.courseId))}</div></td>
                <td>${Lms.fmtDate(e.examDate)}</td>
                <td>${ex ? ex.examTotal(e) : '—'} / ${Lms.esc(e.passingMarks || '—')}</td>
                <td>${ex ? ex.statusPill(e) : Lms.esc(e.status || '')}</td>
            </tr>`), 'No exams yet.');
    },

    // 7. ADMISSION REPORT
    renderAdmissionReport() {
        const admissions = window.LmsData.admissions || [];
        const programs = (window.LmsData.programs || []).filter(p => admissions.some(a => a.programId === p.id));
        return this.reportTable({
            search: 'Search application no, applicant or program...',
            selects: [
                { key: 'program', label: 'All programs', options: programs.map(p => [p.id, p.name]) },
                { key: 'status', label: 'All statuses', options: this.statusOptions(['APPLIED', 'UNDER_REVIEW', 'INTERVIEW_SCHEDULED', 'APPROVED', 'ENROLLED', 'REJECTED']) },
                Lms.campusFilter('All campuses')
            ],
            date: { key: 'date', label: 'Applied on' }
        }, ['Form No', 'Applicant Name', 'Program Applied', 'Branch Choice', 'Submission Date', 'Status'], admissions.map(a => `
            <tr data-f-program="${Lms.esc(a.programId || '')}" data-f-status="${Lms.esc(a.status || 'APPLIED')}" data-f-campus="${Lms.esc(a.branchId || '')}"
                data-f-date="${Lms.isoDate(a.appliedAt || a.createdAt)}" data-f-search="${Lms.esc([a.fatherName, a.cnic, a.passport].filter(Boolean).join(' '))}">
                <td><span class="status-pill primary">${Lms.esc(a.applicationNo || '—')}</span></td>
                <td style="font-weight: 700; color: var(--primary-950);">${Lms.esc(a.name || '—')}</td>
                <td>${Lms.esc((Lms.program(a.programId) || {}).name || a.programId || '—')}</td>
                <td>${Lms.esc(Lms.branchName(a.branchId) || '—')}</td>
                <td>${Lms.fmtDate(a.appliedAt || a.createdAt)}</td>
                <td><span class="status-pill ${a.status === 'APPROVED' || a.status === 'ENROLLED' ? 'success' : a.status === 'REJECTED' ? 'danger' : 'warning'}">${Lms.esc(a.status || 'APPLIED')}</span></td>
            </tr>`), 'No admission applications yet.');
    },

    // 8. FEE & PAYMENT REPORT
    renderFeeReport() {
        const fees = window.FeesDonationsModule;
        const challans = (window.LmsData.feeChallans || []).slice().sort((a, b) => String(b.dueDate).localeCompare(String(a.dueDate)));
        const types = fees ? fees.FEE_TYPES : {};
        return this.reportTable({
            search: 'Search challan no, student or month...',
            selects: [
                { key: 'status', label: 'All payment statuses', options: [['PENDING', 'Unpaid'], ['OVERDUE', 'Overdue'], ['VERIFICATION_PENDING', 'Awaiting verification'], ['PAID', 'Paid']] },
                { key: 'type', label: 'All fee types', options: Object.entries(types) },
                Lms.classFilter(),
                Lms.campusFilter()
            ],
            date: { key: 'date', label: 'Due date' }
        }, ['Challan No', 'Scholar / Student', 'Fee & Month', 'Tuition Fee', 'Hostel & Mess', 'Total Due', 'Due Date', 'Payment Status'], challans.map(c => {
            const student = Lms.user(c.studentId) || {};
            const overdue = fees && fees.isOverdue(c);
            return `
                <tr data-f-status="${Lms.esc(c.status || 'PENDING')}${overdue ? '|OVERDUE' : ''}" data-f-type="${Lms.esc(c.feeType || '')}" data-f-class="${Lms.esc(c.classId || student.classId || '')}"
                    data-f-campus="${Lms.esc(student.branchId || '')}" data-f-date="${Lms.isoDate(c.dueDate)}" data-f-search="${Lms.esc(c.rollNo || '')}">
                    <td><span class="status-pill primary" style="font-family: monospace;">${Lms.esc(c.challanNumber)}</span></td>
                    <td style="font-weight: 700; color: var(--primary-950);">${Lms.esc(c.studentName)}</td>
                    <td>${Lms.esc(types[c.feeType] || c.feeType || 'Fee')}<div style="font-size: 0.75rem; color: var(--text-muted);">${Lms.esc(c.billingMonth || '')}</div></td>
                    <td>${Lms.money(c.tuitionFee)}</td>
                    <td>${Lms.money(c.hostelMessFee)}</td>
                    <td><strong style="color: var(--gold-700);">${Lms.money(c.netPayable)}</strong></td>
                    <td style="${overdue ? 'color: var(--danger); font-weight: 700;' : ''}">${Lms.fmtDate(c.dueDate)}</td>
                    <td><span class="status-pill ${c.status === 'PAID' ? 'success' : c.status === 'VERIFICATION_PENDING' ? 'info' : 'danger'}">${Lms.esc(c.status || 'PENDING')}</span></td>
                </tr>`;
        }), 'No challans yet.');
    },

    // 9. LIBRARY REPORT
    renderLibraryReport() {
        const books = window.LmsData.libraryBooks || [];
        const categories = Array.from(new Set(books.map(b => b.category).filter(Boolean))).sort();
        const lib = window.LibraryModule;
        return this.reportTable({
            search: 'Search accession no, title or author...',
            selects: [
                { key: 'category', label: 'All categories', options: categories.map(c => [c, c]) },
                { key: 'avail', label: 'All books', options: [['AVAILABLE', 'Copies available'], ['OUT', 'All copies on loan'], ['DIGITAL', 'e-Book']] }
            ]
        }, ['Accession No', 'Book Title', 'Author', 'Category', 'Total Copies', 'Available'], books.map(b => {
            const avail = lib ? lib.available(b) : Number(b.totalCopies) || 0;
            return `
                <tr data-f-category="${Lms.esc(b.category || '')}" data-f-avail="${[avail > 0 ? 'AVAILABLE' : 'OUT', b.digitalUrl ? 'DIGITAL' : ''].filter(Boolean).join('|')}">
                    <td><span class="status-pill primary">${Lms.esc(b.accessionNo || '—')}</span></td>
                    <td style="font-weight: 700; color: var(--primary-950);" dir="auto">${Lms.esc(Lms.localName(b.title, b.arabicTitle))}</td>
                    <td style="color: var(--text-muted);">${Lms.esc(b.author || '—')}</td>
                    <td><span class="status-pill gold">${Lms.esc(b.category || 'General')}</span></td>
                    <td>${Lms.esc(b.totalCopies || 0)}</td>
                    <td><strong style="color: ${avail > 0 ? 'var(--primary-600)' : 'var(--danger)'};">${avail} Available</strong></td>
                </tr>`;
        }), 'No books in the catalog yet.');
    },

    // 10. ONLINE CLASS REPORT
    renderOnlineClassReport() {
        const live = (window.LmsData.virtualClasses || []).slice().sort((a, b) => String(b.scheduledStart || b.date || '').localeCompare(String(a.scheduledStart || a.date || '')));
        const pill = { LIVE: '<span class="status-pill urgent"><i class="fas fa-circle"></i> Live now</span>', UPCOMING: '<span class="status-pill gold">Upcoming</span>', COMPLETED: '<span class="status-pill success">Completed</span>' };
        return this.reportTable({
            search: 'Search topic, class or host...',
            selects: [
                Lms.classFilter(Array.from(new Set(live.map(v => v.classId).filter(Boolean)))),
                { key: 'status', label: 'All statuses', options: [['UPCOMING', 'Upcoming'], ['LIVE', 'Live now'], ['COMPLETED', 'Completed']] }
            ],
            date: { key: 'date', label: 'Scheduled' }
        }, ['Lecture Topic', 'Class', 'Host Sheikh / Teacher', 'Scheduled Time', 'Passcode', 'Active Scholars', 'Live Status'], live.map(v => `
            <tr data-f-class="${Lms.esc(v.classId || '')}" data-f-status="${Lms.esc(v.status || 'UPCOMING')}" data-f-date="${Lms.isoDate(v.scheduledStart || v.date)}">
                <td style="font-weight: 700; color: var(--primary-950);">${Lms.esc(v.title)}</td>
                <td style="font-size: 0.82rem;">${Lms.esc(v.classId ? Lms.className(v.classId) : (v.className || '—'))}</td>
                <td>${Lms.esc(v.hostTeacher || Lms.userName(v.hostId))}</td>
                <td>${v.scheduledStart ? Lms.fmtDateTime(v.scheduledStart) : Lms.fmtDate(v.date)}</td>
                <td><code>${Lms.esc(v.passcode || '—')}</code></td>
                <td><strong style="color: var(--primary-600);">${I18n.t('{n} joined', { n: window.VirtualClassModule ? window.VirtualClassModule.attendeeCount(v) : 0 })}</strong></td>
                <td>${pill[v.status] || Lms.esc(v.status || '—')}</td>
            </tr>`), 'No online classes yet.');
    },

    // EXPORT TO CSV: exactly the rows the report shows (after its filters)
    exportCSV() {
        const cat = this.activeCategory;
        const today = Lms.today();
        if (!Lms.exportTableCsv(this.tableId(cat), `Jamia_Ashrafia_Report_${cat}_${today}.csv`)) {
            App.showToast('No rows to export. Clear the filters or pick another report.', 'warning');
            return;
        }
        App.showToast(`Report for [${cat}] successfully exported to CSV!`, "gold");
    }
};

window.ReportsModule = ReportsModule;
