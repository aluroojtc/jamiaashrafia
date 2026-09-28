/**
 * JAMIA ASHRAFIA LAHORE - EXAMINATIONS, ONLINE MARKING & WIFAQ RESULTS
 * Exam submissions, teacher marking suite, Wifaq grade conversion, and printable digital Sanad
 */

const ExamsModule = {
    render() {
        const canGrade = window.AuthRBAC.can("exams:grade") || window.AuthRBAC.isAdmin();
        const isStudent = window.AuthRBAC.isStudent();
        const exams = window.LmsData.exams;
        const results = window.LmsData.examResults;

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-award" style="color: var(--gold-400);"></i>
                        Examinations, Online Marking & Wifaq Sanad
                    </h1>
                    <p>Annual (Salana) and Midterm (Shashmahi) examinations, online marks entry, and official Sanad generation</p>
                </div>
                <div class="view-actions">
                    ${canGrade ? `
                        <button class="btn btn-gold btn-sm" onclick="ExamsModule.openOnlineMarkingModal()">
                            <i class="fas fa-pencil-ruler"></i> Online Examiner Marking Sheet
                        </button>
                    ` : ''}
                    ${isStudent ? `
                        <button class="btn btn-primary btn-sm" onclick="ExamsModule.openTakeExamModal()">
                            <i class="fas fa-file-signature"></i> Attempt Live Exam Paper
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- EXAM SCHEDULE CARDS -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 28px;">
                ${exams.map(ex => {
                    const course = window.LmsData.courses.find(c => c.id === ex.courseId) || { title: "Kitab" };
                    return `
                        <div class="card" style="border-left: 4px solid var(--gold-400);">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                                <span class="status-pill gold" style="font-size: 0.7rem;">${ex.examType}</span>
                                <span style="font-size: 0.75rem; color: var(--gold-300);"><i class="fas fa-clock"></i> ${ex.durationMinutes} Minutes</span>
                            </div>
                            <h3 style="font-size: 1.05rem; color: #ffffff; margin-bottom: 4px;">${ex.title}</h3>
                            <div style="font-family: 'Amiri', serif; font-size: 1.15rem; color: var(--gold-200); margin-bottom: 12px;">${ex.urduTitle}</div>
                            
                            <div style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 16px;">
                                <div><i class="fas fa-calendar-alt" style="color: var(--primary-400); width: 18px;"></i> <strong>Exam Date:</strong> ${ex.examDate} (${ex.startTime})</div>
                                <div><i class="fas fa-book" style="color: var(--primary-400); width: 18px;"></i> <strong>Course:</strong> ${course.title}</div>
                                <div><i class="fas fa-check-circle" style="color: var(--primary-400); width: 18px;"></i> <strong>Passing Marks:</strong> ${ex.passingMarks} / ${ex.totalMarks} (Wifaq Standard)</div>
                            </div>

                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="ExamsModule.viewQuestionPaperModal('${ex.id}')">
                                    <i class="fas fa-file-alt"></i> Question Paper
                                </button>
                                ${isStudent ? `
                                    <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="ExamsModule.openTakeExamModal('${ex.id}')">
                                        <i class="fas fa-pen-nib"></i> Attempt Paper
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- WIFAQ RESULTS & DIGITAL SANAD LEDGER -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-scroll"></i> Official Examination Results & Degree Equivalency (شہادۃ العالمیہ)
                    </h3>
                    <span class="status-pill success"><i class="fas fa-stamp"></i> Wifaq Al-Arabia Certified</span>
                </div>

                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Student & Roll No</th>
                                <th>Exam Paper</th>
                                <th>Marks Obtained</th>
                                <th>Wifaq Grade</th>
                                <th>Examiner Remarks</th>
                                <th>Sanad / Certificate</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${results.map(res => {
                                const exam = window.LmsData.exams.find(e => e.id === res.examId) || { title: "Midterm Exam" };
                                return `
                                    <tr>
                                        <td>
                                            <div style="font-weight: 700; color: #ffffff;">${res.studentName}</div>
                                            <div style="font-family: monospace; font-size: 0.78rem; color: var(--gold-300);">${res.rollNo}</div>
                                        </td>
                                        <td>
                                            <div style="font-weight: 600;">${exam.title}</div>
                                            <div style="font-size: 0.72rem; color: var(--text-muted);">${res.sanadNumber}</div>
                                        </td>
                                        <td>
                                            <strong style="font-size: 1.1rem; color: #ffffff;">${res.marksObtained}</strong> / 100
                                        </td>
                                        <td>
                                            <span class="status-pill gold" style="font-weight: 700;">
                                                <i class="fas fa-star"></i> ${res.urduGrade}
                                            </span>
                                        </td>
                                        <td style="font-size: 0.8rem; color: var(--text-secondary); max-width: 260px;">
                                            ${res.examinerRemarks}
                                        </td>
                                        <td>
                                            <button class="btn btn-gold btn-sm" onclick="ExamsModule.printSanadCertificate('${res.id}')">
                                                <i class="fas fa-award"></i> View Sanad
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

    openOnlineMarkingModal() {
        const students = window.LmsData.users.filter(u => u.role === 'STUDENT');
        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-pencil-ruler" style="color: var(--gold-400);"></i> Wifaq Online Marking Sheet: Sahih al-Bukhari`;
        modalBody.innerHTML = `
            <div style="background: var(--bg-surface-elevated); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 16px;">
                <div style="font-size: 0.85rem; color: var(--gold-300);"><strong>Grading Scale:</strong> Mumtaz (>=80) | Jayyid Jiddan (70-79) | Jayyid (60-69) | Maqbool (40-59) | Rasib (<40)</div>
            </div>

            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Roll No</th>
                            <th>Marks (100)</th>
                            <th>Examiner Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.map(s => `
                            <tr>
                                <td><strong>${s.name}</strong></td>
                                <td>${s.rollNo}</td>
                                <td>
                                    <input type="number" id="m_score_${s.id}" class="form-control" value="88" style="width: 80px;" max="100" min="0">
                                </td>
                                <td>
                                    <input type="text" id="m_rem_${s.id}" class="form-control" value="Excellent grasp of hadith chain and text." style="width: 220px;">
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
            <button class="btn btn-gold" onclick="ExamsModule.saveExaminerMarks()">
                <i class="fas fa-save"></i> Commit Grades to Wifaq Board
            </button>
        `;
        window.App.openModal();
    },

    saveExaminerMarks() {
        window.App.closeModal();
        window.App.showToast("Marks committed to Wifaq-ul-Madaris official register!", "success");
        window.App.navigate('exams');
    },

    openTakeExamModal(exId) {
        const ex = window.LmsData.exams.find(e => e.id === exId) || window.LmsData.exams[0];
        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-file-signature" style="color: var(--primary-400);"></i> Live Examination: ${ex.title}`;
        modalBody.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); padding: 10px 16px; border-radius: var(--radius-sm); margin-bottom: 16px;">
                <div style="color: #f87171; font-weight: 700;"><i class="fas fa-stopwatch"></i> Time Remaining: 02:45:10</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Session: 1446-1447 AH • Max Marks: 100</div>
            </div>

            <div class="card" style="background: var(--bg-surface-elevated); padding: 14px; margin-bottom: 16px;">
                <h4 style="color: var(--gold-300); margin-bottom: 6px;">Question 1 (Compulsory):</h4>
                <p style="font-family: 'Amiri', serif; font-size: 1.15rem; color: #ffffff; direction: rtl; line-height: 1.9;">
                    قال الإمام البخاري رحمه الله: حَدَّثَنَا الحُمَيْدِيُّ، قَالَ: حَدَّثَنَا سُفْيَانُ... اشرح هذا السند والمتن مبيناً أوجه الاستدلال الفقهي عند أئمة الحنفية.
                </p>
            </div>

            <div class="form-group">
                <label>Online Answer Sheet (Enter response in Arabic, Urdu, or English) *</label>
                <textarea id="exam-ans" class="form-control" style="min-height: 180px; font-family: 'Amiri', serif; font-size: 1.1rem; direction: rtl;" placeholder="بسم الله الرحمن الرحيم... اكتب الجواب هنا..."></textarea>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Exit Paper</button>
            <button class="btn btn-primary" onclick="ExamsModule.submitExamPaper()">
                <i class="fas fa-check-circle"></i> Final Paper Submission
            </button>
        `;
        window.App.openModal();
    },

    submitExamPaper() {
        const ans = document.getElementById('exam-ans').value.trim();
        if (!ans) {
            window.App.showToast("Please write your answer before submitting", "warning");
            return;
        }

        window.App.closeModal();
        window.App.showToast("Examination paper submitted for external marking!", "success");
    },

    printSanadCertificate(resId) {
        const res = window.LmsData.examResults.find(r => r.id === resId);
        if (!res) return;

        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-award" style="color: var(--gold-400);"></i> Official Sanad / Marksheet: ${res.studentName}`;
        modalBody.innerHTML = `
            <div class="sanad-certificate">
                <div class="sanad-inner-border">
                    <div class="sanad-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
                    <img src="assets/images/crest.jpg" style="width: 72px; height: 72px; border-radius: 50%; margin: 0 auto 10px; border: 2px solid #b45309;">
                    <div class="sanad-title-urdu">جامعہ اشرفیہ، لاہور - پاکستان</div>
                    <div class="sanad-title-eng">Ashrafia Islamic University Lahore (Est. 1947)</div>
                    <div style="font-size: 0.85rem; color: #4b5563; margin-bottom: 16px;">
                        Affiliated with Wifaq-ul-Madaris Al-Arabia Pakistan • Recognized by Higher Education Commission (HEC)
                    </div>

                    <div style="font-family: 'Amiri', serif; font-size: 1.3rem; color: #064e3b; margin-bottom: 14px; font-weight: 700;">
                        شہادۃ العالمیہ فی العلوم الاسلامیہ والعربیہ (سند فضیلت)
                    </div>

                    <div class="sanad-student-details">
                        This is to certify that the noble scholar <strong>${res.studentName}</strong> (Roll No: <strong>${res.rollNo}</strong>), 
                        having pursued classical Dars-e-Nizami studies at Jamia Ashrafia Lahore, appeared in the comprehensive board examination 
                        and secured an aggregate of <strong>${res.marksObtained}/100</strong> with the distinction:
                    </div>

                    <div class="sanad-grade-seal">
                        <div class="grade-urdu">${res.wifaqGrade === 'MUMTAZ' ? 'ممتاز' : 'جید'}</div>
                        <div style="font-size: 0.65rem; text-transform: uppercase;">${res.wifaqGrade}</div>
                    </div>

                    <div style="font-size: 0.78rem; color: #64748b; margin-bottom: 20px;">
                        Sanad Registration No: <strong>${res.sanadNumber}</strong> • Date of Conferment: Safar 1446 AH
                    </div>

                    <div class="sanad-signatures">
                        <div>
                            <div>_______________________</div>
                            <div>Maulana Fazl-ur-Raheem Ashrafi</div>
                            <div style="font-size: 0.72rem; color: #64748b;">Principal / Mohtamim</div>
                        </div>
                        <div>
                            <div style="border: 2px solid #064e3b; border-radius: 50%; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; color: #064e3b; font-weight: 800; margin: 0 auto;">
                                OFFICIAL<br>SEAL
                            </div>
                        </div>
                        <div>
                            <div>_______________________</div>
                            <div>Maulana Hafiz Ajwad Ubaid</div>
                            <div style="font-size: 0.72rem; color: #64748b;">Nazim-e-Taleemat</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Close</button>
            <button class="btn btn-gold" onclick="window.print()"><i class="fas fa-print"></i> Print Official Sanad</button>
        `;
        window.App.openModal();
    },

    viewQuestionPaperModal(exId) {
        const ex = window.LmsData.exams.find(e => e.id === exId);
        if (!ex) return;

        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-file-alt" style="color: var(--gold-400);"></i> Examination Paper: ${ex.title}`;
        modalBody.innerHTML = `
            <div style="background: #ffffff; color: #111827; padding: 24px; border-radius: 6px; font-family: 'Amiri', serif; direction: rtl; line-height: 2.2; border: 1px solid #cbd5e1;">
                <div style="text-align: center; border-bottom: 2px solid #064e3b; padding-bottom: 10px; margin-bottom: 16px;">
                    <div style="font-size: 1.4rem; font-weight: 800; color: #064e3b;">جامعہ اشرفیہ، لاہور - امتحانی پرچہ</div>
                    <div style="font-size: 1.1rem; color: #b45309;">${ex.urduTitle} - امتحان ششماہی 1446 ھ</div>
                    <div style="font-size: 0.85rem; font-family: 'Inter', sans-serif; direction: ltr; color: #4b5563;">
                        Total Marks: ${ex.totalMarks} • Time Allowed: 3 Hours
                    </div>
                </div>

                <div style="font-size: 1.15rem;">
                    <strong>السؤال الأول (20 درجة):</strong><br>
                    ترجم العبارة الآتية ترجمة سديدة مع ضبط الحركات وتخريج المسائل الفقهية المتعلقة بالنية في العبادات.<br><br>
                    <strong>السؤال الثاني (20 درجة):</strong><br>
                    وضح منهج الإمام البخاري في إيراد التراجم الخفية والظاهرة مستدلاً بباب كتاب الإيمان.<br><br>
                    <strong>السؤال الثالث (20 درجة):</strong><br>
                    ترجم لثلاثة من رجال السند الآتي: الحميدي، سفيان بن عيينة، يحيى بن سعيد الأنصاري.
                </div>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `<button class="btn btn-secondary" onclick="window.App.closeModal()">Close</button>`;
        window.App.openModal();
    }
};

window.ExamsModule = ExamsModule;
