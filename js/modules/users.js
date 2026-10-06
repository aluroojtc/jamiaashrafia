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

    // Helper: Returns only assignable system roles (excludes STUDENT, TEACHER and the hard-coded Super Admin)
    getSystemRoles() {
        return (window.LmsData?.roles || []).filter(r => !['STUDENT', 'TEACHER', 'SUPER_ADMIN'].includes(r.id));
    },

    roleInfo(roleId) {
        return (window.LmsData?.roles || []).find(r => r.id === roleId) || { name: roleId, badgeClass: 'primary' };
    },

    // Login ID (email) and username must be unique across all accounts
    findDuplicate(userId, email, username) {
        const others = (window.LmsData?.users || []).filter(u => u.id !== userId);
        if (others.some(u => (u.email || '').toLowerCase() === email)) return `Email '${email}' is already used by another account.`;
        if (username && others.some(u => (u.username || '').toLowerCase() === username)) return `Username '${username}' is already taken.`;
        return null;
    },

    render() {
        const user = window.AuthRBAC.currentUser;
        const currentRole = window.AuthRBAC.getRole();

        // Staff accounts page: users.view (each action below has its own permission)
        if (!window.AuthRBAC.can('users.view')) {
            return `
                <div class="card" style="border: 2px solid var(--danger); text-align: center; padding: 48px 24px;">
                    <i class="fas fa-lock" style="font-size: 3rem; color: var(--danger); margin-bottom: 16px;"></i>
                    <h2 style="color: var(--primary-950); margin-bottom: 8px;">403 - Administrative Access Required</h2>
                    <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto 20px;">
                        Your role is not allowed to see staff accounts.
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
                    ${window.AuthRBAC.can('users.export') ? `<button class="btn btn-secondary btn-sm" onclick="UsersModule.exportCSV()">
                        <i class="fas fa-file-csv"></i> Export Users CSV
                    </button>` : ''}
                    ${window.AuthRBAC.can('users.create') ? `<button class="btn btn-gold btn-sm" onclick="UsersModule.openAddUserModal()">
                        <i class="fas fa-user-plus"></i> Add New System User
                    </button>` : ''}
                </div>
            </div>

            <!-- REGISTRY SCOPE NOTICE BANNER -->
            <div class="card" style="background: linear-gradient(135deg, rgba(6, 78, 59, 0.25) 0%, rgba(30, 58, 138, 0.2) 100%); border-left: 4px solid var(--primary-400); margin-bottom: 22px; padding: 14px 18px;">
                <div style="display: flex; gap: 14px; align-items: center;">
                    <div style="font-size: 1.6rem; color: var(--primary-400);"><i class="fas fa-shield-alt"></i></div>
                    <div>
                        <h4 style="color: var(--primary-950); margin-bottom: 2px; font-size: 0.95rem;">Administrative & Application Users Registry</h4>
                        <p style="font-size: 0.82rem; color: var(--text-secondary); margin: 0; line-height: 1.5;">
                            This directory is reserved for application administrators, finance officers, and custom operational accounts. 
                            <strong>Students</strong> and <strong>Teachers</strong> are managed in their dedicated academic portals: 
                            <a href="#students" style="color: var(--primary-700); font-weight: 600; text-decoration: underline;">Students Management</a> and 
                            <a href="#teachers" style="color: var(--primary-700); font-weight: 600; text-decoration: underline;">Teachers & Portals</a>.
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
                        <span class="metric-hint" style="color: var(--gold-600);">${filtered.length} Displayed</span>
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
                               value="${Lms.esc(this.searchTerm)}" 
                               oninput="UsersModule.handleSearch(this.value)">
                    </div>

                    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                        <label style="font-size: 0.85rem; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-filter"></i> System Role:
                        </label>
                        <select class="form-control" style="width: auto; min-width: 170px;" onchange="UsersModule.handleRoleFilter(this.value)">
                            <option value="ALL" ${this.roleFilter === 'ALL' ? 'selected' : ''}>All Roles (${systemRoles.length})</option>
                            ${systemRoles.map(r => `
                                <option value="${Lms.esc(r.id)}" ${this.roleFilter === r.id ? 'selected' : ''}>
                                    ${Lms.esc(r.name || r.title)}
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
                                const roleObj = this.roleInfo(u.role);
                                const badgeClass = roleObj.badgeClass || 'gold';
                                const roleName = roleObj.name || roleObj.title || u.role;
                                const isCurrentLoggedIn = (window.AuthRBAC.currentUser && window.AuthRBAC.currentUser.id === u.id);
                                const isSuperAdmin = u.role === 'SUPER_ADMIN';
                                // Only a Super Admin may change a Super Admin account
                                const touchable = !isSuperAdmin || window.AuthRBAC.isSuperAdmin();
                                const canToggle = !isSuperAdmin && !isCurrentLoggedIn && window.AuthRBAC.can('users.deactivate');
                                const status = u.status || 'ACTIVE';

                                return `
                                    <tr>
                                        <td>
                                            <div style="display: flex; align-items: center; gap: 12px;">
                                                <div class="user-avatar" style="width: 38px; height: 38px; font-size: 0.82rem; background: linear-gradient(135deg, var(--primary-600), var(--gold-600));">
                                                    ${Lms.esc(u.avatar || Lms.initials(u.name))}
                                                </div>
                                                <div>
                                                    <div style="font-weight: 700; color: var(--primary-950); display: flex; align-items: center; gap: 6px;">
                                                        ${Lms.esc(u.name)}
                                                        ${isCurrentLoggedIn ? `<span class="badge-pill gold" style="font-size: 0.65rem; padding: 1px 6px;">You</span>` : ''}
                                                    </div>
                                                    ${u.urduName ? `
                                                        <div style="font-family: 'Amiri', serif; font-size: 0.95rem; color: var(--gold-700);">
                                                            ${Lms.esc(u.urduName)}
                                                        </div>
                                                    ` : ''}
                                                    <div style="font-size: 0.75rem; color: var(--text-muted);">ID: ${Lms.esc(u.id)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style="font-family: monospace; font-size: 0.85rem; color: var(--text-primary); font-weight: 600;">
                                                ${Lms.esc(u.email)}
                                            </div>
                                            ${u.username ? `<div style="font-size: 0.75rem; color: var(--text-muted);">Username: ${Lms.esc(u.username)}</div>` : ''}
                                            ${u.phone ? `<div style="font-size: 0.75rem; color: var(--text-muted);"><i class="fas fa-phone"></i> ${Lms.esc(u.phone)}</div>` : ''}
                                        </td>
                                        <td>
                                            <span class="badge-pill ${Lms.esc(badgeClass)}">
                                                ${Lms.esc(roleName)}
                                            </span>
                                            <div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace; margin-top: 3px;">
                                                ${Lms.esc(u.role)}
                                            </div>
                                            ${(u.additionalRoles || []).map(r => `<span class="badge-pill ${Lms.esc(this.roleInfo(r).badgeClass || 'info')}" style="font-size: 0.65rem; margin-top: 3px;" title="Additional role">+ ${Lms.esc(this.roleInfo(r).name || r)}</span>`).join(' ')}
                                        </td>
                                        <td style="font-size: 0.85rem; color: var(--text-secondary); max-width: 220px;">
                                            ${Lms.esc(u.designation || 'Institutional Officer')}
                                        </td>
                                        <td style="text-align: center;">
                                            <span ${canToggle ? `onclick="UsersModule.toggleStatus('${Lms.esc(u.id)}')"` : ''}
                                                  class="status-pill ${status === 'ACTIVE' ? 'success' : 'danger'}" 
                                                  style="cursor: ${canToggle ? 'pointer' : 'default'}; display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; border-radius: 20px; font-weight: 700; font-size: 0.78rem; letter-spacing: 0.04em; background: ${status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)'}; color: ${status === 'ACTIVE' ? '#34d399' : '#f87171'}; border: 1px solid ${status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)'};" 
                                                  title="${isSuperAdmin ? 'The Super Admin account is always active' : (canToggle ? 'Click to toggle account status (ACTIVE / INACTIVE)' : '')}">
                                                <i class="fas ${status === 'ACTIVE' ? 'fa-check-circle' : 'fa-ban'}"></i>
                                                <span>${status}</span>
                                            </span>
                                        </td>
                                        <td style="text-align: right; white-space: nowrap;">
                                            ${touchable && (isCurrentLoggedIn || window.AuthRBAC.can('users.update') || window.AuthRBAC.can('users.assign_roles')) ? `<button class="btn btn-secondary btn-sm" onclick="UsersModule.openEditUserModal('${Lms.esc(u.id)}')" title="Edit User & Role">
                                                <i class="fas fa-edit"></i> Edit
                                            </button>` : ''}
                                            ${touchable && !isCurrentLoggedIn && window.AuthRBAC.can('users.reset_password') ? `<button class="btn btn-secondary btn-sm" onclick="UsersModule.openResetPasswordModal('${Lms.esc(u.id)}')" title="Reset User Password" style="margin-left: 4px;">
                                                <i class="fas fa-key"></i> Password
                                            </button>` : ''}
                                            ${window.AuthRBAC.isSuperAdmin() && !isCurrentLoggedIn && status === 'ACTIVE' ? (isSuperAdmin
                                                ? `<button class="btn btn-secondary btn-sm" onclick="UsersModule.openSuperAdminModal('${Lms.esc(u.id)}', false)" title="Remove Super Admin rights" style="margin-left: 4px;"><i class="fas fa-crown" style="color: var(--danger);"></i></button>`
                                                : `<button class="btn btn-secondary btn-sm" onclick="UsersModule.openSuperAdminModal('${Lms.esc(u.id)}', true)" title="Make Super Admin" style="margin-left: 4px;"><i class="fas fa-crown" style="color: var(--gold-500);"></i></button>`) : ''}
                                            ${!isCurrentLoggedIn && !isSuperAdmin && window.AuthRBAC.can('users.delete') ? `
                                                <button class="btn btn-danger btn-sm" onclick="UsersModule.deleteUser('${Lms.esc(u.id)}')" title="Delete User" style="margin-left: 4px;">
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
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Full Name (English) *
                        </label>
                        <input type="text" id="add-user-name" class="form-control" placeholder="e.g. Maulana Abdul Samad" required>
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Urdu Name (نام شریف)
                        </label>
                        <input type="text" id="add-user-urdu" class="form-control" placeholder="e.g. مولانا عبد الصمد" style="font-family: 'Amiri', serif;">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Email Address / Login ID *
                        </label>
                        <input type="email" id="add-user-email" class="form-control" placeholder="e.g. samad@jamiaashrafia.org" required>
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Assigned System Role *
                        </label>
                        <select id="add-user-role" class="form-control" required>
                            <option value="" disabled selected>-- Select System Role --</option>
                            ${systemRoles.map(r => `
                                <option value="${Lms.esc(r.id)}">${Lms.esc(r.name || r.title)} (${Lms.esc(r.urduTitle || r.id)})</option>
                            `).join('')}
                        </select>
                        <small style="color: var(--text-muted); font-size: 0.72rem;">Roles dynamically configured in Users & Roles &rarr; Roles</small>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Username
                        </label>
                        <input type="text" id="add-user-username" class="form-control" placeholder="Optional, e.g. samad">
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Phone Number
                        </label>
                        <input type="tel" id="add-user-phone" class="form-control" placeholder="e.g. +92 300 1234567">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Designation / Office Title
                        </label>
                        <input type="text" id="add-user-desig" class="form-control" placeholder="e.g. Assistant Controller / Finance Officer">
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Account Status
                        </label>
                        <select id="add-user-status" class="form-control">
                            <option value="ACTIVE" selected>ACTIVE (Can Sign In)</option>
                            <option value="INACTIVE">INACTIVE (Access Suspended)</option>
                        </select>
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                        Initial Password *
                    </label>
                    <input type="text" id="add-user-pwd" class="form-control" value="${Lms.esc(Lms.tempPassword())}" minlength="8" required>
                    <small style="color: var(--text-muted); font-size: 0.72rem;">Temporary password (at least 8 characters). Give it to the user privately; they must choose their own at first sign-in.</small>
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
        const username = document.getElementById('add-user-username').value.trim().toLowerCase();
        const phone = document.getElementById('add-user-phone').value.trim();
        const designation = document.getElementById('add-user-desig').value.trim();
        const status = document.getElementById('add-user-status').value;
        const password = document.getElementById('add-user-pwd').value.trim();

        if (!name || !email || !role || !password) {
            App.showToast("Please fill in all required fields.", "danger");
            return;
        }
        if (password.length < Lms.MIN_PASSWORD_LENGTH) {
            App.showToast(`The temporary password must be at least ${Lms.MIN_PASSWORD_LENGTH} characters.`, "danger");
            return;
        }
        if (role === 'SUPER_ADMIN') {
            App.showToast("Super Admin is a fixed system account and cannot be assigned.", "danger");
            return;
        }

        const allUsers = window.LmsData?.users || [];
        const duplicate = this.findDuplicate(null, email, username);
        if (duplicate) {
            App.showToast(duplicate, "warning");
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
            username: username,
            phone: phone,
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
        App.showToast(`System user '${name}' created. Temporary password: ${password} (must be changed at first sign-in).`, "success");
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
        const isSuperAdmin = user.role === 'SUPER_ADMIN';
        const modalContainer = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        const modalFooter = document.getElementById('modal-footer-container');

        modalTitle.innerHTML = `<i class="fas fa-user-edit" style="color: var(--gold-400);"></i> ${isSuperAdmin ? 'Edit Super Admin Profile' : 'Edit System User'}: ${Lms.esc(user.name)}`;

        modalContainer.innerHTML = `
            <form id="form-edit-user" onsubmit="UsersModule.handleEditUserSubmit(event, '${Lms.esc(userId)}')">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Full Name (English) *
                        </label>
                        <input type="text" id="edit-user-name" class="form-control" value="${Lms.esc(user.name)}" required>
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Urdu Name (نام شریف)
                        </label>
                        <input type="text" id="edit-user-urdu" class="form-control" value="${Lms.esc(user.urduName || '')}" style="font-family: 'Amiri', serif;">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Email Address / Login ID *
                        </label>
                        <input type="email" id="edit-user-email" class="form-control" value="${Lms.esc(user.email)}" required>
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Assigned System Role *
                        </label>
                        ${isSuperAdmin ? `
                            <input type="text" class="form-control" value="${Lms.esc(this.roleInfo('SUPER_ADMIN').name || 'Super Admin')}" disabled style="opacity: 0.7;">
                            <small style="color: var(--text-muted); font-size: 0.72rem;">Fixed role with full access to every module</small>
                        ` : `
                            <select id="edit-user-role" class="form-control" required ${window.AuthRBAC.can('users.assign_roles') && userId !== (window.AuthRBAC.currentUser || {}).id ? '' : 'disabled title="Changing roles needs the users.assign_roles permission"'}>
                                ${systemRoles.map(r => `
                                    <option value="${Lms.esc(r.id)}" ${user.role === r.id ? 'selected' : ''}>
                                        ${Lms.esc(r.name || r.title)} (${Lms.esc(r.urduTitle || r.id)})
                                    </option>
                                `).join('')}
                            </select>
                            <small style="color: var(--text-muted); font-size: 0.72rem;">Role changes update portal permissions immediately</small>
                        `}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Username
                        </label>
                        <input type="text" id="edit-user-username" class="form-control" value="${Lms.esc(user.username || '')}">
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Phone Number
                        </label>
                        <input type="tel" id="edit-user-phone" class="form-control" value="${Lms.esc(user.phone || '')}">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Designation / Office Title
                        </label>
                        <input type="text" id="edit-user-desig" class="form-control" value="${Lms.esc(user.designation || '')}">
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                            Account Status
                        </label>
                        <select id="edit-user-status" class="form-control" ${isSuperAdmin ? 'disabled style="opacity: 0.7;"' : ''}>
                            <option value="ACTIVE" ${(user.status || 'ACTIVE') === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
                            <option value="INACTIVE" ${(user.status || 'ACTIVE') === 'INACTIVE' ? 'selected' : ''}>INACTIVE</option>
                        </select>
                    </div>
                </div>
                ${isSuperAdmin ? '' : this.rolePicker(user)}
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
        const username = document.getElementById('edit-user-username').value.trim().toLowerCase();
        const phone = document.getElementById('edit-user-phone').value.trim();
        const designation = document.getElementById('edit-user-desig').value.trim();
        // Super Admin's role and active status are fixed; only the profile changes
        const isSuperAdmin = user.role === 'SUPER_ADMIN';
        const role = isSuperAdmin ? 'SUPER_ADMIN' : document.getElementById('edit-user-role').value;
        const status = isSuperAdmin ? 'ACTIVE' : document.getElementById('edit-user-status').value;

        if (!isSuperAdmin && role === 'SUPER_ADMIN') {
            App.showToast("Super Admin is a fixed system account and cannot be assigned.", "danger");
            return;
        }
        const duplicate = this.findDuplicate(userId, email, username);
        if (duplicate) {
            App.showToast(duplicate, "warning");
            return;
        }

        user.name = name;
        user.urduName = urduName;
        user.email = email;
        user.username = username;
        user.phone = phone;
        user.role = role;
        user.designation = designation;
        user.status = status;
        const extra = this.readRolePicker();
        if (extra) user.additionalRoles = extra.filter(r => r !== role);

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

    // ADDITIONAL ROLES (a person may hold several roles; permissions add up, each with its role's data scope)
    rolePicker(user) {
        if (!window.AuthRBAC.can('users.assign_roles') || !user || user.id === (window.AuthRBAC.currentUser || {}).id) return '';
        const held = new Set(user.additionalRoles || []);
        const options = (window.LmsData?.roles || []).filter(r => !['SUPER_ADMIN', 'STUDENT', user.role].includes(r.id));
        if (!options.length) return '';
        return `
            <div style="margin-top: 4px;" id="extra-roles-picker">
                <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">Additional Roles</label>
                <small style="display: block; color: var(--text-muted); font-size: 0.72rem; margin-bottom: 8px;">e.g. a teacher who also runs the library. You can only give roles that cannot do more than you.</small>
                <div class="role-perm-grid">
                    ${options.map(r => `
                        <label class="role-perm-item" title="${Lms.esc(r.description || '')}">
                            <input type="checkbox" name="extra-role" value="${Lms.esc(r.id)}" ${held.has(r.id) ? 'checked' : ''}>
                            <span>${Lms.esc(r.name || r.id)}</span>
                        </label>`).join('')}
                </div>
            </div>`;
    },

    // The ticked additional roles, or null when the picker was not shown (nothing to change)
    readRolePicker() {
        if (!document.getElementById('extra-roles-picker')) return null;
        return Array.from(document.querySelectorAll('input[name="extra-role"]:checked')).map(b => b.value);
    },

    // SUPER ADMIN: given and taken away only here, with the Super Admin's password; there is always at least one
    openSuperAdminModal(userId, grant) {
        const user = window.LmsData?.users?.find(u => u.id === userId);
        if (!user || !window.AuthRBAC.isSuperAdmin()) return;
        const roles = (window.LmsData?.roles || []).filter(r => !['SUPER_ADMIN', 'STUDENT'].includes(r.id));
        Lms.openModal(
            grant ? `<i class="fas fa-crown" style="color: var(--gold-400);"></i> Make Super Admin` : `<i class="fas fa-crown" style="color: var(--danger);"></i> Remove Super Admin`,
            `<p style="margin-bottom: 12px;">${grant
                ? `<strong>${Lms.esc(user.name)}</strong> will have full control of every account, role, record and setting. Their current role stays with them as an additional role.`
                : `<strong>${Lms.esc(user.name)}</strong> will lose Super Admin rights and be signed out. There must always be at least one Super Admin.`}</p>
             ${grant ? '' : `<div class="form-group"><label for="sa-new-role">Role from now on *</label><select id="sa-new-role" class="form-control">${roles.map(r => `<option value="${Lms.esc(r.id)}">${Lms.esc(r.name || r.id)}</option>`).join('')}</select></div>`}
             <div class="form-group"><label for="sa-password">Your password (to confirm) *</label><input type="password" id="sa-password" class="form-control" autocomplete="current-password"></div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn ${grant ? 'btn-gold' : 'btn-danger'}" onclick="UsersModule.confirmSuperAdmin(this, '${Lms.esc(userId)}', ${grant})">${grant ? 'Make Super Admin' : 'Remove Super Admin'}</button>`
        );
    },

    async confirmSuperAdmin(btn, userId, grant) {
        const password = document.getElementById('sa-password').value;
        if (!password) return App.showToast('Enter your password to confirm.', 'warning');
        const body = grant ? { userId, password } : { userId, password, newRole: Lms.val('sa-new-role') };
        const result = await Lms.busy(btn, async () => {
            const res = await fetch(grant ? '/api/super-admins' : '/api/super-admins/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            return { ok: res.ok, data: await res.json().catch(() => ({})) };
        });
        if (!result) return;
        if (!result.ok) return App.showToast(result.data.error || 'The change was not saved.', 'danger');
        App.closeModal();
        App.showToast(grant ? 'Super Admin rights given.' : 'Super Admin rights removed.', 'success');
        await window.DataStore.syncNow();
        await window.AuthRBAC.loadRoles();
        App.navigate('users');
    },

    // RESET PASSWORD MODAL
    openResetPasswordModal(userId) {
        const user = window.LmsData?.users?.find(u => u.id === userId);
        if (!user) return;

        const modalContainer = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        const modalFooter = document.getElementById('modal-footer-container');

        modalTitle.innerHTML = `<i class="fas fa-key" style="color: var(--gold-400);"></i> Reset Password: ${Lms.esc(user.name)}`;

        modalContainer.innerHTML = `
            <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm); border: 1px solid var(--border-prominent);">
                <div style="font-weight: 700; color: var(--primary-950);">${Lms.esc(user.name)}</div>
                <div style="font-size: 0.85rem; color: var(--gold-700);">${Lms.esc(user.email)} &bull; Role: ${Lms.esc(user.role)}</div>
            </div>

            <form id="form-reset-password" onsubmit="UsersModule.handleResetPasswordSubmit(event, '${Lms.esc(userId)}')">
                <div style="margin-bottom: 16px;">
                    <label class="form-label" style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 6px;">
                        New Password *
                    </label>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="reset-pwd-input" class="form-control" value="${Lms.esc(Lms.tempPassword())}" minlength="8" required>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('reset-pwd-input').value = Lms.tempPassword()" title="Generate random password">
                            <i class="fas fa-random"></i> Generate
                        </button>
                    </div>
                    <small style="color: var(--text-muted); font-size: 0.72rem;">Temporary password, at least 8 characters. The user is signed out everywhere and must choose a new password at next sign-in.</small>
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
        if (newPwd.length < Lms.MIN_PASSWORD_LENGTH) {
            App.showToast(`Password must be at least ${Lms.MIN_PASSWORD_LENGTH} characters long.`, "danger");
            return;
        }

        user.password = newPwd;
        window.DataStore.save(window.LmsData);
        App.closeModal();
        App.showToast(`Temporary password set for '${user.name}': ${newPwd} (must be changed at next sign-in).`, "success");
    },

    // TOGGLE STATUS
    toggleStatus(userId) {
        const user = window.LmsData?.users?.find(u => u.id === userId);
        if (!user) return;

        if (user.role === 'SUPER_ADMIN') {
            App.showToast("The Super Admin account is always active.", "warning");
            return;
        }
        if (window.AuthRBAC.currentUser && window.AuthRBAC.currentUser.id === userId) {
            App.showToast("You cannot deactivate your own account.", "warning");
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

        if (user.role === 'SUPER_ADMIN') {
            App.showToast("The Super Admin account cannot be deleted.", "danger");
            return;
        }
        if (window.AuthRBAC.currentUser && window.AuthRBAC.currentUser.id === userId) {
            App.showToast("You cannot delete your own logged-in account.", "danger");
            return;
        }

        const modalContainer = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        const modalFooter = document.getElementById('modal-footer-container');

        modalTitle.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i> Confirm Delete System User`;

        modalContainer.innerHTML = `
            <div style="padding: 10px 0;">
                <p style="color: var(--text-primary); font-size: 1rem; margin-bottom: 12px;">
                    Are you sure you want to permanently delete system user <strong>"${Lms.esc(user.name)}"</strong>?
                </p>
                <div style="padding: 12px; background: rgba(239, 68, 68, 0.08); border-left: 3px solid var(--danger); border-radius: 4px; font-size: 0.85rem; color: #7f1d1d;">
                    <div><strong>Email:</strong> ${Lms.esc(user.email)}</div>
                    <div><strong>Role:</strong> ${Lms.esc(user.role)}</div>
                    <div><strong>ID:</strong> ${Lms.esc(user.id)}</div>
                </div>
                <p style="color: var(--text-muted); font-size: 0.82rem; margin-top: 12px;">
                    This will permanently remove the system user credentials from Jamia Ashrafia LMS.
                </p>
            </div>
        `;

        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn-danger" onclick="UsersModule.confirmDeleteUser('${Lms.esc(userId)}')">
                <i class="fas fa-trash-alt"></i> Delete User
            </button>
        `;

        App.openModal();
    },

    confirmDeleteUser(userId) {
        const user = (window.LmsData.users || []).find(u => u.id === userId);
        if (!user || user.role === 'SUPER_ADMIN') return;
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
