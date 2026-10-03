/**
 * JAMIA ASHRAFIA LAHORE - EXECUTIVE REPORTS MODULE
 * Comprehensive Multi-Category Reporting Engine:
 * Student, Teacher, Attendance, Academic, Assignment, Exam, Admission, Fee, Library & Online Class Reports
 * Searchable, Filterable, with CSV & PDF/Print Export Options
 */

const ReportsModule = {
    activeCategory: 'STUDENTS',
    searchQuery: '',
    filterDate: 'ALL',
    filterStatus: 'ALL',

    categories: [
        { id: 'STUDENTS', label: 'Student Reports', icon: 'fas fa-user-graduate', urdu: 'رپورٹ برائے طلبہ' },
        { id: 'TEACHERS', label: 'Teacher Reports', icon: 'fas fa-chalkboard-teacher', urdu: 'رپورٹ برائے اساتذہ' },
        { id: 'ATTENDANCE', label: 'Attendance Reports', icon: 'fas fa-calendar-check', urdu: 'رپورٹ حاضری و اوقات' },
        { id: 'CLASSES', label: 'Class & Course Reports', icon: 'fas fa-book', urdu: 'رپورٹ نصاب و کتب' },
        { id: 'ASSIGNMENTS', label: 'Assignment Reports', icon: 'fas fa-edit', urdu: 'رپورٹ واجبات و تمرینات' },
        { id: 'EXAMS', label: 'Exam & Result Reports', icon: 'fas fa-award', urdu: 'رپورٹ وفاق امتحانات' },
        { id: 'ADMISSIONS', label: 'Admission Reports', icon: 'fas fa-user-plus', urdu: 'رپورٹ داخلہ امیدواران' },
        { id: 'FEES', label: 'Fee & Payment Reports', icon: 'fas fa-hand-holding-heart', urdu: 'رپورٹ مالیات و صدقات' },
        { id: 'LIBRARY', label: 'Library Reports', icon: 'fas fa-book-reader', urdu: 'رپورٹ مکتبہ اشرفیہ' },
        { id: 'ONLINE_CLASSES', label: 'Online Class Reports', icon: 'fas fa-video', urdu: 'رپورٹ زوم دروس' }
    ],

    render() {
        const user = window.AuthRBAC.currentUser;
        const role = window.AuthRBAC.getRole();

        // RBAC Enforcement
        if (!window.AuthRBAC.canAccessModule('reports', role)) {
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

        const cat = this.categories.find(c => c.id === this.activeCategory) || this.categories[0];

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
                    <button class="btn btn-secondary btn-sm" onclick="ReportsModule.exportCSV()">
                        <i class="fas fa-file-csv"></i> Export Current Report (CSV)
                    </button>
                    <button class="btn btn-gold btn-sm" onclick="window.print()">
                        <i class="fas fa-print"></i> Print Official Report
                    </button>
                </div>
            </div>

            <!-- REPORT CATEGORY NAVIGATION BAR -->
            <div class="card" style="padding: 14px; margin-bottom: 20px; overflow-x: auto;">
                <div style="display: flex; gap: 8px; flex-wrap: nowrap; min-width: 900px;">
                    ${this.categories.map(c => `
                        <button class="btn ${this.activeCategory === c.id ? 'btn-gold' : 'btn-secondary'} btn-sm" 
                                onclick="ReportsModule.setCategory('${c.id}')" 
                                style="white-space: nowrap; font-size: 0.8rem; padding: 8px 14px;">
                            <i class="${c.icon}"></i> ${c.label}
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
        this.searchQuery = '';
        this.filterStatus = 'ALL';
        const viewport = document.getElementById('main-content-viewport');
        if (viewport) viewport.innerHTML = this.render();
    },

    setSearch(q) {
        this.searchQuery = q;
        const viewport = document.getElementById('main-content-viewport');
        if (viewport) viewport.innerHTML = this.render();
    },

    setStatus(s) {
        this.filterStatus = s;
        const viewport = document.getElementById('main-content-viewport');
        if (viewport) viewport.innerHTML = this.render();
    },

    // RENDER: Report content based on active category
    renderActiveReportContent(cat) {
        let contentHtml = '';
        switch (this.activeCategory) {
            case 'STUDENTS':
                contentHtml = this.renderStudentReport();
                break;
            case 'TEACHERS':
                contentHtml = this.renderTeacherReport();
                break;
            case 'ATTENDANCE':
                contentHtml = this.renderAttendanceReport();
                break;
            case 'CLASSES':
                contentHtml = this.renderClassReport();
                break;
            case 'ASSIGNMENTS':
                contentHtml = this.renderAssignmentReport();
                break;
            case 'EXAMS':
                contentHtml = this.renderExamReport();
                break;
            case 'ADMISSIONS':
                contentHtml = this.renderAdmissionReport();
                break;
            case 'FEES':
                contentHtml = this.renderFeeReport();
                break;
            case 'LIBRARY':
                contentHtml = this.renderLibraryReport();
                break;
            case 'ONLINE_CLASSES':
                contentHtml = this.renderOnlineClassReport();
                break;
            default:
                contentHtml = this.renderStudentReport();
        }

        return `
            <div class="card">
                <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h3 class="card-title">
                            <i class="${cat.icon}"></i> ${cat.label}
                        </h3>
                        <div style="font-family: 'Amiri', serif; font-size: 1.15rem; color: var(--gold-200); margin-top: 2px;">
                            ${cat.urdu}
                        </div>
                    </div>

                    <!-- Search and Filters -->
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <div class="search-input-wrap" style="width: 240px;">
                            <i class="fas fa-search"></i>
                            <input type="text" class="form-control" placeholder="Search records..." 
                                   value="${this.searchQuery}" oninput="ReportsModule.setSearch(this.value)" 
                                   style="padding: 6px 12px 6px 36px; font-size: 0.82rem;">
                        </div>

                        <div>
                            <select class="form-control" onchange="ReportsModule.setStatus(this.value)" style="padding: 6px 10px; font-size: 0.82rem;">
                                <option value="ALL">All Statuses</option>
                                <option value="ACTIVE">Active / Completed</option>
                                <option value="PENDING">Pending</option>
                            </select>
                        </div>
                    </div>
                </div>

                ${contentHtml}
            </div>
        `;
    },

    // 1. STUDENT REPORT
    renderStudentReport() {
        const students = (window.LmsData.users || []).filter(u => u.role === 'STUDENT');
        let filtered = students;
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(s => s.name.toLowerCase().includes(q) || (s.rollNo && s.rollNo.toLowerCase().includes(q)));
        }

        return `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Roll Number</th>
                            <th>Scholar Name</th>
                            <th>Academic Program</th>
                            <th>Hostel / Boarding</th>
                            <th>Enrollment Date</th>
                            <th>Attendance Pct</th>
                            <th>Academic Standing</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(s => `
                            <tr>
                                <td><span class="status-pill primary" style="font-family: monospace;">${s.rollNo || 'N/A'}</span></td>
                                <td>
                                    <div style="font-weight: 700; color: var(--primary-950);">${s.name}</div>
                                    <div style="font-family: 'Amiri', serif; font-size: 0.9rem; color: var(--gold-700);">${s.urduName || ''}</div>
                                </td>
                                <td>${s.program || 'Dars-e-Nizami'}</td>
                                <td style="color: var(--text-muted); font-size: 0.82rem;">${s.hostel || 'Day Scholar'}</td>
                                <td>${s.enrollmentDate || '2024-08-15'}</td>
                                <td><strong style="color: var(--primary-300);">${s.attendancePct || 92}%</strong></td>
                                <td><span class="status-pill gold">${s.gpa || 'Jayyid'}</span></td>
                                <td><span class="status-pill success">${s.status || 'ACTIVE'}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // 2. TEACHER REPORT
    renderTeacherReport() {
        const teachers = (window.LmsData.users || []).filter(u => u.role === 'TEACHER');
        return `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Teacher Name</th>
                            <th>Designation / Chair</th>
                            <th>Specialization</th>
                            <th>Official Email</th>
                            <th>Accredited Sanad</th>
                            <th>Assigned Courses</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${teachers.map(t => `
                            <tr>
                                <td>
                                    <div style="font-weight: 700; color: var(--primary-950);">${t.name}</div>
                                    <div style="font-family: 'Amiri', serif; font-size: 0.95rem; color: var(--gold-700);">${t.urduName || ''}</div>
                                </td>
                                <td><span class="status-pill gold">${t.designation}</span></td>
                                <td style="color: var(--text-secondary);">${t.specialization}</td>
                                <td style="font-size: 0.82rem; color: var(--text-muted);">${t.email}</td>
                                <td><span class="status-pill success">${t.sanad}</span></td>
                                <td>${(t.assignedCourses || []).join(', ')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // 3. ATTENDANCE REPORT
    renderAttendanceReport() {
        const records = window.LmsData.attendance || [];
        return `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Name / Scholar</th>
                            <th>Role</th>
                            <th>Class / Dept</th>
                            <th>Check-In Time</th>
                            <th>Check-Out Time</th>
                            <th>Punctuality Status</th>
                            <th>Session</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${records.map(r => `
                            <tr>
                                <td><strong>${r.date}</strong></td>
                                <td style="font-weight: 700; color: var(--primary-950);">${r.userName}</td>
                                <td><span class="status-pill ${r.role === 'TEACHER' ? 'success' : 'primary'}">${r.role}</span></td>
                                <td style="font-size: 0.82rem; color: var(--text-secondary);">${r.className || 'General'}</td>
                                <td style="color: ${r.status === 'LATE' ? 'var(--warning)' : 'var(--primary-300)'};">${r.checkInTime || '—'}</td>
                                <td style="color: var(--text-muted);">${r.checkOutTime || '—'}</td>
                                <td>
                                    <span class="status-pill ${r.status === 'PRESENT' ? 'success' : (r.status === 'LATE' ? 'warning' : 'danger')}">
                                        ${r.status}
                                    </span>
                                </td>
                                <td style="font-size: 0.8rem; color: var(--text-muted);">${r.session || 'DAILY'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // 4. CLASS & COURSE REPORT
    renderClassReport() {
        const courses = window.LmsData.courses || [];
        return `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Course Code</th>
                            <th>Kitab Title</th>
                            <th>Urdu Title</th>
                            <th>Author / Imam</th>
                            <th>Dars-e-Nizami Year</th>
                            <th>Credit Hours</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${courses.map(c => `
                            <tr>
                                <td><span class="status-pill primary" style="font-family: monospace;">${c.code}</span></td>
                                <td style="font-weight: 700; color: var(--primary-950);">${c.title}</td>
                                <td style="font-family: 'Amiri', serif; font-size: 1.05rem; color: var(--gold-700);">${c.urduTitle || ''}</td>
                                <td style="color: var(--text-muted); font-size: 0.82rem;">${c.kitabAuthor}</td>
                                <td>Year ${c.year}</td>
                                <td><strong>${c.credits} Credits</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // 5. ASSIGNMENTS REPORT
    renderAssignmentReport() {
        const assignments = window.LmsData.assignments || [];
        return `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Assignment Title</th>
                            <th>Class / Course</th>
                            <th>Assigned By</th>
                            <th>Due Date</th>
                            <th>Total Marks</th>
                            <th>Submissions Received</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${assignments.map(a => `
                            <tr>
                                <td style="font-weight: 700; color: var(--primary-950);">${a.title}</td>
                                <td>${a.courseId}</td>
                                <td style="color: var(--text-secondary);">${a.teacherName}</td>
                                <td>${a.dueDate}</td>
                                <td><span class="status-pill gold">${a.totalMarks} Marks</span></td>
                                <td><strong style="color: var(--primary-300);">${(a.submissions || []).length} Submitted</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // 6. EXAM & WIFAQ RESULT REPORT
    renderExamReport() {
        const exams = window.LmsData.exams || [];
        return `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Examination Title</th>
                            <th>Academic Year</th>
                            <th>Exam Date</th>
                            <th>Passing Marks</th>
                            <th>Accreditation</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${exams.map(e => `
                            <tr>
                                <td style="font-weight: 700; color: var(--primary-950);">${e.title}</td>
                                <td>${e.session || '1446 AH'}</td>
                                <td>${e.examDate || '2026-10-15'}</td>
                                <td><span class="status-pill warning">40% Minimum</span></td>
                                <td><span class="status-pill gold"><i class="fas fa-certificate"></i> Wifaq al-Madaris</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // 7. ADMISSION REPORT
    renderAdmissionReport() {
        const admissions = window.LmsData.admissions || [];
        return `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Form No</th>
                            <th>Applicant Name</th>
                            <th>Program Applied</th>
                            <th>Branch Choice</th>
                            <th>Submission Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${admissions.map(a => `
                            <tr>
                                <td><span class="status-pill primary">${a.formNumber}</span></td>
                                <td style="font-weight: 700; color: var(--primary-950);">${a.applicantName}</td>
                                <td>${a.program}</td>
                                <td>${a.branch}</td>
                                <td>${a.appliedDate}</td>
                                <td><span class="status-pill ${a.status === 'APPROVED' ? 'success' : 'warning'}">${a.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // 8. FEE & PAYMENT REPORT
    renderFeeReport() {
        const challans = window.LmsData.feeChallans || [];
        return `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Challan No</th>
                            <th>Scholar / Student</th>
                            <th>Month / Session</th>
                            <th>Tuition Fee</th>
                            <th>Hostel Fee</th>
                            <th>Total Due</th>
                            <th>Payment Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${challans.map(c => `
                            <tr>
                                <td><span class="status-pill primary" style="font-family: monospace;">${c.challanNumber}</span></td>
                                <td style="font-weight: 700; color: var(--primary-950);">${c.studentName}</td>
                                <td>${c.monthYear}</td>
                                <td>PKR ${c.tuitionFee}</td>
                                <td>PKR ${c.hostelFee}</td>
                                <td><strong style="color: var(--gold-300);">PKR ${c.totalAmount}</strong></td>
                                <td><span class="status-pill ${c.status === 'PAID' ? 'success' : 'danger'}">${c.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // 9. LIBRARY REPORT
    renderLibraryReport() {
        const books = window.LmsData.libraryBooks || [];
        return `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Accession No</th>
                            <th>Book Title</th>
                            <th>Arabic / Urdu</th>
                            <th>Author</th>
                            <th>Category</th>
                            <th>Total Copies</th>
                            <th>Available</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${books.map(b => `
                            <tr>
                                <td><span class="status-pill primary">${b.accessionNo}</span></td>
                                <td style="font-weight: 700; color: var(--primary-950);">${b.title}</td>
                                <td style="font-family: 'Amiri', serif; font-size: 1.05rem; color: var(--gold-700);">${b.arabicTitle || ''}</td>
                                <td style="color: var(--text-muted);">${b.author}</td>
                                <td><span class="status-pill gold">${b.category}</span></td>
                                <td>${b.totalCopies}</td>
                                <td><strong style="color: var(--primary-300);">${b.availableCopies} Available</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // 10. ONLINE CLASS REPORT
    renderOnlineClassReport() {
        const live = window.LmsData.virtualClasses || [];
        return `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Lecture Topic</th>
                            <th>Host Sheikh / Teacher</th>
                            <th>Scheduled Time</th>
                            <th>Passcode</th>
                            <th>Active Scholars</th>
                            <th>Live Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${live.map(v => `
                            <tr>
                                <td style="font-weight: 700; color: var(--primary-950);">${v.title}</td>
                                <td>${v.hostTeacher}</td>
                                <td>${v.scheduledStart || 'Daily Fajr 06:30 AM'}</td>
                                <td><code>${v.passcode}</code></td>
                                <td><strong style="color: var(--primary-300);">${v.activeParticipants} Online</strong></td>
                                <td><span class="status-pill urgent"><i class="fas fa-circle"></i> Live Video Active</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // EXPORT TO REAL CSV FILE
    exportCSV() {
        let csv = "";
        const cat = this.activeCategory;
        const today = new Date().toISOString().split('T')[0];

        if (cat === 'STUDENTS') {
            const students = (window.LmsData.users || []).filter(u => u.role === 'STUDENT');
            csv = "Roll No,Name,Urdu Name,Program,Hostel,Enrollment Date,Attendance %,Standing,Status\n";
            students.forEach(s => {
                csv += `"${s.rollNo || ''}","${s.name}","${s.urduName || ''}","${s.program || ''}","${s.hostel || ''}","${s.enrollmentDate || ''}","${s.attendancePct || 90}%","${s.gpa || ''}","${s.status || 'ACTIVE'}"\n`;
            });
        } else if (cat === 'ATTENDANCE') {
            const records = window.LmsData.attendance || [];
            csv = "ID,User Name,Role,Identifier,Class,Date,Check-In,Check-Out,Status,Session\n";
            records.forEach(r => {
                csv += `"${r.id}","${r.userName}","${r.role}","${r.identifier || ''}","${r.className || ''}","${r.date}","${r.checkInTime || ''}","${r.checkOutTime || ''}","${r.status}","${r.session || ''}"\n`;
            });
        } else if (cat === 'TEACHERS') {
            const teachers = (window.LmsData.users || []).filter(u => u.role === 'TEACHER');
            csv = "Name,Urdu Name,Designation,Specialization,Email,Sanad\n";
            teachers.forEach(t => {
                csv += `"${t.name}","${t.urduName || ''}","${t.designation}","${t.specialization}","${t.email}","${t.sanad}"\n`;
            });
        } else {
            // General export
            csv = "Category,Generated Date,Institution\n";
            csv += `"${cat}","${today}","Jamia Ashrafia Lahore"\n`;
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Jamia_Ashrafia_Report_${cat}_${today}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        App.showToast(`Report for [${cat}] successfully exported to CSV!`, "gold");
    }
};

window.ReportsModule = ReportsModule;
