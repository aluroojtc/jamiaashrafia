/**
 * JAMIA ASHRAFIA LAHORE - ASSIGNMENTS & EVALUATION MODULE
 * Teachers publish assignments (with question files) to their classes, students upload
 * their work (text + files), teachers check, mark, give feedback and return checked copies.
 */

const AssignmentsModule = {
    filter: 'ALL', // student: ALL | PENDING | SUBMITTED | GRADED ; staff: ALL | TO_CHECK

    isStaff() {
        return Lms.portal() !== 'student';
    },

    canCreate() {
        return Lms.can('assignments.create');
    },

    // Assignments visible to the signed-in user
    visibleAssignments() {
        const me = Lms.me();
        const all = window.LmsData.assignments || [];
        const portal = Lms.portal();
        if (portal === 'staff') return all;
        if (portal === 'teacher') {
            const classIds = Lms.teacherClassIds(me.id);
            return all.filter(a => a.teacherId === me.id || classIds.includes(a.classId));
        }
        return all.filter(a => a.classId === me.classId || a.classId === 'all');
    },

    submissionsFor(asgId) {
        return (window.LmsData.assignmentSubmissions || []).filter(s => s.assignmentId === asgId);
    },

    mySubmission(asgId) {
        const me = Lms.me();
        return (window.LmsData.assignmentSubmissions || []).find(s => s.assignmentId === asgId && s.studentId === me.id) || null;
    },

    // Within the role's data scope: the whole institution, or classes the teacher teaches / assignments they set
    inScope(asg) {
        const portal = Lms.portal();
        if (portal === 'staff') return true;
        const me = Lms.me();
        return portal === 'teacher' && (asg.teacherId === me.id || Lms.teacherClassIds(me.id).includes(asg.classId));
    },

    canCheck(asg) {
        return Lms.can('assignments.grade') && this.inScope(asg);
    },

    render() {
        const isStudent = Lms.portal() === 'student';
        const list = this.visibleAssignments().slice().sort((a, b) => String(b.dueDate).localeCompare(String(a.dueDate)));

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1><i class="fas fa-edit" style="color: var(--gold-400);"></i> ${isStudent ? 'My Assignments & Submissions' : 'Assignments & Checking'}</h1>
                    <p>${isStudent ? 'Upload your homework, track submissions and read your teacher\'s feedback' : 'Publish assignments to your classes, check uploaded work, award marks and return feedback'}</p>
                </div>
                <div class="view-actions">
                    ${this.canCreate() ? `
                        <button class="btn btn-gold btn-sm" onclick="AssignmentsModule.openCreateAssignmentModal()">
                            <i class="fas fa-plus-circle"></i> Create Assignment
                        </button>` : ''}
                </div>
            </div>
            ${isStudent ? this.renderStudentView(list) : this.renderStaffView(list)}
        `;
    },

    setFilter(f) {
        this.filter = f;
        window.App.navigate('assignments');
    },

    filterTabs(tabs) {
        return `
            <div class="tabs-nav">
                ${tabs.map(([key, label, count]) => `
                    <button class="tab-btn ${this.filter === key ? 'active' : ''}" onclick="AssignmentsModule.setFilter('${key}')">
                        ${label} <span class="badge-pill" style="margin-left: 4px;">${count}</span>
                    </button>`).join('')}
            </div>`;
    },

    // ---------------------------------------------------------------------
    // STUDENT VIEW
    // ---------------------------------------------------------------------
    studentStatus(asg) {
        const sub = this.mySubmission(asg.id);
        const today = Lms.today();
        if (sub && sub.isGraded) return { key: 'GRADED', sub, pill: 'success', label: `Checked: ${sub.marksObtained}/${asg.maxMarks}` };
        if (sub && sub.resubmitRequested) return { key: 'PENDING', sub, pill: 'danger', label: 'Resubmission requested' };
        if (sub) return { key: 'SUBMITTED', sub, pill: 'info', label: 'Submitted — awaiting checking' };
        if (asg.dueDate < today) return { key: 'PENDING', sub: null, pill: 'danger', label: 'Overdue — not submitted' };
        return { key: 'PENDING', sub: null, pill: 'warning', label: 'Not submitted' };
    },

    renderStudentView(list) {
        const me = Lms.me();
        if (!me.classId) {
            return `<div class="card">${window.App.dashEmpty('You are not enrolled in a class yet, so no assignments are available.')}</div>`;
        }
        const withStatus = list.map(a => ({ a, st: this.studentStatus(a) }));
        const count = k => withStatus.filter(x => k === 'ALL' || x.st.key === k).length;
        const shown = withStatus.filter(x => this.filter === 'ALL' || x.st.key === this.filter || !['PENDING', 'SUBMITTED', 'GRADED'].includes(this.filter));

        return `
            ${this.filterTabs([['ALL', 'All', count('ALL')], ['PENDING', 'To Do', count('PENDING')], ['SUBMITTED', 'Submitted', count('SUBMITTED')], ['GRADED', 'Checked', count('GRADED')]])}
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
                ${shown.length ? shown.map(({ a, st }) => `
                    <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; margin: 0; border-top: 3px solid var(--${st.pill === 'success' ? 'success' : st.pill === 'danger' ? 'danger' : st.pill === 'info' ? 'info' : 'warning'});">
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 10px;">
                                <span class="status-pill gold" style="font-size: 0.7rem;">${Lms.esc((Lms.getCourse(a.courseId) || {}).code || 'Kitab')}</span>
                                <span style="font-size: 0.75rem; color: ${a.dueDate < Lms.today() ? 'var(--danger)' : 'var(--text-secondary)'}; font-weight: 600;"><i class="fas fa-calendar-alt"></i> Due ${Lms.fmtDate(a.dueDate)}</span>
                            </div>
                            <h3 style="font-size: 1.05rem; color: var(--primary-950); margin-bottom: 4px;">${Lms.esc(a.title)}</h3>
                            ${a.urduTitle && a.urduTitle !== a.title ? `<div style="font-family: 'Amiri', serif; font-size: 1.1rem; color: var(--gold-700); margin-bottom: 8px;">${Lms.esc(a.urduTitle)}</div>` : ''}
                            <p style="font-size: 0.84rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 10px;">${Lms.multiline(a.description)}</p>
                            ${Lms.fileLinks(a.attachments)}
                        </div>
                        <div>
                            <div style="font-size: 0.78rem; color: var(--text-muted); padding: 8px 0; border-top: 1px solid var(--border-subtle); margin-top: 10px; display: flex; justify-content: space-between;">
                                <span><i class="fas fa-user-tie"></i> ${Lms.esc(Lms.userName(a.teacherId))}</span>
                                <span><strong>Max:</strong> ${Lms.esc(a.maxMarks)}</span>
                            </div>
                            <div style="margin-bottom: 10px;"><span class="status-pill ${st.pill}">${st.label}</span></div>
                            ${st.sub && st.sub.isGraded ? `
                                <div style="background: var(--primary-50); border: 1px solid var(--primary-200); border-radius: var(--radius-sm); padding: 10px; font-size: 0.82rem; margin-bottom: 10px;">
                                    <div><strong>Grade:</strong> ${Lms.esc(Lms.wifaqGrade(st.sub.marksObtained / a.maxMarks * 100).label)}</div>
                                    <div style="margin-top: 4px;"><strong>Feedback:</strong> ${Lms.multiline(st.sub.feedback || '—')}</div>
                                    ${st.sub.returnedFile ? `<div style="margin-top: 6px;">${Lms.fileLinks([st.sub.returnedFile])}</div>` : ''}
                                </div>` : ''}
                            ${st.sub && st.sub.resubmitRequested && st.sub.feedback ? `<div style="font-size: 0.8rem; color: var(--danger); margin-bottom: 10px;"><strong>Teacher's note:</strong> ${Lms.multiline(st.sub.feedback)}</div>` : ''}
                            <div style="display: flex; gap: 8px;">
                                ${st.sub ? `<button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="AssignmentsModule.viewSubmission('${st.sub.id}')"><i class="fas fa-eye"></i> My Submission</button>` : ''}
                                ${!st.sub || (!st.sub.isGraded) ? (
                                    (a.dueDate < Lms.today() && a.allowLate === false && !(st.sub && st.sub.resubmitRequested))
                                        ? `<span class="status-pill danger" style="flex: 1; justify-content: center;">Submission closed</span>`
                                        : `<button class="btn btn-primary btn-sm" style="flex: 1;" onclick="AssignmentsModule.openStudentUploadModal('${a.id}')"><i class="fas fa-upload"></i> ${st.sub ? 'Update Submission' : 'Submit Work'}</button>`
                                ) : ''}
                            </div>
                        </div>
                    </div>`).join('') : `<div class="card" style="grid-column: 1 / -1;">${window.App.dashEmpty('No assignments in this list.')}</div>`}
            </div>
        `;
    },

    // ---------------------------------------------------------------------
    // TEACHER / ADMIN VIEW
    // ---------------------------------------------------------------------
    renderStaffView(list) {
        const allSubs = window.LmsData.assignmentSubmissions || [];
        const ids = new Set(list.map(a => a.id));
        const toCheck = allSubs.filter(s => ids.has(s.assignmentId) && !s.isGraded && !s.resubmitRequested)
            .sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));
        if (!['ALL', 'TO_CHECK'].includes(this.filter)) this.filter = 'ALL';

        return `
            ${this.filterTabs([['ALL', 'Assignments', list.length], ['TO_CHECK', 'Waiting for Checking', toCheck.length]])}
            ${this.filter === 'TO_CHECK' ? `
                <div class="card">
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead><tr><th>Student</th><th>Assignment</th><th>Submitted</th><th>Files</th><th></th></tr></thead>
                            <tbody>
                                ${toCheck.length ? toCheck.map(s => {
                                    const a = list.find(x => x.id === s.assignmentId) || {};
                                    return `
                                        <tr>
                                            <td><div style="font-weight: 700;">${Lms.esc(s.studentName)}</div><div style="font-size: 0.75rem; color: var(--gold-700);">${Lms.esc(s.rollNo || '')}</div></td>
                                            <td><div style="font-weight: 600;">${Lms.esc(a.title || '')}</div><div style="font-size: 0.72rem; color: var(--text-muted);">${Lms.esc(Lms.className(a.classId))}</div></td>
                                            <td style="font-size: 0.8rem;">${Lms.fmtDateTime(s.submittedAt)} ${s.isLate ? '<span class="status-pill danger" style="font-size: 0.65rem;">Late</span>' : ''}</td>
                                            <td>${Lms.fileLinks(s.attachments) || '<span style="color: var(--text-muted); font-size: 0.75rem;">Text only</span>'}</td>
                                            <td><button class="btn btn-gold btn-sm" onclick="AssignmentsModule.openGradeSubmissionModal('${s.id}')"><i class="fas fa-pencil-alt"></i> Check</button></td>
                                        </tr>`;
                                }).join('') : `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Nothing waiting for checking.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
                    ${list.length ? list.map(a => {
                        const subs = this.submissionsFor(a.id);
                        const classSize = Lms.studentsInClass(a.classId).length;
                        const graded = subs.filter(s => s.isGraded).length;
                        const pending = subs.filter(s => !s.isGraded && !s.resubmitRequested).length;
                        return `
                            <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; margin: 0;">
                                <div>
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                                        <span class="status-pill gold" style="font-size: 0.7rem;">${Lms.esc((Lms.getCourse(a.courseId) || {}).code || 'Kitab')}</span>
                                        <span style="font-size: 0.75rem; color: ${a.dueDate < Lms.today() ? 'var(--danger)' : 'var(--text-secondary)'}; font-weight: 600;"><i class="fas fa-calendar-alt"></i> Due ${Lms.fmtDate(a.dueDate)}</span>
                                    </div>
                                    <h3 style="font-size: 1.05rem; color: var(--primary-950); margin-bottom: 4px;">${Lms.esc(a.title)}</h3>
                                    <div style="font-size: 0.78rem; color: var(--primary-700); margin-bottom: 8px;"><i class="fas fa-users"></i> ${Lms.esc(Lms.className(a.classId))}</div>
                                    <p style="font-size: 0.84rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 8px; max-height: 6.4em; overflow: hidden;">${Lms.multiline(a.description)}</p>
                                    ${Lms.fileLinks(a.attachments)}
                                </div>
                                <div>
                                    <div style="display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0;">
                                        <span class="status-pill info">${subs.length}/${classSize} submitted</span>
                                        <span class="status-pill success">${graded} checked</span>
                                        ${pending ? `<span class="status-pill warning">${pending} to check</span>` : ''}
                                    </div>
                                    <div style="font-size: 0.78rem; color: var(--text-muted); padding: 8px 0; border-top: 1px solid var(--border-subtle); margin-bottom: 10px; display: flex; justify-content: space-between;">
                                        <span><i class="fas fa-user-tie"></i> ${Lms.esc(Lms.userName(a.teacherId))}</span>
                                        <span><strong>Max:</strong> ${Lms.esc(a.maxMarks)}</span>
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <button class="btn btn-gold btn-sm" style="flex: 1;" onclick="AssignmentsModule.openSubmissionsReviewModal('${a.id}')"><i class="fas fa-tasks"></i> Check Submissions</button>
                                        ${this.inScope(a) && Lms.can('assignments.update') ? `
                                            <button class="btn btn-secondary btn-sm" title="Edit" onclick="AssignmentsModule.openCreateAssignmentModal('${a.id}')"><i class="fas fa-edit"></i></button>` : ''}
                                        ${this.inScope(a) && Lms.can('assignments.delete') ? `
                                            <button class="btn btn-secondary btn-sm" title="Delete" onclick="AssignmentsModule.deleteAssignment('${a.id}')"><i class="fas fa-trash" style="color: var(--danger);"></i></button>` : ''}
                                    </div>
                                </div>
                            </div>`;
                    }).join('') : `<div class="card" style="grid-column: 1 / -1;">${window.App.dashEmpty('No assignments yet. Use "Create Assignment" to publish one to your class.')}</div>`}
                </div>
            `}
        `;
    },

    // ---------------------------------------------------------------------
    // CREATE / EDIT
    // ---------------------------------------------------------------------
    openCreateAssignmentModal(asgId) {
        const me = Lms.me();
        const asg = asgId ? (window.LmsData.assignments || []).find(a => a.id === asgId) : null;
        const classIds = Lms.myClassIds();
        if (!classIds.length) {
            window.App.showToast('You have no classes assigned yet. Ask the Academic Office to allocate a class.', 'warning');
            return;
        }
        const firstClass = asg ? asg.classId : classIds[0];
        Lms.openModal(
            `<i class="fas fa-plus-circle" style="color: var(--gold-400);"></i> ${asg ? 'Edit Assignment' : 'Create New Assignment'}`,
            `<div class="form-grid">
                <div class="form-group">
                    <label>Title (English) *</label>
                    <input type="text" id="asg-title" class="form-control" value="${Lms.esc(asg ? asg.title : '')}" placeholder="e.g. Critical Takhrij of Sahih Muslim Narrations">
                </div>
                <div class="form-group">
                    <label>Title (Arabic / Urdu)</label>
                    <input type="text" id="asg-urdu" class="form-control" dir="rtl" value="${Lms.esc(asg ? asg.urduTitle : '')}" placeholder="تخریج و تحقیق احادیث صحیح مسلم">
                </div>
                <div class="form-group">
                    <label>Class *</label>
                    <select id="asg-class" class="form-control" onchange="AssignmentsModule.refreshCourseOptions()">${Lms.classOptions(firstClass, classIds)}</select>
                </div>
                <div class="form-group">
                    <label>Course / Kitab *</label>
                    <select id="asg-course" class="form-control"></select>
                </div>
                <div class="form-group">
                    <label>Due Date *</label>
                    <input type="date" id="asg-due" class="form-control" min="${asg ? '' : Lms.today()}" value="${Lms.esc(asg ? asg.dueDate : Lms.addDays(Lms.today(), 7))}">
                </div>
                <div class="form-group">
                    <label>Max Marks *</label>
                    <input type="number" id="asg-marks" min="1" class="form-control" value="${Lms.esc(asg ? asg.maxMarks : 50)}">
                </div>
            </div>
            <div class="form-group">
                <label>Instructions *</label>
                <textarea id="asg-desc" class="form-control" style="min-height: 110px;" placeholder="Questions, required commentaries, formatting guidelines...">${Lms.esc(asg ? asg.description : '')}</textarea>
            </div>
            <div class="form-group" style="margin-top: 10px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="asg-late" ${!asg || asg.allowLate !== false ? 'checked' : ''} style="width: 18px; height: 18px;">
                    Accept late submissions after the due date (marked as late)
                </label>
            </div>
            <div class="form-group" style="margin-top: 10px;">
                <label>Question Paper / Reference Files (optional)</label>
                ${asg && asg.attachments && asg.attachments.length ? `<div style="margin-bottom: 6px;">${Lms.fileLinks(asg.attachments)}</div>` : ''}
                ${Lms.fileInput('asg-files', { multiple: true, label: asg ? 'Add more files' : 'Attach question paper or reference material' })}
            </div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="AssignmentsModule.saveNewAssignment(this, '${asg ? asg.id : ''}')"><i class="fas fa-paper-plane"></i> ${asg ? 'Save Changes' : 'Publish to Class'}</button>`
        );
        this.refreshCourseOptions(asg ? asg.courseId : null);
    },

    refreshCourseOptions(selected) {
        const classId = Lms.val('asg-class');
        const me = Lms.me();
        let ids = Lms.classCourseIds(classId);
        if (Lms.portal() === 'teacher') {
            const mine = Lms.teacherCourseIds(me.id, classId);
            const cls = Lms.getClass(classId);
            // Class teachers may set work for any kitab of their class
            if (!(cls && cls.teacherId === me.id) && mine.length) ids = mine;
        }
        if (!ids.length) ids = (window.LmsData.courses || []).map(c => c.id);
        const sel = document.getElementById('asg-course');
        if (sel) sel.innerHTML = Lms.courseOptions(selected, ids);
    },

    async saveNewAssignment(btn, asgId) {
        const title = Lms.val('asg-title');
        const desc = document.getElementById('asg-desc').value.trim();
        const due = Lms.val('asg-due');
        const marks = parseInt(Lms.val('asg-marks'), 10);
        if (!title || !desc || !due) {
            window.App.showToast('Title, due date and instructions are required', 'warning');
            return;
        }
        if (!marks || marks < 1) {
            window.App.showToast('Max marks must be at least 1', 'warning');
            return;
        }
        await Lms.busy(btn, async () => {
            const files = await Lms.uploadFromInput('asg-files');
            const me = Lms.me();
            const fields = {
                title,
                urduTitle: Lms.val('asg-urdu') || title,
                classId: Lms.val('asg-class'),
                courseId: Lms.val('asg-course'),
                dueDate: due,
                maxMarks: marks,
                description: desc,
                allowLate: document.getElementById('asg-late').checked
            };
            const existing = asgId ? window.LmsData.assignments.find(a => a.id === asgId) : null;
            if (existing) {
                Object.assign(existing, fields);
                existing.attachments = [...(existing.attachments || []), ...files];
                existing.updatedAt = new Date().toISOString();
            } else {
                const asg = { id: Lms.uid('asg'), teacherId: me.id, createdAt: new Date().toISOString(), attachments: files, ...fields };
                window.LmsData.assignments.unshift(asg);
                Lms.notifyClass(asg.classId, `New Assignment: ${title}`,
                    `${me.name} posted "${title}" for ${Lms.courseTitle(asg.courseId)}. Due ${Lms.fmtDate(due)} • Max marks ${marks}.`, 'ACADEMIC', 'assignments');
            }
            Lms.save();
            window.App.closeModal();
            window.App.showToast(existing ? 'Assignment updated' : 'Assignment published and students notified', 'success');
            window.App.navigate('assignments');
        }, 'Publishing...');
    },

    deleteAssignment(asgId) {
        const asg = (window.LmsData.assignments || []).find(a => a.id === asgId);
        if (!asg) return;
        const subs = this.submissionsFor(asgId).length;
        if (!confirm(`Delete "${asg.title}"?${subs ? `\n\n${subs} student submission(s) will also be deleted.` : ''}`)) return;
        window.LmsData.assignments = window.LmsData.assignments.filter(a => a.id !== asgId);
        window.LmsData.assignmentSubmissions = (window.LmsData.assignmentSubmissions || []).filter(s => s.assignmentId !== asgId);
        Lms.save();
        window.App.showToast('Assignment deleted', 'success');
        window.App.navigate('assignments');
    },

    // ---------------------------------------------------------------------
    // STUDENT SUBMISSION
    // ---------------------------------------------------------------------
    openStudentUploadModal(asgId) {
        const asg = (window.LmsData.assignments || []).find(a => a.id === asgId);
        if (!asg) return;
        const sub = this.mySubmission(asgId);
        if (sub && sub.isGraded) {
            window.App.showToast('This assignment has already been checked.', 'info');
            return;
        }
        const late = asg.dueDate < Lms.today();
        Lms.openModal(
            `<i class="fas fa-upload" style="color: var(--primary-400);"></i> Submit: ${Lms.esc(asg.title)}`,
            `<div style="margin-bottom: 14px; background: var(--bg-surface-elevated); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 0.85rem; color: var(--gold-700); font-weight: 600;">Instructions (Due ${Lms.fmtDate(asg.dueDate)} • Max ${asg.maxMarks} marks)</div>
                <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 4px;">${Lms.multiline(asg.description)}</p>
                ${Lms.fileLinks(asg.attachments)}
            </div>
            ${late ? `<div class="status-pill danger" style="margin-bottom: 12px;"><i class="fas fa-clock"></i> The due date has passed — this will be recorded as a late submission.</div>` : ''}
            <div class="form-group" style="margin-bottom: 16px;">
                <label>Your Answer (Arabic / Urdu / English)</label>
                <textarea id="sub-text" class="form-control" style="min-height: 140px; font-size: 1.02rem;" placeholder="بسم الله الرحمن الرحيم... Write your answer here, and/or upload your work below.">${Lms.esc(sub ? sub.submissionText : '')}</textarea>
            </div>
            <div class="form-group">
                <label>Upload Your Work (PDF, Word, scanned pages / photos)</label>
                ${sub && sub.attachments && sub.attachments.length ? `<div style="margin-bottom: 6px; font-size: 0.8rem;">Already uploaded: ${Lms.fileLinks(sub.attachments)}</div>` : ''}
                ${Lms.fileInput('sub-files', { multiple: true, label: 'Choose file(s) to upload', accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt,.zip' })}
            </div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-primary" onclick="AssignmentsModule.submitStudentWork(this, '${asg.id}')"><i class="fas fa-paper-plane"></i> ${sub ? 'Update Submission' : 'Submit to Teacher'}</button>`
        );
    },

    async submitStudentWork(btn, asgId) {
        const asg = (window.LmsData.assignments || []).find(a => a.id === asgId);
        const text = document.getElementById('sub-text').value.trim();
        const input = document.getElementById('sub-files');
        const hasFiles = input && input.files.length;
        const existing = this.mySubmission(asgId);
        if (!text && !hasFiles && !(existing && existing.attachments && existing.attachments.length)) {
            window.App.showToast('Write your answer or upload at least one file', 'warning');
            return;
        }
        await Lms.busy(btn, async () => {
            const files = await Lms.uploadFromInput('sub-files');
            const me = Lms.me();
            const now = new Date().toISOString();
            const isLate = asg.dueDate < Lms.today();
            if (existing) {
                existing.submissionText = text;
                existing.attachments = [...(existing.attachments || []), ...files];
                existing.submittedAt = now;
                existing.isLate = isLate;
                existing.resubmitRequested = false;
            } else {
                window.LmsData.assignmentSubmissions.unshift({
                    id: Lms.uid('sub'), assignmentId: asgId, studentId: me.id, studentName: me.name, rollNo: me.rollNo || '',
                    submissionText: text, attachments: files, submittedAt: now, isLate,
                    isGraded: false, marksObtained: null, feedback: null
                });
            }
            Lms.save();
            const teacherId = asg.teacherId || Lms.courseTeacherId(asg.classId, asg.courseId);
            Lms.notifyUser(teacherId, `Assignment ${existing ? 'resubmitted' : 'submitted'}: ${asg.title}`,
                `${me.name} (${me.rollNo || ''}) ${existing ? 'updated their' : 'submitted'} work${isLate ? ' (late)' : ''}. Open Assignments to check it.`, 'ACADEMIC', 'assignments');
            window.App.closeModal();
            window.App.showToast('Submitted successfully. Your teacher has been notified.', 'success');
            window.App.navigate('assignments');
        }, 'Uploading...');
    },

    viewSubmission(subId) {
        const sub = (window.LmsData.assignmentSubmissions || []).find(s => s.id === subId);
        if (!sub) return;
        const asg = (window.LmsData.assignments || []).find(a => a.id === sub.assignmentId) || {};
        Lms.openModal(
            `<i class="fas fa-file-alt" style="color: var(--gold-400);"></i> ${Lms.esc(asg.title || 'Submission')}`,
            `<div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 10px;">Submitted ${Lms.fmtDateTime(sub.submittedAt)} ${sub.isLate ? '<span class="status-pill danger">Late</span>' : ''}</div>
            <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 14px; line-height: 1.7; margin-bottom: 10px;">${sub.submissionText ? Lms.multiline(sub.submissionText) : '<em style="color: var(--text-muted);">No text answer</em>'}</div>
            ${Lms.fileLinks(sub.attachments)}
            ${sub.isGraded ? `
                <div style="margin-top: 14px; padding: 12px; background: var(--primary-50); border: 1px solid var(--primary-200); border-radius: var(--radius-sm);">
                    <div><strong>Marks:</strong> ${Lms.esc(sub.marksObtained)} / ${Lms.esc(asg.maxMarks)} — ${Lms.esc(Lms.wifaqGrade(sub.marksObtained / asg.maxMarks * 100).label)}</div>
                    <div style="margin-top: 6px;"><strong>Feedback:</strong> ${Lms.multiline(sub.feedback || '—')}</div>
                    ${sub.returnedFile ? `<div style="margin-top: 6px;"><strong>Checked copy:</strong> ${Lms.fileLinks([sub.returnedFile])}</div>` : ''}
                </div>` : ''}`
        );
    },

    // ---------------------------------------------------------------------
    // TEACHER CHECKING
    // ---------------------------------------------------------------------
    openSubmissionsReviewModal(asgId) {
        const asg = (window.LmsData.assignments || []).find(a => a.id === asgId);
        if (!asg) return;
        const subs = this.submissionsFor(asgId);
        const students = Lms.studentsInClass(asg.classId);
        const rows = students.map(st => ({ st, sub: subs.find(s => s.studentId === st.id) }));
        // Submissions from students who later moved class
        subs.filter(s => !students.some(st => st.id === s.studentId)).forEach(sub => rows.push({ st: { id: sub.studentId, name: sub.studentName, rollNo: sub.rollNo }, sub }));

        Lms.openModal(
            `<i class="fas fa-tasks" style="color: var(--gold-400);"></i> ${Lms.esc(asg.title)}`,
            `<div style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 12px;">
                ${Lms.esc(Lms.className(asg.classId))} • Due ${Lms.fmtDate(asg.dueDate)} • Max ${asg.maxMarks} marks •
                <strong>${subs.length}</strong> of ${students.length} submitted
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead><tr><th>Student</th><th>Status</th><th>Submitted</th><th>Marks</th><th></th></tr></thead>
                    <tbody>
                        ${rows.length ? rows.map(({ st, sub }) => `
                            <tr>
                                <td><strong>${Lms.esc(st.name)}</strong><div style="font-size: 0.72rem; color: var(--gold-700);">${Lms.esc(st.rollNo || '')}</div></td>
                                <td>${!sub ? '<span class="status-pill danger">Not submitted</span>'
                                    : sub.isGraded ? '<span class="status-pill success">Checked</span>'
                                    : sub.resubmitRequested ? '<span class="status-pill warning">Returned for resubmission</span>'
                                    : `<span class="status-pill info">To check</span>${sub.isLate ? ' <span class="status-pill danger" style="font-size: 0.65rem;">Late</span>' : ''}`}</td>
                                <td style="font-size: 0.78rem;">${sub ? Lms.fmtDateTime(sub.submittedAt) : '—'}</td>
                                <td>${sub && sub.isGraded ? `<strong>${Lms.esc(sub.marksObtained)}</strong>/${asg.maxMarks}` : '—'}</td>
                                <td>${sub ? `<button class="btn btn-gold btn-sm" onclick="AssignmentsModule.openGradeSubmissionModal('${sub.id}')">${sub.isGraded ? 'Re-check' : 'Check'}</button>` : ''}</td>
                            </tr>`).join('') : `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No students in this class.</td></tr>`}
                    </tbody>
                </table>
            </div>`,
            `${rows.some(r => !r.sub) ? `<button class="btn btn-secondary" onclick="AssignmentsModule.remindMissing('${asg.id}')"><i class="fas fa-bell"></i> Remind students who haven't submitted</button>` : ''}
             <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>`,
            { wide: true }
        );
    },

    remindMissing(asgId) {
        const asg = (window.LmsData.assignments || []).find(a => a.id === asgId);
        const subs = this.submissionsFor(asgId);
        const missing = Lms.studentsInClass(asg.classId).filter(s => !subs.some(x => x.studentId === s.id));
        Lms.notify(missing.map(s => ({
            targetUserId: s.id, category: 'ACADEMIC', linkRoute: 'assignments',
            title: `Reminder: ${asg.title}`,
            message: `Your assignment "${asg.title}" is due ${Lms.fmtDate(asg.dueDate)}. Please submit it in the portal.`
        })));
        window.App.showToast(`Reminder sent to ${missing.length} student(s)`, 'success');
    },

    openGradeSubmissionModal(subId) {
        const sub = (window.LmsData.assignmentSubmissions || []).find(s => s.id === subId);
        if (!sub) return;
        const asg = (window.LmsData.assignments || []).find(a => a.id === sub.assignmentId) || { maxMarks: 100 };
        if (!this.canCheck(asg)) {
            window.App.showToast('Only the class teacher can check this submission.', 'warning');
            return;
        }
        const max = Number(asg.maxMarks) || 100;
        Lms.openModal(
            `<i class="fas fa-pencil-alt" style="color: var(--gold-400);"></i> Check: ${Lms.esc(sub.studentName)} — ${Lms.esc(asg.title || '')}`,
            `<div style="margin-bottom: 12px; background: var(--bg-surface-elevated); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); font-size: 0.85rem; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                <span><strong>Student:</strong> ${Lms.esc(sub.studentName)} (${Lms.esc(sub.rollNo || '')})</span>
                <span><strong>Submitted:</strong> ${Lms.fmtDateTime(sub.submittedAt)} ${sub.isLate ? '<span class="status-pill danger">Late</span>' : ''}</span>
            </div>
            <div class="form-group" style="margin-bottom: 14px;">
                <label>Student's Answer</label>
                <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-prominent); border-radius: var(--radius-sm); padding: 14px; font-size: 0.95rem; line-height: 1.7; max-height: 220px; overflow-y: auto;">
                    ${sub.submissionText ? Lms.multiline(sub.submissionText) : '<em style="color: var(--text-muted);">No text answer — see uploaded files</em>'}
                </div>
                <div style="margin-top: 8px;">${Lms.fileLinks(sub.attachments)}</div>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Marks Awarded (out of ${max}) *</label>
                    <input type="number" id="grade-marks" class="form-control" min="0" max="${max}" step="0.5" value="${sub.marksObtained !== null && sub.marksObtained !== undefined ? Lms.esc(sub.marksObtained) : ''}"
                        oninput="document.getElementById('grade-preview').textContent = this.value === '' ? '' : Lms.wifaqGrade(this.value / ${max} * 100).label">
                    <div id="grade-preview" style="font-size: 0.8rem; color: var(--primary-700); margin-top: 4px; font-weight: 600;">${sub.isGraded ? Lms.esc(Lms.wifaqGrade(sub.marksObtained / max * 100).label) : ''}</div>
                </div>
                <div class="form-group">
                    <label>Checked Copy (optional)</label>
                    ${sub.returnedFile ? `<div style="margin-bottom: 4px;">${Lms.fileLinks([sub.returnedFile])}</div>` : ''}
                    ${Lms.fileInput('grade-file', { label: 'Upload annotated / corrected copy' })}
                </div>
            </div>
            <div class="form-group">
                <label>Feedback for the Student *</label>
                <textarea id="grade-feedback" class="form-control" placeholder="Corrections, praise or guidance...">${Lms.esc(sub.feedback || '')}</textarea>
            </div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-secondary" onclick="AssignmentsModule.requestResubmission(this, '${sub.id}')"><i class="fas fa-undo"></i> Return for Resubmission</button>
             <button class="btn btn-gold" onclick="AssignmentsModule.saveGradedResult(this, '${sub.id}')"><i class="fas fa-check"></i> Save Marks & Return</button>`,
            { wide: true }
        );
    },

    async saveGradedResult(btn, subId) {
        const sub = (window.LmsData.assignmentSubmissions || []).find(s => s.id === subId);
        if (!sub) return;
        const asg = (window.LmsData.assignments || []).find(a => a.id === sub.assignmentId) || { maxMarks: 100 };
        const max = Number(asg.maxMarks) || 100;
        const raw = Lms.val('grade-marks');
        const marks = parseFloat(raw);
        const feedback = document.getElementById('grade-feedback').value.trim();
        if (raw === '' || isNaN(marks) || marks < 0 || marks > max) {
            window.App.showToast(`Enter marks between 0 and ${max}`, 'warning');
            return;
        }
        if (!feedback) {
            window.App.showToast('Please write feedback for the student', 'warning');
            return;
        }
        await Lms.busy(btn, async () => {
            const files = await Lms.uploadFromInput('grade-file');
            const grade = Lms.wifaqGrade(marks / max * 100);
            Object.assign(sub, {
                isGraded: true, resubmitRequested: false, marksObtained: marks, wifaqGrade: grade.code, feedback,
                gradedBy: Lms.me().id, gradedAt: new Date().toISOString()
            });
            if (files[0]) sub.returnedFile = files[0];
            Lms.save();
            Lms.notifyUser(sub.studentId, `Assignment Checked: ${asg.title}`,
                `You scored ${marks}/${max} (${grade.label}). Feedback: ${feedback.slice(0, 160)}`, 'ACADEMIC', 'assignments');
            window.App.closeModal();
            window.App.showToast(`Marks saved: ${marks}/${max} for ${sub.studentName}`, 'success');
            window.App.navigate('assignments');
        });
    },

    requestResubmission(btn, subId) {
        const sub = (window.LmsData.assignmentSubmissions || []).find(s => s.id === subId);
        if (!sub) return;
        const asg = (window.LmsData.assignments || []).find(a => a.id === sub.assignmentId) || {};
        const feedback = document.getElementById('grade-feedback').value.trim();
        if (!feedback) {
            window.App.showToast('Write what the student should correct before returning it', 'warning');
            return;
        }
        Object.assign(sub, { isGraded: false, resubmitRequested: true, feedback, marksObtained: null, gradedBy: Lms.me().id, gradedAt: new Date().toISOString() });
        Lms.save();
        Lms.notifyUser(sub.studentId, `Resubmission requested: ${asg.title}`, `Your teacher returned your work: ${feedback.slice(0, 180)}`, 'ACADEMIC', 'assignments');
        window.App.closeModal();
        window.App.showToast('Returned to the student for resubmission', 'success');
        window.App.navigate('assignments');
    }
};

window.AssignmentsModule = AssignmentsModule;
