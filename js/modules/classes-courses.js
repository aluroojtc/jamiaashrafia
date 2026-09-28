/**
 * JAMIA ASHRAFIA LAHORE - CLASSES, COURSES & CURRICULUM ALLOCATION
 * Manages Dars-e-Nizami syllabus, Kitab credits, teacher allocation, and student sections
 */

const ClassesCoursesModule = {
    selectedClassId: "cls_dawra_a",

    render() {
        const canManage = window.AuthRBAC.can("classes:manage");
        const classes = window.LmsData.classes;
        const courses = window.LmsData.courses;

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-chalkboard-teacher" style="color: var(--gold-400);"></i>
                        Classes, Courses & Faculty Allocation
                    </h1>
                    <p>Curriculum structure, classical Dars-e-Nizami texts, lecture halls, and Asatizah course assignments</p>
                </div>
                <div class="view-actions">
                    ${canManage ? `
                        <button class="btn btn-gold btn-sm" onclick="ClassesCoursesModule.openAssignTeacherModal()">
                            <i class="fas fa-user-tag"></i> Assign Teacher to Kitab
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="ClassesCoursesModule.openAddCourseModal()">
                            <i class="fas fa-book-medical"></i> Add New Course / Kitab
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- CLASS SELECTOR CARDS -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 24px;">
                ${classes.map(cls => {
                    const isSelected = cls.id === this.selectedClassId;
                    const teacher = window.LmsData.users.find(u => u.id === cls.teacherId) || { name: "Assigned Scholar" };
                    return `
                        <div class="card" style="padding: 16px; cursor: pointer; border-color: ${isSelected ? 'var(--gold-400)' : 'var(--border-subtle)'}; background: ${isSelected ? 'rgba(6, 78, 59, 0.25)' : 'var(--bg-surface)'};" onclick="ClassesCoursesModule.selectClass('${cls.id}')">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                <span class="status-pill ${isSelected ? 'gold' : 'info'}" style="font-size: 0.65rem;">Active Class</span>
                                <span style="font-size: 0.75rem; color: var(--gold-300);"><i class="fas fa-user-friends"></i> ${cls.enrolledCount} Talaba</span>
                            </div>
                            <h4 style="font-size: 0.95rem; color: #ffffff; margin-bottom: 4px;">${cls.name}</h4>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px;">${cls.section}</div>
                            <div style="font-size: 0.78rem; color: var(--primary-400);"><i class="fas fa-chalkboard-teacher"></i> ${teacher.name}</div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- CLASS DETAILS & ALLOCATED COURSES -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
                <!-- Left: Courses / Kitabs in this Class -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="fas fa-books"></i> Prescribed Kitabs & Syllabus Breakdown
                        </h3>
                        <span class="status-pill success"><i class="fas fa-award"></i> Wifaq Standard</span>
                    </div>

                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Kitab & Code</th>
                                    <th>Classical Author</th>
                                    <th>Assigned Ustad</th>
                                    <th>Credits</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${courses.map(course => {
                                    const teacher = window.LmsData.users.find(u => u.assignedCourses?.includes(course.id)) || { name: "Sheikh Qari Arshad Ubaid" };
                                    return `
                                        <tr>
                                            <td>
                                                <div style="font-weight: 700; color: #ffffff;">${course.title}</div>
                                                <div style="font-family: 'Amiri', serif; font-size: 0.95rem; color: var(--gold-200);">${course.urduTitle}</div>
                                                <div style="font-size: 0.72rem; color: var(--text-muted);">${course.code} • Year ${course.year}</div>
                                            </td>
                                            <td>
                                                <div style="font-size: 0.82rem; color: var(--text-secondary);">${course.kitabAuthor}</div>
                                                <div style="font-size: 0.72rem; color: var(--gold-400);">${course.recommendedPub}</div>
                                            </td>
                                            <td>
                                                <div style="font-weight: 600; color: var(--primary-400);">${teacher.name}</div>
                                                <div style="font-size: 0.72rem; color: var(--text-muted);">Senior Faculty</div>
                                            </td>
                                            <td><strong>${course.credits}</strong> Hrs/Wk</td>
                                            <td>
                                                <button class="btn btn-secondary btn-sm" onclick="ClassesCoursesModule.viewSyllabusModal('${course.id}')">
                                                    <i class="fas fa-file-alt"></i> Syllabus
                                                </button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Right: Enrolled Students & Sections -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-users-class"></i> Enrolled Scholars</h3>
                        <span class="status-pill gold">${window.LmsData.users.filter(u => u.role === 'STUDENT').length} Students</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${window.LmsData.users.filter(u => u.role === 'STUDENT').map(s => `
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div class="user-avatar" style="width: 36px; height: 36px;">${s.avatar}</div>
                                    <div>
                                        <div style="font-weight: 600; font-size: 0.85rem; color: #ffffff;">${s.name}</div>
                                        <div style="font-size: 0.72rem; color: var(--gold-300);">${s.rollNo}</div>
                                    </div>
                                </div>
                                <span class="status-pill success" style="font-size: 0.65rem;">Active</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    selectClass(clsId) {
        this.selectedClassId = clsId;
        window.App.navigate('classes');
    },

    viewSyllabusModal(courseId) {
        const course = window.LmsData.courses.find(c => c.id === courseId);
        if (!course) return;

        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-book-open" style="color: var(--gold-400);"></i> Detailed Syllabus: ${course.title}`;
        modalBody.innerHTML = `
            <div style="margin-bottom: 16px;">
                <div style="font-family: 'Amiri', serif; font-size: 1.4rem; color: var(--gold-300); text-align: right;">${course.urduTitle}</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 4px;"><strong>Author:</strong> ${course.kitabAuthor}</div>
                <div style="font-size: 0.85rem; color: var(--text-muted);"><strong>Prescribed Edition:</strong> ${course.recommendedPub}</div>
            </div>

            <div class="card" style="background: var(--bg-surface-elevated); padding: 16px; margin-bottom: 14px;">
                <h4 style="color: #ffffff; font-size: 0.95rem; margin-bottom: 8px;"><i class="fas fa-list-ol"></i> Term Breakdown & Chapters</h4>
                <ul style="padding-left: 20px; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.8;">
                    <li><strong>Term 1 (Shashmahi):</strong> Hadith 1 to Hadith 350 - Kitab Bad' al-Wahy, Kitab al-Iman, Kitab al-Ilm with Asanid analysis and translation of Gharib al-Lughah.</li>
                    <li><strong>Term 2 (Salana):</strong> Kitab as-Salah, Kitab al-Jana'iz, Kitab az-Zakah - Legal deduction according to Imam Abu Hanifah and comparative study of Aimmah Arba'ah.</li>
                    <li><strong>Research Requirement:</strong> One formal Takhrij paper comparing Fath al-Bari and Umdat al-Qari.</li>
                </ul>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `<button class="btn btn-secondary" onclick="window.App.closeModal()">Close</button>`;
        window.App.openModal();
    },

    openAssignTeacherModal() {
        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-user-tag" style="color: var(--gold-400);"></i> Assign Teacher to Course`;
        modalBody.innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    <label>Select Teacher (Ustad) *</label>
                    <select id="assign-teacher" class="form-control">
                        ${window.LmsData.users.filter(u => u.role === 'TEACHER').map(t => `
                            <option value="${t.id}">${t.name} (${t.designation})</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Select Kitab / Course *</label>
                    <select id="assign-course" class="form-control">
                        ${window.LmsData.courses.map(c => `
                            <option value="${c.id}">${c.title}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Assigned Hall / Room</label>
                    <input type="text" id="assign-room" class="form-control" value="Hall Imam Bukhari">
                </div>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Cancel</button>
            <button class="btn btn-gold" onclick="ClassesCoursesModule.saveTeacherAssignment()">Confirm Assignment</button>
        `;
        window.App.openModal();
    },

    saveTeacherAssignment() {
        const teacherId = document.getElementById('assign-teacher').value;
        const courseId = document.getElementById('assign-course').value;
        const teacher = window.LmsData.users.find(u => u.id === teacherId);

        if (teacher) {
            if (!teacher.assignedCourses) teacher.assignedCourses = [];
            if (!teacher.assignedCourses.includes(courseId)) {
                teacher.assignedCourses.push(courseId);
            }
            window.DataStore.save(window.LmsData);
            window.App.closeModal();
            window.App.showToast(`Faculty allocation updated for ${teacher.name}!`, "success");
            window.App.navigate('classes');
        }
    },

    openAddCourseModal() {
        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-book-medical" style="color: var(--primary-400);"></i> Add New Course / Kitab`;
        modalBody.innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    <label>Kitab Title (English) *</label>
                    <input type="text" id="add-course-title" class="form-control" placeholder="e.g. Sunan Abi Dawud">
                </div>
                <div class="form-group">
                    <label>Kitab Title (Arabic / Urdu) *</label>
                    <input type="text" id="add-course-urdu" class="form-control" placeholder="سنن ابی داؤد">
                </div>
                <div class="form-group">
                    <label>Classical Author *</label>
                    <input type="text" id="add-course-author" class="form-control" placeholder="Imam Abu Dawud as-Sijistani">
                </div>
                <div class="form-group">
                    <label>Credit Hours Per Week</label>
                    <input type="number" id="add-course-credits" class="form-control" value="5">
                </div>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="ClassesCoursesModule.saveNewCourse()">Save Kitab to Curriculum</button>
        `;
        window.App.openModal();
    },

    saveNewCourse() {
        const title = document.getElementById('add-course-title').value.trim();
        const urdu = document.getElementById('add-course-urdu').value.trim();
        const author = document.getElementById('add-course-author').value.trim();
        const credits = parseInt(document.getElementById('add-course-credits').value) || 4;

        if (!title || !author) {
            window.App.showToast("Please provide title and author", "warning");
            return;
        }

        const newCourse = {
            id: `c_${Date.now()}`,
            code: `CR-${Math.floor(100 + Math.random() * 900)}`,
            title: title,
            urduTitle: urdu || title,
            kitabAuthor: author,
            programId: "p1",
            year: 8,
            credits: credits,
            recommendedPub: "Maktaba Ashrafia Lahore"
        };

        window.LmsData.courses.push(newCourse);
        window.DataStore.save(window.LmsData);
        window.App.closeModal();
        window.App.showToast(`Kitab "${title}" added to curriculum`, "success");
        window.App.navigate('classes');
    }
};

window.ClassesCoursesModule = ClassesCoursesModule;
