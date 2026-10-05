/**
 * JAMIA ASHRAFIA LAHORE - FEES, PAYMENTS & DONATIONS
 * Fee structure per program (registration, admission, monthly, hostel, mess, exam),
 * challan generation for a student / class / program, student payment proof upload,
 * accountant verification, 3-part bank vouchers, and the donations (Zakat / Sadaqah) ledger.
 */

const FeesDonationsModule = {
    tab: 'challans',          // challans | structure | donations
    statusFilter: 'ALL',
    search: '',

    FEE_TYPES: {
        MONTHLY: 'Monthly Fee',
        REGISTRATION: 'Registration Fee',
        ADMISSION: 'Admission Fee',
        EXAM: 'Examination Fee',
        OTHER: 'Other Charges'
    },

    DONATION_TYPES: {
        ZAKAT: 'Zakat (زکوٰۃ)',
        SADAQAH: 'Sadaqah Jariyah (صدقہ جاریہ)',
        KAFALAT_E_TALIB_E_ILM: 'Kafalat-e-Talib-e-Ilm (Student Sponsorship)',
        HOSPITAL_FREE_MEDICINE: 'Ashrafia Free Hospital Medicine Fund',
        GENERAL_FUND: 'General Fund (تعمیرات و کتب خانہ)'
    },

    BANK: { name: 'Meezan Bank / HBL', title: 'Jamia Ashrafia Lahore', account: '0142-7901452203' },

    canManage() {
        return window.AuthRBAC.can('fees:manage') || window.AuthRBAC.isAccountant() || window.AuthRBAC.isSuperAdmin();
    },

    challans() {
        return window.LmsData.feeChallans = window.LmsData.feeChallans || [];
    },

    structures() {
        return window.LmsData.feeStructures = window.LmsData.feeStructures || [];
    },

    structureFor(programId) {
        return this.structures().find(s => s.programId === programId) || null;
    },

    isOverdue(ch) {
        return ch.status !== 'PAID' && ch.dueDate && ch.dueDate < Lms.today();
    },

    total(ch) {
        return ['tuitionFee', 'hostelMessFee', 'examFee', 'registrationFee', 'admissionFee', 'otherFee']
            .reduce((s, k) => s + (Number(ch[k]) || 0), 0);
    },

    render() {
        const isStudent = Lms.role() === 'STUDENT';
        const canManage = this.canManage();
        if (!canManage && !isStudent && this.tab === 'challans') this.tab = 'donations';

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1><i class="fas fa-hand-holding-heart" style="color: var(--gold-400);"></i> ${isStudent ? 'My Fees & Payments' : 'Fees, Payments & Donations'}</h1>
                    <p>${isStudent ? 'View your fee challans, pay at the bank or online and upload the receipt for verification' : 'Fee structures, challan generation, payment verification and Zakat / Sadaqah ledger'}</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-gold btn-sm" onclick="FeesDonationsModule.openDonateModal()"><i class="fas fa-donate"></i> ${canManage ? 'Record Donation' : 'Donate / Zakat'}</button>
                    ${canManage ? `<button class="btn btn-primary btn-sm" onclick="FeesDonationsModule.openGenerateChallanModal()"><i class="fas fa-file-invoice-dollar"></i> Generate Challans</button>` : ''}
                </div>
            </div>

            ${this.renderMetrics()}

            <div class="tabs-nav">
                ${canManage || isStudent ? `<button class="tab-btn ${this.tab === 'challans' ? 'active' : ''}" onclick="FeesDonationsModule.switchSubTab('challans')"><i class="fas fa-receipt"></i> ${isStudent ? 'My Challans' : 'Fee Challans'}</button>` : ''}
                <button class="tab-btn ${this.tab === 'structure' ? 'active' : ''}" onclick="FeesDonationsModule.switchSubTab('structure')"><i class="fas fa-list-alt"></i> Fee Structure</button>
                <button class="tab-btn ${this.tab === 'donations' ? 'active' : ''}" onclick="FeesDonationsModule.switchSubTab('donations')"><i class="fas fa-hand-holding-usd"></i> ${canManage ? 'Donations Ledger' : 'My Donations'}</button>
            </div>

            ${this.tab === 'challans' ? this.renderChallans() : this.tab === 'structure' ? this.renderStructure() : this.renderDonations()}
        `;
    },

    switchSubTab(tab) {
        this.tab = tab;
        window.App.navigate('fees');
    },

    renderMetrics() {
        const me = Lms.me();
        if (Lms.role() === 'STUDENT') {
            const mine = this.challans().filter(c => c.studentId === me.id);
            const due = mine.filter(c => c.status !== 'PAID');
            return `
                <div class="metrics-grid">
                    <div class="metric-card danger"><div class="metric-icon-box"><i class="fas fa-file-invoice"></i></div><div class="metric-content">
                        <span class="metric-label">Amount Due</span><span class="metric-value">${Lms.money(due.filter(c => c.status !== 'VERIFICATION_PENDING').reduce((s, c) => s + (Number(c.netPayable) || 0), 0))}</span>
                        <span class="metric-hint">${due.filter(c => this.isOverdue(c)).length} overdue</span></div></div>
                    <div class="metric-card info"><div class="metric-icon-box"><i class="fas fa-hourglass-half"></i></div><div class="metric-content">
                        <span class="metric-label">Awaiting Verification</span><span class="metric-value">${mine.filter(c => c.status === 'VERIFICATION_PENDING').length}</span>
                        <span class="metric-hint">Receipts you uploaded</span></div></div>
                    <div class="metric-card success"><div class="metric-icon-box"><i class="fas fa-check-circle"></i></div><div class="metric-content">
                        <span class="metric-label">Paid</span><span class="metric-value">${Lms.money(mine.filter(c => c.status === 'PAID').reduce((s, c) => s + (Number(c.netPayable) || 0), 0))}</span>
                        <span class="metric-hint">${mine.filter(c => c.status === 'PAID').length} challan(s)</span></div></div>
                </div>`;
        }
        const ch = this.challans();
        const donations = (window.LmsData.donations || []).filter(d => d.status !== 'PENDING_CONFIRMATION');
        const sum = (list) => list.reduce((s, c) => s + (Number(c.netPayable) || 0), 0);
        return `
            <div class="metrics-grid">
                <div class="metric-card gold"><div class="metric-icon-box"><i class="fas fa-coins"></i></div><div class="metric-content">
                    <span class="metric-label">Donations Received</span><span class="metric-value">${Lms.money(donations.reduce((s, d) => s + (Number(d.amount) || 0), 0))}</span>
                    <span class="metric-hint">Zakat ${Lms.money(donations.filter(d => d.donationType === 'ZAKAT').reduce((s, d) => s + (Number(d.amount) || 0), 0))}</span></div></div>
                <div class="metric-card success"><div class="metric-icon-box"><i class="fas fa-check-circle"></i></div><div class="metric-content">
                    <span class="metric-label">Fees Collected</span><span class="metric-value">${Lms.money(sum(ch.filter(c => c.status === 'PAID')))}</span>
                    <span class="metric-hint">${ch.filter(c => c.status === 'PAID').length} paid challans</span></div></div>
                <div class="metric-card danger"><div class="metric-icon-box"><i class="fas fa-file-invoice"></i></div><div class="metric-content">
                    <span class="metric-label">Outstanding</span><span class="metric-value">${Lms.money(sum(ch.filter(c => c.status !== 'PAID')))}</span>
                    <span class="metric-hint">${ch.filter(c => this.isOverdue(c)).length} overdue</span></div></div>
                <div class="metric-card info" style="cursor: pointer;" onclick="FeesDonationsModule.statusFilter = 'VERIFICATION_PENDING'; FeesDonationsModule.switchSubTab('challans')"><div class="metric-icon-box"><i class="fas fa-user-check"></i></div><div class="metric-content">
                    <span class="metric-label">Payments to Verify</span><span class="metric-value">${ch.filter(c => c.status === 'VERIFICATION_PENDING').length + (window.LmsData.donations || []).filter(d => d.status === 'PENDING_CONFIRMATION').length}</span>
                    <span class="metric-hint">Uploaded receipts</span></div></div>
            </div>`;
    },

    statusPill(ch) {
        if (ch.status === 'PAID') return '<span class="status-pill success"><i class="fas fa-check-circle"></i> Paid</span>';
        if (ch.status === 'VERIFICATION_PENDING') return '<span class="status-pill info"><i class="fas fa-hourglass-half"></i> Verifying</span>';
        if (this.isOverdue(ch)) return '<span class="status-pill danger"><i class="fas fa-exclamation-circle"></i> Overdue</span>';
        return `<span class="status-pill warning"><i class="fas fa-clock"></i> Unpaid</span>${ch.rejectionNote ? `<div style="font-size: 0.68rem; color: var(--danger); margin-top: 3px;">Receipt rejected: ${Lms.esc(ch.rejectionNote)}</div>` : ''}`;
    },

    // ---------------------------------------------------------------------
    // CHALLANS
    // ---------------------------------------------------------------------
    renderChallans() {
        const isStudent = Lms.role() === 'STUDENT';
        const me = Lms.me();
        const q = this.search.toLowerCase();
        let list = this.challans().filter(c => !isStudent || c.studentId === me.id);
        list = list.filter(c => {
            if (this.statusFilter === 'OVERDUE') return this.isOverdue(c);
            if (this.statusFilter === 'UNPAID') return c.status === 'PENDING';
            if (this.statusFilter !== 'ALL' && c.status !== this.statusFilter) return false;
            return true;
        }).filter(c => !q || [c.studentName, c.rollNo, c.challanNumber, c.class].join(' ').toLowerCase().includes(q))
            .sort((a, b) => (a.status === 'VERIFICATION_PENDING' ? -1 : 0) - (b.status === 'VERIFICATION_PENDING' ? -1 : 0) || String(b.dueDate).localeCompare(String(a.dueDate)));

        return `
            <div class="filter-bar" style="flex-wrap: wrap; gap: 10px;">
                ${!isStudent ? `<div class="search-input-wrap"><i class="fas fa-search"></i><input type="text" class="form-control" placeholder="Search student, roll no or challan no..." value="${Lms.esc(this.search)}"
                    oninput="FeesDonationsModule.search = this.value; clearTimeout(this._t); this._t = setTimeout(() => { App.navigate('fees'); const i = document.querySelector('.filter-bar input'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300)"></div>` : ''}
                <select class="form-control" style="width: auto;" onchange="FeesDonationsModule.statusFilter = this.value; App.navigate('fees')">
                    ${[['ALL', 'All challans'], ['UNPAID', 'Unpaid'], ['OVERDUE', 'Overdue'], ['VERIFICATION_PENDING', 'Awaiting verification'], ['PAID', 'Paid']]
                        .map(([v, l]) => `<option value="${v}" ${this.statusFilter === v ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
            </div>

            ${isStudent ? `
                <div class="card" style="background: var(--gold-50); border-left: 4px solid var(--gold-500); font-size: 0.85rem;">
                    <strong><i class="fas fa-university"></i> How to pay:</strong> Print the challan and pay at any ${Lms.esc(this.BANK.name)} branch,
                    or transfer to <strong>${Lms.esc(this.BANK.title)} — A/C ${Lms.esc(this.BANK.account)}</strong> (Raast / JazzCash / EasyPaisa / internet banking),
                    then press <strong>"Upload Payment Proof"</strong> and attach the receipt. The accounts office verifies it and marks the challan paid.
                </div>` : ''}

            <div class="card">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr><th>Challan & Student</th><th>Type & Period</th><th>Amount</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            ${list.length ? list.map(ch => `
                                <tr>
                                    <td>
                                        <div style="font-weight: 700; color: var(--primary-950);">${Lms.esc(ch.studentName)}</div>
                                        <div style="font-family: monospace; font-size: 0.78rem; color: var(--gold-700);">${Lms.esc(ch.challanNumber)}</div>
                                        <div style="font-size: 0.72rem; color: var(--text-muted);">${Lms.esc(ch.rollNo || '')} • ${Lms.esc(ch.class || '')}</div>
                                    </td>
                                    <td style="font-size: 0.82rem;">
                                        <div style="font-weight: 600;">${Lms.esc(this.FEE_TYPES[ch.feeType] || ch.feeType || 'Fee')}</div>
                                        <div style="color: var(--text-muted);">${Lms.esc(ch.billingMonth || '')}</div>
                                    </td>
                                    <td>
                                        <div style="font-size: 1.02rem; font-weight: 800; color: var(--primary-950);">${Lms.money(ch.netPayable)}</div>
                                        ${Number(ch.scholarshipWaiver) > 0 ? `<div style="font-size: 0.7rem; color: var(--success);">Waiver −${Lms.money(ch.scholarshipWaiver)}</div>` : ''}
                                    </td>
                                    <td style="font-size: 0.8rem; ${this.isOverdue(ch) ? 'color: var(--danger); font-weight: 700;' : ''}">${Lms.fmtDate(ch.dueDate)}</td>
                                    <td>${this.statusPill(ch)}${ch.status === 'PAID' ? `<div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 3px;">${Lms.fmtDate(ch.paidAt)} • ${Lms.esc(ch.bankRef || '')}</div>` : ''}</td>
                                    <td>
                                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                            <button class="btn btn-secondary btn-sm" onclick="FeesDonationsModule.printChallan('${ch.id}')"><i class="fas fa-print"></i> Voucher</button>
                                            ${isStudent && (ch.status === 'PENDING' || !ch.status) ? `<button class="btn btn-primary btn-sm" onclick="FeesDonationsModule.payChallanModal('${ch.id}')"><i class="fas fa-upload"></i> Upload Payment Proof</button>` : ''}
                                            ${!isStudent && ch.status === 'VERIFICATION_PENDING' ? `<button class="btn btn-gold btn-sm" onclick="FeesDonationsModule.openVerifyModal('${ch.id}')"><i class="fas fa-user-check"></i> Verify</button>` : ''}
                                            ${!isStudent && ch.status === 'PENDING' ? `<button class="btn btn-primary btn-sm" onclick="FeesDonationsModule.openVerifyModal('${ch.id}')"><i class="fas fa-cash-register"></i> Record Payment</button>` : ''}
                                            ${!isStudent && ch.status !== 'PAID' ? `<button class="btn btn-secondary btn-sm" title="Edit / waiver" onclick="FeesDonationsModule.openEditChallanModal('${ch.id}')"><i class="fas fa-edit"></i></button>
                                                <button class="btn btn-secondary btn-sm" title="Cancel challan" onclick="FeesDonationsModule.deleteChallan('${ch.id}')"><i class="fas fa-trash" style="color: var(--danger);"></i></button>` : ''}
                                            ${ch.status === 'PAID' ? `<button class="btn btn-secondary btn-sm" onclick="FeesDonationsModule.printPaymentReceipt('${ch.id}')"><i class="fas fa-receipt"></i> Receipt</button>` : ''}
                                        </div>
                                    </td>
                                </tr>`).join('') : `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No challans found.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    nextChallanNumber() {
        const year = new Date().getFullYear();
        const used = new Set(this.challans().map(c => c.challanNumber));
        let n;
        do { n = `CH-ASH-${year}-${Math.floor(10000 + Math.random() * 89999)}`; } while (used.has(n));
        return n;
    },

    isBoarder(student) {
        const h = String(student.hostel || '').toLowerCase();
        return h && !h.includes('day scholar');
    },

    // Build a challan for a student from the fee structure (also used by Admissions on enrollment)
    buildChallan(student, feeType, opts = {}) {
        const cls = Lms.getClass(student.classId);
        const programId = opts.programId || (cls ? cls.programId : null)
            || ((window.LmsData.programs || []).find(p => p.name === student.program) || {}).id;
        const fs = this.structureFor(programId) || {};
        const amounts = { tuitionFee: 0, hostelMessFee: 0, examFee: 0, registrationFee: 0, admissionFee: 0, otherFee: 0 };
        if (feeType === 'MONTHLY') {
            amounts.tuitionFee = Number(fs.monthlyTuition) || 0;
            if (this.isBoarder(student)) amounts.hostelMessFee = (Number(fs.hostelFee) || 0) + (Number(fs.messFee) || 0);
        } else if (feeType === 'REGISTRATION') {
            amounts.registrationFee = Number(opts.registrationFee ?? fs.registrationFee) || 0;
        } else if (feeType === 'ADMISSION') {
            amounts.admissionFee = Number(opts.admissionFee ?? fs.admissionFee) || 0;
            amounts.registrationFee = opts.includeRegistration ? (Number(fs.registrationFee) || 0) : 0;
        } else if (feeType === 'EXAM') {
            amounts.examFee = Number(fs.examFee) || 0;
        } else {
            amounts.otherFee = Number(opts.otherAmount) || 0;
        }
        const gross = Object.values(amounts).reduce((s, v) => s + v, 0);
        const waiverPct = Math.min(100, Math.max(0, Number(opts.waiverPercent) || 0));
        const waiver = Math.round(gross * waiverPct / 100);
        return {
            id: Lms.uid('ch'), challanNumber: this.nextChallanNumber(), studentId: student.id, studentName: student.name,
            rollNo: student.rollNo || '', class: cls ? `${cls.name}${cls.section ? ' (' + cls.section + ')' : ''}` : (student.program || ''),
            programId, feeType, billingMonth: opts.billingMonth || '', dueDate: opts.dueDate || Lms.addDays(Lms.today(), 10),
            ...amounts, otherLabel: opts.otherLabel || '', scholarshipWaiver: waiver, netPayable: Math.max(0, gross - waiver),
            status: gross - waiver <= 0 ? 'PAID' : 'PENDING', paidAt: gross - waiver <= 0 ? Lms.today() : null,
            bankRef: gross - waiver <= 0 ? 'FULL-WAIVER' : null, createdAt: new Date().toISOString(), createdBy: Lms.me().id
        };
    },

    openGenerateChallanModal() {
        const programs = window.LmsData.programs || [];
        const now = new Date();
        const monthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        Lms.openModal(
            `<i class="fas fa-file-invoice-dollar" style="color: var(--gold-400);"></i> Generate Fee Challans`,
            `<div class="form-grid">
                <div class="form-group"><label>Fee Type *</label>
                    <select id="gen-type" class="form-control" onchange="document.getElementById('gen-other-wrap').style.display = this.value === 'OTHER' ? '' : 'none'">
                        ${Object.entries(this.FEE_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label>Generate For *</label>
                    <select id="gen-scope" class="form-control" onchange="FeesDonationsModule.refreshGenTargets()">
                        <option value="STUDENT">A single student</option>
                        <option value="CLASS">All students of a class</option>
                        <option value="PROGRAM">All students of a program</option>
                    </select>
                </div>
                <div class="form-group"><label id="gen-target-label">Student *</label><select id="gen-target" class="form-control"></select></div>
                <div class="form-group"><label>Billing Period / Description *</label><input type="text" id="gen-month" class="form-control" value="${Lms.esc(monthLabel)}"></div>
                <div class="form-group"><label>Due Date *</label><input type="date" id="gen-due" class="form-control" value="${Lms.addDays(Lms.today(), 10)}"></div>
                <div class="form-group"><label>Scholarship / Kafalat Waiver (%)</label><input type="number" id="gen-waiver" min="0" max="100" class="form-control" value="0"></div>
                <div class="form-group" id="gen-other-wrap" style="display: none;"><label>Other Charge Label & Amount</label>
                    <div style="display: flex; gap: 6px;"><input type="text" id="gen-other-label" class="form-control" placeholder="e.g. Books & Stationery"><input type="number" id="gen-other-amount" min="0" class="form-control" style="width: 120px;" placeholder="PKR"></div>
                </div>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
                Amounts come from each program's <strong>Fee Structure</strong>. Monthly challans add hostel & mess only for boarding students.
                Students who already have a challan of the same type and period are skipped. Programs: ${programs.map(p => Lms.esc(p.code || p.name)).join(', ')}
            </div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="FeesDonationsModule.generateChallans()"><i class="fas fa-cogs"></i> Generate</button>`
        );
        this.refreshGenTargets();
    },

    refreshGenTargets() {
        const scope = Lms.val('gen-scope');
        const label = document.getElementById('gen-target-label');
        const sel = document.getElementById('gen-target');
        if (scope === 'STUDENT') {
            label.textContent = 'Student *';
            sel.innerHTML = Lms.students().filter(s => s.status !== 'INACTIVE').map(s => `<option value="${Lms.esc(s.id)}">${Lms.esc(s.name)} — ${Lms.esc(s.rollNo || '')}</option>`).join('');
        } else if (scope === 'CLASS') {
            label.textContent = 'Class *';
            sel.innerHTML = Lms.classOptions();
        } else {
            label.textContent = 'Program *';
            sel.innerHTML = (window.LmsData.programs || []).map(p => `<option value="${Lms.esc(p.id)}">${Lms.esc(p.name)}</option>`).join('');
        }
    },

    generateChallans() {
        const type = Lms.val('gen-type');
        const scope = Lms.val('gen-scope');
        const target = Lms.val('gen-target');
        const billingMonth = Lms.val('gen-month');
        const dueDate = Lms.val('gen-due');
        if (!target || !billingMonth || !dueDate) {
            window.App.showToast('Choose who to bill, the period and the due date', 'warning');
            return;
        }
        let students;
        if (scope === 'STUDENT') students = [Lms.user(target)].filter(Boolean);
        else if (scope === 'CLASS') students = Lms.studentsInClass(target);
        else students = Lms.students().filter(s => s.status !== 'INACTIVE' && (Lms.getClass(s.classId) || {}).programId === target);
        if (!students.length) {
            window.App.showToast('No students found for this selection', 'warning');
            return;
        }
        const opts = {
            billingMonth, dueDate, waiverPercent: Lms.val('gen-waiver'),
            otherLabel: Lms.val('gen-other-label'), otherAmount: Lms.val('gen-other-amount'),
            programId: scope === 'PROGRAM' ? target : undefined
        };
        if (type === 'OTHER' && !(Number(opts.otherAmount) > 0)) {
            window.App.showToast('Enter the amount for the other charge', 'warning');
            return;
        }
        const created = [];
        let skipped = 0;
        students.forEach(s => {
            if (this.challans().some(c => c.studentId === s.id && c.feeType === type && c.billingMonth === billingMonth)) {
                skipped++;
                return;
            }
            const ch = this.buildChallan(s, type, opts);
            this.challans().unshift(ch);
            created.push(ch);
        });
        Lms.save();
        Lms.notify(created.filter(c => c.status !== 'PAID').map(c => ({
            targetUserId: c.studentId, category: 'FEE', linkRoute: 'fees',
            title: `Fee Challan Issued: ${this.FEE_TYPES[c.feeType]}`,
            message: `${c.challanNumber} for ${c.billingMonth}: ${Lms.money(c.netPayable)} due by ${Lms.fmtDate(c.dueDate)}.`
        })));
        window.App.closeModal();
        window.App.showToast(`${created.length} challan(s) generated${skipped ? `, ${skipped} skipped (already billed)` : ''}`, created.length ? 'success' : 'warning');
        this.tab = 'challans';
        window.App.navigate('fees');
    },

    openEditChallanModal(challanId) {
        const ch = this.challans().find(c => c.id === challanId);
        if (!ch) return;
        const field = (id, label, val) => `<div class="form-group"><label>${label}</label><input type="number" min="0" id="${id}" class="form-control" value="${Lms.esc(val || 0)}"></div>`;
        Lms.openModal(
            `<i class="fas fa-edit" style="color: var(--gold-400);"></i> Edit Challan ${Lms.esc(ch.challanNumber)}`,
            `<div class="form-grid">
                ${field('ec-tuition', 'Tuition', ch.tuitionFee)}
                ${field('ec-hostel', 'Hostel & Mess', ch.hostelMessFee)}
                ${field('ec-exam', 'Examination', ch.examFee)}
                ${field('ec-reg', 'Registration', ch.registrationFee)}
                ${field('ec-adm', 'Admission', ch.admissionFee)}
                ${field('ec-other', 'Other', ch.otherFee)}
                ${field('ec-waiver', 'Scholarship Waiver (PKR)', ch.scholarshipWaiver)}
                <div class="form-group"><label>Due Date</label><input type="date" id="ec-due" class="form-control" value="${Lms.esc(ch.dueDate)}"></div>
            </div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="FeesDonationsModule.saveEditedChallan('${ch.id}')"><i class="fas fa-save"></i> Save</button>`
        );
    },

    saveEditedChallan(challanId) {
        const ch = this.challans().find(c => c.id === challanId);
        if (!ch) return;
        const n = id => Math.max(0, Number(Lms.val(id)) || 0);
        Object.assign(ch, {
            tuitionFee: n('ec-tuition'), hostelMessFee: n('ec-hostel'), examFee: n('ec-exam'), registrationFee: n('ec-reg'),
            admissionFee: n('ec-adm'), otherFee: n('ec-other'), dueDate: Lms.val('ec-due') || ch.dueDate
        });
        ch.scholarshipWaiver = Math.min(n('ec-waiver'), this.total(ch));
        ch.netPayable = this.total(ch) - ch.scholarshipWaiver;
        if (ch.netPayable === 0) Object.assign(ch, { status: 'PAID', paidAt: Lms.today(), bankRef: 'FULL-WAIVER' });
        Lms.save();
        window.App.closeModal();
        window.App.showToast('Challan updated', 'success');
        window.App.navigate('fees');
    },

    deleteChallan(challanId) {
        const ch = this.challans().find(c => c.id === challanId);
        if (!ch || !confirm(`Cancel challan ${ch.challanNumber} for ${ch.studentName}?`)) return;
        window.LmsData.feeChallans = this.challans().filter(c => c.id !== challanId);
        Lms.save();
        window.App.navigate('fees');
    },

    // Student: upload payment receipt for verification
    payChallanModal(challanId) {
        const ch = this.challans().find(c => c.id === challanId);
        if (!ch) return;
        Lms.openModal(
            `<i class="fas fa-upload" style="color: var(--primary-400);"></i> Payment Proof: ${Lms.esc(ch.challanNumber)}`,
            `<div style="background: var(--bg-surface-elevated); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 14px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                <span>${Lms.esc(this.FEE_TYPES[ch.feeType] || 'Fee')} • ${Lms.esc(ch.billingMonth || '')}</span>
                <strong style="color: var(--primary-800);">${Lms.money(ch.netPayable)}</strong>
            </div>
            <div class="form-grid">
                <div class="form-group"><label>Paid Through *</label>
                    <select id="pay-gateway" class="form-control">
                        <option>Bank deposit (challan)</option><option>Raast / IBFT bank transfer</option><option>JazzCash</option><option>EasyPaisa</option><option>Cash at Jamia accounts office</option>
                    </select>
                </div>
                <div class="form-group"><label>Transaction / Receipt Reference *</label><input type="text" id="pay-ref" class="form-control" placeholder="e.g. TXN-892147981"></div>
                <div class="form-group"><label>Payment Date *</label><input type="date" id="pay-date" class="form-control" max="${Lms.today()}" value="${Lms.today()}"></div>
            </div>
            <div class="form-group"><label>Receipt / Screenshot *</label>${Lms.fileInput('pay-proof', { label: 'Upload stamped challan, bank slip or transfer screenshot', accept: '.pdf,.jpg,.jpeg,.png,.webp' })}</div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-primary" onclick="FeesDonationsModule.confirmPayment(this, '${ch.id}')"><i class="fas fa-paper-plane"></i> Submit for Verification</button>`
        );
    },

    async confirmPayment(btn, challanId) {
        const ch = this.challans().find(c => c.id === challanId);
        const ref = Lms.val('pay-ref');
        const input = document.getElementById('pay-proof');
        if (!ch || !ref || !input.files.length) {
            window.App.showToast('Enter the transaction reference and upload the receipt', 'warning');
            return;
        }
        await Lms.busy(btn, async () => {
            const proof = await Lms.uploadFile(input.files[0]);
            ch.paymentSubmission = { method: Lms.val('pay-gateway'), reference: ref, date: Lms.val('pay-date'), proof, submittedAt: new Date().toISOString() };
            ch.status = 'VERIFICATION_PENDING';
            ch.rejectionNote = null;
            Lms.save();
            Lms.notify({ targetRole: 'ACCOUNTANT', category: 'FEE', linkRoute: 'fees', title: `Payment proof: ${ch.challanNumber}`, message: `${ch.studentName} (${ch.rollNo}) uploaded a receipt for ${Lms.money(ch.netPayable)} — ref ${ref}.` });
            window.App.closeModal();
            window.App.showToast('Receipt submitted. The accounts office will verify it shortly.', 'success');
            window.App.navigate('fees');
        }, 'Uploading...');
    },

    // Accountant: verify an uploaded receipt or record a counter payment
    openVerifyModal(challanId) {
        const ch = this.challans().find(c => c.id === challanId);
        if (!ch) return;
        const p = ch.paymentSubmission;
        Lms.openModal(
            `<i class="fas fa-user-check" style="color: var(--gold-400);"></i> ${p && ch.status === 'VERIFICATION_PENDING' ? 'Verify Payment' : 'Record Payment'}: ${Lms.esc(ch.challanNumber)}`,
            `<div style="background: var(--bg-surface-elevated); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 14px;">
                <div><strong>${Lms.esc(ch.studentName)}</strong> (${Lms.esc(ch.rollNo)}) • ${Lms.esc(this.FEE_TYPES[ch.feeType] || '')} • ${Lms.esc(ch.billingMonth || '')}</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: var(--primary-800); margin-top: 4px;">${Lms.money(ch.netPayable)}</div>
            </div>
            ${p && ch.status === 'VERIFICATION_PENDING' ? `
                <div style="border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 14px; font-size: 0.85rem; line-height: 1.8;">
                    <div><strong>Method:</strong> ${Lms.esc(p.method)}</div>
                    <div><strong>Reference:</strong> ${Lms.esc(p.reference)}</div>
                    <div><strong>Paid on:</strong> ${Lms.fmtDate(p.date)} • uploaded ${Lms.fmtDateTime(p.submittedAt)}</div>
                    <div style="margin-top: 6px;">${Lms.fileLinks([p.proof])}</div>
                </div>` : ''}
            <div class="form-grid">
                <div class="form-group"><label>Bank / Receipt Reference *</label><input type="text" id="ver-ref" class="form-control" value="${Lms.esc(p ? p.reference : '')}" placeholder="Cash receipt no. or bank reference"></div>
                <div class="form-group"><label>Payment Date *</label><input type="date" id="ver-date" class="form-control" value="${Lms.esc(p ? p.date : Lms.today())}"></div>
            </div>
            <div class="form-group"><label>Note to student (required if rejecting)</label><input type="text" id="ver-note" class="form-control" placeholder="e.g. Amount does not match / receipt unreadable"></div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             ${p && ch.status === 'VERIFICATION_PENDING' ? `<button class="btn btn-secondary" style="color: var(--danger);" onclick="FeesDonationsModule.rejectPayment('${ch.id}')"><i class="fas fa-times"></i> Reject Receipt</button>` : ''}
             <button class="btn btn-gold" onclick="FeesDonationsModule.approvePayment('${ch.id}')"><i class="fas fa-check-circle"></i> Mark as Paid</button>`
        );
    },

    approvePayment(challanId) {
        const ch = this.challans().find(c => c.id === challanId);
        const ref = Lms.val('ver-ref');
        if (!ch || !ref) {
            window.App.showToast('Enter the bank or receipt reference', 'warning');
            return;
        }
        Object.assign(ch, { status: 'PAID', paidAt: Lms.val('ver-date') || Lms.today(), bankRef: ref, verifiedBy: Lms.me().id, verifiedAt: new Date().toISOString(), rejectionNote: null });
        Lms.save();
        Lms.notifyUser(ch.studentId, `Payment confirmed: ${ch.challanNumber}`, `${Lms.money(ch.netPayable)} received for ${ch.billingMonth || this.FEE_TYPES[ch.feeType]}. JazakAllah Khair.`, 'FEE', 'fees');
        window.App.closeModal();
        window.App.showToast(`${ch.challanNumber} marked as paid`, 'success');
        window.App.navigate('fees');
    },

    rejectPayment(challanId) {
        const ch = this.challans().find(c => c.id === challanId);
        const note = Lms.val('ver-note');
        if (!ch || !note) {
            window.App.showToast('Write the reason in the note to the student', 'warning');
            return;
        }
        Object.assign(ch, { status: 'PENDING', rejectionNote: note });
        Lms.save();
        Lms.notifyUser(ch.studentId, `Payment proof rejected: ${ch.challanNumber}`, `${note}. Please upload a valid receipt.`, 'FEE', 'fees');
        window.App.closeModal();
        window.App.navigate('fees');
    },

    printChallan(challanId) {
        const ch = this.challans().find(c => c.id === challanId);
        if (!ch) return;
        Lms.openModal(
            `<i class="fas fa-receipt" style="color: var(--gold-400);"></i> Bank Fee Challan: ${Lms.esc(ch.challanNumber)}`,
            `<div class="challan-voucher-container">
                ${this.renderVoucherPart(ch, '1. Bank Copy')}
                ${this.renderVoucherPart(ch, '2. Jamia Office Copy')}
                ${this.renderVoucherPart(ch, '3. Student Copy')}
            </div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
             <button class="btn btn-gold" onclick="window.print()"><i class="fas fa-print"></i> Print 3-Part Voucher</button>`,
            { wide: true }
        );
    },

    renderVoucherPart(ch, partName) {
        const row = (label, v) => Number(v) > 0 ? `<tr><td>${label}</td><td style="text-align: right;">${Lms.money(v)}</td></tr>` : '';
        return `
            <div class="challan-part">
                <div class="challan-part-title">${partName}</div>
                <div class="challan-head">
                    <img src="assets/images/logo.png" style="width: 36px; height: 36px; object-fit: contain; margin: 0 auto 4px;">
                    <h3>JAMIA ASHRAFIA LAHORE</h3>
                    <p>Ferozepur Road Campus • Est. 1947</p>
                    <p style="font-weight: 700; color: var(--primary-800); margin-top: 2px;">${Lms.esc(this.BANK.name)} • A/C ${Lms.esc(this.BANK.account)}</p>
                </div>
                <div class="challan-barcode">*${Lms.esc(ch.challanNumber)}*</div>
                <div style="font-size: 0.72rem; line-height: 1.5; margin-bottom: 6px;">
                    <div><strong>Challan No:</strong> ${Lms.esc(ch.challanNumber)}</div>
                    <div><strong>Student:</strong> ${Lms.esc(ch.studentName)}</div>
                    <div><strong>Roll No:</strong> ${Lms.esc(ch.rollNo)}</div>
                    <div><strong>Class:</strong> ${Lms.esc(ch.class)}</div>
                    <div><strong>For:</strong> ${Lms.esc(this.FEE_TYPES[ch.feeType] || '')} — ${Lms.esc(ch.billingMonth || '')}</div>
                    <div><strong>Due Date:</strong> ${Lms.fmtDate(ch.dueDate)}</div>
                </div>
                <table class="challan-table">
                    ${row('Tuition', ch.tuitionFee)}${row('Hostel & Mess', ch.hostelMessFee)}${row('Examination Fee', ch.examFee)}
                    ${row('Registration Fee', ch.registrationFee)}${row('Admission Fee', ch.admissionFee)}${row(Lms.esc(ch.otherLabel || 'Other Charges'), ch.otherFee)}
                    ${Number(ch.scholarshipWaiver) > 0 ? `<tr><td style="color: var(--primary-700);">Scholarship Waiver</td><td style="text-align: right; color: var(--primary-700);">−${Lms.money(ch.scholarshipWaiver)}</td></tr>` : ''}
                    <tr><td>Net Payable</td><td style="text-align: right;">${Lms.money(ch.netPayable)}</td></tr>
                </table>
                ${ch.status === 'PAID' ? `<div style="text-align: center; font-weight: 800; color: var(--success); border: 2px solid var(--success); border-radius: 4px; margin: 6px 0; font-size: 0.75rem;">PAID ${Lms.fmtDate(ch.paidAt)}</div>` : ''}
                <div class="challan-footer-signatures"><div>Cashier Stamp</div><div>Authorized Signature</div></div>
            </div>`;
    },

    printPaymentReceipt(challanId) {
        const ch = this.challans().find(c => c.id === challanId);
        if (!ch) return;
        Lms.openModal(
            `<i class="fas fa-receipt" style="color: var(--gold-400);"></i> Payment Receipt`,
            `<div style="background: #ffffff; color: var(--text-primary); border: 3px double var(--primary-800); border-radius: 8px; padding: 24px;">
                <div style="text-align: center; border-bottom: 2px solid var(--primary-800); padding-bottom: 12px; margin-bottom: 16px;">
                    <img src="assets/images/logo.png" style="width: 52px; height: 52px; object-fit: contain; margin: 0 auto 6px;">
                    <h2 style="color: var(--primary-900); font-size: 1.2rem; font-weight: 800;">JAMIA ASHRAFIA LAHORE — FEE RECEIPT</h2>
                </div>
                <div style="font-size: 0.9rem; line-height: 2;">
                    <div><strong>Challan No:</strong> ${Lms.esc(ch.challanNumber)}</div>
                    <div><strong>Student:</strong> ${Lms.esc(ch.studentName)} (${Lms.esc(ch.rollNo)}) — ${Lms.esc(ch.class)}</div>
                    <div><strong>For:</strong> ${Lms.esc(this.FEE_TYPES[ch.feeType] || '')} — ${Lms.esc(ch.billingMonth || '')}</div>
                    <div><strong>Paid On:</strong> ${Lms.fmtDate(ch.paidAt)} • <strong>Reference:</strong> ${Lms.esc(ch.bankRef || '')}</div>
                    <div style="margin-top: 10px; font-size: 1.2rem; font-weight: 800; color: var(--primary-800);">Amount Received: ${Lms.money(ch.netPayable)}</div>
                </div>
                <div style="border-top: 1px solid #cbd5e1; margin-top: 16px; padding-top: 12px; display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b;">
                    <div>Computer generated receipt</div><div>Nazim-e-Maliyat</div>
                </div>
            </div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
             <button class="btn btn-gold" onclick="window.print()"><i class="fas fa-print"></i> Print</button>`
        );
    },

    // ---------------------------------------------------------------------
    // FEE STRUCTURE
    // ---------------------------------------------------------------------
    renderStructure() {
        const canManage = this.canManage();
        const me = Lms.me();
        const myProgram = me.role === 'STUDENT' ? (Lms.getClass(me.classId) || {}).programId : null;
        const programs = (window.LmsData.programs || []).filter(p => !myProgram || p.id === myProgram);
        const cell = v => `<td style="text-align: right;">${Lms.money(v)}</td>`;
        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-list-alt"></i> ${myProgram ? 'My Program Fee Structure' : 'Fee Structure by Program'}</h3>
                    <span class="status-pill gold">Dars-e-Nizami tuition is free (Waqf)</span>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr><th>Program</th><th style="text-align: right;">Registration</th><th style="text-align: right;">Admission</th><th style="text-align: right;">Monthly Tuition</th><th style="text-align: right;">Hostel / mo</th><th style="text-align: right;">Mess / mo</th><th style="text-align: right;">Exam</th>${canManage ? '<th></th>' : ''}</tr></thead>
                        <tbody>
                            ${programs.map(p => {
                                const fs = this.structureFor(p.id) || {};
                                return `
                                    <tr>
                                        <td><div style="font-weight: 700;">${Lms.esc(p.name)}</div>${fs.notes ? `<div style="font-size: 0.72rem; color: var(--text-muted);">${Lms.esc(fs.notes)}</div>` : ''}</td>
                                        ${cell(fs.registrationFee)}${cell(fs.admissionFee)}${cell(fs.monthlyTuition)}${cell(fs.hostelFee)}${cell(fs.messFee)}${cell(fs.examFee)}
                                        ${canManage ? `<td><button class="btn btn-secondary btn-sm" onclick="FeesDonationsModule.openStructureModal('${p.id}')"><i class="fas fa-edit"></i> Edit</button></td>` : ''}
                                    </tr>`;
                            }).join('') || `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No programs found.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    openStructureModal(programId) {
        const p = Lms.program(programId) || {};
        const fs = this.structureFor(programId) || {};
        const f = (id, label, v) => `<div class="form-group"><label>${label}</label><input type="number" min="0" id="${id}" class="form-control" value="${Lms.esc(v || 0)}"></div>`;
        Lms.openModal(
            `<i class="fas fa-list-alt" style="color: var(--gold-400);"></i> Fee Structure: ${Lms.esc(p.name || programId)}`,
            `<div class="form-grid">
                ${f('fs-reg', 'Registration Fee (one-time)', fs.registrationFee)}
                ${f('fs-adm', 'Admission Fee (one-time)', fs.admissionFee)}
                ${f('fs-tuition', 'Monthly Tuition', fs.monthlyTuition)}
                ${f('fs-hostel', 'Hostel Fee / month', fs.hostelFee)}
                ${f('fs-mess', 'Mess Fee / month', fs.messFee)}
                ${f('fs-exam', 'Examination Fee', fs.examFee)}
            </div>
            <div class="form-group"><label>Notes</label><input type="text" id="fs-notes" class="form-control" value="${Lms.esc(fs.notes || '')}"></div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="FeesDonationsModule.saveStructure('${programId}')"><i class="fas fa-save"></i> Save Structure</button>`
        );
    },

    saveStructure(programId) {
        const n = id => Math.max(0, Number(Lms.val(id)) || 0);
        let fs = this.structureFor(programId);
        if (!fs) {
            fs = { id: `fs_${programId}`, programId };
            this.structures().push(fs);
        }
        Object.assign(fs, {
            name: `${(Lms.program(programId) || {}).name || programId} Fee Structure`,
            registrationFee: n('fs-reg'), admissionFee: n('fs-adm'), monthlyTuition: n('fs-tuition'),
            hostelFee: n('fs-hostel'), messFee: n('fs-mess'), examFee: n('fs-exam'), notes: Lms.val('fs-notes'),
            updatedAt: new Date().toISOString(), updatedBy: Lms.me().id
        });
        Lms.save();
        window.App.closeModal();
        window.App.showToast('Fee structure saved', 'success');
        window.App.navigate('fees');
    },

    // ---------------------------------------------------------------------
    // DONATIONS
    // ---------------------------------------------------------------------
    renderDonations() {
        const canManage = this.canManage();
        const me = Lms.me();
        const list = (window.LmsData.donations || []).filter(d => canManage || d.donorUserId === me.id)
            .sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)));
        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-donate"></i> ${canManage ? 'Donations & Zakat Ledger' : 'My Donations'}</h3>
                    <span class="status-pill success"><i class="fas fa-certificate"></i> Zakat kept separate from general funds</span>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr><th>Receipt & Donor</th><th>Category</th><th>Purpose</th><th>Amount</th><th>Date & Channel</th><th>Status</th><th></th></tr></thead>
                        <tbody>
                            ${list.length ? list.map(d => `
                                <tr>
                                    <td>
                                        <div style="font-weight: 700;">${d.isAnonymous && !canManage ? 'Anonymous' : Lms.esc(d.donorName)}${d.isAnonymous ? ' <i class="fas fa-user-secret" title="Anonymous in public ledger" style="color: var(--text-muted);"></i>' : ''}</div>
                                        <div style="font-family: monospace; font-size: 0.78rem; color: var(--gold-700);">${Lms.esc(d.receiptNo)}</div>
                                    </td>
                                    <td><span class="status-pill ${d.donationType === 'ZAKAT' ? 'gold' : 'info'}">${Lms.esc((this.DONATION_TYPES[d.donationType] || d.donationType).split(' (')[0])}</span></td>
                                    <td style="font-size: 0.82rem; color: var(--text-secondary);">${Lms.esc(d.purpose)}</td>
                                    <td><strong>${Lms.money(d.amount)}</strong></td>
                                    <td style="font-size: 0.78rem;">${Lms.fmtDate(d.receivedAt)}<div style="color: var(--primary-700);">${Lms.esc(d.paymentChannel || '')}${d.reference ? ' • ' + Lms.esc(d.reference) : ''}</div></td>
                                    <td>${d.status === 'PENDING_CONFIRMATION' ? '<span class="status-pill warning">Awaiting confirmation</span>' : '<span class="status-pill success">Received</span>'}</td>
                                    <td>
                                        <div style="display: flex; gap: 6px;">
                                            ${d.status === 'PENDING_CONFIRMATION' && canManage ? `<button class="btn btn-gold btn-sm" onclick="FeesDonationsModule.confirmDonation('${d.id}')"><i class="fas fa-check"></i> Confirm</button>` : ''}
                                            ${d.proof ? Lms.fileLinks([d.proof]) : ''}
                                            ${d.status !== 'PENDING_CONFIRMATION' ? `<button class="btn btn-secondary btn-sm" onclick="FeesDonationsModule.printDonationReceipt('${d.id}')"><i class="fas fa-receipt"></i> Receipt</button>` : ''}
                                        </div>
                                    </td>
                                </tr>`).join('') : `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">${canManage ? 'No donations recorded.' : 'You have not made a donation through the portal yet.'}</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    openDonateModal() {
        const canManage = this.canManage();
        const me = Lms.me();
        Lms.openModal(
            `<i class="fas fa-hand-holding-heart" style="color: var(--gold-400);"></i> ${canManage ? 'Record Donation Received' : 'Donate Zakat, Sadaqah or Waqf'}`,
            `${!canManage ? `
                <div style="background: var(--primary-50); border: 1px solid var(--primary-200); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 14px; font-size: 0.84rem; line-height: 1.6;">
                    Transfer your donation to <strong>${Lms.esc(this.BANK.title)} — A/C ${Lms.esc(this.BANK.account)}</strong> (${Lms.esc(this.BANK.name)}, Raast, JazzCash or EasyPaisa),
                    then fill this form with the transaction reference. The accounts office confirms it and your official receipt becomes available here.
                    Zakat is used only for eligible (Mustahiq) students and free medicine.
                </div>` : ''}
            <div class="form-grid">
                <div class="form-group"><label>Category *</label>
                    <select id="don-type" class="form-control">${Object.entries(this.DONATION_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>Amount (PKR) *</label><input type="number" id="don-amount" min="1" class="form-control" placeholder="e.g. 50000"></div>
                <div class="form-group"><label>Donor Name *</label><input type="text" id="don-name" class="form-control" value="${canManage ? '' : Lms.esc(me.name || '')}"></div>
                <div class="form-group"><label>Mobile / WhatsApp</label><input type="tel" id="don-phone" class="form-control" value="${canManage ? '' : Lms.esc(me.phone || '')}" placeholder="+92 300 1234567"></div>
                <div class="form-group"><label>Paid Through *</label>
                    <select id="don-channel" class="form-control"><option>Bank transfer / Raast</option><option>JazzCash</option><option>EasyPaisa</option><option>Cash at Jamia office</option><option>Cheque</option><option>International wire (SWIFT)</option></select>
                </div>
                <div class="form-group"><label>Transaction Reference ${canManage ? '' : '*'}</label><input type="text" id="don-ref" class="form-control" placeholder="Bank / wallet reference"></div>
            </div>
            <div class="form-group"><label>Purpose / Note</label><input type="text" id="don-purpose" class="form-control" placeholder="e.g. Kafalat of one student for a year"></div>
            ${!canManage ? `<div class="form-group" style="margin-top: 10px;"><label>Transfer screenshot (optional)</label>${Lms.fileInput('don-proof', { accept: '.pdf,.jpg,.jpeg,.png,.webp' })}</div>` : ''}
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-top: 10px;">
                <input type="checkbox" id="don-anon" style="width: 18px; height: 18px;"> Keep my name anonymous in the ledger (اخفاء صدقہ)
            </label>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="FeesDonationsModule.saveDonation(this)"><i class="fas fa-heart"></i> ${canManage ? 'Record & Issue Receipt' : 'Submit Donation'}</button>`
        );
    },

    async saveDonation(btn) {
        const canManage = this.canManage();
        const amount = Number(Lms.val('don-amount'));
        const name = Lms.val('don-name');
        const ref = Lms.val('don-ref');
        if (!(amount > 0) || !name || (!canManage && !ref)) {
            window.App.showToast(canManage ? 'Enter the donor name and a valid amount' : 'Enter your name, the amount and the transaction reference', 'warning');
            return;
        }
        await Lms.busy(btn, async () => {
            const [proof] = canManage ? [] : await Lms.uploadFromInput('don-proof');
            const type = Lms.val('don-type');
            const prefix = { ZAKAT: 'ZKT', SADAQAH: 'SDQ', KAFALAT_E_TALIB_E_ILM: 'KFL', HOSPITAL_FREE_MEDICINE: 'HSP' }[type] || 'GEN';
            const don = {
                id: Lms.uid('don'), receiptNo: `REC-${prefix}-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
                donorName: name, donorUserId: canManage ? null : Lms.me().id, phone: Lms.val('don-phone'), amount, currency: 'PKR',
                donationType: type, purpose: Lms.val('don-purpose') || `Contribution towards ${(this.DONATION_TYPES[type] || type).split(' (')[0]}`,
                branchId: 'b1', paymentChannel: Lms.val('don-channel'), reference: ref, proof: proof || null,
                receivedAt: Lms.today(), isAnonymous: document.getElementById('don-anon').checked,
                status: canManage ? 'RECEIVED' : 'PENDING_CONFIRMATION', recordedBy: Lms.me().id
            };
            window.LmsData.donations = window.LmsData.donations || [];
            window.LmsData.donations.unshift(don);
            Lms.save();
            if (!canManage) {
                Lms.notify({ targetRole: 'ACCOUNTANT', category: 'FEE', linkRoute: 'fees', title: `Donation to confirm: ${Lms.money(amount)}`, message: `${name} reported a ${type.replace(/_/g, ' ')} donation (ref ${ref}).` });
            }
            window.App.closeModal();
            this.tab = 'donations';
            window.App.navigate('fees');
            if (canManage) {
                window.App.showToast(`Recorded. Receipt ${don.receiptNo}`, 'gold');
                this.printDonationReceipt(don.id);
            } else {
                window.App.showToast('JazakAllah Khair! Your donation will be confirmed by the accounts office.', 'gold');
            }
        });
    },

    confirmDonation(donId) {
        const d = (window.LmsData.donations || []).find(x => x.id === donId);
        if (!d || !confirm(`Confirm ${Lms.money(d.amount)} from ${d.donorName} was received (ref ${d.reference || '—'})?`)) return;
        Object.assign(d, { status: 'RECEIVED', confirmedBy: Lms.me().id, confirmedAt: new Date().toISOString() });
        Lms.save();
        if (d.donorUserId) Lms.notifyUser(d.donorUserId, 'Donation received — JazakAllah Khair', `Receipt ${d.receiptNo} for ${Lms.money(d.amount)} is available in Fees & Donations.`, 'FEE', 'fees');
        window.App.navigate('fees');
    },

    printDonationReceipt(donId) {
        const don = (window.LmsData.donations || []).find(d => d.id === donId);
        if (!don) return;
        Lms.openModal(
            `<i class="fas fa-receipt" style="color: var(--gold-400);"></i> Official Donation Receipt`,
            `<div style="background: #ffffff; color: var(--text-primary); border: 3px double var(--primary-800); border-radius: 8px; padding: 24px;">
                <div style="text-align: center; border-bottom: 2px solid var(--primary-800); padding-bottom: 12px; margin-bottom: 16px;">
                    <img src="assets/images/logo.png" style="width: 52px; height: 52px; object-fit: contain; margin: 0 auto 6px;">
                    <h2 style="color: var(--primary-900); font-size: 1.25rem; font-weight: 800;">JAMIA ASHRAFIA LAHORE</h2>
                    <div style="font-family: 'Amiri', serif; font-size: 1.1rem; color: var(--gold-600);">جامعہ اشرفیہ، لاہور - مالیاتی شعبہ و بیت المال</div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 16px;">
                    <div><strong>Receipt No:</strong> <span style="color: var(--primary-700); font-weight: 700;">${Lms.esc(don.receiptNo)}</span></div>
                    <div><strong>Date:</strong> ${Lms.fmtDate(don.receivedAt)}</div>
                </div>
                <div style="font-size: 0.88rem; line-height: 1.9; margin-bottom: 20px;">
                    <div>Received with gratitude from: <strong>${don.isAnonymous ? 'Respected Anonymous Donor (فی سبیل اللہ)' : Lms.esc(don.donorName)}</strong></div>
                    <div>Category: <strong>${Lms.esc(this.DONATION_TYPES[don.donationType] || don.donationType)}</strong></div>
                    <div>Purpose: <em>${Lms.esc(don.purpose)}</em></div>
                    <div>Payment Channel: ${Lms.esc(don.paymentChannel || '')}${don.reference ? ' • Ref ' + Lms.esc(don.reference) : ''}</div>
                    <div style="margin-top: 10px; font-size: 1.2rem; font-weight: 800; color: var(--primary-800); background: var(--primary-50); border: 1px solid var(--primary-100); padding: 8px 14px; border-radius: 6px; display: inline-block;">Amount: ${Lms.money(don.amount)}</div>
                </div>
                <div style="border-top: 1px solid #cbd5e1; padding-top: 16px; display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b;">
                    <div>Computer generated receipt</div><div>Nazim-e-Maliyat / Treasurer</div>
                </div>
            </div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
             <button class="btn btn-gold" onclick="window.print()"><i class="fas fa-print"></i> Print Receipt</button>`
        );
    }
};

window.FeesDonationsModule = FeesDonationsModule;
