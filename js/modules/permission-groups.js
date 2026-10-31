/**
 * JAMIA ASHRAFIA LAHORE - STUDENT TYPES & TEACHER TYPES (permission groups)
 *
 * Students and teachers do not hold system roles. Each belongs to one type (permission group) of their own
 * domain, e.g. Regular Student / Online Student or Senior Teacher / Assistant Teacher, and receives exactly the
 * permissions of that type, plus or minus any individual overrides.
 *
 * RULES (all enforced again by the server, server/roles.js and server/access-policy.js):
 * 1. Only the Super Admin creates, edits and deletes types and sets individual overrides.
 * 2. A type can only hold permissions of its portal (the domain ceiling), so it can never open office work.
 * 3. Choosing a person's type needs the Super Admin or students.assign_group / teachers.assign_group.
 * 4. The default type (the built-in Student / Teacher) cannot be deleted; another type only once it is empty.
 */

const GROUP_DOMAINS = {
    STUDENT: {
        family: 'students', route: 'student-types', accountRole: 'STUDENT', icon: 'fas fa-user-tag',
        title: 'Student Types & Permissions', thing: 'student type', add: 'Add Student Type',
        intro: 'Group students by how they study and decide what each group may do in the student portal',
        examples: 'e.g. Regular Student, Online Student', idExample: 'e.g. ONLINE_STUDENT',
        people: 'Students', ceilingNote: 'Only student portal permissions can be given to a student type.'
    },
    TEACHER: {
        family: 'teachers', route: 'teacher-types', accountRole: 'TEACHER', icon: 'fas fa-user-cog',
        title: 'Teacher Types & Permissions', thing: 'teacher type', add: 'Add Teacher Type',
        intro: 'Group teachers by their responsibilities and decide what each group may do in the teacher portal',
        examples: 'e.g. Senior Teacher, Assistant Teacher, Online Teacher', idExample: 'e.g. SENIOR_TEACHER',
        people: 'Teachers', ceilingNote: 'Only teacher portal permissions can be given to a teacher type.'
    }
};

const PermissionGroupsModule = {
    data: {},          // domain -> { groups, defaultGroup, overrides }
    loading: {},
    editing: null,     // { domain, group } while the type modal is open (group null for a new type)

    info(domain) {
        return GROUP_DOMAINS[domain];
    },

    canManage() {
        return window.AuthRBAC.isSuperAdmin();
    },

    canAssign(domain) {
        return this.canManage() || window.AuthRBAC.wide(`${this.info(domain).family}.assign_group`);
    },

    async load(domain, force) {
        if (this.data[domain] && !force) return this.data[domain];
        const res = await fetch(`/api/permission-groups/${this.info(domain).family}`, { cache: 'no-store' })
            .catch(() => { throw new Error('The portal server cannot be reached. Please try again.'); });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Could not load the types (${res.status})`);
        this.data[domain] = body;
        return body;
    },

    groups(domain) {
        const d = this.data[domain];
        return d ? d.groups : (window.LmsData?.roles || []).filter(r => r.domain === domain);
    },

    defaultGroup(domain) {
        return (this.data[domain] && this.data[domain].defaultGroup) || this.info(domain).accountRole;
    },

    group(domain, id) {
        return this.groups(domain).find(g => g.id === id) || null;
    },

    members(domain) {
        return (window.LmsData?.users || []).filter(u => u.role === this.info(domain).accountRole);
    },

    groupOf(domain, user) {
        return (user && user.permissionGroup) || this.defaultGroup(domain);
    },

    overridesOf(domain, userId) {
        const o = this.data[domain] && this.data[domain].overrides && this.data[domain].overrides[userId];
        return o || { allow: [], deny: [] };
    },

    ceiling(domain) {
        const c = RolesModule.catalog && RolesModule.catalog.domainCeilings && RolesModule.catalog.domainCeilings[domain];
        return c ? new Set(c) : null;
    },

    // A select for registration / edit forms; shown only to those who may choose the type
    typeSelect(domain, selectId, currentId) {
        if (!this.canAssign(domain)) return '';
        const groups = this.groups(domain);
        if (!groups.length) return '';
        const current = currentId || this.defaultGroup(domain);
        return `
            <div class="form-group">
                <label for="${selectId}">${I18n.t(domain === 'STUDENT' ? 'Student Type' : 'Teacher Type')}</label>
                <select id="${selectId}" class="form-control">
                    ${groups.map(g => `<option value="${Lms.esc(g.id)}" ${g.id === current ? 'selected' : ''}>${Lms.esc(Lms.localName(g.name, g.urduTitle, true))}${g.isDefault ? ` (${I18n.t('default')})` : ''}</option>`).join('')}
                </select>
                <small style="color: var(--text-muted); font-size: 0.72rem;">${I18n.t('Decides what this person may do in their portal.')}</small>
            </div>`;
    },

    // The chosen type for a record, or undefined to leave it as it is (the server keeps / defaults it)
    readTypeSelect(selectId) {
        const el = document.getElementById(selectId);
        return el ? el.value : undefined;
    },

    typeBadge(domain, user) {
        const g = this.group(domain, this.groupOf(domain, user));
        if (!g) return '';
        return `<span class="badge-pill ${Lms.esc(g.badgeClass || 'info')}" style="font-size: 0.65rem;" title="${Lms.esc(I18n.t(domain === 'STUDENT' ? 'Student Type' : 'Teacher Type'))}"><i class="fas fa-tag" style="font-size: 0.6rem;"></i> ${Lms.esc(Lms.localName(g.name, g.urduTitle, true))}</span>`;
    },

    rerender(domain) {
        if (App.currentRoute === this.info(domain).route) App.navigate(App.currentRoute, { preserveScroll: true });
    },

    // ---------------------------------------------------------------------
    // Page
    // ---------------------------------------------------------------------
    render(domain) {
        const info = this.info(domain);
        if (!this.data[domain] || !RolesModule.catalog) {
            if (!this.loading[domain]) {
                this.loading[domain] = Promise.all([this.load(domain), RolesModule.loadCatalog()])
                    .then(() => this.rerender(domain))
                    .catch(e => App.showToast(e.message, 'danger'))
                    .finally(() => { this.loading[domain] = null; });
            }
        }
        const groups = this.groups(domain);
        const members = this.members(domain);
        const manage = this.canManage();
        const permissionCount = (this.ceiling(domain) || new Set()).size || '…';

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1><i class="${info.icon}" style="color: var(--gold-400);"></i> ${I18n.t(info.title)}</h1>
                    <p>${I18n.t(info.intro)}</p>
                </div>
                <div class="view-actions">
                    ${manage ? `<button class="btn btn-gold btn-sm" onclick="PermissionGroupsModule.openGroupModal('${domain}')"><i class="fas fa-plus-circle"></i> ${I18n.t(info.add)}</button>` : ''}
                </div>
            </div>

            <div class="metrics-grid">
                <div class="metric-card gold">
                    <div class="metric-icon-box" style="background: rgba(217, 119, 6, 0.2); color: var(--gold-400);"><i class="fas fa-tags"></i></div>
                    <div class="metric-content"><span class="metric-label">Types</span><span class="metric-value">${groups.length}</span><span class="metric-hint" style="color: var(--gold-300);">${I18n.t(info.examples)}</span></div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon-box" style="background: rgba(16, 185, 129, 0.2); color: var(--primary-400);"><i class="fas fa-users"></i></div>
                    <div class="metric-content"><span class="metric-label">${I18n.t(info.people)}</span><span class="metric-value">${members.length}</span><span class="metric-hint">${I18n.t('Each belongs to one type')}</span></div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon-box" style="background: rgba(245, 158, 11, 0.2); color: var(--warning);"><i class="fas fa-key"></i></div>
                    <div class="metric-content"><span class="metric-label">Permissions</span><span class="metric-value">${permissionCount}</span><span class="metric-hint">${I18n.t('Portal permissions available')}</span></div>
                </div>
            </div>

            <div class="card" style="background: linear-gradient(135deg, rgba(6, 78, 59, 0.3) 0%, rgba(217, 119, 6, 0.12) 100%); border-inline-start: 4px solid var(--gold-400); margin-bottom: 24px;">
                <ul style="font-size: 0.85rem; color: var(--text-secondary); margin: 0; padding-inline-start: 18px; line-height: 1.8;">
                    <li>${I18n.t('Every person receives the permissions of their type. Individual permissions can add to or take away from it.')}</li>
                    <li>${I18n.t(info.ceilingNote)} ${I18n.t('These permissions never give access to system user management or other office work.')}</li>
                    <li>${I18n.t('Only the Super Admin creates and changes types and individual permissions.')}</li>
                    <li>${I18n.t('The default type cannot be deleted. Another type can be deleted once nobody belongs to it.')}</li>
                </ul>
            </div>

            <div class="card" style="margin-bottom: 24px;">
                <div class="card-header"><h3 class="card-title"><i class="fas fa-list-ul"></i> ${I18n.t('Types')}</h3></div>
                ${groups.length > 1 ? Lms.filterBar(`types-table-${domain}`, { search: 'Search type name, id or description...' }) : ''}
                <div class="table-responsive">
                    <table class="data-table" id="types-table-${domain}">
                        <thead><tr><th>Type</th><th>Description</th><th>Permissions</th><th style="text-align: center;">${I18n.t(info.people)}</th><th style="text-align: end;">Actions</th></tr></thead>
                        <tbody>${groups.length ? groups.map(g => this.renderGroupRow(domain, g)).join('') : `<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--text-muted);">${I18n.t('Loading…')}</td></tr>`}</tbody>
                    </table>
                </div>
            </div>

            ${this.renderMembers(domain, members)}
        `;
    },

    renderGroupRow(domain, g) {
        const perms = Array.isArray(g.permissions) ? g.permissions : null;
        const manage = this.canManage();
        return `
            <tr>
                <td>
                    <div style="font-weight: 700; color: var(--primary-950); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span class="badge-pill ${Lms.esc(g.badgeClass || 'info')}">${Lms.esc(Lms.localName(g.name, g.urduTitle, true))}</span>
                        ${g.isDefault ? `<span class="badge-pill gold" style="font-size: 0.62rem;"><i class="fas fa-lock" style="font-size: 0.6rem;"></i> ${I18n.t('Default')}</span>` : ''}
                    </div>
                    <code style="font-size: 0.72rem; color: var(--text-muted);">${Lms.esc(g.id)}</code>
                </td>
                <td style="max-width: 340px; font-size: 0.84rem; color: var(--text-secondary);">${Lms.esc(g.description || '')}</td>
                <td><span class="status-pill"><i class="fas fa-key"></i> ${perms ? perms.length : '—'}</span></td>
                <td style="text-align: center;">${RolesModule.renderUserCount(g.userCount)}</td>
                <td style="text-align: end; white-space: nowrap;">
                    ${manage ? `<button class="btn btn-secondary btn-sm" onclick="PermissionGroupsModule.openGroupModal('${domain}', '${Lms.esc(g.id)}')"><i class="fas fa-edit"></i> Edit</button>
                        <button class="btn btn-secondary btn-sm" onclick="PermissionGroupsModule.openGroupModal('${domain}', null, '${Lms.esc(g.id)}')" title="${Lms.esc(I18n.t('Start a new type from this one'))}" style="margin-inline-start: 4px;"><i class="fas fa-copy"></i></button>
                        <button class="btn btn-secondary btn-sm" onclick="AuthRBAC.startPreview('${Lms.esc(g.id)}')" title="See the portal as this role sees it (read-only)" style="margin-inline-start: 4px;"><i class="fas fa-eye"></i></button>`
                        : `<span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fas fa-lock"></i> View only</span>`}
                    ${manage && !g.isDefault && !g.userCount ? `<button class="btn btn-danger btn-sm" onclick="PermissionGroupsModule.deleteGroup('${domain}', '${Lms.esc(g.id)}')" title="${Lms.esc(I18n.t('Delete type'))}" style="margin-inline-start: 4px;"><i class="fas fa-trash-alt"></i></button>` : ''}
                </td>
            </tr>`;
    },

    renderMembers(domain, members) {
        const info = this.info(domain);
        const shown = members;
        const canAssign = this.canAssign(domain);
        const manage = this.canManage();
        const groups = this.groups(domain);
        return `
            <div class="card">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <h3 class="card-title"><i class="fas fa-user-check"></i> ${I18n.t(domain === 'STUDENT' ? 'Students and their types' : 'Teachers and their types')}</h3>
                </div>
                ${Lms.filterBar(`type-members-table-${domain}`, {
                    search: 'Search by name, roll number or email',
                    selects: [
                        { key: 'type', label: 'All types', options: groups.map(g => [g.id, Lms.localName(g.name, g.urduTitle, true)]) },
                        { key: 'custom', label: 'With or without individual permissions', options: [['YES', 'Has individual permissions'], ['NO', 'As the type']] },
                        domain === 'STUDENT' ? Lms.classFilter() : null,
                        Lms.campusFilter()
                    ]
                })}
                <div class="table-responsive">
                    <table class="data-table" id="type-members-table-${domain}">
                        <thead><tr><th>${I18n.t(domain === 'STUDENT' ? 'Student' : 'Teacher')}</th><th>${I18n.t('Type')}</th><th>${I18n.t('Individual permissions')}</th><th style="text-align: end;">Actions</th></tr></thead>
                        <tbody>
                            ${shown.length ? shown.map(u => {
                                const o = this.overridesOf(domain, u.id);
                                const current = this.groupOf(domain, u);
                                return `
                                <tr data-f-type="${Lms.esc(current || '')}" data-f-custom="${o.allow.length || o.deny.length ? 'YES' : 'NO'}" data-f-class="${Lms.esc(u.classId || '')}"
                                    data-f-campus="${Lms.campusValues(u)}" data-f-search="${Lms.esc([u.email, u.rollNo].filter(Boolean).join(' '))}">
                                    <td>
                                        <div style="font-weight: 700; color: var(--primary-950);">${Lms.esc(Lms.localName(u.name, u.urduName))}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-muted);">${Lms.esc(domain === 'STUDENT' ? [u.rollNo, (Lms.getClass(u.classId) || {}).name].filter(Boolean).join(' • ') : (u.designation || u.email || ''))}</div>
                                    </td>
                                    <td>${canAssign
                                        ? `<select class="form-control" style="width: auto; min-width: 170px; padding: 4px 8px;" onchange="PermissionGroupsModule.changeMemberGroup('${domain}', '${Lms.esc(u.id)}', this.value, this)">
                                            ${groups.map(g => `<option value="${Lms.esc(g.id)}" ${g.id === current ? 'selected' : ''}>${Lms.esc(Lms.localName(g.name, g.urduTitle, true))}</option>`).join('')}
                                           </select>`
                                        : this.typeBadge(domain, u)}</td>
                                    <td>${o.allow.length || o.deny.length
                                        ? `${o.allow.length ? `<span class="status-pill success" title="${Lms.esc(o.allow.join(', '))}">+${o.allow.length}</span>` : ''} ${o.deny.length ? `<span class="status-pill danger" title="${Lms.esc(o.deny.join(', '))}">−${o.deny.length}</span>` : ''}`
                                        : `<span style="font-size: 0.8rem; color: var(--text-muted);">${I18n.t('As the type')}</span>`}</td>
                                    <td style="text-align: end; white-space: nowrap;">
                                        ${manage ? `<button class="btn btn-secondary btn-sm" onclick="PermissionGroupsModule.openMemberModal('${domain}', '${Lms.esc(u.id)}')"><i class="fas fa-sliders-h"></i> ${I18n.t('Permissions')}</button>` : ''}
                                    </td>
                                </tr>`;
                            }).join('') : `<tr><td colspan="4" style="text-align: center; padding: 30px; color: var(--text-muted);">${I18n.t((domain === 'STUDENT' ? 'No students registered yet.' : 'No teachers registered yet.'))}</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>`;
    },

    // ---------------------------------------------------------------------
    // Add / edit a type
    // ---------------------------------------------------------------------
    async openGroupModal(domain, groupId = null, copyFrom = null) {
        if (!this.canManage()) return App.showToast('Only the Super Admin can change types.', 'warning');
        try {
            await Promise.all([RolesModule.loadCatalog(), this.load(domain)]);
        } catch (e) {
            App.showToast(e.message, 'danger');
            return;
        }
        const info = this.info(domain);
        const isNew = !groupId;
        const source = copyFrom ? this.group(domain, copyFrom) : null;
        const group = !isNew ? this.group(domain, groupId)
            : source ? { name: `Copy of ${source.name}`, urduTitle: source.urduTitle, badgeClass: source.badgeClass, description: source.description, permissions: (source.permissions || []).slice() }
                : { permissions: [] };
        if (!group) return App.showToast('Type not found.', 'danger');
        this.editing = { domain, group: isNew ? null : group };
        const label = text => `<label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">${text}</label>`;
        const defaults = RolesModule.catalog.defaults[info.accountRole] || null;

        Lms.openModal(
            isNew ? `<i class="fas fa-plus-circle" style="color: var(--gold-400);"></i> ${I18n.t(info.add)}`
                : `<i class="fas fa-edit" style="color: var(--gold-400);"></i> ${I18n.t('Edit type: {name}', { name: Lms.esc(group.name || group.id) })}`,
            `<form id="form-role" onsubmit="PermissionGroupsModule.handleGroupSubmit(event)">
                <div class="form-grid">
                    <div>${label(`${I18n.t('Type Name (English)')} *`)}<input type="text" id="role-name-input" class="form-control" value="${Lms.esc(group.name || '')}" placeholder="${Lms.esc(I18n.t(info.examples))}" required></div>
                    <div>${label(`${I18n.t('Identifier')} *`)}${isNew
                        ? `<input type="text" id="role-id-input" class="form-control" placeholder="${Lms.esc(info.idExample)}" style="text-transform: uppercase;" required>
                           <small style="color: var(--text-muted); font-size: 0.72rem;">Capital letters, digits and _ only. Cannot be changed later.</small>`
                        : `<input type="text" class="form-control" value="${Lms.esc(group.id)}" disabled style="opacity: 0.7;">`}</div>
                    <div>${label('Urdu Title')}<input type="text" id="role-urdu-input" class="form-control" value="${Lms.esc(group.urduTitle || '')}" style="font-family: 'Amiri', serif;"></div>
                    ${domain === 'STUDENT' ? '' : `<div>${label('Visual Badge Style')}<select id="role-badge-input" class="form-control">${BADGE_STYLES.map(([v, t]) => `<option value="${v}" ${group.badgeClass === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`}
                </div>
                <div style="margin: 12px 0 16px;">${label('Description')}<textarea id="role-desc-input" class="form-control" rows="2">${Lms.esc(group.description || '')}</textarea></div>
                ${RolesModule.renderPermissionChecklist(group, isNew, { ceiling: this.ceiling(domain), defaults, ceilingNote: I18n.t(info.ceilingNote) })}
            </form>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="document.getElementById('form-role').requestSubmit()">${isNew ? `<i class="fas fa-check-circle"></i> ${I18n.t('Create Type')}` : '<i class="fas fa-save"></i> Save Changes'}</button>`,
            { wide: true }
        );
        RolesModule.updateWarnings();
    },

    async handleGroupSubmit(e) {
        e.preventDefault();
        const { domain, group } = this.editing || {};
        if (!domain) return;
        const family = this.info(domain).family;
        const body = {
            name: Lms.val('role-name-input'),
            urduTitle: Lms.val('role-urdu-input'),
            badgeClass: Lms.val('role-badge-input') || (group && group.badgeClass) || 'info',
            description: document.getElementById('role-desc-input').value.trim()
        };
        if (!body.name) return App.showToast('Give the type a name.', 'danger');
        const checked = RolesModule.boxes().filter(b => b.checked && !b.disabled).map(b => b.value);
        let res;
        if (!group) {
            body.id = Lms.val('role-id-input').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
            if (!body.id) return App.showToast('Give the type an identifier.', 'danger');
            body.permissions = checked;
            res = await RolesModule.send('POST', `/api/permission-groups/${family}`, body);
        } else {
            const before = new Set(group.permissions || []);
            const after = new Set(checked);
            body.add = checked.filter(k => !before.has(k));
            body.remove = Array.from(before).filter(k => !after.has(k) && !RolesModule.boxes().find(b => b.value === k && b.disabled));
            body.version = group.version;
            res = await RolesModule.send('PUT', `/api/permission-groups/${family}/${encodeURIComponent(group.id)}`, body);
        }
        if (!res) {
            await this.afterChange(domain);
            return;
        }
        App.closeModal();
        App.showToast(group ? I18n.t('Type {name} saved.', { name: body.name }) : I18n.t('Type {name} created.', { name: body.name }), 'success');
        await this.afterChange(domain);
    },

    async afterChange(domain) {
        await this.load(domain, true).catch(() => {});
        await window.AuthRBAC.loadRoles();
        this.rerender(domain);
    },

    deleteGroup(domain, groupId) {
        const g = this.group(domain, groupId);
        if (!g || g.isDefault || g.userCount) return App.showToast('This type cannot be deleted while people belong to it.', 'warning');
        Lms.openModal(
            `<i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i> ${I18n.t('Delete type')}`,
            `<p style="color: var(--text-primary);">${I18n.t('Delete the type {name} ({id})? Nobody belongs to it.', { name: `<strong>"${Lms.esc(g.name)}"</strong>`, id: `<code>${Lms.esc(g.id)}</code>` })}</p>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-danger" onclick="PermissionGroupsModule.confirmDeleteGroup('${domain}', '${Lms.esc(groupId)}')"><i class="fas fa-trash-alt"></i> ${I18n.t('Delete type')}</button>`
        );
    },

    async confirmDeleteGroup(domain, groupId) {
        const res = await RolesModule.send('DELETE', `/api/permission-groups/${this.info(domain).family}/${encodeURIComponent(groupId)}`);
        if (!res) return;
        App.closeModal();
        App.showToast('Type deleted.', 'info');
        await this.afterChange(domain);
    },

    // ---------------------------------------------------------------------
    // A person's type and individual permissions
    // ---------------------------------------------------------------------
    async changeMemberGroup(domain, userId, groupId, selectEl) {
        const user = Lms.user(userId);
        if (!user) return;
        const previous = this.groupOf(domain, user);
        if (groupId === previous) return;
        if (selectEl) selectEl.disabled = true;
        if (this.canManage()) {
            const res = await RolesModule.send('PUT', `/api/permission-groups/${this.info(domain).family}/members/${encodeURIComponent(userId)}`, { group: groupId });
            if (res) user.permissionGroup = groupId;
        } else {
            // Through the account record (the server checks the assign permission and keeps the old type if refused)
            user.permissionGroup = groupId;
            Lms.save();
            await window.DataStore.syncNow();
        }
        await this.afterChange(domain);
        const now = Lms.user(userId);
        if (now && this.groupOf(domain, now) === groupId) {
            App.showToast(I18n.t('{name} is now {type}.', { name: now.name, type: (this.group(domain, groupId) || {}).name || groupId }), 'success');
        }
    },

    async openMemberModal(domain, userId) {
        if (!this.canManage()) return;
        try {
            await Promise.all([RolesModule.loadCatalog(), this.load(domain, true)]);
        } catch (e) {
            App.showToast(e.message, 'danger');
            return;
        }
        const user = Lms.user(userId);
        if (!user) return;
        const catalog = RolesModule.catalog;
        const ceiling = this.ceiling(domain) || new Set();
        const o = this.overridesOf(domain, userId);
        const current = this.groupOf(domain, user);
        const groups = this.groups(domain);
        const modules = catalog.modules.map(m => ({ ...m, perms: catalog.permissions.filter(p => p.module === m.key && ceiling.has(p.key)) })).filter(m => m.perms.length);
        const effect = k => o.allow.includes(k) ? 'ALLOW' : (o.deny.includes(k) ? 'DENY' : '');

        Lms.openModal(
            `<i class="fas fa-sliders-h" style="color: var(--gold-400);"></i> ${I18n.t('Permissions of {name}', { name: Lms.esc(user.name) })}`,
            `<form id="form-member-perms" onsubmit="PermissionGroupsModule.saveMember(event, '${domain}', '${Lms.esc(userId)}')">
                <div class="form-group">
                    <label for="member-group">${I18n.t(domain === 'STUDENT' ? 'Student Type' : 'Teacher Type')}</label>
                    <select id="member-group" class="form-control" onchange="PermissionGroupsModule.refreshMemberMarks('${domain}')">
                        ${groups.map(g => `<option value="${Lms.esc(g.id)}" ${g.id === current ? 'selected' : ''}>${Lms.esc(Lms.localName(g.name, g.urduTitle, true))}</option>`).join('')}
                    </select>
                </div>
                <small style="display: block; color: var(--text-muted); font-size: 0.75rem; margin-bottom: 10px;">${I18n.t('Leave a permission on "As the type" unless this person needs an exception. "Allow" adds it, "Deny" takes it away even if the type has it.')}</small>
                <div style="display: flex; flex-direction: column; gap: 14px; max-height: 52vh; overflow-y: auto; padding-inline-end: 4px;">
                    ${modules.map(m => `
                        <div>
                            <strong style="color: var(--primary-950);">${Lms.esc(m.label)}</strong>
                            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
                                ${m.perms.map(p => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 6px 10px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
                                        <span style="display: flex; flex-direction: column; min-width: 0;">
                                            <span>${Lms.esc(p.label)} <span class="member-type-mark" data-perm="${Lms.esc(p.key)}" style="font-size: 0.7rem;"></span></span>
                                            <code style="font-size: 0.66rem; color: var(--text-muted);">${Lms.esc(p.key)}</code>
                                        </span>
                                        <select class="form-control member-override" data-perm="${Lms.esc(p.key)}" style="width: auto; min-width: 130px; padding: 3px 8px;">
                                            <option value="" ${!effect(p.key) ? 'selected' : ''}>${I18n.t('As the type')}</option>
                                            <option value="ALLOW" ${effect(p.key) === 'ALLOW' ? 'selected' : ''}>${I18n.t('Allow')}</option>
                                            <option value="DENY" ${effect(p.key) === 'DENY' ? 'selected' : ''}>${I18n.t('Deny')}</option>
                                        </select>
                                    </div>`).join('')}
                            </div>
                        </div>`).join('')}
                </div>
            </form>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="document.getElementById('form-member-perms').requestSubmit()"><i class="fas fa-save"></i> Save Changes</button>`,
            { wide: true }
        );
        this.refreshMemberMarks(domain);
    },

    // Shows beside each permission whether the chosen type already has it
    refreshMemberMarks(domain) {
        const g = this.group(domain, Lms.val('member-group'));
        const has = new Set((g && g.permissions) || []);
        document.querySelectorAll('#form-member-perms .member-type-mark').forEach(el => {
            const inType = has.has(el.dataset.perm);
            el.innerHTML = inType ? `<i class="fas fa-check" style="color: var(--success);"></i> ${I18n.t('in type')}` : '';
        });
    },

    async saveMember(e, domain, userId) {
        e.preventDefault();
        const allow = [];
        const deny = [];
        document.querySelectorAll('#form-member-perms .member-override').forEach(s => {
            if (s.value === 'ALLOW') allow.push(s.dataset.perm);
            if (s.value === 'DENY') deny.push(s.dataset.perm);
        });
        const group = Lms.val('member-group');
        const res = await RolesModule.send('PUT', `/api/permission-groups/${this.info(domain).family}/members/${encodeURIComponent(userId)}`, { group, allow, deny });
        if (!res) return;
        const user = Lms.user(userId);
        if (user) user.permissionGroup = group;
        App.closeModal();
        App.showToast(I18n.t('Permissions of {name} saved.', { name: (user && user.name) || userId }), 'success');
        await this.afterChange(domain);
    }
};

window.PermissionGroupsModule = PermissionGroupsModule;
