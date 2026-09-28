/**
 * JAMIA ASHRAFIA LAHORE - ROLES & PERSONA MANAGEMENT MODULE
 * Allows Super Admin to view, create, edit, and configure system and custom roles.
 * Fully synchronized with Users management, RBAC authorization, and DataStore.
 */

const RolesModule = {
    render() {
        const user = window.AuthRBAC.currentUser;
        const currentRole = window.AuthRBAC.getRole();

        // RBAC Guard: Only Super Admin can view or manage roles
        if (currentRole !== 'SUPER_ADMIN') {
            return `
                <div class="card" style="border: 2px solid var(--danger); text-align: center; padding: 48px 24px;">
                    <i class="fas fa-lock" style="font-size: 3rem; color: var(--danger); margin-bottom: 16px;"></i>
                    <h2 style="color: #ffffff; margin-bottom: 8px;">403 - Administrative Access Required</h2>
                    <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto 20px;">
                        Only the Super Admin (Mohtamim) has authorization to inspect and configure institutional roles for Jamia Ashrafia LMS.
                    </p>
                    <button class="btn btn-gold" onclick="App.navigate('dashboard')">
                        <i class="fas fa-arrow-left"></i> Return to Dashboard
                    </button>
                </div>
            `;
        }

        const roles = window.LmsData?.roles || [];
        const users = window.LmsData?.users || [];

        // Compute metrics
        const totalRoles = roles.length;
        const systemRoles = roles.filter(r => r.isSystem).length;
        const customRoles = totalRoles - systemRoles;
        const totalAssignedUsers = users.length;

        return `
            <!-- HEADER -->
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-id-badge" style="color: var(--gold-400);"></i>
                        Institutional Roles & Persona Management
                    </h1>
                    <p>Manage system and custom institutional roles, configure descriptions, and assignable personas across Jamia Ashrafia</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-secondary btn-sm" onclick="RolesModule.syncSystemDefaults()">
                        <i class="fas fa-sync-alt"></i> Sync Core Roles
                    </button>
                    <button class="btn btn-gold btn-sm" onclick="RolesModule.openAddRoleModal()">
                        <i class="fas fa-plus-circle"></i> Add New Role
                    </button>
                </div>
            </div>

            <!-- KPI METRICS -->
            <div class="metrics-grid">
                <div class="metric-card gold">
                    <div class="metric-icon-box" style="background: rgba(217, 119, 6, 0.2); color: var(--gold-400);"><i class="fas fa-id-card-alt"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Configured Roles</span>
                        <span class="metric-value">${totalRoles} Total</span>
                        <span class="metric-hint" style="color: var(--gold-300);">Role Engine Active</span>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon-box" style="background: rgba(16, 185, 129, 0.2); color: var(--primary-400);"><i class="fas fa-shield-alt"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Core System Roles</span>
                        <span class="metric-value">${systemRoles} Core</span>
                        <span class="metric-hint">Protected Personas</span>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon-box" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa;"><i class="fas fa-user-tag"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Custom Roles</span>
                        <span class="metric-value">${customRoles} Custom</span>
                        <span class="metric-hint">Defined by Admin</span>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon-box" style="background: rgba(245, 158, 11, 0.2); color: var(--warning);"><i class="fas fa-users"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Total LMS Personas</span>
                        <span class="metric-value">${totalAssignedUsers} Assigned</span>
                        <span class="metric-hint">Across All Modules</span>
                    </div>
                </div>
            </div>

            <!-- ARCHITECTURE BANNER -->
            <div class="card" style="background: linear-gradient(135deg, rgba(6, 78, 59, 0.3) 0%, rgba(217, 119, 6, 0.12) 100%); border-left: 4px solid var(--gold-400); margin-bottom: 24px;">
                <div style="display: flex; gap: 16px; align-items: center;">
                    <div style="font-size: 2rem; color: var(--gold-400);"><i class="fas fa-network-wired"></i></div>
                    <div>
                        <h4 style="color: #ffffff; margin-bottom: 4px;">Dynamic Role Workflow Active</h4>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">
                            <strong>Workflow:</strong> Create / Edit Role here &rarr; Role is instantly available in <strong>Users & Permissions &rarr; Users</strong> dropdown &rarr; Assign to LMS users.
                        </p>
                    </div>
                </div>
            </div>

            <!-- ROLES TABLE -->
            <div class="card">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 class="card-title"><i class="fas fa-list-ul"></i> Configured Institutional Roles Directory</h3>
                    <span style="font-size: 0.82rem; color: var(--text-muted);">Showing all ${roles.length} roles</span>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Role Title & Urdu</th>
                                <th>Identifier Key</th>
                                <th>Badge Style</th>
                                <th>Description & Scope</th>
                                <th style="text-align: center;">Assigned Users</th>
                                <th>Classification</th>
                                <th style="text-align: right;">Administrative Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${roles.map(r => {
                                const count = users.filter(u => u.role === r.id).length;
                                const badgeClass = r.badgeClass || 'gold';
                                return `
                                    <tr>
                                        <td>
                                            <div style="font-weight: 700; color: #ffffff; display: flex; align-items: center; gap: 8px;">
                                                <i class="fas fa-id-badge" style="color: var(--gold-400);"></i>
                                                ${r.name || r.title}
                                            </div>
                                            <div style="font-family: 'Amiri', serif; font-size: 0.95rem; color: var(--gold-300); margin-top: 2px;">
                                                ${r.urduTitle || ''}
                                            </div>
                                        </td>
                                        <td>
                                            <code style="background: rgba(0,0,0,0.3); padding: 3px 8px; border-radius: 4px; color: var(--primary-300); font-weight: 700;">
                                                ${r.id}
                                            </code>
                                        </td>
                                        <td>
                                            <span class="badge-pill ${badgeClass}">
                                                ${r.id}
                                            </span>
                                        </td>
                                        <td style="max-width: 320px; font-size: 0.84rem; color: var(--text-secondary);">
                                            ${r.description || 'Institutional access role.'}
                                        </td>
                                        <td style="text-align: center;">
                                            <span style="display: inline-block; padding: 4px 10px; border-radius: 20px; background: rgba(255,255,255,0.06); font-weight: 700; color: #ffffff;">
                                                ${count} Users
                                            </span>
                                        </td>
                                        <td>
                                            ${r.isSystem ? `
                                                <span class="badge-pill gold" title="Core System Role - Essential for LMS operations">
                                                    <i class="fas fa-lock" style="font-size: 0.65rem;"></i> System Core
                                                </span>
                                            ` : `
                                                <span class="badge-pill info" title="Custom Institutional Role">
                                                    <i class="fas fa-user-edit" style="font-size: 0.65rem;"></i> Custom
                                                </span>
                                            `}
                                        </td>
                                        <td style="text-align: right; white-space: nowrap;">
                                            <button class="btn btn-secondary btn-sm" onclick="RolesModule.openEditRoleModal('${r.id}')" title="Edit Role Information">
                                                <i class="fas fa-edit"></i> Edit
                                            </button>
                                            <button class="btn btn-secondary btn-sm" onclick="RolesModule.testRolePersona('${r.id}')" title="Switch active persona to test this role's UI and capabilities" style="margin-left: 4px;">
                                                <i class="fas fa-exchange-alt"></i> Test Persona
                                            </button>
                                            ${!r.isSystem ? `
                                                <button class="btn btn-danger btn-sm" onclick="RolesModule.deleteRole('${r.id}')" title="Delete custom role" style="margin-left: 4px;">
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

    openAddRoleModal() {
        const modalContainer = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        const modalFooter = document.getElementById('modal-footer-container');

        modalTitle.innerHTML = `<i class="fas fa-plus-circle" style="color: var(--gold-400);"></i> Add New Institutional Role`;

        modalContainer.innerHTML = `
            <form id="form-add-role" onsubmit="RolesModule.handleAddRoleSubmit(event)">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Role Name (English) *
                        </label>
                        <input type="text" id="role-name-input" class="form-control" placeholder="e.g. Library Nazim" required>
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Role Identifier Key *
                        </label>
                        <input type="text" id="role-id-input" class="form-control" placeholder="e.g. LIBRARIAN" style="text-transform: uppercase;" required>
                        <small style="color: var(--text-muted); font-size: 0.72rem;">Must be uppercase, e.g. LIBRARIAN, EXAM_CONTROLLER</small>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Urdu Title (منصب / کردار)
                        </label>
                        <input type="text" id="role-urdu-input" class="form-control" placeholder="e.g. ناظم کتب خانہ" style="font-family: 'Amiri', serif;">
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Visual Badge Style
                        </label>
                        <select id="role-badge-input" class="form-control">
                            <option value="gold">Gold (Executive / Royal)</option>
                            <option value="primary">Emerald Primary (Academic)</option>
                            <option value="success">Green Success (Faculty / Health)</option>
                            <option value="info">Blue Info (Administrative)</option>
                            <option value="warning">Amber Warning (Finance / Audit)</option>
                        </select>
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                        Role Scope & Description
                    </label>
                    <textarea id="role-desc-input" class="form-control" rows="3" placeholder="Describe the responsibilities and scope of this role within Jamia Ashrafia LMS..."></textarea>
                </div>
            </form>
        `;

        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn-gold" onclick="document.getElementById('form-add-role').requestSubmit()">
                <i class="fas fa-check-circle"></i> Create Role
            </button>
        `;

        App.openModal();
    },

    handleAddRoleSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('role-name-input').value.trim();
        let id = document.getElementById('role-id-input').value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        const urduTitle = document.getElementById('role-urdu-input').value.trim();
        const badgeClass = document.getElementById('role-badge-input').value;
        const description = document.getElementById('role-desc-input').value.trim();

        if (!name || !id) {
            App.showToast("Please provide both Role Name and Role Identifier.", "danger");
            return;
        }

        const roles = window.LmsData?.roles || [];
        if (roles.some(r => r.id === id)) {
            App.showToast(`Role with identifier '${id}' already exists!`, "warning");
            return;
        }

        const newRole = {
            id: id,
            name: name,
            urduTitle: urduTitle || name,
            badgeClass: badgeClass,
            description: description || 'Institutional role configured in LMS.',
            isSystem: false,
            permissions: ["classes:view_assigned", "attendance:checkin"],
            status: "ACTIVE"
        };

        roles.push(newRole);
        window.LmsData.roles = roles;

        // Initialize default permissions for new role
        if (!window.LmsData.roleModulePermissions) window.LmsData.roleModulePermissions = {};
        window.LmsData.roleModulePermissions[id] = {
            classes: true,
            assignments: false,
            exams: false,
            timetable: true,
            virtual_class: false,
            notifications: true,
            library: true,
            teachers: false,
            students: false,
            attendance: true,
            reports: false,
            users: false,
            roles: false,
            admissions: false,
            fees: false,
            heritage: true,
            permissions: false,
            security: false
        };

        window.DataStore.save(window.LmsData);
        App.closeModal();
        App.showToast(`Role '${name}' created successfully. Now assignable in Users!`, "success");
        App.navigate('roles');
    },

    openEditRoleModal(roleId) {
        const role = window.LmsData?.roles?.find(r => r.id === roleId);
        if (!role) {
            App.showToast("Role not found.", "danger");
            return;
        }

        const modalContainer = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        const modalFooter = document.getElementById('modal-footer-container');

        modalTitle.innerHTML = `<i class="fas fa-edit" style="color: var(--gold-400);"></i> Edit Role: ${role.name || role.title}`;

        modalContainer.innerHTML = `
            <form id="form-edit-role" onsubmit="RolesModule.handleEditRoleSubmit(event, '${roleId}')">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Role Name (English) *
                        </label>
                        <input type="text" id="edit-role-name" class="form-control" value="${role.name || role.title || ''}" required>
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Role Identifier Key
                        </label>
                        <input type="text" class="form-control" value="${role.id}" disabled style="opacity: 0.7;">
                        <small style="color: var(--text-muted); font-size: 0.72rem;">Identifier key is immutable to protect RBAC bindings</small>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Urdu Title (منصب / کردار)
                        </label>
                        <input type="text" id="edit-role-urdu" class="form-control" value="${role.urduTitle || ''}" style="font-family: 'Amiri', serif;">
                    </div>
                    <div>
                        <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                            Visual Badge Style
                        </label>
                        <select id="edit-role-badge" class="form-control">
                            <option value="gold" ${role.badgeClass === 'gold' ? 'selected' : ''}>Gold (Executive / Royal)</option>
                            <option value="primary" ${role.badgeClass === 'primary' ? 'selected' : ''}>Emerald Primary (Academic)</option>
                            <option value="success" ${role.badgeClass === 'success' ? 'selected' : ''}>Green Success (Faculty / Health)</option>
                            <option value="info" ${role.badgeClass === 'info' ? 'selected' : ''}>Blue Info (Administrative)</option>
                            <option value="warning" ${role.badgeClass === 'warning' ? 'selected' : ''}>Amber Warning (Finance / Audit)</option>
                        </select>
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <label class="form-label" style="font-weight: 600; color: #ffffff; display: block; margin-bottom: 6px;">
                        Role Scope & Description
                    </label>
                    <textarea id="edit-role-desc" class="form-control" rows="3">${role.description || ''}</textarea>
                </div>
            </form>
        `;

        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn-gold" onclick="document.getElementById('form-edit-role').requestSubmit()">
                <i class="fas fa-save"></i> Save Changes
            </button>
        `;

        App.openModal();
    },

    handleEditRoleSubmit(e, roleId) {
        e.preventDefault();
        const role = window.LmsData?.roles?.find(r => r.id === roleId);
        if (!role) return;

        const name = document.getElementById('edit-role-name').value.trim();
        const urduTitle = document.getElementById('edit-role-urdu').value.trim();
        const badgeClass = document.getElementById('edit-role-badge').value;
        const description = document.getElementById('edit-role-desc').value.trim();

        role.name = name;
        role.urduTitle = urduTitle;
        role.badgeClass = badgeClass;
        role.description = description;

        window.DataStore.save(window.LmsData);
        App.closeModal();
        App.showToast(`Role '${name}' updated successfully!`, "success");
        App.navigate('roles');
    },

    deleteRole(roleId) {
        const role = window.LmsData?.roles?.find(r => r.id === roleId);
        if (!role) return;

        if (role.isSystem) {
            App.showToast("Core System Roles cannot be deleted.", "danger");
            return;
        }

        const assignedUsers = window.LmsData?.users?.filter(u => u.role === roleId) || [];
        if (assignedUsers.length > 0) {
            App.showToast(`Cannot delete role: ${assignedUsers.length} user(s) are currently assigned to this role. Please reassign them first.`, "warning");
            return;
        }

        const modalContainer = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        const modalFooter = document.getElementById('modal-footer-container');

        modalTitle.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i> Confirm Delete Role`;

        modalContainer.innerHTML = `
            <div style="padding: 10px 0;">
                <p style="color: #ffffff; font-size: 1rem; margin-bottom: 12px;">
                    Are you sure you want to permanently delete the custom role <strong>"${role.name}"</strong> (<code>${role.id}</code>)?
                </p>
                <p style="color: var(--text-muted); font-size: 0.85rem;">
                    This action will remove the role definition from the system and all assignable user forms.
                </p>
            </div>
        `;

        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn-danger" onclick="RolesModule.confirmDeleteRole('${roleId}')">
                <i class="fas fa-trash-alt"></i> Delete Role
            </button>
        `;

        App.openModal();
    },

    confirmDeleteRole(roleId) {
        window.LmsData.roles = (window.LmsData.roles || []).filter(r => r.id !== roleId);
        if (window.LmsData.roleModulePermissions) {
            delete window.LmsData.roleModulePermissions[roleId];
        }
        window.DataStore.save(window.LmsData);
        App.closeModal();
        App.showToast("Role deleted successfully.", "info");
        App.navigate('roles');
    },

    testRolePersona(roleId) {
        window.AuthRBAC.setRole(roleId);
        App.renderSidebar();
        App.showToast(`Switched active persona to: ${roleId.replace('_', ' ')}`, "gold");
        App.navigate('dashboard');
    },

    syncSystemDefaults() {
        const core = [
            {
                id: "SUPER_ADMIN",
                name: "Super Admin (Mohtamim)",
                urduTitle: "حضرت مہتمم / مجلس شوریٰ",
                badgeClass: "gold",
                description: "Full root administrative control over all LMS branches, faculty, scholars, exams, and financial accounts.",
                isSystem: true,
                permissions: ["*"],
                status: "ACTIVE"
            },
            {
                id: "ACADEMIC_ADMIN",
                name: "Academic Nazim",
                urduTitle: "ناظم تعلیمات",
                badgeClass: "info",
                description: "Administrative oversight of admissions, class allocations, syllabus, timetables, and academic rosters.",
                isSystem: true,
                permissions: ["admissions:manage", "classes:manage", "timetable:manage", "exams:manage"],
                status: "ACTIVE"
            },
            {
                id: "TEACHER",
                name: "Teacher (Sheikh-ul-Hadith)",
                urduTitle: "استاذ / شیخ الحدیث",
                badgeClass: "success",
                description: "Faculty access for assigned kitabs, live Zoom dars streaming, assignment grading, and attendance marking.",
                isSystem: true,
                permissions: ["classes:view_assigned", "attendance:mark", "assignments:grade", "virtual_class:host"],
                status: "ACTIVE"
            },
            {
                id: "STUDENT",
                name: "Student (Talib-e-Ilm)",
                urduTitle: "طالب علم",
                badgeClass: "primary",
                description: "Scholar access for daily academic dars, check-in attendance widget, homework submissions, and sanad results.",
                isSystem: true,
                permissions: ["classes:view_enrolled", "assignments:submit", "exams:submit", "attendance:checkin"],
                status: "ACTIVE"
            },
            {
                id: "ACCOUNTANT",
                name: "Accountant / Donor",
                urduTitle: "ناظم مالیات و صدقات",
                badgeClass: "warning",
                description: "Management of tuition fee challans, student fee concessions, and Jamia Ashrafia Zakat / Sadqah records.",
                isSystem: true,
                permissions: ["fees:manage", "challan:generate", "donations:record"],
                status: "ACTIVE"
            }
        ];

        const existingRoles = window.LmsData?.roles || [];
        core.forEach(cr => {
            const idx = existingRoles.findIndex(r => r.id === cr.id);
            if (idx === -1) {
                existingRoles.push(cr);
            } else {
                existingRoles[idx].isSystem = true;
                if (!existingRoles[idx].name) existingRoles[idx].name = cr.name;
                if (!existingRoles[idx].urduTitle) existingRoles[idx].urduTitle = cr.urduTitle;
            }
        });

        window.LmsData.roles = existingRoles;
        window.DataStore.save(window.LmsData);
        App.showToast("Core system roles synchronized successfully.", "success");
        App.navigate('roles');
    }
};

window.RolesModule = RolesModule;
