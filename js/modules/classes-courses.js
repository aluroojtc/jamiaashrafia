/**
 * JAMIA ASHRAFIA LAHORE - CLASSES, COURSES & CURRICULUM ALLOCATION
 * Courses (kitabs) with syllabus & study material, classes with class teacher,
 * per-kitab teacher allocation and student enrollment.
 */

const ClassesCoursesModule = {
    selectedClassId: null,
    activeTab: 'classes', // 'classes' | 'courses'
    courseSearch: '',

    canManage() {
        return window.AuthRBAC.can('classes:manage') || window.AuthRBAC.can('courses:manage');
    },

    // Teacher of the course (in any class) or an administrator may edit syllabus & materials
    canEditCourse(courseId) {
        if (this.canManage()) return true;
        const me = Lms.me();
        return me.role === 'TEACHER' && Lms.teacherCourseIds(me.id).includes(courseId);
    },

    visibleClasses() {
        const ids = Lms.myClassIds();
        return (window.LmsData.classes || []).filter(c => ids.includes(c.id));
    },

    visibleCourses() {
        const me = Lms.me();
        const all = window.LmsData.courses || [];
        if (this.canManage()) return all;
        if (me.role === 'TEACHER') {
            const ids = Lms.teacherCourseIds(me.id);
            return all.filter(c => ids.includes(c.id));
        }
        if (me.role === 'STUDENT') {
            const ids = Lms.classCourseIds(me.classId);
            return all.filter(c => ids.includes(c.id));
        }
        return all;
    },

    render() {
        const canManage = this.canManage();
        const me = Lms.me();
        const title = me.role === 'STUDENT' ? 'My Class & Kitabs' : me.role === 'TEACHER' ? 'My Classes & Courses' : 'Classes, Courses & Faculty Allocation';

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1><i class="fas fa-chalkboard-teacher" style="color: var(--gold-400);"></i> ${title}</h1>
                    <p>Dars-e-Nizami curriculum, class sections, teacher allocation per kitab, enrolled students and study material</p>
                </div>
                <div class="view-actions">
                    ${canManage ? `
                        <button class="btn btn-gold btn-sm" onclick="ClassesCoursesModule.openClassModal()">
                            <i class="fas fa-plus"></i> New Class
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="ClassesCoursesModule.openCourseModal()">
                            <i class="fas fa-book-medical"></i> New Course / Kitab
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="tabs-nav">
                <button class="tab-btn ${this.activeTab === 'classes' ? 'active' : ''}" onclick="ClassesCoursesModule.setTab('classes')">
                    <i class="fas fa-users"></i> Classes & Enrollment
                </button>
                <button class="tab-btn ${this.activeTab === 'courses' ? 'active' : ''}" onclick="ClassesCoursesModule.setTab('courses')">
                    <i class="fas fa-book"></i> Courses / Kitabs (${this.visibleCourses().length})
                </button>
            </div>

            ${this.activeTab === 'classes' ? this.renderClassesTab() : this.renderCoursesTab()}
        `;
    },

    setTab(tab) {
        this.activeTab = tab;
        window.App.navigate('classes');
    },

    // ---------------------------------------------------------------------
    // CLASSES TAB
    // ---------------------------------------------------------------------
    renderClassesTab() {
        const classes = this.visibleClasses();
        if (!classes.length) {
            return `<div class="card">${window.App.dashEmpty(Lms.role() === 'STUDENT'
                ? 'You are not enrolled in any class yet. Please contact the Academic Office.'
                : Lms.role() === 'TEACHER' ? 'No classes are assigned to you yet.' : 'No classes created yet. Use "New Class" to add one.')}</div>`;
        }
        if (!classes.some(c => c.id === this.selectedClassId)) this.selectedClassId = classes[0].id;
        const cls = Lms.getClass(this.selectedClassId);

        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; margin-bottom: 24px;">
                ${classes.map(c => {
                    const isSelected = c.id === this.selectedClassId;
                    const count = Lms.studentsInClass(c.id).length;
                    return `
                        <div class="card" style="padding: 16px; margin: 0; cursor: pointer; border: ${isSelected ? '2px solid var(--primary-600)' : '1px solid var(--border-subtle)'}; background: ${isSelected ? 'var(--primary-50)' : 'var(--bg-surface)'};" onclick="ClassesCoursesModule.selectClass('${c.id}')">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                <span class="status-pill ${isSelected ? 'gold' : 'info'}" style="font-size: 0.65rem;">${Lms.esc((Lms.program(c.programId) || {}).code || 'Class')}</span>
                                <span style="font-size: 0.75rem; color: var(--gold-700);"><i class="fas fa-user-friends"></i> ${count}${c.capacity ? ' / ' + c.capacity : ''}</span>
                            </div>
                            <h4 style="font-size: 0.95rem; color: var(--primary-950); margin-bottom: 4px;">${Lms.esc(c.name)}</h4>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px;">${Lms.esc(c.section || '')}</div>
                            <div style="font-size: 0.78rem; color: var(--primary-700);"><i class="fas fa-chalkboard-teacher"></i> ${Lms.esc(Lms.userName(c.teacherId, 'No class teacher'))}</div>
                        </div>`;
                }).join('')}
            </div>
            ${cls ? this.renderClassDetail(cls) : ''}
        `;
    },

    renderClassDetail(cls) {
        const canManage = this.canManage();
        const students = Lms.studentsInClass(cls.id);
        const program = Lms.program(cls.programId);
        const branch = ((window.LmsData.institution || {}).branches || []).find(b => b.id === cls.branchId);
        const isStudent = Lms.role() === 'STUDENT';

        return `
            <div class="card">
                <div class="card-header" style="flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h3 class="card-title"><i class="fas fa-school"></i> ${Lms.esc(cls.name)} — ${Lms.esc(cls.section || '')}</h3>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
                            ${Lms.esc(program ? program.name : 'Program not set')} • ${Lms.esc(branch ? branch.name : 'Branch ' + (cls.branchId || '—'))} • <i class="fas fa-door-open"></i> ${Lms.esc(cls.room || 'Room not set')}
                        </div>
                        <div style="font-size: 0.82rem; color: var(--primary-700); margin-top: 4px;">
                            <i class="fas fa-user-tie"></i> Class Teacher: <strong>${Lms.esc(Lms.userName(cls.teacherId, 'Not assigned'))}</strong>
                        </div>
                    </div>
                    ${canManage ? `
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="btn btn-secondary btn-sm" onclick="ClassesCoursesModule.openClassModal('${cls.id}')"><i class="fas fa-edit"></i> Edit Class</button>
                            <button class="btn btn-secondary btn-sm" onclick="ClassesCoursesModule.deleteClass('${cls.id}')" style="color: var(--danger);"><i class="fas fa-trash"></i> Delete</button>
                        </div>` : ''}
                </div>
            </div>

            <div class="classes-detail-grid" style="display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 24px;">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-book"></i> Kitabs & Assigned Teachers</h3>
                        ${canManage ? `<button class="btn btn-gold btn-sm" onclick="ClassesCoursesModule.openAllocateModal('${cls.id}')"><i class="fas fa-user-tag"></i> Add Kitab / Assign Teacher</button>` : ''}
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead><tr><th>Kitab</th><th>Teacher (Ustad)</th><th>Credits</th><th>Actions</th></tr></thead>
                            <tbody>
                                ${(cls.courseTeachers || []).length ? cls.courseTeachers.map(ct => {
                                    const course = Lms.getCourse(ct.courseId);
                                    if (!course) return '';
                                    const materials = (window.LmsData.courseMaterials || []).filter(m => m.courseId === course.id && (!m.classId || m.classId === cls.id));
                                    return `
                                        <tr>
                                            <td>
                                                <div style="font-weight: 700; color: var(--primary-950);">${Lms.esc(course.title)}</div>
                                                <div style="font-family: 'Amiri', serif; font-size: 0.95rem; color: var(--gold-700);">${Lms.esc(course.urduTitle || '')}</div>
                                                <div style="font-size: 0.72rem; color: var(--text-muted);">${Lms.esc(course.code)} • ${materials.length} material file(s)</div>
                                            </td>
                                            <td>
                                                <div style="font-weight: 600; color: ${ct.teacherId ? 'var(--primary-700)' : 'var(--danger)'};">${Lms.esc(Lms.userName(ct.teacherId, 'Not assigned'))}</div>
                                            </td>
                                            <td><strong>${Lms.esc(course.credits)}</strong> hrs/wk</td>
                                            <td>
                                                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                                    <button class="btn btn-secondary btn-sm" onclick="ClassesCoursesModule.viewCourseModal('${course.id}', '${cls.id}')"><i class="fas fa-file-alt"></i> ${isStudent ? 'Syllabus & Material' : 'Details'}</button>
                                                    ${canManage ? `
                                                        <button class="btn btn-secondary btn-sm" title="Change teacher" onclick="ClassesCoursesModule.openAllocateModal('${cls.id}', '${course.id}')"><i class="fas fa-user-edit"></i></button>
                                                        <button class="btn btn-secondary btn-sm" title="Remove kitab from class" onclick="ClassesCoursesModule.removeCourseFromClass('${cls.id}', '${course.id}')"><i class="fas fa-times" style="color: var(--danger);"></i></button>
                                                    ` : ''}
                                                </div>
                                            </td>
                                        </tr>`;
                                }).join('') : `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No kitabs allocated to this class yet.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-user-graduate"></i> Enrolled Students</h3>
                        <div style="display: flex; gap: 6px; align-items: center;">
                            <span class="status-pill gold">${students.length}${cls.capacity ? ' / ' + cls.capacity : ''}</span>
                            ${canManage ? `<button class="btn btn-primary btn-sm" onclick="ClassesCoursesModule.openEnrollModal('${cls.id}')"><i class="fas fa-user-plus"></i> Enroll</button>` : ''}
                        </div>
                    </div>
                    ${isStudent ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px;">${students.length} classmates in your section.</div>` : ''}
                    <div style="display: flex; flex-direction: column; gap: 8px; max-height: 460px; overflow-y: auto;">
                        ${students.length ? students.map(s => `
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
                                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                                    <div class="user-avatar" style="width: 34px; height: 34px; flex-shrink: 0;">${Lms.esc(s.avatar || Lms.initials(s.name))}</div>
                                    <div style="min-width: 0;">
                                        <div style="font-weight: 600; font-size: 0.85rem; color: var(--primary-950);">${Lms.esc(s.name)}</div>
                                        <div style="font-size: 0.72rem; color: var(--gold-700);">${Lms.esc(s.rollNo || '')}</div>
                                    </div>
                                </div>
                                ${canManage ? `<button class="btn btn-secondary btn-sm" title="Remove from class" onclick="ClassesCoursesModule.unenrollStudent('${s.id}')"><i class="fas fa-user-minus" style="color: var(--danger);"></i></button>` : ''}
                            </div>
                        `).join('') : window.App.dashEmpty('No students enrolled yet.')}
                    </div>
                </div>
            </div>
        `;
    },

    selectClass(clsId) {
        this.selectedClassId = clsId;
        this.activeTab = 'classes';
        window.App.navigate('classes');
    },

    openClassModal(classId) {
        const cls = classId ? Lms.getClass(classId) : null;
        const programs = window.LmsData.programs || [];
        const branches = ((window.LmsData.institution || {}).branches || []);
        Lms.openModal(
            `<i class="fas fa-school" style="color: var(--gold-400);"></i> ${cls ? 'Edit Class' : 'Create New Class'}`,
            `<div class="form-grid">
                <div class="form-group">
                    <label>Class Name *</label>
                    <input type="text" id="cls-name" class="form-control" value="${Lms.esc(cls ? cls.name : '')}" placeholder="e.g. Mauqoof Alaih (6th Year)">
                </div>
                <div class="form-group">
                    <label>Section</label>
                    <input type="text" id="cls-section" class="form-control" value="${Lms.esc(cls ? cls.section : '')}" placeholder="e.g. Section A">
                </div>
                <div class="form-group">
                    <label>Program *</label>
                    <select id="cls-program" class="form-control">
                        ${programs.map(p => `<option value="${Lms.esc(p.id)}" ${cls && cls.programId === p.id ? 'selected' : ''}>${Lms.esc(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Campus / Branch *</label>
                    <select id="cls-branch" class="form-control">
                        ${branches.map(b => `<option value="${Lms.esc(b.id)}" ${cls && cls.branchId === b.id ? 'selected' : ''}>${Lms.esc(b.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Class Teacher</label>
                    <select id="cls-teacher" class="form-control">${Lms.teacherOptions(cls ? cls.teacherId : '', true)}</select>
                </div>
                <div class="form-group">
                    <label>Room / Hall</label>
                    <input type="text" id="cls-room" class="form-control" value="${Lms.esc(cls ? cls.room : '')}" placeholder="e.g. Hall Imam Bukhari">
                </div>
                <div class="form-group">
                    <label>Capacity (seats)</label>
                    <input type="number" id="cls-capacity" min="1" class="form-control" value="${Lms.esc(cls ? cls.capacity : 50)}">
                </div>
            </div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="ClassesCoursesModule.saveClass('${cls ? cls.id : ''}')"><i class="fas fa-save"></i> ${cls ? 'Save Changes' : 'Create Class'}</button>`
        );
    },

    saveClass(classId) {
        const name = Lms.val('cls-name');
        if (!name) {
            window.App.showToast('Class name is required', 'warning');
            return;
        }
        const fields = {
            name,
            section: Lms.val('cls-section'),
            programId: Lms.val('cls-program'),
            branchId: Lms.val('cls-branch'),
            teacherId: Lms.val('cls-teacher') || null,
            room: Lms.val('cls-room'),
            capacity: parseInt(Lms.val('cls-capacity'), 10) || null
        };
        let cls = classId ? Lms.getClass(classId) : null;
        const prevTeacher = cls ? cls.teacherId : null;
        if (cls) {
            Object.assign(cls, fields);
        } else {
            cls = { id: Lms.uid('cls'), courseTeachers: [], ...fields };
            window.LmsData.classes.push(cls);
        }
        Lms.save();
        if (cls.teacherId && cls.teacherId !== prevTeacher) {
            Lms.notifyUser(cls.teacherId, 'Class Teacher Assignment', `You have been appointed class teacher of ${cls.name} (${cls.section || ''}).`, 'ACADEMIC', 'classes');
        }
        this.selectedClassId = cls.id;
        window.App.closeModal();
        window.App.showToast(classId ? 'Class updated' : `Class "${name}" created`, 'success');
        window.App.navigate('classes');
    },

    deleteClass(classId) {
        const cls = Lms.getClass(classId);
        if (!cls) return;
        const count = Lms.studentsInClass(classId).length;
        if (count) {
            window.App.showToast(`Move or remove the ${count} enrolled student(s) before deleting this class.`, 'warning');
            return;
        }
        if (!confirm(`Delete class "${cls.name} — ${cls.section || ''}"? Its timetable periods will also be removed.`)) return;
        window.LmsData.classes = window.LmsData.classes.filter(c => c.id !== classId);
        window.LmsData.timetables = (window.LmsData.timetables || []).filter(t => t.classId !== classId);
        Lms.save();
        this.selectedClassId = null;
        window.App.showToast('Class deleted', 'success');
        window.App.navigate('classes');
    },

    openAllocateModal(classId, courseId) {
        const cls = Lms.getClass(classId);
        if (!cls) return;
        const current = courseId ? (cls.courseTeachers || []).find(ct => ct.courseId === courseId) : null;
        const allocated = (cls.courseTeachers || []).map(ct => ct.courseId);
        const courseIds = courseId ? [courseId] : (window.LmsData.courses || []).map(c => c.id).filter(id => !allocated.includes(id));
        if (!courseIds.length) {
            window.App.showToast('All courses are already allocated to this class. Create a new course first.', 'info');
            return;
        }
        Lms.openModal(
            `<i class="fas fa-user-tag" style="color: var(--gold-400);"></i> ${courseId ? 'Change Teacher' : 'Add Kitab to'} ${Lms.esc(cls.name)}`,
            `<div class="form-grid">
                <div class="form-group">
                    <label>Course / Kitab *</label>
                    <select id="alloc-course" class="form-control" ${courseId ? 'disabled' : ''}>${Lms.courseOptions(courseId, courseIds)}</select>
                </div>
                <div class="form-group">
                    <label>Teacher (Ustad) *</label>
                    <select id="alloc-teacher" class="form-control">${Lms.teacherOptions(current ? current.teacherId : cls.teacherId, true)}</select>
                </div>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted);">The teacher will see this class in their portal and can publish assignments, exams and online classes for it.</p>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="ClassesCoursesModule.saveAllocation('${classId}')"><i class="fas fa-check"></i> Save Allocation</button>`
        );
    },

    saveAllocation(classId) {
        const cls = Lms.getClass(classId);
        const courseId = Lms.val('alloc-course');
        const teacherId = Lms.val('alloc-teacher') || null;
        if (!cls || !courseId) return;
        cls.courseTeachers = cls.courseTeachers || [];
        const existing = cls.courseTeachers.find(ct => ct.courseId === courseId);
        const prevTeacher = existing ? existing.teacherId : null;
        if (existing) existing.teacherId = teacherId;
        else cls.courseTeachers.push({ courseId, teacherId });

        if (teacherId) {
            const teacher = Lms.user(teacherId);
            if (teacher) {
                teacher.assignedCourses = teacher.assignedCourses || [];
                if (!teacher.assignedCourses.includes(courseId)) teacher.assignedCourses.push(courseId);
            }
        }
        Lms.save();
        if (teacherId && teacherId !== prevTeacher) {
            Lms.notifyUser(teacherId, 'New Teaching Allocation',
                `You have been assigned to teach ${Lms.courseTitle(courseId)} to ${cls.name} (${cls.section || ''}).`, 'ACADEMIC', 'classes');
        }
        window.App.closeModal();
        window.App.showToast('Teacher allocation saved', 'success');
        window.App.navigate('classes');
    },

    removeCourseFromClass(classId, courseId) {
        const cls = Lms.getClass(classId);
        if (!cls || !confirm(`Remove ${Lms.courseTitle(courseId)} from ${cls.name}?`)) return;
        cls.courseTeachers = (cls.courseTeachers || []).filter(ct => ct.courseId !== courseId);
        Lms.save();
        window.App.showToast('Kitab removed from class', 'success');
        window.App.navigate('classes');
    },

    openEnrollModal(classId) {
        const cls = Lms.getClass(classId);
        if (!cls) return;
        const candidates = Lms.students().filter(s => s.classId !== classId && s.status !== 'INACTIVE');
        Lms.openModal(
            `<i class="fas fa-user-plus" style="color: var(--primary-400);"></i> Enroll Students in ${Lms.esc(cls.name)} — ${Lms.esc(cls.section || '')}`,
            candidates.length ? `
                <input type="text" class="form-control" placeholder="Search by name or roll number..." style="margin-bottom: 12px;"
                    oninput="document.querySelectorAll('.enroll-row').forEach(r => r.style.display = r.dataset.q.includes(this.value.toLowerCase()) ? '' : 'none')">
                <div style="max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                    ${candidates.map(s => `
                        <label class="enroll-row" data-q="${Lms.esc((s.name + ' ' + (s.rollNo || '')).toLowerCase())}" style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); cursor: pointer;">
                            <input type="checkbox" class="enroll-check" value="${Lms.esc(s.id)}" style="width: 18px; height: 18px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600;">${Lms.esc(s.name)} <span style="font-size: 0.75rem; color: var(--gold-700);">${Lms.esc(s.rollNo || '')}</span></div>
                                <div style="font-size: 0.72rem; color: var(--text-muted);">Current: ${Lms.esc(s.classId ? Lms.className(s.classId) : 'Not enrolled')}</div>
                            </div>
                        </label>`).join('')}
                </div>` : window.App.dashEmpty('Every student is already in this class. New students are added through Admissions or Students Management.'),
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             ${candidates.length ? `<button class="btn btn-primary" onclick="ClassesCoursesModule.saveEnrollment('${classId}')"><i class="fas fa-check"></i> Enroll Selected</button>` : ''}`
        );
    },

    saveEnrollment(classId) {
        const cls = Lms.getClass(classId);
        const ids = Array.from(document.querySelectorAll('.enroll-check:checked')).map(c => c.value);
        if (!cls || !ids.length) {
            window.App.showToast('Select at least one student', 'warning');
            return;
        }
        const program = Lms.program(cls.programId);
        ids.forEach(id => {
            const s = Lms.user(id);
            if (!s) return;
            s.classId = classId;
            if (program) s.program = program.name;
            if (cls.branchId) s.branchId = cls.branchId;
        });
        Lms.save();
        Lms.notify(ids.map(id => ({
            targetUserId: id, category: 'ACADEMIC', linkRoute: 'classes',
            title: 'Class Enrollment Confirmed',
            message: `You are now enrolled in ${cls.name} (${cls.section || ''}). Your timetable, assignments and online classes are available in the portal.`
        })));
        window.App.closeModal();
        window.App.showToast(`${ids.length} student(s) enrolled in ${cls.name}`, 'success');
        window.App.navigate('classes');
    },

    unenrollStudent(studentId) {
        const s = Lms.user(studentId);
        if (!s || !confirm(`Remove ${s.name} from ${Lms.className(s.classId)}?`)) return;
        s.classId = null;
        Lms.save();
        window.App.showToast(`${s.name} removed from class`, 'success');
        window.App.navigate('classes');
    },

    // ---------------------------------------------------------------------
    // COURSES TAB
    // ---------------------------------------------------------------------
    renderCoursesTab() {
        const canManage = this.canManage();
        const q = this.courseSearch.toLowerCase();
        const courses = this.visibleCourses().filter(c => !q || [c.title, c.code, c.urduTitle, c.kitabAuthor].join(' ').toLowerCase().includes(q));

        return `
            <div class="filter-bar">
                <div class="search-input-wrap">
                    <i class="fas fa-search"></i>
                    <input type="text" class="form-control" placeholder="Search kitab, code or author..." value="${Lms.esc(this.courseSearch)}"
                        oninput="ClassesCoursesModule.courseSearch = this.value; clearTimeout(this._t); this._t = setTimeout(() => { App.navigate('classes'); const i = document.querySelector('.filter-bar input'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250)">
                </div>
            </div>
            <div class="card">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr><th>Kitab & Code</th><th>Program / Year</th><th>Taught In</th><th>Credits</th><th>Actions</th></tr></thead>
                        <tbody>
                            ${courses.length ? courses.map(c => {
                                const program = Lms.program(c.programId);
                                const inClasses = (window.LmsData.classes || []).filter(cl => (cl.courseTeachers || []).some(ct => ct.courseId === c.id));
                                return `
                                    <tr>
                                        <td>
                                            <div style="font-weight: 700; color: var(--primary-950);">${Lms.esc(c.title)}</div>
                                            <div style="font-family: 'Amiri', serif; font-size: 0.95rem; color: var(--gold-700);">${Lms.esc(c.urduTitle || '')}</div>
                                            <div style="font-size: 0.72rem; color: var(--text-muted);">${Lms.esc(c.code)} • ${Lms.esc(c.kitabAuthor || '')}</div>
                                        </td>
                                        <td style="font-size: 0.82rem;">${Lms.esc(program ? program.name : '—')}<div style="font-size: 0.72rem; color: var(--text-muted);">Year ${Lms.esc(c.year || '—')}</div></td>
                                        <td style="font-size: 0.78rem;">${inClasses.length ? inClasses.map(cl => `<div>${Lms.esc(cl.name)} <span style="color: var(--text-muted);">(${Lms.esc(Lms.userName(Lms.courseTeacherId(cl.id, c.id), 'no teacher'))})</span></div>`).join('') : '<span style="color: var(--text-muted);">Not allocated</span>'}</td>
                                        <td><strong>${Lms.esc(c.credits)}</strong></td>
                                        <td>
                                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                                <button class="btn btn-secondary btn-sm" onclick="ClassesCoursesModule.viewCourseModal('${c.id}')"><i class="fas fa-folder-open"></i> Syllabus & Material</button>
                                                ${canManage ? `
                                                    <button class="btn btn-secondary btn-sm" title="Edit" onclick="ClassesCoursesModule.openCourseModal('${c.id}')"><i class="fas fa-edit"></i></button>
                                                    <button class="btn btn-secondary btn-sm" title="Delete" onclick="ClassesCoursesModule.deleteCourse('${c.id}')"><i class="fas fa-trash" style="color: var(--danger);"></i></button>
                                                ` : ''}
                                            </div>
                                        </td>
                                    </tr>`;
                            }).join('') : `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No courses found.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    openCourseModal(courseId) {
        const c = courseId ? Lms.getCourse(courseId) : null;
        const programs = window.LmsData.programs || [];
        Lms.openModal(
            `<i class="fas fa-book-medical" style="color: var(--primary-400);"></i> ${c ? 'Edit Course / Kitab' : 'Add New Course / Kitab'}`,
            `<div class="form-grid">
                <div class="form-group">
                    <label>Kitab Title (English) *</label>
                    <input type="text" id="crs-title" class="form-control" value="${Lms.esc(c ? c.title : '')}" placeholder="e.g. Sunan Abi Dawud">
                </div>
                <div class="form-group">
                    <label>Kitab Title (Arabic / Urdu)</label>
                    <input type="text" id="crs-urdu" class="form-control" dir="rtl" value="${Lms.esc(c ? c.urduTitle : '')}" placeholder="سنن ابی داؤد">
                </div>
                <div class="form-group">
                    <label>Course Code *</label>
                    <input type="text" id="crs-code" class="form-control" value="${Lms.esc(c ? c.code : '')}" placeholder="e.g. HAD-804">
                </div>
                <div class="form-group">
                    <label>Classical Author *</label>
                    <input type="text" id="crs-author" class="form-control" value="${Lms.esc(c ? c.kitabAuthor : '')}" placeholder="Imam Abu Dawud as-Sijistani">
                </div>
                <div class="form-group">
                    <label>Program</label>
                    <select id="crs-program" class="form-control">
                        ${programs.map(p => `<option value="${Lms.esc(p.id)}" ${c && c.programId === p.id ? 'selected' : ''}>${Lms.esc(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Year of Study</label>
                    <input type="number" id="crs-year" min="1" max="10" class="form-control" value="${Lms.esc(c ? c.year : 1)}">
                </div>
                <div class="form-group">
                    <label>Credit Hours per Week</label>
                    <input type="number" id="crs-credits" min="1" class="form-control" value="${Lms.esc(c ? c.credits : 4)}">
                </div>
                <div class="form-group">
                    <label>Recommended Edition / Publisher</label>
                    <input type="text" id="crs-pub" class="form-control" value="${Lms.esc(c ? c.recommendedPub : 'Maktaba Ashrafia Lahore')}">
                </div>
            </div>
            <div class="form-group">
                <label>Syllabus / Term Breakdown</label>
                <textarea id="crs-syllabus" class="form-control" style="min-height: 120px;" placeholder="Term 1 (Shashmahi): ...&#10;Term 2 (Salana): ...">${Lms.esc(c ? c.syllabus || '' : '')}</textarea>
            </div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-primary" onclick="ClassesCoursesModule.saveCourse('${c ? c.id : ''}')"><i class="fas fa-save"></i> ${c ? 'Save Changes' : 'Add to Curriculum'}</button>`
        );
    },

    saveCourse(courseId) {
        const title = Lms.val('crs-title');
        const author = Lms.val('crs-author');
        const code = Lms.val('crs-code').toUpperCase();
        if (!title || !author || !code) {
            window.App.showToast('Title, code and author are required', 'warning');
            return;
        }
        if ((window.LmsData.courses || []).some(c => c.code.toUpperCase() === code && c.id !== courseId)) {
            window.App.showToast(`Course code ${code} is already used`, 'warning');
            return;
        }
        const fields = {
            title, code, kitabAuthor: author,
            urduTitle: Lms.val('crs-urdu') || title,
            programId: Lms.val('crs-program'),
            year: parseInt(Lms.val('crs-year'), 10) || 1,
            credits: parseInt(Lms.val('crs-credits'), 10) || 4,
            recommendedPub: Lms.val('crs-pub'),
            syllabus: document.getElementById('crs-syllabus').value.trim()
        };
        const existing = courseId ? Lms.getCourse(courseId) : null;
        if (existing) Object.assign(existing, fields);
        else window.LmsData.courses.push({ id: Lms.uid('c'), ...fields });
        Lms.save();
        window.App.closeModal();
        window.App.showToast(existing ? 'Course updated' : `Kitab "${title}" added to curriculum`, 'success');
        window.App.navigate('classes');
    },

    deleteCourse(courseId) {
        const c = Lms.getCourse(courseId);
        if (!c) return;
        const used = (window.LmsData.assignments || []).some(a => a.courseId === courseId) || (window.LmsData.exams || []).some(e => e.courseId === courseId);
        if (!confirm(`Delete "${c.title}"?${used ? '\n\nAssignments/exams already linked to this course will keep their records.' : ''}`)) return;
        window.LmsData.courses = window.LmsData.courses.filter(x => x.id !== courseId);
        (window.LmsData.classes || []).forEach(cl => { cl.courseTeachers = (cl.courseTeachers || []).filter(ct => ct.courseId !== courseId); });
        (window.LmsData.users || []).forEach(u => { if (Array.isArray(u.assignedCourses)) u.assignedCourses = u.assignedCourses.filter(id => id !== courseId); });
        Lms.save();
        window.App.showToast('Course deleted', 'success');
        window.App.navigate('classes');
    },

    // Syllabus + study material (teachers upload, students download)
    viewCourseModal(courseId, classId) {
        const course = Lms.getCourse(courseId);
        if (!course) return;
        const canEdit = this.canEditCourse(courseId);
        const visibleClassIds = Lms.myClassIds();
        const materials = (window.LmsData.courseMaterials || [])
            .filter(m => m.courseId === courseId && (!m.classId || visibleClassIds.includes(m.classId) || this.canManage()))
            .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
        const classesWithCourse = (window.LmsData.classes || []).filter(cl => (cl.courseTeachers || []).some(ct => ct.courseId === courseId) && (this.canManage() || visibleClassIds.includes(cl.id)));

        Lms.openModal(
            `<i class="fas fa-book-open" style="color: var(--gold-400);"></i> ${Lms.esc(course.title)}`,
            `<div style="margin-bottom: 14px;">
                <div style="font-family: 'Amiri', serif; font-size: 1.4rem; color: var(--gold-700); text-align: right;">${Lms.esc(course.urduTitle || '')}</div>
                <div style="font-size: 0.88rem; color: var(--text-secondary);"><strong>Author:</strong> ${Lms.esc(course.kitabAuthor || '—')}</div>
                <div style="font-size: 0.85rem; color: var(--text-muted);"><strong>Edition:</strong> ${Lms.esc(course.recommendedPub || '—')} • <strong>Code:</strong> ${Lms.esc(course.code)} • <strong>Credits:</strong> ${Lms.esc(course.credits)}</div>
            </div>

            <div class="card" style="background: var(--bg-surface-elevated); padding: 16px; margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h4 style="color: var(--primary-950); font-size: 0.95rem;"><i class="fas fa-list-ol"></i> Syllabus</h4>
                    ${canEdit ? `<button class="btn btn-secondary btn-sm" onclick="ClassesCoursesModule.editSyllabus('${course.id}')"><i class="fas fa-edit"></i> Edit</button>` : ''}
                </div>
                <div id="syllabus-view" style="font-size: 0.86rem; color: var(--text-secondary); line-height: 1.8;">
                    ${course.syllabus ? Lms.multiline(course.syllabus) : '<em style="color: var(--text-muted);">Syllabus has not been added yet.</em>'}
                </div>
            </div>

            <div class="card" style="padding: 16px; margin-bottom: 0;">
                <h4 style="color: var(--primary-950); font-size: 0.95rem; margin-bottom: 10px;"><i class="fas fa-folder-open"></i> Study Material & Lecture Notes</h4>
                <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px;">
                    ${materials.length ? materials.map(m => `
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
                            <div style="min-width: 0;">
                                <div style="font-weight: 600; font-size: 0.85rem;">${Lms.esc(m.title)}</div>
                                <div style="font-size: 0.72rem; color: var(--text-muted);">${Lms.esc(m.classId ? Lms.className(m.classId) : 'All classes')} • ${Lms.esc(Lms.userName(m.uploadedBy, ''))} • ${Lms.fmtDate(m.uploadedAt)}</div>
                            </div>
                            <div style="display: flex; gap: 6px; flex-shrink: 0;">
                                <a class="btn btn-primary btn-sm" href="${Lms.esc(m.file.url)}" target="_blank" rel="noopener"><i class="fas fa-download"></i> ${Lms.fileSize(m.file.size)}</a>
                                ${canEdit ? `<button class="btn btn-secondary btn-sm" onclick="ClassesCoursesModule.deleteMaterial('${m.id}', '${course.id}', '${classId || ''}')"><i class="fas fa-trash" style="color: var(--danger);"></i></button>` : ''}
                            </div>
                        </div>`).join('') : '<div style="font-size: 0.82rem; color: var(--text-muted);">No material uploaded yet.</div>'}
                </div>
                ${canEdit ? `
                    <div style="border-top: 1px solid var(--border-subtle); padding-top: 12px;">
                        <div class="form-grid" style="margin-bottom: 10px;">
                            <div class="form-group">
                                <label>Material Title *</label>
                                <input type="text" id="mat-title" class="form-control" placeholder="e.g. Lecture 4 notes — Kitab al-Ilm">
                            </div>
                            <div class="form-group">
                                <label>Share With</label>
                                <select id="mat-class" class="form-control">
                                    <option value="">All classes studying this kitab</option>
                                    ${classesWithCourse.map(cl => `<option value="${Lms.esc(cl.id)}" ${cl.id === classId ? 'selected' : ''}>${Lms.esc(cl.name)} — ${Lms.esc(cl.section || '')}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        ${Lms.fileInput('mat-file', { label: 'Choose PDF / notes / slides / audio to upload', accept: '.pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.mp3,.m4a,.mp4,.zip,.txt' })}
                        <button class="btn btn-gold btn-sm" style="margin-top: 10px;" onclick="ClassesCoursesModule.uploadMaterial(this, '${course.id}')"><i class="fas fa-upload"></i> Upload Material</button>
                    </div>` : ''}
            </div>`,
            null,
            { wide: true }
        );
    },

    editSyllabus(courseId) {
        const course = Lms.getCourse(courseId);
        const view = document.getElementById('syllabus-view');
        if (!course || !view) return;
        view.innerHTML = `
            <textarea id="syllabus-edit" class="form-control" style="min-height: 140px;">${Lms.esc(course.syllabus || '')}</textarea>
            <button class="btn btn-gold btn-sm" style="margin-top: 8px;" onclick="ClassesCoursesModule.saveSyllabus('${courseId}')"><i class="fas fa-save"></i> Save Syllabus</button>`;
    },

    saveSyllabus(courseId) {
        const course = Lms.getCourse(courseId);
        if (!course) return;
        course.syllabus = document.getElementById('syllabus-edit').value.trim();
        Lms.save();
        window.App.showToast('Syllabus saved', 'success');
        this.viewCourseModal(courseId);
    },

    async uploadMaterial(btn, courseId) {
        const title = Lms.val('mat-title');
        const input = document.getElementById('mat-file');
        if (!title || !input || !input.files.length) {
            window.App.showToast('Enter a title and choose a file', 'warning');
            return;
        }
        const classId = Lms.val('mat-class') || null;
        await Lms.busy(btn, async () => {
            const file = await Lms.uploadFile(input.files[0]);
            window.LmsData.courseMaterials = window.LmsData.courseMaterials || [];
            window.LmsData.courseMaterials.push({
                id: Lms.uid('mat'), courseId, classId, title, file,
                uploadedBy: Lms.me().id, uploadedAt: new Date().toISOString()
            });
            Lms.save();
            const targets = classId ? [classId] : (window.LmsData.classes || []).filter(cl => (cl.courseTeachers || []).some(ct => ct.courseId === courseId)).map(cl => cl.id);
            targets.forEach(cid => Lms.notifyClass(cid, `New Study Material: ${Lms.courseTitle(courseId)}`, `"${title}" has been uploaded. Open Classes & Courses to download it.`, 'ACADEMIC', 'classes'));
            window.App.showToast('Material uploaded and shared with students', 'success');
            this.viewCourseModal(courseId, classId);
        }, 'Uploading...');
    },

    deleteMaterial(materialId, courseId, classId) {
        if (!confirm('Delete this material?')) return;
        window.LmsData.courseMaterials = (window.LmsData.courseMaterials || []).filter(m => m.id !== materialId);
        Lms.save();
        this.viewCourseModal(courseId, classId || undefined);
    }
};

window.ClassesCoursesModule = ClassesCoursesModule;
