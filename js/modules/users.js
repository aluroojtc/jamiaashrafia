/**
 * JAMIA ASHRAFIA LAHORE - SYSTEM USERS MANAGEMENT MODULE
 * Manages SYSTEM & APPLICATION users (Super Admin, Academic Admins, Accountants, and custom administrative staff).
 * NOTE: Students and Teachers are excluded from this registry as they are managed via their dedicated
 * Students Management (#students) and Teachers & Portals (#teachers) modules.
 */

const UsersModule = {
    searchTerm: '',
    roleFilter: 'ALL',
    statusFilter: 'ALL',

    // Helper: Returns only system users (excludes Students and Teachers)
    getSystemUsers() {
        return (window.LmsData?.users || []).filter(u => u.role !== 'STUDENT' && u.role !== 'TEACHER');
    },

    // Helper: Returns only assignable system roles (excludes STUDENT and TEACHER)
    getSystemRoles() {
        return (window.LmsData?.roles || []).filter(r => r.id !== 'STUDENT' && r.id !== 'TEACHER');
    },

    render() {
        const user = window.AuthRBAC.currentUser;
        const currentRole = window.AuthRBAC.getRole();

        // RBAC Guard: Only Super Admin can view or manage system users
        if (currentRole !== 'SUPER_ADMIN') {
            return `
                <div class="card" style="border: 2px solid var(--danger); text-align: center; padding: 48px 24px;">
                    <i class="fas fa-lock" style="font-size: 3rem; color: var(--danger); margin-bottom: 16px;"></i>
                    <h2 style="color: #ffffff; margin-bottom: 8px;">403 - Administrative Access Required</h2>
                    <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto 20px;">
                        Only the Super Admin (Mohtamim) has authorization to inspect and manage system user credentials for Jamia Ashrafia LMS.
                    </p>
                    <button class="btn btn-gold" onclick="App.navigate('dashboard')">
                        <i class="fas fa-arrow-left"></i> Return to Dashboard
                    </button>
                </div>
            `;
        }

        const systemUsers = this.getSystemUsers();
        const systemRoles = this.getSystemRoles();

        // Filter system users based on search and filters
        const filtered = systemUsers.filter(u => {
            const matchesSearch = !this.searchTerm || 
                (u.name && u.name.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
                (u.urduName && u.urduName.includes(this.searchTerm)) ||
                (u.email && u.email.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
                (u.id && u.id.toLowerCase().includes(this.searchTerm.toLowerCase()));

            const matchesRole = this.roleFilter === 'ALL' || u.role === this.roleFilter;
            const matchesStatus = this.statusFilter === 'ALL' || (u.status || 'ACTIVE') === this.statusFilter;

            return matchesSearch && matchesRole && matchesStatus;
        });

        // Compute KPIs for system users
        const totalSystemUsers = systemUsers.length;
        const activeSystemUsers = systemUsers.filter(u => (u.status || 'ACTIVE') === 'ACTIVE').length;
        const adminOfficers = systemUsers.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'ACADEMIC_ADMIN').length;
        const staffFinance = systemUsers.filter(u => u.role !== 'SUPER_ADMIN' && u.role !== 'ACADEMIC_ADMIN').length;

        return `
            <!-- HEADER -->
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-users-cog" style="color: var(--primary-400);"></i>
                        System Users & Account Management
                    </h1>
                    <p>Manage administrative, finance, and operational staff user accounts, role bindings, and security credentials</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-secondary btn-sm" onclick="UsersModule.exportCSV()">
                        <i class="fas fa-file-csv"></i> Export Users CSV
                    </button>
                    <button class="btn btn-gold btn-sm" onclick="UsersModule.openAddUserModal()">
                        <i class="fas fa-user-plus"></i> Add New System User
                    </button>
                </div>
            </div>

            <!-- REGISTRY SCOPE NOTICE BANNER -->
            <div class="card" style="background: linear-gradient(135deg, rgba(6, 78, 59, 0.25) 0%, rgba(30, 58, 138, 0.2) 100%); border-left: 4px solid var(--primary-400); margin-bottom: 22px; padding: 14px 18px;">
                <div style="display: flex; gap: 14px; align-items: center;">
                    <div style="font-size: 1.6rem; color: var(--primary-400);"><i class="fas fa-shield-alt"></i></div>
                    <div>
                        <h4 style="color: #ffffff; margin-bottom: 2px; font-size: 0.95rem;">Administrative & Application Users Registry</h4>
                        <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0; line-height: 1.5;">
                            This directory is reserved for application administrators, finance officers, and custom operational accounts. 
                            <strong>Students</strong> and <strong>Teachers</strong> are managed in their dedicated academic portals: 
                            <a href="#students" style="color: var(--gold-300); font-weight: 600; text-decoration: underline;">Students Management</a> and 
                            <a href="#teachers" style="color: var(--gold-300); font-weight: 600; text-decoration: underline;">Teachers & Portals</a>.
                        </p>
                    </div>
                </div>
            </div>

            <!-- KPI METRICS -->
            <div class="metrics-grid">
                <div class="metric-card gold">
                    <div class="metric-icon-box" style="background: rgba(217, 119, 6, 0.2); color: var(--gold-400);"><i class="fas fa-user-shield"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">System Users</span>
                        <span class="metric-value">${totalSystemUsers} Accounts</span>
                        <span class="metric-hint" style="color: var(--gold-300);">${filtered.length} Displayed</span>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon-box" style="background: rgba(16, 185, 129, 0.2); color: var(--success);"><i class="fas fa-check-circle"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Active Credentials</span>
                        <span class="metric-value">${activeSystemUsers} Active</span>
                        <span class="metric-hint">Sign-In Permitted</span>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon-box" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa;"><i class="fas fa-crown"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Executive Officers</span>
                        <span class="metric-value">${adminOfficers} Leadership</span>
                        <span class="metric-hint">Mohtamim & Taleemat</span>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon-box" style="background: rgba(245, 158, 11, 0.2); color: var(--warning);"><i class="fas fa-id-card"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Finance & Operations</span>
                        <span class="metric-value">${staffFinance} Staff</span>
                        <span class="metric-hint">Maliyat & Departmental</span>
                    </div>
                </div>
            </div>

            <!-- SEARCH & FILTERS TOOLBAR -->
            <div class="card" style="padding: 16px 20px; margin-bottom: 20px;">
                <div style="display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: space-between;">
                    <div class="search-input-wrap" style="flex: 1; min-width: 260px; max-width: 450px;">
                        <i class="fas fa-search"></i>
                        <input type="text" class="form-control" placeholder="Search by name, Urdu, email, or user ID..." 
                               value="${this.searchTerm}" 
                               oninput="UsersModule.handleSearch(this.value)">
                    </div>

                    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                        <label style="font-size: 0.85rem; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-filter"></i> System Role:
                        </label>
                        <select class="form-control" style="width: auto; min-width: 170px;" onchange="UsersModule.handleRoleFilter(this.value)">
                            <option value="ALL" ${this.roleFilter === 'ALL' ? 'selected' : ''}>All Roles (${systemRoles.length})</option>
                            ${systemRoles.map(r => `
                                <option value="${r.id}" ${this.roleFilter === r.id ? 'selected' : ''}>
                                    ${r.name || r.title}
                                </option>
                            `).join('')}
                        </select>

                        <label style="font-size: 0.85rem; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; margin-left: 6px;">
                            Status:
                        </label>
                        <select class="form-control" style="width: auto; min-width: 130px;" onchange="UsersModule.handleStatusFilter(this.value)">
                            <option value="ALL" ${this.statusFilter === 'ALL' ? 'selected' : ''}>All Statuses</option>
                            <option value="ACTIVE" ${this.statusFilter === 'ACTIVE' ? 'selected' : ''}>Active</option>
                            <option value="INACTIVE" ${this.statusFilter === 'INACTIVE' ? 'selected' : ''}>Inactive</option>
                        </select>

                        ${(this.searchTerm || this.roleFilter !== 'ALL' || this.statusFilter !== 'ALL') ? `
                            <button class="btn btn-secondary btn-sm" onclick="UsersModule.resetFilters()">
                                <i class="fas fa-times"></i> Clear Filters
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- SYSTEM USERS TABLE -->
            <div class="card">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 class="card-title"><i class="fas fa-address-book"></i> Application Users Registry</h3>
                    <span style="font-size: 0.82rem; color: var(--text-muted);">
                        Showing ${filtered.length} of ${systemUsers.length} system users
                    </span>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>System User</th>
                                <th>Email / Login ID</th>
                                <th>Assigned Role</th>
                                <th>Department / Title</th>
                                <th style="text-align: center;">Status</th>
                                <th style="text-align: right;">Administrative Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.length === 0 ? `
                                <tr>
                                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
                                        <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                                        No system users matching the active search or filters.
                                    </td>
                                </tr>
                            ` : filtered.map(u => {
                                const roleObj = systemRoles.find(r => r.id === u.role) || { name: u.role, badgeClass: 'primary' };
                                const badgeClass = roleObj.badgeClass || 'gold';
                                const roleName = roleObj.name || roleObj.title || u.role;
                                const isCurrentLoggedIn = (window.AuthRBAC.currentUser && window.AuthRBAC.currentUser.id === u.id);
                                const status = u.status || 'ACTIVE';

                                return `
                                    <tr>
                                        <td>
                                            <div style="display: flex; align-items: center; gap: 12px;">
                                                <div class="user-avatar" style="width: 38px; height: 38px; font-size: 0.82rem; background: linear-gradient(135deg, var(--primary-600), var(--gold-600));">
                                                    ${u.avatar || u.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style="font-weight: 700; color: #ffffff; display: flex; align-items: center; gap: 6px;">
                                                        ${u.name}
                                                        ${isCurrentLoggedIn ? `<span class="badge-pill gold" style="font-size: 0.65rem; padding: 1px 6px;">You</span>` : ''}
                                                    </div>
                                                    ${u.urduName ? `
                                                        <div style="font-family: 'Amiri', serif; font-size: 0.95rem; color: var(--gold-300);">
                                                            ${u.urduName}
                                                        </div>
                                                    ` : ''}
                                                    <div style="font-size: 0.75rem; color: var(--text-muted);">ID: ${u.id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style="font-family: monospace; font-size: 0.85rem; color: var(--text-primary); font-weight: 600;">
                                                ${u.email}
                                            </div>
                                        </td>
                                        <td>
                                            <span class="badge-pill ${badgeClass}">
                                                ${roleName}
                                            </span>
                                            <div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace; margin-top: 3px;">
                                                ${u.role}
                                            </div>
                                        </td>
                                        <td style="font-size: 0.85rem; color: var(--text-secondary); max-width: 220px;">
                                            ${u.designation || 'Institutional Officer'}
                                        </td>
                                        <td style="text-align: center;">
                                            <button onclick="UsersModule.toggleStatus('${u.id}')" 
                                                    class="status-pill ${status === 'ACTIVE' ? 'success' : 'danger'}" 
                                                    style="cursor: pointer; background: ${status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.22)' : 'rgba(239, 68, 68, 0.22)'}; color: ${status === 'ACTIVE' ? '#34d399' : '#f87171'}; border: 1px solid ${status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)'}; padding: 5px 12px; font-weight: 700; font-size: 0.78rem;" 
                                                    title="Click to toggle account status (ACTIVE / INACTIVE)">
                                                <i class="fas ${status === 'ACTIVE' ? 'fa-check-circle' : 'fa-ban'}" style="margin-right: 4px;"></i>
                                                ${status}
                                            </button>
                                        </td>
                                        <td style="text-align: right; white-space: nowrap;">
                                            <button class="btn btn-secondary btn-sm" onclick="UsersModule.openEditUserModal('${u.id}')" title="Edit User & Role">
                                                <i class="fas fa-edit"></i> Edit
                                            </button>
                                            <button class="btn btn-secondary btn-sm" onclick="UsersModule.openResetPasswordModal('${u.id}')" title="Reset User Password" style="margin-left: 4px;">
                                                <i class="fas fa-key"></i> Password
                                            </button>
                                            ${!isCurrentLoggedIn ? `
                                                <button class="btn btn-danger btn-sm" onclick="UsersModule.deleteUser('${u.id}')" title="Delete User" style="margin-left: 4px;">
                                                    <i class="fas fa-trash-alt"></i>
                                                </button>
                                            ` : ''}
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

    handleSearch(query) {
        this.searchTerm = query.trim();
        document.getElementById('main-viewport').innerHTML = this.render();
    },

    handleRoleFilter(roleKey) {
        this.roleFilter = roleKey;
        document.getElementById('main-viewport').innerHTML = this.render();
    },

    handleStatusFilter(status) {
        this.statusFilter = status;
        document.getElementById('main-viewport').innerHTML = this.render();
    },

    resetFilters() {
        this.searchTerm = '';
        this.roleFilter = 'ALL';
        this.statusFilter = 'ALL';
        document.getElementById('main-viewport').innerHTML = this.render();
    },

    // ADD USER MODAL
    openAddUserModal() {
        const systemRoles = this.getSystemRoles();
        const modalContainer = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        const modalFooter = document.getElementById('modal-footer-container');

        modalTitle.innerHTML = `<i class="fas fa-user-plus" style="color: var(--gold-400);"></i> Add New System User`;

        modalContainer.innerHTML = `
            <form id="form-add-user" onsubmit="UsersModule.handleAddUserSubmit(event)">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Full Name (English) *
                        </label>
                        <input type="text" id="add-user-name" class="form-control" placeholder="e.g. Maulana Abdul Samad" required>
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Urdu Name (نام شریف)
                        </label>
                        <input type="text" id="add-user-urdu" class="form-control" placeholder="e.g. مولانا عبد الصمد" style="font-family: 'Amiri', serif;">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Email Address / Login ID *
                        </label>
                        <input type="email" id="add-user-email" class="form-control" placeholder="e.g. samad@jamiaashrafia.org" required>
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Assigned System Role *
                        </label>
                        <select id="add-user-role" class="form-control" required>
                            <option value="" disabled selected>-- Select System Role --</option>
                            ${systemRoles.map(r => `
                                <option value="${r.id}">${r.name || r.title} (${r.urduTitle || r.id})</option>
                            `).join('')}
                        </select>
                        <small style="color: var(--text-muted); font-size: 0.72rem;">Roles dynamically configured in Users & Permissions &rarr; Roles</small>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Designation / Office Title
                        </label>
                        <input type="text" id="add-user-desig" class="form-control" placeholder="e.g. Assistant Controller / Finance Officer">
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Account Status
                        </label>
                        <select id="add-user-status" class="form-control">
                            <option value="ACTIVE" selected>ACTIVE (Can Sign In)</option>
                            <option value="INACTIVE">INACTIVE (Access Suspended)</option>
                        </select>
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                        Initial Password *
                    </label>
                    <input type="text" id="add-user-pwd" class="form-control" value="ashrafia123" required>
                    <small style="color: var(--text-muted); font-size: 0.72rem;">User can sign in with this password immediately</small>
                </div>
            </form>
        `;

        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn-gold" onclick="document.getElementById('form-add-user').requestSubmit()">
                <i class="fas fa-check-circle"></i> Create System User Account
            </button>
        `;

        App.openModal();
    },

    handleAddUserSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('add-user-name').value.trim();
        const urduName = document.getElementById('add-user-urdu').value.trim();
        const email = document.getElementById('add-user-email').value.trim().toLowerCase();
        const role = document.getElementById('add-user-role').value;
        const designation = document.getElementById('add-user-desig').value.trim();
        const status = document.getElementById('add-user-status').value;
        const password = document.getElementById('add-user-pwd').value.trim();

        if (!name || !email || !role || !password) {
            App.showToast("Please fill in all required fields.", "danger");
            return;
        }

        const allUsers = window.LmsData?.users || [];
        if (allUsers.some(u => u.email.toLowerCase() === email)) {
            App.showToast(`A user with email '${email}' already exists.`, "warning");
            return;
        }

        // Generate Initials Avatar
        const avatar = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'JA';
        const id = 'u_' + Date.now();

        const newUser = {
            id: id,
            name: name,
            urduName: urduName || name,
            email: email,
            role: role,
            designation: designation || 'Institutional Staff',
            status: status,
            password: password,
            avatar: avatar,
            branchId: 'b1',
            createdAt: new Date().toISOString()
        };

        allUsers.unshift(newUser);
        window.LmsData.users = allUsers;
        window.DataStore.save(window.LmsData);

        App.closeModal();
        App.showToast(`System user '${name}' created successfully with role: ${role}`, "success");
        App.navigate('users');
    },

    // EDIT USER MODAL
    openEditUserModal(userId) {
        const user = window.LmsData?.users?.find(u => u.id === userId);
        if (!user) {
            App.showToast("User not found.", "danger");
            return;
        }

        const systemRoles = this.getSystemRoles();
        const modalContainer = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        const modalFooter = document.getElementById('modal-footer-container');

        modalTitle.innerHTML = `<i class="fas fa-user-edit" style="color: var(--gold-400);"></i> Edit System User: ${user.name}`;

        modalContainer.innerHTML = `
            <form id="form-edit-user" onsubmit="UsersModule.handleEditUserSubmit(event, '${userId}')">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Full Name (English) *
                        </label>
                        <input type="text" id="edit-user-name" class="form-control" value="${user.name}" required>
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Urdu Name (نام شریف)
                        </label>
                        <input type="text" id="edit-user-urdu" class="form-control" value="${user.urduName || ''}" style="font-family: 'Amiri', serif;">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Email Address / Login ID *
                        </label>
                        <input type="email" id="edit-user-email" class="form-control" value="${user.email}" required>
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Assigned System Role *
                        </label>
                        <select id="edit-user-role" class="form-control" required>
                            ${systemRoles.map(r => `
                                <option value="${r.id}" ${user.role === r.id ? 'selected' : ''}>
                                    ${r.name || r.title} (${r.urduTitle || r.id})
                                </option>
                            `).join('')}
                        </select>
                        <small style="color: var(--text-muted); font-size: 0.72rem;">Role changes update portal permissions immediately</small>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Designation / Office Title
                        </label>
                        <input type="text" id="edit-user-desig" class="form-control" value="${user.designation || ''}">
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Account Status
                        </label>
                        <select id="edit-user-status" class="form-control">
                            <option value="ACTIVE" ${(user.status || 'ACTIVE') === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
                            <option value="INACTIVE" ${(user.status || 'ACTIVE') === 'INACTIVE' ? 'selected' : ''}>INACTIVE</option>
                        </select>
                    </div>
                </div>
            </form>
        `;

        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn-gold" onclick="document.getElementById('form-edit-user').requestSubmit()">
                <i class="fas fa-save"></i> Save Changes
            </button>
        `;

        App.openModal();
    },

    handleEditUserSubmit(e, userId) {
        e.preventDefault();
        const user = window.LmsData?.users?.find(u => u.id === userId);
        if (!user) return;

        const name = document.getElementById('edit-user-name').value.trim();
        const urduName = document.getElementById('edit-user-urdu').value.trim();
        const email = document.getElementById('edit-user-email').value.trim().toLowerCase();
        const role = document.getElementById('edit-user-role').value;
        const designation = document.getElementById('edit-user-desig').value.trim();
        const status = document.getElementById('edit-user-status').value;

        // Check email uniqueness among others
        const allUsers = window.LmsData?.users || [];
        if (allUsers.some(u => u.id !== userId && u.email.toLowerCase() === email)) {
            App.showToast(`Email '${email}' is already taken by another user.`, "warning");
            return;
        }

        user.name = name;
        user.urduName = urduName;
        user.email = email;
        user.role = role;
        user.designation = designation;
        user.status = status;

        // If editing current logged-in user, refresh header
        if (window.AuthRBAC.currentUser && window.AuthRBAC.currentUser.id === userId) {
            window.AuthRBAC.currentUser = user;
            window.AuthRBAC.updateHeaderProfile();
            App.renderSidebar();
        }

        window.DataStore.save(window.LmsData);
        App.closeModal();
        App.showToast(`User '${name}' updated successfully!`, "success");
        App.navigate('users');
    },

    // RESET PASSWORD MODAL
    openResetPasswordModal(userId) {
        const user = window.LmsData?.users?.find(u => u.id === userId);
        if (!user) return;

        const modalContainer = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        const modalFooter = document.getElementById('modal-footer-container');

        modalTitle.innerHTML = `<i class="fas fa-key" style="color: var(--gold-400);"></i> Reset Password: ${user.name}`;

        modalContainer.innerHTML = `
            <div style="margin-bottom: 16px; padding: 12px; background: rgba(0,0,0,0.25); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-weight: 700; color: #ffffff;">${user.name}</div>
                <div style="font-size: 0.85rem; color: var(--gold-300);">${user.email} &bull; Role: ${user.role}</div>
            </div>

            <form id="form-reset-password" onsubmit="UsersModule.handleResetPasswordSubmit(event, '${userId}')">
                <div style="margin-bottom: 16px;">
                    <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                        New Password *
                    </label>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="reset-pwd-input" class="form-control" value="ashrafia${Math.floor(100 + Math.random() * 900)}" required>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('reset-pwd-input').value = 'ashrafia' + Math.floor(100 + Math.random() * 900)" title="Generate random password">
                            <i class="fas fa-random"></i> Generate
                        </button>
                    </div>
                    <small style="color: var(--text-muted); font-size: 0.72rem;">Minimum 4 characters. User can sign in with this new password immediately.</small>
                </div>
            </form>
        `;

        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn-gold" onclick="document.getElementById('form-reset-password').requestSubmit()">
                <i class="fas fa-save"></i> Save New Password
            </button>
        `;

        App.openModal();
    },

    handleResetPasswordSubmit(e, userId) {
        e.preventDefault();
        const user = window.LmsData?.users?.find(u => u.id === userId);
        if (!user) return;

        const newPwd = document.getElementById('reset-pwd-input').value.trim();
        if (newPwd.length < 4) {
            App.showToast("Password must be at least 4 characters long.", "danger");
            return;
        }

        user.password = newPwd;
        window.DataStore.save(window.LmsData);
        App.closeModal();
        App.showToast(`Password for '${user.name}' has been reset successfully!`, "success");
    },

    // TOGGLE STATUS
    toggleStatus(userId) {
        const user = window.LmsData?.users?.find(u => u.id === userId);
        if (!user) return;

        if (window.AuthRBAC.currentUser && window.AuthRBAC.currentUser.id === userId) {
            App.showToast("You cannot deactivate your own active Super Admin session.", "warning");
            return;
        }

        const currentStatus = user.status || 'ACTIVE';
        const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        user.status = newStatus;

        window.DataStore.save(window.LmsData);
        App.showToast(`Account for '${user.name}' is now ${newStatus}.`, newStatus === 'ACTIVE' ? "success" : "info");
        App.navigate('users');
    },

    // DELETE USER
    deleteUser(userId) {
        const user = window.LmsData?.users?.find(u => u.id === userId);
        if (!user) return;

        if (window.AuthRBAC.currentUser && window.AuthRBAC.currentUser.id === userId) {
            App.showToast("You cannot delete your own logged-in Super Admin account.", "danger");
            return;
        }

        const modalContainer = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        const modalFooter = document.getElementById('modal-footer-container');

        modalTitle.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i> Confirm Delete System User`;

        modalContainer.innerHTML = `
            <div style="padding: 10px 0;">
                <p style="color: #ffffff; font-size: 1rem; margin-bottom: 12px;">
                    Are you sure you want to permanently delete system user <strong>"${user.name}"</strong>?
                </p>
                <div style="padding: 12px; background: rgba(239, 68, 68, 0.1); border-left: 3px solid var(--danger); border-radius: 4px; font-size: 0.85rem; color: #fca5a5;">
                    <div><strong>Email:</strong> ${user.email}</div>
                    <div><strong>Role:</strong> ${user.role}</div>
                    <div><strong>ID:</strong> ${user.id}</div>
                </div>
                <p style="color: var(--text-muted); font-size: 0.82rem; margin-top: 12px;">
                    This will permanently remove the system user credentials from Jamia Ashrafia LMS.
                </p>
            </div>
        `;

        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn-danger" onclick="UsersModule.confirmDeleteUser('${userId}')">
                <i class="fas fa-trash-alt"></i> Delete User
            </button>
        `;

        App.openModal();
    },

    confirmDeleteUser(userId) {
        window.LmsData.users = (window.LmsData.users || []).filter(u => u.id !== userId);
        window.DataStore.save(window.LmsData);
        App.closeModal();
        App.showToast("System user account has been deleted.", "info");
        App.navigate('users');
    },

    // EXPORT USERS CSV
    exportCSV() {
        const users = this.getSystemUsers();
        const headers = ["ID", "Name", "Urdu Name", "Email", "Role", "Designation", "Status"];
        const rows = users.map(u => [
            `"${u.id}"`,
            `"${u.name}"`,
            `"${u.urduName || ''}"`,
            `"${u.email}"`,
            `"${u.role}"`,
            `"${u.designation || ''}"`,
            `"${u.status || 'ACTIVE'}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `jamia_ashrafia_system_users_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        App.showToast(`Exported ${users.length} system user accounts to CSV.`, "success");
    }
};

window.UsersModule = UsersModule;
