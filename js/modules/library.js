/**
 * JAMIA ASHRAFIA LAHORE - LIBRARY MANAGEMENT (MAKTABA ASHRAFIA)
 * Classical Islamic texts, accession indexing, digital manuscript reader, and borrowing ledger
 */

const LibraryModule = {
    render() {
        const books = window.LmsData.libraryBooks;
        const canManage = window.AuthRBAC.isAdmin() || window.AuthRBAC.currentUser?.role === 'LIBRARIAN';

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-book-reader" style="color: var(--primary-400);"></i>
                        Maktaba Ashrafia - Central Library & Darul Kutub
                    </h1>
                    <p>Repository of classical Islamic manuscripts, Tafsir, Hadith commentaries, Hanafi Fiqh, and modern research archives</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-secondary btn-sm" onclick="LibraryModule.openSearchFilterModal()">
                        <i class="fas fa-filter"></i> Advanced Catalog Filter
                    </button>
                    ${canManage ? `
                        <button class="btn btn-gold btn-sm" onclick="LibraryModule.openAddBookModal()">
                            <i class="fas fa-plus"></i> Catalog New Kitab
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- LIBRARY METRICS -->
            <div class="metrics-grid">
                <div class="metric-card gold">
                    <div class="metric-icon-box"><i class="fas fa-books"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Cataloged Kitabs</span>
                        <span class="metric-value">45,000+</span>
                        <span class="metric-hint" style="color: var(--gold-300);">Maktaba Ashrafia</span>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon-box"><i class="fas fa-scroll"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Rare Manuscripts</span>
                        <span class="metric-value">1,850</span>
                        <span class="metric-hint">Digital Preservation</span>
                    </div>
                </div>
                <div class="metric-card info">
                    <div class="metric-icon-box"><i class="fas fa-book"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Digital e-Books</span>
                        <span class="metric-value">${books.filter(b => b.isDigital).length} Available</span>
                        <span class="metric-hint">Instant PDF Viewer</span>
                    </div>
                </div>
                <div class="metric-card danger">
                    <div class="metric-icon-box"><i class="fas fa-hand-holding"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Active Loans</span>
                        <span class="metric-value">312</span>
                        <span class="metric-hint" style="color: var(--text-muted);">Scholars Borrowed</span>
                    </div>
                </div>
            </div>

            <!-- SEARCH BAR -->
            <div class="filter-bar">
                <div class="search-input-wrap">
                    <i class="fas fa-search"></i>
                    <input type="text" class="form-control" placeholder="Search by Kitab title (Urdu/Arabic), author, or accession number..." oninput="LibraryModule.searchBooks(this.value)">
                </div>
                <div class="filter-actions">
                    <button class="btn btn-secondary btn-sm" onclick="LibraryModule.filterCategory('ALL')">All Categories</button>
                    <button class="btn btn-secondary btn-sm" onclick="LibraryModule.filterCategory('Hadith')">Hadith</button>
                    <button class="btn btn-secondary btn-sm" onclick="LibraryModule.filterCategory('Fiqh')">Fiqh Hanafi</button>
                    <button class="btn btn-secondary btn-sm" onclick="LibraryModule.filterCategory('Tafsir')">Tafsir</button>
                </div>
            </div>

            <!-- BOOKS GRID -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 28px;" id="books-grid-container">
                ${this.renderBookCards(books)}
            </div>
        `;
    },

    renderBookCards(list) {
        if (!list || list.length === 0) {
            return `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No books found matching criteria.</div>`;
        }

        return list.map(b => `
            <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <span class="status-pill gold" style="font-size: 0.68rem;">${b.category}</span>
                        <span style="font-family: monospace; font-size: 0.75rem; color: var(--text-muted);">${b.accessionNo}</span>
                    </div>
                    <h3 style="font-size: 1.05rem; color: var(--primary-950); margin-bottom: 4px;">${b.title}</h3>
                    <div style="font-family: 'Amiri', serif; font-size: 1.25rem; color: var(--gold-700); margin-bottom: 8px;">${b.arabicTitle}</div>
                    
                    <div style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 14px;">
                        <div><i class="fas fa-feather-alt" style="color: var(--primary-700); width: 16px;"></i> <strong>Author:</strong> ${b.author}</div>
                        <div><i class="fas fa-print" style="color: var(--gold-700); width: 16px;"></i> <strong>Publisher:</strong> ${b.publisher} (${b.publicationYear})</div>
                        <div><i class="fas fa-map-pin" style="color: var(--danger); width: 16px;"></i> <strong>Location:</strong> ${b.rackLocation}</div>
                    </div>
                </div>

                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-top: 1px solid var(--border-subtle); margin-bottom: 12px; font-size: 0.78rem;">
                        <span style="color: ${b.availableCopies > 0 ? 'var(--success)' : 'var(--danger)'};">
                            <i class="fas fa-layer-group"></i> ${b.availableCopies} of ${b.totalCopies} Available
                        </span>
                        ${b.isDigital ? '<span class="status-pill success" style="font-size: 0.65rem;"><i class="fas fa-file-pdf"></i> e-Book</span>' : ''}
                    </div>

                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="LibraryModule.openDigitalReaderModal('${b.id}')">
                            <i class="fas fa-eye"></i> Read Digital
                        </button>
                        <button class="btn btn-gold btn-sm" style="flex: 1;" onclick="LibraryModule.borrowBookModal('${b.id}')" ${b.availableCopies <= 0 ? 'disabled' : ''}>
                            <i class="fas fa-book"></i> Borrow
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    searchBooks(query) {
        const q = query.toLowerCase().trim();
        const filtered = window.LmsData.libraryBooks.filter(b => 
            b.title.toLowerCase().includes(q) || 
            b.arabicTitle.includes(q) || 
            b.author.toLowerCase().includes(q) ||
            b.accessionNo.toLowerCase().includes(q)
        );
        document.getElementById('books-grid-container').innerHTML = this.renderBookCards(filtered);
    },

    filterCategory(cat) {
        if (cat === 'ALL') {
            document.getElementById('books-grid-container').innerHTML = this.renderBookCards(window.LmsData.libraryBooks);
        } else {
            const filtered = window.LmsData.libraryBooks.filter(b => b.category.toLowerCase().includes(cat.toLowerCase()));
            document.getElementById('books-grid-container').innerHTML = this.renderBookCards(filtered);
        }
    },

    openDigitalReaderModal(bookId) {
        const book = window.LmsData.libraryBooks.find(b => b.id === bookId);
        if (!book) return;

        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-book-open" style="color: var(--gold-400);"></i> Maktaba Ashrafia Reader: ${book.title}`;
        modalBody.innerHTML = `
            <div style="background: #0d171b; border: 1px solid var(--border-prominent); border-radius: 8px; padding: 24px; color: #f8fafc; font-family: 'Amiri', serif; direction: rtl; text-align: justify; line-height: 2.2; max-height: 480px; overflow-y: auto;">
                <div style="text-align: center; border-bottom: 1px solid var(--border-prominent); padding-bottom: 14px; margin-bottom: 18px;">
                    <div style="font-size: 1.8rem; color: var(--gold-300);">${book.arabicTitle}</div>
                    <div style="font-size: 1.1rem; color: var(--primary-400);">المؤلف: ${book.author}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); font-family: 'Inter', sans-serif; direction: ltr;">
                        Accession: ${book.accessionNo} • Digital Archive Maktaba Ashrafia Lahore
                    </div>
                </div>

                <div style="font-size: 1.25rem;">
                    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ<br>
                    الحمد لله الذي أنزل على عبده الكتاب ولم يجعل له عوجا، والصلاة والسلام على خاتم النبيين وإمام المتقين سيدنا محمد وعلى آله وصحبه أجمعين.<br><br>
                    أما بعد: فإن الاشتغال بالعلم الشرعي ونقل حديث رسول الله ﷺ ومعرفة أحكام الفقه الإسلامي من أعظم القربات إلى الله تعالى. 
                    وقد عنيت جامعة أشرفية لاهور بحفظ هذا التراث الأصيل منذ تأسيسها المبارك عام 1366 هـ / 1947 م على يد الإمام الرباني مفتي محمد حسن قدس سره، 
                    وهذا السفر الجليل يمثل عمدة المباحث في تخريج المسائل الفقهية والحديثية المعول عليها عند أئمة الحنفية وجمهور علماء الأمة.
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; font-size: 0.82rem; color: var(--text-muted);">
                <span>Showing Page 1 of 840 (Volume 1)</span>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary btn-sm"><i class="fas fa-chevron-right"></i> Next Page</button>
                    <button class="btn btn-secondary btn-sm">Previous Page <i class="fas fa-chevron-left"></i></button>
                </div>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Close Reader</button>
            <button class="btn btn-gold" onclick="window.App.showToast('Downloaded full PDF manuscript from Maktaba server', 'success')">
                <i class="fas fa-download"></i> Download Full PDF
            </button>
        `;
        window.App.openModal();
    },

    borrowBookModal(bookId) {
        const book = window.LmsData.libraryBooks.find(b => b.id === bookId);
        if (!book) return;

        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-book" style="color: var(--gold-400);"></i> Issue Library Book: ${book.title}`;
        modalBody.innerHTML = `
            <div style="margin-bottom: 16px;">
                <strong>Kitab:</strong> ${book.title} (${book.accessionNo})<br>
                <strong>Author:</strong> ${book.author}<br>
                <strong>Shelf Location:</strong> ${book.rackLocation}
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
                <label>Borrower Student / Teacher</label>
                <select id="borrow-user" class="form-control">
                    ${window.LmsData.users.map(u => `
                        <option value="${u.id}">${u.name} (${u.role} - ${u.rollNo || u.designation})</option>
                    `).join('')}
                </select>
            </div>

            <div class="form-group">
                <label>Return Due Date</label>
                <input type="date" id="borrow-due" class="form-control" value="2026-10-18">
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Cancel</button>
            <button class="btn btn-gold" onclick="LibraryModule.confirmBorrow('${book.id}')">
                <i class="fas fa-stamp"></i> Issue Kitab
            </button>
        `;
        window.App.openModal();
    },

    confirmBorrow(bookId) {
        const book = window.LmsData.libraryBooks.find(b => b.id === bookId);
        if (book && book.availableCopies > 0) {
            book.availableCopies--;
            window.DataStore.save(window.LmsData);
            window.App.closeModal();
            window.App.showToast(`Book "${book.title}" successfully issued!`, "success");
            window.App.navigate('library');
        }
    },

    openAddBookModal() {
        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-plus" style="color: var(--primary-400);"></i> Catalog New Kitab into Maktaba Ashrafia`;
        modalBody.innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    <label>Kitab Title (English) *</label>
                    <input type="text" id="add-bk-title" class="form-control" placeholder="e.g. Al-Mustasfa min Ilm al-Usul">
                </div>
                <div class="form-group">
                    <label>Title in Arabic / Urdu *</label>
                    <input type="text" id="add-bk-arabic" class="form-control" placeholder="المستصفى من علم الأصول">
                </div>
                <div class="form-group">
                    <label>Author *</label>
                    <input type="text" id="add-bk-author" class="form-control" placeholder="Imam Abu Hamid al-Ghazali">
                </div>
                <div class="form-group">
                    <label>Category *</label>
                    <select id="add-bk-cat" class="form-control">
                        <option value="Usul al-Fiqh">Usul al-Fiqh (اصول الفقہ)</option>
                        <option value="Hadith & Commentaries">Hadith & Commentaries (الحدیث الشریف)</option>
                        <option value="Fiqh Hanafi Compendiums">Fiqh Hanafi Compendiums (الفقہ الحنفی)</option>
                        <option value="Tafsir & Quranic Sciences">Tafsir & Quranic Sciences (التفسیر)</option>
                        <option value="Arabic Grammar & Rhetoric">Arabic Grammar & Rhetoric (النحو والادب)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Rack / Shelf Location</label>
                    <input type="text" id="add-bk-rack" class="form-control" placeholder="Rack U-02, Shelf A">
                </div>
                <div class="form-group">
                    <label>Total Physical Copies</label>
                    <input type="number" id="add-bk-copies" class="form-control" value="5">
                </div>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="LibraryModule.saveNewBook()">Add to Library Catalog</button>
        `;
        window.App.openModal();
    },

    saveNewBook() {
        const title = document.getElementById('add-bk-title').value.trim();
        const arabic = document.getElementById('add-bk-arabic').value.trim();
        const author = document.getElementById('add-bk-author').value.trim();
        const cat = document.getElementById('add-bk-cat').value;
        const rack = document.getElementById('add-bk-rack').value.trim() || "Rack G-01";
        const copies = parseInt(document.getElementById('add-bk-copies').value) || 3;

        if (!title || !author) {
            window.App.showToast("Please provide title and author", "warning");
            return;
        }

        const newBook = {
            id: `bk_${Date.now()}`,
            accessionNo: `MAK-ASH-${String(window.LmsData.libraryBooks.length + 100).padStart(4, '0')}`,
            isbn: `978-969-583-${Math.floor(100 + Math.random() * 899)}-0`,
            title: title,
            arabicTitle: arabic || title,
            author: author,
            category: cat,
            publisher: "Maktaba Ashrafia Lahore",
            publicationYear: 2023,
            rackLocation: rack,
            totalCopies: copies,
            availableCopies: copies,
            isDigital: true
        };

        window.LmsData.libraryBooks.unshift(newBook);
        window.DataStore.save(window.LmsData);
        window.App.closeModal();
        window.App.showToast(`Kitab "${title}" cataloged in Maktaba Ashrafia!`, "success");
        window.App.navigate('library');
    }
};

window.LibraryModule = LibraryModule;
