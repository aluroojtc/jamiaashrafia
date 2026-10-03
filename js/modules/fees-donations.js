/**
 * JAMIA ASHRAFIA LAHORE - FEES & DONATIONS (ZAKAT / SADAQAH) MANAGEMENT
 * Dynamic fee structures, 3-part printable bank challans, student sponsorships, and donation receipts
 */

const FeesDonationsModule = {
    render() {
        const challans = window.LmsData.feeChallans;
        const donations = window.LmsData.donations;
        const isStudent = window.AuthRBAC.isStudent();
        const canManage = window.AuthRBAC.can("fees:manage") || window.AuthRBAC.isAccountant();

        const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-hand-holding-heart" style="color: var(--gold-400);"></i>
                        Fees, Waqf & Donations (Zakat / Sadaqat)
                    </h1>
                    <p>Transparent fee voucher billing, 100% Madrasa welfare scholarships, and donor contributions</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-gold btn-sm" onclick="FeesDonationsModule.openDonateModal()">
                        <i class="fas fa-donate"></i> Make Online Donation / Zakat
                    </button>
                    ${canManage ? `
                        <button class="btn btn-primary btn-sm" onclick="FeesDonationsModule.openGenerateChallanModal()">
                            <i class="fas fa-file-invoice-dollar"></i> Generate Monthly Challan
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- FINANCIAL METRIC CARDS -->
            <div class="metrics-grid">
                <div class="metric-card gold">
                    <div class="metric-icon-box"><i class="fas fa-coins"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Zakat & Sadaqah Fund</span>
                        <span class="metric-value">PKR ${(totalDonations / 1000).toFixed(0)}k</span>
                        <span class="metric-hint" style="color: var(--gold-300);"><i class="fas fa-shield-alt"></i> Shariah Audited</span>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon-box"><i class="fas fa-file-invoice"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Active Fee Challans</span>
                        <span class="metric-value">${challans.length}</span>
                        <span class="metric-hint">Billing Safar 1446</span>
                    </div>
                </div>
                <div class="metric-card info">
                    <div class="metric-icon-box"><i class="fas fa-hands-helping"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">100% Scholarship Scholars</span>
                        <span class="metric-value">1,240</span>
                        <span class="metric-hint">Kafalat-e-Talib-e-Ilm</span>
                    </div>
                </div>
                <div class="metric-card danger">
                    <div class="metric-icon-box"><i class="fas fa-clinic-medical"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Hospital Charity Fund</span>
                        <span class="metric-value">PKR 250k</span>
                        <span class="metric-hint" style="color: var(--text-muted);">Free Patient Care</span>
                    </div>
                </div>
            </div>

            <!-- SECTION TABS: FEE CHALLANS vs DONATIONS LEDGER -->
            <div class="tabs-nav">
                <button class="tab-btn active" id="tab-fee-challans" onclick="FeesDonationsModule.switchSubTab('challans')">
                    <i class="fas fa-receipt"></i> Fee Challans & Vouchers
                </button>
                <button class="tab-btn" id="tab-donations-ledger" onclick="FeesDonationsModule.switchSubTab('donations')">
                    <i class="fas fa-hand-holding-usd"></i> Donations & Zakat Contributions
                </button>
            </div>

            <!-- SUBTAB 1: FEE CHALLANS -->
            <div id="subtab-content-challans">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-file-invoice"></i> Student Fee Vouchers (Safar - Rabi-ul-Awwal 1446)</h3>
                        <span class="status-pill gold"><i class="fas fa-university"></i> Payable at HBL / Meezan Bank</span>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Challan No & Student</th>
                                    <th>Class & Month</th>
                                    <th>Breakdown (Tuition / Mess / Exam)</th>
                                    <th>Waiver / Scholarship</th>
                                    <th>Net Payable</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${challans.map(ch => `
                                    <tr>
                                        <td>
                                            <div style="font-weight: 700; color: var(--primary-950);">${ch.studentName}</div>
                                            <div style="font-family: monospace; font-size: 0.8rem; color: var(--gold-700);">${ch.challanNumber}</div>
                                            <div style="font-size: 0.72rem; color: var(--text-muted);">${ch.rollNo}</div>
                                        </td>
                                        <td>
                                            <div style="font-weight: 600;">${ch.class}</div>
                                            <div style="font-size: 0.75rem; color: var(--text-muted);">${ch.billingMonth}</div>
                                            <div style="font-size: 0.72rem; color: var(--danger); font-weight: 600;">Due: ${ch.dueDate}</div>
                                        </td>
                                        <td style="font-size: 0.8rem;">
                                            <div>Tuition: PKR ${ch.tuitionFee} (Free Waqf)</div>
                                            <div>Mess/Hostel: PKR ${ch.hostelMessFee}</div>
                                            <div>Exam Board: PKR ${ch.examFee}</div>
                                        </td>
                                        <td>
                                            ${ch.scholarshipWaiver > 0 ? `
                                                <span class="status-pill success"><i class="fas fa-check"></i> -PKR ${ch.scholarshipWaiver}</span>
                                                <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">Kafalat Waqf Waiver</div>
                                            ` : '<span style="color: var(--text-muted); font-size: 0.75rem;">None</span>'}
                                        </td>
                                        <td>
                                            <div style="font-size: 1.1rem; font-weight: 800; color: var(--primary-950);">
                                                PKR ${ch.netPayable.toLocaleString()}
                                            </div>
                                        </td>
                                        <td>
                                            ${ch.status === 'PAID' ? 
                                                '<span class="status-pill success"><i class="fas fa-check-circle"></i> Paid</span>' : 
                                                '<span class="status-pill warning"><i class="fas fa-clock"></i> Pending</span>'}
                                        </td>
                                        <td>
                                            <div style="display: flex; gap: 6px;">
                                                <button class="btn btn-secondary btn-sm" onclick="FeesDonationsModule.printChallan('${ch.id}')">
                                                    <i class="fas fa-print"></i> 3-Part Voucher
                                                </button>
                                                ${ch.status === 'PENDING' ? `
                                                    <button class="btn btn-primary btn-sm" onclick="FeesDonationsModule.payChallanModal('${ch.id}')">
                                                        <i class="fas fa-credit-card"></i> Pay Now
                                                    </button>
                                                ` : ''}
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- SUBTAB 2: DONATIONS & ZAKAT LEDGER -->
            <div id="subtab-content-donations" style="display: none;">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-donate"></i> Verified Donations & Contributions Ledger</h3>
                        <span class="status-pill success"><i class="fas fa-certificate"></i> Verified 100% Zakat-Compliant</span>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Receipt No & Donor</th>
                                    <th>Category</th>
                                    <th>Dedicated Purpose</th>
                                    <th>Amount (PKR)</th>
                                    <th>Date & Channel</th>
                                    <th>Receipt</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${donations.map(don => `
                                    <tr>
                                        <td>
                                            <div style="font-weight: 700; color: var(--primary-950);">
                                                ${don.isAnonymous ? '<i class="fas fa-user-secret" style="color: var(--text-muted);"></i> Anonymous Muhsin' : don.donorName}
                                            </div>
                                            <div style="font-family: monospace; font-size: 0.78rem; color: var(--gold-700);">${don.receiptNo}</div>
                                        </td>
                                        <td>
                                            <span class="status-pill ${don.donationType === 'ZAKAT' ? 'gold' : 'info'}">
                                                ${don.donationType}
                                            </span>
                                        </td>
                                        <td style="font-size: 0.85rem; color: var(--text-secondary);">${don.purpose}</td>
                                        <td>
                                            <strong style="font-size: 1.05rem; color: var(--primary-950);">PKR ${don.amount.toLocaleString()}</strong>
                                        </td>
                                        <td style="font-size: 0.78rem;">
                                            <div><i class="fas fa-calendar-day"></i> ${don.receivedAt}</div>
                                            <div style="color: var(--primary-700);">${don.paymentChannel}</div>
                                        </td>
                                        <td>
                                            <button class="btn btn-secondary btn-sm" onclick="FeesDonationsModule.printDonationReceipt('${don.id}')">
                                                <i class="fas fa-receipt"></i> View Receipt
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    switchSubTab(tab) {
        document.getElementById('subtab-content-challans').style.display = tab === 'challans' ? 'block' : 'none';
        document.getElementById('subtab-content-donations').style.display = tab === 'donations' ? 'block' : 'none';
        document.getElementById('tab-fee-challans').classList.toggle('active', tab === 'challans');
        document.getElementById('tab-donations-ledger').classList.toggle('active', tab === 'donations');
    },

    printChallan(challanId) {
        const ch = window.LmsData.feeChallans.find(c => c.id === challanId);
        if (!ch) return;

        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-receipt" style="color: var(--gold-400);"></i> Bank Fee Challan: ${ch.challanNumber}`;
        modalBody.innerHTML = `
            <div class="challan-voucher-container">
                <!-- PART 1: BANK COPY -->
                ${this.renderVoucherPart(ch, "1. Bank Copy (حبیب بینک / میزان بینک)")}
                <!-- PART 2: JAMIA ASHRAFIA COPY -->
                ${this.renderVoucherPart(ch, "2. Jamia Ashrafia Office Copy")}
                <!-- PART 3: STUDENT COPY -->
                ${this.renderVoucherPart(ch, "3. Student Copy (طالب علم)")}
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Close</button>
            <button class="btn btn-gold" onclick="window.print()"><i class="fas fa-print"></i> Print 3-Part Voucher</button>
        `;
        window.App.openModal();
    },

    renderVoucherPart(ch, partName) {
        return `
            <div class="challan-part">
                <div class="challan-part-title">${partName}</div>
                <div class="challan-head">
                    <img src="assets/images/logo.png" style="width: 36px; height: 36px; object-fit: contain; margin: 0 auto 4px;">
                    <h3>JAMIA ASHRAFIA LAHORE</h3>
                    <p>Ferozepur Road Campus • Est. 1947</p>
                    <p style="font-weight: 700; color: var(--primary-800); margin-top: 2px;">Account No: 0142-7901452203</p>
                </div>

                <div class="challan-barcode">
                    *${ch.challanNumber}*
                </div>

                <div style="font-size: 0.72rem; line-height: 1.5; margin-bottom: 6px;">
                    <div><strong>Challan No:</strong> ${ch.challanNumber}</div>
                    <div><strong>Student:</strong> ${ch.studentName}</div>
                    <div><strong>Roll No:</strong> ${ch.rollNo}</div>
                    <div><strong>Class:</strong> ${ch.class}</div>
                    <div><strong>Due Date:</strong> ${ch.dueDate}</div>
                </div>

                <table class="challan-table">
                    <tr><td>Tuition (Dars-e-Nizami)</td><td style="text-align: right;">PKR 0.00</td></tr>
                    <tr><td>Hostel Accommodation</td><td style="text-align: right;">PKR ${ch.hostelMessFee}</td></tr>
                    <tr><td>Wifaq Examination Fee</td><td style="text-align: right;">PKR ${ch.examFee}</td></tr>
                    ${ch.scholarshipWaiver > 0 ? `<tr><td style="color: var(--primary-700);">Waqf Scholarship</td><td style="text-align: right; color: var(--primary-700);">-PKR ${ch.scholarshipWaiver}</td></tr>` : ''}
                    <tr><td>Net Payable</td><td style="text-align: right;">PKR ${ch.netPayable}</td></tr>
                </table>

                <div class="challan-footer-signatures">
                    <div>Cashier Stamp</div>
                    <div>Authorized Signature</div>
                </div>
            </div>
        `;
    },

    payChallanModal(challanId) {
        const ch = window.LmsData.feeChallans.find(c => c.id === challanId);
        if (!ch) return;

        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-credit-card" style="color: var(--primary-400);"></i> Pay Challan: ${ch.challanNumber}`;
        modalBody.innerHTML = `
            <div style="background: var(--bg-surface-elevated); padding: 14px; border-radius: var(--radius-sm); margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                    <span>Payable for: <strong>${ch.studentName}</strong> (${ch.rollNo})</span>
                    <span style="font-weight: 800; color: var(--gold-300);">PKR ${ch.netPayable}</span>
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
                <label>Select Payment Gateway</label>
                <select id="pay-gateway" class="form-control">
                    <option value="Meezan Bank Raast">Meezan Bank Raast / 1Link</option>
                    <option value="JazzCash / EasyPaisa">JazzCash / EasyPaisa Mobile Account</option>
                    <option value="HBL Konnect">HBL Konnect / Direct Debit</option>
                    <option value="Jamia Ashrafia Cash Desk">Cash Desk (Main Ferozepur Road Office)</option>
                </select>
            </div>

            <div class="form-group">
                <label>Transaction Reference / Bank Receipt Number</label>
                <input type="text" id="pay-ref" class="form-control" placeholder="e.g. TXN-892147981">
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="FeesDonationsModule.confirmPayment('${ch.id}')">
                <i class="fas fa-check-circle"></i> Confirm & Mark Paid
            </button>
        `;
        window.App.openModal();
    },

    confirmPayment(challanId) {
        const ch = window.LmsData.feeChallans.find(c => c.id === challanId);
        if (ch) {
            ch.status = 'PAID';
            ch.paidAt = new Date().toISOString().split('T')[0];
            ch.bankRef = document.getElementById('pay-ref').value.trim() || 'ONLINE-CONFIRMED-RAAST';
            window.DataStore.save(window.LmsData);
            window.App.closeModal();
            window.App.showToast(`Challan ${ch.challanNumber} confirmed paid!`, "success");
            window.App.navigate('fees');
        }
    },

    openDonateModal() {
        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-hand-holding-heart" style="color: var(--gold-400);"></i> Contribute Zakat, Sadaqah or Waqf to Jamia Ashrafia`;
        modalBody.innerHTML = `
            <div style="background: rgba(6, 78, 59, 0.2); border: 1px solid var(--primary-600); padding: 14px; border-radius: var(--radius-sm); margin-bottom: 16px;">
                <p style="font-size: 0.82rem; color: var(--gold-200); line-height: 1.6;">
                    Jamia Ashrafia Lahore ensures 100% Shariah compliance in the segregation of Zakat funds from General donations. 
                    Zakat is strictly transferred to eligible (Mustahiq) resident seekers of sacred knowledge (Kafalat-e-Talib-e-Ilm) and free medicines at Ashrafia Hospital.
                </p>
            </div>

            <div class="form-grid">
                <div class="form-group">
                    <label>Donation Category *</label>
                    <select id="don-type" class="form-control">
                        <option value="ZAKAT">Zakat (زکوٰۃ برائے طلبہ و علاج)</option>
                        <option value="SADAQAH">Sadaqah Jariyah (صدقہ جاریہ)</option>
                        <option value="KAFALAT_E_TALIB_E_ILM">Kafalat-e-Talib-e-Ilm (Student Sponsorship)</option>
                        <option value="HOSPITAL_FREE_MEDICINE">Ashrafia Free Hospital Medicine Fund</option>
                        <option value="GENERAL_FUND">General Institutional Endowment (تعمیرات و کتب خانہ)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Amount (PKR) *</label>
                    <input type="number" id="don-amount" class="form-control" placeholder="e.g. 50000" required>
                </div>
                <div class="form-group">
                    <label>Donor Full Name</label>
                    <input type="text" id="don-name" class="form-control" placeholder="Leave blank if anonymous">
                </div>
                <div class="form-group">
                    <label>Mobile Number / WhatsApp</label>
                    <input type="tel" id="don-phone" class="form-control" placeholder="+92 300 1234567">
                </div>
            </div>

            <div class="form-group" style="margin-top: 10px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="don-anon" style="width: 18px; height: 18px;">
                    <strong>Remain completely anonymous in public ledger (اخفاء صدقہ)</strong>
                </label>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Cancel</button>
            <button class="btn btn-gold" onclick="FeesDonationsModule.saveDonation()">
                <i class="fas fa-heart"></i> Process Contribution & Generate Receipt
            </button>
        `;
        window.App.openModal();
    },

    saveDonation() {
        const amount = parseFloat(document.getElementById('don-amount').value);
        if (!amount || amount <= 0) {
            window.App.showToast("Please enter a valid donation amount", "warning");
            return;
        }

        const type = document.getElementById('don-type').value;
        const name = document.getElementById('don-name').value.trim() || "Anonymous Donor";
        const phone = document.getElementById('don-phone').value.trim();
        const anon = document.getElementById('don-anon').checked;

        const newRecNo = `REC-ASH-${Date.now().toString().slice(-6)}`;
        const newDon = {
            id: `don_${Date.now()}`,
            receiptNo: newRecNo,
            donorName: name,
            email: "donor@ashrafia.org",
            phone: phone || "+92 300 0000000",
            amount: amount,
            currency: "PKR",
            donationType: type,
            purpose: `Contribution towards ${type.replace(/_/g, ' ')}`,
            branchId: "b1",
            paymentChannel: "Online Payment Gateway",
            receivedAt: new Date().toISOString().split('T')[0],
            isAnonymous: anon
        };

        window.LmsData.donations.unshift(newDon);
        window.DataStore.save(window.LmsData);
        window.App.closeModal();
        window.App.showToast(`JazakAllah Khair! Official Receipt: ${newRecNo}`, "gold");
        this.printDonationReceipt(newDon.id);
        window.App.navigate('fees');
    },

    printDonationReceipt(donId) {
        const don = window.LmsData.donations.find(d => d.id === donId);
        if (!don) return;

        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-receipt" style="color: var(--gold-400);"></i> Official Donation Receipt`;
        modalBody.innerHTML = `
            <div style="background: #ffffff; color: var(--text-primary); border: 3px double var(--primary-800); border-radius: 8px; padding: 24px; font-family: 'Inter', sans-serif;">
                <div style="text-align: center; border-bottom: 2px solid var(--primary-800); padding-bottom: 12px; margin-bottom: 16px;">
                    <img src="assets/images/logo.png" style="width: 52px; height: 52px; object-fit: contain; margin: 0 auto 6px;">
                    <h2 style="color: var(--primary-900); font-size: 1.25rem; font-weight: 800;">JAMIA ASHRAFIA LAHORE</h2>
                    <div style="font-family: 'Amiri', serif; font-size: 1.1rem; color: var(--gold-600);">جامعہ اشرفیہ، لاہور - مالیاتی شعبہ و بیت المال</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">Main Campus: Ferozepur Road, Lahore • Reg. Society No: 1947/LHR</div>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 16px;">
                    <div><strong>Receipt No:</strong> <span style="color: var(--primary-700); font-weight: 700;">${don.receiptNo}</span></div>
                    <div><strong>Date:</strong> ${don.receivedAt}</div>
                </div>

                <div style="font-size: 0.88rem; line-height: 1.9; margin-bottom: 20px;">
                    <div>Received with profound gratitude from: <strong>${don.isAnonymous ? 'Respected Anonymous Donor (فی سبیل اللہ)' : don.donorName}</strong></div>
                    <div>Category: <strong>${don.donationType}</strong></div>
                    <div>Purpose: <em>${don.purpose}</em></div>
                    <div>Payment Channel: ${don.paymentChannel}</div>
                    <div style="margin-top: 10px; font-size: 1.2rem; font-weight: 800; color: var(--primary-800); background: var(--primary-50); border: 1px solid var(--primary-100); padding: 8px 14px; border-radius: 6px; display: inline-block;">
                        Amount: PKR ${don.amount.toLocaleString()} Only
                    </div>
                </div>

                <div style="border-top: 1px solid #cbd5e1; padding-top: 16px; display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b;">
                    <div>Computer Generated Official Stamp</div>
                    <div>Nazim-e-Maliyat / Treasurer</div>
                </div>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Close</button>
            <button class="btn btn-gold" onclick="window.print()"><i class="fas fa-print"></i> Print Receipt</button>
        `;
        window.App.openModal();
    }
};

window.FeesDonationsModule = FeesDonationsModule;
