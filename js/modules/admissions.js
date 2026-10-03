/**
 * JAMIA ASHRAFIA LAHORE - ADMISSIONS & REGISTRATION MODULE
 * Complete online student application workflow, verification queue, interview evaluation,
 * approval/rejection pipeline, and formal conversion of approved candidates into active LMS scholars.
 */

const AdmissionsModule = {
    currentStep: 1,
    activeStatusFilter: 'ALL',
    activeCategoryFilter: 'ALL',
    searchQuery: '',

    render() {
        const canApprove = window.AuthRBAC.can("admissions:approve");
        const admissions = window.LmsData.admissions || [];

        // Apply filters
        let filtered = admissions;
        if (this.activeStatusFilter !== 'ALL') {
            filtered = filtered.filter(a => a.status === this.activeStatusFilter);
        }

        if (this.activeCategoryFilter && this.activeCategoryFilter !== 'ALL') {
            if (this.activeCategoryFilter === 'LOCAL') {
                filtered = filtered.filter(a => a.studentType === 'LOCAL' || (!a.studentType && !a.passport));
            } else if (this.activeCategoryFilter === 'INTERNATIONAL') {
                filtered = filtered.filter(a => a.studentType === 'INTERNATIONAL' || a.passport);
            }
        }

        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(a => 
                (a.name && a.name.toLowerCase().includes(q)) ||
                (a.applicationNo && a.applicationNo.toLowerCase().includes(q)) ||
                (a.fatherName && a.fatherName.toLowerCase().includes(q)) ||
                (a.cnic && a.cnic.toLowerCase().includes(q)) ||
                (a.passport && a.passport.toLowerCase().includes(q)) ||
                (a.country && a.country.toLowerCase().includes(q)) ||
                (a.phone && a.phone.includes(q))
            );
        }

        // Metrics calculations
        const totalCount = admissions.length;
        const appliedCount = admissions.filter(a => a.status === 'APPLIED').length;
        const reviewCount = admissions.filter(a => a.status === 'UNDER_REVIEW').length;
        const interviewCount = admissions.filter(a => a.status === 'INTERVIEW_SCHEDULED').length;
        const approvedCount = admissions.filter(a => a.status === 'APPROVED').length;
        const enrolledCount = admissions.filter(a => a.status === 'ENROLLED').length;
        const rejectedCount = admissions.filter(a => a.status === 'REJECTED').length;
        const hostelRequests = admissions.filter(a => a.hostelRequired).length;

        return `
            <!-- HEADER -->
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-user-graduate" style="color: var(--primary-400);"></i>
                        Student Admissions & Registration Management
                    </h1>
                    <p>Admissions portal for Dars-e-Nizami, Takhassusat, Hifz, candidate verification, interviews, and scholar onboarding</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-secondary btn-sm" onclick="AdmissionsModule.exportAdmissionsCSV()">
                        <i class="fas fa-file-export"></i> Export Wifaq List
                    </button>
                    <button class="btn btn-gold btn-sm" onclick="AdmissionsModule.openNewApplicationModal()">
                        <i class="fas fa-plus-circle"></i> New Student Application
                    </button>
                </div>
            </div>

            <!-- ADMISSION METRICS -->
            <div class="metrics-grid">
                <div class="metric-card gold">
                    <div class="metric-icon-box" style="background: rgba(217, 119, 6, 0.2); color: var(--gold-400);"><i class="fas fa-file-signature"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Total Applications</span>
                        <span class="metric-value">${totalCount}</span>
                        <span class="metric-hint" style="color: var(--gold-300);">Session 1446-1447 AH</span>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon-box" style="background: rgba(245, 158, 11, 0.2); color: var(--warning);"><i class="fas fa-user-clock"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Interviews Scheduled</span>
                        <span class="metric-value">${interviewCount}</span>
                        <span class="metric-hint">Nazim Taleemat Board</span>
                    </div>
                </div>

                <div class="metric-card success">
                    <div class="metric-icon-box" style="background: rgba(16, 185, 129, 0.2); color: var(--primary-400);"><i class="fas fa-check-double"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Approved & Enrolled</span>
                        <span class="metric-value">${approvedCount + enrolledCount}</span>
                        <span class="metric-hint" style="color: var(--primary-300);">${enrolledCount} Active Scholars</span>
                    </div>
                </div>

                <div class="metric-card danger">
                    <div class="metric-icon-box" style="background: rgba(239, 68, 68, 0.2); color: var(--danger);"><i class="fas fa-bed"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Hostel Requests</span>
                        <span class="metric-value">${hostelRequests}</span>
                        <span class="metric-hint">Hostel Block A & B</span>
                    </div>
                </div>
            </div>

            <!-- ADMISSIONS QUEUE CARD -->
            <div class="card">
                <!-- PIPELINE STAGE FILTER TABS -->
                <div style="display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 14px; flex-wrap: wrap;">
                    <button class="btn ${this.activeStatusFilter === 'ALL' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="AdmissionsModule.filterByStage('ALL')">
                        <i class="fas fa-layer-group"></i> All (${totalCount})
                    </button>
                    <button class="btn ${this.activeStatusFilter === 'APPLIED' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="AdmissionsModule.filterByStage('APPLIED')">
                        <i class="fas fa-inbox"></i> Applied (${appliedCount})
                    </button>
                    <button class="btn ${this.activeStatusFilter === 'UNDER_REVIEW' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="AdmissionsModule.filterByStage('UNDER_REVIEW')">
                        <i class="fas fa-search"></i> Under Review (${reviewCount})
                    </button>
                    <button class="btn ${this.activeStatusFilter === 'INTERVIEW_SCHEDULED' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="AdmissionsModule.filterByStage('INTERVIEW_SCHEDULED')">
                        <i class="fas fa-calendar-alt"></i> Interview Scheduled (${interviewCount})
                    </button>
                    <button class="btn ${this.activeStatusFilter === 'APPROVED' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="AdmissionsModule.filterByStage('APPROVED')">
                        <i class="fas fa-award"></i> Approved (${approvedCount})
                    </button>
                    <button class="btn ${this.activeStatusFilter === 'ENROLLED' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="AdmissionsModule.filterByStage('ENROLLED')">
                        <i class="fas fa-user-check"></i> Enrolled (${enrolledCount})
                    </button>
                    <button class="btn ${this.activeStatusFilter === 'REJECTED' ? 'btn-gold' : 'btn-secondary'} btn-sm" onclick="AdmissionsModule.filterByStage('REJECTED')">
                        <i class="fas fa-ban"></i> Rejected (${rejectedCount})
                    </button>
                </div>

                <!-- SEARCH AND FILTER CONTROLS -->
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <div class="search-input-wrap" style="width: 290px; position: relative;">
                            <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
                            <input type="text" class="form-control" placeholder="Search applicant, CNIC, passport..." 
                                   value="${this.searchQuery}" oninput="AdmissionsModule.setSearch(this.value)" 
                                   style="padding: 8px 12px 8px 36px; width: 100%;">
                        </div>

                        <!-- STUDENT TYPE / CATEGORY FILTER -->
                        <select class="form-control" style="width: 175px; font-size: 0.82rem;" onchange="AdmissionsModule.setCategoryFilter(this.value)">
                            <option value="ALL" ${this.activeCategoryFilter === 'ALL' ? 'selected' : ''}>All Categories</option>
                            <option value="LOCAL" ${this.activeCategoryFilter === 'LOCAL' ? 'selected' : ''}>Local (CNIC)</option>
                            <option value="INTERNATIONAL" ${this.activeCategoryFilter === 'INTERNATIONAL' ? 'selected' : ''}>International (Passport)</option>
                        </select>
                    </div>

                    <div style="font-size: 0.82rem; color: var(--text-muted);">
                        Showing ${filtered.length} of ${admissions.length} applications
                    </div>
                </div>

                <!-- ADMISSIONS TABLE -->
                <div class="table-responsive">
                    <table class="data-table" id="admissions-table">
                        <thead>
                            <tr>
                                <th>App No & Candidate</th>
                                <th>Category</th>
                                <th>Program & Branch</th>
                                <th>Identification / Contact</th>
                                <th>Madrasa Background</th>
                                <th>Interview / Marks</th>
                                <th>Status</th>
                                <th style="text-align: right; width: 220px;">Admissions Workflow</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.renderAdmissionsRows(filtered)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    filterByStage(stage) {
        this.activeStatusFilter = stage;
        const viewport = document.getElementById('main-content-viewport');
        if (viewport) viewport.innerHTML = this.render();
    },

    setCategoryFilter(cat) {
        this.activeCategoryFilter = cat;
        const viewport = document.getElementById('main-content-viewport');
        if (viewport) viewport.innerHTML = this.render();
    },

    setSearch(q) {
        this.searchQuery = q;
        const viewport = document.getElementById('main-content-viewport');
        if (viewport) viewport.innerHTML = this.render();
    },

    renderAdmissionsRows(list) {
        if (!list || list.length === 0) {
            return `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 48px;">
                        <i class="fas fa-folder-open" style="font-size: 2.5rem; margin-bottom: 12px; opacity: 0.4;"></i>
                        <div style="font-size: 1.05rem; color: var(--primary-950); margin-bottom: 4px;">No applications found</div>
                        <div style="font-size: 0.85rem;">No admission applications match the active pipeline filter.</div>
                    </td>
                </tr>
            `;
        }

        const canApprove = window.AuthRBAC.can("admissions:approve");

        return list.map(item => {
            const prog = (window.LmsData.programs || []).find(p => p.id === item.programId) || { name: 'Dars-e-Nizami' };
            const branch = (window.LmsData.institution?.branches || []).find(b => b.id === item.branchId) || { name: 'Main Campus' };

            let statusPill = '';
            if (item.status === 'ENROLLED') {
                statusPill = '<span class="status-pill success"><i class="fas fa-check-circle"></i> Enrolled</span>';
            } else if (item.status === 'APPROVED') {
                statusPill = '<span class="status-pill gold"><i class="fas fa-award"></i> Approved</span>';
            } else if (item.status === 'INTERVIEW_SCHEDULED') {
                statusPill = '<span class="status-pill warning"><i class="fas fa-calendar-alt"></i> Interview Set</span>';
            } else if (item.status === 'UNDER_REVIEW') {
                statusPill = '<span class="status-pill info"><i class="fas fa-search"></i> Under Review</span>';
            } else if (item.status === 'REJECTED') {
                statusPill = '<span class="status-pill danger"><i class="fas fa-times-circle"></i> Rejected</span>';
            } else {
                statusPill = '<span class="status-pill primary"><i class="fas fa-inbox"></i> Applied</span>';
            }

            const isIntl = (item.studentType === 'INTERNATIONAL' || (!item.cnic && item.passport));
            return `
                <tr>
                    <td>
                        <div style="font-weight: 700; color: var(--primary-950);">
                            <a href="javascript:void(0)" onclick="AdmissionsModule.viewApplication('${item.id}')" style="color: var(--primary-950); text-decoration: none;" onmouseover="this.style.color='var(--gold-600)'" onmouseout="this.style.color='var(--primary-950)'">
                                ${item.name}
                            </a>
                        </div>
                        <div style="font-size: 0.75rem; color: var(--gold-700); font-family: monospace; font-weight: 700;">${item.applicationNo}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">S/O ${item.fatherName}</div>
                    </td>
                    <td>
                        ${isIntl ? `
                            <span class="status-pill gold" style="font-size: 0.72rem; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="fas fa-globe-americas"></i> International
                            </span>
                            <div style="font-size: 0.72rem; color: var(--gold-700); margin-top: 2px;">${item.country || 'Overseas'}</div>
                        ` : `
                            <span class="status-pill info" style="font-size: 0.72rem; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="fas fa-flag"></i> Local
                            </span>
                            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">Pakistan</div>
                        `}
                    </td>
                    <td>
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 0.85rem;">${prog.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);"><i class="fas fa-map-marker-alt"></i> ${branch.name}</div>
                        ${item.hostelRequired ? '<span class="status-pill danger" style="font-size: 0.65rem; margin-top: 3px;"><i class="fas fa-bed"></i> Hostel Needed</span>' : ''}
                    </td>
                    <td>
                        ${isIntl ? `
                            <div style="font-family: monospace; font-size: 0.8rem; color: var(--gold-300);" title="Passport Number">
                                <i class="fas fa-passport" style="font-size: 0.72rem; margin-right: 3px;"></i>${item.passport || 'N/A'}
                            </div>
                        ` : `
                            <div style="font-family: monospace; font-size: 0.8rem; color: var(--text-primary);" title="CNIC / B-Form">
                                <i class="fas fa-id-card" style="font-size: 0.72rem; margin-right: 3px; color: var(--primary-400);"></i>${item.cnic || 'N/A'}
                            </div>
                        `}
                        <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;"><i class="fas fa-phone"></i> ${item.phone}</div>
                    </td>
                    <td>
                        <div style="font-size: 0.8rem; max-width: 200px;">${item.previousMadrasa || 'Fresh Applicant'}</div>
                        ${item.hafizStatus ? '<span class="status-pill success" style="font-size: 0.65rem; margin-top: 3px;"><i class="fas fa-quran"></i> Hafiz-ul-Quran</span>' : ''}
                    </td>
                    <td>
                        ${item.interviewScore ? `
                            <div><strong style="color: var(--gold-300); font-size: 0.9rem;">${item.interviewScore} / 100</strong></div>
                            <div style="font-size: 0.72rem; color: var(--text-muted);"><i class="fas fa-check"></i> Evaluated</div>
                        ` : (item.interviewDate ? `
                            <div style="font-size: 0.78rem; color: var(--warning);"><i class="fas fa-clock"></i> ${item.interviewDate}</div>
                        ` : `
                            <span style="font-size: 0.75rem; color: var(--text-muted);">Pending</span>
                        `)}
                    </td>
                    <td>${statusPill}</td>
                    <td style="text-align: right; white-space: nowrap;">
                        <div style="display: inline-flex; gap: 5px; align-items: center;">
                            <!-- VIEW DOSSIER BUTTON -->
                            <button class="btn btn-secondary btn-sm" onclick="AdmissionsModule.viewApplication('${item.id}')" title="Inspect Complete Application Dossier">
                                <i class="fas fa-folder-open"></i> Dossier
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="AdmissionsModule.openEditApplicationModal('${item.id}')" title="Edit Application">
                                <i class="fas fa-edit"></i> Edit
                            </button>

                            <!-- STAGE SPECIFIC ACTIONS -->
                            ${item.status === 'APPLIED' ? `
                                <button class="btn btn-gold btn-sm" onclick="AdmissionsModule.scheduleInterviewModal('${item.id}')" title="Schedule Academic Interview">
                                    <i class="fas fa-calendar-alt"></i> Interview
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick="AdmissionsModule.setUnderReview('${item.id}')" title="Mark Under Review">
                                    <i class="fas fa-search"></i>
                                </button>
                            ` : ''}

                            ${item.status === 'UNDER_REVIEW' ? `
                                <button class="btn btn-gold btn-sm" onclick="AdmissionsModule.scheduleInterviewModal('${item.id}')" title="Schedule Academic Interview">
                                    <i class="fas fa-calendar-alt"></i> Interview
                                </button>
                                <button class="btn btn-primary btn-sm" onclick="AdmissionsModule.quickApproveModal('${item.id}')" title="Direct Approve">
                                    <i class="fas fa-check"></i> Approve
                                </button>
                            ` : ''}

                            ${item.status === 'INTERVIEW_SCHEDULED' ? `
                                <button class="btn btn-gold btn-sm" onclick="AdmissionsModule.openInterviewEvaluationModal('${item.id}')" title="Enter Interview Scores & Make Decision">
                                    <i class="fas fa-clipboard-check"></i> Evaluate
                                </button>
                            ` : ''}

                            ${item.status === 'APPROVED' ? `
                                <button class="btn btn-primary btn-sm" onclick="AdmissionsModule.openEnrollmentModal('${item.id}')" title="Convert to Active Scholar & Generate LMS Account">
                                    <i class="fas fa-user-plus"></i> Enroll Student
                                </button>
                            ` : ''}

                            ${item.status === 'ENROLLED' ? `
                                <button class="btn btn-secondary btn-sm" onclick="AdmissionsModule.printStudentCard('${item.id}')" title="Print Student ID Card">
                                    <i class="fas fa-id-card"></i> ID Card
                                </button>
                                <button class="btn btn-gold btn-sm" onclick="AdmissionsModule.viewEnrolledStudent('${item.id}')" title="View Student in Roster">
                                    <i class="fas fa-user"></i>
                                </button>
                            ` : ''}

                            ${item.status === 'REJECTED' ? `
                                <button class="btn btn-secondary btn-sm" onclick="AdmissionsModule.reopenApplication('${item.id}')" title="Reopen Application for Review">
                                    <i class="fas fa-redo"></i> Reopen
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // =========================================================================
    // APPLICANT FULL DOSSIER MODAL
    // =========================================================================
    viewApplication(appId) {
        const item = (window.LmsData.admissions || []).find(a => a.id === appId);
        if (!item) return;

        const prog = (window.LmsData.programs || []).find(p => p.id === item.programId) || { name: 'Dars-e-Nizami' };
        const branch = (window.LmsData.institution?.branches || []).find(b => b.id === item.branchId) || { name: 'Main Campus' };

        const titleEl = document.getElementById('modal-title-text');
        const bodyEl = document.getElementById('modal-body-container');
        const footerEl = document.getElementById('modal-footer-container');

        if (titleEl) {
            titleEl.innerHTML = `<i class="fas fa-file-alt" style="color: var(--gold-400);"></i> Applicant Dossier: ${item.name} (${item.applicationNo})`;
        }

        if (bodyEl) {
            bodyEl.innerHTML = `
                <!-- APPLICANT HEADER SUMMARY -->
                <div style="background: linear-gradient(135deg, rgba(6, 78, 59, 0.4) 0%, rgba(17, 24, 39, 0.8) 100%); border: 1px solid var(--border-prominent); border-radius: var(--radius-md); padding: 18px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <h3 style="color: var(--primary-950); margin: 0; font-size: 1.25rem;">${item.name}</h3>
                                <span class="status-pill gold" style="font-family: monospace;">${item.applicationNo}</span>
                            </div>
                            <div style="font-size: 0.85rem; color: var(--gold-700); margin-top: 4px;">
                                Son of ${item.fatherName}
                            </div>
                            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
                                Applied: ${item.appliedAt || '2026-09-24'} &bull; Branch: ${branch.name}
                            </div>
                        </div>

                        <div>
                            <span class="status-pill ${item.status === 'ENROLLED' ? 'success' : (item.status === 'APPROVED' ? 'gold' : (item.status === 'REJECTED' ? 'danger' : 'warning'))}" style="font-size: 0.85rem; padding: 6px 14px;">
                                Status: <strong>${item.status}</strong>
                            </span>
                        </div>
                    </div>
                </div>

                <!-- DOSSIER DETAILS GRID -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; font-size: 0.85rem;">
                    <!-- PERSONAL & IDENTITY -->
                    <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); line-height: 2;">
                        <h4 style="color: var(--primary-950); margin-bottom: 8px;"><i class="fas fa-id-card"></i> Personal Information</h4>
                        <div><strong>Candidate Name:</strong> ${item.name}</div>
                        <div><strong>Father's Name:</strong> ${item.fatherName}</div>
                        <div><strong>Student Category:</strong> ${isIntl ? '<span class="status-pill gold"><i class="fas fa-globe"></i> International Student</span>' : '<span class="status-pill info"><i class="fas fa-flag"></i> Local Student</span>'}</div>
                        ${isIntl ? `
                            <div><strong>Passport Number:</strong> <code style="color: var(--gold-700); font-weight: 700;">${item.passport || 'N/A'}</code></div>
                            <div><strong>Country of Residence:</strong> <span style="color: var(--text-primary); font-weight: 600;">${item.country || 'International'}</span></div>
                        ` : `
                            <div><strong>CNIC / B-Form:</strong> <code style="color: var(--gold-700); font-weight: 700;">${item.cnic || 'N/A'}</code></div>
                            <div><strong>Country:</strong> Pakistan</div>
                        `}
                        <div><strong>Contact Phone:</strong> ${item.phone}</div>
                        <div><strong>Email Address:</strong> ${item.email || 'N/A'}</div>
                    </div>

                    <!-- ACADEMIC BACKGROUND -->
                    <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); line-height: 2;">
                        <h4 style="color: var(--gold-700); margin-bottom: 8px;"><i class="fas fa-university"></i> Educational Background</h4>
                        <div><strong>Program Sought:</strong> ${prog.name}</div>
                        <div><strong>Previous Madrasa:</strong> ${item.previousMadrasa || 'None'}</div>
                        <div><strong>Hafiz-ul-Quran:</strong> ${item.hafizStatus ? '<span class="status-pill success" style="font-size: 0.7rem;">Verified Hafiz</span>' : 'No'}</div>
                        <div><strong>Hostel Required:</strong> ${item.hostelRequired ? '<span class="status-pill danger" style="font-size: 0.7rem;">Boarding Requested</span>' : 'Day Scholar'}</div>
                        <div><strong>Allotted Roll No:</strong> <code style="color: var(--primary-700);">${item.allottedRollNo || 'Pending Enrollment'}</code></div>
                    </div>
                </div>

                <!-- INTERVIEW & COMMITTEE ASSESSMENT -->
                <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); margin-bottom: 16px;">
                    <h4 style="color: var(--primary-950); margin-bottom: 10px;"><i class="fas fa-user-check" style="color: var(--gold-600);"></i> Admission Committee & Evaluation Record</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 0.85rem; line-height: 1.8;">
                        <div>
                            <div><strong>Interview Date & Time:</strong> ${item.interviewDate || 'Not yet scheduled'}</div>
                            <div><strong>Interviewing Board:</strong> Nazim-e-Taleemat & Hadith Faculty Board</div>
                            <div><strong>Overall Score:</strong> <strong style="color: var(--gold-700);">${item.interviewScore ? item.interviewScore + ' / 100' : 'Pending Evaluation'}</strong></div>
                        </div>
                        <div>
                            <div><strong>Committee Remarks:</strong> ${item.committeeRemarks || 'Candidate meets baseline prerequisites for testing.'}</div>
                            ${item.rejectionReason ? `
                                <div style="color: var(--danger); margin-top: 6px;">
                                    <strong>Rejection Reason:</strong> ${item.rejectionReason}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        if (footerEl) {
            let actionButtons = `<button class="btn btn-secondary" onclick="App.closeModal()">Close</button>`;

            actionButtons += `
                <button class="btn btn-secondary" onclick="AdmissionsModule.openEditApplicationModal('${item.id}')">
                    <i class="fas fa-edit"></i> Edit Details
                </button>
            `;

            if (item.status === 'APPLIED' || item.status === 'UNDER_REVIEW') {
                actionButtons += `
                    <button class="btn btn-danger" onclick="AdmissionsModule.openRejectModal('${item.id}')">Reject</button>
                    <button class="btn btn-gold" onclick="AdmissionsModule.scheduleInterviewModal('${item.id}')">
                        <i class="fas fa-calendar-alt"></i> Schedule Interview
                    </button>
                `;
            } else if (item.status === 'INTERVIEW_SCHEDULED') {
                actionButtons += `
                    <button class="btn btn-danger" onclick="AdmissionsModule.openRejectModal('${item.id}')">Reject</button>
                    <button class="btn btn-gold" onclick="AdmissionsModule.openInterviewEvaluationModal('${item.id}')">
                        <i class="fas fa-clipboard-check"></i> Evaluate & Decide
                    </button>
                `;
            } else if (item.status === 'APPROVED') {
                actionButtons += `
                    <button class="btn btn-danger" onclick="AdmissionsModule.openRejectModal('${item.id}')">Revoke Approval</button>
                    <button class="btn btn-primary" onclick="AdmissionsModule.openEnrollmentModal('${item.id}')">
                        <i class="fas fa-user-plus"></i> Enroll as Active Student
                    </button>
                `;
            } else if (item.status === 'ENROLLED') {
                actionButtons += `
                    <button class="btn btn-gold" onclick="AdmissionsModule.printStudentCard('${item.id}')">
                        <i class="fas fa-id-card"></i> Print Student ID
                    </button>
                    <button class="btn btn-primary" onclick="AdmissionsModule.viewEnrolledStudent('${item.id}')">
                        <i class="fas fa-user"></i> View Profile in Students
                    </button>
                `;
            }

            footerEl.innerHTML = actionButtons;
        }

        App.openModal();
    },

    setUnderReview(appId) {
        const item = (window.LmsData.admissions || []).find(a => a.id === appId);
        if (!item) return;

        item.status = 'UNDER_REVIEW';
        window.DataStore.save(window.LmsData);
        App.showToast(`Application ${item.applicationNo} marked as Under Review`, "info");

        const viewport = document.getElementById('main-content-viewport');
        if (viewport && App.currentRoute === 'admissions') {
            viewport.innerHTML = this.render();
        }
    },

    // =========================================================================
    // INTERVIEW SCHEDULING
    // =========================================================================
    scheduleInterviewModal(id) {
        const item = (window.LmsData.admissions || []).find(a => a.id === id);
        if (!item) return;

        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        const modalFooter = document.getElementById('modal-footer-container');
        
        modalTitle.innerHTML = `<i class="fas fa-calendar-alt" style="color: var(--gold-400);"></i> Schedule Academic Interview`;
        modalBody.innerHTML = `
            <div style="margin-bottom: 16px;">
                <p style="color: var(--text-primary); font-size: 0.95rem; margin-bottom: 6px;">
                    Schedule interview for candidate <strong>${item.name}</strong> (<code style="color: var(--gold-700);">${item.applicationNo}</code>).
                </p>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 14px;">
                    Father: ${item.fatherName} &bull; CNIC: ${item.cnic}
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
                <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                    Interview Date & Time *
                </label>
                <input type="datetime-local" id="interview-time" class="form-control" value="2026-10-06T10:00" required>
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
                <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                    Interviewing Board / Examination Committee
                </label>
                <input type="text" id="interview-board" class="form-control" value="Nazim-e-Taleemat & Faculty of Hadith Committee">
            </div>

            <div class="form-group">
                <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                    Campus Venue
                </label>
                <select id="interview-venue" class="form-control">
                    <option value="Main Campus - Darul Ifta Seminar Hall">Main Campus - Darul Ifta Seminar Hall</option>
                    <option value="Main Campus - Hall Imam Bukhari">Main Campus - Hall Imam Bukhari</option>
                    <option value="Model Town Branch - Committee Room">Model Town Branch - Committee Room</option>
                </select>
            </div>
        `;

        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn-gold" onclick="AdmissionsModule.confirmInterview('${id}')">
                <i class="fas fa-calendar-check"></i> Set Interview & Notify Candidate
            </button>
        `;
        App.openModal();
    },

    confirmInterview(id) {
        const item = (window.LmsData.admissions || []).find(a => a.id === id);
        if (item) {
            const time = document.getElementById('interview-time').value;
            item.status = 'INTERVIEW_SCHEDULED';
            item.interviewDate = time.replace('T', ' ');
            window.DataStore.save(window.LmsData);
            App.closeModal();
            App.showToast(`Academic interview scheduled for ${item.name}!`, "gold");

            const viewport = document.getElementById('main-content-viewport');
            if (viewport && App.currentRoute === 'admissions') {
                viewport.innerHTML = this.render();
            }
        }
    },

    // =========================================================================
    // INTERVIEW EVALUATION & SCORING MODAL
    // =========================================================================
    openInterviewEvaluationModal(id) {
        const item = (window.LmsData.admissions || []).find(a => a.id === id);
        if (!item) return;

        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        const modalFooter = document.getElementById('modal-footer-container');

        modalTitle.innerHTML = `<i class="fas fa-clipboard-check" style="color: var(--gold-400);"></i> Candidate Interview Evaluation: ${item.name}`;

        modalBody.innerHTML = `
            <form id="form-interview-eval" onsubmit="AdmissionsModule.handleEvaluationSubmit(event, '${id}')">
                <div style="background: rgba(0,0,0,0.25); padding: 12px; border-radius: 6px; border: 1px solid var(--border-subtle); margin-bottom: 16px; font-size: 0.85rem;">
                    <div><strong>Candidate:</strong> ${item.name} (${item.applicationNo}) &bull; S/O ${item.fatherName}</div>
                    <div style="color: var(--text-muted);">Interview Date: ${item.interviewDate || 'Current Session'}</div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Overall Evaluation Score (0 - 100) *
                        </label>
                        <input type="number" id="eval-score" class="form-control" min="0" max="100" value="${item.interviewScore || 88}" required>
                    </div>

                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Committee Decision *
                        </label>
                        <select id="eval-decision" class="form-control" required>
                            <option value="APPROVED">Recommend for Admission (Approved)</option>
                            <option value="REJECTED">Ineligible / Disqualified (Reject)</option>
                        </select>
                    </div>
                </div>

                <div style="background: var(--bg-surface-elevated); padding: 12px; border-radius: 6px; border: 1px solid var(--border-subtle); margin-bottom: 16px;">
                    <div style="font-size: 0.82rem; font-weight: 700; color: var(--gold-700); margin-bottom: 8px;">Aptitude Rubric Assessment:</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.82rem;">
                        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                            <input type="checkbox" checked style="accent-color: var(--primary-500);"> Quran Recitation & Tajweed
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                            <input type="checkbox" checked style="accent-color: var(--primary-500);"> Arabic Morphology (Sarf-o-Nahw)
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                            <input type="checkbox" checked style="accent-color: var(--primary-500);"> Islamic Jurisprudence Aptitude
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                            <input type="checkbox" checked style="accent-color: var(--primary-500);"> Sunnah Conduct & Adab Verified
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                        Committee Remarks / Examination Notes
                    </label>
                    <textarea id="eval-remarks" class="form-control" rows="3" placeholder="Enter notes from the interviewing committee...">${item.committeeRemarks || 'Candidate demonstrates sound foundational knowledge in Arabic and Quranic recitation.'}</textarea>
                </div>
            </form>
        `;

        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn-gold" onclick="document.getElementById('form-interview-eval').requestSubmit()">
                <i class="fas fa-check-circle"></i> Save Evaluation & Record Decision
            </button>
        `;

        App.openModal();
    },

    handleEvaluationSubmit(e, appId) {
        e.preventDefault();
        const item = (window.LmsData.admissions || []).find(a => a.id === appId);
        if (!item) return;

        const score = parseFloat(document.getElementById('eval-score').value) || 0;
        const decision = document.getElementById('eval-decision').value;
        const remarks = document.getElementById('eval-remarks').value.trim();

        item.interviewScore = score;
        item.committeeRemarks = remarks;
        item.status = decision;

        if (decision === 'REJECTED') {
            item.rejectionReason = remarks || 'Interview score below required threshold';
        }

        window.DataStore.save(window.LmsData);
        App.closeModal();

        if (decision === 'APPROVED') {
            App.showToast(`Candidate ${item.name} Approved with score ${score}! Ready for enrollment.`, "success");
            // Prompt immediate enrollment
            setTimeout(() => {
                AdmissionsModule.openEnrollmentModal(appId);
            }, 400);
        } else {
            App.showToast(`Application marked as Rejected.`, "warning");
        }

        const viewport = document.getElementById('main-content-viewport');
        if (viewport && App.currentRoute === 'admissions') {
            viewport.innerHTML = this.render();
        }
    },

    quickApproveModal(appId) {
        const item = (window.LmsData.admissions || []).find(a => a.id === appId);
        if (!item) return;

        if (confirm(`Directly approve candidate ${item.name} without additional interview?`)) {
            item.status = 'APPROVED';
            item.interviewScore = 90.0;
            item.committeeRemarks = 'Fast-track approved based on exceptional previous Wifaq sanad records.';
            window.DataStore.save(window.LmsData);
            App.showToast(`Candidate ${item.name} Approved! Ready for enrollment.`, "success");
            
            const viewport = document.getElementById('main-content-viewport');
            if (viewport && App.currentRoute === 'admissions') {
                viewport.innerHTML = this.render();
            }
        }
    },

    // =========================================================================
    // ENROLLMENT & ACTIVE STUDENT ACCOUNT GENERATION
    // =========================================================================
    openEnrollmentModal(id) {
        const item = (window.LmsData.admissions || []).find(a => a.id === id);
        if (!item) return;

        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        const modalFooter = document.getElementById('modal-footer-container');

        const existingCount = (window.LmsData.users || []).filter(u => u.role === 'STUDENT').length;
        const suggestedRollNo = item.allottedRollNo || `ASH-2026-${String(existingCount + 51).padStart(3, '0')}`;
        const suggestedEmail = item.email || `scholar.${suggestedRollNo.toLowerCase().replace(/[^a-z0-9]/g, '')}@jamiaashrafia.org`;

        modalTitle.innerHTML = `<i class="fas fa-user-plus" style="color: var(--primary-400);"></i> Finalize Student Enrollment & Generate LMS Account`;

        modalBody.innerHTML = `
            <form id="form-enrollment" onsubmit="AdmissionsModule.handleEnrollmentSubmit(event, '${id}')">
                <!-- CANDIDATE SUMMARY BANNER -->
                <div style="background: linear-gradient(135deg, rgba(6, 78, 59, 0.3) 0%, rgba(217, 119, 6, 0.15) 100%); border-left: 4px solid var(--gold-400); padding: 12px 16px; border-radius: 4px; margin-bottom: 18px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                        <div>
                            <strong style="color: var(--primary-950); font-size: 1rem;">${item.name}</strong>
                            <span style="color: var(--text-muted); font-size: 0.8rem;"> &bull; S/O ${item.fatherName}</span>
                            <div style="font-size: 0.78rem; color: var(--gold-700);">CNIC: ${item.cnic} &bull; Score: ${item.interviewScore || 90}%</div>
                        </div>
                        <span class="status-pill success"><i class="fas fa-check"></i> Interview Cleared</span>
                    </div>
                </div>

                <!-- ROLL NUMBER & CLASS PLACEMENT -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Allotted Institutional Roll Number *
                        </label>
                        <input type="text" id="enroll-roll-no" class="form-control" value="${suggestedRollNo}" required style="font-family: monospace; font-weight: 700; color: var(--gold-700);">
                    </div>

                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Academic Class & Section Assignment *
                        </label>
                        <select id="enroll-class" class="form-control" required>
                            <option value="cls_dawra_a">Dawra-e-Hadith (Final Year) - Section A</option>
                            <option value="cls_dawra_b">Dawra-e-Hadith (Final Year) - Section B</option>
                            <option value="cls_aaliyah">Aaliyah (7th Year)</option>
                            <option value="cls_ifta">Takhassus fil-Ifta (Postgraduate)</option>
                            <option value="cls_hifz_3">Hifz-ul-Quran (Daur-e-Kamil)</option>
                        </select>
                    </div>
                </div>

                <!-- LMS LOGIN CREDENTIALS -->
                <div style="background: var(--bg-surface-elevated); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); margin-bottom: 16px;">
                    <div style="font-weight: 700; color: var(--primary-950); margin-bottom: 10px; font-size: 0.85rem;">
                        <i class="fas fa-key"></i> Student LMS Portal Login Credentials:
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                        <div>
                            <label style="font-size: 0.78rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Student Login Email *</label>
                            <input type="email" id="enroll-email" class="form-control" value="${suggestedEmail}" required>
                        </div>
                        <div>
                            <label style="font-size: 0.78rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Initial Password *</label>
                            <input type="text" id="enroll-pwd" class="form-control" value="ashrafia123" required>
                        </div>
                    </div>
                </div>

                <!-- RESIDENCE & HOSTEL -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Residential Placement
                        </label>
                        <select id="enroll-hostel" class="form-control">
                            <option value="Day Scholar" ${!item.hostelRequired ? 'selected' : ''}>Day Scholar (Non-Resident)</option>
                            <option value="Hostel Block A (Resident Room)" ${item.hostelRequired ? 'selected' : ''}>Hostel Block A (Boarding Resident)</option>
                            <option value="Hostel Block B (Resident Room)">Hostel Block B (Boarding Resident)</option>
                        </select>
                    </div>

                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Tuition & Admission Fee Category
                        </label>
                        <select id="enroll-fee-cat" class="form-control">
                            <option value="STANDARD">Regular Admission Fee (PKR 3,500)</option>
                            <option value="SCHOLARSHIP">100% Zakat / Need-Based Scholarship</option>
                            <option value="MERIT_50">50% Merit Concession (Hafiz-ul-Quran)</option>
                        </select>
                    </div>
                </div>

                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.85rem; color: var(--text-secondary);">
                    <input type="checkbox" id="enroll-send-welcome" checked style="accent-color: var(--primary-500);">
                    <span>Send official SMS / LMS welcome broadcast with login details</span>
                </label>
            </form>
        `;

        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="document.getElementById('form-enrollment').requestSubmit()">
                <i class="fas fa-check-double"></i> Complete Enrollment & Activate Account
            </button>
        `;

        App.openModal();
    },

    handleEnrollmentSubmit(e, appId) {
        e.preventDefault();
        const item = (window.LmsData.admissions || []).find(a => a.id === appId);
        if (!item) return;

        const rollNo = document.getElementById('enroll-roll-no').value.trim();
        const classId = document.getElementById('enroll-class').value;
        const email = document.getElementById('enroll-email').value.trim();
        const password = document.getElementById('enroll-pwd').value.trim();
        const hostel = document.getElementById('enroll-hostel').value;
        const feeCategory = document.getElementById('enroll-fee-cat').value;

        // 1. Update Application status
        item.status = 'ENROLLED';
        item.allottedRollNo = rollNo;
        item.enrolledAt = new Date().toISOString();

        // 2. Create Active Student User in DataStore
        const newStudentUserId = `u_student_${Date.now()}`;
        item.enrolledStudentId = newStudentUserId;

        const prog = (window.LmsData.programs || []).find(p => p.id === item.programId) || { name: 'Dars-e-Nizami' };

        const isIntlStudent = item.studentType === 'INTERNATIONAL' || (!item.cnic && item.passport);
        const newStudentUser = {
            id: newStudentUserId,
            name: item.name,
            urduName: item.name,
            role: "STUDENT",
            studentType: isIntlStudent ? "INTERNATIONAL" : "LOCAL",
            country: item.country || (isIntlStudent ? "International" : "Pakistan"),
            rollNo: rollNo,
            classId: classId,
            program: prog.name,
            branchId: item.branchId || "b1",
            email: email,
            password: password,
            phone: item.phone,
            cnic: item.cnic || '',
            passport: item.passport || '',
            guardianName: item.fatherName,
            hostel: hostel,
            status: "ACTIVE",
            avatar: item.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
            attendancePct: 100,
            gpa: "Fresh Scholar (Enrolled)",
            enrollmentDate: new Date().toISOString().split('T')[0]
        };

        if (!window.LmsData.users) window.LmsData.users = [];
        window.LmsData.users.push(newStudentUser);

        // 3. Add Welcome Notification
        if (!window.LmsData.notifications) window.LmsData.notifications = [];
        window.LmsData.notifications.unshift({
            id: `notif_${Date.now()}`,
            title: `Welcome Scholar: ${item.name}`,
            urduTitle: `خوش آمدید طالب علم: ${item.name}`,
            message: `Congratulations! Your admission to ${prog.name} is confirmed. Allotted Scholar Roll No: ${rollNo}.`,
            targetRole: "STUDENT",
            targetUserId: newStudentUserId,
            category: "ACADEMIC",
            createdAt: new Date().toISOString().split('T')[0]
        });

        // 4. Save to Persistent Store
        window.DataStore.save(window.LmsData);
        App.closeModal();

        // 5. Open Congratulatory Success Modal
        setTimeout(() => {
            AdmissionsModule.openEnrollmentSuccessModal(newStudentUser, item);
        }, 300);

        const viewport = document.getElementById('main-content-viewport');
        if (viewport && App.currentRoute === 'admissions') {
            viewport.innerHTML = this.render();
        }
    },

    openEnrollmentSuccessModal(studentUser, appItem) {
        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        const modalFooter = document.getElementById('modal-footer-container');

        modalTitle.innerHTML = `<i class="fas fa-check-circle" style="color: var(--primary-400);"></i> Scholar Successfully Enrolled!`;

        modalBody.innerHTML = `
            <div style="text-align: center; padding: 20px 0;">
                <div style="width: 70px; height: 70px; background: rgba(16, 185, 129, 0.2); color: var(--primary-600); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; margin: 0 auto 16px;">
                    <i class="fas fa-user-check"></i>
                </div>
                <h3 style="color: var(--primary-950); margin-bottom: 6px;">Enrollment Completed Successfully</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; max-width: 500px; margin: 0 auto 20px;">
                    Candidate <strong>${studentUser.name}</strong> is now an active scholar of Jamia Ashrafia Lahore.
                </p>

                <!-- CREDENTIALS CARD -->
                <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-prominent); border-radius: 8px; padding: 16px; max-width: 480px; margin: 0 auto; text-align: left; line-height: 1.9; font-size: 0.85rem;">
                    <div><strong>Scholar Name:</strong> ${studentUser.name}</div>
                    <div><strong>Allotted Roll Number:</strong> <code style="color: var(--gold-700); font-weight: 700; font-size: 0.95rem;">${studentUser.rollNo}</code></div>
                    <div><strong>Class & Section:</strong> ${studentUser.classId}</div>
                    <div><strong>Portal Login Email:</strong> <code style="color: var(--primary-700);">${studentUser.email}</code></div>
                    <div><strong>Initial Password:</strong> <code style="color: var(--primary-800); font-weight: 700;">${studentUser.password}</code></div>
                    <div><strong>Account Status:</strong> <span class="status-pill success"><i class="fas fa-check"></i> Active</span></div>
                </div>
            </div>
        `;

        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
            <button class="btn btn-gold" onclick="App.closeModal(); AdmissionsModule.printStudentCard('${appItem.id}');">
                <i class="fas fa-id-card"></i> Print Student ID Card
            </button>
            <button class="btn btn-primary" onclick="App.closeModal(); AdmissionsModule.viewEnrolledStudent('${appItem.id}');">
                <i class="fas fa-user-graduate"></i> View Profile in Students
            </button>
        `;

        App.openModal();
    },

    viewEnrolledStudent(appId) {
        const item = (window.LmsData.admissions || []).find(a => a.id === appId);
        if (!item) return;

        const student = (window.LmsData.users || []).find(u => u.rollNo === item.allottedRollNo || u.id === item.enrolledStudentId);
        if (student) {
            App.navigate('students');
            setTimeout(() => {
                if (window.StudentsModule) window.StudentsModule.viewProfile(student.id);
            }, 300);
        } else {
            App.showToast("Student profile not found in active roster.", "warning");
        }
    },

    // =========================================================================
    // REJECTION WORKFLOW
    // =========================================================================
    openRejectModal(appId) {
        const item = (window.LmsData.admissions || []).find(a => a.id === appId);
        if (!item) return;

        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        const modalFooter = document.getElementById('modal-footer-container');

        modalTitle.innerHTML = `<i class="fas fa-ban" style="color: var(--danger);"></i> Reject Admission Application`;

        modalBody.innerHTML = `
            <div style="margin-bottom: 16px;">
                <p style="color: var(--text-primary); font-size: 0.95rem; margin-bottom: 4px;">
                    Are you sure you want to mark application <strong>${item.applicationNo}</strong> (${item.name}) as Rejected?
                </p>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 14px;">
                    This decision will be permanently archived in the admissions registry.
                </div>

                <div class="form-group" style="margin-bottom: 16px;">
                    <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                        Standard Rejection Reason *
                    </label>
                    <select id="reject-reason-select" class="form-control">
                        <option value="Interview evaluation score below admission threshold">Interview evaluation score below admission threshold</option>
                        <option value="Prerequisite Sanad / Certificate not verified by Wifaq-ul-Madaris">Prerequisite Sanad / Certificate not verified by Wifaq-ul-Madaris</option>
                        <option value="Candidate exceeded the maximum age limit for selected program">Candidate exceeded the maximum age limit for selected program</option>
                        <option value="Program admissions quota filled for current academic session">Program admissions quota filled for current academic session</option>
                        <option value="Disciplinary or background verification irregularity">Disciplinary or background verification irregularity</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                        Additional Committee Notes / Remarks
                    </label>
                    <textarea id="reject-notes" class="form-control" rows="3" placeholder="Provide any additional context or rationale..."></textarea>
                </div>
            </div>
        `;

        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn-danger" onclick="AdmissionsModule.confirmReject('${appId}')">
                <i class="fas fa-times-circle"></i> Confirm Rejection
            </button>
        `;

        App.openModal();
    },

    confirmReject(appId) {
        const item = (window.LmsData.admissions || []).find(a => a.id === appId);
        if (!item) return;

        const reason = document.getElementById('reject-reason-select').value;
        const notes = document.getElementById('reject-notes').value.trim();

        item.status = 'REJECTED';
        item.rejectionReason = notes ? `${reason} (${notes})` : reason;
        item.rejectedAt = new Date().toISOString();

        window.DataStore.save(window.LmsData);
        App.closeModal();
        App.showToast(`Application ${item.applicationNo} marked as Rejected.`, "warning");

        const viewport = document.getElementById('main-content-viewport');
        if (viewport && App.currentRoute === 'admissions') {
            viewport.innerHTML = this.render();
        }
    },

    reopenApplication(appId) {
        const item = (window.LmsData.admissions || []).find(a => a.id === appId);
        if (!item) return;

        if (confirm(`Reopen application ${item.applicationNo} (${item.name}) for reconsideration?`)) {
            item.status = 'UNDER_REVIEW';
            delete item.rejectionReason;
            window.DataStore.save(window.LmsData);
            App.showToast(`Application ${item.applicationNo} reopened under review!`, "info");

            const viewport = document.getElementById('main-content-viewport');
            if (viewport && App.currentRoute === 'admissions') {
                viewport.innerHTML = this.render();
            }
        }
    },

    // =========================================================================
    // ONLINE ADMISSION APPLICATION WIZARD
    // =========================================================================
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
                        <!-- STUDENT TYPE SELECTION -->
                        <div class="form-group" style="grid-column: 1 / -1; margin-bottom: 4px;">
                            <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span><i class="fas fa-user-tag" style="color: var(--gold-600); margin-right: 6px;"></i> Student Type / طالب علم کی قسم *</span>
                                <span style="font-size: 0.72rem; color: var(--gold-700);">Select applicant category</span>
                            </label>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <label id="adm-type-local-card" style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--primary-50); border: 2px solid var(--primary-500); border-radius: 8px; cursor: pointer; transition: all 0.2s ease;">
                                    <input type="radio" name="adm_student_type" id="adm-type-local" value="LOCAL" checked onchange="AdmissionsModule.handleStudentTypeChange('LOCAL')" style="width: 17px; height: 17px; accent-color: var(--primary-500);">
                                    <div>
                                        <div style="font-weight: 700; font-size: 0.88rem; color: var(--primary-950); display: flex; align-items: center; gap: 6px;">
                                            <i class="fas fa-flag" style="color: var(--primary-600); font-size: 0.8rem;"></i> Local Student
                                        </div>
                                        <div style="font-size: 0.73rem; color: var(--text-secondary); margin-top: 2px;">Pakistani National (CNIC / B-Form)</div>
                                    </div>
                                </label>
                                <label id="adm-type-intl-card" style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--bg-surface-elevated); border: 1.5px solid var(--border-prominent); border-radius: 8px; cursor: pointer; transition: all 0.2s ease;">
                                    <input type="radio" name="adm_student_type" id="adm-type-intl" value="INTERNATIONAL" onchange="AdmissionsModule.handleStudentTypeChange('INTERNATIONAL')" style="width: 17px; height: 17px; accent-color: var(--gold-500);">
                                    <div>
                                        <div style="font-weight: 700; font-size: 0.88rem; color: var(--primary-950); display: flex; align-items: center; gap: 6px;">
                                            <i class="fas fa-globe-americas" style="color: var(--gold-600); font-size: 0.8rem;"></i> International Student
                                        </div>
                                        <div style="font-size: 0.73rem; color: var(--text-secondary); margin-top: 2px;">Foreign / Overseas (Passport & Country)</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Candidate Full Name (English) *</label>
                            <input type="text" id="adm-name" class="form-control" placeholder="e.g. Muhammad Bilal Usmani" required>
                        </div>
                        <div class="form-group">
                            <label>Father's Name *</label>
                            <input type="text" id="adm-father" class="form-control" placeholder="e.g. Maulana Abdul Rehman" required>
                        </div>

                        <!-- LOCAL: CNIC FIELD -->
                        <div class="form-group" id="adm-cnic-group">
                            <label style="display: flex; justify-content: space-between; align-items: center;">
                                <span>CNIC / B-Form Number *</span>
                                <span style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">XXXXX-XXXXXXX-X</span>
                            </label>
                            <input type="text" id="adm-cnic" class="form-control" placeholder="35201-1234567-1" maxlength="15" required>
                        </div>

                        <!-- INTERNATIONAL: PASSPORT NUMBER FIELD -->
                        <div class="form-group" id="adm-passport-group" style="display: none;">
                            <label style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Passport Number *</span>
                                <span style="font-size: 0.72rem; color: var(--gold-300);">Alphanumeric</span>
                            </label>
                            <input type="text" id="adm-passport" class="form-control" placeholder="e.g. A12345678 or L98765432" maxlength="30">
                        </div>

                        <!-- INTERNATIONAL: CURRENT COUNTRY / RESIDENCE FIELD -->
                        <div class="form-group" id="adm-country-group" style="display: none;">
                            <label style="display: flex; justify-content: space-between; align-items: center;">
                                <span><i class="fas fa-globe" style="color: var(--gold-400); margin-right: 4px;"></i> Current Country / Country of Residence *</span>
                                <span style="font-size: 0.72rem; color: var(--gold-300);">Searchable</span>
                            </label>
                            <input type="text" id="adm-country" list="adm-country-datalist" class="form-control" placeholder="Search or select country..." autocomplete="off">
                            <datalist id="adm-country-datalist">
                                ${(window.WORLD_COUNTRIES || []).map(c => `<option value="${c}">`).join('')}
                            </datalist>
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
                                <input type="checkbox" id="adm-hafiz" style="width: 18px; height: 18px;" checked>
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
                                ${(window.LmsData.programs || []).map(p => `
                                    <option value="${p.id}">${p.name} (${p.urdu})</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Campus / Branch *</label>
                            <select id="adm-branch" class="form-control" required>
                                ${(window.LmsData.institution?.branches || []).map(b => `
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
            <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn-secondary" id="btn-wiz-prev" onclick="AdmissionsModule.prevStep()" style="display: none;">Previous</button>
            <button class="btn btn-gold" id="btn-wiz-next" onclick="AdmissionsModule.nextStep()">Next Step <i class="fas fa-arrow-right"></i></button>
        `;

        // CNIC masking
        const cnicInput = document.getElementById('adm-cnic');
        if (cnicInput) {
            cnicInput.addEventListener('input', function(e) {
                const typeChecked = document.querySelector('input[name="adm_student_type"]:checked')?.value;
                if (typeChecked !== 'LOCAL') return;
                let val = e.target.value.replace(/\D/g, '').slice(0, 13);
                if (val.length > 5 && val.length <= 12) {
                    val = val.slice(0, 5) + '-' + val.slice(5);
                } else if (val.length > 12) {
                    val = val.slice(0, 5) + '-' + val.slice(5, 12) + '-' + val.slice(12);
                }
                e.target.value = val;
            });
        }

        App.openModal();
    },

    handleStudentTypeChange(type) {
        const localCard = document.getElementById('adm-type-local-card');
        const intlCard = document.getElementById('adm-type-intl-card');
        const cnicGroup = document.getElementById('adm-cnic-group');
        const passportGroup = document.getElementById('adm-passport-group');
        const countryGroup = document.getElementById('adm-country-group');
        const cnicInput = document.getElementById('adm-cnic');
        const passportInput = document.getElementById('adm-passport');
        const countryInput = document.getElementById('adm-country');
        const phoneInput = document.getElementById('adm-phone');

        if (type === 'LOCAL') {
            if (localCard) {
                localCard.style.borderColor = 'var(--primary-500)';
                localCard.style.background = 'rgba(6, 78, 59, 0.4)';
                localCard.style.borderWidth = '2px';
            }
            if (intlCard) {
                intlCard.style.borderColor = 'var(--border-prominent)';
                intlCard.style.background = 'var(--bg-surface-elevated)';
                intlCard.style.borderWidth = '1.5px';
            }
            if (cnicGroup) cnicGroup.style.display = 'block';
            if (passportGroup) passportGroup.style.display = 'none';
            if (countryGroup) countryGroup.style.display = 'none';

            if (cnicInput) { cnicInput.required = true; cnicInput.setAttribute('required', 'required'); }
            if (passportInput) { passportInput.required = false; passportInput.removeAttribute('required'); }
            if (countryInput) { countryInput.required = false; countryInput.removeAttribute('required'); }
            if (phoneInput && (phoneInput.placeholder.includes('+44') || phoneInput.placeholder === '')) {
                phoneInput.placeholder = '+92 300 1234567';
            }
        } else {
            if (intlCard) {
                intlCard.style.borderColor = 'var(--gold-400)';
                intlCard.style.background = 'rgba(217, 119, 6, 0.2)';
                intlCard.style.borderWidth = '2px';
            }
            if (localCard) {
                localCard.style.borderColor = 'var(--border-prominent)';
                localCard.style.background = 'var(--bg-surface-elevated)';
                localCard.style.borderWidth = '1.5px';
            }
            if (cnicGroup) cnicGroup.style.display = 'none';
            if (passportGroup) passportGroup.style.display = 'block';
            if (countryGroup) countryGroup.style.display = 'block';

            if (cnicInput) { cnicInput.required = false; cnicInput.removeAttribute('required'); }
            if (passportInput) { passportInput.required = true; passportInput.setAttribute('required', 'required'); }
            if (countryInput) { countryInput.required = true; countryInput.setAttribute('required', 'required'); }
            if (phoneInput && phoneInput.placeholder === '+92 300 1234567') {
                phoneInput.placeholder = 'e.g. +44 7123 456789 or +966 50 123 4567';
            }
        }
    },

    nextStep() {
        if (this.currentStep === 1) {
            const name = document.getElementById('adm-name').value.trim();
            const father = document.getElementById('adm-father').value.trim();
            const phone = document.getElementById('adm-phone').value.trim();
            const studentType = document.querySelector('input[name="adm_student_type"]:checked')?.value || 'LOCAL';

            if (!name || !father || !phone) {
                App.showToast("Please fill in candidate name, father name, and phone number", "warning");
                return;
            }

            if (studentType === 'LOCAL') {
                const cnic = document.getElementById('adm-cnic').value.trim();
                if (!cnic) {
                    App.showToast("Please enter candidate CNIC / B-Form Number", "warning");
                    document.getElementById('adm-cnic').focus();
                    return;
                }
                const cnicClean = cnic.replace(/\D/g, '');
                if (cnicClean.length !== 13) {
                    App.showToast("CNIC / B-Form must contain 13 digits (format: 35201-1234567-1)", "warning");
                    document.getElementById('adm-cnic').focus();
                    return;
                }
            } else {
                const passport = document.getElementById('adm-passport').value.trim();
                const country = document.getElementById('adm-country').value.trim();
                if (!passport) {
                    App.showToast("Please enter candidate Passport Number", "warning");
                    document.getElementById('adm-passport').focus();
                    return;
                }
                if (passport.length < 3) {
                    App.showToast("Passport Number must be at least 3 characters", "warning");
                    document.getElementById('adm-passport').focus();
                    return;
                }
                if (!country) {
                    App.showToast("Please select candidate's current country / country of residence", "warning");
                    document.getElementById('adm-country').focus();
                    return;
                }
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
        const studentType = document.querySelector('input[name="adm_student_type"]:checked')?.value || 'LOCAL';
        const name = document.getElementById('adm-name').value.trim();
        const father = document.getElementById('adm-father').value.trim();
        const cnic = studentType === 'LOCAL' ? document.getElementById('adm-cnic').value.trim() : '';
        const passport = studentType === 'INTERNATIONAL' ? document.getElementById('adm-passport').value.trim() : '';
        const country = studentType === 'INTERNATIONAL' ? document.getElementById('adm-country').value.trim() : 'Pakistan';
        const phone = document.getElementById('adm-phone').value.trim();
        const email = document.getElementById('adm-email').value.trim();
        const prev = document.getElementById('adm-prev-madrasa').value.trim();
        const hafiz = document.getElementById('adm-hafiz').checked;
        const programId = document.getElementById('adm-program').value;
        const branchId = document.getElementById('adm-branch').value;
        const hostel = document.getElementById('adm-hostel').checked;

        const newAppNo = `ASH-ADM-2024-${String(window.LmsData.admissions.length + 95).padStart(3, '0')}`;
        
        const newRecord = {
            id: `adm_${Date.now()}`,
            applicationNo: newAppNo,
            studentType: studentType,
            name: name,
            fatherName: father,
            cnic: cnic,
            passport: passport,
            country: country,
            phone: phone || (studentType === 'LOCAL' ? "+92 300 0000000" : "+1 555 0000"),
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

        if (!window.LmsData.admissions) window.LmsData.admissions = [];
        window.LmsData.admissions.unshift(newRecord);
        window.DataStore.save(window.LmsData);

        // Sync to backend API
        fetch('/api/admissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newRecord)
        }).catch(() => {/* Offline fallback */});

        App.closeModal();
        App.showToast(`Application ${newAppNo} successfully registered!`, "success");

        const viewport = document.getElementById('main-content-viewport');
        if (viewport && App.currentRoute === 'admissions') {
            viewport.innerHTML = this.render();
        }
    },

    // =========================================================================
    // EDIT APPLICATION WORKFLOW
    // =========================================================================
    openEditApplicationModal(appId) {
        const item = (window.LmsData.admissions || []).find(a => a.id === appId);
        if (!item) return;

        const isIntl = (item.studentType === 'INTERNATIONAL' || (!item.cnic && item.passport));
        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        const modalFooter = document.getElementById('modal-footer-container');

        modalTitle.innerHTML = `<i class="fas fa-edit" style="color: var(--gold-400);"></i> Edit Application: ${item.name} (${item.applicationNo})`;
        modalBody.innerHTML = `
            <form id="edit-admission-form" onsubmit="event.preventDefault(); AdmissionsModule.saveEditedApplication('${item.id}')">
                <div class="form-grid">
                    <!-- STUDENT TYPE SELECTION -->
                    <div class="form-group" style="grid-column: 1 / -1; margin-bottom: 6px;">
                        <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span><i class="fas fa-user-tag" style="color: var(--gold-600); margin-right: 6px;"></i> Student Type / طالب علم کی قسم *</span>
                            <span style="font-size: 0.72rem; color: var(--gold-700);">Select applicant category</span>
                        </label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <label id="edit-adm-type-local-card" style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: ${!isIntl ? 'var(--primary-50)' : 'var(--bg-surface-elevated)'}; border: ${!isIntl ? '2px solid var(--primary-500)' : '1.5px solid var(--border-prominent)'}; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;">
                                <input type="radio" name="edit_adm_student_type" id="edit-adm-type-local" value="LOCAL" ${!isIntl ? 'checked' : ''} onchange="AdmissionsModule.handleEditStudentTypeChange('LOCAL')" style="width: 17px; height: 17px; accent-color: var(--primary-500);">
                                <div>
                                    <div style="font-weight: 700; font-size: 0.88rem; color: var(--primary-950); display: flex; align-items: center; gap: 6px;">
                                        <i class="fas fa-flag" style="color: var(--primary-600); font-size: 0.8rem;"></i> Local Student
                                    </div>
                                    <div style="font-size: 0.73rem; color: var(--text-secondary); margin-top: 2px;">Pakistani National (CNIC / B-Form)</div>
                                </div>
                            </label>
                            <label id="edit-adm-type-intl-card" style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: ${isIntl ? 'var(--gold-50)' : 'var(--bg-surface-elevated)'}; border: ${isIntl ? '2px solid var(--gold-500)' : '1.5px solid var(--border-prominent)'}; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;">
                                <input type="radio" name="edit_adm_student_type" id="edit-adm-type-intl" value="INTERNATIONAL" ${isIntl ? 'checked' : ''} onchange="AdmissionsModule.handleEditStudentTypeChange('INTERNATIONAL')" style="width: 17px; height: 17px; accent-color: var(--gold-500);">
                                <div>
                                    <div style="font-weight: 700; font-size: 0.88rem; color: var(--primary-950); display: flex; align-items: center; gap: 6px;">
                                        <i class="fas fa-globe-americas" style="color: var(--gold-600); font-size: 0.8rem;"></i> International Student
                                    </div>
                                    <div style="font-size: 0.73rem; color: var(--text-secondary); margin-top: 2px;">Foreign / Overseas (Passport & Country)</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Candidate Full Name (English) *</label>
                        <input type="text" id="edit-adm-name" class="form-control" value="${item.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Father's Name *</label>
                        <input type="text" id="edit-adm-father" class="form-control" value="${item.fatherName || ''}" required>
                    </div>

                    <!-- LOCAL: CNIC FIELD -->
                    <div class="form-group" id="edit-adm-cnic-group" style="display: ${!isIntl ? 'block' : 'none'};">
                        <label style="display: flex; justify-content: space-between; align-items: center;">
                            <span>CNIC / B-Form Number *</span>
                            <span style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">XXXXX-XXXXXXX-X</span>
                        </label>
                        <input type="text" id="edit-adm-cnic" class="form-control" value="${item.cnic || ''}" placeholder="35201-1234567-1" maxlength="15" ${!isIntl ? 'required' : ''}>
                    </div>

                    <!-- INTERNATIONAL: PASSPORT NUMBER FIELD -->
                    <div class="form-group" id="edit-adm-passport-group" style="display: ${isIntl ? 'block' : 'none'};">
                        <label style="display: flex; justify-content: space-between; align-items: center;">
                            <span>Passport Number *</span>
                            <span style="font-size: 0.72rem; color: var(--gold-300);">Alphanumeric</span>
                        </label>
                        <input type="text" id="edit-adm-passport" class="form-control" value="${item.passport || ''}" placeholder="e.g. A12345678 or L98765432" maxlength="30" ${isIntl ? 'required' : ''}>
                    </div>

                    <!-- INTERNATIONAL: CURRENT COUNTRY / RESIDENCE FIELD -->
                    <div class="form-group" id="edit-adm-country-group" style="display: ${isIntl ? 'block' : 'none'};">
                        <label style="display: flex; justify-content: space-between; align-items: center;">
                            <span><i class="fas fa-globe" style="color: var(--gold-400); margin-right: 4px;"></i> Current Country / Country of Residence *</span>
                            <span style="font-size: 0.72rem; color: var(--gold-300);">Searchable</span>
                        </label>
                        <input type="text" id="edit-adm-country" list="edit-adm-country-datalist" class="form-control" value="${item.country || (isIntl ? 'United Kingdom' : 'Pakistan')}" placeholder="Search or select country..." autocomplete="off" ${isIntl ? 'required' : ''}>
                        <datalist id="edit-adm-country-datalist">
                            ${(window.WORLD_COUNTRIES || []).map(c => `<option value="${c}">`).join('')}
                        </datalist>
                    </div>

                    <div class="form-group">
                        <label>WhatsApp / Mobile Phone *</label>
                        <input type="tel" id="edit-adm-phone" class="form-control" value="${item.phone || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" id="edit-adm-email" class="form-control" value="${item.email || ''}">
                    </div>

                    <div class="form-group">
                        <label>Academic Program Sought *</label>
                        <select id="edit-adm-program" class="form-control" required>
                            ${(window.LmsData.programs || []).map(p => `
                                <option value="${p.id}" ${p.id === item.programId ? 'selected' : ''}>${p.name} (${p.urdu})</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Campus / Branch *</label>
                        <select id="edit-adm-branch" class="form-control" required>
                            ${(window.LmsData.institution?.branches || []).map(b => `
                                <option value="${b.id}" ${b.id === item.branchId ? 'selected' : ''}>${b.name} - ${b.location}</option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Previous Madrasa / School Attended</label>
                        <input type="text" id="edit-adm-prev-madrasa" class="form-control" value="${item.previousMadrasa || ''}">
                    </div>

                    <div class="form-group" style="display: flex; align-items: center; gap: 20px; padding-top: 15px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="edit-adm-hafiz" style="width: 18px; height: 18px;" ${item.hafizStatus ? 'checked' : ''}>
                            <strong>Hafiz-ul-Quran (حافظ قرآن)</strong>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="edit-adm-hostel" style="width: 18px; height: 18px;" ${item.hostelRequired ? 'checked' : ''}>
                            <strong>Boarding / Hostel Required</strong>
                        </label>
                    </div>
                </div>
            </form>
        `;

        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button type="button" class="btn btn-gold" onclick="AdmissionsModule.saveEditedApplication('${item.id}')">
                <i class="fas fa-save"></i> Save Changes
            </button>
        `;

        // CNIC masking on edit input
        const cnicInput = document.getElementById('edit-adm-cnic');
        if (cnicInput) {
            cnicInput.addEventListener('input', function(e) {
                const typeChecked = document.querySelector('input[name="edit_adm_student_type"]:checked')?.value;
                if (typeChecked !== 'LOCAL') return;
                let val = e.target.value.replace(/\D/g, '').slice(0, 13);
                if (val.length > 5 && val.length <= 12) {
                    val = val.slice(0, 5) + '-' + val.slice(5);
                } else if (val.length > 12) {
                    val = val.slice(0, 5) + '-' + val.slice(5, 12) + '-' + val.slice(12);
                }
                e.target.value = val;
            });
        }

        App.openModal();
    },

    handleEditStudentTypeChange(type) {
        const localCard = document.getElementById('edit-adm-type-local-card');
        const intlCard = document.getElementById('edit-adm-type-intl-card');
        const cnicGroup = document.getElementById('edit-adm-cnic-group');
        const passportGroup = document.getElementById('edit-adm-passport-group');
        const countryGroup = document.getElementById('edit-adm-country-group');
        const cnicInput = document.getElementById('edit-adm-cnic');
        const passportInput = document.getElementById('edit-adm-passport');
        const countryInput = document.getElementById('edit-adm-country');

        if (type === 'LOCAL') {
            if (localCard) {
                localCard.style.borderColor = 'var(--primary-500)';
                localCard.style.background = 'rgba(6, 78, 59, 0.4)';
                localCard.style.borderWidth = '2px';
            }
            if (intlCard) {
                intlCard.style.borderColor = 'var(--border-prominent)';
                intlCard.style.background = 'var(--bg-surface-elevated)';
                intlCard.style.borderWidth = '1.5px';
            }
            if (cnicGroup) cnicGroup.style.display = 'block';
            if (passportGroup) passportGroup.style.display = 'none';
            if (countryGroup) countryGroup.style.display = 'none';

            if (cnicInput) { cnicInput.required = true; cnicInput.setAttribute('required', 'required'); }
            if (passportInput) { passportInput.required = false; passportInput.removeAttribute('required'); }
            if (countryInput) { countryInput.required = false; countryInput.removeAttribute('required'); }
        } else {
            if (intlCard) {
                intlCard.style.borderColor = 'var(--gold-400)';
                intlCard.style.background = 'rgba(217, 119, 6, 0.2)';
                intlCard.style.borderWidth = '2px';
            }
            if (localCard) {
                localCard.style.borderColor = 'var(--border-prominent)';
                localCard.style.background = 'var(--bg-surface-elevated)';
                localCard.style.borderWidth = '1.5px';
            }
            if (cnicGroup) cnicGroup.style.display = 'none';
            if (passportGroup) passportGroup.style.display = 'block';
            if (countryGroup) countryGroup.style.display = 'block';

            if (cnicInput) { cnicInput.required = false; cnicInput.removeAttribute('required'); }
            if (passportInput) { passportInput.required = true; passportInput.setAttribute('required', 'required'); }
            if (countryInput) { countryInput.required = true; countryInput.setAttribute('required', 'required'); }
        }
    },

    saveEditedApplication(appId) {
        const item = (window.LmsData.admissions || []).find(a => a.id === appId);
        if (!item) return;

        const studentType = document.querySelector('input[name="edit_adm_student_type"]:checked')?.value || 'LOCAL';
        const name = document.getElementById('edit-adm-name').value.trim();
        const father = document.getElementById('edit-adm-father').value.trim();
        const phone = document.getElementById('edit-adm-phone').value.trim();
        const email = document.getElementById('edit-adm-email').value.trim();
        const programId = document.getElementById('edit-adm-program').value;
        const branchId = document.getElementById('edit-adm-branch').value;
        const prev = document.getElementById('edit-adm-prev-madrasa').value.trim();
        const hafiz = document.getElementById('edit-adm-hafiz').checked;
        const hostel = document.getElementById('edit-adm-hostel').checked;

        if (!name || !father || !phone) {
            App.showToast("Please fill in candidate name, father name, and phone number", "warning");
            return;
        }

        let cnic = '';
        let passport = '';
        let country = 'Pakistan';

        if (studentType === 'LOCAL') {
            cnic = document.getElementById('edit-adm-cnic').value.trim();
            if (!cnic) {
                App.showToast("Please enter candidate CNIC / B-Form Number", "warning");
                document.getElementById('edit-adm-cnic').focus();
                return;
            }
            const cnicClean = cnic.replace(/\D/g, '');
            if (cnicClean.length !== 13) {
                App.showToast("CNIC / B-Form must contain 13 digits (format: 35201-1234567-1)", "warning");
                document.getElementById('edit-adm-cnic').focus();
                return;
            }
        } else {
            passport = document.getElementById('edit-adm-passport').value.trim();
            country = document.getElementById('edit-adm-country').value.trim();
            if (!passport) {
                App.showToast("Please enter candidate Passport Number", "warning");
                document.getElementById('edit-adm-passport').focus();
                return;
            }
            if (passport.length < 3) {
                App.showToast("Passport Number must be at least 3 characters", "warning");
                document.getElementById('edit-adm-passport').focus();
                return;
            }
            if (!country) {
                App.showToast("Please select candidate's current country of residence", "warning");
                document.getElementById('edit-adm-country').focus();
                return;
            }
        }

        // Apply edits to item
        item.studentType = studentType;
        item.name = name;
        item.fatherName = father;
        item.cnic = cnic;
        item.passport = passport;
        item.country = country;
        item.phone = phone;
        item.email = email;
        item.programId = programId;
        item.branchId = branchId;
        item.previousMadrasa = prev || "None";
        item.hafizStatus = hafiz;
        item.hostelRequired = hostel;

        // Persist
        window.DataStore.save(window.LmsData);

        // Synchronize with backend API
        fetch(`/api/admissions/${encodeURIComponent(appId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        }).catch(() => {/* Offline fallback */});

        App.closeModal();
        App.showToast(`Application ${item.applicationNo} updated successfully!`, "success");

        const viewport = document.getElementById('main-content-viewport');
        if (viewport && App.currentRoute === 'admissions') {
            viewport.innerHTML = this.render();
        }
    },

    // Print Student Card for an enrolled candidate
    printStudentCard(id) {
        const item = (window.LmsData.admissions || []).find(a => a.id === id);
        if (!item) return;

        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        const modalFooter = document.getElementById('modal-footer-container');

        modalTitle.innerHTML = `<i class="fas fa-id-card" style="color: var(--primary-600);"></i> Digital Student Identity Card`;
        modalBody.innerHTML = `
            <div style="display: flex; justify-content: center; padding: 10px;">
                <div class="student-id-card-wrap" style="width: 390px; background: #ffffff; border: 2px solid var(--primary-700); border-radius: 14px; padding: 22px; color: var(--text-primary); box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08); position: relative; overflow: hidden;">
                    <!-- Card Header -->
                    <div style="display: flex; align-items: center; gap: 12px; border-bottom: 2px solid var(--primary-100); padding-bottom: 12px; margin-bottom: 14px;">
                        <img src="assets/images/logo.png" style="width: 48px; height: 48px; object-fit: contain;">
                        <div>
                            <div style="font-weight: 800; font-size: 1rem; color: var(--primary-950); letter-spacing: 0.5px;">JAMIA ASHRAFIA LAHORE</div>
                            <div style="font-family: 'Amiri', serif; font-size: 0.95rem; color: var(--gold-700); font-weight: 700;">جامعہ اشرفیہ، لاہور - علم اور تقویٰ</div>
                            <div style="font-size: 0.68rem; color: var(--text-muted); letter-spacing: 0.5px; text-transform: uppercase;">Student Identity Card</div>
                        </div>
                    </div>

                    <!-- Card Body -->
                    <div style="display: flex; gap: 16px; align-items: center;">
                        <div style="width: 88px; height: 105px; background: var(--primary-50); border: 1.5px solid var(--primary-600); border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 2.2rem; color: var(--primary-700); flex-shrink: 0;">
                            <i class="fas fa-user-graduate"></i>
                            <span style="font-size: 0.65rem; color: var(--primary-800); font-weight: 700; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Photo</span>
                        </div>
                        <div style="flex: 1; font-size: 0.84rem; line-height: 1.65; color: var(--text-primary);">
                            <div><span style="color: var(--text-muted); font-size: 0.78rem;">Name:</span> <strong style="color: var(--primary-950); font-size: 0.92rem;">${item.name}</strong></div>
                            <div><span style="color: var(--text-muted); font-size: 0.78rem;">Roll No:</span> <span style="color: var(--gold-700); font-weight: 800; font-family: monospace; font-size: 0.92rem;">${item.allottedRollNo || 'ASH-2026-001'}</span></div>
                            <div><span style="color: var(--text-muted); font-size: 0.78rem;">Department:</span> <span style="font-weight: 600;">Dars-e-Nizami</span></div>
                            ${(item.studentType === 'INTERNATIONAL' || (!item.cnic && item.passport)) ? `
                                <div><span style="color: var(--text-muted); font-size: 0.78rem;">Passport:</span> <span style="font-weight: 600;">${item.passport}</span></div>
                                <div><span style="color: var(--text-muted); font-size: 0.78rem;">Country:</span> <span style="font-weight: 600;">${item.country || 'International'}</span></div>
                            ` : `
                                <div><span style="color: var(--text-muted); font-size: 0.78rem;">CNIC:</span> <span style="font-weight: 600;">${item.cnic}</span></div>
                                <div><span style="color: var(--text-muted); font-size: 0.78rem;">Country:</span> <span style="font-weight: 600;">Pakistan</span></div>
                            `}
                            <div><span style="color: var(--text-muted); font-size: 0.78rem;">Branch:</span> <span style="font-weight: 600;">Main Ferozepur Rd</span></div>
                        </div>
                    </div>

                    <!-- Card Footer & Barcode -->
                    <div style="margin-top: 14px; border-top: 1px dashed var(--border-prominent); padding-top: 10px; display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <div style="font-family: monospace; font-size: 0.8rem; letter-spacing: 2px; color: var(--primary-950); font-weight: 700;">
                                ||| | |||| | |||||| || |
                            </div>
                            <div style="font-size: 0.65rem; color: var(--text-muted); font-family: monospace;">${item.applicationNo || 'JAL-ST-CARD'}</div>
                        </div>
                        <div style="font-size: 0.68rem; color: var(--text-secondary); text-align: right; line-height: 1.35;">
                            <div>Valid Session: <strong>1446-1447 AH</strong></div>
                            <div style="color: var(--gold-700); font-weight: 700; margin-top: 2px;">Authorized Signatory</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
            <button class="btn btn-gold" onclick="window.print()"><i class="fas fa-print"></i> Print ID Card</button>
        `;

        App.openModal();
    },

    exportAdmissionsCSV() {
        const rows = [
            ["Application No", "Category", "Name", "Father Name", "Identification (CNIC/Passport)", "Country", "Phone", "Program", "Status", "Interview Score", "Roll Number"]
        ];
        (window.LmsData.admissions || []).forEach(a => {
            const isIntl = (a.studentType === 'INTERNATIONAL' || (!a.cnic && a.passport));
            const idDoc = isIntl ? (a.passport || 'N/A') : (a.cnic || 'N/A');
            const country = isIntl ? (a.country || 'International') : 'Pakistan';
            const cat = isIntl ? 'INTERNATIONAL' : 'LOCAL';
            rows.push([a.applicationNo, cat, a.name, a.fatherName, idDoc, country, a.phone, a.programId, a.status, a.interviewScore || "N/A", a.allottedRollNo || "N/A"]);
        });
        const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Jamia_Ashrafia_Admissions_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        App.showToast("Wifaq admission list exported to CSV", "success");
    }
};

window.AdmissionsModule = AdmissionsModule;
