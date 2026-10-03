/**
 * JAMIA ASHRAFIA LAHORE - STUDENTS MANAGEMENT MODULE
 * Comprehensive Student Roster, Account Administration Hub, Granular LMS Access Controls,
 * Profile Management, Credential Reset, Attendance History, and Academic Performance.
 */

const StudentsModule = {
    searchQuery: '',
    filterProgram: 'ALL',
    filterBranch: 'ALL',
    filterStatus: 'ALL',
    activeTab: 'ALL', // 'ALL', 'ACTIVE', 'HOSTEL', 'SUSPENDED', 'GRADUATED'
    activeProfileTab: 'overview', // 'overview', 'account', 'academic', 'personal', 'attendance'

    render() {
        const user = window.AuthRBAC.currentUser;
        const role = window.AuthRBAC.getRole();

        // RBAC Check: Only Super Admin and Academic Nazim can manage student roster
        if (role === 'STUDENT') {
            return `
                <div class="card" style="border: 2px solid var(--danger); text-align: center; padding: 48px 24px;">
                    <i class="fas fa-lock" style="font-size: 3rem; color: var(--danger); margin-bottom: 16px;"></i>
                    <h2>403 - Access Denied</h2>
                    <p style="color: var(--text-secondary);">Students are not authorized to view the administrative students roster.</p>
                    <button class="btn btn-gold" onclick="App.navigate('dashboard')">Return to Dashboard</button>
                </div>
            `;
        }

        const students = (window.LmsData.users || []).filter(u => u.role === 'STUDENT');

        // Apply filters
        let filtered = students;

        // Tab filter
        if (this.activeTab === 'ACTIVE') {
            filtered = filtered.filter(s => (s.status || 'ACTIVE') === 'ACTIVE');
        } else if (this.activeTab === 'HOSTEL') {
            filtered = filtered.filter(s => s.hostel && s.hostel.toLowerCase().includes('hostel'));
        } else if (this.activeTab === 'SUSPENDED') {
            filtered = filtered.filter(s => s.status === 'SUSPENDED' || s.status === 'INACTIVE');
        } else if (this.activeTab === 'GRADUATED') {
            filtered = filtered.filter(s => s.status === 'GRADUATED');
        }

        // Program filter
        if (this.filterProgram !== 'ALL') {
            filtered = filtered.filter(s => s.program && s.program.includes(this.filterProgram));
        }

        // Status filter
        if (this.filterStatus !== 'ALL') {
            filtered = filtered.filter(s => (s.status || 'ACTIVE') === this.filterStatus);
        }

        // Search query
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(s => 
                (s.name && s.name.toLowerCase().includes(q)) ||
                (s.urduName && s.urduName.includes(q)) ||
                (s.rollNo && s.rollNo.toLowerCase().includes(q)) ||
                (s.email && s.email.toLowerCase().includes(q)) ||
                (s.phone && s.phone.includes(q))
            );
        }

        // Metrics calculations
        const totalStudents = students.length;
        const activeCount = students.filter(s => (s.status || 'ACTIVE') === 'ACTIVE').length;
        const hostelResidents = students.filter(s => s.hostel && s.hostel.toLowerCase().includes('hostel')).length;
        const suspendedCount = students.filter(s => s.status === 'SUSPENDED' || s.status === 'INACTIVE').length;
        const avgAttendance = Math.round(students.reduce((acc, s) => acc + (s.attendancePct || 90), 0) / (totalStudents || 1));
        const mumtazCount = students.filter(s => s.gpa && (s.gpa.includes('Mumtaz') || s.gpa.includes('8') || s.gpa.includes('9'))).length;

        return `
            <!-- HEADER -->
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-user-graduate" style="color: var(--gold-400);"></i>
                        Students Management & Comprehensive Academic Roster
                    </h1>
                    <p>Directory of resident scholars, LMS account administration, credential controls, and granular student profiles</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-secondary btn-sm" onclick="StudentsModule.exportStudentsCSV()">
                        <i class="fas fa-file-csv"></i> Export Students CSV
                    </button>
                    <button class="btn btn-gold btn-sm" onclick="StudentsModule.openDirectEnrollmentModal()">
                        <i class="fas fa-user-plus"></i> Direct Student Enrollment
                    </button>
                </div>
            </div>

            <!-- KPI METRICS -->
            <div class="metrics-grid">
                <div class="metric-card gold">
                    <div class="metric-icon-box" style="background: rgba(217, 119, 6, 0.2); color: var(--gold-400);"><i class="fas fa-user-graduate"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Enrolled Scholars</span>
                        <span class="metric-value">${totalStudents} Talaba</span>
                        <span class="metric-hint" style="color: var(--gold-300);">${activeCount} Active Accounts</span>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon-box" style="background: rgba(16, 185, 129, 0.2); color: var(--primary-400);"><i class="fas fa-hotel"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Boarding / Hostel</span>
                        <span class="metric-value">${hostelResidents} Residents</span>
                        <span class="metric-hint">Ashrafia Hostels</span>
                    </div>
                </div>
                <div class="metric-card success">
                    <div class="metric-icon-box" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa;"><i class="fas fa-calendar-check"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Avg Attendance</span>
                        <span class="metric-value">${avgAttendance}%</span>
                        <span class="metric-hint">Wifaq Punctuality</span>
                    </div>
                </div>
                <div class="metric-card info">
                    <div class="metric-icon-box" style="background: rgba(245, 158, 11, 0.2); color: var(--warning);"><i class="fas fa-award"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Mumtaz Standing</span>
                        <span class="metric-value">${mumtazCount} Scholars</span>
                        <span class="metric-hint">&gt;= 80% Grade Average</span>
                    </div>
                </div>
            </div>

            <!-- ROSTER CONTROL CARD -->
            <div class="card">
                <!-- ROSTER FILTER TABS -->
                <div style="display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 14px; flex-wrap: wrap;">
                    <button class="btn ${this.activeTab === 'ALL' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="StudentsModule.setActiveTab('ALL')">
                        <i class="fas fa-users"></i> All Scholars (${totalStudents})
                    </button>
                    <button class="btn ${this.activeTab === 'ACTIVE' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="StudentsModule.setActiveTab('ACTIVE')">
                        <i class="fas fa-user-check"></i> Active Scholars (${activeCount})
                    </button>
                    <button class="btn ${this.activeTab === 'HOSTEL' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="StudentsModule.setActiveTab('HOSTEL')">
                        <i class="fas fa-bed"></i> Hostel Residents (${hostelResidents})
                    </button>
                    <button class="btn ${this.activeTab === 'SUSPENDED' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="StudentsModule.setActiveTab('SUSPENDED')">
                        <i class="fas fa-user-lock"></i> Suspended / Inactive (${suspendedCount})
                    </button>
                    <button class="btn ${this.activeTab === 'GRADUATED' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="StudentsModule.setActiveTab('GRADUATED')">
                        <i class="fas fa-graduation-cap"></i> Graduated / Alumni
                    </button>
                </div>

                <!-- SEARCH AND FILTERS -->
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 20px;">
                    <div class="search-input-wrap" style="width: 320px; position: relative;">
                        <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
                        <input type="text" class="form-control" placeholder="Search by name, roll no, email, phone..." 
                               value="${this.searchQuery}" oninput="StudentsModule.setSearch(this.value)" 
                               style="padding: 8px 12px 8px 36px; width: 100%;">
                    </div>

                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <select class="form-control" onchange="StudentsModule.setProgram(this.value)" style="padding: 8px 12px; font-size: 0.85rem;">
                            <option value="ALL" ${this.filterProgram === 'ALL' ? 'selected' : ''}>All Academic Programs</option>
                            <option value="Dawra-e-Hadith" ${this.filterProgram === 'Dawra-e-Hadith' ? 'selected' : ''}>Dawra-e-Hadith (Alimiyyah)</option>
                            <option value="Aaliyah" ${this.filterProgram === 'Aaliyah' ? 'selected' : ''}>Aaliyah (Alimiyyah 7th)</option>
                            <option value="Takhassus" ${this.filterProgram === 'Takhassus' ? 'selected' : ''}>Takhassus fil-Ifta</option>
                            <option value="Hifz" ${this.filterProgram === 'Hifz' ? 'selected' : ''}>Hifz-ul-Quran & Tajweed</option>
                            <option value="Qira'at" ${this.filterProgram === "Qira'at" ? 'selected' : ''}>Qira'at Sab'ah</option>
                            <option value="Bannat" ${this.filterProgram === 'Bannat' ? 'selected' : ''}>Alimiyyah Lil Bannat</option>
                        </select>

                        <select class="form-control" onchange="StudentsModule.setStatus(this.value)" style="padding: 8px 12px; font-size: 0.85rem;">
                            <option value="ALL" ${this.filterStatus === 'ALL' ? 'selected' : ''}>All Account Statuses</option>
                            <option value="ACTIVE" ${this.filterStatus === 'ACTIVE' ? 'selected' : ''}>Active</option>
                            <option value="SUSPENDED" ${this.filterStatus === 'SUSPENDED' ? 'selected' : ''}>Suspended</option>
                            <option value="INACTIVE" ${this.filterStatus === 'INACTIVE' ? 'selected' : ''}>Inactive</option>
                            <option value="GRADUATED" ${this.filterStatus === 'GRADUATED' ? 'selected' : ''}>Graduated</option>
                        </select>
                    </div>
                </div>

                <!-- STUDENTS TABLE -->
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Scholar / Name</th>
                                <th>Roll Number</th>
                                <th>Program & Class</th>
                                <th>Residence</th>
                                <th>Attendance %</th>
                                <th>Academic Standing</th>
                                <th>Account Status</th>
                                <th style="text-align: right; width: 220px;">Administrative Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.length > 0 ? filtered.map(s => {
                                const status = s.status || 'ACTIVE';
                                const isSuspended = (status === 'SUSPENDED' || status === 'INACTIVE');
                                const badgeClass = status === 'ACTIVE' ? 'success' : (isSuspended ? 'danger' : 'gold');
                                
                                return `
                                    <tr>
                                        <td>
                                            <div style="display: flex; align-items: center; gap: 10px;">
                                                <div class="user-avatar" style="width: 38px; height: 38px; font-size: 0.85rem; background: var(--primary-700); border: 2px solid ${status === 'ACTIVE' ? 'var(--primary-400)' : 'var(--danger)'};">
                                                    ${s.avatar || 'ST'}
                                                </div>
                                                <div>
                                                    <div style="font-weight: 700; color: var(--primary-950);">
                                                        <a href="javascript:void(0)" onclick="StudentsModule.viewProfile('${s.id}')" style="color: var(--primary-950); text-decoration: none;" onmouseover="this.style.color='var(--primary-600)'" onmouseout="this.style.color='var(--primary-950)'">
                                                            ${s.name}
                                                        </a>
                                                    </div>
                                                    <div style="font-family: 'Amiri', serif; font-size: 0.95rem; color: var(--gold-700);">${s.urduName || ''}</div>
                                                    <div style="font-size: 0.72rem; color: var(--text-muted);">${s.email || 'No email set'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span class="status-pill primary" style="font-family: monospace; font-size: 0.82rem; font-weight: 700;">
                                                ${s.rollNo || 'N/A'}
                                            </span>
                                        </td>
                                        <td style="color: var(--text-secondary); font-size: 0.85rem;">
                                            <div style="font-weight: 600; color: var(--primary-950);">${s.program || 'Dars-e-Nizami'}</div>
                                            <span style="font-size: 0.72rem; color: var(--text-muted);">${s.classId || 'cls_dawra_a'}</span>
                                        </td>
                                        <td style="font-size: 0.82rem;">
                                            ${s.hostel && s.hostel.toLowerCase().includes('hostel') ? `
                                                <span class="status-pill danger" style="font-size: 0.72rem;"><i class="fas fa-bed"></i> ${s.hostel}</span>
                                            ` : `
                                                <span class="status-pill" style="font-size: 0.72rem;"><i class="fas fa-home"></i> Day Scholar</span>
                                            `}
                                        </td>
                                        <td>
                                            <div style="display: flex; align-items: center; gap: 6px;">
                                                <strong style="color: ${s.attendancePct >= 85 ? 'var(--primary-300)' : (s.attendancePct >= 75 ? 'var(--gold-300)' : 'var(--danger)')};">
                                                    ${s.attendancePct || 92}%
                                                </strong>
                                            </div>
                                        </td>
                                        <td>
                                            <span class="status-pill gold" style="font-size: 0.75rem;">${s.gpa || 'Mumtaz'}</span>
                                        </td>
                                        <td>
                                            <span class="status-pill ${badgeClass}">
                                                <i class="fas ${status === 'ACTIVE' ? 'fa-check-circle' : (isSuspended ? 'fa-ban' : 'fa-graduation-cap')}"></i>
                                                ${status}
                                            </span>
                                        </td>
                                        <td style="text-align: right; white-space: nowrap;">
                                            <div style="display: inline-flex; gap: 5px; align-items: center;">
                                                <!-- MANAGE PROFILE & ACCOUNT -->
                                                <button class="btn btn-gold btn-sm" onclick="StudentsModule.viewProfile('${s.id}')" title="Manage Profile & Account Settings">
                                                    <i class="fas fa-user-cog"></i> Profile
                                                </button>

                                                <!-- QUICK TOGGLE STATUS -->
                                                ${status === 'ACTIVE' ? `
                                                    <button class="btn btn-secondary btn-sm" onclick="StudentsModule.quickToggleStatus('${s.id}', 'SUSPENDED')" title="Deactivate / Suspend Student" style="color: var(--warning); border-color: rgba(245, 158, 11, 0.3);">
                                                        <i class="fas fa-user-slash"></i>
                                                    </button>
                                                ` : `
                                                    <button class="btn btn-secondary btn-sm" onclick="StudentsModule.quickToggleStatus('${s.id}', 'ACTIVE')" title="Activate Student" style="color: var(--primary-400); border-color: rgba(16, 185, 129, 0.3);">
                                                        <i class="fas fa-user-check"></i>
                                                    </button>
                                                `}

                                                <!-- RESET PASSWORD -->
                                                <button class="btn btn-secondary btn-sm" onclick="StudentsModule.openResetPasswordModal('${s.id}')" title="Reset Student Password">
                                                    <i class="fas fa-key"></i>
                                                </button>

                                                <!-- MORE ACTIONS -->
                                                <button class="btn btn-secondary btn-sm" onclick="StudentsModule.openMoreActionsModal('${s.id}')" title="Additional Student Operations">
                                                    <i class="fas fa-ellipsis-v"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('') : `
                                <tr>
                                    <td colspan="8" style="text-align: center; padding: 48px; color: var(--text-muted);">
                                        <i class="fas fa-user-slash" style="font-size: 2.5rem; margin-bottom: 12px; color: var(--text-muted); opacity: 0.5;"></i>
                                        <div style="font-size: 1.1rem; color: var(--primary-950); margin-bottom: 6px;">No scholars found</div>
                                        <div style="font-size: 0.85rem;">No student records match the active tab and search criteria.</div>
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    setActiveTab(tab) {
        this.activeTab = tab;
        const viewport = document.getElementById('main-content-viewport');
        if (viewport) viewport.innerHTML = this.render();
    },

    setSearch(q) {
        this.searchQuery = q;
        const viewport = document.getElementById('main-content-viewport');
        if (viewport) viewport.innerHTML = this.render();
    },

    setProgram(p) {
        this.filterProgram = p;
        const viewport = document.getElementById('main-content-viewport');
        if (viewport) viewport.innerHTML = this.render();
    },

    setStatus(s) {
        this.filterStatus = s;
        const viewport = document.getElementById('main-content-viewport');
        if (viewport) viewport.innerHTML = this.render();
    },

    // =========================================================================
    // STUDENT ACCOUNT & PROFILE MANAGEMENT HUB
    // =========================================================================
    viewProfile(studentId, defaultTab = 'overview') {
        const student = (window.LmsData.users || []).find(u => u.id === studentId);
        if (!student) {
            App.showToast("Student record not found.", "danger");
            return;
        }

        this.activeProfileTab = defaultTab;

        const titleEl = document.getElementById('modal-title-text');
        const bodyEl = document.getElementById('modal-body-container');
        const footerEl = document.getElementById('modal-footer-container');

        if (titleEl) {
            titleEl.innerHTML = `<i class="fas fa-user-graduate" style="color: var(--gold-400);"></i> Student Account & Profile Management`;
        }

        if (bodyEl) {
            bodyEl.innerHTML = this.renderProfileContent(student);
        }

        if (footerEl) {
            footerEl.innerHTML = `
                <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
                <button class="btn btn-secondary" onclick="StudentsModule.printStudentCard('${student.id}')">
                    <i class="fas fa-id-card"></i> Print Student ID
                </button>
                <button class="btn btn-gold" onclick="StudentsModule.testStudentPersona('${student.id}')">
                    <i class="fas fa-exchange-alt"></i> Login as Student
                </button>
            `;
        }

        App.openModal();
    },

    switchProfileTab(tabName, studentId) {
        this.activeProfileTab = tabName;
        const student = (window.LmsData.users || []).find(u => u.id === studentId);
        if (!student) return;
        const bodyEl = document.getElementById('modal-body-container');
        if (bodyEl) bodyEl.innerHTML = this.renderProfileContent(student);
    },

    renderProfileContent(student) {
        const studentAttendance = (window.LmsData.attendance || []).filter(r => r.userId === student.id);
        const presentCount = studentAttendance.filter(r => r.status === 'PRESENT').length;
        const lateCount = studentAttendance.filter(r => r.status === 'LATE').length;
        const absentCount = studentAttendance.filter(r => r.status === 'ABSENT').length;
        const currentStatus = student.status || 'ACTIVE';
        const isSuspended = (currentStatus === 'SUSPENDED' || currentStatus === 'INACTIVE');

        return `
            <!-- SCHOLAR PROFILE HEADER CARD -->
            <div style="background: linear-gradient(135deg, rgba(6, 78, 59, 0.35) 0%, rgba(17, 24, 39, 0.8) 100%); border: 1px solid var(--border-prominent); border-radius: var(--radius-md); padding: 18px; margin-bottom: 20px;">
                <div style="display: flex; gap: 18px; align-items: center; flex-wrap: wrap;">
                    <div class="user-avatar" style="width: 70px; height: 70px; font-size: 1.6rem; background: var(--primary-700); border: 3px solid ${currentStatus === 'ACTIVE' ? 'var(--gold-400)' : 'var(--danger)'};">
                        ${student.avatar || 'ST'}
                    </div>
                    <div style="flex: 1; min-width: 240px;">
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <h3 style="color: var(--primary-950); margin: 0; font-size: 1.3rem;">${student.name}</h3>
                            <span class="status-pill ${currentStatus === 'ACTIVE' ? 'success' : (isSuspended ? 'danger' : 'gold')}">
                                <i class="fas ${currentStatus === 'ACTIVE' ? 'fa-check-circle' : 'fa-ban'}"></i> ${currentStatus}
                            </span>
                        </div>
                        <div style="font-family: 'Amiri', serif; font-size: 1.15rem; color: var(--gold-700); margin-top: 2px;">
                            ${student.urduName || ''}
                        </div>
                        <div style="display: flex; gap: 12px; margin-top: 6px; font-size: 0.82rem; color: var(--text-secondary); flex-wrap: wrap;">
                            <span><strong>Roll No:</strong> <code style="color: var(--primary-800); font-weight: 700;">${student.rollNo || 'N/A'}</code></span>
                            <span><strong>Program:</strong> ${student.program || 'Dars-e-Nizami'}</span>
                            <span><strong>Class:</strong> ${student.classId || 'Dawra-e-Hadith'}</span>
                        </div>
                    </div>

                    <!-- QUICK ACTIONS IN HEADER -->
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="btn btn-secondary btn-sm" onclick="StudentsModule.openResetPasswordModal('${student.id}')" title="Reset Login Password">
                            <i class="fas fa-key"></i> Reset Password
                        </button>
                        ${currentStatus === 'ACTIVE' ? `
                            <button class="btn btn-danger btn-sm" onclick="StudentsModule.toggleStudentStatus('${student.id}', 'SUSPENDED')">
                                <i class="fas fa-user-slash"></i> Suspend
                            </button>
                        ` : `
                            <button class="btn btn-primary btn-sm" onclick="StudentsModule.toggleStudentStatus('${student.id}', 'ACTIVE')">
                                <i class="fas fa-user-check"></i> Activate
                            </button>
                        `}
                        <button class="btn btn-gold btn-sm" onclick="StudentsModule.openEditStudentModal('${student.id}')">
                            <i class="fas fa-edit"></i> Edit Info
                        </button>
                    </div>
                </div>
            </div>

            <!-- PROFILE NAVIGATION TABS -->
            <div style="display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px; flex-wrap: wrap;">
                <button class="btn ${this.activeProfileTab === 'overview' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="StudentsModule.switchProfileTab('overview', '${student.id}')">
                    <i class="fas fa-chart-pie"></i> Overview
                </button>
                <button class="btn ${this.activeProfileTab === 'account' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="StudentsModule.switchProfileTab('account', '${student.id}')">
                    <i class="fas fa-user-lock"></i> Account & Access
                </button>
                <button class="btn ${this.activeProfileTab === 'academic' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="StudentsModule.switchProfileTab('academic', '${student.id}')">
                    <i class="fas fa-graduation-cap"></i> Academic & Courses
                </button>
                <button class="btn ${this.activeProfileTab === 'personal' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="StudentsModule.switchProfileTab('personal', '${student.id}')">
                    <i class="fas fa-address-card"></i> Contact & Residence
                </button>
                <button class="btn ${this.activeProfileTab === 'attendance' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="StudentsModule.switchProfileTab('attendance', '${student.id}')">
                    <i class="fas fa-calendar-check"></i> Attendance Logs (${studentAttendance.length})
                </button>
            </div>

            <!-- TAB CONTENT PANELS -->
            ${this.renderProfileTabPanel(student, presentCount, lateCount, absentCount, studentAttendance)}
        `;
    },

    renderProfileTabPanel(student, presentCount, lateCount, absentCount, studentAttendance) {
        if (this.activeProfileTab === 'account') {
            return `
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <!-- ACCOUNT STATUS SETTINGS -->
                    <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                        <h4 style="color: var(--gold-400); margin-bottom: 12px;"><i class="fas fa-shield-alt"></i> Account Status & LMS Access Level</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 14px;">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-subtle);">
                                <input type="radio" name="student-status-radio" value="ACTIVE" ${student.status === 'ACTIVE' || !student.status ? 'checked' : ''} onchange="StudentsModule.toggleStudentStatus('${student.id}', this.value)">
                                <div>
                                    <div style="font-weight: 700; color: var(--primary-300);">Active (Full Access)</div>
                                    <div style="font-size: 0.72rem; color: var(--text-muted);">Can log in, attend dars, and submit exams</div>
                                </div>
                            </label>

                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-subtle);">
                                <input type="radio" name="student-status-radio" value="SUSPENDED" ${student.status === 'SUSPENDED' ? 'checked' : ''} onchange="StudentsModule.toggleStudentStatus('${student.id}', this.value)">
                                <div>
                                    <div style="font-weight: 700; color: var(--warning);">Suspended (Locked)</div>
                                    <div style="font-size: 0.72rem; color: var(--text-muted);">Temporarily blocked from portal login</div>
                                </div>
                            </label>

                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-subtle);">
                                <input type="radio" name="student-status-radio" value="INACTIVE" ${student.status === 'INACTIVE' ? 'checked' : ''} onchange="StudentsModule.toggleStudentStatus('${student.id}', this.value)">
                                <div>
                                    <div style="font-weight: 700; color: var(--danger);">Inactive (Deactivated)</div>
                                    <div style="font-size: 0.72rem; color: var(--text-muted);">Credentials disabled</div>
                                </div>
                            </label>

                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-subtle);">
                                <input type="radio" name="student-status-radio" value="GRADUATED" ${student.status === 'GRADUATED' ? 'checked' : ''} onchange="StudentsModule.toggleStudentStatus('${student.id}', this.value)">
                                <div>
                                    <div style="font-weight: 700; color: var(--gold-300);">Graduated (Alumni)</div>
                                    <div style="font-size: 0.72rem; color: var(--text-muted);">Completed Dars-e-Nizami sanad</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- CREDENTIALS & PASSWORD RESET -->
                    <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                        <h4 style="color: var(--primary-300); margin-bottom: 12px;"><i class="fas fa-key"></i> Login Credentials & Password Management</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px;">
                            <div>
                                <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Login Email / Username</label>
                                <input type="text" class="form-control" value="${student.email || ''}" id="st-edit-email" placeholder="student@jamiaashrafia.org">
                            </div>
                            <div>
                                <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Password Status</label>
                                <div style="display: flex; gap: 8px;">
                                    <input type="password" class="form-control" value="${student.password || '********'}" readonly style="letter-spacing: 2px;">
                                    <button class="btn btn-gold btn-sm" onclick="StudentsModule.openResetPasswordModal('${student.id}')">
                                        <i class="fas fa-sync-alt"></i> Reset
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- LMS FEATURE ACCESS PERMISSIONS -->
                    <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                        <h4 style="color: var(--primary-950); margin-bottom: 12px;"><i class="fas fa-sliders-h"></i> Scholar LMS Capabilities</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.85rem;">
                            <label style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 4px; color: var(--text-primary);">
                                <span><i class="fas fa-video" style="color: var(--gold-600); margin-right: 8px;"></i> Live Zoom Dars Access</span>
                                <input type="checkbox" checked disabled style="accent-color: var(--primary-500);">
                            </label>
                            <label style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 4px; color: var(--text-primary);">
                                <span><i class="fas fa-edit" style="color: var(--primary-600); margin-right: 8px;"></i> Assignment Submissions</span>
                                <input type="checkbox" checked disabled style="accent-color: var(--primary-500);">
                            </label>
                            <label style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 4px; color: var(--text-primary);">
                                <span><i class="fas fa-award" style="color: var(--warning); margin-right: 8px;"></i> Wifaq Online Exam Portal</span>
                                <input type="checkbox" checked disabled style="accent-color: var(--primary-500);">
                            </label>
                            <label style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 4px; color: var(--text-primary);">
                                <span><i class="fas fa-book-reader" style="color: #2563eb; margin-right: 8px;"></i> Maktaba Library Borrowing</span>
                                <input type="checkbox" checked disabled style="accent-color: var(--primary-500);">
                            </label>
                        </div>
                    </div>
                </div>
            `;
        }

        if (this.activeProfileTab === 'academic') {
            return `
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); line-height: 1.8;">
                        <h4 style="color: var(--gold-600); margin-bottom: 10px;"><i class="fas fa-university"></i> Academic Enrollment Details</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 0.85rem;">
                            <div>
                                <div><strong>Enrolled Program:</strong> ${student.program || 'Dars-e-Nizami'}</div>
                                <div><strong>Assigned Class:</strong> ${student.classId || 'Dawra-e-Hadith Final'}</div>
                                <div><strong>Campus / Branch:</strong> Main Campus (Ferozepur Road, Lahore)</div>
                            </div>
                            <div>
                                <div><strong>Wifaq Registration No:</strong> <code style="color: var(--gold-700); font-weight: 700;">${student.wifaqReg || 'W-1445-98210'}</code></div>
                                <div><strong>Session:</strong> 1446-1447 AH / 2026</div>
                                <div><strong>Academic Standing:</strong> <span class="status-pill gold">${student.gpa || 'Mumtaz (88%)'}</span></div>
                            </div>
                        </div>
                    </div>

                    <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                        <h4 style="color: var(--primary-950); margin-bottom: 12px;"><i class="fas fa-book-open" style="color: var(--gold-600);"></i> Enrolled Kitabs & Faculty (Session 1446-1447)</h4>
                        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.82rem;">
                            <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 4px;">
                                <div>
                                    <div style="font-weight: 700; color: var(--primary-950);">Sahih al-Bukhari (HAD-801)</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Sheikh-ul-Hadith Qari Arshad Ubaid</div>
                                </div>
                                <span class="status-pill success">Mumtaz (88%)</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 4px;">
                                <div>
                                    <div style="font-weight: 700; color: var(--primary-950);">Sunan al-Tirmidhi (HAD-802)</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Sheikh-ul-Hadith Qari Arshad Ubaid</div>
                                </div>
                                <span class="status-pill success">Mumtaz (85%)</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 4px;">
                                <div>
                                    <div style="font-weight: 700; color: var(--primary-950);">Al-Hidayah Fiqh (FIQ-701)</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Chief Mufti Ahmadur Rahman</div>
                                </div>
                                <span class="status-pill gold">Jayyid Jiddan (78%)</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        if (this.activeProfileTab === 'personal') {
            const isIntl = (student.studentType === 'INTERNATIONAL' || (!student.cnic && student.passport));
            return `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 0.85rem;">
                    <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); line-height: 2;">
                        <h4 style="color: var(--primary-300); margin-bottom: 10px;"><i class="fas fa-id-card"></i> Candidate Identity</h4>
                        <div><strong>Full Name:</strong> ${student.name}</div>
                        <div><strong>Father's Name:</strong> ${student.guardianName || student.fatherName || 'Maulana Muhammad'}</div>
                        <div><strong>Student Category:</strong> <span class="status-pill ${isIntl ? 'gold' : 'success'}">${isIntl ? '<i class="fas fa-globe-americas"></i> International Student' : '<i class="fas fa-flag"></i> Local Student'}</span></div>
                        ${isIntl ? `
                            <div><strong>Passport Number:</strong> <code style="color: var(--gold-300); font-weight: 700;">${student.passport || 'N/A'}</code></div>
                            <div><strong>Country of Residence:</strong> <strong>${student.country || 'International'}</strong></div>
                        ` : `
                            <div><strong>CNIC / B-Form:</strong> <code>${student.cnic || '35201-8934521-3'}</code></div>
                            <div><strong>Nationality:</strong> Pakistan</div>
                        `}
                        <div><strong>Date of Birth:</strong> ${student.dob || '2004-05-12'}</div>
                        <div><strong>Hafiz-ul-Quran:</strong> <span class="status-pill success" style="font-size: 0.72rem;">Hafiz Verified</span></div>
                    </div>

                    <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); line-height: 2;">
                        <h4 style="color: var(--gold-400); margin-bottom: 10px;"><i class="fas fa-phone-alt"></i> Contact & Residence</h4>
                        <div><strong>WhatsApp / Phone:</strong> ${student.phone || '+92 300 4589211'}</div>
                        <div><strong>Email Address:</strong> ${student.email || 'N/A'}</div>
                        <div><strong>Residence:</strong> ${student.hostel || 'Day Scholar'}</div>
                        <div><strong>Emergency Contact:</strong> ${student.emergencyPhone || student.phone || '+92 321 0000000'}</div>
                        <div><strong>Previous Madrasa:</strong> ${student.previousMadrasa || 'Jamia Farooqia'}</div>
                    </div>
                </div>
            `;
        }

        if (this.activeProfileTab === 'attendance') {
            return `
                <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
                        <h4 style="color: var(--primary-950); margin: 0;"><i class="fas fa-calendar-check" style="color: var(--primary-600);"></i> Attendance Timestamp Records</h4>
                        <span style="font-size: 0.82rem; color: var(--gold-300);">Overall Attendance: <strong>${student.attendancePct || 92}%</strong></span>
                    </div>

                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Check-In</th>
                                    <th>Check-Out</th>
                                    <th>Status</th>
                                    <th>Session</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${studentAttendance.length > 0 ? studentAttendance.map(r => `
                                    <tr>
                                        <td><strong>${r.date}</strong></td>
                                        <td style="color: ${r.status === 'LATE' ? 'var(--warning)' : 'var(--primary-300)'};">${r.checkInTime || '—'}</td>
                                        <td style="color: var(--text-muted);">${r.checkOutTime || '—'}</td>
                                        <td>
                                            <span class="status-pill ${r.status === 'PRESENT' ? 'success' : (r.status === 'LATE' ? 'warning' : 'danger')}">
                                                ${r.status}
                                            </span>
                                        </td>
                                        <td style="font-size: 0.78rem;">${r.session || 'DAILY'}</td>
                                        <td style="font-size: 0.78rem; color: var(--text-muted);">${r.notes || 'Routine arrival'}</td>
                                    </tr>
                                `).join('') : `
                                    <tr>
                                        <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">
                                            No attendance timestamps recorded for this scholar yet.
                                        </td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        // Default 'overview' tab
        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; font-size: 0.85rem;">
                <!-- ACADEMIC INFO -->
                <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); line-height: 1.9;">
                    <h4 style="color: var(--gold-400); margin-bottom: 10px;"><i class="fas fa-university"></i> Academic Status</h4>
                    <div><strong>Program:</strong> ${student.program || 'Dars-e-Nizami'}</div>
                    <div><strong>Current Class:</strong> ${student.classId || 'Dawra-e-Hadith'}</div>
                    <div><strong>Enrollment Date:</strong> ${student.enrollmentDate || '2024-08-15'}</div>
                    <div><strong>Campus:</strong> Main Campus (Ferozepur Rd)</div>
                    <div><strong>Wifaq Sanad Standing:</strong> <span class="status-pill gold">${student.gpa || 'Mumtaz (88%)'}</span></div>
                </div>

                <!-- CONTACT & RESIDENCE -->
                <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); line-height: 1.9;">
                    <h4 style="color: var(--primary-300); margin-bottom: 10px;"><i class="fas fa-id-badge"></i> Personal & Residence</h4>
                    <div><strong>Guardian:</strong> ${student.guardianName || student.fatherName || 'Maulana Muhammad'}</div>
                    <div><strong>Email:</strong> ${student.email || 'N/A'}</div>
                    <div><strong>Phone:</strong> ${student.phone || '+92 300 4589211'}</div>
                    <div><strong>Residence:</strong> ${student.hostel || 'Day Scholar'}</div>
                    <div><strong>Account Status:</strong> <span class="status-pill ${student.status === 'ACTIVE' || !student.status ? 'success' : 'danger'}">${student.status || 'ACTIVE'}</span></div>
                </div>
            </div>

            <!-- ATTENDANCE OVERVIEW -->
            <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); margin-bottom: 18px;">
                <h4 style="color: var(--primary-950); margin-bottom: 10px; display: flex; justify-content: space-between;">
                    <span><i class="fas fa-calendar-check" style="color: var(--primary-400);"></i> Attendance Overview</span>
                    <span style="color: var(--gold-300); font-weight: 700;">${student.attendancePct || 92}% Overall</span>
                </h4>
                <div style="display: flex; gap: 20px; font-size: 0.85rem; color: var(--text-secondary); flex-wrap: wrap;">
                    <span><i class="fas fa-check-circle" style="color: var(--primary-400);"></i> On-Time: <strong>${presentCount}</strong></span>
                    <span><i class="fas fa-clock" style="color: var(--warning);"></i> Late Arrivals: <strong>${lateCount}</strong></span>
                    <span><i class="fas fa-times-circle" style="color: var(--danger);"></i> Absences: <strong>${absentCount}</strong></span>
                    <span><i class="fas fa-history"></i> Total Sessions Logged: <strong>${studentAttendance.length}</strong></span>
                </div>
            </div>
        `;
    },

    // =========================================================================
    // QUICK ACTIONS & MODALS
    // =========================================================================
    quickToggleStatus(studentId, newStatus) {
        const student = (window.LmsData.users || []).find(u => u.id === studentId);
        if (!student) return;

        student.status = newStatus;
        window.DataStore.save(window.LmsData);

        const toastType = newStatus === 'ACTIVE' ? 'success' : 'warning';
        App.showToast(`Scholar ${student.name} marked as ${newStatus}!`, toastType);

        const viewport = document.getElementById('main-content-viewport');
        if (viewport && App.currentRoute === 'students') {
            viewport.innerHTML = this.render();
        }
    },

    toggleStudentStatus(studentId, newStatus) {
        this.quickToggleStatus(studentId, newStatus);
        // Refresh modal if open
        const bodyEl = document.getElementById('modal-body-container');
        if (bodyEl && document.getElementById('global-modal-backdrop').classList.contains('open')) {
            const student = (window.LmsData.users || []).find(u => u.id === studentId);
            if (student) bodyEl.innerHTML = this.renderProfileContent(student);
        }
    },

    openResetPasswordModal(studentId) {
        const student = (window.LmsData.users || []).find(u => u.id === studentId);
        if (!student) return;

        const titleEl = document.getElementById('modal-title-text');
        const bodyEl = document.getElementById('modal-body-container');
        const footerEl = document.getElementById('modal-footer-container');

        if (titleEl) {
            titleEl.innerHTML = `<i class="fas fa-key" style="color: var(--gold-400);"></i> Reset Password: ${student.name}`;
        }

        if (bodyEl) {
            bodyEl.innerHTML = `
                <div style="margin-bottom: 16px;">
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 14px;">
                        Reset LMS login credentials for scholar <strong>${student.name}</strong> (<code style="color: var(--gold-700);">${student.rollNo}</code>).
                    </p>
                    <div style="margin-bottom: 16px;">
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Student Login Email
                        </label>
                        <input type="text" class="form-control" value="${student.email || ''}" disabled style="opacity: 0.8;">
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            New Password *
                        </label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="reset-student-pwd" class="form-control" value="ashrafia${Math.floor(100 + Math.random() * 900)}" required>
                            <button type="button" class="btn btn-secondary" onclick="document.getElementById('reset-student-pwd').value = 'Ashrafia@' + Math.floor(1000 + Math.random() * 9000);">
                                <i class="fas fa-random"></i> Generate
                            </button>
                        </div>
                    </div>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.85rem; color: var(--text-secondary);">
                        <input type="checkbox" id="reset-force-change" checked style="accent-color: var(--primary-500);">
                        <span>Notify student via broadcast and require password change on next login</span>
                    </label>
                </div>
            `;
        }

        if (footerEl) {
            footerEl.innerHTML = `
                <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
                <button class="btn btn-gold" onclick="StudentsModule.confirmResetPassword('${student.id}')">
                    <i class="fas fa-check-circle"></i> Save New Password
                </button>
            `;
        }

        App.openModal();
    },

    confirmResetPassword(studentId) {
        const student = (window.LmsData.users || []).find(u => u.id === studentId);
        if (!student) return;

        const newPwd = document.getElementById('reset-student-pwd').value.trim();
        if (!newPwd) {
            App.showToast("Please enter a valid password.", "warning");
            return;
        }

        student.password = newPwd;
        window.DataStore.save(window.LmsData);
        App.closeModal();
        App.showToast(`Password successfully reset for ${student.name}!`, "success");
    },

    openEditStudentModal(studentId) {
        const student = (window.LmsData.users || []).find(u => u.id === studentId);
        if (!student) return;

        const isIntl = (student.studentType === 'INTERNATIONAL' || (!student.cnic && student.passport));
        const titleEl = document.getElementById('modal-title-text');
        const bodyEl = document.getElementById('modal-body-container');
        const footerEl = document.getElementById('modal-footer-container');

        if (titleEl) {
            titleEl.innerHTML = `<i class="fas fa-user-edit" style="color: var(--gold-400);"></i> Edit Scholar Information: ${student.name}`;
        }

        if (bodyEl) {
            bodyEl.innerHTML = `
                <form id="form-edit-student" onsubmit="StudentsModule.handleEditStudentSubmit(event, '${student.id}')">
                    <!-- STUDENT TYPE SELECTION -->
                    <div style="margin-bottom: 14px;">
                        <label class="form-label" style="font-weight: 700; color: var(--text-primary); display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span><i class="fas fa-user-tag" style="color: var(--gold-600); margin-right: 6px;"></i> Student Category *</span>
                            <span style="font-size: 0.72rem; color: var(--gold-700);">Identification Routing</span>
                        </label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <label id="edit-st-type-local-card" style="display: flex; align-items: center; gap: 8px; padding: 10px; background: ${!isIntl ? 'var(--primary-50)' : 'var(--bg-surface-elevated)'}; border: ${!isIntl ? '2px solid var(--primary-500)' : '1.5px solid var(--border-prominent)'}; border-radius: 8px; cursor: pointer;">
                                <input type="radio" name="edit_st_student_type" value="LOCAL" ${!isIntl ? 'checked' : ''} onchange="StudentsModule.handleEditStudentTypeChange('LOCAL')" style="accent-color: var(--primary-500);">
                                <div>
                                    <div style="font-weight: 700; font-size: 0.85rem; color: var(--primary-950);"><i class="fas fa-flag" style="color: var(--primary-600);"></i> Local Student</div>
                                    <div style="font-size: 0.72rem; color: var(--text-secondary);">Pakistani (CNIC / B-Form)</div>
                                </div>
                            </label>
                            <label id="edit-st-type-intl-card" style="display: flex; align-items: center; gap: 8px; padding: 10px; background: ${isIntl ? 'var(--gold-50)' : 'var(--bg-surface-elevated)'}; border: ${isIntl ? '2px solid var(--gold-500)' : '1.5px solid var(--border-prominent)'}; border-radius: 8px; cursor: pointer;">
                                <input type="radio" name="edit_st_student_type" value="INTERNATIONAL" ${isIntl ? 'checked' : ''} onchange="StudentsModule.handleEditStudentTypeChange('INTERNATIONAL')" style="accent-color: var(--gold-500);">
                                <div>
                                    <div style="font-weight: 700; font-size: 0.85rem; color: var(--primary-950);"><i class="fas fa-globe-americas" style="color: var(--gold-600);"></i> International Student</div>
                                    <div style="font-size: 0.72rem; color: var(--text-secondary);">Overseas (Passport & Country)</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                        <div>
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">Candidate Name (English) *</label>
                            <input type="text" id="edit-st-name" class="form-control" value="${student.name || ''}" required>
                        </div>
                        <div>
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">Name in Urdu (طالب علم)</label>
                            <input type="text" id="edit-st-urdu" class="form-control" value="${student.urduName || ''}" style="font-family: 'Amiri', serif;">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                        <div>
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">Father / Guardian Name *</label>
                            <input type="text" id="edit-st-guardian" class="form-control" value="${student.guardianName || student.fatherName || ''}" required>
                        </div>
                        <div>
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">Roll Number *</label>
                            <input type="text" id="edit-st-roll" class="form-control" value="${student.rollNo || ''}" required>
                        </div>
                    </div>

                    <!-- IDENTIFICATION FIELDS -->
                    <div style="margin-bottom: 14px;">
                        <div id="edit-st-cnic-group" style="display: ${!isIntl ? 'block' : 'none'};">
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span>CNIC / B-Form Number *</span>
                                <span style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">XXXXX-XXXXXXX-X</span>
                            </label>
                            <input type="text" id="edit-st-cnic" class="form-control" value="${student.cnic || ''}" placeholder="35201-1234567-1" maxlength="15" ${!isIntl ? 'required' : ''}>
                        </div>
                        <div id="edit-st-intl-group" style="display: ${isIntl ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr; gap: 14px;">
                            <div>
                                <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <span>Passport Number *</span>
                                    <span style="font-size: 0.72rem; color: var(--gold-700);">Alphanumeric</span>
                                </label>
                                <input type="text" id="edit-st-passport" class="form-control" value="${student.passport || ''}" placeholder="e.g. A12345678" maxlength="30" ${isIntl ? 'required' : ''}>
                            </div>
                            <div>
                                <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <span>Country of Residence *</span>
                                    <span style="font-size: 0.72rem; color: var(--gold-700);">Searchable</span>
                                </label>
                                <input type="text" id="edit-st-country" list="edit-st-country-datalist" class="form-control" value="${student.country || (isIntl ? 'United Kingdom' : 'Pakistan')}" placeholder="Select country..." ${isIntl ? 'required' : ''}>
                                <datalist id="edit-st-country-datalist">
                                    ${(window.WORLD_COUNTRIES || []).map(c => `<option value="${c}">`).join('')}
                                </datalist>
                            </div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                        <div>
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">Academic Program *</label>
                            <select id="edit-st-program" class="form-control">
                                <option value="Dawra-e-Hadith (Alimiyyah)" ${student.program?.includes('Dawra') ? 'selected' : ''}>Dawra-e-Hadith (Alimiyyah)</option>
                                <option value="Aaliyah (Alimiyyah 7th)" ${student.program?.includes('Aaliyah') ? 'selected' : ''}>Aaliyah (Alimiyyah 7th)</option>
                                <option value="Takhassus fil-Ifta" ${student.program?.includes('Takhassus') ? 'selected' : ''}>Takhassus fil-Ifta</option>
                                <option value="Hifz-ul-Quran & Tajweed" ${student.program?.includes('Hifz') ? 'selected' : ''}>Hifz-ul-Quran & Tajweed</option>
                                <option value="Qira'at Sab'ah" ${student.program?.includes('Qira') ? 'selected' : ''}>Qira'at Sab'ah</option>
                                <option value="Alimiyyah Lil Bannat" ${student.program?.includes('Bannat') ? 'selected' : ''}>Alimiyyah Lil Bannat</option>
                            </select>
                        </div>
                        <div>
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">Class Assignment</label>
                            <select id="edit-st-class" class="form-control">
                                <option value="cls_dawra_a" ${student.classId === 'cls_dawra_a' ? 'selected' : ''}>Dawra-e-Hadith Section A</option>
                                <option value="cls_dawra_b" ${student.classId === 'cls_dawra_b' ? 'selected' : ''}>Dawra-e-Hadith Section B</option>
                                <option value="cls_aaliyah" ${student.classId === 'cls_aaliyah' ? 'selected' : ''}>Aaliyah (7th Year)</option>
                                <option value="cls_ifta" ${student.classId === 'cls_ifta' ? 'selected' : ''}>Takhassus fil-Ifta</option>
                                <option value="cls_hifz_3" ${student.classId === 'cls_hifz_3' ? 'selected' : ''}>Hifz-ul-Quran</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                        <div>
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">Contact Phone / WhatsApp</label>
                            <input type="text" id="edit-st-phone" class="form-control" value="${student.phone || ''}">
                        </div>
                        <div>
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">Residence / Hostel</label>
                            <select id="edit-st-hostel" class="form-control">
                                <option value="Day Scholar" ${!student.hostel || student.hostel.includes('Day') ? 'selected' : ''}>Day Scholar</option>
                                <option value="Hostel Block A" ${student.hostel?.includes('Block A') ? 'selected' : ''}>Hostel Block A (Resident)</option>
                                <option value="Hostel Block B" ${student.hostel?.includes('Block B') ? 'selected' : ''}>Hostel Block B (Resident)</option>
                            </select>
                        </div>
                    </div>
                </form>
            `;
        }

        if (footerEl) {
            footerEl.innerHTML = `
                <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
                <button class="btn btn-gold" onclick="document.getElementById('form-edit-student').requestSubmit()">
                    <i class="fas fa-save"></i> Save Changes
                </button>
            `;
        }

        // CNIC Masking
        const cnicInput = document.getElementById('edit-st-cnic');
        if (cnicInput) {
            cnicInput.addEventListener('input', function(e) {
                const typeChecked = document.querySelector('input[name="edit_st_student_type"]:checked')?.value;
                if (typeChecked !== 'LOCAL') return;
                let val = e.target.value.replace(/\D/g, '').slice(0, 13);
                if (val.length > 5 && val.length <= 12) {
                    val = val.slice(0, 5) + '-' + val.slice(5);
                } else if (val.length > 12) {
                    val = val.slice(0, 5) + '-' + val.slice(5, 12) + '-' + val.slice(12);
                }
                e.target.value = val;
            });
        }

        App.openModal();
    },

    handleEditStudentTypeChange(type) {
        const localCard = document.getElementById('edit-st-type-local-card');
        const intlCard = document.getElementById('edit-st-type-intl-card');
        const cnicGroup = document.getElementById('edit-st-cnic-group');
        const intlGroup = document.getElementById('edit-st-intl-group');
        const cnicInput = document.getElementById('edit-st-cnic');
        const passportInput = document.getElementById('edit-st-passport');
        const countryInput = document.getElementById('edit-st-country');

        if (type === 'LOCAL') {
            if (localCard) { localCard.style.borderColor = 'var(--primary-500)'; localCard.style.background = 'rgba(6, 78, 59, 0.4)'; localCard.style.borderWidth = '2px'; }
            if (intlCard) { intlCard.style.borderColor = 'var(--border-prominent)'; intlCard.style.background = 'var(--bg-surface-elevated)'; intlCard.style.borderWidth = '1.5px'; }
            if (cnicGroup) cnicGroup.style.display = 'block';
            if (intlGroup) intlGroup.style.display = 'none';
            if (cnicInput) { cnicInput.required = true; cnicInput.setAttribute('required', 'required'); }
            if (passportInput) { passportInput.required = false; passportInput.removeAttribute('required'); }
            if (countryInput) { countryInput.required = false; countryInput.removeAttribute('required'); }
        } else {
            if (intlCard) { intlCard.style.borderColor = 'var(--gold-400)'; intlCard.style.background = 'rgba(217, 119, 6, 0.2)'; intlCard.style.borderWidth = '2px'; }
            if (localCard) { localCard.style.borderColor = 'var(--border-prominent)'; localCard.style.background = 'var(--bg-surface-elevated)'; localCard.style.borderWidth = '1.5px'; }
            if (cnicGroup) cnicGroup.style.display = 'none';
            if (intlGroup) intlGroup.style.display = 'grid';
            if (cnicInput) { cnicInput.required = false; cnicInput.removeAttribute('required'); }
            if (passportInput) { passportInput.required = true; passportInput.setAttribute('required', 'required'); }
            if (countryInput) { countryInput.required = true; countryInput.setAttribute('required', 'required'); }
        }
    },

    handleEditStudentSubmit(e, studentId) {
        e.preventDefault();
        const student = (window.LmsData.users || []).find(u => u.id === studentId);
        if (!student) return;

        const studentType = document.querySelector('input[name="edit_st_student_type"]:checked')?.value || 'LOCAL';
        const name = document.getElementById('edit-st-name').value.trim();
        const urduName = document.getElementById('edit-st-urdu').value.trim();
        const guardianName = document.getElementById('edit-st-guardian').value.trim();
        const rollNo = document.getElementById('edit-st-roll').value.trim();
        const program = document.getElementById('edit-st-program').value;
        const classId = document.getElementById('edit-st-class').value;
        const phone = document.getElementById('edit-st-phone').value.trim();
        const hostel = document.getElementById('edit-st-hostel').value;

        let cnic = '';
        let passport = '';
        let country = 'Pakistan';

        if (studentType === 'LOCAL') {
            cnic = document.getElementById('edit-st-cnic').value.trim();
            if (!cnic) {
                App.showToast("Please enter candidate CNIC Number", "warning");
                return;
            }
            const cnicClean = cnic.replace(/\D/g, '');
            if (cnicClean.length !== 13) {
                App.showToast("CNIC / B-Form must contain 13 digits (format: 35201-1234567-1)", "warning");
                return;
            }
        } else {
            passport = document.getElementById('edit-st-passport').value.trim();
            country = document.getElementById('edit-st-country').value.trim();
            if (!passport) {
                App.showToast("Please enter candidate Passport Number", "warning");
                return;
            }
            if (passport.length < 3) {
                App.showToast("Passport Number must be at least 3 characters", "warning");
                return;
            }
            if (!country) {
                App.showToast("Please select candidate's country of residence", "warning");
                return;
            }
        }

        student.studentType = studentType;
        student.name = name;
        student.urduName = urduName;
        student.guardianName = guardianName;
        student.rollNo = rollNo;
        student.cnic = cnic;
        student.passport = passport;
        student.country = country;
        student.program = program;
        student.classId = classId;
        student.phone = phone;
        student.hostel = hostel;

        window.DataStore.save(window.LmsData);
        App.closeModal();
        App.showToast(`Scholar record for ${student.name} updated!`, "success");

        const viewport = document.getElementById('main-content-viewport');
        if (viewport && App.currentRoute === 'students') {
            viewport.innerHTML = this.render();
        }
    },

    openDirectEnrollmentModal() {
        const titleEl = document.getElementById('modal-title-text');
        const bodyEl = document.getElementById('modal-body-container');
        const footerEl = document.getElementById('modal-footer-container');

        const nextRollNumber = `ASH-2026-${String(window.LmsData.users.filter(u => u.role === 'STUDENT').length + 51).padStart(3, '0')}`;

        if (titleEl) {
            titleEl.innerHTML = `<i class="fas fa-user-plus" style="color: var(--gold-400);"></i> Direct Scholar Enrollment`;
        }

        if (bodyEl) {
            bodyEl.innerHTML = `
                <form id="form-direct-enroll" onsubmit="StudentsModule.handleDirectEnrollSubmit(event)">
                    <!-- STUDENT TYPE SELECTION -->
                    <div style="margin-bottom: 14px;">
                        <label class="form-label" style="font-weight: 700; color: var(--text-primary); display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span><i class="fas fa-user-tag" style="color: var(--gold-600); margin-right: 6px;"></i> Student Category *</span>
                            <span style="font-size: 0.72rem; color: var(--gold-700);">Identification Routing</span>
                        </label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <label id="direct-st-type-local-card" style="display: flex; align-items: center; gap: 8px; padding: 10px; background: var(--primary-50); border: 2px solid var(--primary-500); border-radius: 8px; cursor: pointer;">
                                <input type="radio" name="direct_st_student_type" value="LOCAL" checked onchange="StudentsModule.handleDirectEnrollTypeChange('LOCAL')" style="accent-color: var(--primary-500);">
                                <div>
                                    <div style="font-weight: 700; font-size: 0.85rem; color: var(--primary-950);"><i class="fas fa-flag" style="color: var(--primary-600);"></i> Local Student</div>
                                    <div style="font-size: 0.72rem; color: var(--text-secondary);">Pakistani (CNIC / B-Form)</div>
                                </div>
                            </label>
                            <label id="direct-st-type-intl-card" style="display: flex; align-items: center; gap: 8px; padding: 10px; background: var(--bg-surface-elevated); border: 1.5px solid var(--border-prominent); border-radius: 8px; cursor: pointer;">
                                <input type="radio" name="direct_st_student_type" value="INTERNATIONAL" onchange="StudentsModule.handleDirectEnrollTypeChange('INTERNATIONAL')" style="accent-color: var(--gold-500);">
                                <div>
                                    <div style="font-weight: 700; font-size: 0.85rem; color: var(--primary-950);"><i class="fas fa-globe-americas" style="color: var(--gold-600);"></i> International Student</div>
                                    <div style="font-size: 0.72rem; color: var(--text-secondary);">Overseas (Passport & Country)</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                        <div>
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">Scholar Name (English) *</label>
                            <input type="text" id="direct-st-name" class="form-control" placeholder="e.g. Hafiz Usman Ghani" required>
                        </div>
                        <div>
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">Father's Name *</label>
                            <input type="text" id="direct-st-father" class="form-control" placeholder="e.g. Maulana Abdul Shakoor" required>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                        <div>
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">Allotted Roll Number *</label>
                            <input type="text" id="direct-st-roll" class="form-control" value="${nextRollNumber}" required>
                        </div>
                        <!-- LOCAL CNIC FIELD -->
                        <div id="direct-st-cnic-group">
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span>CNIC / B-Form Number *</span>
                                <span style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">XXXXX-XXXXXXX-X</span>
                            </label>
                            <input type="text" id="direct-st-cnic" class="form-control" placeholder="35201-1234567-1" maxlength="15" required>
                        </div>
                    </div>

                    <!-- INTERNATIONAL PASSPORT & COUNTRY FIELDS -->
                    <div id="direct-st-intl-group" style="display: none; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                        <div>
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span>Passport Number *</span>
                                <span style="font-size: 0.72rem; color: var(--gold-700);">Alphanumeric</span>
                            </label>
                            <input type="text" id="direct-st-passport" class="form-control" placeholder="e.g. A12345678" maxlength="30">
                        </div>
                        <div>
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span>Country of Residence *</span>
                                <span style="font-size: 0.72rem; color: var(--gold-700);">Searchable</span>
                            </label>
                            <input type="text" id="direct-st-country" list="direct-st-country-datalist" class="form-control" placeholder="Search country...">
                            <datalist id="direct-st-country-datalist">
                                ${(window.WORLD_COUNTRIES || []).map(c => `<option value="${c}">`).join('')}
                            </datalist>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                        <div>
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">Academic Program *</label>
                            <select id="direct-st-program" class="form-control">
                                <option value="Dawra-e-Hadith (Alimiyyah)">Dawra-e-Hadith (Alimiyyah)</option>
                                <option value="Aaliyah (Alimiyyah 7th)">Aaliyah (Alimiyyah 7th)</option>
                                <option value="Takhassus fil-Ifta">Takhassus fil-Ifta</option>
                                <option value="Hifz-ul-Quran & Tajweed">Hifz-ul-Quran & Tajweed</option>
                            </select>
                        </div>
                        <div>
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">Class Assignment *</label>
                            <select id="direct-st-class" class="form-control">
                                <option value="cls_dawra_a">Dawra-e-Hadith Section A</option>
                                <option value="cls_dawra_b">Dawra-e-Hadith Section B</option>
                                <option value="cls_aaliyah">Aaliyah (7th Year)</option>
                                <option value="cls_ifta">Takhassus fil-Ifta</option>
                                <option value="cls_hifz_3">Hifz-ul-Quran</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                        <div>
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">Student Login Email *</label>
                            <input type="email" id="direct-st-email" class="form-control" placeholder="scholar@jamiaashrafia.org" required>
                        </div>
                        <div>
                            <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">Initial Password *</label>
                            <input type="text" id="direct-st-pwd" class="form-control" value="ashrafia123" required>
                        </div>
                    </div>

                    <div style="margin-bottom: 14px;">
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 4px;">Hostel Accommodation</label>
                        <select id="direct-st-hostel" class="form-control">
                            <option value="Day Scholar">Day Scholar (Non-Resident)</option>
                            <option value="Hostel Block A">Hostel Block A (Resident)</option>
                            <option value="Hostel Block B">Hostel Block B (Resident)</option>
                        </select>
                    </div>
                </form>
            `;
        }

        if (footerEl) {
            footerEl.innerHTML = `
                <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
                <button class="btn btn-gold" onclick="document.getElementById('form-direct-enroll').requestSubmit()">
                    <i class="fas fa-check-circle"></i> Complete Enrollment
                </button>
            `;
        }

        // CNIC Masking
        const cnicInput = document.getElementById('direct-st-cnic');
        if (cnicInput) {
            cnicInput.addEventListener('input', function(e) {
                const typeChecked = document.querySelector('input[name="direct_st_student_type"]:checked')?.value;
                if (typeChecked !== 'LOCAL') return;
                let val = e.target.value.replace(/\D/g, '').slice(0, 13);
                if (val.length > 5 && val.length <= 12) {
                    val = val.slice(0, 5) + '-' + val.slice(5);
                } else if (val.length > 12) {
                    val = val.slice(0, 5) + '-' + val.slice(5, 12) + '-' + val.slice(12);
                }
                e.target.value = val;
            });
        }

        App.openModal();
    },

    handleDirectEnrollTypeChange(type) {
        const localCard = document.getElementById('direct-st-type-local-card');
        const intlCard = document.getElementById('direct-st-type-intl-card');
        const cnicGroup = document.getElementById('direct-st-cnic-group');
        const intlGroup = document.getElementById('direct-st-intl-group');
        const cnicInput = document.getElementById('direct-st-cnic');
        const passportInput = document.getElementById('direct-st-passport');
        const countryInput = document.getElementById('direct-st-country');

        if (type === 'LOCAL') {
            if (localCard) { localCard.style.borderColor = 'var(--primary-500)'; localCard.style.background = 'rgba(6, 78, 59, 0.4)'; localCard.style.borderWidth = '2px'; }
            if (intlCard) { intlCard.style.borderColor = 'var(--border-prominent)'; intlCard.style.background = 'var(--bg-surface-elevated)'; intlCard.style.borderWidth = '1.5px'; }
            if (cnicGroup) cnicGroup.style.display = 'block';
            if (intlGroup) intlGroup.style.display = 'none';
            if (cnicInput) { cnicInput.required = true; cnicInput.setAttribute('required', 'required'); }
            if (passportInput) { passportInput.required = false; passportInput.removeAttribute('required'); }
            if (countryInput) { countryInput.required = false; countryInput.removeAttribute('required'); }
        } else {
            if (intlCard) { intlCard.style.borderColor = 'var(--gold-400)'; intlCard.style.background = 'rgba(217, 119, 6, 0.2)'; intlCard.style.borderWidth = '2px'; }
            if (localCard) { localCard.style.borderColor = 'var(--border-prominent)'; localCard.style.background = 'var(--bg-surface-elevated)'; localCard.style.borderWidth = '1.5px'; }
            if (cnicGroup) cnicGroup.style.display = 'none';
            if (intlGroup) intlGroup.style.display = 'grid';
            if (cnicInput) { cnicInput.required = false; cnicInput.removeAttribute('required'); }
            if (passportInput) { passportInput.required = true; passportInput.setAttribute('required', 'required'); }
            if (countryInput) { countryInput.required = true; countryInput.setAttribute('required', 'required'); }
        }
    },

    handleDirectEnrollSubmit(e) {
        e.preventDefault();
        const studentType = document.querySelector('input[name="direct_st_student_type"]:checked')?.value || 'LOCAL';
        const name = document.getElementById('direct-st-name').value.trim();
        const father = document.getElementById('direct-st-father').value.trim();
        const rollNo = document.getElementById('direct-st-roll').value.trim();
        const program = document.getElementById('direct-st-program').value;
        const classId = document.getElementById('direct-st-class').value;
        const email = document.getElementById('direct-st-email').value.trim();
        const pwd = document.getElementById('direct-st-pwd').value.trim();
        const hostel = document.getElementById('direct-st-hostel').value;

        let cnic = '';
        let passport = '';
        let country = 'Pakistan';

        if (studentType === 'LOCAL') {
            cnic = document.getElementById('direct-st-cnic').value.trim();
            if (!cnic) {
                App.showToast("Please enter candidate CNIC Number", "warning");
                return;
            }
            const cnicClean = cnic.replace(/\D/g, '');
            if (cnicClean.length !== 13) {
                App.showToast("CNIC / B-Form must contain 13 digits (format: 35201-1234567-1)", "warning");
                return;
            }
        } else {
            passport = document.getElementById('direct-st-passport').value.trim();
            country = document.getElementById('direct-st-country').value.trim();
            if (!passport) {
                App.showToast("Please enter candidate Passport Number", "warning");
                return;
            }
            if (passport.length < 3) {
                App.showToast("Passport Number must be at least 3 characters", "warning");
                return;
            }
            if (!country) {
                App.showToast("Please select candidate's country of residence", "warning");
                return;
            }
        }

        const newStudent = {
            id: `u_stud_${Date.now()}`,
            name: name,
            urduName: name,
            role: "STUDENT",
            studentType: studentType,
            country: country,
            rollNo: rollNo,
            classId: classId,
            program: program,
            branchId: "b1",
            email: email,
            password: pwd,
            phone: studentType === 'LOCAL' ? "+92 300 0000000" : "+1 555 0000",
            cnic: cnic,
            passport: passport,
            guardianName: father,
            hostel: hostel,
            status: "ACTIVE",
            avatar: name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
            attendancePct: 100,
            gpa: "Fresh Scholar",
            enrollmentDate: new Date().toISOString().split('T')[0]
        };

        window.LmsData.users.push(newStudent);
        window.DataStore.save(window.LmsData);
        App.closeModal();
        App.showToast(`Scholar ${name} enrolled with Roll No: ${rollNo}!`, "success");

        const viewport = document.getElementById('main-content-viewport');
        if (viewport && App.currentRoute === 'students') {
            viewport.innerHTML = this.render();
        }
    },

    testStudentPersona(studentId) {
        window.AuthRBAC.setUser(studentId);
        App.renderSidebar();
        App.closeModal();
        App.showToast("Switched persona to Student View", "gold");
        App.navigate('dashboard');
    },

    // Individual Student Attendance Log Modal
    viewAttendance(studentId) {
        const student = (window.LmsData.users || []).find(u => u.id === studentId);
        if (!student) return;

        const records = (window.LmsData.attendance || []).filter(r => r.userId === studentId);

        const titleEl = document.getElementById('modal-title-text');
        const bodyEl = document.getElementById('modal-body-container');
        const footerEl = document.getElementById('modal-footer-container');

        if (titleEl) {
            titleEl.innerHTML = `<i class="fas fa-calendar-alt" style="color: var(--gold-400);"></i> Attendance History: ${student.name} (${student.rollNo})`;
        }

        if (bodyEl) {
            bodyEl.innerHTML = `
                <div style="margin-bottom: 16px; font-size: 0.85rem; color: var(--text-secondary);">
                    Viewing attendance timestamps, check-in/out hours, and session notes for <strong>${student.name}</strong>.
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Check-In</th>
                                <th>Check-Out</th>
                                <th>Status</th>
                                <th>Session</th>
                                <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${records.length > 0 ? records.map(r => `
                                <tr>
                                    <td><strong>${r.date}</strong></td>
                                    <td style="color: ${r.status === 'LATE' ? 'var(--warning)' : 'var(--primary-300)'};">${r.checkInTime || '—'}</td>
                                    <td style="color: var(--text-muted);">${r.checkOutTime || '—'}</td>
                                    <td>
                                        <span class="status-pill ${r.status === 'PRESENT' ? 'success' : (r.status === 'LATE' ? 'warning' : 'danger')}">
                                            ${r.status}
                                        </span>
                                    </td>
                                    <td style="font-size: 0.78rem;">${r.session || 'DAILY'}</td>
                                    <td style="font-size: 0.78rem; color: var(--text-muted);">${r.notes || 'Routine arrival'}</td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">
                                        No attendance records found for this student.
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            `;
        }

        if (footerEl) {
            footerEl.innerHTML = `
                <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
            `;
        }

        App.openModal();
    },

    printStudentCard(studentId) {
        const student = (window.LmsData.users || []).find(u => u.id === studentId);
        if (!student) return;

        const titleEl = document.getElementById('modal-title-text');
        const bodyEl = document.getElementById('modal-body-container');
        const footerEl = document.getElementById('modal-footer-container');

        if (titleEl) {
            titleEl.innerHTML = `<i class="fas fa-id-card" style="color: var(--primary-600);"></i> Digital Student Identity Card`;
        }

        if (bodyEl) {
            bodyEl.innerHTML = `
                <div style="display: flex; justify-content: center; padding: 10px;">
                    <div class="student-id-card-wrap" style="width: 390px; background: #ffffff; border: 2px solid var(--primary-700); border-radius: 14px; padding: 22px; color: var(--text-primary); box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08); position: relative; overflow: hidden;">
                        <!-- Card Header -->
                        <div style="display: flex; align-items: center; gap: 12px; border-bottom: 2px solid var(--primary-100); padding-bottom: 12px; margin-bottom: 14px;">
                            <img src="assets/images/logo.png" style="width: 48px; height: 48px; object-fit: contain;">
                            <div>
                                <div style="font-weight: 800; font-size: 1rem; color: var(--primary-950); letter-spacing: 0.5px;">JAMIA ASHRAFIA LAHORE</div>
                                <div style="font-family: 'Amiri', serif; font-size: 0.95rem; color: var(--gold-700); font-weight: 700;">جامعہ اشرفیہ، لاہور - علم اور تقویٰ</div>
                                <div style="font-size: 0.68rem; color: var(--text-muted); letter-spacing: 0.5px; text-transform: uppercase;">Student Identity Card</div>
                            </div>
                        </div>

                        <!-- Card Body -->
                        <div style="display: flex; gap: 16px; align-items: center;">
                            <div style="width: 88px; height: 105px; background: var(--primary-50); border: 1.5px solid var(--primary-600); border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 2.2rem; color: var(--primary-700); flex-shrink: 0;">
                                <i class="fas fa-user-graduate"></i>
                                <span style="font-size: 0.65rem; color: var(--primary-800); font-weight: 700; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Photo</span>
                            </div>
                            <div style="flex: 1; font-size: 0.84rem; line-height: 1.65; color: var(--text-primary);">
                                <div><span style="color: var(--text-muted); font-size: 0.78rem;">Name:</span> <strong style="color: var(--primary-950); font-size: 0.92rem;">${student.name}</strong></div>
                                <div><span style="color: var(--text-muted); font-size: 0.78rem;">Roll No:</span> <span style="color: var(--gold-700); font-weight: 800; font-family: monospace; font-size: 0.92rem;">${student.rollNo || 'N/A'}</span></div>
                                <div><span style="color: var(--text-muted); font-size: 0.78rem;">Program:</span> <span style="font-weight: 600;">${student.program || 'Dars-e-Nizami'}</span></div>
                                <div><span style="color: var(--text-muted); font-size: 0.78rem;">Class:</span> <span style="font-weight: 600;">${student.classId || 'Dawra-e-Hadith'}</span></div>
                                <div><span style="color: var(--text-muted); font-size: 0.78rem;">Residence:</span> <span style="font-weight: 600;">${student.hostel || 'Day Scholar'}</span></div>
                            </div>
                        </div>

                        <!-- Card Footer & Barcode -->
                        <div style="margin-top: 14px; border-top: 1px dashed var(--border-prominent); padding-top: 10px; display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <div style="font-family: monospace; font-size: 0.8rem; letter-spacing: 2px; color: var(--primary-950); font-weight: 700;">
                                    ||| | |||| | |||||| || |
                                </div>
                                <div style="font-size: 0.65rem; color: var(--text-muted); font-family: monospace;">${student.id || 'JAL-ST-CARD'}</div>
                            </div>
                            <div style="font-size: 0.68rem; color: var(--text-secondary); text-align: right; line-height: 1.35;">
                                <div>Valid Session: <strong>1446-1447 AH</strong></div>
                                <div style="color: var(--gold-700); font-weight: 700; margin-top: 2px;">Authorized Signatory</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        if (footerEl) {
            footerEl.innerHTML = `
                <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
                <button class="btn btn-gold" onclick="window.print()"><i class="fas fa-print"></i> Print ID Card</button>
            `;
        }

        App.openModal();
    },

    // Export Students list to CSV
    exportStudentsCSV() {
        const students = (window.LmsData.users || []).filter(u => u.role === 'STUDENT');
        let csv = "Roll No,Name,Urdu Name,Program,Class,Email,Phone,Guardian,Residence,Attendance %,Standing,Status\n";
        students.forEach(s => {
            csv += `"${s.rollNo || ''}","${s.name}","${s.urduName || ''}","${s.program || ''}","${s.classId || ''}","${s.email || ''}","${s.phone || ''}","${s.guardianName || s.fatherName || ''}","${s.hostel || ''}","${s.attendancePct || 90}%","${s.gpa || ''}","${s.status || 'ACTIVE'}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Jamia_Ashrafia_Students_Roster_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        App.showToast("Students Roster CSV successfully downloaded!", "gold");
    }
};

window.StudentsModule = StudentsModule;
