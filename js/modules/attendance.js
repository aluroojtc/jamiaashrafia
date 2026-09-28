/**
 * JAMIA ASHRAFIA LAHORE - ATTENDANCE & DAILY CHECK-IN MODULE
 * Handles Student & Teacher Check-In/Check-Out, Duplicate Prevention,
 * Attendance History, and Super Admin Multi-Dimensional Monitoring & Analytics
 */

const AttendanceModule = {
    activeTab: 'STUDENTS', // 'STUDENTS' | 'TEACHERS' | 'SUMMARY'
    searchQuery: '',
    filterDate: new Date().toISOString().split('T')[0],
    filterClass: 'ALL',
    filterStatus: 'ALL',

    // Helper: format today's date in YYYY-MM-DD
    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    },

    // Check if user has already checked in today
    getTodayAttendance(userId) {
        const today = this.getTodayDate();
        const records = window.LmsData.attendance || [];
        return records.find(r => r.userId === userId && r.date === today) || null;
    },

    // Perform Check-In with duplicate check
    async performCheckIn(userId) {
        const today = this.getTodayDate();
        const existing = this.getTodayAttendance(userId);

        if (existing) {
            App.showToast(`Already checked in today at ${existing.checkInTime}. Duplicate check-in prevented.`, "warning");
            return;
        }

        const user = window.LmsData.users.find(u => u.id === userId) || window.AuthRBAC.currentUser;
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const hours = now.getHours();
        const minutes = now.getMinutes();

        // Late threshold: after 08:30 AM is marked LATE
        const isLate = (hours > 8 || (hours === 8 && minutes > 30));
        const status = isLate ? "LATE" : "PRESENT";

        const newRecord = {
            id: "att_" + Date.now(),
            userId: user.id,
            userName: user.name,
            role: user.role,
            identifier: user.rollNo || user.email || user.id,
            classId: user.classId || "cls_dawra_a",
            className: user.program || (user.role === 'TEACHER' ? "Faculty Dars" : "General Studies"),
            date: today,
            checkInTime: timeStr,
            checkOutTime: null,
            status: status,
            session: "DAILY_ACADEMIC",
            notes: isLate ? "Late arrival check-in" : "On-time arrival check-in",
            createdAt: now.toISOString()
        };

        if (!window.LmsData.attendance) window.LmsData.attendance = [];
        window.LmsData.attendance.unshift(newRecord);
        window.DataStore.save(window.LmsData);

        // Sync with backend API
        try {
            await fetch('/api/attendance/checkin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Role': user.role,
                    'X-User-Id': user.id
                },
                body: JSON.stringify(newRecord)
            });
        } catch (e) {
            console.warn("Backend attendance sync offline, saved locally.");
        }

        App.playChime();
        App.showToast(`Check-In recorded successfully: ${status} at ${timeStr}`, isLate ? "warning" : "success");

        // Re-render current view or dashboard
        if (App.currentRoute === 'dashboard') {
            App.navigate('dashboard');
        } else if (App.currentRoute === 'attendance') {
            const viewport = document.getElementById('main-content-viewport');
            if (viewport) viewport.innerHTML = this.render();
        }
    },

    // Perform Check-Out
    async performCheckOut(userId) {
        const today = this.getTodayDate();
        const record = (window.LmsData.attendance || []).find(r => r.userId === userId && r.date === today);

        if (!record) {
            App.showToast("Cannot check out before checking in.", "error");
            return;
        }

        if (record.checkOutTime) {
            App.showToast(`Already checked out at ${record.checkOutTime}.`, "info");
            return;
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        record.checkOutTime = timeStr;
        record.updatedAt = now.toISOString();

        window.DataStore.save(window.LmsData);

        // Sync with backend API
        try {
            await fetch('/api/attendance/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Role': record.role,
                    'X-User-Id': record.userId
                },
                body: JSON.stringify({ userId: record.userId, date: today, checkOutTime: timeStr })
            });
        } catch (e) {
            console.warn("Backend checkout sync offline, saved locally.");
        }

        App.showToast(`Check-Out recorded successfully at ${timeStr}. Fee Amanillah!`, "gold");

        if (App.currentRoute === 'dashboard') {
            App.navigate('dashboard');
        } else if (App.currentRoute === 'attendance') {
            const viewport = document.getElementById('main-content-viewport');
            if (viewport) viewport.innerHTML = this.render();
        }
    },

    // RENDER: Check-In Dashboard Card for Students and Teachers
    renderDashboardCheckInWidget(user) {
        const today = this.getTodayDate();
        const record = this.getTodayAttendance(user.id);
        const isCheckedIn = !!record;
        const isCheckedOut = isCheckedIn && !!record.checkOutTime;

        return `
            <div class="card checkin-widget-card" style="border: 2px solid ${isCheckedIn ? 'var(--primary-500)' : 'var(--gold-400)'}; background: linear-gradient(135deg, rgba(6, 78, 59, 0.35) 0%, rgba(15, 23, 42, 0.8) 100%);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="status-pill ${isCheckedIn ? (record.status === 'LATE' ? 'warning' : 'success') : 'danger'}" style="font-size: 0.75rem;">
                                <i class="fas ${isCheckedIn ? 'fa-check-circle' : 'fa-clock'}"></i>
                                ${isCheckedIn ? `Checked In: ${record.status}` : 'Not Checked In Yet'}
                            </span>
                            <span style="font-size: 0.82rem; color: var(--text-muted);"><i class="fas fa-calendar-day"></i> Today: ${today} (1446 AH)</span>
                        </div>
                        <h3 style="font-size: 1.15rem; color: #ffffff; margin-top: 6px;">
                            ${isCheckedIn ? `Marked Present at ${record.checkInTime}` : 'Daily Attendance Check-In Required'}
                        </h3>
                        <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">
                            ${isCheckedIn ? (
                                isCheckedOut ? 
                                `<span style="color: var(--gold-300);"><i class="fas fa-sign-out-alt"></i> Checked Out at ${record.checkOutTime}</span>` : 
                                `<span>Active Session: In Campus (${record.session || 'Academic Dars'})</span>`
                            ) : (
                                `Attendance is not marked on login. Please click Check In to record your attendance.`
                            )}
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; align-items: center;">
                        ${!isCheckedIn ? `
                            <button class="btn btn-gold" onclick="AttendanceModule.performCheckIn('${user.id}')" style="box-shadow: 0 4px 14px rgba(217, 119, 6, 0.4); padding: 10px 20px;">
                                <i class="fas fa-sign-in-alt"></i> Check In Now
                            </button>
                        ` : (
                            !isCheckedOut ? `
                                <button class="btn btn-secondary btn-sm" onclick="AttendanceModule.performCheckOut('${user.id}')" title="Record departure check-out">
                                    <i class="fas fa-sign-out-alt"></i> Check Out
                                </button>
                                <span class="status-pill success"><i class="fas fa-check"></i> Recorded</span>
                            ` : `
                                <span class="status-pill info"><i class="fas fa-door-closed"></i> Checked Out</span>
                            `
                        )}
                    </div>
                </div>
            </div>
        `;
    },

    // RENDER: Full Attendance Monitoring Screen (Super Admin & Teacher)
    render() {
        const user = window.AuthRBAC.currentUser;
        const role = window.AuthRBAC.getRole();

        // RBAC: Students only see their own attendance history
        if (role === 'STUDENT') {
            return this.renderStudentPersonalAttendance(user);
        }

        const records = window.LmsData.attendance || [];
        const today = this.getTodayDate();

        // Filter records by tab
        let filtered = records.filter(r => {
            if (this.activeTab === 'STUDENTS') return r.role === 'STUDENT';
            if (this.activeTab === 'TEACHERS') return r.role === 'TEACHER';
            return true; // SUMMARY
        });

        // Apply Search
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(r => 
                r.userName.toLowerCase().includes(q) || 
                (r.identifier && r.identifier.toLowerCase().includes(q))
            );
        }

        // Apply Date Filter
        if (this.filterDate && this.filterDate !== 'ALL') {
            filtered = filtered.filter(r => r.date === this.filterDate);
        }

        // Apply Status Filter
        if (this.filterStatus && this.filterStatus !== 'ALL') {
            filtered = filtered.filter(r => r.status === this.filterStatus);
        }

        // Compute metrics
        const totalStudents = (window.LmsData.users || []).filter(u => u.role === 'STUDENT').length;
        const totalTeachers = (window.LmsData.users || []).filter(u => u.role === 'TEACHER').length;
        const todayRecords = records.filter(r => r.date === today);
        const presentToday = todayRecords.filter(r => r.status === 'PRESENT').length;
        const lateToday = todayRecords.filter(r => r.status === 'LATE').length;
        const absentToday = todayRecords.filter(r => r.status === 'ABSENT').length;

        return `
            <!-- HEADER -->
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-calendar-check" style="color: var(--gold-400);"></i>
                        Institutional Attendance & Daily Check-In Monitoring
                    </h1>
                    <p>Live attendance logs, check-in timestamps, punctuality metrics, and absence tracking across Jamia Ashrafia</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-secondary btn-sm" onclick="AttendanceModule.exportAttendanceCSV()">
                        <i class="fas fa-file-csv"></i> Export Attendance CSV
                    </button>
                    <button class="btn btn-gold btn-sm" onclick="window.print()">
                        <i class="fas fa-print"></i> Print Official Sheet
                    </button>
                </div>
            </div>

            <!-- KPI METRICS GRID -->
            <div class="metrics-grid">
                <div class="metric-card gold">
                    <div class="metric-icon-box"><i class="fas fa-user-check"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Present Today</span>
                        <span class="metric-value">${presentToday}</span>
                        <span class="metric-hint" style="color: var(--gold-300);">On-Time Arrival</span>
                    </div>
                </div>
                <div class="metric-card warning">
                    <div class="metric-icon-box"><i class="fas fa-user-clock"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Late Check-Ins</span>
                        <span class="metric-value">${lateToday}</span>
                        <span class="metric-hint">After 08:30 AM</span>
                    </div>
                </div>
                <div class="metric-card danger">
                    <div class="metric-icon-box"><i class="fas fa-user-times"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Recorded Absentees</span>
                        <span class="metric-value">${absentToday}</span>
                        <span class="metric-hint">Leave or Unexcused</span>
                    </div>
                </div>
                <div class="metric-card info">
                    <div class="metric-icon-box"><i class="fas fa-users"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Institutional Roster</span>
                        <span class="metric-value">${totalStudents} Talaba • ${totalTeachers} Asatizah</span>
                        <span class="metric-hint">Ferozepur Rd Campus</span>
                    </div>
                </div>
            </div>

            <!-- TABS & CONTROLS -->
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
                    <div class="role-tabs-container" style="display: flex; gap: 8px;">
                        <button class="btn ${this.activeTab === 'STUDENTS' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="AttendanceModule.setTab('STUDENTS')">
                            <i class="fas fa-user-graduate"></i> Student Attendance
                        </button>
                        <button class="btn ${this.activeTab === 'TEACHERS' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="AttendanceModule.setTab('TEACHERS')">
                            <i class="fas fa-chalkboard-teacher"></i> Teacher Attendance
                        </button>
                        <button class="btn ${this.activeTab === 'SUMMARY' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="AttendanceModule.setTab('SUMMARY')">
                            <i class="fas fa-chart-pie"></i> Combined Log
                        </button>
                    </div>

                    <!-- Filter Controls -->
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <div class="search-input-wrap" style="width: 220px;">
                            <i class="fas fa-search"></i>
                            <input type="text" class="form-control" placeholder="Search name or ID..." value="${this.searchQuery}" oninput="AttendanceModule.setSearch(this.value)" style="padding: 6px 12px 6px 36px; font-size: 0.82rem;">
                        </div>

                        <div>
                            <input type="date" class="form-control" value="${this.filterDate}" onchange="AttendanceModule.setDate(this.value)" style="padding: 6px 10px; font-size: 0.82rem;">
                        </div>

                        <div>
                            <select class="form-control" onchange="AttendanceModule.setStatus(this.value)" style="padding: 6px 10px; font-size: 0.82rem;">
                                <option value="ALL" ${this.filterStatus === 'ALL' ? 'selected' : ''}>All Statuses</option>
                                <option value="PRESENT" ${this.filterStatus === 'PRESENT' ? 'selected' : ''}>Present</option>
                                <option value="LATE" ${this.filterStatus === 'LATE' ? 'selected' : ''}>Late</option>
                                <option value="ABSENT" ${this.filterStatus === 'ABSENT' ? 'selected' : ''}>Absent</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- ATTENDANCE DATA TABLE -->
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Name / Scholar</th>
                                <th>Role & ID</th>
                                <th>Class / Department</th>
                                <th>Date</th>
                                <th>Check-In Time</th>
                                <th>Check-Out Time</th>
                                <th>Status</th>
                                <th>Session & Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.length > 0 ? filtered.map(r => `
                                <tr>
                                    <td>
                                        <div style="font-weight: 700; color: #ffffff;">${r.userName}</div>
                                    </td>
                                    <td>
                                        <span class="status-pill ${r.role === 'TEACHER' ? 'success' : 'primary'}" style="font-size: 0.72rem;">${r.role}</span>
                                        <span style="font-size: 0.78rem; color: var(--text-muted); margin-left: 4px;">${r.identifier || 'N/A'}</span>
                                    </td>
                                    <td style="color: var(--text-secondary); font-size: 0.82rem;">
                                        ${r.className || 'General'}
                                    </td>
                                    <td style="font-size: 0.82rem; color: #ffffff;">
                                        ${r.date}
                                    </td>
                                    <td>
                                        <strong style="color: ${r.status === 'LATE' ? 'var(--warning)' : 'var(--primary-300)'};">${r.checkInTime || '—'}</strong>
                                    </td>
                                    <td>
                                        <span style="color: var(--text-muted); font-size: 0.82rem;">${r.checkOutTime || 'In Session'}</span>
                                    </td>
                                    <td>
                                        <span class="status-pill ${r.status === 'PRESENT' ? 'success' : (r.status === 'LATE' ? 'warning' : 'danger')}">
                                            <i class="fas ${r.status === 'PRESENT' ? 'fa-check' : (r.status === 'LATE' ? 'fa-clock' : 'fa-times')}"></i>
                                            ${r.status}
                                        </span>
                                    </td>
                                    <td style="font-size: 0.78rem; color: var(--text-muted);">
                                        <div>${r.session || 'DAILY'}</div>
                                        <div style="font-style: italic;">${r.notes || ''}</div>
                                    </td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="8" style="text-align: center; padding: 36px; color: var(--text-muted);">
                                        <i class="fas fa-calendar-times" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 8px;"></i>
                                        <div>No attendance logs found matching the selected filters.</div>
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    // RENDER: Student's Personal Attendance History & Summary
    renderStudentPersonalAttendance(user) {
        const records = (window.LmsData.attendance || []).filter(r => r.userId === user.id);
        const presentCount = records.filter(r => r.status === 'PRESENT').length;
        const lateCount = records.filter(r => r.status === 'LATE').length;
        const absentCount = records.filter(r => r.status === 'ABSENT').length;
        const total = records.length || 1;
        const pct = Math.round(((presentCount + (lateCount * 0.75)) / total) * 100);

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-calendar-check" style="color: var(--gold-400);"></i>
                        My Attendance Record & History
                    </h1>
                    <p>Talib-e-Ilm: <strong>${user.name}</strong> • Roll No: <strong>${user.rollNo || 'ASH-2024-001'}</strong></p>
                </div>
            </div>

            <!-- CHECK-IN WIDGET -->
            ${this.renderDashboardCheckInWidget(user)}

            <!-- STATS -->
            <div class="metrics-grid">
                <div class="metric-card gold">
                    <div class="metric-icon-box"><i class="fas fa-percentage"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Attendance Percentage</span>
                        <span class="metric-value">${pct}%</span>
                        <span class="metric-hint" style="color: var(--gold-300);">Wifaq Eligibility Met</span>
                    </div>
                </div>
                <div class="metric-card success">
                    <div class="metric-icon-box"><i class="fas fa-check-circle"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Days Present</span>
                        <span class="metric-value">${presentCount} Days</span>
                        <span class="metric-hint">On-Time Dars</span>
                    </div>
                </div>
                <div class="metric-card warning">
                    <div class="metric-icon-box"><i class="fas fa-clock"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Late Arrivals</span>
                        <span class="metric-value">${lateCount} Days</span>
                        <span class="metric-hint">Hostel Logged</span>
                    </div>
                </div>
                <div class="metric-card danger">
                    <div class="metric-icon-box"><i class="fas fa-times-circle"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Absences</span>
                        <span class="metric-value">${absentCount} Days</span>
                        <span class="metric-hint">Medical / Permitted</span>
                    </div>
                </div>
            </div>

            <!-- RECENT LOG -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-history"></i> My Attendance History</h3>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Check-In Time</th>
                                <th>Check-Out Time</th>
                                <th>Status</th>
                                <th>Session</th>
                                <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${records.map(r => `
                                <tr>
                                    <td><strong>${r.date}</strong></td>
                                    <td style="color: var(--primary-300);">${r.checkInTime || '—'}</td>
                                    <td style="color: var(--text-muted);">${r.checkOutTime || '—'}</td>
                                    <td>
                                        <span class="status-pill ${r.status === 'PRESENT' ? 'success' : (r.status === 'LATE' ? 'warning' : 'danger')}">
                                            ${r.status}
                                        </span>
                                    </td>
                                    <td>${r.session || 'DAILY'}</td>
                                    <td style="color: var(--text-muted); font-size: 0.8rem;">${r.notes || 'Routine check-in'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    setTab(tab) {
        this.activeTab = tab;
        const viewport = document.getElementById('main-content-viewport');
        if (viewport) viewport.innerHTML = this.render();
    },

    setSearch(q) {
        this.searchQuery = q;
        const viewport = document.getElementById('main-content-viewport');
        if (viewport) viewport.innerHTML = this.render();
    },

    setDate(d) {
        this.filterDate = d;
        const viewport = document.getElementById('main-content-viewport');
        if (viewport) viewport.innerHTML = this.render();
    },

    setStatus(s) {
        this.filterStatus = s;
        const viewport = document.getElementById('main-content-viewport');
        if (viewport) viewport.innerHTML = this.render();
    },

    // Export Attendance to CSV File
    exportAttendanceCSV() {
        const records = window.LmsData.attendance || [];
        if (records.length === 0) {
            App.showToast("No attendance records to export.", "warning");
            return;
        }

        let csv = "ID,User Name,Role,Identifier,Class,Date,Check-In Time,Check-Out Time,Status,Session,Notes\n";
        records.forEach(r => {
            csv += `"${r.id}","${r.userName}","${r.role}","${r.identifier || ''}","${r.className || ''}","${r.date}","${r.checkInTime || ''}","${r.checkOutTime || ''}","${r.status}","${r.session || ''}","${r.notes || ''}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Jamia_Ashrafia_Attendance_${this.getTodayDate()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        App.showToast("Attendance CSV report successfully exported!", "gold");
    }
};

window.AttendanceModule = AttendanceModule;
