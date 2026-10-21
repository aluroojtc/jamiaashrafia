/**
 * JAMIA ASHRAFIA LAHORE - INSTITUTION SETUP (Super Admin panel)
 * Branches (campuses), departments, programmes, academic sessions and the institution profile, stored on the
 * server (server/master-data.js). The Super Admin also reviews and removes the sample records that earlier
 * versions of the portal placed in the database (server/sample-data.js).
 */

const InstitutionSetupModule = {
    tab: 'branches', // 'branches' | 'programs' | 'departments' | 'sessions' | 'profile' | 'cleanup'
    lists: { branches: [], departments: [], programs: [], sessions: [] },
    institution: null,
    sample: null,
    loading: false,

    // Form fields per kind: [key, label, type, options]
    FORMS: {
        branches: {
            title: 'Campus / Branch', endpoint: '/api/branches',
            fields: [
                ['code', 'Code *', 'text', { placeholder: 'e.g. MAIN', upper: true }],
                ['name', 'Name *', 'text'],
                ['urduName', 'Name in Urdu', 'text', { rtl: true }],
                ['address', 'Address / Location', 'text'],
                ['city', 'City', 'text'],
                ['contactPhone', 'Phone', 'tel'],
                ['contactEmail', 'Email', 'email'],
                ['established', 'Established (year)', 'number'],
                ['students', 'Student strength', 'number'],
                ['isWomens', 'Women\'s campus', 'checkbox']
            ]
        },
        departments: {
            title: 'Department', endpoint: '/api/departments',
            fields: [
                ['code', 'Code *', 'text', { upper: true }],
                ['name', 'Name *', 'text'],
                ['urduName', 'Name in Urdu', 'text', { rtl: true }],
                ['description', 'Description', 'textarea']
            ]
        },
        programs: {
            title: 'Programme', endpoint: '/api/programs',
            fields: [
                ['code', 'Code *', 'text', { upper: true }],
                ['name', 'Name *', 'text'],
                ['urduName', 'Name in Urdu', 'text', { rtl: true }],
                ['departmentId', 'Department *', 'department'],
                ['durationYears', 'Duration (years) *', 'number'],
                ['wifaqEquivalence', 'Wifaq / HEC equivalence', 'text'],
                ['description', 'Description', 'textarea']
            ]
        },
        sessions: {
            title: 'Academic Session', endpoint: '/api/sessions',
            fields: [
                ['name', 'Name *', 'text', { placeholder: 'e.g. 1447-1448 AH (2026-2027 CE)' }],
                ['startDate', 'Starts *', 'date'],
                ['endDate', 'Ends *', 'date'],
                ['isCurrent', 'Current session', 'checkbox']
            ]
        }
    },

    canManage() {
        return Lms.can('settings.master_data');
    },

    isSuperAdmin() {
        return window.AuthRBAC.isSuperAdmin() && !window.AuthRBAC.session.preview;
    },

    async load() {
        if (this.loading) return;
        this.loading = true;
        try {
            const [b, d, p, s, inst] = await Promise.all([
                Lms.api('GET', '/api/branches'), Lms.api('GET', '/api/departments'), Lms.api('GET', '/api/programs'),
                Lms.api('GET', '/api/sessions'), Lms.api('GET', '/api/settings/institution')
            ]);
            this.lists = { branches: b.branches || [], departments: d.departments || [], programs: p.programs || [], sessions: s.sessions || [] };
            this.institution = inst.institution || {};
            if (this.tab === 'cleanup' && this.isSuperAdmin()) await this.loadSample();
        } catch (e) {
            window.App.showToast(e.message, 'danger');
        } finally {
            this.loading = false;
            this.refresh();
        }
    },

    async loadSample() {
        try {
            this.sample = (await Lms.api('GET', '/api/admin/sample-data')).groups || [];
        } catch (e) {
            this.sample = [];
            window.App.showToast(e.message, 'danger');
        }
    },

    refresh() {
        const viewport = document.getElementById('main-content-viewport');
        if (viewport && window.App.currentRoute === 'setup') viewport.innerHTML = this.render();
    },

    async switchTab(tab) {
        this.tab = tab;
        if (tab === 'cleanup' && this.isSuperAdmin()) {
            this.sample = null;
            this.refresh();
            await this.loadSample();
        }
        this.refresh();
    },

    // Everything else in the portal reads branches, programmes and sessions from App.syncMasterData
    async afterChange() {
        await this.load();
        await window.App.syncMasterData();
    },

    render() {
        const tabs = [
            ['branches', 'fas fa-university', 'Campuses & Branches', this.lists.branches.length],
            ['programs', 'fas fa-graduation-cap', 'Programmes', this.lists.programs.length],
            ['departments', 'fas fa-sitemap', 'Departments', this.lists.departments.length],
            ['sessions', 'fas fa-calendar-alt', 'Academic Sessions', this.lists.sessions.length],
            ['profile', 'fas fa-landmark', 'Institution Profile', null]
        ];
        if (this.isSuperAdmin()) tabs.push(['cleanup', 'fas fa-broom', 'Data Clean-up', null]);
        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1><i class="fas fa-sliders-h" style="color: var(--gold-400);"></i> Institution Setup</h1>
                    <p>Campuses, programmes, departments, academic sessions and the institution profile used across the portal</p>
                </div>
            </div>
            <div class="vc-tab-nav">
                ${tabs.map(([key, icon, label, count]) => `
                    <button class="vc-tab-btn ${this.tab === key ? 'active' : ''}" onclick="InstitutionSetupModule.switchTab('${key}')">
                        <i class="${icon}"></i> ${label}${count === null ? '' : ` <span class="badge-pill">${count}</span>`}
                    </button>`).join('')}
            </div>
            ${this.institution === null ? `<div class="card">${window.App.dashEmpty('<i class="fas fa-spinner fa-spin"></i> Loading...')}</div>` : this.renderTab()}
        `;
    },

    renderTab() {
        switch (this.tab) {
            case 'programs': return this.renderPrograms();
            case 'departments': return this.renderDepartments();
            case 'sessions': return this.renderSessions();
            case 'profile': return this.renderProfile();
            case 'cleanup': return this.renderCleanup();
            default: return this.renderBranches();
        }
    },

    toolbar(kind, hint) {
        return `
            <div class="card-header">
                <div style="font-size: 0.85rem; color: var(--text-secondary);">${hint}</div>
                ${this.canManage() ? `<button class="btn btn-primary btn-sm" onclick="InstitutionSetupModule.openForm('${kind}')"><i class="fas fa-plus"></i> Add ${this.FORMS[kind].title}</button>` : ''}
            </div>`;
    },

    rowActions(kind, id) {
        if (!this.canManage()) return '';
        return `
            <button class="btn btn-secondary btn-sm" title="Edit" onclick="InstitutionSetupModule.openForm('${kind}', '${Lms.esc(id)}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-secondary btn-sm" title="Delete" onclick="InstitutionSetupModule.remove('${kind}', '${Lms.esc(id)}')"><i class="fas fa-trash" style="color: var(--danger);"></i></button>`;
    },

    table(headers, rows, empty) {
        return `
            <div class="table-responsive">
                <table class="data-table">
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}<th style="text-align: end;">Actions</th></tr></thead>
                    <tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length + 1}" style="text-align: center; color: var(--text-muted); padding: 30px;">${empty}</td></tr>`}</tbody>
                </table>
            </div>`;
    },

    renderBranches() {
        const users = window.LmsData.users || [];
        const classes = window.LmsData.classes || [];
        const mainId = (this.institution || {}).mainBranchId;
        return `
            <div class="card">
                ${this.toolbar('branches', 'Campuses appear on the admission form and in student, teacher and class records.')}
                ${this.table(['Code', 'Campus', 'Location', 'Type', 'Est.', 'In the portal'], this.lists.branches.map(b => `
                    <tr>
                        <td><strong>${Lms.esc(b.code)}</strong></td>
                        <td>
                            <div style="font-weight: 700; color: var(--primary-950);">${Lms.esc(Lms.localName(b.name, b.urduName))}</div>
                            ${b.id === mainId ? '<span class="status-pill gold" style="font-size: 0.68rem;">Main campus</span>' : ''}
                        </td>
                        <td style="font-size: 0.82rem;">${Lms.esc(Lms.branchLocation(b) || '—')}</td>
                        <td>${b.isWomens ? '<span class="status-pill warning">Women\'s campus</span>' : '<span class="status-pill info">Campus</span>'}</td>
                        <td>${Lms.esc(b.established || '—')}</td>
                        <td style="font-size: 0.8rem; color: var(--text-secondary);">
                            ${I18n.t('{n} students', { n: users.filter(u => u.role === 'STUDENT' && u.branchId === b.id).length })} •
                            ${I18n.t('{n} classes', { n: classes.filter(c => c.branchId === b.id).length })}
                        </td>
                        <td style="text-align: end; white-space: nowrap;">${this.rowActions('branches', b.id)}</td>
                    </tr>`), 'No campuses set up yet.')}
            </div>`;
    },

    renderPrograms() {
        const classes = window.LmsData.classes || [];
        return `
            <div class="card">
                ${this.toolbar('programs', 'Programmes are offered on the admission form and group classes, courses and fee structures.')}
                ${this.table(['Code', 'Programme', 'Department', 'Duration', 'Equivalence', 'Classes'], this.lists.programs.map(p => `
                    <tr>
                        <td><strong>${Lms.esc(p.code)}</strong></td>
                        <td style="font-weight: 700; color: var(--primary-950);">${Lms.esc(Lms.localName(p.name, p.urduName))}</td>
                        <td style="font-size: 0.82rem;">${Lms.esc(p.departmentName || '—')}</td>
                        <td>${I18n.t('{n} years', { n: p.durationYears })}</td>
                        <td style="font-size: 0.8rem; color: var(--text-secondary);">${Lms.esc(p.wifaqEquivalence || '—')}</td>
                        <td>${classes.filter(c => c.programId === p.id).length}</td>
                        <td style="text-align: end; white-space: nowrap;">${this.rowActions('programs', p.id)}</td>
                    </tr>`), this.lists.departments.length ? 'No programmes set up yet.' : 'Add a department first, then its programmes.')}
            </div>`;
    },

    renderDepartments() {
        return `
            <div class="card">
                ${this.toolbar('departments', 'Every programme belongs to a department.')}
                ${this.table(['Code', 'Department', 'Programmes', 'Description'], this.lists.departments.map(d => `
                    <tr>
                        <td><strong>${Lms.esc(d.code)}</strong></td>
                        <td style="font-weight: 700; color: var(--primary-950);">${Lms.esc(Lms.localName(d.name, d.urduName))}</td>
                        <td>${this.lists.programs.filter(p => p.departmentId === d.id).length}</td>
                        <td style="font-size: 0.8rem; color: var(--text-secondary);">${Lms.esc(d.description || '—')}</td>
                        <td style="text-align: end; white-space: nowrap;">${this.rowActions('departments', d.id)}</td>
                    </tr>`), 'No departments set up yet.')}
            </div>`;
    },

    renderSessions() {
        return `
            <div class="card">
                ${this.toolbar('sessions', 'The current session is the default for new exams and admissions.')}
                ${this.table(['Session', 'Starts', 'Ends', 'Status'], this.lists.sessions.map(s => `
                    <tr>
                        <td style="font-weight: 700; color: var(--primary-950);">${Lms.esc(s.name)}</td>
                        <td>${Lms.fmtDate(s.startDate)}</td>
                        <td>${Lms.fmtDate(s.endDate)}</td>
                        <td>${s.isCurrent ? '<span class="status-pill success"><i class="fas fa-check-circle"></i> Current</span>'
                            : (this.canManage() ? `<button class="btn btn-secondary btn-sm" onclick="InstitutionSetupModule.makeCurrent('${Lms.esc(s.id)}')">Make current</button>` : '')}</td>
                        <td style="text-align: end; white-space: nowrap;">${this.rowActions('sessions', s.id)}</td>
                    </tr>`), 'No academic sessions set up yet.')}
            </div>`;
    },

    // ---------------------------------------------------------------------
    // Add / edit / delete
    // ---------------------------------------------------------------------
    openForm(kind, id) {
        if (!this.canManage()) return;
        const form = this.FORMS[kind];
        const rec = id ? this.lists[kind].find(r => r.id === id) : null;
        const d = rec || {};
        const input = ([key, label, type, opts = {}]) => {
            const fid = `md-${key}`;
            const value = d[key] === undefined || d[key] === null ? '' : d[key];
            if (type === 'checkbox') {
                return `<div class="form-group" style="display: flex; align-items: center; gap: 8px; padding-top: 24px;">
                    <input type="checkbox" id="${fid}" ${value ? 'checked' : ''} style="width: 18px; height: 18px;"><label for="${fid}" style="margin: 0;">${label}</label></div>`;
            }
            if (type === 'textarea') {
                return `<div class="form-group" style="grid-column: 1 / -1;"><label for="${fid}">${label}</label><textarea id="${fid}" class="form-control">${Lms.esc(value)}</textarea></div>`;
            }
            if (type === 'department') {
                return `<div class="form-group"><label for="${fid}">${label}</label><select id="${fid}" class="form-control">
                    ${this.lists.departments.map(dep => `<option value="${Lms.esc(dep.id)}" ${dep.id === value ? 'selected' : ''}>${Lms.esc(dep.name)}</option>`).join('')}</select></div>`;
            }
            return `<div class="form-group"><label for="${fid}">${label}</label><input type="${type}" id="${fid}" class="form-control" value="${Lms.esc(value)}"
                ${opts.rtl ? 'dir="rtl"' : ''} ${opts.placeholder ? `placeholder="${Lms.esc(opts.placeholder)}"` : ''} ${opts.upper ? 'style="text-transform: uppercase;"' : ''}></div>`;
        };
        if (kind === 'programs' && !this.lists.departments.length) {
            window.App.showToast('Add a department first, then its programmes.', 'warning');
            return;
        }
        Lms.openModal(
            `<i class="fas ${rec ? 'fa-edit' : 'fa-plus-circle'}" style="color: var(--gold-400);"></i> ${rec ? 'Edit' : 'Add'} ${form.title}`,
            `<div class="form-grid">${form.fields.map(input).join('')}</div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-primary" onclick="InstitutionSetupModule.save(this, '${kind}', '${rec ? Lms.esc(rec.id) : ''}')"><i class="fas fa-save"></i> Save</button>`
        );
    },

    async save(btn, kind, id) {
        const form = this.FORMS[kind];
        const body = {};
        form.fields.forEach(([key, , type]) => {
            const el = document.getElementById(`md-${key}`);
            if (!el) return;
            body[key] = type === 'checkbox' ? el.checked : String(el.value || '').trim();
        });
        await Lms.busy(btn, async () => {
            await Lms.api(id ? 'PUT' : 'POST', id ? `${form.endpoint}/${encodeURIComponent(id)}` : form.endpoint, body);
            window.App.closeModal();
            window.App.showToast(id ? `${form.title} updated` : `${form.title} added`, 'success');
            await this.afterChange();
        });
    },

    async remove(kind, id) {
        const form = this.FORMS[kind];
        const rec = this.lists[kind].find(r => r.id === id);
        if (!rec || !confirm(I18n.t('Delete {name}? This cannot be undone.', { name: rec.name }))) return;
        try {
            await Lms.api('DELETE', `${form.endpoint}/${encodeURIComponent(id)}`);
            window.App.showToast(`${form.title} deleted`, 'success');
            await this.afterChange();
        } catch (e) {
            window.App.showToast(e.message, 'warning');
        }
    },

    async makeCurrent(id) {
        try {
            await Lms.api('PUT', `/api/sessions/${encodeURIComponent(id)}`, { isCurrent: true });
            window.App.showToast('Current session changed', 'success');
            await this.afterChange();
        } catch (e) {
            window.App.showToast(e.message, 'danger');
        }
    },

    // ---------------------------------------------------------------------
    // Institution profile
    // ---------------------------------------------------------------------
    renderProfile() {
        const p = this.institution || {};
        const edit = this.canManage();
        const field = (key, label, opts = {}) => `
            <div class="form-group"><label for="ip-${key}">${label}</label>
                <input type="${opts.type || 'text'}" id="ip-${key}" class="form-control" value="${Lms.esc(p[key] === null || p[key] === undefined ? '' : p[key])}" ${opts.rtl ? 'dir="rtl"' : ''} ${edit ? '' : 'disabled'}></div>`;
        return `
            <div class="card">
                <div class="card-header"><h3 class="card-title"><i class="fas fa-landmark"></i> Institution Profile</h3></div>
                <div class="form-grid">
                    ${field('name', 'Institution name *')}
                    ${field('urduName', 'Name in Urdu', { rtl: true })}
                    ${field('motto', 'Motto')}
                    ${field('established', 'Established (year)', { type: 'number' })}
                    ${field('mainCampus', 'Main campus address')}
                    <div class="form-group"><label for="ip-mainBranchId">Main campus (default for new records)</label>
                        <select id="ip-mainBranchId" class="form-control" ${edit ? '' : 'disabled'}>
                            <option value="">— First campus in the list —</option>
                            ${this.lists.branches.map(b => `<option value="${Lms.esc(b.id)}" ${b.id === p.mainBranchId ? 'selected' : ''}>${Lms.esc(b.name)}</option>`).join('')}
                        </select></div>
                    ${field('affiliation', 'Affiliation / examining board')}
                    ${field('website', 'Website', { type: 'url' })}
                    ${field('phone', 'Phone', { type: 'tel' })}
                    ${field('email', 'Email', { type: 'email' })}
                    ${field('bankName', 'Bank for fee payments')}
                    ${field('bankAccountTitle', 'Account title')}
                    ${field('bankAccountNumber', 'Account number')}
                </div>
                <h4 style="margin: 10px 0 8px; color: var(--primary-950);">Current Leadership</h4>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px;">Shown on the dashboard and the Institutional Heritage page.</p>
                <div id="ip-leadership" style="display: flex; flex-direction: column; gap: 8px;">
                    ${(p.leadership || []).map(l => this.leaderRow(l, edit)).join('')}
                </div>
                ${edit ? `
                    <div style="display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap;">
                        <button class="btn btn-secondary btn-sm" onclick="InstitutionSetupModule.addLeader()"><i class="fas fa-plus"></i> Add Office Holder</button>
                        <button class="btn btn-primary" onclick="InstitutionSetupModule.saveProfile(this)"><i class="fas fa-save"></i> Save Profile</button>
                    </div>` : ''}
            </div>`;
    },

    leaderRow(l, edit) {
        return `
            <div class="ip-leader" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <input type="text" class="form-control ip-office" style="flex: 1; min-width: 180px;" placeholder="Office, e.g. Principal / Mohtamim" value="${Lms.esc(l.office || '')}" ${edit ? '' : 'disabled'}>
                <input type="text" class="form-control ip-name" style="flex: 1; min-width: 180px;" placeholder="Name" value="${Lms.esc(l.name || '')}" ${edit ? '' : 'disabled'}>
                ${edit ? `<button class="btn btn-secondary btn-sm" title="Remove" onclick="this.closest('.ip-leader').remove()"><i class="fas fa-times" style="color: var(--danger);"></i></button>` : ''}
            </div>`;
    },

    addLeader() {
        document.getElementById('ip-leadership').insertAdjacentHTML('beforeend', this.leaderRow({}, true));
    },

    async saveProfile(btn) {
        const body = {};
        ['name', 'urduName', 'motto', 'established', 'mainCampus', 'mainBranchId', 'affiliation', 'website', 'phone', 'email', 'bankName', 'bankAccountTitle', 'bankAccountNumber'].forEach(k => { body[k] = Lms.val(`ip-${k}`); });
        body.leadership = Array.from(document.querySelectorAll('#ip-leadership .ip-leader')).map(row => ({
            office: row.querySelector('.ip-office').value.trim(), name: row.querySelector('.ip-name').value.trim()
        })).filter(l => l.name);
        await Lms.busy(btn, async () => {
            const data = await Lms.api('POST', '/api/settings/institution', body);
            this.institution = data.institution;
            window.App.showToast('Institution profile saved', 'success');
            await window.App.syncMasterData();
            this.refresh();
        });
    },

    // ---------------------------------------------------------------------
    // Sample data clean-up (Super Admin)
    // ---------------------------------------------------------------------
    renderCleanup() {
        if (!this.isSuperAdmin()) return `<div class="card">${window.App.dashEmpty('Only the Super Admin can review sample data.')}</div>`;
        if (this.sample === null) return `<div class="card">${window.App.dashEmpty('<i class="fas fa-spinner fa-spin"></i> Checking the database...')}</div>`;
        const kinds = {
            sample: ['Sample records from earlier versions', 'Demonstration records that earlier versions of the portal copied into the database. Untick anything your institution uses for real.'],
            test: ['Test applications', 'Admission applications created by automated tests.'],
            linked: ['Records linked to sample records', 'Made later, but they belong to a sample class, person or record (for example a check-in to a sample online class). Not ticked: review them first.']
        };
        const total = this.sample.reduce((s, g) => s + g.records.length, 0);
        if (!total) {
            return `<div class="card" style="text-align: center; padding: 40px 20px;">
                <i class="fas fa-check-circle" style="font-size: 2.4rem; color: var(--success);"></i>
                <h3 style="margin: 12px 0 6px;">No sample or test data found</h3>
                <p style="color: var(--text-secondary);">Everything in the database was entered by your staff.</p></div>`;
        }
        return `
            <div class="card" style="border-inline-start: 4px solid var(--warning);">
                <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.6;">
                    ${I18n.t('{n} records look like sample or test data. Review the list, untick anything that is real, then remove the rest. Removed accounts can no longer sign in.', { n: `<strong>${total}</strong>` })}
                </p>
            </div>
            ${['sample', 'test', 'linked'].map(kind => {
                const groups = this.sample.filter(g => g.kind === kind);
                if (!groups.length) return '';
                return `
                    <div class="card">
                        <div class="card-header">
                            <div>
                                <h3 class="card-title">${kinds[kind][0]}</h3>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${kinds[kind][1]}</div>
                            </div>
                        </div>
                        ${groups.map(g => `
                            <div style="margin-bottom: 14px;">
                                <label style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--primary-950); margin-bottom: 6px; cursor: pointer;">
                                    <input type="checkbox" ${kind === 'linked' ? '' : 'checked'} onchange="this.closest('div').querySelectorAll('.sd-item').forEach(c => { c.checked = this.checked; })">
                                    ${Lms.esc(g.label)} <span class="badge-pill">${g.records.length}</span>
                                </label>
                                <div style="display: flex; flex-direction: column; gap: 4px; padding-inline-start: 24px;">
                                    ${g.records.map(r => `
                                        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer;">
                                            <input type="checkbox" class="sd-item" data-collection="${Lms.esc(r.collection)}" data-id="${Lms.esc(r.id)}" ${kind === 'linked' ? '' : 'checked'}>
                                            <span>${Lms.esc(r.label)}</span>
                                            <span translate="no" style="color: var(--text-muted); font-size: 0.72rem;">${Lms.esc(r.id)}${r.updatedAt ? ' • ' + Lms.esc(r.updatedAt) : ''}</span>
                                        </label>`).join('')}
                                </div>
                            </div>`).join('')}
                    </div>`;
            }).join('')}
            <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
                <button class="btn btn-danger" onclick="InstitutionSetupModule.removeSample(this)"><i class="fas fa-trash-alt"></i> Remove Selected Records</button>
            </div>`;
    },

    async removeSample(btn) {
        const items = Array.from(document.querySelectorAll('.sd-item:checked')).map(c => ({ collection: c.dataset.collection, id: c.dataset.id }));
        if (!items.length) {
            window.App.showToast('Tick at least one record to remove.', 'warning');
            return;
        }
        if (!confirm(I18n.t('Remove {n} selected records from the portal?', { n: items.length }))) return;
        await Lms.busy(btn, async () => {
            const data = await Lms.api('POST', '/api/admin/sample-data/remove', { items });
            window.App.showToast(I18n.t('{n} records removed', { n: data.total }), 'success');
            await window.DataStore.syncNow();
            this.sample = null;
            this.refresh();
            await this.loadSample();
            this.refresh();
        }, 'Removing...');
    }
};

window.InstitutionSetupModule = InstitutionSetupModule;
