/**
 * JAMIA ASHRAFIA LAHORE - STUDENTS MANAGEMENT MODULE
 * Super Admin & Academic Admin Student Roster, Comprehensive Profiles,
 * Enrolled Courses, Attendance Logs, Exam Performance, and Activity Tracking
 */

const StudentsModule = {
    searchQuery: '',
    filterProgram: 'ALL',
    filterBranch: 'ALL',
    filterStatus: 'ALL',

    render() {
        const user = window.AuthRBAC.currentUser;
        const role = window.AuthRBAC.getRole();

        // RBAC Check
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
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(s => 
                s.name.toLowerCase().includes(q) ||
                (s.urduName && s.urduName.includes(q)) ||
                (s.rollNo && s.rollNo.toLowerCase().includes(q)) ||
                (s.email && s.email.toLowerCase().includes(q))
            );
        }

        if (this.filterProgram !== 'ALL') {
            filtered = filtered.filter(s => s.program && s.program.includes(this.filterProgram));
        }

        if (this.filterStatus !== 'ALL') {
            filtered = filtered.filter(s => (s.status || 'ACTIVE') === this.filterStatus);
        }

        // Metrics
        const totalStudents = students.length;
        const hostelResidents = students.filter(s => s.hostel && s.hostel.includes('Hostel')).length;
        const avgAttendance = Math.round(students.reduce((acc, s) => acc + (s.attendancePct || 90), 0) / (totalStudents || 1));
        const mumtazCount = students.filter(s => s.gpa && s.gpa.includes('Mumtaz')).length;

        return `
            <!-- HEADER -->
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-user-graduate" style="color: var(--gold-400);"></i>
                        Students Management & Comprehensive Academic Roster
                    </h1>
                    <p>Directory of resident scholars, Dars-e-Nizami enrollments, attendance summaries, and individual profile records</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-secondary btn-sm" onclick="StudentsModule.exportStudentsCSV()">
                        <i class="fas fa-file-csv"></i> Export Students CSV
                    </button>
                    <button class="btn btn-gold btn-sm" onclick="App.navigate('reports')">
                        <i class="fas fa-chart-line"></i> View Student Reports
                    </button>
                </div>
            </div>

            <!-- KPI METRICS -->
            <div class="metrics-grid">
                <div class="metric-card gold">
                    <div class="metric-icon-box"><i class="fas fa-user-graduate"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Enrolled Scholars</span>
                        <span class="metric-value">${totalStudents} Talaba</span>
                        <span class="metric-hint" style="color: var(--gold-300);">${filtered.length} Displayed</span>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon-box"><i class="fas fa-hotel"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Boarding / Hostel</span>
                        <span class="metric-value">${hostelResidents} Residents</span>
                        <span class="metric-hint">Ashrafia Hostels</span>
                    </div>
                </div>
                <div class="metric-card success">
                    <div class="metric-icon-box"><i class="fas fa-calendar-check"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Avg Attendance</span>
                        <span class="metric-value">${avgAttendance}%</span>
                        <span class="metric-hint">Wifaq Punctuality</span>
                    </div>
                </div>
                <div class="metric-card info">
                    <div class="metric-icon-box"><i class="fas fa-award"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Mumtaz Standing</span>
                        <span class="metric-value">${mumtazCount} Scholars</span>
                        <span class="metric-hint">&gt;= 80% Grade Average</span>
                    </div>
                </div>
            </div>

            <!-- FILTER CONTROLS -->
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 20px;">
                    <div class="search-input-wrap" style="width: 280px;">
                        <i class="fas fa-search"></i>
                        <input type="text" class="form-control" placeholder="Search by name, roll no, email..." 
                               value="${this.searchQuery}" oninput="StudentsModule.setSearch(this.value)" 
                               style="padding: 8px 12px 8px 36px;">
                    </div>

                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <select class="form-control" onchange="StudentsModule.setProgram(this.value)" style="padding: 8px 12px; font-size: 0.85rem;">
                            <option value="ALL">All Academic Programs</option>
                            <option value="Dawra-e-Hadith">Dawra-e-Hadith</option>
                            <option value="Aaliyah">Aaliyah (Alimiyyah)</option>
                            <option value="Takhassus">Takhassus fil-Ifta</option>
                            <option value="Hifz">Hifz-ul-Quran</option>
                            <option value="Qira'at">Qira'at Sab'ah</option>
                            <option value="Bannat">Alimiyyah Lil Bannat</option>
                        </select>

                        <select class="form-control" onchange="StudentsModule.setStatus(this.value)" style="padding: 8px 12px; font-size: 0.85rem;">
                            <option value="ALL">All Statuses</option>
                            <option value="ACTIVE">Active</option>
                            <option value="GRADUATED">Graduated</option>
                            <option value="SUSPENDED">Suspended</option>
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
                                <th>Status</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.length > 0 ? filtered.map(s => `
                                <tr>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <div class="user-avatar" style="width: 36px; height: 36px; font-size: 0.8rem; background: var(--primary-700);">${s.avatar || 'ST'}</div>
                                            <div>
                                                <div style="font-weight: 700; color: #ffffff;">${s.name}</div>
                                                <div style="font-family: 'Amiri', serif; font-size: 0.95rem; color: var(--gold-200);">${s.urduName || ''}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="status-pill primary" style="font-family: monospace; font-size: 0.8rem;">${s.rollNo || 'N/A'}</span>
                                    </td>
                                    <td style="color: var(--text-secondary); font-size: 0.85rem;">
                                        <div>${s.program || 'Dars-e-Nizami'}</div>
                                        <span style="font-size: 0.72rem; color: var(--text-muted);">${s.classId || 'cls_dawra_a'}</span>
                                    </td>
                                    <td style="font-size: 0.82rem; color: var(--text-muted);">
                                        ${s.hostel || 'Day Scholar'}
                                    </td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            <strong style="color: ${s.attendancePct >= 90 ? 'var(--primary-300)' : 'var(--warning)'};">${s.attendancePct || 92}%</strong>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="status-pill gold" style="font-size: 0.75rem;">${s.gpa || 'Jayyid'}</span>
                                    </td>
                                    <td>
                                        <span class="status-pill ${s.status === 'ACTIVE' ? 'success' : 'danger'}">${s.status || 'ACTIVE'}</span>
                                    </td>
                                    <td style="text-align: right;">
                                        <div style="display: inline-flex; gap: 6px;">
                                            <button class="btn btn-secondary btn-sm" onclick="StudentsModule.viewProfile('${s.id}')" title="Inspect complete student profile">
                                                <i class="fas fa-id-card"></i> Profile
                                            </button>
                                            <button class="btn btn-secondary btn-sm" onclick="StudentsModule.viewAttendance('${s.id}')" title="View individual attendance history">
                                                <i class="fas fa-calendar-check"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="8" style="text-align: center; padding: 36px; color: var(--text-muted);">
                                        <i class="fas fa-user-slash" style="font-size: 2rem; margin-bottom: 8px;"></i>
                                        <div>No scholars found matching the selected filter criteria.</div>
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
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

    // Inspect Detailed Student Profile Modal
    viewProfile(studentId) {
        const student = (window.LmsData.users || []).find(u => u.id === studentId);
        if (!student) return;

        const studentAttendance = (window.LmsData.attendance || []).filter(r => r.userId === studentId);
        const presentCount = studentAttendance.filter(r => r.status === 'PRESENT').length;
        const lateCount = studentAttendance.filter(r => r.status === 'LATE').length;

        const titleEl = document.getElementById('modal-title-text');
        const bodyEl = document.getElementById('modal-body-container');
        const footerEl = document.getElementById('modal-footer-container');

        if (titleEl) {
            titleEl.innerHTML = `<i class="fas fa-user-graduate" style="color: var(--gold-400);"></i> Scholar Profile: ${student.name}`;
        }

        if (bodyEl) {
            bodyEl.innerHTML = `
                <!-- Profile Header -->
                <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-subtle);">
                    <div class="user-avatar" style="width: 64px; height: 64px; font-size: 1.5rem; background: var(--primary-700); border: 2px solid var(--gold-400);">${student.avatar || 'ST'}</div>
                    <div>
                        <h3 style="color: #ffffff; margin-bottom: 4px;">${student.name}</h3>
                        <div style="font-family: 'Amiri', serif; font-size: 1.25rem; color: var(--gold-200);">${student.urduName || ''}</div>
                        <div style="display: flex; gap: 8px; margin-top: 6px;">
                            <span class="status-pill primary">Roll No: ${student.rollNo}</span>
                            <span class="status-pill success">${student.status || 'ACTIVE'}</span>
                            <span class="status-pill gold">${student.gpa || 'Mumtaz'}</span>
                        </div>
                    </div>
                </div>

                <!-- Academic & Personal Grid -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; font-size: 0.85rem;">
                    <div style="background: var(--bg-surface-elevated); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); line-height: 1.8;">
                        <h4 style="color: var(--gold-400); margin-bottom: 8px;"><i class="fas fa-university"></i> Academic Info</h4>
                        <div><strong>Program:</strong> ${student.program || 'Dars-e-Nizami'}</div>
                        <div><strong>Current Class:</strong> ${student.classId || 'Dawra-e-Hadith'}</div>
                        <div><strong>Enrollment Date:</strong> ${student.enrollmentDate || '2024-08-15'}</div>
                        <div><strong>Campus:</strong> Main Campus (Ferozepur Rd)</div>
                    </div>
                    <div style="background: var(--bg-surface-elevated); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); line-height: 1.8;">
                        <h4 style="color: var(--primary-300); margin-bottom: 8px;"><i class="fas fa-id-badge"></i> Contact & Residence</h4>
                        <div><strong>Guardian:</strong> ${student.guardianName || 'N/A'}</div>
                        <div><strong>Email:</strong> ${student.email || 'N/A'}</div>
                        <div><strong>Phone:</strong> ${student.phone || '+92 300 0000000'}</div>
                        <div><strong>Residence:</strong> ${student.hostel || 'Day Scholar'}</div>
                    </div>
                </div>

                <!-- Attendance Overview -->
                <div style="background: var(--bg-surface-elevated); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); margin-bottom: 16px;">
                    <h4 style="color: #ffffff; margin-bottom: 8px; display: flex; justify-content: space-between;">
                        <span><i class="fas fa-calendar-check" style="color: var(--primary-400);"></i> Attendance Standing</span>
                        <span style="color: var(--gold-300);">${student.attendancePct || 95}% Overall</span>
                    </h4>
                    <div style="display: flex; gap: 16px; font-size: 0.82rem; color: var(--text-secondary);">
                        <span><i class="fas fa-check-circle" style="color: var(--primary-400);"></i> On-Time Check-Ins: <strong>${presentCount}</strong></span>
                        <span><i class="fas fa-clock" style="color: var(--warning);"></i> Late Check-Ins: <strong>${lateCount}</strong></span>
                        <span><i class="fas fa-calendar-alt"></i> Total Logged Sessions: <strong>${studentAttendance.length}</strong></span>
                    </div>
                </div>

                <!-- Enrolled Kitabs / Courses -->
                <div style="background: var(--bg-surface-elevated); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                    <h4 style="color: #ffffff; margin-bottom: 8px;"><i class="fas fa-book-open" style="color: var(--gold-400);"></i> Enrolled Courses (Session 1446-1447)</h4>
                    <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.8rem;">
                        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
                            <span>Sahih al-Bukhari (HAD-801) - Qari Arshad Ubaid</span>
                            <span class="status-pill success">Mumtaz (88%)</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border-subtle);">
                            <span>Sunan al-Tirmidhi (HAD-802) - Qari Arshad Ubaid</span>
                            <span class="status-pill success">Mumtaz (85%)</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 6px 0;">
                            <span>Al-Hidayah Fiqh (FIQ-701) - Mufti Ahmadur Rahman</span>
                            <span class="status-pill gold">Jayyid Jiddan (78%)</span>
                        </div>
                    </div>
                </div>
            `;
        }

        if (footerEl) {
            footerEl.innerHTML = `
                <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
                <button class="btn btn-gold" onclick="App.closeModal(); StudentsModule.viewAttendance('${student.id}');">
                    <i class="fas fa-calendar-check"></i> View Full Attendance Log
                </button>
            `;
        }

        App.openModal();
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

    // Export Students list to CSV
    exportStudentsCSV() {
        const students = (window.LmsData.users || []).filter(u => u.role === 'STUDENT');
        let csv = "Roll No,Name,Urdu Name,Program,Class,Email,Phone,Guardian,Residence,Attendance %,Standing,Status\n";
        students.forEach(s => {
            csv += `"${s.rollNo || ''}","${s.name}","${s.urduName || ''}","${s.program || ''}","${s.classId || ''}","${s.email || ''}","${s.phone || ''}","${s.guardianName || ''}","${s.hostel || ''}","${s.attendancePct || 90}%","${s.gpa || ''}","${s.status || 'ACTIVE'}"\n`;
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
