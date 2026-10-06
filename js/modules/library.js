/**
 * JAMIA ASHRAFIA LAHORE - LIBRARY MANAGEMENT (MAKTABA ASHRAFIA)
 * Catalog with search & filters, e-book (PDF) upload and online reading,
 * borrow requests, issue / return / renew ledger with due dates and overdue fines.
 */

const LibraryModule = {
    tab: 'catalog',          // catalog | myloans | loans
    search: '',
    category: 'ALL',
    onlyAvailable: false,
    onlyDigital: false,
    LOAN_DAYS: 14,
    MAX_ACTIVE_LOANS: 3,
    FINE_PER_DAY: 10,

    canManage() {
        // Issuing and returning books for everyone (the office view of loans)
        return window.AuthRBAC.wide('library.loans.issue');
    },

    loans() {
        return window.LmsData.libraryLoans = window.LmsData.libraryLoans || [];
    },

    issuedCount(bookId) {
        return this.loans().filter(l => l.bookId === bookId && l.status === 'ISSUED').length;
    },

    available(book) {
        return Math.max(0, (Number(book.totalCopies) || 0) - this.issuedCount(book.id));
    },

    isOverdue(loan) {
        return loan.status === 'ISSUED' && loan.dueDate && loan.dueDate < Lms.today();
    },

    fineFor(loan) {
        const end = loan.returnedAt || Lms.today();
        if (!loan.dueDate || end <= loan.dueDate) return 0;
        const days = Math.round((new Date(`${end}T00:00:00`) - new Date(`${loan.dueDate}T00:00:00`)) / 86400000);
        return days * this.FINE_PER_DAY;
    },

    book(id) {
        return (window.LmsData.libraryBooks || []).find(b => b.id === id) || null;
    },

    render() {
        const books = window.LmsData.libraryBooks || [];
        const me = Lms.me();
        const canManage = this.canManage();
        const loans = this.loans();
        const active = loans.filter(l => l.status === 'ISSUED');
        const requests = loans.filter(l => l.status === 'REQUESTED');
        const myLoans = loans.filter(l => l.userId === me.id && ['REQUESTED', 'ISSUED'].includes(l.status));
        if (this.tab === 'loans' && !canManage) this.tab = 'catalog';

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1><i class="fas fa-book-reader" style="color: var(--primary-400);"></i> Maktaba Ashrafia — Library</h1>
                    <p>Search the catalog, read e-books online, request books and track due dates</p>
                </div>
                <div class="view-actions">
                    ${canManage ? `
                        <button class="btn btn-secondary btn-sm" onclick="LibraryModule.openIssueModal()"><i class="fas fa-stamp"></i> Issue Book</button>` : ''}
                    ${Lms.can('library.catalog.manage') ? `
                        <button class="btn btn-gold btn-sm" onclick="LibraryModule.openAddBookModal()"><i class="fas fa-plus"></i> Catalog New Kitab</button>` : ''}
                </div>
            </div>

            <div class="metrics-grid">
                <div class="metric-card gold"><div class="metric-icon-box"><i class="fas fa-book"></i></div><div class="metric-content">
                    <span class="metric-label">Titles in Catalog</span><span class="metric-value">${books.length}</span>
                    <span class="metric-hint">${books.reduce((s, b) => s + (Number(b.totalCopies) || 0), 0)} physical copies</span></div></div>
                <div class="metric-card info"><div class="metric-icon-box"><i class="fas fa-file-pdf"></i></div><div class="metric-content">
                    <span class="metric-label">e-Books</span><span class="metric-value">${books.filter(b => b.digitalUrl).length}</span>
                    <span class="metric-hint">Read online</span></div></div>
                <div class="metric-card"><div class="metric-icon-box"><i class="fas fa-hand-holding"></i></div><div class="metric-content">
                    <span class="metric-label">${canManage ? 'Books on Loan' : 'My Books'}</span><span class="metric-value">${canManage ? active.length : myLoans.filter(l => l.status === 'ISSUED').length}</span>
                    <span class="metric-hint">${canManage ? requests.length + ' request(s) pending' : myLoans.filter(l => l.status === 'REQUESTED').length + ' request(s) pending'}</span></div></div>
                <div class="metric-card danger"><div class="metric-icon-box"><i class="fas fa-exclamation-circle"></i></div><div class="metric-content">
                    <span class="metric-label">Overdue</span><span class="metric-value">${(canManage ? active : myLoans).filter(l => this.isOverdue(l)).length}</span>
                    <span class="metric-hint">Fine PKR ${this.FINE_PER_DAY}/day</span></div></div>
            </div>

            <div class="tabs-nav">
                <button class="tab-btn ${this.tab === 'catalog' ? 'active' : ''}" onclick="LibraryModule.setTab('catalog')"><i class="fas fa-search"></i> Catalog</button>
                <button class="tab-btn ${this.tab === 'myloans' ? 'active' : ''}" onclick="LibraryModule.setTab('myloans')"><i class="fas fa-bookmark"></i> My Books (${myLoans.length})</button>
                ${canManage ? `<button class="tab-btn ${this.tab === 'loans' ? 'active' : ''}" onclick="LibraryModule.setTab('loans')"><i class="fas fa-clipboard-list"></i> Loans & Requests ${requests.length ? `<span class="badge-pill gold" style="margin-left: 4px;">${requests.length}</span>` : ''}</button>` : ''}
            </div>

            ${this.tab === 'catalog' ? this.renderCatalog() : this.tab === 'myloans' ? this.renderLoansTable(loans.filter(l => l.userId === me.id), false) : this.renderLoansTable(loans, true)}
        `;
    },

    setTab(t) {
        this.tab = t;
        window.App.navigate('library');
    },

    renderCatalog() {
        const books = window.LmsData.libraryBooks || [];
        const categories = Array.from(new Set(books.map(b => b.category).filter(Boolean))).sort();
        return `
            <div class="filter-bar" style="flex-wrap: wrap; gap: 10px;">
                <div class="search-input-wrap">
                    <i class="fas fa-search"></i>
                    <input type="text" id="lib-search" class="form-control" placeholder="Search title (English / Arabic / Urdu), author, ISBN or accession no..." value="${Lms.esc(this.search)}" oninput="LibraryModule.searchBooks(this.value)">
                </div>
                <div class="filter-actions" style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <select class="form-control" style="width: auto;" onchange="LibraryModule.filterCategory(this.value)">
                        <option value="ALL">All categories</option>
                        ${categories.map(c => `<option value="${Lms.esc(c)}" ${this.category === c ? 'selected' : ''}>${Lms.esc(c)}</option>`).join('')}
                    </select>
                    <label style="display: flex; gap: 6px; align-items: center; font-size: 0.85rem; cursor: pointer;"><input type="checkbox" ${this.onlyAvailable ? 'checked' : ''} onchange="LibraryModule.onlyAvailable = this.checked; LibraryModule.refreshGrid()"> Available now</label>
                    <label style="display: flex; gap: 6px; align-items: center; font-size: 0.85rem; cursor: pointer;"><input type="checkbox" ${this.onlyDigital ? 'checked' : ''} onchange="LibraryModule.onlyDigital = this.checked; LibraryModule.refreshGrid()"> e-Books only</label>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-bottom: 28px;" id="books-grid-container">
                ${this.renderBookCards(this.filteredBooks())}
            </div>
        `;
    },

    filteredBooks() {
        const q = this.search.toLowerCase().trim();
        return (window.LmsData.libraryBooks || []).filter(b => {
            if (this.category !== 'ALL' && b.category !== this.category) return false;
            if (this.onlyAvailable && this.available(b) <= 0) return false;
            if (this.onlyDigital && !b.digitalUrl) return false;
            if (!q) return true;
            return [b.title, b.arabicTitle, b.author, b.accessionNo, b.isbn, b.publisher].some(v => String(v || '').toLowerCase().includes(q));
        });
    },

    refreshGrid() {
        const grid = document.getElementById('books-grid-container');
        if (grid) grid.innerHTML = this.renderBookCards(this.filteredBooks());
    },

    searchBooks(query) {
        this.search = query || '';
        if (this.tab !== 'catalog' || !document.getElementById('books-grid-container')) {
            this.tab = 'catalog';
            window.App.navigate('library');
            return;
        }
        this.refreshGrid();
    },

    filterCategory(cat) {
        this.category = cat;
        this.refreshGrid();
    },

    renderBookCards(list) {
        if (!list.length) return `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No books match your search.</div>`;
        const me = Lms.me();
        const canManage = this.canManage();
        return list.map(b => {
            const avail = this.available(b);
            const myLoan = this.loans().find(l => l.bookId === b.id && l.userId === me.id && ['REQUESTED', 'ISSUED'].includes(l.status));
            return `
                <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; margin: 0;">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 8px;">
                            <span class="status-pill gold" style="font-size: 0.68rem;">${Lms.esc(b.category || 'General')}</span>
                            <span style="font-family: monospace; font-size: 0.75rem; color: var(--text-muted);">${Lms.esc(b.accessionNo)}</span>
                        </div>
                        <h3 style="font-size: 1.02rem; color: var(--primary-950); margin-bottom: 4px;">${Lms.esc(b.title)}</h3>
                        <div style="font-family: 'Amiri', serif; font-size: 1.2rem; color: var(--gold-700); margin-bottom: 8px;" dir="rtl">${Lms.esc(b.arabicTitle || '')}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 12px;">
                            <div><i class="fas fa-feather-alt" style="color: var(--primary-700); width: 16px;"></i> ${Lms.esc(b.author)}</div>
                            <div><i class="fas fa-print" style="color: var(--gold-700); width: 16px;"></i> ${Lms.esc(b.publisher || '—')}${b.publicationYear ? ' (' + Lms.esc(b.publicationYear) + ')' : ''}</div>
                            <div><i class="fas fa-map-pin" style="color: var(--danger); width: 16px;"></i> ${Lms.esc(b.rackLocation || '—')}</div>
                        </div>
                    </div>
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid var(--border-subtle); margin-bottom: 10px; font-size: 0.78rem;">
                            <span style="color: ${avail > 0 ? 'var(--success)' : 'var(--danger)'};"><i class="fas fa-layer-group"></i> ${avail} of ${Lms.esc(b.totalCopies)} available</span>
                            ${b.digitalUrl ? '<span class="status-pill success" style="font-size: 0.65rem;"><i class="fas fa-file-pdf"></i> e-Book</span>' : ''}
                        </div>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            ${b.digitalUrl ? `<button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="LibraryModule.openDigitalReaderModal('${b.id}')"><i class="fas fa-eye"></i> Read Online</button>` : ''}
                            ${myLoan ? `<span class="status-pill ${myLoan.status === 'ISSUED' ? 'success' : 'warning'}" style="flex: 1; justify-content: center;">${myLoan.status === 'ISSUED' ? 'Issued to you • due ' + Lms.fmtDate(myLoan.dueDate) : 'Request pending'}</span>`
                                : canManage
                                    ? `<button class="btn btn-gold btn-sm" style="flex: 1;" onclick="LibraryModule.openIssueModal('${b.id}')" ${avail <= 0 ? 'disabled' : ''}><i class="fas fa-stamp"></i> Issue</button>`
                                    : !Lms.can('library.request') ? '' : `<button class="btn btn-gold btn-sm" style="flex: 1;" onclick="LibraryModule.requestBook('${b.id}')" ${avail <= 0 ? 'disabled title="All copies are on loan"' : ''}><i class="fas fa-book"></i> Request to Borrow</button>`}
                            ${Lms.can('library.catalog.manage') ? `
                                <button class="btn btn-secondary btn-sm" title="Edit" onclick="LibraryModule.openAddBookModal('${b.id}')"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-secondary btn-sm" title="Delete" onclick="LibraryModule.deleteBook('${b.id}')"><i class="fas fa-trash" style="color: var(--danger);"></i></button>` : ''}
                        </div>
                    </div>
                </div>`;
        }).join('');
    },

    // ---------------------------------------------------------------------
    // LOANS
    // ---------------------------------------------------------------------
    renderLoansTable(list, manage) {
        const order = { REQUESTED: 0, ISSUED: 1, RETURNED: 2, REJECTED: 3, CANCELLED: 4 };
        const rows = list.slice().sort((a, b) => (order[a.status] - order[b.status]) || String(b.requestedAt || '').localeCompare(String(a.requestedAt || '')));
        const pill = l => this.isOverdue(l) ? '<span class="status-pill danger">Overdue</span>'
            : ({ REQUESTED: '<span class="status-pill warning">Requested</span>', ISSUED: '<span class="status-pill success">Issued</span>',
                RETURNED: '<span class="status-pill info">Returned</span>', REJECTED: '<span class="status-pill danger">Rejected</span>',
                CANCELLED: '<span class="status-pill">Cancelled</span>' })[l.status] || Lms.esc(l.status);
        return `
            <div class="card">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr><th>Book</th>${manage ? '<th>Borrower</th>' : ''}<th>Status</th><th>Requested / Issued</th><th>Due</th><th>Fine</th><th></th></tr></thead>
                        <tbody>
                            ${rows.length ? rows.map(l => {
                                const b = this.book(l.bookId) || { title: '(removed book)', accessionNo: '' };
                                const fine = this.fineFor(l);
                                return `
                                    <tr>
                                        <td><div style="font-weight: 700;">${Lms.esc(b.title)}</div><div style="font-size: 0.72rem; color: var(--text-muted);">${Lms.esc(b.accessionNo)}</div></td>
                                        ${manage ? `<td><div style="font-weight: 600;">${Lms.esc(l.userName || Lms.userName(l.userId))}</div><div style="font-size: 0.72rem; color: var(--gold-700);">${Lms.esc((Lms.user(l.userId) || {}).rollNo || (Lms.user(l.userId) || {}).role || '')}</div></td>` : ''}
                                        <td>${pill(l)}</td>
                                        <td style="font-size: 0.78rem;">${Lms.fmtDate(l.requestedAt)}${l.issuedAt ? '<br>Issued ' + Lms.fmtDate(l.issuedAt) : ''}${l.returnedAt ? '<br>Returned ' + Lms.fmtDate(l.returnedAt) : ''}</td>
                                        <td style="font-size: 0.8rem; ${this.isOverdue(l) ? 'color: var(--danger); font-weight: 700;' : ''}">${l.dueDate ? Lms.fmtDate(l.dueDate) : '—'}</td>
                                        <td style="font-size: 0.8rem;">${fine ? Lms.money(fine) + (l.finePaid ? ' (paid)' : '') : '—'}</td>
                                        <td>
                                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                                ${manage && l.status === 'REQUESTED' ? `
                                                    <button class="btn btn-gold btn-sm" onclick="LibraryModule.approveRequest('${l.id}')"><i class="fas fa-check"></i> Issue</button>
                                                    <button class="btn btn-secondary btn-sm" onclick="LibraryModule.rejectRequest('${l.id}')"><i class="fas fa-times"></i> Reject</button>` : ''}
                                                ${manage && l.status === 'ISSUED' ? `
                                                    <button class="btn btn-primary btn-sm" onclick="LibraryModule.markReturned('${l.id}')"><i class="fas fa-undo"></i> Returned</button>
                                                    <button class="btn btn-secondary btn-sm" onclick="LibraryModule.renewLoan('${l.id}')"><i class="fas fa-redo"></i> Renew</button>
                                                    ${this.isOverdue(l) ? `<button class="btn btn-secondary btn-sm" onclick="LibraryModule.remindOverdue('${l.id}')"><i class="fas fa-bell"></i></button>` : ''}` : ''}
                                                ${!manage && l.status === 'REQUESTED' ? `<button class="btn btn-secondary btn-sm" onclick="LibraryModule.cancelRequest('${l.id}')">Cancel request</button>` : ''}
                                            </div>
                                        </td>
                                    </tr>`;
                            }).join('') : `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">${manage ? 'No loans recorded yet.' : 'You have not borrowed any books yet.'}</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    requestBook(bookId) {
        const b = this.book(bookId);
        const me = Lms.me();
        if (!b) return;
        const mine = this.loans().filter(l => l.userId === me.id && ['REQUESTED', 'ISSUED'].includes(l.status));
        if (mine.some(l => l.bookId === bookId)) {
            window.App.showToast('You already have this book or a pending request for it.', 'info');
            return;
        }
        if (mine.length >= this.MAX_ACTIVE_LOANS) {
            window.App.showToast(`You can hold at most ${this.MAX_ACTIVE_LOANS} books/requests at a time.`, 'warning');
            return;
        }
        this.loans().push({
            id: Lms.uid('loan'), bookId, userId: me.id, userName: me.name, status: 'REQUESTED',
            requestedAt: Lms.today(), issuedAt: null, dueDate: null, returnedAt: null
        });
        Lms.save();
        Lms.notify({ targetRole: 'ACADEMIC_ADMIN', category: 'GENERAL', linkRoute: 'library', title: `Library request: ${b.title}`, message: `${me.name} (${me.rollNo || me.role}) requested to borrow "${b.title}" (${b.accessionNo}).` });
        window.App.showToast('Request sent to the library. You will be notified when it is issued.', 'success');
        window.App.navigate('library');
    },

    cancelRequest(loanId) {
        const l = this.loans().find(x => x.id === loanId);
        if (!l) return;
        l.status = 'CANCELLED';
        Lms.save();
        window.App.navigate('library');
    },

    approveRequest(loanId) {
        const l = this.loans().find(x => x.id === loanId);
        const b = l && this.book(l.bookId);
        if (!l || !b) return;
        if (this.available(b) <= 0) {
            window.App.showToast('No copies available to issue right now.', 'warning');
            return;
        }
        Object.assign(l, { status: 'ISSUED', issuedAt: Lms.today(), dueDate: Lms.addDays(Lms.today(), this.LOAN_DAYS), issuedBy: Lms.me().id });
        this.syncAvailability(b);
        Lms.save();
        Lms.notifyUser(l.userId, `Book issued: ${b.title}`, `Collect "${b.title}" from ${b.rackLocation || 'the library counter'}. Return by ${Lms.fmtDate(l.dueDate)}.`, 'GENERAL', 'library');
        window.App.showToast('Book issued', 'success');
        window.App.navigate('library');
    },

    rejectRequest(loanId) {
        const l = this.loans().find(x => x.id === loanId);
        const b = l && this.book(l.bookId);
        if (!l) return;
        const reason = prompt('Reason for rejecting (shown to the borrower):', 'Not available at the moment');
        if (reason === null) return;
        l.status = 'REJECTED';
        l.note = reason;
        Lms.save();
        Lms.notifyUser(l.userId, `Library request declined: ${b ? b.title : ''}`, reason || 'Your request could not be fulfilled.', 'GENERAL', 'library');
        window.App.navigate('library');
    },

    markReturned(loanId) {
        const l = this.loans().find(x => x.id === loanId);
        const b = l && this.book(l.bookId);
        if (!l) return;
        l.returnedAt = Lms.today();
        const fine = this.fineFor(l);
        if (fine && !confirm(`This book is ${fine / this.FINE_PER_DAY} day(s) late. Fine: ${Lms.money(fine)}.\n\nPress OK once the fine is collected (or waived).`)) {
            l.returnedAt = null;
            return;
        }
        l.status = 'RETURNED';
        l.fine = fine;
        l.finePaid = fine > 0;
        if (b) this.syncAvailability(b);
        Lms.save();
        Lms.notifyUser(l.userId, `Book returned: ${b ? b.title : ''}`, `Thank you. The return has been recorded${fine ? ` with a fine of ${Lms.money(fine)}` : ''}.`, 'GENERAL', 'library');
        window.App.showToast('Return recorded', 'success');
        window.App.navigate('library');
    },

    renewLoan(loanId) {
        const l = this.loans().find(x => x.id === loanId);
        if (!l) return;
        const base = l.dueDate && l.dueDate > Lms.today() ? l.dueDate : Lms.today();
        l.dueDate = Lms.addDays(base, this.LOAN_DAYS);
        l.renewals = (l.renewals || 0) + 1;
        Lms.save();
        Lms.notifyUser(l.userId, 'Library loan renewed', `New due date: ${Lms.fmtDate(l.dueDate)}.`, 'GENERAL', 'library');
        window.App.showToast(`Renewed until ${Lms.fmtDate(l.dueDate)}`, 'success');
        window.App.navigate('library');
    },

    remindOverdue(loanId) {
        const l = this.loans().find(x => x.id === loanId);
        const b = l && this.book(l.bookId);
        if (!l) return;
        Lms.notifyUser(l.userId, `Overdue book: ${b ? b.title : ''}`, `This book was due on ${Lms.fmtDate(l.dueDate)}. Please return it; the fine so far is ${Lms.money(this.fineFor(l))}.`, 'GENERAL', 'library');
        window.App.showToast('Reminder sent', 'success');
    },

    syncAvailability(book) {
        book.availableCopies = this.available(book);
    },

    // Direct issue at the counter (librarian / admin)
    openIssueModal(bookId) {
        const books = (window.LmsData.libraryBooks || []).filter(b => this.available(b) > 0);
        if (!books.length) {
            window.App.showToast('No copies are available to issue.', 'warning');
            return;
        }
        const users = (window.LmsData.users || []).filter(u => ['STUDENT', 'TEACHER'].includes(u.role) && u.status !== 'INACTIVE');
        Lms.openModal(
            `<i class="fas fa-stamp" style="color: var(--gold-400);"></i> Issue Book`,
            `<div class="form-grid">
                <div class="form-group"><label>Book *</label>
                    <select id="issue-book" class="form-control">${books.map(b => `<option value="${Lms.esc(b.id)}" ${b.id === bookId ? 'selected' : ''}>${Lms.esc(b.title)} (${this.available(b)} available)</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>Borrower *</label>
                    <select id="issue-user" class="form-control">${users.map(u => `<option value="${Lms.esc(u.id)}">${Lms.esc(u.name)} — ${Lms.esc(u.rollNo || u.designation || u.role)}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>Return Due Date *</label><input type="date" id="issue-due" class="form-control" min="${Lms.today()}" value="${Lms.addDays(Lms.today(), this.LOAN_DAYS)}"></div>
            </div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="LibraryModule.confirmBorrow()"><i class="fas fa-stamp"></i> Issue Kitab</button>`
        );
    },

    // Kept for compatibility with older calls
    borrowBookModal(bookId) {
        return this.canManage() ? this.openIssueModal(bookId) : this.requestBook(bookId);
    },

    confirmBorrow() {
        const b = this.book(Lms.val('issue-book'));
        const u = Lms.user(Lms.val('issue-user'));
        const due = Lms.val('issue-due');
        if (!b || !u || !due) return;
        if (this.loans().some(l => l.bookId === b.id && l.userId === u.id && l.status === 'ISSUED')) {
            window.App.showToast(`${u.name} already has a copy of this book.`, 'warning');
            return;
        }
        // Fulfil an existing request from this borrower if there is one
        const req = this.loans().find(l => l.bookId === b.id && l.userId === u.id && l.status === 'REQUESTED');
        const loan = req || { id: Lms.uid('loan'), bookId: b.id, userId: u.id, userName: u.name, requestedAt: Lms.today() };
        Object.assign(loan, { status: 'ISSUED', issuedAt: Lms.today(), dueDate: due, returnedAt: null, issuedBy: Lms.me().id });
        if (!req) this.loans().push(loan);
        this.syncAvailability(b);
        Lms.save();
        Lms.notifyUser(u.id, `Book issued: ${b.title}`, `Return by ${Lms.fmtDate(due)}.`, 'GENERAL', 'library');
        window.App.closeModal();
        window.App.showToast(`"${b.title}" issued to ${u.name}`, 'success');
        window.App.navigate('library');
    },

    // ---------------------------------------------------------------------
    // CATALOG MANAGEMENT
    // ---------------------------------------------------------------------
    openAddBookModal(bookId) {
        const b = bookId ? this.book(bookId) : null;
        const cats = Array.from(new Set(['Hadith & Commentaries', 'Fiqh Hanafi Compendiums', 'Tafsir & Quranic Sciences', 'Usul al-Fiqh', 'Arabic Grammar & Rhetoric', 'Darul Ifta Collections', 'Seerah & History', 'Aqeedah',
            ...(window.LmsData.libraryBooks || []).map(x => x.category).filter(Boolean)]));
        Lms.openModal(
            `<i class="fas fa-plus" style="color: var(--primary-400);"></i> ${b ? 'Edit Kitab' : 'Catalog New Kitab'}`,
            `<div class="form-grid">
                <div class="form-group"><label>Title (English) *</label><input type="text" id="add-bk-title" class="form-control" value="${Lms.esc(b ? b.title : '')}" placeholder="e.g. Al-Mustasfa min Ilm al-Usul"></div>
                <div class="form-group"><label>Title in Arabic / Urdu</label><input type="text" id="add-bk-arabic" class="form-control" dir="rtl" value="${Lms.esc(b ? b.arabicTitle : '')}" placeholder="المستصفى من علم الأصول"></div>
                <div class="form-group"><label>Author *</label><input type="text" id="add-bk-author" class="form-control" value="${Lms.esc(b ? b.author : '')}"></div>
                <div class="form-group"><label>Category *</label>
                    <input type="text" id="add-bk-cat" class="form-control" list="bk-cat-list" value="${Lms.esc(b ? b.category : cats[0])}">
                    <datalist id="bk-cat-list">${cats.map(c => `<option value="${Lms.esc(c)}">`).join('')}</datalist>
                </div>
                <div class="form-group"><label>Publisher</label><input type="text" id="add-bk-pub" class="form-control" value="${Lms.esc(b ? b.publisher : 'Maktaba Ashrafia Lahore')}"></div>
                <div class="form-group"><label>Publication Year</label><input type="number" id="add-bk-year" class="form-control" value="${Lms.esc(b ? b.publicationYear : new Date().getFullYear())}"></div>
                <div class="form-group"><label>ISBN</label><input type="text" id="add-bk-isbn" class="form-control" value="${Lms.esc(b ? b.isbn : '')}"></div>
                <div class="form-group"><label>Rack / Shelf Location</label><input type="text" id="add-bk-rack" class="form-control" value="${Lms.esc(b ? b.rackLocation : '')}" placeholder="Rack U-02, Shelf A"></div>
                <div class="form-group"><label>Total Physical Copies *</label><input type="number" id="add-bk-copies" min="0" class="form-control" value="${Lms.esc(b ? b.totalCopies : 3)}"></div>
            </div>
            <div class="form-group">
                <label>e-Book (PDF) — optional</label>
                ${b && b.digitalUrl ? `<div style="margin-bottom: 6px; font-size: 0.82rem;">Current: <a href="${Lms.esc(b.digitalUrl)}" target="_blank" rel="noopener">${Lms.esc(b.digitalName || 'e-book')}</a>
                    <label style="margin-left: 10px;"><input type="checkbox" id="add-bk-remove-pdf"> remove</label></div>` : ''}
                ${Lms.fileInput('add-bk-pdf', { label: 'Upload a PDF so readers can read it online', accept: '.pdf', hint: 'PDF only • max 25 MB' })}
            </div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-primary" onclick="LibraryModule.saveNewBook(this, '${b ? b.id : ''}')"><i class="fas fa-save"></i> ${b ? 'Save Changes' : 'Add to Catalog'}</button>`
        );
    },

    async saveNewBook(btn, bookId) {
        const title = Lms.val('add-bk-title');
        const author = Lms.val('add-bk-author');
        const copies = parseInt(Lms.val('add-bk-copies'), 10);
        if (!title || !author || isNaN(copies) || copies < 0) {
            window.App.showToast('Title, author and number of copies are required', 'warning');
            return;
        }
        const existing = bookId ? this.book(bookId) : null;
        if (existing && copies < this.issuedCount(existing.id)) {
            window.App.showToast(`${this.issuedCount(existing.id)} copies are on loan — total copies cannot be lower than that.`, 'warning');
            return;
        }
        await Lms.busy(btn, async () => {
            const [pdf] = await Lms.uploadFromInput('add-bk-pdf');
            const fields = {
                title, author, arabicTitle: Lms.val('add-bk-arabic') || title, category: Lms.val('add-bk-cat') || 'General',
                publisher: Lms.val('add-bk-pub'), publicationYear: parseInt(Lms.val('add-bk-year'), 10) || null,
                isbn: Lms.val('add-bk-isbn'), rackLocation: Lms.val('add-bk-rack'), totalCopies: copies
            };
            if (pdf) Object.assign(fields, { digitalUrl: pdf.url, digitalName: pdf.name, isDigital: true });
            else if (document.getElementById('add-bk-remove-pdf')?.checked) Object.assign(fields, { digitalUrl: null, digitalName: null, isDigital: false });
            let book = existing;
            if (book) {
                Object.assign(book, fields);
            } else {
                const n = (window.LmsData.libraryBooks || []).length + 1;
                book = { id: Lms.uid('bk'), accessionNo: `MAK-ASH-${String(1000 + n)}-${Date.now().toString().slice(-3)}`, isDigital: !!pdf, ...fields };
                window.LmsData.libraryBooks.unshift(book);
            }
            this.syncAvailability(book);
            Lms.save();
            window.App.closeModal();
            window.App.showToast(existing ? 'Book updated' : `"${title}" added to the catalog`, 'success');
            window.App.navigate('library');
        }, 'Saving...');
    },

    deleteBook(bookId) {
        const b = this.book(bookId);
        if (!b) return;
        if (this.issuedCount(bookId)) {
            window.App.showToast('This book has copies on loan. Record their return first.', 'warning');
            return;
        }
        if (!confirm(`Remove "${b.title}" from the catalog?`)) return;
        window.LmsData.libraryBooks = window.LmsData.libraryBooks.filter(x => x.id !== bookId);
        this.loans().filter(l => l.bookId === bookId && l.status === 'REQUESTED').forEach(l => { l.status = 'CANCELLED'; });
        Lms.save();
        window.App.showToast('Book removed', 'success');
        window.App.navigate('library');
    },

    openDigitalReaderModal(bookId) {
        const book = this.book(bookId);
        if (!book) return;
        if (!book.digitalUrl) {
            window.App.showToast('No digital copy has been uploaded for this book yet.', 'info');
            return;
        }
        Lms.openModal(
            `<i class="fas fa-book-open" style="color: var(--gold-400);"></i> ${Lms.esc(book.title)}`,
            `<div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 8px;">${Lms.esc(book.author)} • ${Lms.esc(book.accessionNo)}</div>
            <iframe src="${Lms.esc(book.digitalUrl)}" title="${Lms.esc(book.title)}" style="width: 100%; height: 70vh; border: 1px solid var(--border-prominent); border-radius: 6px; background: #fff;"></iframe>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Close Reader</button>
             <a class="btn btn-gold" href="${Lms.esc(book.digitalUrl)}" download="${Lms.esc(book.digitalName || book.title + '.pdf')}"><i class="fas fa-download"></i> Download PDF</a>`,
            { wide: true }
        );
    }
};

window.LibraryModule = LibraryModule;
