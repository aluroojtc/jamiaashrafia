/**
 * JAMIA ASHRAFIA LAHORE - TEACHERS: ADMIN REGISTRATION & TEACHER PORTAL
 * Only administrators register teachers (portal login) and view workloads;
 * teachers manage their profile, password and daily class attendance.
 */

const TeachersModule = {
    canManage() {
        return window.AuthRBAC.can('teachers:manage') || window.AuthRBAC.isAdmin();
    },

    workload(teacherId) {
        const classIds = Lms.teacherClassIds(teacherId);
        const periods = (window.LmsData.timetables || []).filter(t => t.teacherId === teacherId);
        const minutes = periods.reduce((s, t) => {
            const [h1, m1] = String(t.startTime).split(':').map(Number);
            const [h2, m2] = String(t.endTime).split(':').map(Number);
            return s + Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1));
        }, 0);
        const asgIds = new Set((window.LmsData.assignments || []).filter(a => a.teacherId === teacherId).map(a => a.id));
        return {
            classIds,
            courseIds: Lms.teacherCourseIds(teacherId),
            students: Lms.students().filter(s => classIds.includes(s.classId)).length,
            periodsPerWeek: periods.length,
            hoursPerWeek: Math.round(minutes / 6) / 10,
            toCheck: (window.LmsData.assignmentSubmissions || []).filter(s => asgIds.has(s.assignmentId) && !s.isGraded && !s.resubmitRequested).length
        };
    },

    render() {
        const canManage = this.canManage();
        const teachers = (window.LmsData.users || []).filter(u => u.role === 'TEACHER');

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1><i class="fas fa-user-tie" style="color: var(--primary-400);"></i> Teachers — Registration & Faculty Portal</h1>
                    <p>Faculty directory, teaching workload and teacher portal accounts (registered by administrators)</p>
                </div>
                <div class="view-actions">
                    ${Lms.role() === 'TEACHER' ? `<button class="btn btn-secondary btn-sm" onclick="TeachersModule.openMyProfileModal()"><i class="fas fa-user-edit"></i> My Profile</button>` : ''}
                    ${Lms.role() === 'TEACHER' || canManage ? `<button class="btn btn-gold btn-sm" onclick="TeachersModule.openAttendanceModal()"><i class="fas fa-clipboard-check"></i> Mark Class Attendance</button>` : ''}
                    ${canManage ? `<button class="btn btn-primary btn-sm" onclick="TeachersModule.openRegisterTeacherModal()"><i class="fas fa-user-plus"></i> Register New Teacher</button>` : ''}
                </div>
            </div>

            <div class="metrics-grid">
                <div class="metric-card"><div class="metric-icon-box"><i class="fas fa-chalkboard-teacher"></i></div><div class="metric-content">
                    <span class="metric-label">Active Teachers</span><span class="metric-value">${teachers.filter(t => t.status !== 'INACTIVE').length}</span>
                    <span class="metric-hint">${teachers.filter(t => t.status === 'INACTIVE').length} inactive</span></div></div>
                <div class="metric-card gold"><div class="metric-icon-box"><i class="fas fa-book"></i></div><div class="metric-content">
                    <span class="metric-label">Kitab Allocations</span><span class="metric-value">${(window.LmsData.classes || []).reduce((s, c) => s + (c.courseTeachers || []).filter(ct => ct.teacherId).length, 0)}</span>
                    <span class="metric-hint">${(window.LmsData.classes || []).reduce((s, c) => s + (c.courseTeachers || []).filter(ct => !ct.teacherId).length, 0)} without a teacher</span></div></div>
                <div class="metric-card info"><div class="metric-icon-box"><i class="fas fa-calendar-day"></i></div><div class="metric-content">
                    <span class="metric-label">Teaching Periods / Week</span><span class="metric-value">${(window.LmsData.timetables || []).filter(t => t.teacherId).length}</span>
                    <span class="metric-hint">From the timetable</span></div></div>
            </div>

            ${this.renderDirectory(teachers)}
        `;
    },

    renderDirectory(teachers) {
        const canManage = this.canManage();
        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
                ${teachers.length ? teachers.map(t => {
                    const w = this.workload(t.id);
                    return `
                        <div class="card" style="margin: 0; ${t.status === 'INACTIVE' ? 'opacity: 0.65;' : ''}">
                            <div style="display: flex; gap: 14px; margin-bottom: 14px;">
                                <div class="avatar-circle gold" style="width: 54px; height: 54px; font-size: 1.2rem; flex-shrink: 0;">${Lms.esc(t.avatar || Lms.initials(t.name))}</div>
                                <div style="min-width: 0;">
                                    <div style="font-weight: 700; font-size: 1.02rem; color: var(--primary-950);">${Lms.esc(t.name)}</div>
                                    <div style="font-family: 'Amiri', serif; font-size: 1.05rem; color: var(--gold-700);">${Lms.esc(t.urduName || '')}</div>
                                    <div style="font-size: 0.8rem; color: var(--primary-700); font-weight: 600;">${Lms.esc(t.designation || 'Teacher')}</div>
                                    ${t.status === 'INACTIVE' ? '<span class="status-pill danger" style="font-size: 0.65rem;">Inactive</span>' : ''}
                                </div>
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.7;">
                                <div><i class="fas fa-certificate" style="color: var(--gold-400); width: 18px;"></i> ${Lms.esc(t.sanad || '—')}</div>
                                <div><i class="fas fa-star" style="color: var(--gold-400); width: 18px;"></i> ${Lms.esc(t.specialization || '—')}</div>
                                <div><i class="fas fa-envelope" style="color: var(--gold-400); width: 18px;"></i> ${Lms.esc(t.email || '—')}</div>
                            </div>
                            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin: 12px 0;">
                                <span class="status-pill info">${w.classIds.length} class(es)</span>
                                <span class="status-pill gold">${w.courseIds.length} kitab(s)</span>
                                <span class="status-pill success">${w.hoursPerWeek} hrs/week</span>
                                ${w.toCheck ? `<span class="status-pill warning">${w.toCheck} to check</span>` : ''}
                            </div>
                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="TeachersModule.viewFacultyProfile('${t.id}')"><i class="fas fa-id-badge"></i> Profile</button>
                                ${canManage ? `
                                    <button class="btn btn-secondary btn-sm" title="Edit" onclick="TeachersModule.openRegisterTeacherModal('${t.id}')"><i class="fas fa-edit"></i></button>
                                    <button class="btn btn-secondary btn-sm" title="Reset password" onclick="TeachersModule.resetPassword('${t.id}')"><i class="fas fa-key"></i></button>
                                    <button class="btn btn-secondary btn-sm" title="${t.status === 'INACTIVE' ? 'Activate' : 'Deactivate'}" onclick="TeachersModule.toggleStatus('${t.id}')"><i class="fas ${t.status === 'INACTIVE' ? 'fa-user-check' : 'fa-user-slash'}"></i></button>` : ''}
                            </div>
                        </div>`;
                }).join('') : `<div class="card" style="grid-column: 1 / -1;">${window.App.dashEmpty('No teachers registered yet.')}</div>`}
            </div>
        `;
    },

    // ---------------------------------------------------------------------
    // REGISTER / EDIT TEACHER (creates the teacher's portal login)
    // ---------------------------------------------------------------------
    openRegisterTeacherModal(teacherId) {
        if (!this.canManage()) return;
        const t = teacherId ? Lms.user(teacherId) : null;
        const d = t || {};
        const branches = ((window.LmsData.institution || {}).branches || []);
        Lms.openModal(
            `<i class="fas fa-user-plus" style="color: var(--gold-400);"></i> ${t ? 'Edit Teacher' : 'Register New Teacher'}`,
            `<div class="form-grid">
                <div class="form-group"><label>Full Name *</label><input type="text" id="reg-t-name" class="form-control" value="${Lms.esc(d.name || '')}" placeholder="e.g. Maulana Abdul Samad"></div>
                <div class="form-group"><label>Name in Urdu / Arabic</label><input type="text" id="reg-t-urdu" class="form-control" dir="rtl" value="${Lms.esc(d.urduName || '')}"></div>
                <div class="form-group"><label>Designation *</label><input type="text" id="reg-t-desig" class="form-control" value="${Lms.esc(d.designation || '')}" placeholder="e.g. Ustad-ul-Hadith"></div>
                <div class="form-group"><label>Highest Sanad / Degree</label><input type="text" id="reg-t-sanad" class="form-control" value="${Lms.esc(d.sanad || d.qualification || '')}"></div>
                <div class="form-group"><label>Specialization</label><input type="text" id="reg-t-spec" class="form-control" value="${Lms.esc(d.specialization || '')}" placeholder="Hadith, Fiqh, Tajweed..."></div>
                <div class="form-group"><label>Mobile</label><input type="tel" id="reg-t-phone" class="form-control" value="${Lms.esc(d.phone || '')}"></div>
                <div class="form-group"><label>Campus</label>
                    <select id="reg-t-branch" class="form-control">${branches.map(b => `<option value="${Lms.esc(b.id)}" ${(d.branchId || 'b1') === b.id ? 'selected' : ''}>${Lms.esc(b.name)}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>Login Email *</label><input type="email" id="reg-t-email" class="form-control" value="${Lms.esc(d.email || '')}" placeholder="name@jamiaashrafia.org"></div>
                ${t ? '' : `<div class="form-group"><label>Initial Password *</label><input type="text" id="reg-t-pwd" class="form-control" value="${Lms.esc(this.randomPassword())}"></div>`}
            </div>
            ${t ? '' : '<div style="font-size: 0.8rem; color: var(--text-muted);">The teacher signs in with this email and password. Allocate classes and kitabs in <strong>Classes & Courses</strong>.</div>'}`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-primary" onclick="TeachersModule.saveTeacher('${t ? t.id : ''}')"><i class="fas fa-save"></i> ${t ? 'Save Changes' : 'Register & Create Login'}</button>`
        );
    },

    randomPassword() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        return 'Ash-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    },

    async saveTeacher(teacherId) {
        if (!this.canManage()) return;
        const name = Lms.val('reg-t-name');
        const desig = Lms.val('reg-t-desig');
        const email = Lms.val('reg-t-email').toLowerCase();
        if (!name || !desig || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            window.App.showToast('Name, designation and a valid login email are required', 'warning');
            return;
        }
        if ((window.LmsData.users || []).some(u => u.id !== teacherId && (u.email || '').toLowerCase() === email)) {
            window.App.showToast(`${email} is already used by another account`, 'warning');
            return;
        }
        const fields = {
            name, designation: desig, email,
            urduName: Lms.val('reg-t-urdu') || name, sanad: Lms.val('reg-t-sanad'), specialization: Lms.val('reg-t-spec'),
            phone: Lms.val('reg-t-phone'), branchId: Lms.val('reg-t-branch') || 'b1'
        };
        if (teacherId) {
            Object.assign(Lms.user(teacherId), fields);
            Lms.save();
            window.App.closeModal();
            window.App.showToast('Teacher profile updated', 'success');
            window.App.navigate('teachers');
            return;
        }
        const password = Lms.val('reg-t-pwd');
        if (password.length < 6) {
            window.App.showToast('Password must be at least 6 characters', 'warning');
            return;
        }
        const teacher = {
            id: Lms.uid('u_teacher'), role: 'TEACHER', status: 'ACTIVE', ...fields, password,
            avatar: Lms.initials(name), assignedCourses: [], joinedAt: Lms.today()
        };
        window.LmsData.users.push(teacher);
        Lms.save();
        await window.DataStore.syncNow();
        Lms.notifyUser(teacher.id, 'Welcome to the Jamia Ashrafia Faculty Portal',
            'Your teacher account is active. Your classes, timetable and teaching tools appear on your dashboard once the Academic Office allocates them.', 'ACADEMIC', 'dashboard');
        Lms.openModal(
            `<i class="fas fa-check-circle" style="color: var(--success);"></i> Teacher Registered`,
            `<p style="margin-bottom: 12px;">Share these login details with <strong>${Lms.esc(name)}</strong>:</p>
             <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-prominent); border-radius: var(--radius-sm); padding: 14px; font-family: monospace; line-height: 1.9;">
                Portal: ${Lms.esc(location.origin)}/<br>Username: ${Lms.esc(email)}<br>Password: ${Lms.esc(password)}
             </div>
             <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 10px;">Next: allocate classes and kitabs in Classes & Courses.</p>`,
            `<button class="btn btn-secondary" onclick="App.closeModal(); App.navigate('teachers')">Done</button>
             <button class="btn btn-gold" onclick="App.closeModal(); App.navigate('classes')"><i class="fas fa-user-tag"></i> Allocate Classes</button>`
        );
    },

    resetPassword(teacherId) {
        const t = Lms.user(teacherId);
        if (!t) return;
        const pwd = prompt(`New password for ${t.name} (min 6 characters):`, this.randomPassword());
        if (pwd === null) return;
        if (pwd.length < 6) {
            window.App.showToast('Password must be at least 6 characters', 'warning');
            return;
        }
        t.password = pwd;
        Lms.save();
        window.App.showToast(`Password reset for ${t.name}`, 'success');
    },

    toggleStatus(teacherId) {
        const t = Lms.user(teacherId);
        if (!t) return;
        const deactivate = t.status !== 'INACTIVE';
        if (deactivate && !confirm(`Deactivate ${t.name}? They will no longer be able to sign in.`)) return;
        t.status = deactivate ? 'INACTIVE' : 'ACTIVE';
        Lms.save();
        window.App.navigate('teachers');
    },

    viewFacultyProfile(id) {
        const t = Lms.user(id);
        if (!t) return;
        const w = this.workload(t.id);
        const rows = [];
        (window.LmsData.classes || []).forEach(c => (c.courseTeachers || []).forEach(ct => { if (ct.teacherId === t.id) rows.push({ c, course: Lms.getCourse(ct.courseId) }); }));
        const classTeacherOf = (window.LmsData.classes || []).filter(c => c.teacherId === t.id);
        Lms.openModal(
            `<i class="fas fa-user-circle" style="color: var(--gold-400);"></i> ${Lms.esc(t.name)}`,
            `<div style="display: flex; gap: 18px; align-items: center; margin-bottom: 18px;">
                <div class="avatar-circle gold" style="width: 64px; height: 64px; font-size: 1.5rem;">${Lms.esc(t.avatar || Lms.initials(t.name))}</div>
                <div>
                    <div style="font-family: 'Amiri', serif; font-size: 1.2rem; color: var(--gold-700);">${Lms.esc(t.urduName || '')}</div>
                    <div style="color: var(--primary-700); font-weight: 600;">${Lms.esc(t.designation || '')}</div>
                    <div style="font-size: 0.82rem; color: var(--text-muted);">${Lms.esc(t.email || '')} ${t.phone ? '• ' + Lms.esc(t.phone) : ''}</div>
                </div>
            </div>
            <div class="form-grid" style="font-size: 0.85rem;">
                <div><strong>Sanad:</strong> ${Lms.esc(t.sanad || '—')}</div>
                <div><strong>Specialization:</strong> ${Lms.esc(t.specialization || '—')}</div>
                <div><strong>Students taught:</strong> ${w.students}</div>
                <div><strong>Workload:</strong> ${w.periodsPerWeek} periods • ${w.hoursPerWeek} hrs/week</div>
            </div>
            ${t.bio ? `<p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 14px;">${Lms.multiline(t.bio)}</p>` : ''}
            <h4 style="margin: 10px 0 8px; color: var(--primary-950);">Teaching Allocation</h4>
            ${classTeacherOf.length ? `<div style="font-size: 0.82rem; margin-bottom: 8px;"><strong>Class teacher of:</strong> ${classTeacherOf.map(c => Lms.esc(`${c.name} (${c.section || ''})`)).join(', ')}</div>` : ''}
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${rows.length ? rows.map(r => `<div style="padding: 8px 10px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm); font-size: 0.85rem;"><strong>${Lms.esc(r.course ? r.course.title : '')}</strong> — ${Lms.esc(r.c.name)} (${Lms.esc(r.c.section || '')})</div>`).join('') : '<div style="font-size: 0.82rem; color: var(--text-muted);">No kitabs allocated yet.</div>'}
            </div>`
        );
    },

    // Teacher self-service profile & password
    openMyProfileModal() {
        const me = Lms.me();
        Lms.openModal(
            `<i class="fas fa-user-edit" style="color: var(--gold-400);"></i> My Profile`,
            `<div class="form-grid">
                <div class="form-group"><label>Name in Urdu / Arabic</label><input type="text" id="mp-urdu" class="form-control" dir="rtl" value="${Lms.esc(me.urduName || '')}"></div>
                <div class="form-group"><label>Mobile</label><input type="tel" id="mp-phone" class="form-control" value="${Lms.esc(me.phone || '')}"></div>
                <div class="form-group"><label>Highest Sanad / Degree</label><input type="text" id="mp-sanad" class="form-control" value="${Lms.esc(me.sanad || '')}"></div>
                <div class="form-group"><label>Specialization</label><input type="text" id="mp-spec" class="form-control" value="${Lms.esc(me.specialization || '')}"></div>
            </div>
            <div class="form-group"><label>About / Teaching Profile</label><textarea id="mp-bio" class="form-control">${Lms.esc(me.bio || '')}</textarea></div>
            <div class="card" style="background: var(--bg-surface-elevated); padding: 14px; margin-top: 14px;">
                <h4 style="font-size: 0.9rem; margin-bottom: 8px;"><i class="fas fa-key"></i> Change Password</h4>
                <div class="form-grid" style="margin-bottom: 0;">
                    <div class="form-group"><label>New Password</label><input type="password" id="mp-pwd" class="form-control" autocomplete="new-password"></div>
                    <div class="form-group"><label>Confirm Password</label><input type="password" id="mp-pwd2" class="form-control" autocomplete="new-password"></div>
                </div>
            </div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="TeachersModule.saveMyProfile()"><i class="fas fa-save"></i> Save</button>`
        );
    },

    saveMyProfile() {
        const me = Lms.me();
        const pwd = Lms.val('mp-pwd');
        if (pwd || Lms.val('mp-pwd2')) {
            if (pwd.length < 6 || pwd !== Lms.val('mp-pwd2')) {
                window.App.showToast('Passwords must match and be at least 6 characters', 'warning');
                return;
            }
            me.password = pwd;
        }
        Object.assign(me, { urduName: Lms.val('mp-urdu'), phone: Lms.val('mp-phone'), sanad: Lms.val('mp-sanad'), specialization: Lms.val('mp-spec'), bio: document.getElementById('mp-bio').value.trim() });
        Lms.save();
        window.App.closeModal();
        window.App.showToast(pwd ? 'Profile and password updated' : 'Profile updated', 'success');
        window.App.navigate(window.App.currentRoute);
    },

    // ---------------------------------------------------------------------
    // CLASS ATTENDANCE REGISTER
    // ---------------------------------------------------------------------
    openAttendanceModal(classId, date) {
        const classIds = Lms.myClassIds();
        if (!classIds.length) {
            window.App.showToast('No classes are allocated to you yet.', 'warning');
            return;
        }
        const cid = classId && classIds.includes(classId) ? classId : classIds[0];
        const day = date || Lms.today();
        const students = Lms.studentsInClass(cid);
        const existing = (window.LmsData.attendance || []).filter(a => a.classId === cid && a.date === day && a.role === 'STUDENT');
        const statusOf = sid => {
            const r = existing.find(a => a.userId === sid);
            return r ? r.status : 'PRESENT';
        };
        Lms.openModal(
            `<i class="fas fa-clipboard-list" style="color: var(--primary-400);"></i> Class Attendance Register`,
            `<div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 14px;">
                <div class="form-group" style="flex: 1; min-width: 220px; margin: 0;"><label>Class</label>
                    <select id="att-class" class="form-control" onchange="TeachersModule.openAttendanceModal(this.value, document.getElementById('att-date').value)">${Lms.classOptions(cid, classIds)}</select>
                </div>
                <div class="form-group" style="margin: 0;"><label>Date</label>
                    <input type="date" id="att-date" class="form-control" max="${Lms.today()}" value="${Lms.esc(day)}" onchange="TeachersModule.openAttendanceModal(document.getElementById('att-class').value, this.value)">
                </div>
                <button class="btn btn-secondary btn-sm" onclick="TeachersModule.markAllPresent()"><i class="fas fa-check-double"></i> All Present</button>
            </div>
            ${existing.length ? `<div class="status-pill info" style="margin-bottom: 10px;">Attendance already saved for this day — saving again updates it.</div>` : ''}
            <div class="table-responsive">
                <table class="data-table">
                    <thead><tr><th>Roll No</th><th>Student</th><th>Status</th></tr></thead>
                    <tbody>
                        ${students.length ? students.map(s => `
                            <tr>
                                <td><strong>${Lms.esc(s.rollNo || '')}</strong></td>
                                <td>${Lms.esc(s.name)}</td>
                                <td>
                                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                                        ${[['PRESENT', 'Present', 'success'], ['LATE', 'Late', 'warning'], ['ABSENT', 'Absent', 'danger'], ['LEAVE', 'Leave', 'info']].map(([v, l, c]) => `
                                            <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; color: var(--${c});">
                                                <input type="radio" name="att_${Lms.esc(s.id)}" value="${v}" ${statusOf(s.id) === v ? 'checked' : ''}> ${l}
                                            </label>`).join('')}
                                    </div>
                                </td>
                            </tr>`).join('') : `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No students enrolled in this class.</td></tr>`}
                    </tbody>
                </table>
            </div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             ${students.length ? `<button class="btn btn-gold" onclick="TeachersModule.saveAttendance()"><i class="fas fa-save"></i> Save Attendance</button>` : ''}`,
            { wide: true }
        );
    },

    markAllPresent() {
        document.querySelectorAll('#modal-body-container input[value="PRESENT"]').forEach(r => { r.checked = true; });
    },

    saveAttendance() {
        const classId = Lms.val('att-class');
        const date = Lms.val('att-date');
        const cls = Lms.getClass(classId);
        const me = Lms.me();
        window.LmsData.attendance = window.LmsData.attendance || [];
        const absent = [];
        Lms.studentsInClass(classId).forEach(s => {
            const checked = document.querySelector(`input[name="att_${CSS.escape(s.id)}"]:checked`);
            const status = checked ? checked.value : 'PRESENT';
            let rec = window.LmsData.attendance.find(a => a.userId === s.id && a.date === date && a.classId === classId && a.session === 'CLASS_REGISTER');
            if (!rec) {
                rec = { id: Lms.uid('att'), userId: s.id, role: 'STUDENT', classId, date, session: 'CLASS_REGISTER' };
                window.LmsData.attendance.unshift(rec);
            }
            Object.assign(rec, {
                userName: s.name, identifier: s.rollNo || s.id, className: cls ? cls.name : classId, status,
                checkInTime: status === 'PRESENT' || status === 'LATE' ? (rec.checkInTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : null,
                checkOutTime: null, markedBy: me.id, notes: status === 'LEAVE' ? 'On approved leave' : `Marked by ${me.name}`
            });
            if (status === 'ABSENT') absent.push(s);
        });
        Lms.save();
        if (absent.length && date === Lms.today()) {
            Lms.notify(absent.map(s => ({ targetUserId: s.id, category: 'ACADEMIC', linkRoute: 'attendance', title: 'Marked absent today', message: `You were marked absent in ${cls ? cls.name : 'class'} on ${Lms.fmtDate(date)}. Contact your teacher if this is a mistake.` })));
        }
        window.App.closeModal();
        window.App.showToast(`Attendance saved for ${cls ? cls.name : 'class'} (${absent.length} absent)`, 'success');
        if (window.App.currentRoute === 'attendance' || window.App.currentRoute === 'dashboard') window.App.navigate(window.App.currentRoute);
    }
};

window.TeachersModule = TeachersModule;
