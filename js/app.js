/**
 * JAMIA ASHRAFIA LAHORE - CLOUD LMS APP CONTROLLER & ROUTER
 * Role-Based Dashboards, Dynamic RBAC Sidebar, 403 Forbidden Guards & User Navigation
 */

const App = {
    currentRoute: 'dashboard',
    usersPermissionsSubmenuOpen: false,

    toggleNavSubmenu(id) {
        const submenu = document.getElementById('submenu-' + id);
        const caret = document.getElementById('caret-' + id);
        if (!submenu) return;
        const isClosed = submenu.style.display === 'none' || (!submenu.classList.contains('open') && submenu.style.display !== 'flex');
        if (isClosed) {
            submenu.style.display = 'flex';
            submenu.classList.add('open');
            if (caret) caret.style.transform = 'rotate(180deg)';
        } else {
            submenu.style.display = 'none';
            submenu.classList.remove('open');
            if (caret) caret.style.transform = 'rotate(0deg)';
        }
        if (id === 'users-permissions') {
            this.usersPermissionsSubmenuOpen = isClosed;
        }
    },

    /**
     * Resets scroll position to (0, 0) across all document and viewport containers
     * Guarantees every navigated page opens at the top immediately.
     */
    resetScrollToTop() {
        const doReset = () => {
            // 1. Primary content viewport
            const viewport = document.getElementById('main-content-viewport');
            if (viewport) {
                viewport.scrollTop = 0;
                viewport.scrollLeft = 0;
                if (typeof viewport.scrollTo === 'function') {
                    try {
                        viewport.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                    } catch (e) {
                        viewport.scrollTo(0, 0);
                    }
                }
            }

            // 2. Body, HTML, and App Layout containers
            const appBody = document.querySelector('.app-body');
            if (appBody) {
                appBody.scrollTop = 0;
                appBody.scrollLeft = 0;
            }

            const appContainer = document.getElementById('app-container');
            if (appContainer) {
                appContainer.scrollTop = 0;
                appContainer.scrollLeft = 0;
            }

            // 3. Window & Document root
            if (typeof window.scrollTo === 'function') {
                try {
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                } catch (e) {
                    window.scrollTo(0, 0);
                }
            }
            if (document.documentElement) {
                document.documentElement.scrollTop = 0;
                document.documentElement.scrollLeft = 0;
            }
            if (document.body) {
                document.body.scrollTop = 0;
                document.body.scrollLeft = 0;
            }
        };

        // 1. Immediate synchronous reset
        doReset();

        // 2. Next animation frame (DOM render phase)
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
                doReset();
                // 3. Post-paint second frame
                requestAnimationFrame(doReset);
            });
        }

        // 4. Macro-task delays for async layout adjustments or image rendering
        setTimeout(doReset, 0);
        setTimeout(doReset, 25);
        setTimeout(doReset, 80);
    },

    init() {
        console.log("Initializing Jamia Ashrafia Cloud LMS with Multi-Tier RBAC...");
        
        // Prevent browser from automatically restoring scroll position on hash navigation
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }

        window.AuthRBAC.init();
        this.renderSidebar();
        this.bindEvents();
        this.updateNotificationBadge();
        // Poll so admins see new admission notifications without reloading the page
        setInterval(() => this.updateNotificationBadge(), 30000);
        this.syncMasterData();
        if (window.PrayerTimesService) {
            window.PrayerTimesService.calculateAndRefresh();
        }

        // Support direct hash navigation on initial page load
        const initialRoute = window.location.hash.replace('#', '') || 'dashboard';
        this.navigate(initialRoute);
    },

    bindEvents() {
        // Hash change navigation for bookmarking and direct URL testing
        window.addEventListener('hashchange', () => {
            const route = window.location.hash.replace('#', '') || 'dashboard';
            if (route !== this.currentRoute) {
                this.navigate(route);
            }
        });

        // Role Switcher in Header (for instant testing of all roles)
        const roleSelector = document.getElementById('role-selector-dropdown');
        if (roleSelector) {
            roleSelector.addEventListener('change', (e) => {
                window.AuthRBAC.setRole(e.target.value);
                this.renderSidebar();
                this.showToast(`Switched active role to: ${e.target.value.replace('_', ' ')}`, "gold");
                // Return to dashboard upon role change to guarantee safe view
                this.navigate('dashboard');
            });
        }

        // Global Navigation Click delegation (supports data-route and internal hash navigation)
        document.addEventListener('click', (e) => {
            const navLink = e.target.closest('[data-route], a[href^="#"]');
            if (navLink && !navLink.classList.contains('nav-parent-item')) {
                const route = navLink.getAttribute('data-route') || (navLink.getAttribute('href') && navLink.getAttribute('href').replace('#', ''));
                if (route && !route.startsWith('!') && route !== '') {
                    e.preventDefault();
                    if (window.location.hash !== '#' + route) {
                        window.location.hash = route;
                    }
                    this.navigate(route);
                }
            }

            // Close user menu dropdown if clicked outside
            const profileBtn = e.target.closest('.user-profile-btn');
            const dropdown = document.getElementById('header-user-dropdown');
            if (!profileBtn && dropdown && !e.target.closest('#header-user-dropdown')) {
                dropdown.classList.remove('open');
            }
        });

        // User profile button dropdown toggle
        const userProfileBtn = document.querySelector('.user-profile-btn');
        if (userProfileBtn) {
            userProfileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleUserDropdown();
            });
        }

        // Listen for user changed event
        window.addEventListener('lms:user_changed', () => {
            this.renderSidebar();
            this.navigate(this.currentRoute);
        });

        // Listen for permissions changed event
        window.addEventListener('lms:permissions_changed', () => {
            this.renderSidebar();
            // Re-verify current route
            if (!window.AuthRBAC.canAccessRoute(this.currentRoute)) {
                this.navigate(this.currentRoute); // will trigger 403
            }
        });

        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                const dropdown = document.getElementById('header-user-dropdown');
                if (dropdown) dropdown.classList.remove('open');
            }
        });
    },

    toggleUserDropdown() {
        const dropdown = document.getElementById('header-user-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('open');
        }
    },

    // Dynamically builds the sidebar according to role-based module permissions
    renderSidebar() {
        const sidebarNav = document.querySelector('#app-sidebar .sidebar-nav');
        if (!sidebarNav) return;

        const role = window.AuthRBAC.getRole();
        const can = (modKey) => window.AuthRBAC.canAccessModule(modKey, role);

        let html = '';

        if (role === 'SUPER_ADMIN') {
            html += `
                <div class="nav-section-title">Executive Control</div>
                <a href="#dashboard" class="nav-item ${this.currentRoute === 'dashboard' ? 'active' : ''}" data-route="dashboard">
                    <i class="fas fa-tachometer-alt"></i>
                    <span>Super Admin Dashboard</span>
                </a>

                <!-- Users & Permissions with exactly three submenus: Users, Roles, Permissions -->
                <div class="nav-group-wrapper">
                    <div class="nav-item nav-parent-item ${['users', 'roles', 'permissions'].includes(this.currentRoute) ? 'active' : ''}" 
                         onclick="App.toggleNavSubmenu('users-permissions')" 
                         id="parent-nav-users-permissions"
                         title="Manage LMS Users, Configured Roles & Module Permissions"
                         style="cursor: pointer;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fas fa-user-shield" style="color: var(--gold-400);"></i>
                            <span>Users & Permissions</span>
                        </div>
                        <i class="fas fa-chevron-down submenu-caret" id="caret-users-permissions" 
                           style="${this.usersPermissionsSubmenuOpen ? 'transform: rotate(180deg);' : 'transform: rotate(0deg);'}"></i>
                    </div>
                    <div class="nav-submenu-list ${this.usersPermissionsSubmenuOpen ? 'open' : ''}" id="submenu-users-permissions" 
                         style="display: ${this.usersPermissionsSubmenuOpen ? 'flex' : 'none'};">
                        <a href="#users" class="nav-item ${this.currentRoute === 'users' ? 'active' : ''}" data-route="users">
                            <i class="fas fa-users" style="color: var(--primary-400);"></i>
                            <span>Users</span>
                        </a>
                        <a href="#roles" class="nav-item ${this.currentRoute === 'roles' ? 'active' : ''}" data-route="roles">
                            <i class="fas fa-id-badge" style="color: var(--gold-300);"></i>
                            <span>Roles</span>
                        </a>
                        <a href="#permissions" class="nav-item ${this.currentRoute === 'permissions' ? 'active' : ''}" data-route="permissions">
                            <i class="fas fa-sliders-h" style="color: var(--warning);"></i>
                            <span>Permissions</span>
                            <span class="badge-pill gold" style="font-size: 0.65rem; padding: 1px 6px;">RBAC</span>
                        </a>
                    </div>
                </div>

                <a href="#heritage" class="nav-item ${this.currentRoute === 'heritage' ? 'active' : ''}" data-route="heritage">
                    <i class="fas fa-landmark"></i>
                    <span>Institutional Heritage</span>
                    <span class="badge-pill">1947</span>
                </a>

                <div class="nav-section-title">Students & Faculty</div>
                <a href="#students" class="nav-item ${this.currentRoute === 'students' ? 'active' : ''}" data-route="students">
                    <i class="fas fa-user-graduate" style="color: var(--primary-400);"></i>
                    <span>Students Management</span>
                </a>
                <a href="#admissions" class="nav-item ${this.currentRoute === 'admissions' ? 'active' : ''}" data-route="admissions">
                    <i class="fas fa-user-plus"></i>
                    <span>Student Admissions</span>
                    <span class="badge-pill gold" id="sidebar-adm-badge">Queue</span>
                </a>
                <a href="#classes" class="nav-item ${this.currentRoute === 'classes' ? 'active' : ''}" data-route="classes">
                    <i class="fas fa-chalkboard-teacher"></i>
                    <span>Classes & Curriculum</span>
                </a>
                <a href="#teachers" class="nav-item ${this.currentRoute === 'teachers' ? 'active' : ''}" data-route="teachers">
                    <i class="fas fa-user-tie"></i>
                    <span>Teachers & Portals</span>
                </a>

                <div class="nav-section-title">Academic & Attendance</div>
                <a href="#attendance" class="nav-item ${this.currentRoute === 'attendance' ? 'active' : ''}" data-route="attendance">
                    <i class="fas fa-calendar-check" style="color: var(--gold-400);"></i>
                    <span>Attendance Monitoring</span>
                    <span class="badge-pill success">Live</span>
                </a>
                <a href="#virtual-class" class="nav-item ${this.currentRoute === 'virtual-class' ? 'active' : ''}" data-route="virtual-class">
                    <i class="fas fa-video"></i>
                    <span>Zoom Virtual Dars</span>
                    <span class="badge-pill urgent"><i class="fas fa-circle"></i> Live</span>
                </a>
                <a href="#assignments" class="nav-item ${this.currentRoute === 'assignments' ? 'active' : ''}" data-route="assignments">
                    <i class="fas fa-edit"></i>
                    <span>Assignments & Checking</span>
                </a>
                <a href="#exams" class="nav-item ${this.currentRoute === 'exams' ? 'active' : ''}" data-route="exams">
                    <i class="fas fa-award"></i>
                    <span>Exams & Wifaq Sanad</span>
                </a>
                <a href="#timetable" class="nav-item ${this.currentRoute === 'timetable' ? 'active' : ''}" data-route="timetable">
                    <i class="fas fa-calendar-alt"></i>
                    <span>Schedules & Timetable</span>
                </a>

                <div class="nav-section-title">Reports & Finances</div>
                <a href="#reports" class="nav-item ${this.currentRoute === 'reports' ? 'active' : ''}" data-route="reports">
                    <i class="fas fa-chart-line" style="color: var(--gold-400);"></i>
                    <span>Executive Reports</span>
                    <span class="badge-pill gold">10 Sets</span>
                </a>
                <a href="#fees" class="nav-item ${this.currentRoute === 'fees' ? 'active' : ''}" data-route="fees">
                    <i class="fas fa-hand-holding-heart"></i>
                    <span>Fees & Zakat Donations</span>
                </a>
                <a href="#library" class="nav-item ${this.currentRoute === 'library' ? 'active' : ''}" data-route="library">
                    <i class="fas fa-book-reader"></i>
                    <span>Maktaba Ashrafia</span>
                </a>
                <a href="#notifications" class="nav-item ${this.currentRoute === 'notifications' ? 'active' : ''}" data-route="notifications">
                    <i class="fas fa-bullhorn"></i>
                    <span>Broadcasts & Alerts</span>
                </a>
                <a href="#security" class="nav-item ${this.currentRoute === 'security' ? 'active' : ''}" data-route="security">
                    <i class="fas fa-shield-alt"></i>
                    <span>Architecture & RBAC</span>
                </a>
            `;
        } else if (role === 'TEACHER') {
            html += `
                <div class="nav-section-title">Faculty Workspace</div>
                <a href="#dashboard" class="nav-item ${this.currentRoute === 'dashboard' ? 'active' : ''}" data-route="dashboard">
                    <i class="fas fa-chalkboard-teacher"></i>
                    <span>Teacher Dashboard</span>
                </a>
                ${can('heritage') ? `
                    <a href="#heritage" class="nav-item ${this.currentRoute === 'heritage' ? 'active' : ''}" data-route="heritage">
                        <i class="fas fa-landmark"></i>
                        <span>Institutional Heritage</span>
                    </a>
                ` : ''}

                <div class="nav-section-title">Teaching & Students</div>
                ${can('students') ? `
                    <a href="#students" class="nav-item ${this.currentRoute === 'students' ? 'active' : ''}" data-route="students">
                        <i class="fas fa-user-graduate"></i>
                        <span>My Students Roster</span>
                    </a>
                ` : ''}
                ${can('attendance') ? `
                    <a href="#attendance" class="nav-item ${this.currentRoute === 'attendance' ? 'active' : ''}" data-route="attendance">
                        <i class="fas fa-calendar-check" style="color: var(--primary-400);"></i>
                        <span>Faculty Attendance</span>
                    </a>
                ` : ''}
                ${can('classes') ? `
                    <a href="#classes" class="nav-item ${this.currentRoute === 'classes' ? 'active' : ''}" data-route="classes">
                        <i class="fas fa-book"></i>
                        <span>My Classes & Courses</span>
                    </a>
                ` : ''}
                ${can('virtual_class') ? `
                    <a href="#virtual-class" class="nav-item ${this.currentRoute === 'virtual-class' ? 'active' : ''}" data-route="virtual-class">
                        <i class="fas fa-video"></i>
                        <span>Zoom Virtual Dars</span>
                        <span class="badge-pill urgent"><i class="fas fa-circle"></i> Live</span>
                    </a>
                ` : ''}
                ${can('assignments') ? `
                    <a href="#assignments" class="nav-item ${this.currentRoute === 'assignments' ? 'active' : ''}" data-route="assignments">
                        <i class="fas fa-clipboard-check"></i>
                        <span>Assignments & Grading</span>
                    </a>
                ` : ''}
                ${can('exams') ? `
                    <a href="#exams" class="nav-item ${this.currentRoute === 'exams' ? 'active' : ''}" data-route="exams">
                        <i class="fas fa-award"></i>
                        <span>Exams & Online Marking</span>
                    </a>
                ` : ''}
                ${can('timetable') ? `
                    <a href="#timetable" class="nav-item ${this.currentRoute === 'timetable' ? 'active' : ''}" data-route="timetable">
                        <i class="fas fa-calendar-alt"></i>
                        <span>Class Schedule / Timetable</span>
                    </a>
                ` : ''}

                <div class="nav-section-title">Resources & Notices</div>
                ${can('reports') ? `
                    <a href="#reports" class="nav-item ${this.currentRoute === 'reports' ? 'active' : ''}" data-route="reports">
                        <i class="fas fa-chart-line"></i>
                        <span>Teacher Reports</span>
                    </a>
                ` : ''}
                ${can('library') ? `
                    <a href="#library" class="nav-item ${this.currentRoute === 'library' ? 'active' : ''}" data-route="library">
                        <i class="fas fa-book-reader"></i>
                        <span>Maktaba Ashrafia</span>
                    </a>
                ` : ''}
                ${can('notifications') ? `
                    <a href="#notifications" class="nav-item ${this.currentRoute === 'notifications' ? 'active' : ''}" data-route="notifications">
                        <i class="fas fa-bullhorn"></i>
                        <span>Student Notifications</span>
                    </a>
                ` : ''}
            `;
        } else if (role === 'STUDENT') {
            html += `
                <div class="nav-section-title">Talib-e-Ilm Portal</div>
                <a href="#dashboard" class="nav-item ${this.currentRoute === 'dashboard' ? 'active' : ''}" data-route="dashboard">
                    <i class="fas fa-user-graduate"></i>
                    <span>Student Dashboard</span>
                </a>
                ${can('heritage') ? `
                    <a href="#heritage" class="nav-item ${this.currentRoute === 'heritage' ? 'active' : ''}" data-route="heritage">
                        <i class="fas fa-landmark"></i>
                        <span>Institutional Heritage</span>
                    </a>
                ` : ''}

                <div class="nav-section-title">My Academics</div>
                ${can('attendance') ? `
                    <a href="#attendance" class="nav-item ${this.currentRoute === 'attendance' ? 'active' : ''}" data-route="attendance">
                        <i class="fas fa-calendar-check" style="color: var(--primary-400);"></i>
                        <span>My Attendance History</span>
                    </a>
                ` : ''}
                ${can('classes') ? `
                    <a href="#classes" class="nav-item ${this.currentRoute === 'classes' ? 'active' : ''}" data-route="classes">
                        <i class="fas fa-book-open"></i>
                        <span>My Classes & Courses</span>
                    </a>
                ` : ''}
                ${can('virtual_class') ? `
                    <a href="#virtual-class" class="nav-item ${this.currentRoute === 'virtual-class' ? 'active' : ''}" data-route="virtual-class">
                        <i class="fas fa-video"></i>
                        <span>Zoom Virtual Dars</span>
                        <span class="badge-pill urgent"><i class="fas fa-circle"></i> Live</span>
                    </a>
                ` : ''}
                ${can('timetable') ? `
                    <a href="#timetable" class="nav-item ${this.currentRoute === 'timetable' ? 'active' : ''}" data-route="timetable">
                        <i class="fas fa-calendar-alt"></i>
                        <span>Schedule & Timetable</span>
                    </a>
                ` : ''}
                ${can('assignments') ? `
                    <a href="#assignments" class="nav-item ${this.currentRoute === 'assignments' ? 'active' : ''}" data-route="assignments">
                        <i class="fas fa-file-upload"></i>
                        <span>Assignments & Submissions</span>
                    </a>
                ` : ''}
                ${can('exams') ? `
                    <a href="#exams" class="nav-item ${this.currentRoute === 'exams' ? 'active' : ''}" data-route="exams">
                        <i class="fas fa-award"></i>
                        <span>Exams & Sanad Results</span>
                    </a>
                ` : ''}

                <div class="nav-section-title">Resources & Alerts</div>
                ${can('library') ? `
                    <a href="#library" class="nav-item ${this.currentRoute === 'library' ? 'active' : ''}" data-route="library">
                        <i class="fas fa-book-reader"></i>
                        <span>Maktaba Ashrafia</span>
                    </a>
                ` : ''}
                ${can('notifications') ? `
                    <a href="#notifications" class="nav-item ${this.currentRoute === 'notifications' ? 'active' : ''}" data-route="notifications">
                        <i class="fas fa-bullhorn"></i>
                        <span>Notifications</span>
                    </a>
                ` : ''}
            `;
        } else {
            // Default fallback
            html += `
                <div class="nav-section-title">Navigation</div>
                <a href="#dashboard" class="nav-item active" data-route="dashboard">
                    <i class="fas fa-tachometer-alt"></i>
                    <span>Dashboard</span>
                </a>
                <a href="#fees" class="nav-item" data-route="fees">
                    <i class="fas fa-hand-holding-heart"></i>
                    <span>Finance & Fees</span>
                </a>
            `;
        }

        sidebarNav.innerHTML = html;
    },

    navigate(route) {
        this.currentRoute = route;

        // Immediately reset scroll position to top across all containers
        this.resetScrollToTop();

        // Synchronize active class in sidebar
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-route') === route) {
                item.classList.add('active');
            } else if (!item.classList.contains('nav-parent-item')) {
                item.classList.remove('active');
            }
        });

        // Synchronize parent Users & Permissions item
        const parentNav = document.getElementById('parent-nav-users-permissions');
        if (parentNav) {
            if (['users', 'roles', 'permissions'].includes(route)) {
                parentNav.classList.add('active');
                const submenu = document.getElementById('submenu-users-permissions');
                const caret = document.getElementById('caret-users-permissions');
                if (submenu) {
                    submenu.style.display = 'flex';
                    submenu.classList.add('open');
                    if (caret) caret.style.transform = 'rotate(180deg)';
                    this.usersPermissionsSubmenuOpen = true;
                }
            } else {
                parentNav.classList.remove('active');
            }
        }

        const viewport = document.getElementById('main-content-viewport');
        if (!viewport) return;

        // BACKEND & FRONTEND RBAC ROUTE GUARD ENFORCEMENT
        // If the user's role does not have permission for this route/module, show 403 Forbidden!
        if (!window.AuthRBAC.canAccessRoute(route)) {
            viewport.innerHTML = this.renderForbidden(route);
            this.resetScrollToTop();
            return;
        }

        // Render appropriate module
        switch (route) {
            case 'dashboard':
                viewport.innerHTML = this.renderDashboard();
                break;
            case 'users':
                viewport.innerHTML = window.UsersModule ? window.UsersModule.render() : '';
                break;
            case 'roles':
                viewport.innerHTML = window.RolesModule ? window.RolesModule.render() : '';
                break;
            case 'permissions':
                viewport.innerHTML = window.PermissionsModule.render();
                break;
            case 'students':
                viewport.innerHTML = window.StudentsModule ? window.StudentsModule.render() : '';
                break;
            case 'attendance':
                viewport.innerHTML = window.AttendanceModule ? window.AttendanceModule.render() : '';
                break;
            case 'reports':
                viewport.innerHTML = window.ReportsModule ? window.ReportsModule.render() : '';
                break;
            case 'heritage':
                viewport.innerHTML = window.InstitutionalModule.render();
                if (window.InstitutionalModule && typeof window.InstitutionalModule.fetchLiveBranches === 'function') {
                    window.InstitutionalModule.fetchLiveBranches();
                }
                break;
            case 'admissions':
                viewport.innerHTML = window.AdmissionsModule.render();
                if (window.AdmissionsModule && typeof window.AdmissionsModule.fetchLiveAdmissions === 'function') {
                    window.AdmissionsModule.fetchLiveAdmissions();
                }
                break;

            case 'classes':
                viewport.innerHTML = window.ClassesCoursesModule.render();
                break;
            case 'teachers':
                viewport.innerHTML = window.TeachersModule.render();
                break;
            case 'assignments':
                viewport.innerHTML = window.AssignmentsModule.render();
                break;
            case 'exams':
                viewport.innerHTML = window.ExamsModule.render();
                break;
            case 'fees':
                viewport.innerHTML = window.FeesDonationsModule.render();
                break;
            case 'library':
                viewport.innerHTML = window.LibraryModule.render();
                break;
            case 'timetable':
                viewport.innerHTML = window.TimetableModule.render();
                break;
            case 'virtual-class':
                viewport.innerHTML = window.VirtualClassModule.render();
                window.VirtualClassModule.initAfterRender();
                break;
            case 'notifications':
                viewport.innerHTML = window.NotificationsModule.render();
                this.updateNotificationBadge();
                break;
            case 'security':
                viewport.innerHTML = this.renderSecurityDocs();
                break;
            default:
                viewport.innerHTML = this.renderDashboard();
        }

        // Enforce guaranteed scroll reset to top (0, 0)
        this.resetScrollToTop();
    },

    // 403 Forbidden Access Denied Screen (Strict Enforcement)
    renderForbidden(route) {
        const user = window.AuthRBAC.currentUser;
        const role = window.AuthRBAC.getRole();
        const roleDef = window.ROLES[role] || { title: role };
        const modKey = window.AuthRBAC.getModuleForRoute(route);
        const modMeta = modKey ? window.AuthRBAC.getModuleMeta(modKey) : { title: route, urdu: "" };

        return `
            <div class="forbidden-wrapper" style="text-align: center; padding: 50px 24px; max-width: 680px; margin: 40px auto; background: var(--bg-surface); border: 2px solid var(--danger); border-radius: var(--radius-lg); box-shadow: 0 15px 40px rgba(220, 38, 38, 0.25);">
                <div style="width: 84px; height: 84px; margin: 0 auto 20px; background: rgba(220, 38, 38, 0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid var(--danger);">
                    <i class="fas fa-shield-alt" style="font-size: 2.8rem; color: var(--danger);"></i>
                </div>
                <div class="status-pill danger" style="margin-bottom: 12px; font-weight: 700; letter-spacing: 0.05em;">
                    HTTP 403 • ACCESS FORBIDDEN
                </div>
                <h1 style="color: var(--primary-950); font-size: 1.85rem; margin-bottom: 6px;">403 - Permission Denied (غیر مصرح به)</h1>
                <div style="font-family: 'Amiri', serif; font-size: 1.35rem; color: var(--gold-700); margin-bottom: 18px;">
                    عذراً! لا تملك الصلاحية للوصول إلى هذا القسم
                </div>

                <p style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6; margin-bottom: 22px;">
                    Your authenticated role (<strong style="color: var(--gold-600);">${roleDef.title}</strong>) 
                    does not have permission to access the <strong>${modMeta.title}</strong> module 
                    (<code>#${route}</code>).
                </p>

                <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); margin-bottom: 24px; font-size: 0.82rem; color: var(--text-muted); text-align: left; line-height: 1.7;">
                    <div><i class="fas fa-lock" style="color: var(--danger);"></i> <strong>RBAC Guardrail:</strong> Direct URL bypass and unauthorized privilege escalation are strictly rejected by the institutional authorization engine.</div>
                    <div style="margin-top: 6px;"><i class="fas fa-sliders-h" style="color: var(--gold-400);"></i> <strong>Permissions Authority:</strong> Only Hazrat Mohtamim (Super Admin) can enable or disable module access under <strong>Settings / Permissions</strong>.</div>
                </div>

                <div style="display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;">
                    <button class="btn btn-gold" onclick="App.navigate('dashboard')">
                        <i class="fas fa-arrow-left"></i> Return to My Dashboard
                    </button>
                    <button class="btn btn-secondary" onclick="window.AuthRBAC.logout()">
                        <i class="fas fa-sign-out-alt"></i> Sign Out
                    </button>
                </div>
            </div>
        `;
    },

    // Master Dashboard Delegator
    renderDashboard() {
        const role = window.AuthRBAC.getRole();
        if (role === 'STUDENT') {
            return this.renderStudentDashboard();
        } else if (role === 'TEACHER') {
            return this.renderTeacherDashboard();
        } else {
            return this.renderSuperAdminDashboard();
        }
    },

    // 1. SUPER ADMIN DASHBOARD
    renderSuperAdminDashboard() {
        const user = window.AuthRBAC.currentUser;
        const roleDef = window.ROLES['SUPER_ADMIN'];
        const inst = window.LmsData.institution;
        const liveClass = window.LmsData.virtualClasses[0];

        return `
            <!-- WELCOME HEADER -->
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-crown" style="color: var(--gold-400);"></i>
                        Jamia Ashrafia Executive Administrative Portal
                    </h1>
                    <p>
                        Welcome, <strong>${user.name}</strong> 
                        <span class="status-pill gold" style="margin-left: 6px;">Super Admin (Mohtamim)</span>
                    </p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-gold btn-sm" onclick="App.navigate('permissions')">
                        <i class="fas fa-sliders-h"></i> Configure Permissions
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="App.navigate('admissions')">
                        <i class="fas fa-user-plus"></i> Admissions Queue (${window.LmsData.admissions.length})
                    </button>
                </div>
            </div>

            <!-- INSTITUTIONAL HERO CARD -->
            <div class="ashrafia-hero-card">
                <div class="ashrafia-hero-content">
                    <div class="ashrafia-hero-badge">
                        <i class="fas fa-landmark"></i> Central Headquarters • Ferozepur Road • Est. 1947
                    </div>
                    <h2 class="ashrafia-hero-title">جامعہ اشرفیہ، لاہور - علم اور تقویٰ</h2>
                    <p class="ashrafia-hero-desc">
                        Founded by Hazrat Maulana Mufti Muhammad Hassan Amritsari (RA) on 14 September 1947. 
                        Encompassing 12 regional campuses with over 2,000 resident scholars under Wifaq-ul-Madaris Al-Arabia.
                    </p>
                    <div class="ashrafia-hero-stats">
                        <div class="hero-stat-item">
                            <span class="hero-stat-value">${inst.branches.length}</span>
                            <span class="hero-stat-label">Regional Branches</span>
                        </div>
                        <div class="hero-stat-item">
                            <span class="hero-stat-value">2,000+</span>
                            <span class="hero-stat-label">Resident Scholars</span>
                        </div>
                        <div class="hero-stat-item">
                            <span class="hero-stat-value">Wifaq al-Arabia</span>
                            <span class="hero-stat-label">Accreditation</span>
                        </div>
                        <div class="hero-stat-item">
                            <span class="hero-stat-value">100% Free</span>
                            <span class="hero-stat-label">Welfare Scholarships</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- KEY STATS -->
            <div class="metrics-grid">
                <div class="metric-card gold">
                    <div class="metric-icon-box"><i class="fas fa-calendar-check"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Today's Check-Ins</span>
                        <span class="metric-value">${(window.LmsData.attendance || []).filter(r => r.date === (window.AttendanceModule ? window.AttendanceModule.getTodayDate() : new Date().toISOString().split('T')[0])).length} Logged</span>
                        <span class="metric-hint" style="color: var(--gold-300);"><i class="fas fa-check-circle"></i> Live Attendance</span>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon-box"><i class="fas fa-user-graduate"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Scholars Roster</span>
                        <span class="metric-value">${(window.LmsData.users || []).filter(u => u.role === 'STUDENT').length} Talaba</span>
                        <span class="metric-hint"><i class="fas fa-users"></i> All Programs</span>
                    </div>
                </div>
                <div class="metric-card info">
                    <div class="metric-icon-box"><i class="fas fa-chart-line"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Executive Reports</span>
                        <span class="metric-value">10 Categories</span>
                        <span class="metric-hint">Audits & Analytics</span>
                    </div>
                </div>
                <div class="metric-card danger">
                    <div class="metric-icon-box"><i class="fas fa-hand-holding-heart"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Zakat & Sadaqat</span>
                        <span class="metric-value">PKR 850k</span>
                        <span class="metric-hint" style="color: var(--text-muted);">Kafalat-e-Talib-e-Ilm</span>
                    </div>
                </div>
            </div>

            <!-- TWO COLUMN WORKSPACE -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
                <!-- Left: Live Class Alert Box & Highlights -->
                <div>
                    <div class="card" style="border: 2px solid var(--primary-200); background: linear-gradient(135deg, var(--primary-50) 0%, var(--gold-50) 100%);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                            <div>
                                <span class="status-pill danger" style="animation: pulse 1.5s infinite;"><i class="fas fa-circle"></i> Live Video Room Active</span>
                                <h3 style="font-size: 1.15rem; color: var(--text-primary); margin-top: 6px;">${liveClass.title}</h3>
                                <div style="font-family: 'Amiri', serif; font-size: 1.15rem; color: var(--gold-700);">${liveClass.urduTitle}</div>
                            </div>
                            <button class="btn btn-primary" onclick="App.navigate('virtual-class')">
                                <i class="fas fa-sign-in-alt"></i> Join Room Now
                            </button>
                        </div>
                        <div style="font-size: 0.82rem; color: var(--text-secondary); display: flex; gap: 20px; flex-wrap: wrap;">
                            <span><i class="fas fa-user-tie"></i> ${liveClass.hostTeacher}</span>
                            <span><i class="fas fa-users"></i> ${liveClass.activeParticipants} Scholars Joined</span>
                            <span><i class="fas fa-key"></i> Passcode: <code>${liveClass.passcode}</code></span>
                        </div>
                    </div>

                    <!-- Highlights -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-history"></i> Current Academic Highlights</h3>
                            <button class="btn btn-secondary btn-sm" onclick="App.navigate('timetable')">View Timetable</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm);">
                                <div>
                                    <div style="font-weight: 700; color: var(--primary-950);">Fajr Dars: Sahih al-Bukhari (Hall Imam Bukhari)</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Qari Arshad Ubaid • 06:30 AM - 08:00 AM</div>
                                </div>
                                <span class="status-pill success">Completed</span>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm);">
                                <div>
                                    <div style="font-weight: 700; color: var(--primary-950);">Fiqh Session: Al-Hidayah (Room 201)</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Mufti Ahmadur Rahman • 10:15 AM - 11:45 AM</div>
                                </div>
                                <span class="status-pill info">In Progress</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right: Quick Admin Controls -->
                <div>
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-cogs"></i> Administrative Operations</h3>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <button class="btn btn-gold" style="justify-content: flex-start;" onclick="App.navigate('reports')">
                                <i class="fas fa-chart-line"></i> Executive Reports (10 Categories)
                            </button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('attendance')">
                                <i class="fas fa-calendar-check" style="color: var(--gold-400);"></i> Attendance Monitoring & Check-Ins
                            </button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('students')">
                                <i class="fas fa-user-graduate" style="color: var(--primary-400);"></i> Students Management (${(window.LmsData.users || []).filter(u => u.role === 'STUDENT').length})
                            </button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('permissions')">
                                <i class="fas fa-sliders-h" style="color: var(--warning);"></i> Settings / System Permissions
                            </button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('admissions')">
                                <i class="fas fa-user-plus" style="color: var(--primary-400);"></i> Admission Applications (${window.LmsData.admissions.length})
                            </button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('teachers')">
                                <i class="fas fa-user-tie" style="color: var(--gold-400);"></i> Teachers & Faculty Portals
                            </button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('fees')">
                                <i class="fas fa-file-invoice" style="color: var(--info);"></i> Fee & Zakat Accounts
                            </button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('security')">
                                <i class="fas fa-shield-alt" style="color: var(--danger);"></i> Cloud Architecture & RBAC Specs
                            </button>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-bullhorn"></i> Dispatches</h3>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.82rem;">
                            ${window.LmsData.notifications.slice(0, 3).map(n => `
                                <div style="padding: 10px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm); border-left: 3px solid var(--gold-400);">
                                    <div style="font-weight: 700; color: var(--primary-950);">${n.title}</div>
                                    <div style="color: var(--text-muted); font-size: 0.72rem; margin-top: 2px;">${n.sender} • ${n.time}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // 2. TEACHER DASHBOARD
    renderTeacherDashboard() {
        const user = window.AuthRBAC.currentUser;
        const liveClass = (window.LmsData.virtualClasses || []).find(vc => vc.hostId === user.id && (vc.isLive || vc.status === 'LIVE'))
                       || (window.LmsData.virtualClasses || []).find(vc => vc.isLive || vc.status === 'LIVE')
                       || (window.LmsData.virtualClasses || [])[0];

        return `
            <!-- TEACHER WELCOME -->
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-chalkboard-teacher" style="color: var(--gold-400);"></i>
                        Sheikh-ul-Hadith & Faculty Academic Portal
                    </h1>
                    <p>
                        Welcome, <strong>${user.name}</strong> 
                        <span class="status-pill success" style="margin-left: 6px;">Teacher (Sheikh-ul-Hadith)</span>
                        <span style="font-family: 'Amiri', serif; margin-left: 8px; color: var(--gold-200);">${user.urduName || ''}</span>
                    </p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-gold btn-sm" onclick="App.navigate('virtual-class')">
                        <i class="fas fa-video"></i> Host Zoom Dars
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="App.navigate('assignments')">
                        <i class="fas fa-clipboard-check"></i> Grade Homework
                    </button>
                </div>
            </div>

            <!-- ATTENDANCE CHECK-IN WIDGET -->
            ${window.AttendanceModule ? window.AttendanceModule.renderDashboardCheckInWidget(user) : ''}

            <!-- TEACHER HERO SUMMARY -->
            <div class="ashrafia-hero-card" style="background: linear-gradient(135deg, var(--primary-900) 0%, var(--primary-700) 100%);">
                <div class="ashrafia-hero-content">
                    <div class="ashrafia-hero-badge"><i class="fas fa-book-reader"></i> Faculty Allocation: Dawra-e-Hadith & Hadith Studies</div>
                    <h2 class="ashrafia-hero-title">مسند تدریس - جامعہ اشرفیہ، لاہور</h2>
                    <p class="ashrafia-hero-desc">
                        Assigned Chair: <strong>Sahih al-Bukhari & Ulum-ul-Hadith</strong> at Hall Imam Bukhari (Ferozepur Road).
                        Manage assigned student batches, upload assignments, check student answer sheets, and monitor attendance.
                    </p>
                    <div class="ashrafia-hero-stats">
                        <div class="hero-stat-item">
                            <span class="hero-stat-value">2</span>
                            <span class="hero-stat-label">Assigned Batches</span>
                        </div>
                        <div class="hero-stat-item">
                            <span class="hero-stat-value">125</span>
                            <span class="hero-stat-label">Scholars Enrolled</span>
                        </div>
                        <div class="hero-stat-item">
                            <span class="hero-stat-value">18</span>
                            <span class="hero-stat-label">Pending Homework</span>
                        </div>
                        <div class="hero-stat-item">
                            <span class="hero-stat-value">06:30 AM</span>
                            <span class="hero-stat-label">Daily Fajr Dars</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TEACHER QUICK METRICS -->
            <div class="metrics-grid">
                <div class="metric-card gold">
                    <div class="metric-icon-box"><i class="fas fa-video"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Virtual Dars Room</span>
                        <span class="metric-value">Ready to Broadcast</span>
                        <span class="metric-hint" style="color: var(--gold-300);">Passcode: ${liveClass.passcode}</span>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon-box"><i class="fas fa-tasks"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Assignments to Grade</span>
                        <span class="metric-value">18 Submissions</span>
                        <span class="metric-hint">Bukhari & Tirmidhi</span>
                    </div>
                </div>
                <div class="metric-card info">
                    <div class="metric-icon-box"><i class="fas fa-calendar-check"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Today's Lectures</span>
                        <span class="metric-value">2 Scheduled</span>
                        <span class="metric-hint">Fajr & Asr Hours</span>
                    </div>
                </div>
                <div class="metric-card success">
                    <div class="metric-icon-box"><i class="fas fa-user-check"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Student Attendance</span>
                        <span class="metric-value">98.4%</span>
                        <span class="metric-hint">Dawra Section A</span>
                    </div>
                </div>
            </div>

            <!-- TWO COLUMN TEACHING WORKSPACE -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
                <div>
                    <!-- Active Live Class -->
                    <div class="card" style="border: 2px solid var(--gold-400);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div>
                                <span class="status-pill danger"><i class="fas fa-circle"></i> Live Video Lecture Waiting</span>
                                <h3 style="color: var(--primary-950); margin-top: 6px;">${liveClass.title}</h3>
                                <div style="font-family: 'Amiri', serif; color: var(--gold-700); font-size: 1.1rem;">${liveClass.urduTitle}</div>
                            </div>
                            <button class="btn btn-gold" onclick="App.navigate('virtual-class')">
                                <i class="fas fa-play"></i> Start Lecture Now
                            </button>
                        </div>
                    </div>

                    <!-- Assigned Classes -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-book"></i> My Assigned Courses</h3>
                            <button class="btn btn-secondary btn-sm" onclick="App.navigate('classes')">Full Catalog</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm);">
                                <div>
                                    <div style="font-weight: 700; color: var(--primary-950);">Sahih al-Bukhari (Jild 1) - HAD-801</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Dawra-e-Hadith • 60 Talaba • Hall Imam Bukhari</div>
                                </div>
                                <button class="btn btn-secondary btn-sm" onclick="App.navigate('assignments')">Review Submissions</button>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm);">
                                <div>
                                    <div style="font-weight: 700; color: var(--primary-950);">Sunan al-Tirmidhi (Kitab al-Jana'iz) - HAD-802</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Dawra-e-Hadith • 65 Talaba • Room 102</div>
                                </div>
                                <button class="btn btn-secondary btn-sm" onclick="App.navigate('timetable')">View Schedule</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Teacher Actions & Broadcasts -->
                <div>
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-bolt"></i> Teacher Operations</h3>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <button class="btn btn-gold" style="justify-content: flex-start;" onclick="App.navigate('virtual-class')">
                                <i class="fas fa-video"></i> Launch Zoom Live Room
                            </button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('attendance')">
                                <i class="fas fa-calendar-check" style="color: var(--primary-400);"></i> Check-In & Attendance History
                            </button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('students')">
                                <i class="fas fa-user-graduate" style="color: var(--gold-400);"></i> View My Students
                            </button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('assignments')">
                                <i class="fas fa-clipboard-check" style="color: var(--primary-400);"></i> Check & Mark Assignments
                            </button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('exams')">
                                <i class="fas fa-award" style="color: var(--gold-400);"></i> Wifaq Sanad Online Marking
                            </button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('timetable')">
                                <i class="fas fa-calendar-alt" style="color: var(--info);"></i> My Teaching Schedule
                            </button>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-bullhorn"></i> Faculty Notices</h3>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.82rem;">
                            ${window.LmsData.notifications.slice(0, 3).map(n => `
                                <div style="padding: 10px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm); border-left: 3px solid var(--primary-500);">
                                    <div style="font-weight: 700; color: var(--primary-950);">${n.title}</div>
                                    <div style="color: var(--text-muted); font-size: 0.72rem; margin-top: 2px;">${n.sender} • ${n.time}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // 3. STUDENT DASHBOARD
    renderStudentDashboard() {
        const user = window.AuthRBAC.currentUser;
        const studentClass = user.classId || 'cls_dawra_a';
        const liveClass = (window.LmsData.virtualClasses || []).find(vc => vc.classId === studentClass && (vc.isLive || vc.status === 'LIVE'))
                       || (window.LmsData.virtualClasses || []).find(vc => vc.classId === studentClass)
                       || (window.LmsData.virtualClasses || [])[0];

        return `
            <!-- STUDENT WELCOME -->
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-user-graduate" style="color: var(--gold-400);"></i>
                        Talib-e-Ilm Academic Learning Portal
                    </h1>
                    <p>
                        Welcome, <strong>${user.name}</strong> 
                        <span class="status-pill primary" style="margin-left: 6px;">Roll No: ${user.rollNo || 'ASH-2024-001'}</span>
                        <span style="font-family: 'Amiri', serif; margin-left: 8px; color: var(--gold-200);">${user.urduName || ''}</span>
                    </p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-gold btn-sm" onclick="App.navigate('virtual-class')">
                        <i class="fas fa-video"></i> Join Live Zoom Dars
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="App.navigate('assignments')">
                        <i class="fas fa-file-upload"></i> Submit Homework
                    </button>
                </div>
            </div>

            <!-- ATTENDANCE CHECK-IN WIDGET -->
            ${window.AttendanceModule ? window.AttendanceModule.renderDashboardCheckInWidget(user) : ''}

            <!-- STUDENT HERO BANNER -->
            <div class="ashrafia-hero-card" style="background: linear-gradient(135deg, rgba(4, 120, 87, 0.95) 0%, rgba(30, 58, 138, 0.85) 100%);">
                <div class="ashrafia-hero-content">
                    <div class="ashrafia-hero-badge"><i class="fas fa-university"></i> ${user.program || 'Dars-e-Nizami (Dawra-e-Hadith)'} • Session 1446-1447 AH</div>
                    <h2 class="ashrafia-hero-title">جامعہ اشرفیہ، لاہور - پورٹل برائے طلبہ</h2>
                    <p class="ashrafia-hero-desc">
                        Resident Campus: <strong>Main Ferozepur Road</strong> | Residence: <strong>${user.hostel || 'Hostel Block A, Room 204'}</strong>.
                        Affiliated with <strong>Wifaq-ul-Madaris Al-Arabia Pakistan</strong> (HEC Recognized M.A Equivalence).
                    </p>
                    <div class="ashrafia-hero-stats">
                        <div class="hero-stat-item">
                            <span class="hero-stat-value">6</span>
                            <span class="hero-stat-label">Enrolled Kitabs</span>
                        </div>
                        <div class="hero-stat-item">
                            <span class="hero-stat-value">2</span>
                            <span class="hero-stat-label">Pending Homework</span>
                        </div>
                        <div class="hero-stat-item">
                            <span class="hero-stat-value">Mumtaz</span>
                            <span class="hero-stat-label">Wifaq Sanad Standing</span>
                        </div>
                        <div class="hero-stat-item">
                            <span class="hero-stat-value">99%</span>
                            <span class="hero-stat-label">Prayer Attendance</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- STUDENT KEY METRICS -->
            <div class="metrics-grid">
                <div class="metric-card gold">
                    <div class="metric-icon-box"><i class="fas fa-video"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Live Video Dars</span>
                        <span class="metric-value">Active Now</span>
                        <span class="metric-hint" style="color: var(--gold-300);"><i class="fas fa-circle"></i> Hall Imam Bukhari</span>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon-box"><i class="fas fa-tasks"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Assignments Due</span>
                        <span class="metric-value">2 Pending</span>
                        <span class="metric-hint">Due in 3 Days</span>
                    </div>
                </div>
                <div class="metric-card info">
                    <div class="metric-icon-box"><i class="fas fa-award"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Annual Wifaq Result</span>
                        <span class="metric-value">Grade A+ (First)</span>
                        <span class="metric-hint">Sanad Issued</span>
                    </div>
                </div>
                <div class="metric-card success">
                    <div class="metric-icon-box"><i class="fas fa-book-reader"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Maktaba Ashrafia</span>
                        <span class="metric-value">1 Book Issued</span>
                        <span class="metric-hint">Due 15 Oct</span>
                    </div>
                </div>
            </div>

            <!-- TWO COLUMN STUDENT WORKSPACE -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
                <div>
                    <!-- Active Live Classroom Alert -->
                    <div class="card" style="border: 2px solid var(--primary-200); background: linear-gradient(135deg, var(--primary-50) 0%, var(--gold-50) 100%);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div>
                                <span class="status-pill danger" style="animation: pulse 1.5s infinite;"><i class="fas fa-circle"></i> Live Zoom Room Open</span>
                                <h3 style="color: var(--text-primary); margin-top: 6px;">${liveClass.title}</h3>
                                <div style="font-family: 'Amiri', serif; color: var(--gold-700); font-size: 1.15rem;">${liveClass.urduTitle}</div>
                            </div>
                            <button class="btn btn-primary" onclick="App.navigate('virtual-class')">
                                <i class="fas fa-sign-in-alt"></i> Enter Classroom
                            </button>
                        </div>
                        <div style="font-size: 0.82rem; color: var(--text-secondary); display: flex; gap: 20px;">
                            <span><i class="fas fa-user-tie"></i> Ustad: ${liveClass.hostTeacher}</span>
                            <span><i class="fas fa-users"></i> ${liveClass.activeParticipants} Fellow Scholars Online</span>
                        </div>
                    </div>

                    <!-- My Enrolled Courses -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-book-open"></i> My Enrolled Classes (Dawra-e-Hadith)</h3>
                            <button class="btn btn-secondary btn-sm" onclick="App.navigate('classes')">Full Curriculum</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm);">
                                <div>
                                    <div style="font-weight: 700; color: var(--primary-950);">Sahih al-Bukhari (Jild 1)</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Qari Arshad Ubaid • 06:30 AM - 08:00 AM • Hall Imam Bukhari</div>
                                </div>
                                <button class="btn btn-secondary btn-sm" onclick="App.navigate('assignments')">Assignments</button>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm);">
                                <div>
                                    <div style="font-weight: 700; color: var(--primary-950);">Al-Hidayah (Fiqh Hanafi)</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Mufti Ahmadur Rahman • 10:15 AM - 11:45 AM • Room 201</div>
                                </div>
                                <button class="btn btn-secondary btn-sm" onclick="App.navigate('timetable')">Timetable</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Student Quick Actions & Announcements -->
                <div>
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-bolt"></i> Student Quick Menu</h3>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <button class="btn btn-gold" style="justify-content: flex-start;" onclick="App.navigate('virtual-class')">
                                <i class="fas fa-video"></i> Join Live Zoom Classroom
                            </button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('assignments')">
                                <i class="fas fa-file-upload" style="color: var(--primary-400);"></i> Upload Completed Homework
                            </button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('exams')">
                                <i class="fas fa-award" style="color: var(--gold-400);"></i> Wifaq Sanad & Grade Card
                            </button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('timetable')">
                                <i class="fas fa-calendar-alt" style="color: var(--info);"></i> Dars & Prayer Timetable
                            </button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('library')">
                                <i class="fas fa-book-reader" style="color: var(--primary-400);"></i> Search Maktaba Ashrafia
                            </button>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-bullhorn"></i> Ashrafia Bulletins</h3>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.82rem;">
                            ${window.LmsData.notifications.slice(0, 3).map(n => `
                                <div style="padding: 10px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm); border-left: 3px solid var(--gold-400);">
                                    <div style="font-weight: 700; color: var(--primary-950);">${n.title}</div>
                                    <div style="color: var(--text-muted); font-size: 0.72rem; margin-top: 2px;">${n.sender} • ${n.time}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // Security & Architecture Specs (Admin only)
    renderSecurityDocs() {
        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-shield-alt" style="color: var(--gold-400);"></i>
                        System Architecture, Security & Database Schema
                    </h1>
                    <p>Enterprise specifications, relational tables, role permission matrix, and production deployment blueprint</p>
                </div>
                <div class="view-actions">
                    <a href="database/schema.sql" target="_blank" class="btn btn-gold btn-sm">
                        <i class="fas fa-database"></i> Download schema.sql
                    </a>
                </div>
            </div>

            <!-- RBAC SPECIFICATION -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-user-lock"></i> Role-Based Access Control (RBAC) Matrix</h3>
                    <span class="status-pill success">Zero Trust Model</span>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Role</th>
                                <th>Urdu Title</th>
                                <th>Designation / Office</th>
                                <th>Core Capabilities & Guardrails</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><span class="status-pill gold">SUPER_ADMIN</span></td>
                                <td style="font-family: 'Amiri', serif; font-size: 1.1rem; color: var(--gold-700);">حضرت مہتمم / مجلس شوریٰ</td>
                                <td>Principal Maulana Fazl-ur-Raheem Ashrafi</td>
                                <td>Full administrative control, financial audits, branch creation, policy decrees, audit log access.</td>
                            </tr>
                            <tr>
                                <td><span class="status-pill info">ACADEMIC_ADMIN</span></td>
                                <td style="font-family: 'Amiri', serif; font-size: 1.1rem;">ناظم تعلیمات</td>
                                <td>Maulana Hafiz Ajwad Ubaid</td>
                                <td>Student admissions approval, roll number issuance, teacher assignments, timetables, Wifaq exam results.</td>
                            </tr>
                            <tr>
                                <td><span class="status-pill success">TEACHER</span></td>
                                <td style="font-family: 'Amiri', serif; font-size: 1.1rem;">استاذ / شیخ الحدیث</td>
                                <td>Qari Arshad Ubaid / Asatizah</td>
                                <td>Host Zoom-like live classrooms, daily attendance marking, homework creation, subjective grading & feedback.</td>
                            </tr>
                            <tr>
                                <td><span class="status-pill warning">STUDENT</span></td>
                                <td style="font-family: 'Amiri', serif; font-size: 1.1rem;">طالب علم</td>
                                <td>Dars-e-Nizami Scholars</td>
                                <td>Join live classes, upload assignments, attempt timed online exam papers, view fee challans, search library.</td>
                            </tr>
                            <tr>
                                <td><span class="status-pill info">ACCOUNTANT</span></td>
                                <td style="font-family: 'Amiri', serif; font-size: 1.1rem;">ناظم مالیات و صدقات</td>
                                <td>Haji Abdul Ghaffar</td>
                                <td>3-part fee challan generation, Zakat & Sadaqah verification, Kafalat-e-Talib-e-Ilm disbursement receipts.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- ARCHITECTURE DIAGRAM & DATABASE STATS -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
                <div class="card">
                    <div class="card-header">
                        <h4 class="card-title"><i class="fas fa-server"></i> Cloud Infrastructure</h4>
                    </div>
                    <ul style="padding-left: 20px; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.8;">
                        <li><strong>Database:</strong> AWS RDS PostgreSQL 16 (Multi-AZ, ACID compliant, 22 tables).</li>
                        <li><strong>WebRTC SFU:</strong> LiveKit / Mediasoup cluster with low-latency H.264 / Opus streams.</li>
                        <li><strong>Storage:</strong> S3 Bucket with SSE-KMS encryption for manuscript PDFs and recorded lectures.</li>
                        <li><strong>Cache:</strong> Redis 7 Cluster for session states, distributed rate limiting, and real-time alerts.</li>
                        <li><strong>Reverse Proxy:</strong> Nginx with Let's Encrypt Wildcard SSL and Cloudflare Edge DDoS Shield.</li>
                    </ul>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h4 class="card-title"><i class="fas fa-database"></i> Database Schema Modules</h4>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.78rem;">
                        <span class="status-pill gold">branches</span>
                        <span class="status-pill gold">users</span>
                        <span class="status-pill gold">permissions</span>
                        <span class="status-pill gold">courses</span>
                        <span class="status-pill gold">classes</span>
                        <span class="status-pill gold">student_admissions</span>
                        <span class="status-pill gold">assignments</span>
                        <span class="status-pill gold">exams</span>
                        <span class="status-pill gold">wifaq_results</span>
                        <span class="status-pill gold">fee_challans</span>
                        <span class="status-pill gold">donations</span>
                        <span class="status-pill gold">library_books</span>
                        <span class="status-pill gold">virtual_classes</span>
                        <span class="status-pill gold">audit_logs</span>
                    </div>
                </div>
            </div>
        `;
    },

    openProfileModal() {
        const user = window.AuthRBAC.currentUser;
        const role = window.AuthRBAC.getRole();
        const roleDef = window.ROLES[role] || { title: role, urduTitle: "" };

        const titleEl = document.getElementById('modal-title-text');
        const bodyEl = document.getElementById('modal-body-container');
        const footerEl = document.getElementById('modal-footer-container');

        if (titleEl) titleEl.innerHTML = `<i class="fas fa-id-badge" style="color: var(--gold-400);"></i> Institutional Profile`;
        if (bodyEl) {
            bodyEl.innerHTML = `
                <div style="text-align: center; margin-bottom: 20px;">
                    <div class="user-avatar" style="width: 72px; height: 72px; font-size: 1.6rem; margin: 0 auto 12px; border: 2px solid var(--gold-400);">${user.avatar || 'JA'}</div>
                    <h3 style="color: var(--primary-950); margin-bottom: 4px;">${user.name}</h3>
                    <div style="font-family: 'Amiri', serif; font-size: 1.25rem; color: var(--gold-700);">${user.urduName || ''}</div>
                    <span class="status-pill ${roleDef.badgeClass || 'gold'}" style="margin-top: 6px;">${roleDef.title}</span>
                </div>

                <div style="background: var(--bg-surface-elevated); border-radius: var(--radius-sm); padding: 16px; font-size: 0.85rem; line-height: 1.9;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
                        <span style="color: var(--text-muted);"><i class="fas fa-envelope"></i> Official Email:</span>
                        <strong style="color: var(--text-primary);">${user.email || 'N/A'}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding: 8px 0;">
                        <span style="color: var(--text-muted);"><i class="fas fa-mosque"></i> Campus / Branch:</span>
                        <strong style="color: var(--text-primary);">Main Campus (Ferozepur Road)</strong>
                    </div>
                    ${user.rollNo ? `
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding: 8px 0;">
                            <span style="color: var(--text-muted);"><i class="fas fa-id-card"></i> Student Roll Number:</span>
                            <strong style="color: var(--primary-950);">${user.rollNo}</strong>
                        </div>
                    ` : ''}
                    ${user.designation ? `
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding: 8px 0;">
                            <span style="color: var(--text-muted);"><i class="fas fa-briefcase"></i> Designation:</span>
                            <strong style="color: var(--text-primary);">${user.designation}</strong>
                        </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; padding-top: 8px;">
                        <span style="color: var(--text-muted);"><i class="fas fa-shield-check"></i> Verification Status:</span>
                        <span class="status-pill success"><i class="fas fa-check-circle"></i> Active & Verified</span>
                    </div>
                </div>
            `;
        }
        if (footerEl) {
            footerEl.innerHTML = `
                <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
                <button class="btn btn-danger" onclick="App.closeModal(); window.AuthRBAC.logout();">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            `;
        }

        const dropdown = document.getElementById('header-user-dropdown');
        if (dropdown) dropdown.classList.remove('open');

        this.openModal();
    },

    openModal() {
        const modal = document.getElementById('global-modal-backdrop');
        if (modal) modal.classList.add('open');
    },

    closeModal() {
        const modal = document.getElementById('global-modal-backdrop');
        if (modal) modal.classList.remove('open');
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        let icon = 'fas fa-info-circle';
        if (type === 'success') icon = 'fas fa-check-circle';
        else if (type === 'error') icon = 'fas fa-exclamation-circle';
        else if (type === 'warning') icon = 'fas fa-exclamation-triangle';
        else if (type === 'gold') icon = 'fas fa-award';

        toast.innerHTML = `<i class="${icon}" style="font-size: 1.1rem;"></i> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    async updateNotificationBadge() {
        try {
            const role = window.AuthRBAC ? window.AuthRBAC.getRole() : '';
            if (role) {
                const res = await fetch('/api/notifications', {
                    headers: {
                        'X-User-Role': role,
                        'Authorization': 'Bearer ' + (localStorage.getItem('JAMIA_AUTH_TOKEN') || '')
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && Array.isArray(data.notifications)) {
                        if (window.LmsData) {
                            const prevTopId = window.LmsData.notifications?.[0]?.id;
                            window.LmsData.notifications = data.notifications;
                            // Show newly arrived notifications if the list is open
                            const viewport = document.getElementById('main-content-viewport');
                            if (viewport && this.currentRoute === 'notifications' && data.notifications[0]?.id !== prevTopId) {
                                viewport.innerHTML = window.NotificationsModule.render();
                            }
                        }
                        const badge = document.getElementById('header-notif-badge');
                        if (badge) {
                            badge.textContent = data.unreadCount;
                            badge.style.display = data.unreadCount > 0 ? 'flex' : 'none';
                        }
                        return;
                    }
                }
            }
        } catch (e) {
            // Offline fallback
        }
        const unreadCount = (window.LmsData?.notifications || []).filter(n => !n.isRead).length;
        const badge = document.getElementById('header-notif-badge');
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
    },


    playChime() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) {
            // Audio context silently ignored if restricted by browser policy
        }
    },

    globalSearch(query) {
        if (!query || query.trim() === '') return;
        const q = query.toLowerCase().trim();
        if (q.includes('bukhari') || q.includes('hidayah') || q.includes('book') || q.includes('kitab')) {
            this.navigate('library');
            window.LibraryModule.searchBooks(q);
        } else if (q.includes('student') || q.includes('admission') || q.includes('apply')) {
            this.navigate('admissions');
        } else if (q.includes('fee') || q.includes('challan') || q.includes('zakat')) {
            this.navigate('fees');
        } else if (q.includes('exam') || q.includes('result') || q.includes('sanad')) {
            this.navigate('exams');
        } else if (q.includes('history') || q.includes('branch') || q.includes('founder')) {
            this.navigate('heritage');
        } else {
            this.showToast(`Searched for "${query}" across Jamia Ashrafia LMS`, "info");
        }
    },

    async syncMasterData() {
        try {
            const [bRes, pRes, sRes, dRes] = await Promise.all([
                fetch('/api/branches').catch(() => null),
                fetch('/api/programs').catch(() => null),
                fetch('/api/sessions').catch(() => null),
                fetch('/api/departments').catch(() => null)
            ]);

            if (bRes && bRes.ok) {
                const bData = await bRes.json();
                if (bData && bData.branches && window.LmsData) {
                    if (!window.LmsData.institution) window.LmsData.institution = {};
                    window.LmsData.institution.branches = bData.branches;
                }
            }

            if (pRes && pRes.ok) {
                const pData = await pRes.json();
                if (pData && pData.programs && window.LmsData) {
                    window.LmsData.programs = pData.programs;
                }
            }

            if (sRes && sRes.ok) {
                const sData = await sRes.json();
                if (sData && sData.sessions && window.LmsData) {
                    window.LmsData.sessions = sData.sessions;
                }
            }

            if (dRes && dRes.ok) {
                const dData = await dRes.json();
                if (dData && dData.departments && window.LmsData) {
                    window.LmsData.departments = dData.departments;
                }
            }

            if (window.DataStore && window.LmsData) {
                window.DataStore.save(window.LmsData);
            }
        } catch (err) {
            console.warn('[LMS] Could not sync academic master data from server:', err);
        }
    }
};

window.App = App;

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
