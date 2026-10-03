/**
 * JAMIA ASHRAFIA LAHORE - PERMISSION MANAGEMENT MODULE
 * Allows Super Admin to configure granular module availability per dynamic role
 * 
 * SYSTEM RULES:
 * 1. Super Admin is hard-coded/system-level with unrestricted root access (*) and cannot be edited.
 * 2. Super Admin is hidden from this permissions page.
 * 3. All other roles (Core and Custom) are dynamic and automatically appear here.
 * 4. Real-time synchronization with localStorage, Route Guards, and Backend Server API.
 */

const PermissionsModule = {
    selectedRoleTab: 'STUDENT',

    render() {
        const user = window.AuthRBAC.currentUser;
        const role = window.AuthRBAC.getRole();

        // RBAC Enforcement: Only Super Admin can view or edit permissions
        if (role !== 'SUPER_ADMIN') {
            return `
                <div class="card" style="border: 2px solid var(--danger); text-align: center; padding: 48px 24px;">
                    <i class="fas fa-lock" style="font-size: 3rem; color: var(--danger); margin-bottom: 16px;"></i>
                    <h2 style="color: var(--primary-950); margin-bottom: 8px;">403 - Administrative Access Required</h2>
                    <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto 20px;">
                        Only the Super Admin (Mohtamim) has authorization to inspect and configure role permissions for Jamia Ashrafia LMS.
                    </p>
                    <button class="btn btn-gold" onclick="App.navigate('dashboard')">
                        <i class="fas fa-arrow-left"></i> Return to Dashboard
                    </button>
                </div>
            `;
        }

        const allRoles = window.LmsData?.roles || [];
        // RULE 3 & 4: Super Admin is hidden; all other roles are dynamic
        const configurableRoles = allRoles.filter(r => r.id !== 'SUPER_ADMIN');

        // Ensure selected tab is valid among configurable roles
        if (!configurableRoles.some(r => r.id === this.selectedRoleTab)) {
            this.selectedRoleTab = configurableRoles.length > 0 ? configurableRoles[0].id : 'STUDENT';
        }

        if (!window.LmsData.roleModulePermissions) {
            window.LmsData.roleModulePermissions = {};
        }
        const permissions = window.LmsData.roleModulePermissions;

        // Auto-initialize default module permissions for any dynamic role if missing
        configurableRoles.forEach(r => {
            if (!permissions[r.id]) {
                permissions[r.id] = {
                    classes: true,
                    assignments: false,
                    exams: false,
                    timetable: true,
                    virtual_class: false,
                    notifications: true,
                    library: true,
                    attendance: true,
                    students: false,
                    reports: false,
                    admissions: false,
                    teachers: false,
                    fees: false,
                    heritage: true,
                    users: false,
                    roles: false,
                    permissions: false,
                    security: false
                };
                if (r.id === 'ACADEMIC_ADMIN') {
                    Object.assign(permissions[r.id], {
                        admissions: true, students: true, teachers: true, classes: true,
                        assignments: true, exams: true, timetable: true, virtual_class: true,
                        reports: true
                    });
                } else if (r.id === 'ACCOUNTANT') {
                    Object.assign(permissions[r.id], {
                        fees: true, reports: true
                    });
                } else if (r.id === 'TEACHER') {
                    Object.assign(permissions[r.id], {
                        assignments: true, exams: true, virtual_class: true,
                        teachers: true, students: true
                    });
                } else if (r.id === 'STUDENT') {
                    Object.assign(permissions[r.id], {
                        assignments: true, exams: true, virtual_class: true
                    });
                }
            }
        });

        // Ensure Super Admin permissions remain permanently full system-level
        if (!permissions.SUPER_ADMIN) permissions.SUPER_ADMIN = {};
        Object.keys(window.MODULE_DEFINITIONS || {}).forEach(m => {
            permissions.SUPER_ADMIN[m] = true;
        });

        return `
            <!-- HEADER -->
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-sliders-h" style="color: var(--gold-400);"></i>
                        Institutional RBAC & Role Permission Settings
                    </h1>
                    <p>Configure granular module access, feature visibility, and authorization policies for institutional roles</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-secondary btn-sm" onclick="PermissionsModule.resetToDefaults()">
                        <i class="fas fa-undo"></i> Reset All Defaults
                    </button>
                    <button class="btn btn-gold btn-sm" onclick="PermissionsModule.saveAll()">
                        <i class="fas fa-save"></i> Save & Apply Settings
                    </button>
                </div>
            </div>

            <!-- SECURITY NOTICE BANNER -->
            <div class="card" style="background: linear-gradient(135deg, rgba(6, 78, 59, 0.4) 0%, rgba(180, 83, 9, 0.15) 100%); border-left: 4px solid var(--gold-400); margin-bottom: 24px;">
                <div style="display: flex; gap: 16px; align-items: center;">
                    <div style="font-size: 2rem; color: var(--gold-400);"><i class="fas fa-shield-alt"></i></div>
                    <div>
                        <h4 style="color: var(--primary-950); margin-bottom: 4px;">Dynamic Policy Enforcement Active</h4>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">
                            <strong>Root System Protection:</strong> The <strong>Super Admin (Mohtamim)</strong> role has permanent, hard-coded full access (<code style="color: var(--gold-700); font-weight: 700;">*</code>) handled internally by the system and is omitted from configuration. 
                            All <strong>${configurableRoles.length} dynamic institutional roles</strong> below can be assigned granular module permissions. Newly created roles will automatically appear here.
                        </p>
                    </div>
                </div>
            </div>

            <!-- DYNAMIC ROLE SELECTION TABS -->
            <div class="role-tabs-container" style="display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap;">
                ${configurableRoles.map(r => {
                    const isSelected = (this.selectedRoleTab === r.id);
                    const icon = r.id === 'STUDENT' ? 'fa-user-graduate'
                               : r.id === 'TEACHER' ? 'fa-chalkboard-teacher'
                               : r.id === 'ACADEMIC_ADMIN' ? 'fa-user-tie'
                               : r.id === 'ACCOUNTANT' ? 'fa-calculator'
                               : 'fa-id-badge';
                    return `
                        <button class="btn ${isSelected ? 'btn-gold' : 'btn-secondary'}" 
                                onclick="PermissionsModule.switchTab('${r.id}')"
                                style="display: inline-flex; align-items: center; gap: 8px;">
                            <i class="fas ${icon}"></i>
                            <span>${r.name || r.title || r.id}</span>
                            ${r.urduTitle ? `<span style="font-family: 'Amiri', serif; font-size: 0.9em; opacity: 0.85;">(${r.urduTitle})</span>` : ''}
                        </button>
                    `;
                }).join('')}
            </div>

            <!-- ACTIVE ROLE PERMISSIONS MATRIX -->
            ${this.renderRoleMatrix(this.selectedRoleTab, permissions[this.selectedRoleTab] || {})}

            <!-- AUDIT & ARCHITECTURE FOOTER -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 24px;">
                <div class="card">
                    <div class="card-header">
                        <h4 class="card-title"><i class="fas fa-lock"></i> Multi-Tier Enforcement</h4>
                    </div>
                    <ul style="font-size: 0.82rem; color: var(--text-secondary); padding-left: 20px; line-height: 1.8;">
                        <li><strong>Navigation Guard:</strong> Sidebar links for disabled modules are hidden from UI.</li>
                        <li><strong>Router Guard:</strong> Direct manual URL entries (e.g. <code>#admissions</code>) render a 403 Forbidden screen.</li>
                        <li><strong>API Middleware:</strong> Server rejects unpermitted requests with HTTP 403 JSON payloads.</li>
                    </ul>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h4 class="card-title"><i class="fas fa-history"></i> Last Updated Policy</h4>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.8;">
                        <div><strong>Policy Admin:</strong> ${user.name} (Super Admin)</div>
                        <div><strong>Office:</strong> Hazrat Mohtamim Office (Ferozepur Rd)</div>
                        <div><strong>Sync Status:</strong> <span class="status-pill success"><i class="fas fa-check-circle"></i> Local & Server Synced</span></div>
                    </div>
                </div>
            </div>
        `;
    },

    switchTab(roleKey) {
        if (roleKey === 'SUPER_ADMIN') return;
        this.selectedRoleTab = roleKey;
        const viewport = document.getElementById('main-content-viewport');
        if (viewport) {
            viewport.innerHTML = this.render();
        }
    },

    renderRoleMatrix(roleKey, rolePerms) {
        const role = (window.LmsData?.roles || []).find(r => r.id === roleKey) || window.ROLES?.[roleKey] || { name: roleKey, title: roleKey, urduTitle: "" };
        const roleTitle = role.name || role.title || roleKey;
        const roleUrdu = role.urduTitle || "";
        const roleDesc = role.description || "Configure access permissions for this institutional role.";
        const moduleKeys = Object.keys(window.MODULE_DEFINITIONS || {});
        const currentPerms = rolePerms || {};

        return `
            <div class="card">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-user-shield" style="color: var(--gold-400);"></i>
                            Module Access Matrix for: <strong>${roleTitle}</strong>
                            <code style="font-size: 0.75rem; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; color: var(--primary-300);">${roleKey}</code>
                        </h3>
                        ${roleUrdu ? `
                            <div style="font-family: 'Amiri', serif; font-size: 1.1rem; color: var(--gold-200); margin-top: 4px;">
                                ${roleUrdu}
                            </div>
                        ` : ''}
                        ${roleDesc ? `
                            <p style="font-size: 0.82rem; color: var(--text-muted); margin: 4px 0 0 0; max-width: 600px;">
                                ${roleDesc}
                            </p>
                        ` : ''}
                    </div>
                    <div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-secondary btn-sm" onclick="PermissionsModule.quickSet('${roleKey}', true)">
                                <i class="fas fa-check-double"></i> Enable All
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="PermissionsModule.quickSet('${roleKey}', false)">
                                <i class="fas fa-ban"></i> Disable All
                            </button>
                        </div>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="width: 50px;">Icon</th>
                                <th>Module / Feature</th>
                                <th>Category / Context</th>
                                <th>Status</th>
                                <th style="text-align: right; width: 150px;">Access Permission</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${moduleKeys.map(modKey => {
                                const mod = window.MODULE_DEFINITIONS[modKey];
                                const isEnabled = (currentPerms[modKey] === true);

                                // Categorization
                                let category = "General";
                                if (['classes', 'assignments', 'exams', 'timetable', 'virtual_class', 'attendance'].includes(modKey)) category = "Academic & Attendance";
                                else if (['admissions', 'teachers', 'students', 'reports'].includes(modKey)) category = "Administration & Reports";
                                else if (['fees'].includes(modKey)) category = "Finance";
                                else if (['permissions', 'security', 'users', 'roles'].includes(modKey)) category = "System / RBAC";
                                else if (['library', 'heritage'].includes(modKey)) category = "Resources & Heritage";

                                return `
                                    <tr>
                                        <td style="text-align: center; color: var(--gold-400); font-size: 1.1rem;">
                                            <i class="${mod.icon}"></i>
                                        </td>
                                        <td>
                                            <div style="font-weight: 700; color: var(--primary-950);">${mod.title}</div>
                                            <div style="font-family: 'Amiri', serif; font-size: 0.95rem; color: var(--gold-700); font-weight: 700;">${mod.urdu}</div>
                                        </td>
                                        <td>
                                            <span class="status-pill" style="font-size: 0.72rem;">${category}</span>
                                        </td>
                                        <td>
                                            ${isEnabled ? `
                                                <span class="status-pill success"><i class="fas fa-check"></i> ON (Accessible)</span>
                                            ` : `
                                                <span class="status-pill danger"><i class="fas fa-ban"></i> OFF (Forbidden)</span>
                                            `}
                                        </td>
                                        <td style="text-align: right;">
                                            <label class="switch-toggle" style="display: inline-flex; align-items: center; cursor: pointer;">
                                                <input type="checkbox" ${isEnabled ? 'checked' : ''} 
                                                       onchange="PermissionsModule.toggle('${roleKey}', '${modKey}', this.checked)"
                                                       style="width: 20px; height: 20px; accent-color: var(--primary-500); cursor: pointer;">
                                                <span style="font-size: 0.8rem; margin-left: 8px; font-weight: 600; color: ${isEnabled ? 'var(--primary-300)' : 'var(--text-muted)'};">
                                                    ${isEnabled ? 'ENABLED' : 'DISABLED'}
                                                </span>
                                            </label>
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

    toggle(roleKey, modKey, isChecked) {
        if (roleKey === 'SUPER_ADMIN') {
            App.showToast("Super Admin permissions are hard-coded and cannot be modified.", "warning");
            return;
        }

        if (!window.LmsData.roleModulePermissions) {
            window.LmsData.roleModulePermissions = {};
        }
        if (!window.LmsData.roleModulePermissions[roleKey]) {
            window.LmsData.roleModulePermissions[roleKey] = {};
        }
        window.LmsData.roleModulePermissions[roleKey][modKey] = isChecked;

        // Auto persist locally
        window.DataStore.save(window.LmsData);
        App.renderSidebar();
        App.showToast(`Updated ${roleKey} access to [${window.MODULE_DEFINITIONS[modKey]?.title || modKey}] -> ${isChecked ? 'ON' : 'OFF'}`, isChecked ? 'success' : 'warning');

        // Refresh view
        const viewport = document.getElementById('main-content-viewport');
        if (viewport && App.currentRoute === 'permissions') {
            viewport.innerHTML = this.render();
        }
    },

    quickSet(roleKey, state) {
        if (roleKey === 'SUPER_ADMIN') {
            App.showToast("Super Admin permissions are hard-coded and cannot be modified.", "warning");
            return;
        }

        if (!window.LmsData.roleModulePermissions) window.LmsData.roleModulePermissions = {};
        if (!window.LmsData.roleModulePermissions[roleKey]) window.LmsData.roleModulePermissions[roleKey] = {};

        Object.keys(window.MODULE_DEFINITIONS || {}).forEach(k => {
            window.LmsData.roleModulePermissions[roleKey][k] = state;
        });

        window.DataStore.save(window.LmsData);
        App.renderSidebar();
        App.showToast(`All modules set to ${state ? 'ENABLED' : 'DISABLED'} for ${roleKey}`, state ? 'success' : 'warning');

        const viewport = document.getElementById('main-content-viewport');
        if (viewport && App.currentRoute === 'permissions') {
            viewport.innerHTML = this.render();
        }
    },

    async saveAll() {
        const success = await window.AuthRBAC.saveRolePermissions(window.LmsData.roleModulePermissions);
        if (success) {
            App.renderSidebar();
            App.showToast("All role permissions saved and synchronized with server!", "gold");
        }
    },

    resetToDefaults() {
        if (confirm("Are you sure you want to reset all role permissions to institutional defaults?")) {
            const allModules = Object.keys(window.MODULE_DEFINITIONS || {});
            const updated = { ...(window.LmsData.roleModulePermissions || {}) };

            // Student defaults
            updated.STUDENT = {
                classes: true,
                assignments: true,
                exams: true,
                timetable: true,
                virtual_class: true,
                notifications: true,
                library: true,
                attendance: true,
                students: false,
                reports: false,
                admissions: false,
                teachers: false,
                fees: false,
                heritage: true,
                users: false,
                roles: false,
                permissions: false,
                security: false
            };

            // Teacher defaults
            updated.TEACHER = {
                classes: true,
                assignments: true,
                exams: true,
                timetable: true,
                virtual_class: true,
                notifications: true,
                library: true,
                teachers: true,
                students: true,
                attendance: true,
                reports: false,
                admissions: false,
                fees: false,
                heritage: true,
                users: false,
                roles: false,
                permissions: false,
                security: false
            };

            // Academic Admin defaults
            updated.ACADEMIC_ADMIN = {
                admissions: true,
                students: true,
                teachers: true,
                classes: true,
                assignments: true,
                exams: true,
                timetable: true,
                virtual_class: true,
                attendance: true,
                notifications: true,
                reports: true,
                library: true,
                heritage: true,
                fees: false,
                users: false,
                roles: false,
                permissions: false,
                security: false
            };

            // Accountant defaults
            updated.ACCOUNTANT = {
                fees: true,
                reports: true,
                notifications: true,
                attendance: true,
                heritage: true,
                students: false,
                admissions: false,
                teachers: false,
                classes: false,
                assignments: false,
                exams: false,
                timetable: false,
                virtual_class: false,
                library: false,
                users: false,
                roles: false,
                permissions: false,
                security: false
            };

            // Super Admin: Permanent root access across all modules
            updated.SUPER_ADMIN = {};
            allModules.forEach(m => {
                updated.SUPER_ADMIN[m] = true;
            });

            window.LmsData.roleModulePermissions = updated;
            this.saveAll();
            const viewport = document.getElementById('main-content-viewport');
            if (viewport && App.currentRoute === 'permissions') {
                viewport.innerHTML = this.render();
            }
        }
    }
};

window.PermissionsModule = PermissionsModule;
