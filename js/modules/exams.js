/**
 * JAMIA ASHRAFIA LAHORE - EXAMINATIONS, ONLINE SUBMISSION, ONLINE MARKING & RESULTS
 * Teachers build question papers (MCQ + written), students attempt timed online papers,
 * MCQs are auto-marked, teachers mark written answers online (or enter marks for hall exams),
 * then results are published to students with Wifaq grades and a printable marksheet.
 */

const ExamsModule = {
    tab: 'exams',          // exams | results
    attempt: null,         // { examId, submissionId, deadline }
    timerHandle: null,
    draft: null,           // exam being edited in the builder

    EXAM_TYPES: {
        WEEKLY_QUIZ: 'Weekly Quiz',
        MONTHLY_TEST: 'Monthly Test',
        SHASHMAHI_MIDTERM: 'Shashmahi (Mid-Term)',
        SALANA_FINAL: 'Salana (Annual)',
        WIFAQ_MOCK: 'Wifaq Mock Board'
    },

    canManage() {
        return Lms.can('exams.create');
    },

    // Within the role's data scope: the whole institution, or classes the teacher teaches / exams they set
    inScope(ex) {
        const portal = Lms.portal();
        if (portal === 'staff') return true;
        const me = Lms.me();
        return portal === 'teacher' && (ex.createdBy === me.id || Lms.teacherClassIds(me.id).includes(ex.classId));
    },

    canManageExam(ex) {
        return this.inScope(ex) && Lms.can('exams.update');
    },

    canExam(ex, permission) {
        return this.inScope(ex) && Lms.can(permission);
    },

    visibleExams() {
        const me = Lms.me();
        const all = window.LmsData.exams || [];
        const portal = Lms.portal();
        if (portal === 'staff') return all;
        if (portal === 'teacher') {
            const ids = Lms.teacherClassIds(me.id);
            return all.filter(e => e.createdBy === me.id || ids.includes(e.classId));
        }
        return all.filter(e => e.classId === me.classId);
    },

    examTotal(ex) {
        const q = ex.questions || [];
        return q.length ? q.reduce((s, x) => s + (Number(x.marks) || 0), 0) : (Number(ex.totalMarks) || 100);
    },

    // Scheduled window [start, end] as Date objects
    window(ex) {
        const start = new Date(`${ex.examDate}T${ex.startTime || '00:00'}:00`);
        const end = new Date(start.getTime() + (Number(ex.durationMinutes) || 60) * 60000);
        return { start, end };
    },

    // Is an online paper accepting attempts right now?
    isOpenNow(ex) {
        if (ex.mode !== 'ONLINE' || ex.status === 'CLOSED') return false;
        if (ex.status === 'OPEN') return true;
        const { start, end } = this.window(ex);
        const now = new Date();
        return now >= start && now <= end;
    },

    submissionOf(examId, studentId) {
        return (window.LmsData.examSubmissions || []).find(s => s.examId === examId && s.studentId === studentId) || null;
    },

    resultOf(examId, studentId) {
        return (window.LmsData.examResults || []).find(r => r.examId === examId && r.studentId === studentId) || null;
    },

    statusPill(ex) {
        if (ex.resultsPublished) return '<span class="status-pill success"><i class="fas fa-bullhorn"></i> Results Published</span>';
        if (ex.status === 'CLOSED') return '<span class="status-pill neutral" style="background: var(--bg-surface-elevated);"><i class="fas fa-lock"></i> Closed</span>';
        if (this.isOpenNow(ex)) return '<span class="status-pill danger"><i class="fas fa-circle"></i> Open Now</span>';
        return '<span class="status-pill gold"><i class="fas fa-clock"></i> Scheduled</span>';
    },

    render() {
        if (this.attempt) return this.renderAttempt();
        const isStudent = Lms.portal() === 'student';
        const exams = this.visibleExams().slice().sort((a, b) => String(b.examDate).localeCompare(String(a.examDate)));

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1><i class="fas fa-award" style="color: var(--gold-400);"></i> ${isStudent ? 'My Exams & Results' : 'Exams, Online Marking & Results'}</h1>
                    <p>${isStudent ? 'Attempt online papers within the allowed time and view your published results' : 'Create question papers, open online exams, mark answers online and publish results'}</p>
                </div>
                <div class="view-actions">
                    ${this.canManage() ? `<button class="btn btn-gold btn-sm" onclick="ExamsModule.openExamEditor()"><i class="fas fa-plus-circle"></i> Create Exam / Quiz</button>` : ''}
                </div>
            </div>

            <div class="tabs-nav">
                <button class="tab-btn ${this.tab === 'exams' ? 'active' : ''}" onclick="ExamsModule.setTab('exams')"><i class="fas fa-file-signature"></i> Exams (${exams.length})</button>
                <button class="tab-btn ${this.tab === 'results' ? 'active' : ''}" onclick="ExamsModule.setTab('results')"><i class="fas fa-scroll"></i> ${isStudent ? 'My Results' : 'Results & Marksheets'}</button>
            </div>

            ${this.tab === 'exams' ? this.renderExamCards(exams) : this.renderResults(exams)}
        `;
    },

    setTab(t) {
        this.tab = t;
        window.App.navigate('exams');
    },

    renderExamCards(exams) {
        const isStudent = Lms.portal() === 'student';
        const me = Lms.me();
        if (!exams.length) {
            return `<div class="card">${window.App.dashEmpty(isStudent ? 'No exams scheduled for your class yet.' : 'No exams yet. Use "Create Exam / Quiz" to add one.')}</div>`;
        }
        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 20px;">
                ${exams.map(ex => {
                    const subs = (window.LmsData.examSubmissions || []).filter(s => s.examId === ex.id && s.status === 'SUBMITTED');
                    const toMark = subs.filter(s => !s.isMarked).length;
                    const mySub = isStudent ? this.submissionOf(ex.id, me.id) : null;
                    const myRes = isStudent ? this.resultOf(ex.id, me.id) : null;
                    const total = this.examTotal(ex);
                    return `
                        <div class="card" style="border-left: 4px solid var(--gold-400); margin: 0; display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 10px;">
                                    <span class="status-pill gold" style="font-size: 0.7rem;">${Lms.esc(this.EXAM_TYPES[ex.examType] || ex.examType)} • ${ex.mode === 'ONLINE' ? 'Online' : 'In Hall'}</span>
                                    ${this.statusPill(ex)}
                                </div>
                                <h3 style="font-size: 1.05rem; color: var(--primary-950); margin-bottom: 4px;">${Lms.esc(ex.title)}</h3>
                                ${ex.urduTitle && ex.urduTitle !== ex.title ? `<div style="font-family: 'Amiri', serif; font-size: 1.1rem; color: var(--gold-700); margin-bottom: 10px;">${Lms.esc(ex.urduTitle)}</div>` : ''}
                                <div style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.7; margin-bottom: 12px;">
                                    <div><i class="fas fa-calendar-alt" style="color: var(--primary-700); width: 18px;"></i> ${Lms.fmtDate(ex.examDate)} at ${Lms.fmtTime(ex.startTime)} • ${Lms.esc(ex.durationMinutes)} min</div>
                                    <div><i class="fas fa-users" style="color: var(--primary-700); width: 18px;"></i> ${Lms.esc(Lms.className(ex.classId))}</div>
                                    <div><i class="fas fa-book" style="color: var(--primary-700); width: 18px;"></i> ${Lms.esc(Lms.courseTitle(ex.courseId))}</div>
                                    <div><i class="fas fa-check-circle" style="color: var(--primary-700); width: 18px;"></i> Total ${total} • Pass ${Lms.esc(ex.passingMarks)} ${ex.mode === 'ONLINE' ? `• ${(ex.questions || []).length} questions` : ''}</div>
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                ${isStudent ? this.studentExamActions(ex, mySub, myRes) : `
                                    ${ex.mode === 'ONLINE' && this.canExam(ex, 'exams.mark') ? `<button class="btn btn-gold btn-sm" style="flex: 1;" onclick="ExamsModule.openSubmissionsModal('${ex.id}')"><i class="fas fa-pen-nib"></i> Online Marking (${subs.length}${toMark ? `, ${toMark} to mark` : ''})</button>` : ''}
                                    <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="ExamsModule.openMarksSheet('${ex.id}')"><i class="fas fa-table"></i> Marks Sheet</button>
                                    ${this.canExam(ex, 'exams.questions.manage') ? `
                                        <button class="btn btn-secondary btn-sm" title="Paper preview" onclick="ExamsModule.viewQuestionPaperModal('${ex.id}')"><i class="fas fa-file-alt"></i></button>` : ''}
                                    ${this.canManageExam(ex) ? `
                                        <button class="btn btn-secondary btn-sm" title="Edit" onclick="ExamsModule.openExamEditor('${ex.id}')"><i class="fas fa-edit"></i></button>` : ''}
                                    ${this.canExam(ex, 'exams.schedule') ? `
                                        ${ex.mode === 'ONLINE' && !ex.resultsPublished ? (ex.status === 'OPEN'
                                            ? `<button class="btn btn-secondary btn-sm" onclick="ExamsModule.setExamStatus('${ex.id}', 'CLOSED')"><i class="fas fa-lock"></i> Close</button>`
                                            : `<button class="btn btn-primary btn-sm" onclick="ExamsModule.setExamStatus('${ex.id}', 'OPEN')"><i class="fas fa-unlock"></i> Open Now</button>`) : ''}` : ''}
                                    ${!ex.resultsPublished && this.canExam(ex, 'exams.results.publish')
                                        ? `<button class="btn btn-primary btn-sm" onclick="ExamsModule.publishResults('${ex.id}')"><i class="fas fa-bullhorn"></i> Publish Results</button>` : ''}
                                    ${ex.resultsPublished && this.canExam(ex, 'exams.results.unpublish')
                                        ? `<button class="btn btn-secondary btn-sm" onclick="ExamsModule.unpublishResults('${ex.id}')"><i class="fas fa-eye-slash"></i> Unpublish</button>` : ''}
                                    ${this.canExam(ex, 'exams.delete') ? `
                                        <button class="btn btn-secondary btn-sm" title="Delete" onclick="ExamsModule.deleteExam('${ex.id}')"><i class="fas fa-trash" style="color: var(--danger);"></i></button>` : ''}
                                `}
                            </div>
                        </div>`;
                }).join('')}
            </div>
        `;
    },

    studentExamActions(ex, sub, res) {
        if (res && res.published) {
            return `<button class="btn btn-gold btn-sm" style="flex: 1;" onclick="ExamsModule.printSanadCertificate('${res.id}')"><i class="fas fa-award"></i> Result: ${Lms.esc(res.marksObtained)}/${Lms.esc(res.totalMarks)}</button>`;
        }
        if (ex.mode !== 'ONLINE') {
            return `<span class="status-pill info" style="flex: 1; justify-content: center;"><i class="fas fa-school"></i> Written exam in hall</span>`;
        }
        if (sub && sub.status === 'SUBMITTED') {
            return `<span class="status-pill success" style="flex: 1; justify-content: center;"><i class="fas fa-check"></i> Submitted ${Lms.fmtDateTime(sub.submittedAt)} — awaiting result</span>`;
        }
        if (sub && sub.status === 'IN_PROGRESS') {
            return `<button class="btn btn-primary btn-sm" style="flex: 1;" onclick="ExamsModule.startAttempt('${ex.id}')"><i class="fas fa-play"></i> Resume Paper</button>`;
        }
        if (this.isOpenNow(ex)) {
            return `<button class="btn btn-primary btn-sm" style="flex: 1;" onclick="ExamsModule.startAttempt('${ex.id}')"><i class="fas fa-pen-nib"></i> Start Paper (${Lms.esc(ex.durationMinutes)} min)</button>`;
        }
        const { start } = this.window(ex);
        return `<span class="status-pill gold" style="flex: 1; justify-content: center;">${new Date() < start ? `Opens ${Lms.fmtDateTime(start)}` : 'Exam window closed'}</span>`;
    },

    // ---------------------------------------------------------------------
    // EXAM BUILDER
    // ---------------------------------------------------------------------
    openExamEditor(examId) {
        const ex = examId ? (window.LmsData.exams || []).find(e => e.id === examId) : null;
        const classIds = Lms.myClassIds();
        if (!classIds.length) {
            window.App.showToast('No classes are assigned to you yet.', 'warning');
            return;
        }
        this.draft = ex ? JSON.parse(JSON.stringify(ex)) : {
            id: null, title: '', urduTitle: '', examType: 'MONTHLY_TEST', mode: 'ONLINE', status: 'SCHEDULED',
            classId: classIds[0], courseId: '', examDate: Lms.addDays(Lms.today(), 7), startTime: '09:00',
            durationMinutes: 60, totalMarks: 100, passingMarks: 40, instructions: '', questions: []
        };
        const d = this.draft;
        Lms.openModal(
            `<i class="fas fa-file-signature" style="color: var(--gold-400);"></i> ${ex ? 'Edit Exam' : 'Create Exam / Quiz'}`,
            `<div class="form-grid">
                <div class="form-group"><label>Exam Title *</label><input type="text" id="ex-title" class="form-control" value="${Lms.esc(d.title)}" placeholder="e.g. Monthly Test: Kitab al-Ilm"></div>
                <div class="form-group"><label>Title (Urdu / Arabic)</label><input type="text" id="ex-urdu" class="form-control" dir="rtl" value="${Lms.esc(d.urduTitle)}"></div>
                <div class="form-group"><label>Exam Type</label>
                    <select id="ex-type" class="form-control">${Object.entries(this.EXAM_TYPES).map(([k, v]) => `<option value="${k}" ${d.examType === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>Mode *</label>
                    <select id="ex-mode" class="form-control" onchange="ExamsModule.toggleModeFields()">
                        <option value="ONLINE" ${d.mode === 'ONLINE' ? 'selected' : ''}>Online (students attempt in portal)</option>
                        <option value="OFFLINE" ${d.mode === 'OFFLINE' ? 'selected' : ''}>In Hall (marks entered online)</option>
                    </select>
                </div>
                <div class="form-group"><label>Class *</label>
                    <select id="ex-class" class="form-control" onchange="ExamsModule.refreshExamCourses()">${Lms.classOptions(d.classId, classIds)}</select>
                </div>
                <div class="form-group"><label>Course / Kitab *</label><select id="ex-course" class="form-control"></select></div>
                <div class="form-group"><label>Exam Date *</label><input type="date" id="ex-date" class="form-control" value="${Lms.esc(d.examDate)}"></div>
                <div class="form-group"><label>Start Time *</label><input type="time" id="ex-time" class="form-control" value="${Lms.esc(d.startTime)}"></div>
                <div class="form-group"><label>Duration (minutes) *</label><input type="number" id="ex-duration" min="5" class="form-control" value="${Lms.esc(d.durationMinutes)}"></div>
                <div class="form-group" id="ex-total-group"><label>Total Marks *</label><input type="number" id="ex-total" min="1" class="form-control" value="${Lms.esc(d.totalMarks)}"></div>
                <div class="form-group"><label>Passing Marks *</label><input type="number" id="ex-pass" min="0" class="form-control" value="${Lms.esc(d.passingMarks)}"></div>
            </div>
            <div class="form-group"><label>Instructions for Students</label><textarea id="ex-instr" class="form-control" placeholder="Attempt all questions...">${Lms.esc(d.instructions || '')}</textarea></div>

            <div id="ex-questions-block" style="margin-top: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                    <h4 style="color: var(--primary-950);"><i class="fas fa-list-ol"></i> Question Paper <span id="ex-q-total" style="font-size: 0.8rem; color: var(--text-muted);"></span></h4>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn btn-secondary btn-sm" onclick="ExamsModule.addQuestion('MCQ')"><i class="fas fa-list-ul"></i> Add MCQ</button>
                        <button class="btn btn-secondary btn-sm" onclick="ExamsModule.addQuestion('WRITTEN')"><i class="fas fa-align-left"></i> Add Written Question</button>
                    </div>
                </div>
                <div id="ex-questions"></div>
            </div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="ExamsModule.saveExam()"><i class="fas fa-save"></i> ${ex ? 'Save Exam' : 'Create Exam'}</button>`,
            { wide: true }
        );
        this.refreshExamCourses(d.courseId);
        this.renderQuestionEditors();
        this.toggleModeFields();
    },

    toggleModeFields() {
        const online = Lms.val('ex-mode') === 'ONLINE';
        document.getElementById('ex-questions-block').style.display = online ? '' : 'none';
        document.getElementById('ex-total-group').style.display = online ? 'none' : '';
    },

    refreshExamCourses(selected) {
        const classId = Lms.val('ex-class');
        const me = Lms.me();
        let ids = Lms.classCourseIds(classId);
        if (Lms.portal() === 'teacher') {
            const mine = Lms.teacherCourseIds(me.id, classId);
            const cls = Lms.getClass(classId);
            if (!(cls && cls.teacherId === me.id) && mine.length) ids = mine;
        }
        if (!ids.length) ids = (window.LmsData.courses || []).map(c => c.id);
        document.getElementById('ex-course').innerHTML = Lms.courseOptions(selected, ids);
    },

    // Keep typed values in the draft before re-rendering the question list
    readQuestionEditors() {
        (this.draft.questions || []).forEach((q, i) => {
            const t = document.getElementById(`q-text-${i}`);
            if (!t) return;
            q.text = t.value;
            q.marks = Number(document.getElementById(`q-marks-${i}`).value) || 0;
            if (q.type === 'MCQ') {
                q.options = [0, 1, 2, 3].map(o => document.getElementById(`q-opt-${i}-${o}`).value);
                const checked = document.querySelector(`input[name="q-correct-${i}"]:checked`);
                q.correctIndex = checked ? Number(checked.value) : null;
            }
        });
    },

    renderQuestionEditors() {
        const box = document.getElementById('ex-questions');
        if (!box) return;
        const qs = this.draft.questions || [];
        document.getElementById('ex-q-total').textContent = qs.length ? `(${qs.length} questions • ${qs.reduce((s, q) => s + (Number(q.marks) || 0), 0)} marks)` : '';
        box.innerHTML = qs.length ? qs.map((q, i) => `
            <div style="border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 10px; background: var(--bg-surface-elevated);">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <strong>Q${i + 1} • ${q.type === 'MCQ' ? 'Multiple Choice (auto-marked)' : 'Written Answer (marked by teacher)'}</strong>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <label style="font-size: 0.78rem;">Marks</label>
                        <input type="number" id="q-marks-${i}" min="0" class="form-control" style="width: 80px;" value="${Lms.esc(q.marks)}" oninput="ExamsModule.readQuestionEditors(); document.getElementById('ex-q-total').textContent = '(' + ExamsModule.draft.questions.length + ' questions • ' + ExamsModule.draft.questions.reduce((s, q) => s + (Number(q.marks) || 0), 0) + ' marks)'">
                        <button class="btn btn-secondary btn-sm" onclick="ExamsModule.removeQuestion(${i})"><i class="fas fa-trash" style="color: var(--danger);"></i></button>
                    </div>
                </div>
                <textarea id="q-text-${i}" class="form-control" style="min-height: 60px;" placeholder="Question text (Arabic / Urdu / English)">${Lms.esc(q.text)}</textarea>
                ${q.type === 'MCQ' ? `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px; margin-top: 8px;">
                        ${[0, 1, 2, 3].map(o => `
                            <label style="display: flex; align-items: center; gap: 6px;">
                                <input type="radio" name="q-correct-${i}" value="${o}" ${q.correctIndex === o ? 'checked' : ''} title="Mark as correct answer">
                                <input type="text" id="q-opt-${i}-${o}" class="form-control" placeholder="Option ${String.fromCharCode(65 + o)}" value="${Lms.esc((q.options || [])[o] || '')}">
                            </label>`).join('')}
                    </div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">Select the radio button next to the correct option.</div>` : ''}
            </div>`).join('') : `<div style="font-size: 0.85rem; color: var(--text-muted); padding: 10px;">No questions yet. Add MCQs (marked automatically) and/or written questions.</div>`;
    },

    addQuestion(type) {
        this.readQuestionEditors();
        this.draft.questions.push(type === 'MCQ'
            ? { id: Lms.uid('q'), type, marks: 2, text: '', options: ['', '', '', ''], correctIndex: null }
            : { id: Lms.uid('q'), type, marks: 10, text: '' });
        this.renderQuestionEditors();
    },

    removeQuestion(i) {
        this.readQuestionEditors();
        this.draft.questions.splice(i, 1);
        this.renderQuestionEditors();
    },

    saveExam() {
        this.readQuestionEditors();
        const d = this.draft;
        Object.assign(d, {
            title: Lms.val('ex-title'), urduTitle: Lms.val('ex-urdu'), examType: Lms.val('ex-type'), mode: Lms.val('ex-mode'),
            classId: Lms.val('ex-class'), courseId: Lms.val('ex-course'), examDate: Lms.val('ex-date'), startTime: Lms.val('ex-time'),
            durationMinutes: parseInt(Lms.val('ex-duration'), 10) || 0, passingMarks: Number(Lms.val('ex-pass')) || 0,
            instructions: document.getElementById('ex-instr').value.trim()
        });
        if (!d.title || !d.examDate || !d.startTime || d.durationMinutes < 5) {
            window.App.showToast('Title, date, start time and a duration of at least 5 minutes are required', 'warning');
            return;
        }
        if (d.mode === 'ONLINE') {
            if (!d.questions.length) {
                window.App.showToast('Add at least one question for an online exam', 'warning');
                return;
            }
            const bad = d.questions.findIndex(q => !q.text.trim() || !(Number(q.marks) > 0)
                || (q.type === 'MCQ' && (q.options.filter(o => o.trim()).length < 2 || q.correctIndex === null || !String(q.options[q.correctIndex] || '').trim())));
            if (bad >= 0) {
                window.App.showToast(`Question ${bad + 1} is incomplete (text, marks, at least 2 options and the correct option are required)`, 'warning');
                return;
            }
            d.totalMarks = this.examTotal(d);
        } else {
            d.totalMarks = Number(Lms.val('ex-total')) || 0;
            if (d.totalMarks < 1) {
                window.App.showToast('Total marks are required', 'warning');
                return;
            }
        }
        if (d.passingMarks > d.totalMarks) {
            window.App.showToast('Passing marks cannot exceed total marks', 'warning');
            return;
        }
        const isNew = !d.id;
        if (isNew) {
            d.id = Lms.uid('ex');
            d.createdBy = Lms.me().id;
            d.createdAt = new Date().toISOString();
            d.resultsPublished = false;
            d.session = d.session || (window.LmsData.sessions && window.LmsData.sessions[0] ? window.LmsData.sessions[0].name : '');
            window.LmsData.exams.unshift(d);
        } else {
            const i = window.LmsData.exams.findIndex(e => e.id === d.id);
            window.LmsData.exams[i] = d;
        }
        Lms.save();
        Lms.notifyClass(d.classId, `${isNew ? 'Exam Scheduled' : 'Exam Updated'}: ${d.title}`,
            `${this.EXAM_TYPES[d.examType] || 'Exam'} for ${Lms.courseTitle(d.courseId)} on ${Lms.fmtDate(d.examDate)} at ${Lms.fmtTime(d.startTime)} (${d.durationMinutes} min, ${d.mode === 'ONLINE' ? 'online in the portal' : 'in the exam hall'}).`, 'EXAM', 'exams');
        this.draft = null;
        window.App.closeModal();
        window.App.showToast(isNew ? 'Exam created and class notified' : 'Exam updated', 'success');
        window.App.navigate('exams');
    },

    setExamStatus(examId, status) {
        const ex = (window.LmsData.exams || []).find(e => e.id === examId);
        if (!ex) return;
        ex.status = status;
        Lms.save();
        if (status === 'OPEN') {
            Lms.notifyClass(ex.classId, `Exam Open Now: ${ex.title}`, `The online paper is open. You have ${ex.durationMinutes} minutes once you start.`, 'EXAM', 'exams');
        }
        window.App.showToast(status === 'OPEN' ? 'Exam opened for students' : 'Exam closed — no new attempts', 'success');
        window.App.navigate('exams');
    },

    deleteExam(examId) {
        const ex = (window.LmsData.exams || []).find(e => e.id === examId);
        if (!ex || !confirm(`Delete "${ex.title}" with all its submissions and results?`)) return;
        window.LmsData.exams = window.LmsData.exams.filter(e => e.id !== examId);
        window.LmsData.examSubmissions = (window.LmsData.examSubmissions || []).filter(s => s.examId !== examId);
        window.LmsData.examResults = (window.LmsData.examResults || []).filter(r => r.examId !== examId);
        Lms.save();
        window.App.showToast('Exam deleted', 'success');
        window.App.navigate('exams');
    },

    // ---------------------------------------------------------------------
    // STUDENT ATTEMPT (timed, autosaved, auto-submitted on timeout)
    // ---------------------------------------------------------------------
    draftKey(examId) {
        return `JAMIA_EXAM_DRAFT_${Lms.me().id}_${examId}`;
    },

    startAttempt(examId) {
        const ex = (window.LmsData.exams || []).find(e => e.id === examId);
        const me = Lms.me();
        if (!ex) return;
        let sub = this.submissionOf(examId, me.id);
        if (sub && sub.status === 'SUBMITTED') {
            window.App.showToast('You have already submitted this paper.', 'info');
            return;
        }
        if (!sub) {
            if (!this.isOpenNow(ex)) {
                window.App.showToast('This exam is not open right now.', 'warning');
                return;
            }
            if (!confirm(`Start "${ex.title}" now?\n\nYou will have ${ex.durationMinutes} minutes. The timer cannot be paused and the paper is submitted automatically when time is up.`)) return;
            sub = {
                id: Lms.uid('exsub'), examId, studentId: me.id, studentName: me.name, rollNo: me.rollNo || '',
                status: 'IN_PROGRESS', startedAt: new Date().toISOString(), answers: {}
            };
            window.LmsData.examSubmissions = window.LmsData.examSubmissions || [];
            window.LmsData.examSubmissions.push(sub);
            Lms.save();
        }
        const started = new Date(sub.startedAt).getTime();
        let deadline = started + (Number(ex.durationMinutes) || 60) * 60000;
        // A scheduled paper cannot run past its window (unless the teacher opened it manually)
        if (ex.status !== 'OPEN') deadline = Math.min(deadline, this.window(ex).end.getTime());
        this.attempt = { examId, submissionId: sub.id, deadline };
        window.App.navigate('exams');
        this.startTimer();
    },

    renderAttempt() {
        const ex = (window.LmsData.exams || []).find(e => e.id === this.attempt.examId);
        const sub = (window.LmsData.examSubmissions || []).find(s => s.id === this.attempt.submissionId);
        if (!ex || !sub) {
            this.attempt = null;
            return this.render();
        }
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(this.draftKey(ex.id)) || '{}'); } catch (e) { saved = {}; }
        const answers = { ...(sub.answers || {}), ...saved };
        return `
            <div style="position: sticky; top: 0; z-index: 20; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; background: var(--bg-surface); border: 1px solid var(--border-prominent); border-radius: var(--radius-md); padding: 12px 18px; margin-bottom: 18px; box-shadow: var(--shadow-md);">
                <div>
                    <div style="font-weight: 800; color: var(--primary-950);">${Lms.esc(ex.title)}</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted);">${Lms.esc(Lms.courseTitle(ex.courseId))} • ${this.examTotal(ex)} marks • answers are saved automatically</div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div id="exam-timer" style="font-family: monospace; font-size: 1.4rem; font-weight: 800; color: var(--danger);"><i class="fas fa-stopwatch"></i> --:--</div>
                    <button class="btn btn-primary" onclick="ExamsModule.submitExamPaper(false)"><i class="fas fa-check-circle"></i> Submit Paper</button>
                </div>
            </div>
            ${ex.instructions ? `<div class="card" style="background: var(--gold-50); border-left: 4px solid var(--gold-500);"><strong>Instructions:</strong> ${Lms.multiline(ex.instructions)}</div>` : ''}
            ${(ex.questions || []).map((q, i) => `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 10px;">
                        <h4 style="color: var(--gold-700);">Question ${i + 1}</h4>
                        <span class="status-pill gold">${Lms.esc(q.marks)} marks</span>
                    </div>
                    <p style="font-size: 1.1rem; color: var(--primary-950); line-height: 1.9; margin-bottom: 12px;" dir="auto">${Lms.multiline(q.text)}</p>
                    ${q.type === 'MCQ' ? `
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${(q.options || []).map((opt, o) => opt ? `
                                <label style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); cursor: pointer;">
                                    <input type="radio" name="ans-${q.id}" value="${o}" ${String(answers[q.id]) === String(o) ? 'checked' : ''} onchange="ExamsModule.saveAnswer('${q.id}', ${o})" style="width: 18px; height: 18px;">
                                    <span dir="auto"><strong>${String.fromCharCode(65 + o)}.</strong> ${Lms.esc(opt)}</span>
                                </label>` : '').join('')}
                        </div>` : `
                        <textarea class="form-control" dir="auto" style="min-height: 160px; font-size: 1.05rem;" placeholder="Write your answer here..."
                            oninput="ExamsModule.saveAnswer('${q.id}', this.value)">${Lms.esc(answers[q.id] || '')}</textarea>`}
                </div>`).join('')}
            <div style="text-align: center; margin: 20px 0 40px;">
                <button class="btn btn-primary" onclick="ExamsModule.submitExamPaper(false)"><i class="fas fa-check-circle"></i> Submit Final Paper</button>
            </div>
        `;
    },

    saveAnswer(qid, value) {
        if (!this.attempt) return;
        const key = this.draftKey(this.attempt.examId);
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { saved = {}; }
        saved[qid] = value;
        localStorage.setItem(key, JSON.stringify(saved));
        // Periodically checkpoint answers to the server so a crash or device change loses little
        clearTimeout(this.checkpointHandle);
        this.checkpointHandle = setTimeout(() => {
            const sub = (window.LmsData.examSubmissions || []).find(s => s.id === this.attempt?.submissionId);
            if (sub && sub.status === 'IN_PROGRESS') {
                sub.answers = { ...(sub.answers || {}), ...saved };
                Lms.save();
            }
        }, 5000);
    },

    startTimer() {
        clearInterval(this.timerHandle);
        const tick = () => {
            if (!this.attempt) {
                clearInterval(this.timerHandle);
                return;
            }
            const left = this.attempt.deadline - Date.now();
            const el = document.getElementById('exam-timer');
            if (left <= 0) {
                clearInterval(this.timerHandle);
                window.App.showToast('Time is up — your paper is being submitted.', 'warning');
                this.submitExamPaper(true);
                return;
            }
            if (el) {
                const s = Math.floor(left / 1000);
                const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
                el.innerHTML = `<i class="fas fa-stopwatch"></i> ${hh ? hh + ':' : ''}${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
                el.style.color = left < 5 * 60000 ? 'var(--danger)' : 'var(--primary-800)';
            }
        };
        tick();
        this.timerHandle = setInterval(tick, 1000);
    },

    submitExamPaper(auto) {
        if (!this.attempt) return;
        const ex = (window.LmsData.exams || []).find(e => e.id === this.attempt.examId);
        const sub = (window.LmsData.examSubmissions || []).find(s => s.id === this.attempt.submissionId);
        if (!ex || !sub) return;
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(this.draftKey(ex.id)) || '{}'); } catch (e) { saved = {}; }
        const answers = { ...(sub.answers || {}), ...saved };
        if (!auto) {
            const unanswered = (ex.questions || []).filter(q => answers[q.id] === undefined || answers[q.id] === '').length;
            if (!confirm(`Submit your paper now?${unanswered ? `\n\n${unanswered} question(s) are unanswered.` : ''}\n\nYou cannot change answers after submitting.`)) return;
        }
        Object.assign(sub, { answers, status: 'SUBMITTED', submittedAt: new Date().toISOString(), autoSubmitted: !!auto });
        Lms.save();
        window.DataStore.syncNow();
        localStorage.removeItem(this.draftKey(ex.id));
        clearInterval(this.timerHandle);
        clearTimeout(this.checkpointHandle);
        this.attempt = null;
        const teacherId = ex.createdBy || Lms.courseTeacherId(ex.classId, ex.courseId);
        Lms.notifyUser(teacherId, `Exam paper submitted: ${ex.title}`, `${sub.studentName} (${sub.rollNo}) submitted their online paper${auto ? ' (auto-submitted at time-out)' : ''}.`, 'EXAM', 'exams');
        window.App.showToast('Your paper has been submitted. Results will appear once published.', 'success');
        window.App.navigate('exams');
    },

    // ---------------------------------------------------------------------
    // ONLINE MARKING
    // ---------------------------------------------------------------------
    autoMarks(ex, sub) {
        const marks = {};
        (ex.questions || []).forEach(q => {
            if (q.type === 'MCQ') marks[q.id] = String(sub.answers?.[q.id]) === String(q.correctIndex) ? Number(q.marks) : 0;
        });
        return marks;
    },

    openSubmissionsModal(examId) {
        const ex = (window.LmsData.exams || []).find(e => e.id === examId);
        if (!ex) return;
        const subs = (window.LmsData.examSubmissions || []).filter(s => s.examId === examId);
        const students = Lms.studentsInClass(ex.classId);
        const total = this.examTotal(ex);
        const onlyMcq = (ex.questions || []).every(q => q.type === 'MCQ');
        Lms.openModal(
            `<i class="fas fa-pen-nib" style="color: var(--gold-400);"></i> Online Marking: ${Lms.esc(ex.title)}`,
            `<div style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 12px;">
                ${Lms.esc(Lms.className(ex.classId))} • ${subs.filter(s => s.status === 'SUBMITTED').length} submitted of ${students.length} • Total ${total} marks
                ${onlyMcq ? ' • <strong>MCQ-only paper:</strong> use "Auto-mark all" to mark every submission instantly.' : ''}
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead><tr><th>Student</th><th>Status</th><th>Submitted</th><th>Marks</th><th></th></tr></thead>
                    <tbody>
                        ${students.map(st => {
                            const s = subs.find(x => x.studentId === st.id);
                            return `
                                <tr>
                                    <td><strong>${Lms.esc(st.name)}</strong><div style="font-size: 0.72rem; color: var(--gold-700);">${Lms.esc(st.rollNo || '')}</div></td>
                                    <td>${!s ? '<span class="status-pill danger">Not attempted</span>' : s.status === 'IN_PROGRESS' ? '<span class="status-pill warning">Writing now</span>' : s.isMarked ? '<span class="status-pill success">Marked</span>' : '<span class="status-pill info">To mark</span>'}</td>
                                    <td style="font-size: 0.78rem;">${s && s.submittedAt ? Lms.fmtDateTime(s.submittedAt) + (s.autoSubmitted ? ' (timed out)' : '') : '—'}</td>
                                    <td>${s && s.isMarked ? `<strong>${Lms.esc(s.marksObtained)}</strong>/${total}` : '—'}</td>
                                    <td>${s && s.status === 'SUBMITTED' ? `<button class="btn btn-gold btn-sm" onclick="ExamsModule.openMarkSubmissionModal('${s.id}')">${s.isMarked ? 'Review' : 'Mark'}</button>` : ''}</td>
                                </tr>`;
                        }).join('') || `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No students in this class.</td></tr>`}
                    </tbody>
                </table>
            </div>`,
            `${onlyMcq ? `<button class="btn btn-primary" onclick="ExamsModule.autoMarkAll('${ex.id}')"><i class="fas fa-magic"></i> Auto-mark all</button>` : ''}
             <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>`,
            { wide: true }
        );
    },

    autoMarkAll(examId) {
        const ex = (window.LmsData.exams || []).find(e => e.id === examId);
        const subs = (window.LmsData.examSubmissions || []).filter(s => s.examId === examId && s.status === 'SUBMITTED' && !s.isMarked);
        subs.forEach(sub => this.applyMarks(ex, sub, this.autoMarks(ex, sub), 'Auto-marked (MCQ)'));
        Lms.save();
        window.App.showToast(`${subs.length} paper(s) marked automatically`, 'success');
        this.openSubmissionsModal(examId);
    },

    openMarkSubmissionModal(subId) {
        const sub = (window.LmsData.examSubmissions || []).find(s => s.id === subId);
        const ex = sub && (window.LmsData.exams || []).find(e => e.id === sub.examId);
        if (!sub || !ex) return;
        if (!this.canExam(ex, 'exams.mark')) {
            window.App.showToast('Only the exam\'s teacher can mark this paper.', 'warning');
            return;
        }
        const auto = this.autoMarks(ex, sub);
        const existing = sub.questionMarks || {};
        Lms.openModal(
            `<i class="fas fa-pen-nib" style="color: var(--gold-400);"></i> Mark Paper: ${Lms.esc(sub.studentName)}`,
            `<div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 12px;">${Lms.esc(ex.title)} • Submitted ${Lms.fmtDateTime(sub.submittedAt)} • Total ${this.examTotal(ex)} marks</div>
            ${(ex.questions || []).map((q, i) => {
                const ans = sub.answers ? sub.answers[q.id] : undefined;
                const val = existing[q.id] !== undefined ? existing[q.id] : (auto[q.id] !== undefined ? auto[q.id] : '');
                return `
                    <div style="border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 6px;">
                            <strong>Q${i + 1}.</strong>
                            <span style="font-size: 0.78rem; color: var(--text-muted);">${q.type === 'MCQ' ? 'MCQ — auto-marked' : 'Written'}</span>
                        </div>
                        <div dir="auto" style="margin-bottom: 8px; color: var(--primary-950);">${Lms.multiline(q.text)}</div>
                        ${q.type === 'MCQ' ? `
                            <div style="font-size: 0.85rem;">
                                Answer: <strong>${ans === undefined || ans === '' ? '<em>not answered</em>' : Lms.esc(String.fromCharCode(65 + Number(ans)) + '. ' + (q.options[Number(ans)] || ''))}</strong>
                                ${String(ans) === String(q.correctIndex) ? '<span class="status-pill success">Correct</span>' : `<span class="status-pill danger">Wrong</span> <span style="color: var(--text-muted);">Correct: ${Lms.esc(String.fromCharCode(65 + q.correctIndex) + '. ' + (q.options[q.correctIndex] || ''))}</span>`}
                            </div>` : `
                            <div dir="auto" style="background: var(--bg-surface-elevated); border-radius: var(--radius-sm); padding: 10px; max-height: 200px; overflow-y: auto; line-height: 1.7;">${ans ? Lms.multiline(ans) : '<em style="color: var(--text-muted);">Not answered</em>'}</div>`}
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                            <label style="font-size: 0.82rem;">Marks</label>
                            <input type="number" class="form-control mark-input" data-qid="${q.id}" data-max="${q.marks}" min="0" max="${q.marks}" step="0.5" style="width: 90px;" value="${Lms.esc(val)}"
                                oninput="ExamsModule.updateMarkTotal(${this.examTotal(ex)})">
                            <span style="font-size: 0.82rem; color: var(--text-muted);">/ ${q.marks}</span>
                        </div>
                    </div>`;
            }).join('')}
            <div style="display: flex; justify-content: space-between; align-items: center; margin: 10px 0; font-weight: 700;">
                <span>Total</span><span id="mark-total"></span>
            </div>
            <div class="form-group"><label>Examiner Remarks</label><textarea id="mark-remarks" class="form-control">${Lms.esc(sub.remarks || '')}</textarea></div>`,
            `<button class="btn btn-secondary" onclick="ExamsModule.openSubmissionsModal('${ex.id}')">Back</button>
             <button class="btn btn-gold" onclick="ExamsModule.saveSubmissionMarks('${sub.id}')"><i class="fas fa-save"></i> Save Marks</button>`,
            { wide: true }
        );
        this.updateMarkTotal(this.examTotal(ex));
    },

    updateMarkTotal(total) {
        let sum = 0;
        document.querySelectorAll('.mark-input').forEach(i => { sum += Number(i.value) || 0; });
        const el = document.getElementById('mark-total');
        if (el) el.textContent = `${sum} / ${total} — ${Lms.wifaqGrade(sum / total * 100).label}`;
    },

    saveSubmissionMarks(subId) {
        const sub = (window.LmsData.examSubmissions || []).find(s => s.id === subId);
        const ex = sub && (window.LmsData.exams || []).find(e => e.id === sub.examId);
        if (!sub || !ex) return;
        const marks = {};
        let invalid = null;
        document.querySelectorAll('.mark-input').forEach(i => {
            const v = i.value === '' ? NaN : Number(i.value);
            if (isNaN(v) || v < 0 || v > Number(i.dataset.max)) invalid = i;
            marks[i.dataset.qid] = v;
        });
        if (invalid) {
            invalid.focus();
            window.App.showToast(`Each question needs marks between 0 and its maximum`, 'warning');
            return;
        }
        this.applyMarks(ex, sub, marks, document.getElementById('mark-remarks').value.trim());
        Lms.save();
        window.App.showToast(`Marks saved for ${sub.studentName}`, 'success');
        this.openSubmissionsModal(ex.id);
    },

    // Store marks on the submission and the result ledger
    applyMarks(ex, sub, questionMarks, remarks) {
        const total = this.examTotal(ex);
        const obtained = Object.values(questionMarks).reduce((s, v) => s + (Number(v) || 0), 0);
        Object.assign(sub, {
            isMarked: true, questionMarks, marksObtained: obtained, remarks,
            markedBy: Lms.me().id, markedAt: new Date().toISOString()
        });
        this.upsertResult(ex, { id: sub.studentId, name: sub.studentName, rollNo: sub.rollNo }, obtained, remarks);
    },

    upsertResult(ex, student, obtained, remarks) {
        const total = this.examTotal(ex);
        const grade = Lms.wifaqGrade(obtained / total * 100);
        window.LmsData.examResults = window.LmsData.examResults || [];
        let res = this.resultOf(ex.id, student.id);
        if (!res) {
            res = {
                id: `res_${ex.id}_${student.id}`, examId: ex.id, studentId: student.id,
                sanadNumber: `ASH-RES-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
            };
            window.LmsData.examResults.push(res);
        }
        Object.assign(res, {
            studentName: student.name, rollNo: student.rollNo || '', marksObtained: obtained, totalMarks: total,
            percentage: Math.round(obtained / total * 1000) / 10, passed: obtained >= Number(ex.passingMarks || 0),
            wifaqGrade: grade.code, urduGrade: `${grade.urdu} (${grade.label})`, examinerRemarks: remarks || '',
            published: !!ex.resultsPublished, markedBy: Lms.me().id, markedAt: new Date().toISOString()
        });
        return res;
    },

    // Marks entry for hall exams (and override for online ones)
    openMarksSheet(examId) {
        const ex = (window.LmsData.exams || []).find(e => e.id === examId);
        if (!ex) return;
        const total = this.examTotal(ex);
        const students = Lms.studentsInClass(ex.classId);
        const canEdit = this.canExam(ex, 'exams.mark');
        Lms.openModal(
            `<i class="fas fa-table" style="color: var(--gold-400);"></i> Marks Sheet: ${Lms.esc(ex.title)}`,
            `<div style="background: var(--bg-surface-elevated); padding: 10px 12px; border-radius: var(--radius-sm); margin-bottom: 14px; font-size: 0.82rem;">
                <strong>Scale:</strong> Mumtaz ≥80% • Jayyid Jiddan 70–79% • Jayyid 60–69% • Maqbool 40–59% • Rasib &lt;40% • Total ${total}, pass ${Lms.esc(ex.passingMarks)}
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead><tr><th>Student</th><th>Roll No</th><th>Marks (/${total})</th><th>Remarks</th></tr></thead>
                    <tbody>
                        ${students.length ? students.map(s => {
                            const r = this.resultOf(ex.id, s.id);
                            return `
                                <tr>
                                    <td><strong>${Lms.esc(s.name)}</strong></td>
                                    <td>${Lms.esc(s.rollNo || '')}</td>
                                    <td><input type="number" class="form-control sheet-mark" data-sid="${Lms.esc(s.id)}" min="0" max="${total}" step="0.5" style="width: 90px;" value="${r ? Lms.esc(r.marksObtained) : ''}" ${canEdit ? '' : 'disabled'}></td>
                                    <td><input type="text" class="form-control sheet-rem" data-sid="${Lms.esc(s.id)}" style="min-width: 200px;" value="${r ? Lms.esc(r.examinerRemarks || '') : ''}" ${canEdit ? '' : 'disabled'}></td>
                                </tr>`;
                        }).join('') : `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No students in this class.</td></tr>`}
                    </tbody>
                </table>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px;">Leave marks empty for absent students. Results stay private until you press "Publish Results".</div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
             ${canEdit && students.length ? `<button class="btn btn-gold" onclick="ExamsModule.saveExaminerMarks('${ex.id}')"><i class="fas fa-save"></i> Save Marks</button>` : ''}`,
            { wide: true }
        );
    },

    saveExaminerMarks(examId) {
        const ex = (window.LmsData.exams || []).find(e => e.id === examId);
        const total = this.examTotal(ex);
        let saved = 0;
        for (const input of document.querySelectorAll('.sheet-mark')) {
            if (input.value === '') continue;
            const v = Number(input.value);
            if (isNaN(v) || v < 0 || v > total) {
                input.focus();
                window.App.showToast(`Marks must be between 0 and ${total}`, 'warning');
                return;
            }
            const st = Lms.user(input.dataset.sid);
            const rem = document.querySelector(`.sheet-rem[data-sid="${input.dataset.sid}"]`).value.trim();
            this.upsertResult(ex, { id: st.id, name: st.name, rollNo: st.rollNo }, v, rem);
            const sub = this.submissionOf(ex.id, st.id);
            if (sub && sub.status === 'SUBMITTED' && !sub.isMarked) Object.assign(sub, { isMarked: true, marksObtained: v, remarks: rem });
            saved++;
        }
        Lms.save();
        window.App.closeModal();
        window.App.showToast(`Marks saved for ${saved} student(s)${ex.resultsPublished ? '' : ' — publish when ready'}`, 'success');
        window.App.navigate('exams');
    },

    publishResults(examId) {
        const ex = (window.LmsData.exams || []).find(e => e.id === examId);
        const results = (window.LmsData.examResults || []).filter(r => r.examId === examId);
        if (!results.length) {
            window.App.showToast('No marks entered yet. Mark papers or fill the marks sheet first.', 'warning');
            return;
        }
        const unmarked = (window.LmsData.examSubmissions || []).filter(s => s.examId === examId && s.status === 'SUBMITTED' && !s.isMarked).length;
        if (!confirm(`Publish results of "${ex.title}" to ${results.length} student(s)?${unmarked ? `\n\nWarning: ${unmarked} submitted paper(s) are still unmarked.` : ''}`)) return;
        ex.resultsPublished = true;
        ex.status = 'CLOSED';
        results.forEach(r => { r.published = true; });
        Lms.save();
        Lms.notify(results.map(r => ({
            targetUserId: r.studentId, category: 'EXAM', linkRoute: 'exams',
            title: `Result Published: ${ex.title}`,
            message: `You obtained ${r.marksObtained}/${r.totalMarks} (${r.percentage}%) — ${Lms.wifaqGrade(r.percentage).label}.`
        })));
        window.App.showToast('Results published and students notified', 'success');
        window.App.navigate('exams');
    },

    unpublishResults(examId) {
        const ex = (window.LmsData.exams || []).find(e => e.id === examId);
        if (!ex || !confirm('Hide these results from students again?')) return;
        ex.resultsPublished = false;
        (window.LmsData.examResults || []).filter(r => r.examId === examId).forEach(r => { r.published = false; });
        Lms.save();
        window.App.navigate('exams');
    },

    // ---------------------------------------------------------------------
    // RESULTS
    // ---------------------------------------------------------------------
    renderResults(exams) {
        const isStudent = Lms.portal() === 'student';
        const me = Lms.me();
        const examIds = new Set(exams.map(e => e.id));
        const results = (window.LmsData.examResults || [])
            .filter(r => examIds.has(r.examId) && (!isStudent || (r.studentId === me.id && r.published)))
            .sort((a, b) => String(a.examId).localeCompare(String(b.examId)) || String(a.rollNo).localeCompare(String(b.rollNo)));
        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-scroll"></i> ${isStudent ? 'My Published Results' : 'Results Ledger'}</h3>
                    <span class="status-pill success">${results.length} record(s)</span>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr>${isStudent ? '' : '<th>Student</th>'}<th>Exam</th><th>Marks</th><th>Grade</th><th>Remarks</th>${isStudent ? '' : '<th>Status</th>'}<th></th></tr></thead>
                        <tbody>
                            ${results.length ? results.map(r => {
                                const ex = exams.find(e => e.id === r.examId) || {};
                                const pct = r.percentage !== undefined ? r.percentage : (r.marksObtained / (r.totalMarks || 100) * 100);
                                const g = Lms.wifaqGrade(pct);
                                return `
                                    <tr>
                                        ${isStudent ? '' : `<td><div style="font-weight: 700;">${Lms.esc(r.studentName)}</div><div style="font-size: 0.75rem; color: var(--gold-700);">${Lms.esc(r.rollNo)}</div></td>`}
                                        <td><div style="font-weight: 600;">${Lms.esc(ex.title || '')}</div><div style="font-size: 0.72rem; color: var(--text-muted);">${Lms.fmtDate(ex.examDate)}</div></td>
                                        <td><strong>${Lms.esc(r.marksObtained)}</strong> / ${Lms.esc(r.totalMarks || 100)} <span style="font-size: 0.75rem; color: var(--text-muted);">(${Math.round(pct * 10) / 10}%)</span></td>
                                        <td><span class="status-pill ${g.pill}">${g.urdu} • ${Lms.esc(g.label)}</span></td>
                                        <td style="font-size: 0.8rem; max-width: 240px;">${Lms.esc(r.examinerRemarks || '')}</td>
                                        ${isStudent ? '' : `<td>${r.published ? '<span class="status-pill success">Published</span>' : '<span class="status-pill warning">Draft</span>'}</td>`}
                                        <td><button class="btn btn-gold btn-sm" onclick="ExamsModule.printSanadCertificate('${r.id}')"><i class="fas fa-award"></i> Marksheet</button></td>
                                    </tr>`;
                            }).join('') : `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">${isStudent ? 'No results have been published for you yet.' : 'No results yet.'}</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    printSanadCertificate(resId) {
        const res = (window.LmsData.examResults || []).find(r => r.id === resId);
        if (!res) return;
        const ex = (window.LmsData.exams || []).find(e => e.id === res.examId) || {};
        const total = res.totalMarks || 100;
        const g = Lms.wifaqGrade(res.marksObtained / total * 100);
        Lms.openModal(
            `<i class="fas fa-award" style="color: var(--gold-400);"></i> Marksheet: ${Lms.esc(res.studentName)}`,
            `<div class="sanad-certificate">
                <div class="sanad-inner-border">
                    <div class="sanad-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
                    <img src="assets/images/logo.png" style="width: 72px; height: 72px; object-fit: contain; margin: 0 auto 10px;">
                    <div class="sanad-title-urdu">جامعہ اشرفیہ، لاہور - پاکستان</div>
                    <div class="sanad-title-eng">Jamia Ashrafia Lahore (Est. 1947)</div>
                    <div style="font-size: 0.85rem; color: #4b5563; margin-bottom: 16px;">Affiliated with Wifaq-ul-Madaris Al-Arabia Pakistan</div>
                    <div style="font-family: 'Amiri', serif; font-size: 1.25rem; color: var(--primary-800); margin-bottom: 14px; font-weight: 700;">${Lms.esc(ex.urduTitle || 'نتیجہ امتحان')}</div>
                    <div class="sanad-student-details">
                        This is to certify that <strong>${Lms.esc(res.studentName)}</strong> (Roll No: <strong>${Lms.esc(res.rollNo)}</strong>),
                        ${Lms.esc(Lms.className(ex.classId))}, appeared in <strong>${Lms.esc(ex.title || 'the examination')}</strong>
                        (${Lms.esc(Lms.courseTitle(ex.courseId))}) and secured <strong>${Lms.esc(res.marksObtained)}/${Lms.esc(total)}</strong> with the distinction:
                    </div>
                    <div class="sanad-grade-seal">
                        <div class="grade-urdu">${g.urdu}</div>
                        <div style="font-size: 0.65rem; text-transform: uppercase;">${Lms.esc(g.code.replace('_', ' '))}</div>
                    </div>
                    ${res.examinerRemarks ? `<div style="font-size: 0.85rem; color: #374151; margin-bottom: 12px;"><em>"${Lms.esc(res.examinerRemarks)}"</em></div>` : ''}
                    <div style="font-size: 0.78rem; color: #64748b; margin-bottom: 20px;">Reference No: <strong>${Lms.esc(res.sanadNumber || res.id)}</strong> • ${Lms.esc(ex.session || '')}</div>
                    <div class="sanad-signatures">
                        <div><div>_______________________</div><div>Nazim-e-Taleemat</div></div>
                        <div><div style="border: 2px solid var(--primary-800); border-radius: 50%; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; color: var(--primary-800); font-weight: 800; margin: 0 auto;">OFFICIAL<br>SEAL</div></div>
                        <div><div>_______________________</div><div>Principal / Mohtamim</div></div>
                    </div>
                </div>
            </div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
             <button class="btn btn-gold" onclick="window.print()"><i class="fas fa-print"></i> Print</button>`
        );
    },

    viewQuestionPaperModal(examId) {
        const ex = (window.LmsData.exams || []).find(e => e.id === examId);
        if (!ex) return;
        const showKey = this.canExam(ex, 'exams.questions.manage');
        Lms.openModal(
            `<i class="fas fa-file-alt" style="color: var(--gold-400);"></i> Question Paper: ${Lms.esc(ex.title)}`,
            `<div style="background: #ffffff; color: #111827; padding: 24px; border-radius: 6px; line-height: 2; border: 1px solid #cbd5e1;">
                <div style="text-align: center; border-bottom: 2px solid var(--primary-800); padding-bottom: 10px; margin-bottom: 16px;">
                    <div style="font-family: 'Amiri', serif; font-size: 1.4rem; font-weight: 800; color: var(--primary-800);">جامعہ اشرفیہ، لاہور - امتحانی پرچہ</div>
                    <div style="font-size: 1rem; color: var(--gold-600);">${Lms.esc(ex.title)}</div>
                    <div style="font-size: 0.85rem; color: #4b5563;">Total Marks: ${this.examTotal(ex)} • Time Allowed: ${Lms.esc(ex.durationMinutes)} minutes</div>
                </div>
                ${ex.instructions ? `<p style="font-size: 0.9rem;"><strong>Instructions:</strong> ${Lms.multiline(ex.instructions)}</p>` : ''}
                ${(ex.questions || []).length ? ex.questions.map((q, i) => `
                    <div style="margin-bottom: 12px;" dir="auto">
                        <strong>Q${i + 1} (${Lms.esc(q.marks)} marks):</strong> ${Lms.multiline(q.text)}
                        ${q.type === 'MCQ' ? `<ol type="A" style="margin: 4px 0 0 24px;">${q.options.filter(Boolean).map((o, k) => `<li ${showKey && k === q.correctIndex ? 'style="color: #047857; font-weight: 700;"' : ''}>${Lms.esc(o)}</li>`).join('')}</ol>` : ''}
                    </div>`).join('') : '<p style="color: #6b7280;">This is a hall exam; the paper is distributed in the examination hall.</p>'}
            </div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
             <button class="btn btn-gold" onclick="window.print()"><i class="fas fa-print"></i> Print</button>`
        );
    }
};

window.ExamsModule = ExamsModule;
