/**
 * JAMIA ASHRAFIA LAHORE - SIGNED-IN USER & PERMISSIONS (browser side)
 *
 * Who is signed in and what they may do comes from the server (/api/auth/me). This file only uses that
 * answer to shape the screens: menus, pages and buttons. The server checks every action again, so hiding
 * something here is a convenience, never the protection.
 *
 *   AuthRBAC.can('exams.results.publish')   one permission
 *   AuthRBAC.canAny([...])                   any of several
 *   AuthRBAC.scope()                         'ALL' | 'TEACHING' | 'SELF' (the main role's data scope)
 *   AuthRBAC.wide('library.loans.issue')     held for the whole institution (a person may hold several roles,
 *                                            each permission keeps the widest scope it is held with)
 *   AuthRBAC.portal()                        'staff' | 'teacher' | 'student' (which version of a page to show)
 */

const ROUTE_MODULE_MAP = {
    'dashboard': null,
    'heritage': 'heritage',
    'admissions': 'admissions',
    'students': 'students',
    'classes': 'classes',
    'teachers': 'teachers',
    'attendance': 'attendance',
    'assignments': 'assignments',
    'exams': 'exams',
    'timetable': 'timetable',
    'virtual-class': 'virtual_class',
    'reports': 'reports',
    'users': 'users',
    'roles': 'roles',
    'fees': 'fees',
    'library': 'library',
    'notifications': 'notifications',
    'security': 'security'
};

const MODULE_DEFINITIONS = {
    students: { title: "Students Management", urdu: "شعبہ طلبہ و اکیڈمک ریکارڈ", icon: "fas fa-user-graduate" },
    users: { title: "Users Management", urdu: "نظام صارفین و اسناد", icon: "fas fa-users" },
    roles: { title: "Roles & Permissions", urdu: "نظام ادوار و مناصب", icon: "fas fa-id-badge" },
    attendance: { title: "Attendance & Check-In", urdu: "حاضری و نگرانی اوقات", icon: "fas fa-calendar-check" },
    reports: { title: "Executive Reports", urdu: "جامع رپورٹس و تجزیات", icon: "fas fa-chart-line" },
    classes: { title: "Classes & Curriculum", urdu: "شعبہ تدریس و نصاب", icon: "fas fa-chalkboard-teacher" },
    assignments: { title: "Assignments & Homework", urdu: "شعبہ واجبات و تمرینات", icon: "fas fa-edit" },
    exams: { title: "Exams & Wifaq Sanad", urdu: "شعبہ امتحانات و نتائج", icon: "fas fa-award" },
    timetable: { title: "Schedules & Timetable", urdu: "اوقاتِ تدریس", icon: "fas fa-calendar-alt" },
    virtual_class: { title: "Zoom Virtual Dars", urdu: "آن لائن تدریس و زوم روم", icon: "fas fa-video" },
    notifications: { title: "Broadcasts & Alerts", urdu: "اعلانات و اطلاعات", icon: "fas fa-bullhorn" },
    library: { title: "Maktaba Ashrafia (Library)", urdu: "مکتبہ اشرفیہ", icon: "fas fa-book-reader" },
    admissions: { title: "Student Admissions Management", urdu: "شعبہ داخلہ و رجسٹریشن", icon: "fas fa-user-plus" },
    teachers: { title: "Teachers & Faculty Management", urdu: "اساتذہ و انتظامیہ", icon: "fas fa-user-tie" },
    fees: { title: "Fees, Challans & Zakat", urdu: "فیس و کفالت فنڈ", icon: "fas fa-hand-holding-heart" },
    heritage: { title: "Institutional Heritage & Branches", urdu: "تاریخ جامعہ و شاخیں", icon: "fas fa-landmark" },
    security: { title: "Cloud Architecture & Specs", urdu: "سسٹم آرکیٹیکچر", icon: "fas fa-shield-alt" }
};

// A page opens when the user holds any of these permissions (an empty list: every signed-in user)
const MODULE_ACCESS = {
    heritage: ['heritage.view'],
    admissions: ['admissions.view'],
    students: ['students.view'],
    classes: ['classes.view'],
    teachers: ['teachers.view'],
    attendance: ['attendance.view', 'attendance.self_checkin'],
    assignments: ['assignments.view'],
    exams: ['exams.view'],
    timetable: ['timetable.view'],
    virtual_class: ['virtual_classes.view'],
    reports: ['reports.academic', 'reports.attendance', 'reports.finance', 'reports.admissions', 'reports.library'],
    users: ['users.view'],
    roles: ['roles.view'],
    fees: ['fees.challans.view', 'fees.structures.view', 'donations.view'],
    library: ['library.catalog.view'],
    notifications: [],
    security: ['settings.architecture']
};

// Old capability names still used in a few places; they map onto catalog permissions
const LEGACY_PERMISSION_ALIASES = {
    'admissions:manage': 'admissions.update', 'admissions:approve': 'admissions.decide',
    'classes:manage': 'classes.manage', 'courses:manage': 'courses.manage', 'teachers:manage': 'teachers.update',
    'timetable:manage': 'timetable.manage', 'exams:manage': 'exams.update', 'exams:grade': 'exams.mark',
    'exams:results_publish': 'exams.results.publish', 'assignments:create': 'assignments.create',
    'assignments:grade': 'assignments.grade', 'attendance:mark': 'attendance.mark',
    'notifications:broadcast': 'notifications.broadcast_role', 'notifications:class': 'notifications.send_class',
    'virtual_class:host': 'virtual_classes.host', 'library:manage': 'library.loans.issue', 'fees:manage': 'fees.challans.generate',
    'challan:generate': 'fees.challans.generate', 'challan:verify': 'fees.challans.verify', 'donations:record': 'donations.record'
};

const AuthRBAC = {
    currentUser: null,
    // { role, roles: [...], scope, permissions: Set, scopes: { permission: scope }, isSuperAdmin, preview }
    session: { role: null, roles: [], scope: 'SELF', permissions: new Set(), scopes: {}, isSuperAdmin: false, preview: null },

    /**
     * Asks the server who is signed in (the session cookie is the only proof of identity) and what they may do.
     * Returns the user, or null after redirecting to the login page, or 'offline' when the server cannot be reached.
     */
    async verifySession() {
        let res;
        try {
            res = await fetch('/api/auth/me', { cache: 'no-store' });
        } catch (e) {
            return 'offline';
        }
        if (res.status === 401) {
            localStorage.removeItem('JAMIA_CURRENT_USER_ID');
            window.location.replace('login.html');
            return null;
        }
        if (!res.ok) return 'offline';
        const data = await res.json().catch(() => null);
        if (!data) return 'offline';
        if (!data.user) {
            localStorage.removeItem('JAMIA_CURRENT_USER_ID');
            window.location.replace('login.html');
            return null;
        }
        if (data.mustChangePassword) {
            window.location.replace('login.html#change-password');
            return null;
        }
        // A different account signed in on this browser (e.g. in another tab): never show the previous person's data
        const previousId = localStorage.getItem('JAMIA_CURRENT_USER_ID');
        if (previousId && previousId !== data.user.id) window.DataStore.clearLocal();
        const users = window.LmsData.users = window.LmsData.users || [];
        const i = users.findIndex(u => u.id === data.user.id);
        if (i >= 0) users[i] = { ...users[i], ...data.user };
        else users.push(data.user);
        localStorage.setItem('JAMIA_CURRENT_USER_ID', data.user.id);
        this.applySession(data);
        return data.user;
    },

    applySession(data) {
        this.session = {
            role: data.role || null,
            roles: data.roles || (data.role ? [data.role] : []),
            scope: data.scope || 'SELF',
            permissions: new Set(data.permissions || []),
            scopes: data.scopes || {},
            isSuperAdmin: !!data.isSuperAdmin,
            preview: data.preview || null
        };
        // Previewing a role is read-only: the browser keeps nothing to send later
        if (window.DataStore && window.DataStore.setReadOnly) window.DataStore.setReadOnly(!!this.session.preview);
        this.renderPreviewBanner();
    },

    // A Super Admin previewing a role sees a banner with the way back
    renderPreviewBanner() {
        const existing = document.getElementById('preview-banner');
        const p = this.session.preview;
        if (!p) {
            if (existing) existing.remove();
            return;
        }
        const roleName = (this.session.role && this.session.role.name) || p.roleId;
        const html = `<div id="preview-banner" role="status" style="position: sticky; top: 0; z-index: 1000; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center; padding: 8px 16px; background: #7c2d12; color: #fff7ed; font-size: 0.88rem;">
                <span><i class="fas fa-eye"></i> Previewing <strong>${Lms.esc(roleName)}</strong>${p.userName ? ` as <strong>${Lms.esc(p.userName)}</strong>` : ''}. Read-only: nothing you do here is saved.</span>
                <button class="btn btn-gold btn-sm" onclick="AuthRBAC.endPreview()"><i class="fas fa-sign-out-alt"></i> Leave preview</button>
            </div>`;
        if (existing) existing.outerHTML = html;
        else document.body.insertAdjacentHTML('afterbegin', html);
    },

    async startPreview(roleId, userId) {
        const res = await fetch('/api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleId, userId }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (window.App) window.App.showToast(data.error || 'The preview could not start.', 'danger');
            return;
        }
        window.DataStore.clearLocal();
        window.location.replace('index.html#dashboard');
        window.location.reload();
    },

    async endPreview() {
        await fetch('/api/preview', { method: 'DELETE' }).catch(() => {});
        // Anything changed in the browser during the preview is thrown away
        window.DataStore.clearLocal();
        window.location.replace('index.html#roles');
        window.location.reload();
    },

    // Picks up permission changes made by an administrator while this page is open
    async refreshSession() {
        try {
            const res = await fetch('/api/auth/me', { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            if (!data.user) {
                window.location.replace('login.html?expired=1');
                return;
            }
            if (data.mustChangePassword) {
                window.location.replace('login.html#change-password');
                return;
            }
            const sig = s => `${(s.roles || []).map(r => r.id).join('+')}|${s.scope}|${JSON.stringify(s.scopes || {})}|${s.preview ? s.preview.roleId : ''}`;
            const before = sig(this.session);
            this.applySession(data);
            const after = sig(this.session);
            if (before !== after) {
                await this.loadRoles();
                window.dispatchEvent(new CustomEvent('lms:permissions_changed', { detail: this.session }));
            }
        } catch (e) {
            // Offline for a moment: keep the current permissions
        }
    },

    // Role names for display (and, for those who manage roles, what each role may do)
    async loadRoles() {
        try {
            const res = await fetch('/api/roles', { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            if (Array.isArray(data.roles)) {
                window.LmsData.roles = [
                    { id: 'SUPER_ADMIN', name: 'Super Admin (Mohtamim)', urduTitle: 'حضرت مہتمم / مجلس شوریٰ', badgeClass: 'gold', scope: 'ALL', isSystem: true, userCount: data.superAdminUsers || 0 },
                    ...data.roles
                ];
                this.updateHeaderProfile();
            }
        } catch (e) {
            // Keep the names already known
        }
    },

    init() {
        const savedUserId = localStorage.getItem('JAMIA_CURRENT_USER_ID');
        if (!savedUserId || !this.setUser(savedUserId)) {
            // Unknown or removed account: never fall back to another user's identity
            this.logout();
            return false;
        }
        this.loadRoles();
        // Permission changes reach open pages within a minute, or at once when the window regains focus
        if (!this.refreshTimer) {
            this.refreshTimer = setInterval(() => { if (document.visibilityState === 'visible') this.refreshSession(); }, 60000);
            window.addEventListener('focus', () => this.refreshSession());
        }
        return true;
    },

    setUser(userId) {
        const users = window.LmsData.users;
        const found = users.find(u => u.id === userId);
        if (!found) return false;
        this.currentUser = found;
        localStorage.setItem('JAMIA_CURRENT_USER_ID', userId);
        this.updateHeaderProfile();
        window.dispatchEvent(new CustomEvent('lms:user_changed', { detail: this.currentUser }));
        return true;
    },

    // Re-point at the freshest copy of the signed-in user after a data sync
    refreshCurrentUser() {
        if (!this.currentUser) return;
        const fresh = (window.LmsData.users || []).find(u => u.id === this.currentUser.id);
        if (!fresh) {
            this.logout();
            return;
        }
        if (fresh.status === 'SUSPENDED' || fresh.status === 'INACTIVE') {
            alert('Your account has been ' + fresh.status.toLowerCase() + '. Please contact the Academic Office.');
            this.logout();
            return;
        }
        const roleChanged = fresh.role !== this.currentUser.role;
        this.currentUser = fresh;
        this.updateHeaderProfile();
        if (roleChanged) this.refreshSession();
    },

    getUser() {
        return this.currentUser;
    },

    getRole() {
        return this.currentUser ? this.currentUser.role : '';
    },

    // ---------------------------------------------------------------------
    // Permissions
    // ---------------------------------------------------------------------
    can(permission) {
        if (!this.currentUser) return false;
        if (this.session.isSuperAdmin) return true;
        const key = LEGACY_PERMISSION_ALIASES[permission] || permission;
        return this.session.permissions.has(key);
    },

    canAny(permissions) {
        return (permissions || []).some(p => this.can(p));
    },

    // The scope a permission is held with ('ALL' | 'TEACHING' | 'SELF'), or null when not held
    scopeFor(permission) {
        if (this.session.isSuperAdmin) return 'ALL';
        const key = LEGACY_PERMISSION_ALIASES[permission] || permission;
        return this.session.scopes[key] || null;
    },

    // Held for the whole institution (e.g. a teacher who is also Librarian issues books to anyone)
    wide(permission) {
        return this.scopeFor(permission) === 'ALL';
    },

    // The role's data scope: 'ALL' (whole institution), 'TEACHING' (classes they teach), 'SELF' (own records)
    scope() {
        return this.session.isSuperAdmin ? 'ALL' : (this.session.scope || 'SELF');
    },

    // Which version of a page to show: the office ('staff'), the teacher portal or the student portal
    portal() {
        const s = this.scope();
        return s === 'ALL' ? 'staff' : (s === 'TEACHING' ? 'teacher' : 'student');
    },

    canAccessModule(moduleKey) {
        if (this.session.isSuperAdmin) return true;
        const needs = MODULE_ACCESS[moduleKey];
        if (!needs) return false;
        return !needs.length || this.canAny(needs);
    },

    canAccessRoute(route) {
        const moduleKey = ROUTE_MODULE_MAP[route];
        // Routes without a module (e.g. the dashboard) are open to every signed-in user
        if (!moduleKey) return true;
        return this.canAccessModule(moduleKey);
    },

    getModuleForRoute(route) {
        return ROUTE_MODULE_MAP[route] || null;
    },

    getModuleMeta(moduleKey) {
        return MODULE_DEFINITIONS[moduleKey] || { title: moduleKey, urdu: "", icon: "fas fa-cube" };
    },

    roleInfo(roleId) {
        return (window.LmsData?.roles || []).find(r => r.id === roleId) || { id: roleId, name: String(roleId || '').replace(/_/g, ' '), badgeClass: 'info' };
    },

    roleName(roleId) {
        const r = this.roleInfo(roleId);
        return r.name || r.title || roleId;
    },

    isSuperAdmin() {
        return !!this.session.isSuperAdmin;
    },

    // Portal checks (data scope), used to choose page layouts, not to grant anything
    isTeacher() {
        return this.portal() === 'teacher';
    },

    isStudent() {
        return this.portal() === 'student';
    },

    async logout() {
        // Hand any unsent changes to the server before the identity is cleared
        if (this.currentUser && window.DataStore && window.DataStore.syncNow) {
            await Promise.race([window.DataStore.syncNow(), new Promise(r => setTimeout(r, 2500))]);
        }
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {}
        // Nothing of this person's data stays in the browser (shared computers in offices and labs)
        if (window.DataStore && window.DataStore.clearLocal) window.DataStore.clearLocal();
        localStorage.removeItem('JAMIA_CURRENT_USER_ID');
        localStorage.removeItem('JAMIA_AUTH_TOKEN');
        window.location.replace('login.html');
    },

    updateHeaderProfile() {
        const nameEl = document.getElementById('header-user-name');
        const roleEl = document.getElementById('header-user-role');
        const avatarEl = document.getElementById('header-user-avatar');
        if (this.currentUser) {
            if (nameEl) nameEl.textContent = this.currentUser.name;
            if (roleEl) {
                const names = (this.session.roles || []).map(r => r.name);
                roleEl.textContent = names.length ? names.join(' + ') : this.roleName(this.currentUser.role);
            }
            if (avatarEl) avatarEl.textContent = this.currentUser.avatar || 'JA';
        }
    }
};

window.AuthRBAC = AuthRBAC;
window.MODULE_DEFINITIONS = MODULE_DEFINITIONS;
window.ROUTE_MODULE_MAP = ROUTE_MODULE_MAP;
