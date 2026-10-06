/**
 * JAMIA ASHRAFIA LAHORE - ROLES & PERMISSIONS MODULE
 *
 * RULES (all enforced again by the server):
 * 1. Super Admin holds every permission, including future ones. It has no checklist, is never edited here
 *    (its profile is edited under Users) and can never be deleted.
 * 2. Admin, Teacher and Student are default roles: their permissions can be changed, their data scope cannot,
 *    and they cannot be deleted. Teacher and Student can only hold permissions of their portal.
 * 3. You can only give or take away permissions you hold yourself, and only the Super Admin can change the
 *    role they hold. A role somebody holds cannot be deleted.
 */

const BADGE_STYLES = [
    ['gold', 'Executive / Royal'],
    ['primary', 'Academic'],
    ['success', 'Faculty / Health'],
    ['info', 'Administrative'],
    ['warning', 'Finance / Audit']
];

const RolesModule = {
    catalog: null,       // { modules, permissions, scopes, defaults, ceilings, coreRoleIds }
    editing: null,       // role being edited (null for a new role)

    async loadCatalog() {
        if (this.catalog) return this.catalog;
        const res = await fetch('/api/roles/catalog', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Could not load the permission list (${res.status})`);
        this.catalog = await res.json();
        return this.catalog;
    },

    roles() {
        return (window.LmsData?.roles || []).filter(r => r.id !== 'SUPER_ADMIN');
    },

    isCore(roleId) {
        return ['ACADEMIC_ADMIN', 'TEACHER', 'STUDENT'].includes(roleId);
    },

    // Whether the signed-in user may edit this role (the server checks the same)
    canEdit(role) {
        const rbac = window.AuthRBAC;
        if (!role || role.id === 'SUPER_ADMIN' || !rbac.can('roles.update')) return false;
        return rbac.isSuperAdmin() || role.id !== rbac.getRole();
    },

    canDelete(role) {
        return this.canEdit(role) && window.AuthRBAC.can('roles.delete') && !this.isCore(role.id) && !role.userCount;
    },

    scopeLabel(scope) {
        return { ALL: 'Whole institution', TEACHING: 'Classes they teach', SELF: 'Own records only' }[scope] || scope || '—';
    },

    render() {
        const rbac = window.AuthRBAC;
        if (!rbac.can('roles.view')) {
            return `
                <div class="card" style="border: 2px solid var(--danger); text-align: center; padding: 48px 24px;">
                    <i class="fas fa-lock" style="font-size: 3rem; color: var(--danger); margin-bottom: 16px;"></i>
                    <h2 style="color: var(--primary-950); margin-bottom: 8px;">403 - Administrative Access Required</h2>
                    <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto 20px;">Your role is not allowed to see roles and permissions.</p>
                    <button class="btn btn-gold" onclick="App.navigate('dashboard')"><i class="fas fa-arrow-left"></i> Return to Dashboard</button>
                </div>`;
        }
        const all = window.LmsData?.roles || [];
        const superRole = all.find(r => r.id === 'SUPER_ADMIN') || { id: 'SUPER_ADMIN', name: 'Super Admin (Mohtamim)', urduTitle: 'حضرت مہتمم / مجلس شوریٰ', userCount: 0 };
        const roles = this.roles();
        const coreCount = roles.filter(r => this.isCore(r.id)).length;
        const permissionCount = this.catalog ? this.catalog.permissions.length : '…';
        if (!this.catalog) this.loadCatalog().then(() => { if (App.currentRoute === 'roles') App.navigate('roles', { preserveScroll: true }); }).catch(() => {});

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1><i class="fas fa-id-badge" style="color: var(--gold-400);"></i> Roles & Permissions</h1>
                    <p>Choose what each role may do and which records it covers</p>
                </div>
                <div class="view-actions">
                    ${rbac.can('roles.create') ? `<button class="btn btn-gold btn-sm" onclick="RolesModule.openRoleModal()"><i class="fas fa-plus-circle"></i> Add New Role</button>` : ''}
                </div>
            </div>

            <div class="metrics-grid">
                <div class="metric-card gold">
                    <div class="metric-icon-box" style="background: rgba(217, 119, 6, 0.2); color: var(--gold-400);"><i class="fas fa-id-card-alt"></i></div>
                    <div class="metric-content"><span class="metric-label">Total Roles</span><span class="metric-value">${roles.length + 1}</span><span class="metric-hint" style="color: var(--gold-300);">Including Super Admin</span></div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon-box" style="background: rgba(16, 185, 129, 0.2); color: var(--primary-400);"><i class="fas fa-shield-alt"></i></div>
                    <div class="metric-content"><span class="metric-label">Default Roles</span><span class="metric-value">${coreCount + 1}</span><span class="metric-hint">Cannot be deleted</span></div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon-box" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa;"><i class="fas fa-user-tag"></i></div>
                    <div class="metric-content"><span class="metric-label">Custom Roles</span><span class="metric-value">${roles.length - coreCount}</span><span class="metric-hint">Created by administrators</span></div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon-box" style="background: rgba(245, 158, 11, 0.2); color: var(--warning);"><i class="fas fa-key"></i></div>
                    <div class="metric-content"><span class="metric-label">Permissions</span><span class="metric-value">${permissionCount}</span><span class="metric-hint">Available to assign</span></div>
                </div>
            </div>

            <div class="card" style="background: linear-gradient(135deg, rgba(6, 78, 59, 0.3) 0%, rgba(217, 119, 6, 0.12) 100%); border-left: 4px solid var(--gold-400); margin-bottom: 24px;">
                <ul style="font-size: 0.85rem; color: var(--text-secondary); margin: 0; padding-left: 18px; line-height: 1.8;">
                    <li><strong>Super Admin</strong> automatically has every permission, including any added in future.</li>
                    <li><strong>Data scope</strong> decides whose records a role covers: the whole institution, the classes the person teaches, or only their own.</li>
                    <li>You can only give or take away permissions you hold yourself. Nobody but the Super Admin can change the role they hold.</li>
                    <li>Admin, Teacher and Student cannot be deleted. A custom role can be deleted once nobody holds it.</li>
                </ul>
            </div>

            <div class="card">
                <div class="card-header"><h3 class="card-title"><i class="fas fa-list-ul"></i> Roles</h3></div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr><th>Role</th><th>Description</th><th>Data scope</th><th>Permissions</th><th style="text-align: center;">Users</th><th>Type</th><th style="text-align: right;">Actions</th></tr></thead>
                        <tbody>
                            <tr>
                                <td>${this.renderRoleTitle(superRole)}</td>
                                <td style="max-width: 320px; font-size: 0.84rem; color: var(--text-secondary);">Full control of every branch, account, record and setting.</td>
                                <td>${this.scopeLabel('ALL')}</td>
                                <td><span class="status-pill success"><i class="fas fa-infinity"></i> All (automatic)</span></td>
                                <td style="text-align: center;">${this.renderUserCount(superRole.userCount || 0)}</td>
                                <td><span class="badge-pill gold"><i class="fas fa-lock" style="font-size: 0.65rem;"></i> Super Admin</span></td>
                                <td style="text-align: right; white-space: nowrap;">
                                    ${rbac.isSuperAdmin()
                                        ? `<button class="btn btn-secondary btn-sm" onclick="RolesModule.editSuperAdminProfile()"><i class="fas fa-user-edit"></i> Edit Profile</button>`
                                        : `<span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fas fa-lock"></i> Protected</span>`}
                                </td>
                            </tr>
                            ${roles.map(r => this.renderRoleRow(r)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    renderRoleTitle(r) {
        return `
            <div style="font-weight: 700; color: var(--primary-950); display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-id-badge" style="color: var(--gold-600);"></i> ${Lms.esc(r.name || r.id)}
            </div>
            <div style="font-family: 'Amiri', serif; font-size: 0.95rem; color: var(--gold-700); margin-top: 2px;">${Lms.esc(r.urduTitle || '')}</div>
            <code style="font-size: 0.72rem; color: var(--text-muted);">${Lms.esc(r.id)}</code>`;
    },

    renderUserCount(count) {
        return `<span style="display: inline-block; padding: 4px 10px; border-radius: 20px; background: var(--bg-surface-elevated); border: 1px solid var(--border-prominent); font-weight: 700; color: var(--text-primary);">${Number(count) || 0}</span>`;
    },

    renderRoleRow(r) {
        const perms = Array.isArray(r.permissions) ? r.permissions : null;
        const canEdit = this.canEdit(r);
        const own = r.id === window.AuthRBAC.getRole();
        return `
            <tr>
                <td>${this.renderRoleTitle(r)}</td>
                <td style="max-width: 320px; font-size: 0.84rem; color: var(--text-secondary);">${Lms.esc(r.description || '')}</td>
                <td style="font-size: 0.84rem;">${Lms.esc(this.scopeLabel(r.scope))}</td>
                <td><span class="status-pill"><i class="fas fa-key"></i> ${perms ? perms.length : '—'}</span>${r.status === 'INACTIVE' ? ' <span class="status-pill danger">Switched off</span>' : ''}${(r.warnings || []).length ? ` <span class="status-pill warning" title="${Lms.esc(r.warnings.map(w => w.message).join(' '))}" style="cursor: help;"><i class="fas fa-exclamation-triangle"></i> ${r.warnings.length}</span>` : ''}</td>
                <td style="text-align: center;">${this.renderUserCount(r.userCount)}</td>
                <td>${this.isCore(r.id)
                    ? `<span class="badge-pill gold"><i class="fas fa-lock" style="font-size: 0.65rem;"></i> Default</span>`
                    : `<span class="badge-pill info"><i class="fas fa-user-edit" style="font-size: 0.65rem;"></i> Custom</span>`}</td>
                <td style="text-align: right; white-space: nowrap;">
                    ${canEdit
                        ? `<button class="btn btn-secondary btn-sm" onclick="RolesModule.openRoleModal('${Lms.esc(r.id)}')"><i class="fas fa-edit"></i> Edit</button>`
                        : `<span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fas fa-lock"></i> ${own ? 'Your role' : 'View only'}</span>`}
                    ${window.AuthRBAC.can('roles.create') && perms ? `<button class="btn btn-secondary btn-sm" onclick="RolesModule.openRoleModal(null, '${Lms.esc(r.id)}')" title="Start a new role from this one" style="margin-left: 4px;"><i class="fas fa-copy"></i></button>` : ''}
                    ${window.AuthRBAC.isSuperAdmin() ? `<button class="btn btn-secondary btn-sm" onclick="AuthRBAC.startPreview('${Lms.esc(r.id)}')" title="See the portal as this role sees it (read-only)" style="margin-left: 4px;"><i class="fas fa-eye"></i></button>` : ''}
                    ${this.canDelete(r) ? `<button class="btn btn-danger btn-sm" onclick="RolesModule.deleteRole('${Lms.esc(r.id)}')" title="Delete custom role" style="margin-left: 4px;"><i class="fas fa-trash-alt"></i></button>` : ''}
                </td>
            </tr>`;
    },

    // ---------------------------------------------------------------------
    // Add / edit
    // ---------------------------------------------------------------------
    // roleId: edit that role; copyFrom: start a new role from another one's permissions
    async openRoleModal(roleId = null, copyFrom = null) {
        let catalog;
        try {
            catalog = await this.loadCatalog();
        } catch (e) {
            App.showToast(e.message, 'danger');
            return;
        }
        const isNew = !roleId;
        const source = copyFrom ? this.roles().find(r => r.id === copyFrom) : null;
        const role = !isNew ? this.roles().find(r => r.id === roleId)
            : source ? { name: `Copy of ${source.name}`, urduTitle: source.urduTitle, badgeClass: source.badgeClass, description: source.description, scope: source.scope, permissions: (source.permissions || []).slice() }
                : { scope: 'ALL', permissions: [] };
        if (!role) return App.showToast('Role not found.', 'danger');
        if (!isNew && !this.canEdit(role)) return App.showToast('You are not allowed to change this role.', 'warning');
        this.editing = isNew ? null : role;
        const label = text => `<label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">${text}</label>`;
        const scopeLocked = !isNew && this.isCore(role.id);

        Lms.openModal(
            isNew ? `<i class="fas fa-plus-circle" style="color: var(--gold-400);"></i> ${source ? `New Role from ${Lms.esc(source.name)}` : 'Add New Role'}`
                : `<i class="fas fa-edit" style="color: var(--gold-400);"></i> Edit Role: ${Lms.esc(role.name || role.id)}`,
            `<form id="form-role" onsubmit="RolesModule.handleRoleSubmit(event)">
                <div class="form-grid">
                    <div>${label('Role Name (English) *')}<input type="text" id="role-name-input" class="form-control" value="${Lms.esc(role.name || '')}" ${isNew ? 'placeholder="e.g. Examination Officer"' : ''} required></div>
                    <div>${label('Role Identifier *')}${isNew
                        ? `<input type="text" id="role-id-input" class="form-control" placeholder="e.g. EXAM_OFFICER" style="text-transform: uppercase;" required>
                           <small style="color: var(--text-muted); font-size: 0.72rem;">Capital letters, digits and _ only. Cannot be changed later.</small>`
                        : `<input type="text" class="form-control" value="${Lms.esc(role.id)}" disabled style="opacity: 0.7;">`}</div>
                    <div>${label('Urdu Title (منصب / کردار)')}<input type="text" id="role-urdu-input" class="form-control" value="${Lms.esc(role.urduTitle || '')}" style="font-family: 'Amiri', serif;"></div>
                    <div>${label('Visual Badge Style')}<select id="role-badge-input" class="form-control">${BADGE_STYLES.map(([v, t]) => `<option value="${v}" ${role.badgeClass === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
                </div>
                <div style="margin: 12px 0;">${label('Description')}<textarea id="role-desc-input" class="form-control" rows="2">${Lms.esc(role.description || '')}</textarea></div>
                <div style="margin-bottom: 16px;">${label('Data scope — whose records this role covers')}
                    <select id="role-scope-input" class="form-control" ${scopeLocked ? 'disabled' : ''}>
                        ${Object.entries(catalog.scopes).map(([k, s]) => `<option value="${k}" ${role.scope === k ? 'selected' : ''}>${Lms.esc(s.label)} — ${Lms.esc(s.description)}</option>`).join('')}
                    </select>
                    ${scopeLocked ? '<small style="color: var(--text-muted); font-size: 0.72rem;">The data scope of Admin, Teacher and Student is fixed.</small>' : ''}
                </div>
                ${this.renderPermissionChecklist(role, isNew)}
            </form>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" id="role-save-btn" onclick="document.getElementById('form-role').requestSubmit()">${isNew ? '<i class="fas fa-check-circle"></i> Create Role' : '<i class="fas fa-save"></i> Save Changes'}</button>`,
            { wide: true }
        );
        this.updateWarnings();
    },

    // Permissions grouped by module; a box is locked when the editor does not hold it (or the role may never hold it)
    renderPermissionChecklist(role, isNew) {
        const rbac = window.AuthRBAC;
        const catalog = this.catalog;
        const granted = new Set(role.permissions || []);
        const ceiling = !isNew && catalog.ceilings[role.id] ? new Set(catalog.ceilings[role.id]) : null;
        const defaults = !isNew && catalog.defaults[role.id] ? catalog.defaults[role.id] : null;
        const groups = catalog.modules.map(m => ({ ...m, perms: catalog.permissions.filter(p => p.module === m.key && (!ceiling || ceiling.has(p.key) || granted.has(p.key))) }))
            .filter(g => g.perms.length);
        const link = (text, action) => `<a href="javascript:void(0)" onclick="${action}" style="color: var(--primary-700); font-weight: 600; text-decoration: none;">${text}</a>`;

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px;">
                <label class="form-label" style="font-weight: 600; color: var(--text-primary); margin: 0;">Permissions</label>
                <div style="display: flex; gap: 14px; font-size: 0.8rem; align-items: center; flex-wrap: wrap;">
                    <input type="search" id="role-perm-search" class="form-control" placeholder="Search permissions" style="width: 200px; padding: 5px 10px;" oninput="RolesModule.filterPermissions(this.value)">
                    ${defaults ? link('Restore defaults', 'RolesModule.setChecks(\'default\')') : ''}
                    ${link('Select all', 'RolesModule.setChecks(true)')}
                    ${link('Clear all', 'RolesModule.setChecks(false)')}
                </div>
            </div>
            ${ceiling ? `<small style="display: block; color: var(--text-muted); font-size: 0.75rem; margin-bottom: 8px;">Only permissions of the ${Lms.esc(role.name || role.id)} portal can be given to this role.</small>` : ''}
            <div id="role-sod-warnings" style="margin-bottom: 8px;"></div>
            <small style="display: block; color: var(--text-muted); font-size: 0.75rem; margin-bottom: 10px;"><span class="status-pill danger" style="font-size: 0.62rem;">Sensitive</span> marks permissions that touch accounts, money, results or private records. Some permissions bring others with them (e.g. editing brings viewing).</small>
            <div id="role-perm-list" data-defaults="${Lms.esc((defaults || []).join(','))}" style="display: flex; flex-direction: column; gap: 14px; max-height: 52vh; overflow-y: auto; padding-right: 4px;">
                ${groups.map(g => `
                    <div class="role-perm-group" data-module="${Lms.esc(g.key)}">
                        <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 6px;">
                            <div><strong style="color: var(--primary-950);">${Lms.esc(g.label)}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">${Lms.esc(g.description)}</span></div>
                            <div style="font-size: 0.75rem; white-space: nowrap;">${link('All', `RolesModule.setModule('${g.key}', true)`)} · ${link('None', `RolesModule.setModule('${g.key}', false)`)}</div>
                        </div>
                        <div class="role-perm-grid">
                            ${g.perms.map(p => {
                                const holds = rbac.isSuperAdmin() || rbac.can(p.key);
                                const allowedHere = !ceiling || ceiling.has(p.key);
                                const locked = !holds || !allowedHere;
                                const why = !holds ? 'You can only change permissions you hold yourself' : (!allowedHere ? 'This role can never hold this permission' : '');
                                return `
                                    <label class="role-perm-item ${locked ? 'disabled' : ''}" data-search="${Lms.esc((p.label + ' ' + p.key + ' ' + p.description).toLowerCase())}" title="${Lms.esc(why || p.description)}">
                                        <input type="checkbox" name="role-perm" value="${Lms.esc(p.key)}" data-implies="${Lms.esc(p.implies.join(','))}" ${granted.has(p.key) ? 'checked' : ''} ${locked ? 'disabled' : ''} onchange="RolesModule.applyImplied(this)">
                                        <span style="display: flex; flex-direction: column; gap: 1px; min-width: 0;">
                                            <span>${Lms.esc(p.label)}${p.dangerous ? ' <span class="status-pill danger" style="font-size: 0.6rem; padding: 0 5px;">Sensitive</span>' : ''}</span>
                                            <code style="font-size: 0.66rem; color: var(--text-muted);">${Lms.esc(p.key)}</code>
                                        </span>
                                    </label>`;
                            }).join('')}
                        </div>
                    </div>`).join('')}
            </div>`;
    },

    boxes() {
        return Array.from(document.querySelectorAll('#form-role input[name="role-perm"]'));
    },

    // Separation of duties: warn (not block) when one role would hold both halves of a sensitive pair
    updateWarnings() {
        const box = document.getElementById('role-sod-warnings');
        if (!box || !this.catalog) return;
        const ticked = new Set(this.boxes().filter(b => b.checked).map(b => b.value));
        const hits = (this.catalog.sodPairs || []).filter(w => w.permissions.every(p => ticked.has(p)));
        box.innerHTML = hits.map(w => `<div class="status-pill warning" style="display: flex; gap: 6px; white-space: normal; margin-bottom: 4px;"><i class="fas fa-exclamation-triangle"></i> ${Lms.esc(w.message)} Consider giving these to different roles.</div>`).join('');
    },

    // Ticking a permission also ticks what it depends on (editing exams needs viewing exams)
    applyImplied(box) {
        this.updateWarnings();
        if (!box.checked) return;
        const byKey = new Map(this.boxes().map(b => [b.value, b]));
        const visit = el => (el.dataset.implies || '').split(',').filter(Boolean).forEach(k => {
            const dep = byKey.get(k);
            if (dep && !dep.checked && !dep.disabled) { dep.checked = true; visit(dep); }
        });
        visit(box);
        this.updateWarnings();
    },

    setChecks(state) {
        const defaults = (document.getElementById('role-perm-list')?.dataset.defaults || '').split(',');
        this.boxes().filter(b => !b.disabled).forEach(b => { b.checked = state === 'default' ? defaults.includes(b.value) : state; });
        this.updateWarnings();
    },

    setModule(moduleKey, state) {
        document.querySelectorAll(`#form-role .role-perm-group[data-module="${moduleKey}"] input[name="role-perm"]:not(:disabled)`).forEach(b => {
            b.checked = state;
            if (state) this.applyImplied(b);
        });
        this.updateWarnings();
    },

    filterPermissions(text) {
        const q = String(text || '').trim().toLowerCase();
        document.querySelectorAll('#form-role .role-perm-group').forEach(group => {
            let shown = 0;
            group.querySelectorAll('.role-perm-item').forEach(item => {
                const match = !q || item.dataset.search.includes(q);
                item.hidden = !match;
                if (match) shown++;
            });
            group.hidden = shown === 0;
        });
    },

    async handleRoleSubmit(e) {
        e.preventDefault();
        const isNew = !this.editing;
        const body = {
            name: Lms.val('role-name-input'),
            urduTitle: Lms.val('role-urdu-input'),
            badgeClass: Lms.val('role-badge-input'),
            description: document.getElementById('role-desc-input').value.trim(),
            scope: Lms.val('role-scope-input')
        };
        const checked = this.boxes().filter(b => b.checked).map(b => b.value);
        if (!body.name) return App.showToast('Give the role a name.', 'danger');

        let res;
        if (isNew) {
            body.id = Lms.val('role-id-input').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
            if (!body.id) return App.showToast('Give the role an identifier.', 'danger');
            // A copy starts from another role; permissions the editor does not hold stay out
            body.permissions = this.boxes().filter(b => b.checked && !b.disabled).map(b => b.value);
            res = await this.send('POST', '/api/roles', body);
        } else {
            const before = new Set(this.editing.permissions || []);
            const after = new Set(checked);
            // Locked boxes keep their stored state, so only the editor's own permissions can appear in the change
            body.add = checked.filter(k => !before.has(k));
            body.remove = Array.from(before).filter(k => !after.has(k) && !this.boxes().find(b => b.value === k && b.disabled));
            body.version = this.editing.version;
            res = await this.send('PUT', `/api/roles/${encodeURIComponent(this.editing.id)}`, body);
        }
        if (!res) return;
        App.closeModal();
        const warnings = (res.role && res.role.warnings) || [];
        App.showToast(`${isNew ? `Role '${body.name}' created. It can now be given to users.` : `Role '${body.name}' saved.`}${warnings.length ? ` Note: ${warnings.map(w => w.message).join(' ')}` : ''}`, warnings.length ? 'warning' : 'success');
        await this.afterChange();
    },

    async send(method, url, body) {
        try {
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) return data;
            App.showToast(data.error || `The change was not saved (${res.status}).`, 'danger');
            if (res.status === 409) await this.afterChange();
            return null;
        } catch (err) {
            App.showToast('The portal server cannot be reached. Please try again.', 'danger');
            return null;
        }
    },

    async afterChange() {
        await window.AuthRBAC.loadRoles();
        await window.AuthRBAC.refreshSession();
        if (App.currentRoute === 'roles') App.navigate('roles', { preserveScroll: true });
    },

    editSuperAdminProfile() {
        const users = window.LmsData?.users || [];
        const me = window.AuthRBAC.currentUser;
        const target = (me && me.role === 'SUPER_ADMIN') ? me : users.find(u => u.role === 'SUPER_ADMIN');
        if (!target || !window.UsersModule) return;
        window.location.hash = 'users';
        window.UsersModule.openEditUserModal(target.id);
    },

    deleteRole(roleId) {
        const role = this.roles().find(r => r.id === roleId);
        if (!role || !this.canDelete(role)) return App.showToast('This role cannot be deleted.', 'warning');
        Lms.openModal(
            `<i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i> Confirm Delete Role`,
            `<p style="color: var(--text-primary); margin-bottom: 12px;">Delete the custom role <strong>"${Lms.esc(role.name)}"</strong> (<code>${Lms.esc(role.id)}</code>)?</p>
             <p style="color: var(--text-muted); font-size: 0.85rem;">Nobody holds this role. It will no longer be offered when creating or editing users.</p>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-danger" onclick="RolesModule.confirmDeleteRole('${Lms.esc(roleId)}')"><i class="fas fa-trash-alt"></i> Delete Role</button>`
        );
    },

    async confirmDeleteRole(roleId) {
        const res = await this.send('DELETE', `/api/roles/${encodeURIComponent(roleId)}`);
        if (!res) return;
        App.closeModal();
        App.showToast('Role deleted.', 'info');
        await this.afterChange();
    }
};

window.RolesModule = RolesModule;
