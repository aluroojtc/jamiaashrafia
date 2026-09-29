/**
 * JAMIA ASHRAFIA LAHORE - ROLE-BASED ACCESS CONTROL (RBAC) & AUTH
 * Manages active user context, role switching, and granular capability checks
 */

const ROLES = {
    SUPER_ADMIN: {
        id: "SUPER_ADMIN",
        title: "Super Admin (Hazrat Mohtamim)",
        urduTitle: "حضرت مہتمم / مجلس شوریٰ",
        badgeClass: "gold",
        permissions: ["*"] // Full system root access
    },
    ACADEMIC_ADMIN: {
        id: "ACADEMIC_ADMIN",
        title: "Academic Admin (Nazim-e-Taleemat)",
        urduTitle: "ناظم تعلیمات",
        badgeClass: "info",
        permissions: [
            "admissions:manage", "admissions:approve", "classes:manage",
            "teachers:manage", "courses:manage", "timetable:manage",
            "exams:manage", "exams:results_publish", "notifications:broadcast",
            "virtual_class:host", "library:view"
        ]
    },
    TEACHER: {
        id: "TEACHER",
        title: "Teacher (Sheikh-ul-Hadith / Ustad)",
        urduTitle: "استاذ / شیخ الحدیث",
        badgeClass: "success",
        permissions: [
            "classes:view_assigned", "attendance:mark", "assignments:create",
            "assignments:grade", "exams:grade", "virtual_class:host",
            "library:borrow", "notifications:class"
        ]
    },
    STUDENT: {
        id: "STUDENT",
        title: "Student (Talib-e-Ilm)",
        urduTitle: "طالب علم",
        badgeClass: "primary",
        permissions: [
            "classes:view_enrolled", "assignments:submit", "exams:submit",
            "results:view", "challan:download", "virtual_class:join",
            "library:search_reserve", "admissions:apply"
        ]
    },
    ACCOUNTANT: {
        id: "ACCOUNTANT",
        title: "Accountant (Nazim-e-Maliyat / Donor)",
        urduTitle: "ناظم مالیات و صدقات",
        badgeClass: "warning",
        permissions: [
            "fees:manage", "challan:generate", "challan:verify",
            "donations:record", "donations:receipt", "zakat:audit"
        ]
    }
};

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
    'permissions': 'permissions',
    'security': 'security'
};

const MODULE_DEFINITIONS = {
    students: { title: "Students Management", urdu: "شعبہ طلبہ و اکیڈمک ریکارڈ", icon: "fas fa-user-graduate" },
    users: { title: "Users Management", urdu: "نظام صارفین و اسناد", icon: "fas fa-users" },
    roles: { title: "Roles Management", urdu: "نظام ادوار و مناصب", icon: "fas fa-id-badge" },
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
    permissions: { title: "Role Permission Management", urdu: "نظام اختیارات و ترتیبات", icon: "fas fa-sliders-h" },
    security: { title: "Cloud Architecture & Specs", urdu: "سسٹم آرکیٹیکچر", icon: "fas fa-shield-alt" }
};

const AuthRBAC = {
    currentUser: null,

    init() {
        const savedUserId = localStorage.getItem('JAMIA_CURRENT_USER_ID');
        if (!savedUserId) {
            window.location.replace('login.html');
            return;
        }
        this.setUser(savedUserId);
        this.syncPermissionsFromServer();
    },

    async syncPermissionsFromServer() {
        try {
            const res = await fetch('/api/permissions');
            if (res.ok) {
                const data = await res.json();
                if (data && data.permissions && window.LmsData) {
                    window.LmsData.roleModulePermissions = {
                        ...window.LmsData.roleModulePermissions,
                        ...data.permissions
                    };
                    window.DataStore.save(window.LmsData);
                }
            }
        } catch (e) {
            // Server offline or static mode, use local permissions
        }
    },

    setUser(userId) {
        const users = window.LmsData.users;
        const found = users.find(u => u.id === userId);
        if (found) {
            this.currentUser = found;
            localStorage.setItem('JAMIA_CURRENT_USER_ID', userId);
        } else {
            this.currentUser = users[0];
            localStorage.setItem('JAMIA_CURRENT_USER_ID', users[0].id);
        }
        this.updateHeaderProfile();
        // Dispatch global user changed event
        window.dispatchEvent(new CustomEvent('lms:user_changed', { detail: this.currentUser }));
    },

    setRole(roleKey) {
        const foundUser = window.LmsData.users.find(u => u.role === roleKey);
        if (foundUser) {
            this.setUser(foundUser.id);
        } else {
            console.warn(`No mock user found for role: ${roleKey}`);
        }
    },

    getUser() {
        return this.currentUser;
    },

    getRole() {
        return this.currentUser ? this.currentUser.role : 'STUDENT';
    },

    can(permission) {
        if (!this.currentUser) return false;
        const activeRole = this.getRole();
        // Super Admin is permanently protected with unconditional root access
        if (activeRole === 'SUPER_ADMIN') return true;

        const dynamicRole = window.LmsData?.roles?.find(r => r.id === activeRole);
        const roleConfig = dynamicRole || ROLES[activeRole];
        if (!roleConfig) return false;
        if (roleConfig.permissions && roleConfig.permissions.includes("*")) return true;
        return roleConfig.permissions ? roleConfig.permissions.includes(permission) : false;
    },

    // Check if a specific module is accessible to the given role
    canAccessModule(moduleKey, role = null) {
        const activeRole = role || this.getRole();
        if (activeRole === 'SUPER_ADMIN') {
            return true; // Super admin has full root access by default, hard-coded at system level
        }
        const permissions = window.LmsData?.roleModulePermissions?.[activeRole];
        if (!permissions) return false;
        return permissions[moduleKey] === true;
    },

    // Check if the current user can access a route URL/hash
    canAccessRoute(route) {
        if (this.getRole() === 'SUPER_ADMIN') return true;
        const moduleKey = ROUTE_MODULE_MAP[route];
        if (!moduleKey) {
            // Routes without explicit module binding (e.g. 'dashboard') are allowed for all authenticated users
            return true;
        }
        return this.canAccessModule(moduleKey);
    },

    getModuleForRoute(route) {
        return ROUTE_MODULE_MAP[route] || null;
    },

    getModuleMeta(moduleKey) {
        return MODULE_DEFINITIONS[moduleKey] || { title: moduleKey, urdu: "", icon: "fas fa-cube" };
    },

    async saveRolePermissions(newPermissions) {
        if (!window.LmsData.roleModulePermissions) {
            window.LmsData.roleModulePermissions = {};
        }
        window.LmsData.roleModulePermissions = {
            ...window.LmsData.roleModulePermissions,
            ...newPermissions
        };

        // Guarantee Super Admin permanently retains unrestricted access across all modules
        if (!window.LmsData.roleModulePermissions.SUPER_ADMIN) {
            window.LmsData.roleModulePermissions.SUPER_ADMIN = {};
        }
        Object.keys(MODULE_DEFINITIONS).forEach(mod => {
            window.LmsData.roleModulePermissions.SUPER_ADMIN[mod] = true;
        });

        window.DataStore.save(window.LmsData);

        // Sync with backend API
        try {
            await fetch('/api/permissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Role': this.getRole()
                },
                body: JSON.stringify({ permissions: window.LmsData.roleModulePermissions })
            });
        } catch (e) {
            console.warn('Permissions server sync warning:', e);
        }

        // Dispatch update event to refresh UI
        window.dispatchEvent(new CustomEvent('lms:permissions_changed', { detail: window.LmsData.roleModulePermissions }));
        return true;
    },

    logout() {
        localStorage.removeItem('JAMIA_CURRENT_USER_ID');
        localStorage.removeItem('JAMIA_AUTH_TOKEN');
        try {
            fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {}
        window.location.replace('login.html');
    },

    isTeacher() {
        return this.currentUser?.role === 'TEACHER';
    },

    isStudent() {
        return this.currentUser?.role === 'STUDENT';
    },

    isSuperAdmin() {
        return this.currentUser?.role === 'SUPER_ADMIN';
    },

    isAdmin() {
        return this.currentUser?.role === 'SUPER_ADMIN' || this.currentUser?.role === 'ACADEMIC_ADMIN';
    },

    isAccountant() {
        return this.currentUser?.role === 'ACCOUNTANT';
    },

    updateHeaderProfile() {
        const nameEl = document.getElementById('header-user-name');
        const roleEl = document.getElementById('header-user-role');
        const avatarEl = document.getElementById('header-user-avatar');
        const selectorEl = document.getElementById('role-selector-dropdown');

        if (this.currentUser) {
            if (nameEl) nameEl.textContent = this.currentUser.name;
            if (roleEl) {
                const dynamicRole = window.LmsData?.roles?.find(r => r.id === this.currentUser.role);
                const roleDef = dynamicRole || ROLES[this.currentUser.role];
                roleEl.textContent = roleDef ? (roleDef.name || roleDef.title) : this.currentUser.role;
            }
            if (avatarEl) avatarEl.textContent = this.currentUser.avatar || 'JA';
            if (selectorEl) selectorEl.value = this.currentUser.role;
        }
    }
};

window.AuthRBAC = AuthRBAC;
window.ROLES = ROLES;
window.MODULE_DEFINITIONS = MODULE_DEFINITIONS;
window.ROUTE_MODULE_MAP = ROUTE_MODULE_MAP;
