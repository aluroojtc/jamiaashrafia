/**
 * JAMIA ASHRAFIA LAHORE - ASSIGNMENTS & EVALUATION MODULE
 * Student homework uploads, teacher checking options, grading rubrics, and feedback
 */

const AssignmentsModule = {
    render() {
        const canCreate = window.AuthRBAC.can("assignments:create");
        const isStudent = window.AuthRBAC.isStudent();
        const assignments = window.LmsData.assignments;
        const submissions = window.LmsData.assignmentSubmissions;

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-edit" style="color: var(--gold-400);"></i>
                        Assignments & Scholarly Exercises
                    </h1>
                    <p>Research papers, Takhrij al-Hadith assignments, Fiqh case studies, and faculty checking portal</p>
                </div>
                <div class="view-actions">
                    ${canCreate ? `
                        <button class="btn btn-gold btn-sm" onclick="AssignmentsModule.openCreateAssignmentModal()">
                            <i class="fas fa-plus-circle"></i> Create New Assignment
                        </button>
                    ` : ''}
                    ${isStudent ? `
                        <button class="btn btn-primary btn-sm" onclick="AssignmentsModule.openStudentUploadModal()">
                            <i class="fas fa-upload"></i> Upload Homework Submission
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- ASSIGNMENTS OVERVIEW CARDS -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 28px;">
                ${assignments.map(asg => {
                    const course = window.LmsData.courses.find(c => c.id === asg.courseId) || { title: "Dars-e-Nizami" };
                    const teacher = window.LmsData.users.find(u => u.id === asg.teacherId) || { name: "Faculty Ustad" };

                    return `
                        <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                                    <span class="status-pill gold" style="font-size: 0.7rem;">${course.code}</span>
                                    <span style="font-size: 0.75rem; color: var(--danger); font-weight: 600;"><i class="fas fa-calendar-alt"></i> Due: ${asg.dueDate}</span>
                                </div>
                                <h3 style="font-size: 1.05rem; color: var(--primary-950); margin-bottom: 4px;">${asg.title}</h3>
                                <div style="font-family: 'Amiri', serif; font-size: 1.1rem; color: var(--gold-700); margin-bottom: 10px;">${asg.urduTitle}</div>
                                <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 16px;">
                                    ${asg.description}
                                </p>
                            </div>

                            <div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted); padding: 8px 0; border-top: 1px solid var(--border-subtle); margin-bottom: 12px;">
                                    <span><i class="fas fa-user-tie"></i> ${teacher.name}</span>
                                    <span><strong>Max Marks:</strong> ${asg.maxMarks}</span>
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="AssignmentsModule.openSubmissionsReviewModal('${asg.id}')">
                                        <i class="fas fa-tasks"></i> Checking & Marks (${asg.totalSubmissions || 1})
                                    </button>
                                    ${isStudent ? `
                                        <button class="btn btn-primary btn-sm" onclick="AssignmentsModule.openStudentUploadModal('${asg.id}')">
                                            <i class="fas fa-upload"></i> Submit
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- RECENT SUBMISSIONS & CHECKED WORK -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-clipboard-check"></i> Recent Student Submissions & Evaluated Papers</h3>
                    <span class="status-pill success">${submissions.length} Submissions</span>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Student & Roll No</th>
                                <th>Assignment Title</th>
                                <th>Submission Summary</th>
                                <th>Marks & Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${submissions.map(sub => {
                                const asg = window.LmsData.assignments.find(a => a.id === sub.assignmentId) || { title: "Takhrij Paper" };
                                return `
                                    <tr>
                                        <td>
                                            <div style="font-weight: 700; color: var(--primary-950);">${sub.studentName}</div>
                                            <div style="font-size: 0.75rem; color: var(--gold-700);">${sub.rollNo}</div>
                                        </td>
                                        <td>
                                            <div style="font-weight: 600;">${asg.title}</div>
                                            <div style="font-size: 0.72rem; color: var(--text-muted);"><i class="fas fa-clock"></i> ${sub.submittedAt}</div>
                                        </td>
                                        <td style="max-width: 300px;">
                                            <div style="font-size: 0.8rem; color: var(--text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                                                ${sub.submissionText}
                                            </div>
                                            <div style="font-size: 0.72rem; color: var(--primary-700); margin-top: 2px;">
                                                <i class="fas fa-file-pdf"></i> ${sub.attachmentUrl}
                                            </div>
                                        </td>
                                        <td>
                                            ${sub.isGraded ? `
                                                <span class="status-pill success"><i class="fas fa-check-circle"></i> Graded: ${sub.marksObtained}/50</span>
                                                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 3px;">"${sub.feedback}"</div>
                                            ` : `
                                                <span class="status-pill warning"><i class="fas fa-hourglass-half"></i> Pending Check</span>
                                            `}
                                        </td>
                                        <td>
                                            <button class="btn btn-gold btn-sm" onclick="AssignmentsModule.openGradeSubmissionModal('${sub.id}')">
                                                <i class="fas fa-pencil-alt"></i> Grade & Feedback
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    openCreateAssignmentModal() {
        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-plus-circle" style="color: var(--gold-400);"></i> Create New Assignment`;
        modalBody.innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    <label>Assignment Title (English) *</label>
                    <input type="text" id="asg-title" class="form-control" placeholder="e.g. Critical Takhrij of Sahih Muslim Narrations">
                </div>
                <div class="form-group">
                    <label>Assignment Title (Arabic / Urdu) *</label>
                    <input type="text" id="asg-urdu" class="form-control" placeholder="تخریج و تحقیق احادیث صحیح مسلم">
                </div>
                <div class="form-group">
                    <label>Class / Section *</label>
                    <select id="asg-class" class="form-control">
                        ${window.LmsData.classes.map(c => `<option value="${c.id}">${c.name} - ${c.section}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Course / Kitab *</label>
                    <select id="asg-course" class="form-control">
                        ${window.LmsData.courses.map(c => `<option value="${c.id}">${c.title}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Submission Due Date *</label>
                    <input type="date" id="asg-due" class="form-control" value="2026-10-14">
                </div>
                <div class="form-group">
                    <label>Max Marks *</label>
                    <input type="number" id="asg-marks" class="form-control" value="50">
                </div>
            </div>
            <div class="form-group" style="margin-top: 10px;">
                <label>Assignment Instructions & Research Prompt *</label>
                <textarea id="asg-desc" class="form-control" placeholder="Detail the questions, required classical commentaries (Fath al-Bari, Sharh an-Nawawi, etc.), and formatting guidelines..."></textarea>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Cancel</button>
            <button class="btn btn-gold" onclick="AssignmentsModule.saveNewAssignment()">Publish Assignment</button>
        `;
        window.App.openModal();
    },

    saveNewAssignment() {
        const title = document.getElementById('asg-title').value.trim();
        const urdu = document.getElementById('asg-urdu').value.trim();
        const classId = document.getElementById('asg-class').value;
        const courseId = document.getElementById('asg-course').value;
        const due = document.getElementById('asg-due').value;
        const marks = parseInt(document.getElementById('asg-marks').value) || 50;
        const desc = document.getElementById('asg-desc').value.trim();

        if (!title || !desc) {
            window.App.showToast("Please provide title and instructions", "warning");
            return;
        }

        const newAsg = {
            id: `asg_${Date.now()}`,
            classId: classId,
            courseId: courseId,
            teacherId: window.AuthRBAC.currentUser?.id || "u_teacher_1",
            title: title,
            urduTitle: urdu || title,
            description: desc,
            dueDate: due,
            maxMarks: marks,
            totalSubmissions: 0,
            gradedSubmissions: 0
        };

        window.LmsData.assignments.unshift(newAsg);
        window.DataStore.save(window.LmsData);
        window.App.closeModal();
        window.App.showToast("Assignment published for enrolled scholars!", "success");
        window.App.navigate('assignments');
    },

    openStudentUploadModal(asgId) {
        const targetAsg = window.LmsData.assignments.find(a => a.id === asgId) || window.LmsData.assignments[0];
        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-upload" style="color: var(--primary-400);"></i> Submit Homework: ${targetAsg.title}`;
        modalBody.innerHTML = `
            <div style="margin-bottom: 14px; background: var(--bg-surface-elevated); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 0.85rem; color: var(--gold-700); font-weight: 600;">Prompt Instructions:</div>
                <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 4px;">${targetAsg.description}</p>
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
                <label>Your Solution / Research Paper Text (Arabic / Urdu / English supported) *</label>
                <textarea id="sub-text" class="form-control" style="min-height: 140px; font-family: 'Scheherazade New', 'Inter', serif; font-size: 1.05rem;" placeholder="بسم الله الرحمن الرحيم... Write your research deductions, hadith analysis, or legal argument here..."></textarea>
            </div>

            <div class="form-group">
                <label>Attach PDF or Scanned Manuscript (Optional)</label>
                <div style="border: 2px dashed var(--border-prominent); padding: 20px; text-align: center; border-radius: var(--radius-sm); cursor: pointer; background: var(--bg-surface-elevated);">
                    <i class="fas fa-cloud-upload-alt" style="font-size: 2rem; color: var(--primary-700); margin-bottom: 8px;"></i>
                    <div style="font-size: 0.85rem; color: var(--text-primary);">Click or drag files here (PDF, JPG, DOCX)</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">Max size: 25MB • SSL Encrypted Transfer</div>
                </div>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="AssignmentsModule.submitStudentWork('${targetAsg.id}')">
                <i class="fas fa-paper-plane"></i> Submit to Faculty
            </button>
        `;
        window.App.openModal();
    },

    submitStudentWork(asgId) {
        const text = document.getElementById('sub-text').value.trim();
        if (!text) {
            window.App.showToast("Please enter your research or assignment text", "warning");
            return;
        }

        const currentUser = window.AuthRBAC.currentUser;
        const newSub = {
            id: `sub_${Date.now()}`,
            assignmentId: asgId,
            studentId: currentUser?.id || "u_student_1",
            studentName: currentUser?.name || "Muhammad Talha Usmani",
            rollNo: currentUser?.rollNo || "ASH-2024-001",
            submissionText: text,
            attachmentUrl: `submissions/${currentUser?.name?.toLowerCase().replace(/\s+/g, '_') || 'talha'}_work.pdf`,
            submittedAt: new Date().toLocaleString(),
            isGraded: false,
            marksObtained: null,
            feedback: null
        };

        window.LmsData.assignmentSubmissions.unshift(newSub);
        const asg = window.LmsData.assignments.find(a => a.id === asgId);
        if (asg) asg.totalSubmissions = (asg.totalSubmissions || 0) + 1;

        window.DataStore.save(window.LmsData);
        window.App.closeModal();
        window.App.showToast("Assignment submitted successfully to the Sheikh!", "success");
        window.App.navigate('assignments');
    },

    openGradeSubmissionModal(subId) {
        const sub = window.LmsData.assignmentSubmissions.find(s => s.id === subId);
        if (!sub) return;

        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-pencil-alt" style="color: var(--gold-400);"></i> Check & Grade Submission: ${sub.studentName}`;
        modalBody.innerHTML = `
            <div style="margin-bottom: 14px; background: var(--bg-surface-elevated); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                    <span><strong>Talib-e-Ilm:</strong> ${sub.studentName} (${sub.rollNo})</span>
                    <span><strong>Submitted:</strong> ${sub.submittedAt}</span>
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
                <label>Student's Submitted Answer / Tahqiq:</label>
                <div style="background: #061114; border: 1px solid var(--border-prominent); border-radius: var(--radius-sm); padding: 16px; font-size: 0.95rem; color: #f8fafc; line-height: 1.7; max-height: 200px; overflow-y: auto;">
                    ${sub.submissionText}
                </div>
            </div>

            <div class="form-grid">
                <div class="form-group">
                    <label>Marks Awarded (Max 50) *</label>
                    <input type="number" id="grade-marks" class="form-control" value="${sub.marksObtained || 45}" max="50" min="0">
                </div>
                <div class="form-group">
                    <label>Wifaq Evaluation Grade</label>
                    <select id="grade-wifaq" class="form-control">
                        <option value="MUMTAZ">ممتاز (Mumtaz - Excellent >= 80%)</option>
                        <option value="JAYYID_JIDDAN">جید جدا (Jayyid Jiddan - Very Good 70-79%)</option>
                        <option value="JAYYID">جید (Jayyid - Good 60-69%)</option>
                        <option value="MAQBOOL">مقبول (Maqbool - Pass 40-59%)</option>
                    </select>
                </div>
            </div>

            <div class="form-group" style="margin-top: 10px;">
                <label>Ustad's Scholarly Feedback & Remarks *</label>
                <textarea id="grade-feedback" class="form-control" placeholder="Provide corrections, praise, or guidance on sanad methodology...">${sub.feedback || 'Mumtaz work. Precise legal deduction and accurate Asma-ur-Rijal citations.'}</textarea>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Cancel</button>
            <button class="btn btn-gold" onclick="AssignmentsModule.saveGradedResult('${sub.id}')">
                <i class="fas fa-check"></i> Save Marks & Return to Student
            </button>
        `;
        window.App.openModal();
    },

    saveGradedResult(subId) {
        const sub = window.LmsData.assignmentSubmissions.find(s => s.id === subId);
        if (sub) {
            const marks = parseFloat(document.getElementById('grade-marks').value);
            const feedback = document.getElementById('grade-feedback').value.trim();
            sub.isGraded = true;
            sub.marksObtained = marks;
            sub.feedback = feedback;

            window.DataStore.save(window.LmsData);
            window.App.closeModal();
            window.App.showToast(`Evaluation saved: ${marks}/50 for ${sub.studentName}`, "success");
            window.App.navigate('assignments');
        }
    },

    openSubmissionsReviewModal(asgId) {
        const asg = window.LmsData.assignments.find(a => a.id === asgId);
        if (!asg) return;

        const subs = window.LmsData.assignmentSubmissions.filter(s => s.assignmentId === asgId);
        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-tasks" style="color: var(--gold-400);"></i> Class Submissions: ${asg.title}`;
        modalBody.innerHTML = `
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 14px;">Review all papers turned in by enrolled scholars.</p>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Date</th>
                            <th>Marks</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${subs.length > 0 ? subs.map(s => `
                            <tr>
                                <td><strong>${s.studentName}</strong> (${s.rollNo})</td>
                                <td>${s.submittedAt}</td>
                                <td>${s.isGraded ? `<span class="status-pill success">${s.marksObtained}/${asg.maxMarks}</span>` : '<span class="status-pill warning">Pending</span>'}</td>
                                <td>
                                    <button class="btn btn-gold btn-sm" onclick="AssignmentsModule.openGradeSubmissionModal('${s.id}')">Evaluate</button>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No submissions recorded yet for this task.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `<button class="btn btn-secondary" onclick="window.App.closeModal()">Close</button>`;
        window.App.openModal();
    }
};

window.AssignmentsModule = AssignmentsModule;
