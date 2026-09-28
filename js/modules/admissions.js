/**
 * JAMIA ASHRAFIA LAHORE - ADMISSIONS & REGISTRATION MODULE
 * Complete online application wizard, verification queue, roll number assignment, and student ID generation
 */

const AdmissionsModule = {
    currentStep: 1,

    render() {
        const canApprove = window.AuthRBAC.can("admissions:approve");
        const admissions = window.LmsData.admissions;

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-user-graduate" style="color: var(--primary-400);"></i>
                        Student Admissions & Registration
                    </h1>
                    <p>Admissions portal for Dars-e-Nizami, Takhassusat, Hifz, and affiliated branches</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-gold btn-sm" onclick="AdmissionsModule.openNewApplicationModal()">
                        <i class="fas fa-plus-circle"></i> New Student Application
                    </button>
                    ${canApprove ? `
                        <button class="btn btn-secondary btn-sm" onclick="AdmissionsModule.exportAdmissionsCSV()">
                            <i class="fas fa-file-export"></i> Export Wifaq List
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- ADMISSION METRICS -->
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-icon-box"><i class="fas fa-file-signature"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Total Applications</span>
                        <span class="metric-value">${admissions.length}</span>
                        <span class="metric-hint"><i class="fas fa-clock"></i> Session 1446-1447 AH</span>
                    </div>
                </div>
                <div class="metric-card gold">
                    <div class="metric-icon-box"><i class="fas fa-user-clock"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Interviews Scheduled</span>
                        <span class="metric-value">${admissions.filter(a => a.status === 'INTERVIEW_SCHEDULED').length}</span>
                        <span class="metric-hint" style="color: var(--gold-300);">Nazim Taleemat Board</span>
                    </div>
                </div>
                <div class="metric-card info">
                    <div class="metric-icon-box"><i class="fas fa-check-double"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Approved & Enrolled</span>
                        <span class="metric-value">${admissions.filter(a => a.status === 'APPROVED' || a.status === 'ENROLLED').length}</span>
                        <span class="metric-hint">Roll numbers issued</span>
                    </div>
                </div>
                <div class="metric-card danger">
                    <div class="metric-icon-box"><i class="fas fa-bed"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Hostel Requests</span>
                        <span class="metric-value">${admissions.filter(a => a.hostelRequired).length}</span>
                        <span class="metric-hint" style="color: var(--text-muted);">Hostel Block A & B</span>
                    </div>
                </div>
            </div>

            <!-- ADMISSIONS QUEUE TABLE -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-list-alt"></i> Applicant Verification & Enrolment Queue</h3>
                    <div class="filter-actions">
                        <select class="form-control" style="padding: 4px 10px; font-size: 0.82rem;" onchange="AdmissionsModule.filterByStatus(this.value)">
                            <option value="ALL">All Statuses</option>
                            <option value="APPLIED">Applied</option>
                            <option value="UNDER_REVIEW">Under Review</option>
                            <option value="INTERVIEW_SCHEDULED">Interview Scheduled</option>
                            <option value="APPROVED">Approved</option>
                            <option value="ENROLLED">Enrolled</option>
                        </select>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="data-table" id="admissions-table">
                        <thead>
                            <tr>
                                <th>App No & Candidate</th>
                                <th>Program & Branch</th>
                                <th>CNIC / Contact</th>
                                <th>Madrasa Background</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.renderAdmissionsRows(admissions)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    renderAdmissionsRows(list) {
        if (!list || list.length === 0) {
            return `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No applications found in this category.</td></tr>`;
        }

        const canApprove = window.AuthRBAC.can("admissions:approve");

        return list.map(item => {
            const prog = window.LmsData.programs.find(p => p.id === item.programId) || { name: 'Dars-e-Nizami' };
            const branch = window.LmsData.institution.branches.find(b => b.id === item.branchId) || { name: 'Main Campus' };

            let statusPill = '';
            if (item.status === 'ENROLLED') statusPill = '<span class="status-pill success"><i class="fas fa-check"></i> Enrolled</span>';
            else if (item.status === 'APPROVED') statusPill = '<span class="status-pill gold"><i class="fas fa-award"></i> Approved</span>';
            else if (item.status === 'INTERVIEW_SCHEDULED') statusPill = '<span class="status-pill warning"><i class="fas fa-calendar-alt"></i> Interview Set</span>';
            else statusPill = '<span class="status-pill info"><i class="fas fa-spinner"></i> Under Review</span>';

            return `
                <tr>
                    <td>
                        <div style="font-weight: 700; color: #ffffff;">${item.name}</div>
                        <div style="font-size: 0.75rem; color: var(--gold-300);">${item.applicationNo}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">S/O ${item.fatherName}</div>
                    </td>
                    <td>
                        <div style="font-weight: 600; color: var(--text-primary);">${prog.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);"><i class="fas fa-map-marker-alt"></i> ${branch.name}</div>
                        ${item.hostelRequired ? '<span class="status-pill danger" style="font-size: 0.65rem; margin-top: 3px;">Hostel Needed</span>' : ''}
                    </td>
                    <td>
                        <div style="font-family: monospace; font-size: 0.8rem;">${item.cnic}</div>
                        <div style="font-size: 0.78rem; color: var(--text-secondary);"><i class="fas fa-phone"></i> ${item.phone}</div>
                    </td>
                    <td>
                        <div style="font-size: 0.8rem;">${item.previousMadrasa || 'New Student'}</div>
                        ${item.hafizStatus ? '<span class="status-pill success" style="font-size: 0.65rem; margin-top: 3px;">Hafiz-ul-Quran</span>' : ''}
                    </td>
                    <td>${statusPill}</td>
                    <td>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            ${item.status === 'INTERVIEW_SCHEDULED' && canApprove ? `
                                <button class="btn btn-primary btn-sm" onclick="AdmissionsModule.approveAdmission('${item.id}')">
                                    <i class="fas fa-check-circle"></i> Approve & Roll No
                                </button>
                            ` : ''}
                            ${item.status === 'APPLIED' || item.status === 'UNDER_REVIEW' && canApprove ? `
                                <button class="btn btn-gold btn-sm" onclick="AdmissionsModule.scheduleInterviewModal('${item.id}')">
                                    <i class="fas fa-calendar-check"></i> Interview
                                </button>
                            ` : ''}
                            ${(item.status === 'APPROVED' || item.status === 'ENROLLED') ? `
                                <button class="btn btn-secondary btn-sm" onclick="AdmissionsModule.printStudentCard('${item.id}')">
                                    <i class="fas fa-id-card"></i> Student ID
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    openNewApplicationModal() {
        this.currentStep = 1;
        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-user-plus" style="color: var(--gold-400);"></i> Online Student Admission - Jamia Ashrafia`;
        modalBody.innerHTML = `
            <div class="wizard-steps">
                <div class="wizard-step active" id="step-wiz-1">
                    <div class="step-indicator">1</div>
                    <div class="step-label">Personal Info</div>
                </div>
                <div class="wizard-step" id="step-wiz-2">
                    <div class="step-indicator">2</div>
                    <div class="step-label">Education</div>
                </div>
                <div class="wizard-step" id="step-wiz-3">
                    <div class="step-indicator">3</div>
                    <div class="step-label">Program & Branch</div>
                </div>
                <div class="wizard-step" id="step-wiz-4">
                    <div class="step-indicator">4</div>
                    <div class="step-label">Review & Submit</div>
                </div>
            </div>

            <form id="admission-form">
                <!-- STEP 1 -->
                <div id="step-content-1">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Candidate Full Name (English) *</label>
                            <input type="text" id="adm-name" class="form-control" placeholder="e.g. Muhammad Bilal Usmani" required>
                        </div>
                        <div class="form-group">
                            <label>Father's Name *</label>
                            <input type="text" id="adm-father" class="form-control" placeholder="e.g. Maulana Abdul Rehman" required>
                        </div>
                        <div class="form-group">
                            <label>CNIC / B-Form Number *</label>
                            <input type="text" id="adm-cnic" class="form-control" placeholder="35201-1234567-1" required>
                        </div>
                        <div class="form-group">
                            <label>Date of Birth *</label>
                            <input type="date" id="adm-dob" class="form-control" value="2006-03-15" required>
                        </div>
                        <div class="form-group">
                            <label>WhatsApp / Mobile Phone *</label>
                            <input type="tel" id="adm-phone" class="form-control" placeholder="+92 300 1234567" required>
                        </div>
                        <div class="form-group">
                            <label>Email Address</label>
                            <input type="email" id="adm-email" class="form-control" placeholder="bilal@example.com">
                        </div>
                    </div>
                </div>

                <!-- STEP 2 -->
                <div id="step-content-2" style="display: none;">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Previous Madrasa / School Attended</label>
                            <input type="text" id="adm-prev-madrasa" class="form-control" placeholder="e.g. Jamia Farooqia / Darul Uloom">
                        </div>
                        <div class="form-group">
                            <label>Last Passed Class / Degree</label>
                            <input type="text" id="adm-last-class" class="form-control" placeholder="e.g. Sanawiyyah Aamah / Matric">
                        </div>
                        <div class="form-group">
                            <label>Wifaq Registration Roll No (if any)</label>
                            <input type="text" id="adm-wifaq-reg" class="form-control" placeholder="W-1445-98210">
                        </div>
                        <div class="form-group" style="justify-content: center;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-top: 20px;">
                                <input type="checkbox" id="adm-hafiz" style="width: 18px; height: 18px;">
                                <strong>Is the Candidate Hafiz-ul-Quran? (حافظ قرآن)</strong>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- STEP 3 -->
                <div id="step-content-3" style="display: none;">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Academic Program Sought *</label>
                            <select id="adm-program" class="form-control" required>
                                ${window.LmsData.programs.map(p => `
                                    <option value="${p.id}">${p.name} (${p.urdu})</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Campus / Branch *</label>
                            <select id="adm-branch" class="form-control" required>
                                ${window.LmsData.institution.branches.map(b => `
                                    <option value="${b.id}">${b.name} - ${b.location}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="justify-content: center;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-top: 20px;">
                                <input type="checkbox" id="adm-hostel" style="width: 18px; height: 18px;">
                                <strong>Hostel & Mess Boarding Required (رہائش و طعام)</strong>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- STEP 4 -->
                <div id="step-content-4" style="display: none;">
                    <div style="background: rgba(6, 78, 59, 0.2); border: 1px solid var(--primary-600); padding: 16px; border-radius: var(--radius-sm); margin-bottom: 16px;">
                        <h4 style="color: var(--gold-300); margin-bottom: 6px;"><i class="fas fa-file-check"></i> Declaration of Adab & Piety</h4>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">
                            I hereby affirm that all information provided is accurate and that I shall uphold the sacred traditions, piety, 
                            and Sunnah-oriented discipline of Jamia Ashrafia Lahore under the guidance of Hazrat Mohtamim and the Asatizah.
                        </p>
                    </div>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="adm-terms" required style="width: 18px; height: 18px;" checked>
                        <span>I accept the disciplinary code of Wifaq-ul-Madaris Al-Arabia Pakistan.</span>
                    </label>
                </div>
            </form>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Cancel</button>
            <button class="btn btn-secondary" id="btn-wiz-prev" onclick="AdmissionsModule.prevStep()" style="display: none;">Previous</button>
            <button class="btn btn-gold" id="btn-wiz-next" onclick="AdmissionsModule.nextStep()">Next Step <i class="fas fa-arrow-right"></i></button>
        `;

        window.App.openModal();
    },

    nextStep() {
        if (this.currentStep === 1) {
            const name = document.getElementById('adm-name').value.trim();
            const father = document.getElementById('adm-father').value.trim();
            const cnic = document.getElementById('adm-cnic').value.trim();
            if (!name || !father || !cnic) {
                window.App.showToast("Please fill in candidate name, father name, and CNIC/B-Form", "warning");
                return;
            }
        }

        if (this.currentStep < 4) {
            document.getElementById(`step-content-${this.currentStep}`).style.display = 'none';
            document.getElementById(`step-wiz-${this.currentStep}`).classList.remove('active');
            document.getElementById(`step-wiz-${this.currentStep}`).classList.add('completed');

            this.currentStep++;
            document.getElementById(`step-content-${this.currentStep}`).style.display = 'block';
            document.getElementById(`step-wiz-${this.currentStep}`).classList.add('active');

            document.getElementById('btn-wiz-prev').style.display = 'inline-flex';
            if (this.currentStep === 4) {
                document.getElementById('btn-wiz-next').innerHTML = `<i class="fas fa-paper-plane"></i> Submit Application`;
                document.getElementById('btn-wiz-next').className = 'btn btn-primary';
            }
        } else {
            this.submitApplication();
        }
    },

    prevStep() {
        if (this.currentStep > 1) {
            document.getElementById(`step-content-${this.currentStep}`).style.display = 'none';
            document.getElementById(`step-wiz-${this.currentStep}`).classList.remove('active');

            this.currentStep--;
            document.getElementById(`step-content-${this.currentStep}`).style.display = 'block';
            document.getElementById(`step-wiz-${this.currentStep}`).classList.add('active');

            if (this.currentStep === 1) {
                document.getElementById('btn-wiz-prev').style.display = 'none';
            }
            document.getElementById('btn-wiz-next').innerHTML = `Next Step <i class="fas fa-arrow-right"></i>`;
            document.getElementById('btn-wiz-next').className = 'btn btn-gold';
        }
    },

    submitApplication() {
        const name = document.getElementById('adm-name').value.trim();
        const father = document.getElementById('adm-father').value.trim();
        const cnic = document.getElementById('adm-cnic').value.trim();
        const phone = document.getElementById('adm-phone').value.trim();
        const email = document.getElementById('adm-email').value.trim();
        const prev = document.getElementById('adm-prev-madrasa').value.trim();
        const hafiz = document.getElementById('adm-hafiz').checked;
        const programId = document.getElementById('adm-program').value;
        const branchId = document.getElementById('adm-branch').value;
        const hostel = document.getElementById('adm-hostel').checked;

        const newAppNo = `ASH-ADM-2024-${String(window.LmsData.admissions.length + 90).padStart(3, '0')}`;
        
        const newRecord = {
            id: `adm_${Date.now()}`,
            applicationNo: newAppNo,
            name: name,
            fatherName: father,
            cnic: cnic,
            phone: phone || "+92 300 0000000",
            email: email || "student@ashrafia.org",
            programId: programId,
            branchId: branchId,
            hostelRequired: hostel,
            previousMadrasa: prev || "None",
            hafizStatus: hafiz,
            status: "APPLIED",
            interviewDate: null,
            interviewScore: null,
            allottedRollNo: null,
            appliedAt: new Date().toISOString().split('T')[0]
        };

        window.LmsData.admissions.unshift(newRecord);
        window.DataStore.save(window.LmsData);
        window.App.closeModal();
        window.App.showToast(`Application ${newAppNo} successfully registered!`, "success");
        window.App.navigate('admissions');
    },

    scheduleInterviewModal(id) {
        const item = window.LmsData.admissions.find(a => a.id === id);
        if (!item) return;

        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-calendar-alt" style="color: var(--gold-400);"></i> Schedule Academic Interview`;
        modalBody.innerHTML = `
            <div style="margin-bottom: 16px;">
                <strong>Candidate:</strong> ${item.name} (${item.applicationNo})<br>
                <strong>Program:</strong> Dars-e-Nizami / Wifaq Admission
            </div>
            <div class="form-group" style="margin-bottom: 16px;">
                <label>Select Interview Date & Time</label>
                <input type="datetime-local" id="interview-time" class="form-control" value="2026-10-06T10:00">
            </div>
            <div class="form-group">
                <label>Interviewing Board</label>
                <input type="text" class="form-control" value="Nazim-e-Taleemat & Faculty of Hadith Committee" readonly>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Cancel</button>
            <button class="btn btn-gold" onclick="AdmissionsModule.confirmInterview('${id}')">Set Interview & Notify</button>
        `;
        window.App.openModal();
    },

    confirmInterview(id) {
        const item = window.LmsData.admissions.find(a => a.id === id);
        if (item) {
            const time = document.getElementById('interview-time').value;
            item.status = 'INTERVIEW_SCHEDULED';
            item.interviewDate = time.replace('T', ' ');
            window.DataStore.save(window.LmsData);
            window.App.closeModal();
            window.App.showToast(`Interview scheduled for ${item.name}`, "gold");
            window.App.navigate('admissions');
        }
    },

    approveAdmission(id) {
        const item = window.LmsData.admissions.find(a => a.id === id);
        if (!item) return;

        const nextRollNumber = `ASH-2024-${String(window.LmsData.users.filter(u => u.role === 'STUDENT').length + 50).padStart(3, '0')}`;
        item.status = 'APPROVED';
        item.allottedRollNo = nextRollNumber;
        item.interviewScore = 92.0;

        // Create student user profile
        const newUser = {
            id: `u_stud_${Date.now()}`,
            name: item.name,
            urduName: item.name,
            role: "STUDENT",
            rollNo: nextRollNumber,
            classId: "cls_dawra_a",
            program: "Dars-e-Nizami",
            branchId: item.branchId,
            email: item.email,
            hostel: item.hostelRequired ? "Hostel Block A" : "Day Scholar",
            avatar: item.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        };
        window.LmsData.users.push(newUser);

        window.DataStore.save(window.LmsData);
        window.App.showToast(`Candidate Approved! Allotted Roll No: ${nextRollNumber}`, "success");
        window.App.navigate('admissions');
    },

    printStudentCard(id) {
        const item = window.LmsData.admissions.find(a => a.id === id);
        if (!item) return;

        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-id-card" style="color: var(--primary-400);"></i> Digital Student Identity Card`;
        modalBody.innerHTML = `
            <div style="display: flex; justify-content: center; padding: 10px;">
                <div style="width: 380px; background: linear-gradient(135deg, #022018 0%, #064e3b 100%); border: 2px solid var(--gold-400); border-radius: 12px; padding: 20px; color: #ffffff; box-shadow: var(--shadow-lg); position: relative; overflow: hidden;">
                    <!-- Card Header -->
                    <div style="display: flex; align-items: center; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px; margin-bottom: 14px;">
                        <img src="assets/images/crest.jpg" style="width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--gold-400);">
                        <div>
                            <div style="font-weight: 800; font-size: 0.95rem; color: #ffffff;">JAMIA ASHRAFIA LAHORE</div>
                            <div style="font-family: 'Amiri', serif; font-size: 0.85rem; color: var(--gold-200);">جامعہ اشرفیہ، لاہور - علم اور تقویٰ</div>
                        </div>
                    </div>

                    <!-- Card Body -->
                    <div style="display: flex; gap: 16px;">
                        <div style="width: 80px; height: 95px; background: #111a1e; border: 1px solid var(--gold-400); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: var(--gold-300);">
                            <i class="fas fa-user-graduate"></i>
                        </div>
                        <div style="flex: 1; font-size: 0.82rem; line-height: 1.6;">
                            <div><strong>Name:</strong> ${item.name}</div>
                            <div><strong>Roll No:</strong> <span style="color: var(--gold-300); font-weight: 700;">${item.allottedRollNo || 'ASH-2024-001'}</span></div>
                            <div><strong>Department:</strong> Dars-e-Nizami</div>
                            <div><strong>CNIC:</strong> ${item.cnic}</div>
                            <div><strong>Branch:</strong> Main Ferozepur Rd</div>
                        </div>
                    </div>

                    <!-- Card Footer & Barcode -->
                    <div style="margin-top: 14px; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 10px; display: flex; align-items: center; justify-content: space-between;">
                        <div style="font-family: monospace; font-size: 0.72rem; letter-spacing: 2px; color: var(--gold-200);">
                            ||| | |||| | |||||| || |
                        </div>
                        <div style="font-size: 0.65rem; color: #cbd5e1; text-align: right;">
                            Valid Session: 1446-1447 AH<br>Authorized Signatory
                        </div>
                    </div>
                </div>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Close</button>
            <button class="btn btn-gold" onclick="window.print()"><i class="fas fa-print"></i> Print ID Card</button>
        `;
        window.App.openModal();
    },

    filterByStatus(status) {
        const all = window.LmsData.admissions;
        const filtered = status === 'ALL' ? all : all.filter(a => a.status === status);
        document.querySelector('#admissions-table tbody').innerHTML = this.renderAdmissionsRows(filtered);
    },

    exportAdmissionsCSV() {
        const rows = [
            ["Application No", "Name", "Father Name", "CNIC", "Phone", "Program", "Status", "Roll Number"]
        ];
        window.LmsData.admissions.forEach(a => {
            rows.push([a.applicationNo, a.name, a.fatherName, a.cnic, a.phone, a.programId, a.status, a.allottedRollNo || "N/A"]);
        });
        const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Jamia_Ashrafia_Admissions_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.App.showToast("Wifaq admission list exported to CSV", "success");
    }
};

window.AdmissionsModule = AdmissionsModule;
