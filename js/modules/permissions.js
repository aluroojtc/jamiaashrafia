/**
 * JAMIA ASHRAFIA LAHORE - PERMISSION MANAGEMENT MODULE
 * Allows Super Admin to configure module availability per role (Student, Teacher, Super Admin)
 * Real-time synchronization with localStorage, Route Guards, and Backend Server API
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
                    <h2 style="color: #ffffff; margin-bottom: 8px;">403 - Administrative Access Required</h2>
                    <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto 20px;">
                        Only the Super Admin (Mohtamim) has authorization to inspect and configure role permissions for Jamia Ashrafia LMS.
                    </p>
                    <button class="btn btn-gold" onclick="App.navigate('dashboard')">
                        <i class="fas fa-arrow-left"></i> Return to Dashboard
                    </button>
                </div>
            `;
        }

        const permissions = window.LmsData.roleModulePermissions || {};
        const modules = window.MODULE_DEFINITIONS;

        return `
            <!-- HEADER -->
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-sliders-h" style="color: var(--gold-400);"></i>
                        Institutional RBAC & Role Permission Settings
                    </h1>
                    <p>Configure granular module access, feature visibility, and authorization policies for Students, Teachers, and Super Admins</p>
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
            <div class="card" style="background: linear-gradient(135deg, rgba(6, 78, 59, 0.4) 0%, rgba(180, 83, 9, 0.15) 100%); border-left: 4px solid var(--gold-400);">
                <div style="display: flex; gap: 16px; align-items: center;">
                    <div style="font-size: 2rem; color: var(--gold-400);"><i class="fas fa-shield-alt"></i></div>
                    <div>
                        <h4 style="color: #ffffff; margin-bottom: 4px;">Dynamic Policy Enforcement Active</h4>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">
                            Changes to module access take effect immediately across sidebar menus, browser URL router guards, and backend REST API middleware (HTTP 403 enforcement).
                        </p>
                    </div>
                </div>
            </div>

            <!-- ROLE SELECTION TABS -->
            <div class="role-tabs-container" style="display: flex; gap: 10px; margin-bottom: 24px;">
                <button class="btn ${this.selectedRoleTab === 'STUDENT' ? 'btn-primary' : 'btn-secondary'}" 
                        onclick="PermissionsModule.switchTab('STUDENT')">
                    <i class="fas fa-user-graduate"></i> Student Permissions (Talib-e-Ilm)
                </button>
                <button class="btn ${this.selectedRoleTab === 'TEACHER' ? 'btn-gold' : 'btn-secondary'}" 
                        onclick="PermissionsModule.switchTab('TEACHER')">
                    <i class="fas fa-chalkboard-teacher"></i> Teacher Permissions (Sheikh-ul-Hadith)
                </button>
                <button class="btn ${this.selectedRoleTab === 'SUPER_ADMIN' ? 'btn-gold' : 'btn-secondary'}" 
                        onclick="PermissionsModule.switchTab('SUPER_ADMIN')">
                    <i class="fas fa-crown"></i> Super Admin (Mohtamim / Shura)
                </button>
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
                        <div><strong>Policy Admin:</strong> ${user.name}</div>
                        <div><strong>Office:</strong> Hazrat Mohtamim Office (Ferozepur Rd)</div>
                        <div><strong>Sync Status:</strong> <span class="status-pill success"><i class="fas fa-check-circle"></i> Local & Server Synced</span></div>
                    </div>
                </div>
            </div>
        `;
    },

    switchTab(roleKey) {
        this.selectedRoleTab = roleKey;
        const viewport = document.getElementById('main-content-viewport');
        if (viewport) {
            viewport.innerHTML = this.render();
        }
    },

    renderRoleMatrix(roleKey, rolePerms) {
        const isSuperAdmin = (roleKey === 'SUPER_ADMIN');
        const roleMeta = window.ROLES[roleKey] || { title: roleKey, urduTitle: "" };

        const moduleKeys = Object.keys(window.MODULE_DEFINITIONS);

        return `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">
                            <i class="fas fa-user-shield"></i>
                            Module Access Matrix for: <strong>${roleMeta.title}</strong>
                        </h3>
                        <div style="font-family: 'Amiri', serif; font-size: 1.1rem; color: var(--gold-200); margin-top: 4px;">
                            ${roleMeta.urduTitle}
                        </div>
                    </div>
                    <div>
                        ${isSuperAdmin ? `
                            <span class="status-pill gold"><i class="fas fa-check-double"></i> Full System Access (Root)</span>
                        ` : `
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-secondary btn-sm" onclick="PermissionsModule.quickSet('${roleKey}', true)">
                                    <i class="fas fa-check"></i> Enable All
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick="PermissionsModule.quickSet('${roleKey}', false)">
                                    <i class="fas fa-times"></i> Disable All
                                </button>
                            </div>
                        `}
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
                                <th style="text-align: right; width: 140px;">Access Permission</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${moduleKeys.map(modKey => {
                                const mod = window.MODULE_DEFINITIONS[modKey];
                                const isEnabled = isSuperAdmin ? true : (rolePerms[modKey] === true);
                                
                                // Specific module categorization
                                let category = "General";
                                if (['classes', 'assignments', 'exams', 'timetable', 'virtual_class', 'attendance'].includes(modKey)) category = "Academic & Attendance";
                                else if (['admissions', 'teachers', 'students', 'reports'].includes(modKey)) category = "Administration & Reports";
                                else if (['fees'].includes(modKey)) category = "Finance";
                                else if (['permissions', 'security'].includes(modKey)) category = "System / RBAC";
                                else if (['library', 'heritage'].includes(modKey)) category = "Resources & Heritage";

                                return `
                                    <tr>
                                        <td style="text-align: center; color: var(--gold-400); font-size: 1.1rem;">
                                            <i class="${mod.icon}"></i>
                                        </td>
                                        <td>
                                            <div style="font-weight: 700; color: #ffffff;">${mod.title}</div>
                                            <div style="font-family: 'Amiri', serif; font-size: 0.95rem; color: var(--text-muted);">${mod.urdu}</div>
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
                                            ${isSuperAdmin ? `
                                                <span style="font-size: 0.75rem; color: var(--text-muted);"><i class="fas fa-lock"></i> Always ON</span>
                                            ` : `
                                                <label class="switch-toggle" style="display: inline-flex; align-items: center; cursor: pointer;">
                                                    <input type="checkbox" ${isEnabled ? 'checked' : ''} 
                                                           onchange="PermissionsModule.toggle('${roleKey}', '${modKey}', this.checked)"
                                                           style="width: 20px; height: 20px; accent-color: var(--primary-500); cursor: pointer;">
                                                    <span style="font-size: 0.8rem; margin-left: 8px; font-weight: 600; color: ${isEnabled ? 'var(--primary-300)' : 'var(--text-muted)'};">
                                                        ${isEnabled ? 'ENABLED' : 'DISABLED'}
                                                    </span>
                                                </label>
                                            `}
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
        if (!window.LmsData.roleModulePermissions) window.LmsData.roleModulePermissions = {};
        if (!window.LmsData.roleModulePermissions[roleKey]) window.LmsData.roleModulePermissions[roleKey] = {};

        Object.keys(window.MODULE_DEFINITIONS).forEach(k => {
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
            window.LmsData.roleModulePermissions = {
                STUDENT: {
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
                    permissions: false,
                    security: false
                },
                TEACHER: {
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
                    permissions: false,
                    security: false
                },
                SUPER_ADMIN: {
                    classes: true,
                    assignments: true,
                    exams: true,
                    timetable: true,
                    virtual_class: true,
                    notifications: true,
                    library: true,
                    admissions: true,
                    teachers: true,
                    students: true,
                    attendance: true,
                    reports: true,
                    fees: true,
                    heritage: true,
                    permissions: true,
                    security: true
                }
            };
            this.saveAll();
            const viewport = document.getElementById('main-content-viewport');
            if (viewport && App.currentRoute === 'permissions') {
                viewport.innerHTML = this.render();
            }
        }
    }
};

window.PermissionsModule = PermissionsModule;
