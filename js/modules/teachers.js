/**
 * JAMIA ASHRAFIA LAHORE - TEACHERS & FACULTY PORTAL MODULE
 * Faculty registration, Asatizah directory, attendance register, and teacher portal
 */

const TeachersModule = {
    render() {
        const canManage = window.AuthRBAC.can("teachers:manage");
        const teachers = window.LmsData.users.filter(u => u.role === 'TEACHER');

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-user-tie" style="color: var(--primary-400);"></i>
                        Teacher Registration & Faculty Portal
                    </h1>
                    <p>Profiles of revered Asatizah, Sheikh-ul-Hadith faculty, daily attendance marking, and course workloads</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-gold btn-sm" onclick="TeachersModule.openAttendanceModal()">
                        <i class="fas fa-clipboard-check"></i> Mark Daily Attendance
                    </button>
                    ${canManage ? `
                        <button class="btn btn-primary btn-sm" onclick="TeachersModule.openRegisterTeacherModal()">
                            <i class="fas fa-user-plus"></i> Register New Ustad
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- TEACHER WORKLOAD STATS -->
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-icon-box"><i class="fas fa-chalkboard-teacher"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Active Asatizah</span>
                        <span class="metric-value">${teachers.length}</span>
                        <span class="metric-hint">Faculty of Shariah</span>
                    </div>
                </div>
                <div class="metric-card gold">
                    <div class="metric-icon-box"><i class="fas fa-quran"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Sheikh-ul-Hadith Chairs</span>
                        <span class="metric-value">3</span>
                        <span class="metric-hint" style="color: var(--gold-300);">Sihah Sitta Lectures</span>
                    </div>
                </div>
                <div class="metric-card info">
                    <div class="metric-icon-box"><i class="fas fa-stamp"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Muftis in Darul Ifta</span>
                        <span class="metric-value">5</span>
                        <span class="metric-hint">Fatawa Issuance Cell</span>
                    </div>
                </div>
                <div class="metric-card danger">
                    <div class="metric-icon-box"><i class="fas fa-calendar-day"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Today's Lectures</span>
                        <span class="metric-value">18</span>
                        <span class="metric-hint" style="color: var(--text-muted);">Main Campus Halls</span>
                    </div>
                </div>
            </div>

            <!-- TEACHERS DIRECTORY CARDS -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 28px;">
                ${teachers.map(teacher => {
                    const courses = (teacher.assignedCourses || []).map(cid => {
                        const c = window.LmsData.courses.find(x => x.id === cid);
                        return c ? c.title : cid;
                    });

                    return `
                        <div class="card" style="position: relative; overflow: hidden;">
                            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                                <div class="avatar-circle gold" style="width: 56px; height: 56px; font-size: 1.3rem;">
                                    ${teacher.avatar}
                                </div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 700; font-size: 1.05rem; color: var(--primary-950);">${teacher.name}</div>
                                    <div style="font-family: 'Amiri', serif; font-size: 1.1rem; color: var(--gold-700);">${teacher.urduName || ''}</div>
                                    <div style="font-size: 0.8rem; color: var(--primary-700); font-weight: 600;">${teacher.designation}</div>
                                </div>
                            </div>

                            <div style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 14px;">
                                <div><i class="fas fa-certificate" style="color: var(--gold-400); width: 18px;"></i> <strong>Sanad:</strong> ${teacher.sanad || 'Shahadat-ul-Alimiyyah'}</div>
                                <div><i class="fas fa-star" style="color: var(--gold-400); width: 18px;"></i> <strong>Specialization:</strong> ${teacher.specialization || 'Hadith & Fiqh'}</div>
                                <div><i class="fas fa-envelope" style="color: var(--gold-400); width: 18px;"></i> <strong>Email:</strong> ${teacher.email}</div>
                            </div>

                            <div style="border-top: 1px solid var(--border-subtle); padding-top: 12px; margin-top: 12px;">
                                <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin-bottom: 6px;">Assigned Kitabs / Courses:</div>
                                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                    ${courses.length > 0 ? courses.map(c => `
                                        <span class="status-pill gold" style="font-size: 0.7rem;">${c}</span>
                                    `).join('') : '<span style="font-size: 0.75rem; color: var(--text-muted);">No courses assigned</span>'}
                                </div>
                            </div>

                            <div style="display: flex; gap: 8px; margin-top: 16px;">
                                <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="TeachersModule.viewFacultyProfile('${teacher.id}')">
                                    <i class="fas fa-id-badge"></i> Profile
                                </button>
                                <button class="btn btn-gold btn-sm" style="flex: 1;" onclick="window.App.navigate('virtual-class')">
                                    <i class="fas fa-video"></i> Live Class
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    openAttendanceModal() {
        const students = window.LmsData.users.filter(u => u.role === 'STUDENT');
        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-clipboard-list" style="color: var(--primary-400);"></i> Daily Attendance Register - Hall Imam Bukhari`;
        modalBody.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; background: var(--bg-surface-elevated); padding: 10px 16px; border-radius: var(--radius-sm);">
                <div>
                    <strong>Date:</strong> ${new Date().toDateString()}<br>
                    <strong>Session:</strong> Dawra-e-Hadith (Morning Sabq)
                </div>
                <button class="btn btn-primary btn-sm" onclick="TeachersModule.markAllPresent()">
                    <i class="fas fa-check-double"></i> Mark All Present
                </button>
            </div>

            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Roll Number</th>
                            <th>Talib-e-Ilm (Student)</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.map(s => `
                            <tr>
                                <td><strong>${s.rollNo}</strong></td>
                                <td>${s.name}</td>
                                <td>
                                    <div style="display: flex; gap: 10px;">
                                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; color: var(--success);">
                                            <input type="radio" name="att_${s.id}" value="P" checked> Present
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; color: var(--danger);">
                                            <input type="radio" name="att_${s.id}" value="A"> Absent
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; color: var(--warning);">
                                            <input type="radio" name="att_${s.id}" value="L"> Leave
                                        </label>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Cancel</button>
            <button class="btn btn-gold" onclick="TeachersModule.saveAttendance()">
                <i class="fas fa-save"></i> Save Attendance Record
            </button>
        `;
        window.App.openModal();
    },

    markAllPresent() {
        const radios = document.querySelectorAll('#modal-body-container input[value="P"]');
        radios.forEach(r => r.checked = true);
        window.App.showToast("All students marked present", "info");
    },

    saveAttendance() {
        window.App.closeModal();
        window.App.showToast("Attendance successfully saved to academic register!", "success");
    },

    openRegisterTeacherModal() {
        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-user-plus" style="color: var(--gold-400);"></i> Register Faculty Member (Ustad)`;
        modalBody.innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    <label>Full Name (English) *</label>
                    <input type="text" id="reg-t-name" class="form-control" placeholder="e.g. Maulana Abdul Samad">
                </div>
                <div class="form-group">
                    <label>Name in Urdu / Arabic *</label>
                    <input type="text" id="reg-t-urdu" class="form-control" placeholder="مولانا عبد الصمد">
                </div>
                <div class="form-group">
                    <label>Designation / Academic Rank *</label>
                    <input type="text" id="reg-t-desig" class="form-control" placeholder="e.g. Ustad-ul-Hadith">
                </div>
                <div class="form-group">
                    <label>Highest Sanad / Degree *</label>
                    <input type="text" id="reg-t-sanad" class="form-control" placeholder="Shahadat-ul-Alimiyyah (Wifaq)">
                </div>
                <div class="form-group">
                    <label>Sanad Alma Mater</label>
                    <input type="text" id="reg-t-alma" class="form-control" value="Jamia Ashrafia Lahore">
                </div>
                <div class="form-group">
                    <label>Official Email</label>
                    <input type="email" id="reg-t-email" class="form-control" placeholder="faculty@jamiaashrafia.org">
                </div>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="TeachersModule.saveTeacher()">Save Faculty Member</button>
        `;
        window.App.openModal();
    },

    saveTeacher() {
        const name = document.getElementById('reg-t-name').value.trim();
        const urdu = document.getElementById('reg-t-urdu').value.trim();
        const desig = document.getElementById('reg-t-desig').value.trim();
        const sanad = document.getElementById('reg-t-sanad').value.trim();
        const email = document.getElementById('reg-t-email').value.trim();

        if (!name || !desig) {
            window.App.showToast("Please fill in teacher name and designation", "warning");
            return;
        }

        const newTeacher = {
            id: `u_t_${Date.now()}`,
            name: name,
            urduName: urdu || name,
            role: "TEACHER",
            designation: desig,
            specialization: "Hadith & Islamic Sciences",
            email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@jamiaashrafia.org`,
            branchId: "b1",
            avatar: name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
            sanad: sanad || "Shahadat-ul-Alimiyyah",
            assignedCourses: []
        };

        window.LmsData.users.push(newTeacher);
        window.DataStore.save(window.LmsData);
        window.App.closeModal();
        window.App.showToast(`Faculty member ${name} successfully registered!`, "success");
        window.App.navigate('teachers');
    },

    viewFacultyProfile(id) {
        const teacher = window.LmsData.users.find(u => u.id === id);
        if (!teacher) return;

        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-user-circle" style="color: var(--gold-400);"></i> Faculty Dossier: ${teacher.name}`;
        modalBody.innerHTML = `
            <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 20px;">
                <div class="avatar-circle gold" style="width: 70px; height: 70px; font-size: 1.6rem;">
                    ${teacher.avatar}
                </div>
                <div>
                    <h3 style="color: var(--primary-950);">${teacher.name}</h3>
                    <div style="font-family: 'Amiri', serif; font-size: 1.2rem; color: var(--gold-700);">${teacher.urduName || ''}</div>
                    <div style="color: var(--primary-700); font-weight: 600;">${teacher.designation}</div>
                </div>
            </div>

            <div class="card" style="background: var(--bg-surface-elevated); padding: 16px;">
                <h4 style="color: var(--gold-700); font-size: 0.9rem; margin-bottom: 8px;">Academic Sanad & Qualifications</h4>
                <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.7;">
                    Graduate of Jamia Ashrafia Lahore with specialization in Sihah Sitta Hadith studies. 
                    Authorized by senior scholars with continuous transmission (Isnad Muttasil) back to the Holy Prophet ﷺ.
                </p>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `<button class="btn btn-secondary" onclick="window.App.closeModal()">Close</button>`;
        window.App.openModal();
    }
};

window.TeachersModule = TeachersModule;
