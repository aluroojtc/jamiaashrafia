/**
 * JAMIA ASHRAFIA LAHORE - CLOUD LMS APP CONTROLLER & ROUTER
 * Role-Based Dashboards, Dynamic RBAC Sidebar, 403 Forbidden Guards & User Navigation
 */

/**
 * Sidebar menu. Each page appears for anyone who may open it (see MODULE_ACCESS in auth-rbac.js), so the
 * menu and the pages can never disagree. Labels can differ for the office, teacher and student portals.
 */
const APP_NAV = [
    {
        title: { staff: 'Executive Control', teacher: 'Faculty Workspace', student: 'Talib-e-Ilm Portal' },
        items: [
            { route: 'dashboard', icon: { staff: 'fas fa-tachometer-alt', teacher: 'fas fa-chalkboard-teacher', student: 'fas fa-user-graduate' },
                label: { staff: 'Dashboard', teacher: 'Teacher Dashboard', student: 'Student Dashboard' } },
            {
                group: 'users-permissions', label: 'Users & Roles', title: 'Manage LMS Users, Roles & Permissions', icon: 'fas fa-user-shield',
                children: [
                    { route: 'users', icon: 'fas fa-users', iconColor: 'var(--primary-400)', label: 'Users' },
                    { route: 'roles', icon: 'fas fa-id-badge', iconColor: 'var(--gold-300)', label: 'Roles & Permissions' }
                ]
            },
            { route: 'heritage', icon: 'fas fa-landmark', label: 'Institutional Heritage' }
        ]
    },
    {
        title: { staff: 'Students & Faculty', teacher: 'Teaching & Students', student: 'My Academics' },
        items: [
            { route: 'students', icon: 'fas fa-user-graduate', iconColor: 'var(--primary-400)', label: { staff: 'Students Management', teacher: 'My Students Roster' } },
            { route: 'admissions', icon: 'fas fa-user-plus', label: 'Student Admissions' },
            { route: 'classes', icon: { staff: 'fas fa-chalkboard-teacher', teacher: 'fas fa-book', student: 'fas fa-book-open' },
                label: { staff: 'Classes & Curriculum', teacher: 'My Classes & Courses', student: 'My Classes & Courses' } },
            { route: 'teachers', icon: 'fas fa-user-tie', label: { staff: 'Teachers & Portals', teacher: 'Faculty & My Profile', student: 'Faculty' } }
        ]
    },
    {
        title: { staff: 'Academic & Attendance', teacher: 'Lessons & Exams', student: 'Classes & Work' },
        items: [
            { route: 'attendance', icon: 'fas fa-calendar-check', iconColor: 'var(--gold-400)',
                label: { staff: 'Attendance Monitoring', teacher: 'Faculty Attendance', student: 'My Attendance History' } },
            { route: 'virtual-class', icon: 'fas fa-video', label: 'Zoom Virtual Dars' },
            { route: 'assignments', icon: { staff: 'fas fa-edit', teacher: 'fas fa-clipboard-check', student: 'fas fa-file-upload' },
                label: { staff: 'Assignments & Checking', teacher: 'Assignments & Grading', student: 'Assignments & Submissions' } },
            { route: 'exams', icon: 'fas fa-award', label: { staff: 'Exams & Wifaq Sanad', teacher: 'Exams & Online Marking', student: 'Exams & Sanad Results' } },
            { route: 'timetable', icon: 'fas fa-calendar-alt', label: { staff: 'Schedules & Timetable', teacher: 'Class Schedule / Timetable', student: 'Schedule & Timetable' } }
        ]
    },
    {
        title: { staff: 'Reports & Finances', teacher: 'Resources & Notices', student: 'Resources & Alerts' },
        items: [
            { route: 'reports', icon: 'fas fa-chart-line', iconColor: 'var(--gold-400)', label: { staff: 'Executive Reports', teacher: 'Teacher Reports', student: 'Reports' } },
            { route: 'fees', icon: { staff: 'fas fa-hand-holding-heart', student: 'fas fa-file-invoice' }, label: { staff: 'Fees & Zakat Donations', student: 'My Fees & Payments' } },
            { route: 'library', icon: 'fas fa-book-reader', label: 'Maktaba Ashrafia' },
            { route: 'notifications', icon: 'fas fa-bullhorn', label: { staff: 'Broadcasts & Alerts', teacher: 'Notifications', student: 'Notifications' } },
            { route: 'security', icon: 'fas fa-shield-alt', label: 'Architecture & RBAC' }
        ]
    }
];

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

    async init() {
        console.log("Initializing Jamia Ashrafia Cloud LMS with Multi-Tier RBAC...");

        // Prevent browser from automatically restoring scroll position on hash navigation
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }

        const viewport = document.getElementById('main-content-viewport');
        if (viewport) {
            viewport.innerHTML = `<div style="padding: 80px 20px; text-align: center; color: var(--text-muted);"><i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i><div style="margin-top: 12px;">Loading latest data...</div></div>`;
        }
        // The server says who is signed in; a user id saved in this browser proves nothing
        const sessionUser = await window.AuthRBAC.verifySession();
        if (!sessionUser) return; // redirected to the login page
        if (sessionUser === 'offline') {
            if (viewport) {
                viewport.innerHTML = `<div style="padding: 80px 20px; text-align: center; color: var(--text-secondary);">
                    <i class="fas fa-plug" style="font-size: 2rem; color: var(--warning);"></i>
                    <h2 style="margin: 14px 0 6px; color: var(--primary-950);">The portal server cannot be reached</h2>
                    <p>Check your internet connection, then try again.</p>
                    <button class="btn btn-gold" onclick="location.reload()"><i class="fas fa-redo"></i> Try again</button>
                </div>`;
            }
            return;
        }
        // Show the signed-in user's own menu while loading (never the static placeholder)
        const cachedUser = (window.LmsData.users || []).find(u => u.id === sessionUser.id);
        if (cachedUser) {
            window.AuthRBAC.currentUser = cachedUser;
            window.AuthRBAC.updateHeaderProfile();
            this.renderSidebar();
        } else {
            const nav = document.querySelector('#app-sidebar .sidebar-nav');
            if (nav) nav.innerHTML = '';
            const nameEl = document.getElementById('header-user-name');
            if (nameEl) nameEl.textContent = 'Signing in...';
            const roleEl = document.getElementById('header-user-role');
            if (roleEl) roleEl.textContent = '';
        }
        // Fetch everyone's latest classes, assignments, results etc. from the server
        await window.DataStore.startSync();

        if (!window.AuthRBAC.init()) return;
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

        // Changes made by other users arrived from the server
        window.addEventListener('lms:data_synced', () => {
            window.AuthRBAC.refreshCurrentUser();
            this.refreshCurrentView();
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

    // Re-render the open page with fresh data, unless the user is busy in a form, modal, exam or live class
    refreshCurrentView() {
        const modalOpen = document.getElementById('global-modal-backdrop')?.classList.contains('open');
        const active = document.activeElement;
        const typing = active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);
        const inStudio = this.currentRoute === 'virtual-class' && window.VirtualClassModule && window.VirtualClassModule.currentTab === 'studio';
        const inExam = window.ExamsModule && window.ExamsModule.attempt;
        if (modalOpen || typing || inStudio || inExam) return;
        this.navigate(this.currentRoute, { preserveScroll: true });
    },

    toggleUserDropdown() {
        const dropdown = document.getElementById('header-user-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('open');
        }
    },

    // Dynamically builds the sidebar from one menu definition: an item shows when the user may open its page
    renderSidebar() {
        const sidebarNav = document.querySelector('#app-sidebar .sidebar-nav');
        if (!sidebarNav) return;
        const rbac = window.AuthRBAC;
        const portal = rbac.portal();
        const pick = v => (typeof v === 'string' ? v : (v[portal] || v.staff));
        const link = (item, child) => {
            const icon = pick(item.icon);
            return `
                <a href="#${item.route}" class="nav-item ${this.currentRoute === item.route ? 'active' : ''}" data-route="${item.route}">
                    <i class="${Lms.esc(icon)}"${item.iconColor ? ` style="color: ${item.iconColor};"` : ''}></i>
                    <span>${Lms.esc(pick(item.label))}</span>
                </a>`;
        };

        let html = '';
        APP_NAV.forEach(section => {
            const parts = [];
            section.items.forEach(item => {
                if (item.children) {
                    const kids = item.children.filter(c => rbac.canAccessRoute(c.route));
                    if (!kids.length) return;
                    const open = this.usersPermissionsSubmenuOpen;
                    parts.push(`
                        <div class="nav-group-wrapper">
                            <div class="nav-item nav-parent-item ${kids.some(k => k.route === this.currentRoute) ? 'active' : ''}"
                                 onclick="App.toggleNavSubmenu('${item.group}')" id="parent-nav-${item.group}" title="${Lms.esc(item.title || item.label)}" style="cursor: pointer;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <i class="${item.icon}" style="color: var(--gold-400);"></i>
                                    <span>${Lms.esc(item.label)}</span>
                                </div>
                                <i class="fas fa-chevron-down submenu-caret" id="caret-${item.group}" style="${open ? 'transform: rotate(180deg);' : 'transform: rotate(0deg);'}"></i>
                            </div>
                            <div class="nav-submenu-list ${open ? 'open' : ''}" id="submenu-${item.group}" style="display: ${open ? 'flex' : 'none'};">
                                ${kids.map(k => link(k, true)).join('')}
                            </div>
                        </div>`);
                    return;
                }
                if (item.route === 'dashboard' || rbac.canAccessRoute(item.route)) parts.push(link(item));
            });
            if (parts.length) html += `<div class="nav-section-title">${Lms.esc(pick(section.title))}</div>${parts.join('')}`;
        });
        sidebarNav.innerHTML = html;
    },

    navigate(route, opts = {}) {
        // Permissions are now part of each role; old links land on Roles
        if (route === 'permissions') {
            route = 'roles';
            history.replaceState(null, '', '#roles');
        }
        const leavingRoute = this.currentRoute;
        this.currentRoute = route;
        if (leavingRoute === 'virtual-class' && route !== 'virtual-class' && window.VirtualClassModule && window.VirtualClassModule.onLeaveRoute) {
            window.VirtualClassModule.onLeaveRoute();
        }

        const keepScroll = opts.preserveScroll ? {
            viewport: document.getElementById('main-content-viewport')?.scrollTop || 0,
            win: window.scrollY
        } : null;
        // Immediately reset scroll position to top across all containers
        if (!keepScroll) this.resetScrollToTop();

        // Synchronize active class in sidebar
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-route') === route) {
                item.classList.add('active');
            } else if (!item.classList.contains('nav-parent-item')) {
                item.classList.remove('active');
            }
        });

        // Synchronize parent Users & Roles item
        const parentNav = document.getElementById('parent-nav-users-permissions');
        if (parentNav) {
            if (['users', 'roles'].includes(route)) {
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

        if (keepScroll) {
            const vp = document.getElementById('main-content-viewport');
            if (vp) vp.scrollTop = keepScroll.viewport;
            window.scrollTo(0, keepScroll.win);
            return;
        }
        // Enforce guaranteed scroll reset to top (0, 0)
        this.resetScrollToTop();
    },

    // 403 Forbidden Access Denied Screen (Strict Enforcement)
    renderForbidden(route) {
        const user = window.AuthRBAC.currentUser;
        const role = window.AuthRBAC.getRole();
        const roleDef = { title: Lms.esc(window.AuthRBAC.roleName(role)) };
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
                    <div style="margin-top: 6px;"><i class="fas fa-sliders-h" style="color: var(--gold-400);"></i> <strong>Permissions Authority:</strong> Module access is set for each role under <strong>Users & Roles &rarr; Roles & Permissions</strong>.</div>
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
        // The dashboard follows the role's data scope: student portal, teacher portal or the office
        const portal = window.AuthRBAC.portal();
        if (portal === 'student') {
            return this.renderStudentDashboard();
        } else if (portal === 'teacher') {
            return this.renderTeacherDashboard();
        } else {
            return this.renderSuperAdminDashboard();
        }
    },

    // 1. SUPER ADMIN DASHBOARD
    renderSuperAdminDashboard() {
        const user = window.AuthRBAC.currentUser;
        const role = window.AuthRBAC.getRole();
        const roleDef = window.AuthRBAC.roleInfo(role);
        const inst = window.LmsData.institution;
        const liveClass = (window.LmsData.virtualClasses || []).find(vc => vc.isLive || vc.status === 'LIVE')
            || (window.LmsData.virtualClasses || []).find(vc => vc.status === 'UPCOMING');
        const totalDonations = (window.LmsData.donations || []).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
        const pendingFees = (window.LmsData.feeChallans || []).filter(c => c.status !== 'PAID');
        const verifyQueue = (window.LmsData.feeChallans || []).filter(c => c.status === 'VERIFICATION_PENDING').length;
        const can = (m) => window.AuthRBAC.canAccessModule(m);
        // Finance figures only for those allowed to see fee and donation records
        const seesFees = window.AuthRBAC.can('fees.challans.view');
        const seesDonations = window.AuthRBAC.can('donations.view');

        return `
            <!-- WELCOME HEADER -->
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-crown" style="color: var(--gold-400);"></i>
                        Jamia Ashrafia Executive Administrative Portal
                    </h1>
                    <p>
                        Welcome, <strong>${Lms.esc(user.name)}</strong>
                        <span class="status-pill gold" style="margin-left: 6px;">${Lms.esc(roleDef.name || roleDef.title || role)}</span>
                    </p>
                </div>
                <div class="view-actions">
                    ${can('roles') ? `<button class="btn btn-gold btn-sm" onclick="App.navigate('roles')">
                        <i class="fas fa-sliders-h"></i> Roles & Permissions
                    </button>` : ''}
                    ${can('admissions') ? `<button class="btn btn-primary btn-sm" onclick="App.navigate('admissions')">
                        <i class="fas fa-user-plus"></i> Admissions Queue (${window.LmsData.admissions.length})
                    </button>` : ''}
                    ${seesFees ? `<button class="btn btn-primary btn-sm" onclick="App.navigate('fees')">
                        <i class="fas fa-file-invoice-dollar"></i> Fees (${verifyQueue} to verify)
                    </button>` : ''}
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
                ${seesFees ? `<div class="metric-card info">
                    <div class="metric-icon-box"><i class="fas fa-chart-line"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Unpaid Fee Challans</span>
                        <span class="metric-value">${pendingFees.length}</span>
                        <span class="metric-hint">${Lms.money(pendingFees.reduce((s, c) => s + (Number(c.netPayable) || 0), 0))} outstanding</span>
                    </div>
                </div>` : ''}
                ${seesDonations ? `<div class="metric-card danger">
                    <div class="metric-icon-box"><i class="fas fa-hand-holding-heart"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Zakat & Sadaqat</span>
                        <span class="metric-value">${Lms.money(totalDonations)}</span>
                        <span class="metric-hint" style="color: var(--text-muted);">Kafalat-e-Talib-e-Ilm</span>
                    </div>
                </div>` : ''}
            </div>

            <!-- TWO COLUMN WORKSPACE -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
                <!-- Left: Live Class Alert Box & Highlights -->
                <div>
                    ${can('virtual_class') ? this.liveSessionCard(liveClass, true) : ''}

                    <!-- Highlights -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-history"></i> Today's Timetable (${this.todayName()})</h3>
                            <button class="btn btn-secondary btn-sm" onclick="App.navigate('timetable')">View Timetable</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            ${(() => {
                                const slots = (window.LmsData.timetables || []).filter(t => t.day === this.todayName())
                                    .sort((x, y) => String(x.startTime).localeCompare(String(y.startTime)));
                                const now = new Date().toTimeString().slice(0, 5);
                                return slots.length ? slots.map(t => this.dashListItem(
                                    `${Lms.esc(t.courseId ? Lms.courseTitle(t.courseId) : t.periodName)}`,
                                    `${Lms.fmtTime(t.startTime)} – ${Lms.fmtTime(t.endTime)} • ${Lms.esc(Lms.className(t.classId))} • ${Lms.esc(t.teacherId ? Lms.userName(t.teacherId) : t.room || '')}`,
                                    `<span class="status-pill ${now >= t.endTime ? 'success' : now >= t.startTime ? 'info' : 'gold'}">${now >= t.endTime ? 'Completed' : now >= t.startTime ? 'In Progress' : 'Upcoming'}</span>`
                                )).join('') : this.dashEmpty('No periods scheduled today.');
                            })()}
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
                            ${[
                                ['admissions', 'fas fa-user-plus', 'Admission Applications'],
                                ['classes', 'fas fa-chalkboard-teacher', 'Classes, Courses & Allocation'],
                                ['teachers', 'fas fa-user-tie', 'Teachers & Faculty Registration'],
                                ['students', 'fas fa-user-graduate', 'Students Management'],
                                ['exams', 'fas fa-award', 'Exams & Results'],
                                ['timetable', 'fas fa-calendar-alt', 'Schedules & Timetable'],
                                ['fees', 'fas fa-file-invoice', 'Fee Structure, Challans & Donations'],
                                ['library', 'fas fa-book-reader', 'Library (Maktaba)'],
                                ['reports', 'fas fa-chart-line', 'Executive Reports'],
                                ['roles', 'fas fa-sliders-h', 'Roles & Permissions']
                            ].filter(([m]) => can(m)).map(([m, icon, label]) => `
                                <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('${Object.keys(window.ROUTE_MODULE_MAP).find(r => window.ROUTE_MODULE_MAP[r] === m)}')">
                                    <i class="${icon}" style="color: var(--primary-400);"></i> ${label}
                                </button>`).join('')}
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-bullhorn"></i> Dispatches</h3>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.82rem;">
                            ${this.dashNotices(3)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // Small building blocks shared by the role dashboards
    dashListItem(title, sub, actionHtml, accent) {
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm); ${accent ? `border-left: 3px solid ${accent};` : ''}">
                <div style="min-width: 0;">
                    <div style="font-weight: 700; color: var(--primary-950);">${title}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${sub}</div>
                </div>
                ${actionHtml || ''}
            </div>`;
    },

    dashEmpty(text) {
        return `<div style="padding: 14px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">${text}</div>`;
    },

    dashNotices(limit = 4) {
        const list = (window.LmsData.notifications || []).slice(0, limit);
        if (!list.length) return this.dashEmpty('No notifications yet.');
        return list.map(n => `
            <div style="padding: 10px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm); border-left: 3px solid ${n.isRead ? 'var(--border-prominent)' : 'var(--gold-400)'}; cursor: pointer;" onclick="App.navigate('notifications')">
                <div style="font-weight: 700; color: var(--primary-950);">${Lms.esc(n.title)}</div>
                <div style="color: var(--text-muted); font-size: 0.72rem; margin-top: 2px;">${Lms.esc(n.sender || '')} • ${Lms.esc(n.time || '')}</div>
            </div>`).join('');
    },

    todayName() {
        return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
    },

    liveSessionCard(session, isHostView) {
        if (!session) return '';
        const live = session.isLive || session.status === 'LIVE';
        return `
            <div class="card" style="border: 2px solid ${live ? 'var(--danger)' : 'var(--gold-400)'}; background: linear-gradient(135deg, var(--primary-50) 0%, var(--gold-50) 100%);">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <div>
                        ${live
                            ? `<span class="status-pill danger" style="animation: pulse 1.5s infinite;"><i class="fas fa-circle"></i> Live Now</span>`
                            : `<span class="status-pill gold"><i class="fas fa-clock"></i> Next Online Class • ${Lms.esc(session.scheduledStart || '')}</span>`}
                        <h3 style="color: var(--text-primary); margin-top: 6px;">${Lms.esc(session.title)}</h3>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);"><i class="fas fa-user-tie"></i> ${Lms.esc(session.hostTeacher || '')} • ${Lms.esc(session.className || '')}</div>
                    </div>
                    <button class="btn ${live ? 'btn-primary' : 'btn-secondary'}" onclick="App.navigate('virtual-class')">
                        <i class="fas ${live ? 'fa-sign-in-alt' : 'fa-video'}"></i> ${live ? (isHostView ? 'Open Live Room' : 'Join Class') : 'Online Classes'}
                    </button>
                </div>
            </div>`;
    },

    // 2. TEACHER DASHBOARD (teacher portal with live data)
    renderTeacherDashboard() {
        const user = window.AuthRBAC.currentUser;
        const data = window.LmsData;
        const classIds = Lms.teacherClassIds(user.id);
        const myStudents = Lms.students().filter(s => classIds.includes(s.classId));
        const myAssignments = (data.assignments || []).filter(a => a.teacherId === user.id || classIds.includes(a.classId));
        const asgIds = new Set(myAssignments.map(a => a.id));
        const toCheck = (data.assignmentSubmissions || []).filter(s => asgIds.has(s.assignmentId) && !s.isGraded);
        const myExams = (data.exams || []).filter(e => e.createdBy === user.id || classIds.includes(e.classId));
        const examIds = new Set(myExams.map(e => e.id));
        const papersToMark = (data.examSubmissions || []).filter(s => examIds.has(s.examId) && !s.isMarked);
        const today = this.todayName();
        const todaySlots = (data.timetables || []).filter(t => t.day === today && t.teacherId === user.id)
            .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
        const sessions = (data.virtualClasses || []).filter(vc => vc.hostId === user.id || classIds.includes(vc.classId));
        const liveOrNext = sessions.find(vc => vc.isLive || vc.status === 'LIVE') || sessions.find(vc => vc.status === 'UPCOMING');
        const myCourseRows = [];
        (data.classes || []).forEach(c => (c.courseTeachers || []).forEach(ct => {
            if (ct.teacherId === user.id) myCourseRows.push({ cls: c, course: Lms.getCourse(ct.courseId) });
        }));

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1><i class="fas fa-chalkboard-teacher" style="color: var(--gold-400);"></i> Teacher Portal</h1>
                    <p>
                        Welcome, <strong>${Lms.esc(user.name)}</strong>
                        <span class="status-pill success" style="margin-left: 6px;">${Lms.esc(user.designation || 'Teacher')}</span>
                        <span style="font-family: 'Amiri', serif; margin-left: 8px; color: var(--gold-700);">${Lms.esc(user.urduName || '')}</span>
                    </p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-gold btn-sm" onclick="App.navigate('virtual-class')"><i class="fas fa-video"></i> Online Classes</button>
                    <button class="btn btn-primary btn-sm" onclick="App.navigate('assignments')"><i class="fas fa-clipboard-check"></i> Check Assignments</button>
                    <button class="btn btn-secondary btn-sm" onclick="TeachersModule.openMyProfileModal()"><i class="fas fa-user-edit"></i> My Profile</button>
                </div>
            </div>

            ${window.AttendanceModule ? window.AttendanceModule.renderDashboardCheckInWidget(user) : ''}

            <div class="metrics-grid">
                <div class="metric-card gold" style="cursor: pointer;" onclick="App.navigate('classes')">
                    <div class="metric-icon-box"><i class="fas fa-users"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">My Classes</span>
                        <span class="metric-value">${classIds.length}</span>
                        <span class="metric-hint">${myStudents.length} students enrolled</span>
                    </div>
                </div>
                <div class="metric-card" style="cursor: pointer;" onclick="App.navigate('assignments')">
                    <div class="metric-icon-box"><i class="fas fa-tasks"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Assignments to Check</span>
                        <span class="metric-value">${toCheck.length}</span>
                        <span class="metric-hint">${myAssignments.length} assignments published</span>
                    </div>
                </div>
                <div class="metric-card info" style="cursor: pointer;" onclick="App.navigate('exams')">
                    <div class="metric-icon-box"><i class="fas fa-pen-nib"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Exam Papers to Mark</span>
                        <span class="metric-value">${papersToMark.length}</span>
                        <span class="metric-hint">${myExams.length} exams in my classes</span>
                    </div>
                </div>
                <div class="metric-card success" style="cursor: pointer;" onclick="App.navigate('timetable')">
                    <div class="metric-icon-box"><i class="fas fa-calendar-day"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Today's Periods (${today})</span>
                        <span class="metric-value">${todaySlots.length}</span>
                        <span class="metric-hint">${todaySlots[0] ? 'First: ' + Lms.fmtTime(todaySlots[0].startTime) : 'No lectures today'}</span>
                    </div>
                </div>
            </div>

            <div class="dash-two-col" style="display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 24px;">
                <div>
                    ${this.liveSessionCard(liveOrNext, true)}

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-book"></i> My Classes & Kitabs</h3>
                            <button class="btn btn-secondary btn-sm" onclick="App.navigate('classes')">Open Classes</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            ${myCourseRows.length ? myCourseRows.map(r => this.dashListItem(
                                `${Lms.esc(r.course ? r.course.title : 'Kitab')}`,
                                `${Lms.esc(r.cls.name)} — ${Lms.esc(r.cls.section || '')} • ${Lms.studentsInClass(r.cls.id).length} students • ${Lms.esc(r.cls.room || '')}`,
                                `<button class="btn btn-secondary btn-sm" onclick="ClassesCoursesModule.selectClass('${r.cls.id}')">Open</button>`
                            )).join('') : this.dashEmpty('No kitabs are allocated to you yet. The Academic Office assigns classes from "Classes & Courses".')}
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-clipboard-check"></i> Waiting for Checking</h3>
                            <button class="btn btn-secondary btn-sm" onclick="App.navigate('assignments')">All Submissions</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            ${toCheck.slice(0, 5).map(s => {
                                const a = (data.assignments || []).find(x => x.id === s.assignmentId) || {};
                                return this.dashListItem(Lms.esc(s.studentName), `${Lms.esc(a.title || '')} • submitted ${Lms.fmtDateTime(s.submittedAt)}`,
                                    `<button class="btn btn-gold btn-sm" onclick="AssignmentsModule.openGradeSubmissionModal('${s.id}')">Check</button>`, 'var(--warning)');
                            }).join('')}
                            ${papersToMark.slice(0, 5).map(s => {
                                const ex = (data.exams || []).find(x => x.id === s.examId) || {};
                                return this.dashListItem(Lms.esc(s.studentName), `Exam: ${Lms.esc(ex.title || '')} • ${Lms.fmtDateTime(s.submittedAt)}`,
                                    `<button class="btn btn-gold btn-sm" onclick="ExamsModule.openMarkSubmissionModal('${s.id}')">Mark</button>`, 'var(--info)');
                            }).join('')}
                            ${!toCheck.length && !papersToMark.length ? this.dashEmpty('All caught up — nothing waiting for checking.') : ''}
                        </div>
                    </div>
                </div>

                <div>
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-calendar-alt"></i> Today's Schedule</h3>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${todaySlots.length ? todaySlots.map(t => this.dashListItem(
                                `${Lms.fmtTime(t.startTime)} – ${Lms.fmtTime(t.endTime)}`,
                                `${Lms.esc(Lms.courseTitle(t.courseId))} • ${Lms.esc(Lms.className(t.classId))} • ${Lms.esc(t.room || '')}`
                            )).join('') : this.dashEmpty(today === 'Friday' ? 'Jumu\'ah — no classes today.' : 'No lectures scheduled for you today.')}
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-bolt"></i> Quick Actions</h3>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <button class="btn btn-gold" style="justify-content: flex-start;" onclick="App.navigate('virtual-class'); setTimeout(() => VirtualClassModule.openScheduleModal(), 50);"><i class="fas fa-video"></i> Schedule an Online Class</button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('assignments'); setTimeout(() => AssignmentsModule.openCreateAssignmentModal(), 50);"><i class="fas fa-plus-circle"></i> Create Assignment</button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('exams'); setTimeout(() => ExamsModule.openExamEditor(), 50);"><i class="fas fa-file-signature"></i> Create Exam / Quiz</button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="TeachersModule.openAttendanceModal()"><i class="fas fa-clipboard-list"></i> Mark Class Attendance</button>
                            <button class="btn btn-secondary" style="justify-content: flex-start;" onclick="App.navigate('notifications'); setTimeout(() => NotificationsModule.openBroadcastModal(), 50);"><i class="fas fa-bullhorn"></i> Notify My Students</button>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-bell"></i> Notifications</h3>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.82rem;">${this.dashNotices()}</div>
                    </div>
                </div>
            </div>
        `;
    },

    // 3. STUDENT DASHBOARD (live data for the signed-in student)
    renderStudentDashboard() {
        const user = window.AuthRBAC.currentUser;
        const data = window.LmsData;
        const cls = Lms.getClass(user.classId);
        const today = Lms.today();
        const myAssignments = (data.assignments || []).filter(a => a.classId === user.classId);
        const mySubs = (data.assignmentSubmissions || []).filter(s => s.studentId === user.id);
        const pending = myAssignments.filter(a => !mySubs.some(s => s.assignmentId === a.id))
            .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
        const myExams = (data.exams || []).filter(e => e.classId === user.classId && e.status !== 'CLOSED' && (e.status === 'OPEN' || e.examDate >= today))
            .sort((a, b) => String(a.examDate).localeCompare(String(b.examDate)));
        const results = (data.examResults || []).filter(r => r.studentId === user.id && r.published);
        const dues = (data.feeChallans || []).filter(c => c.studentId === user.id && c.status !== 'PAID');
        const loans = (data.libraryLoans || []).filter(l => l.userId === user.id && l.status === 'ISSUED');
        const sessions = (data.virtualClasses || []).filter(vc => vc.classId === user.classId);
        const liveOrNext = sessions.find(vc => vc.isLive || vc.status === 'LIVE') || sessions.find(vc => vc.status === 'UPCOMING');
        const dayName = this.todayName();
        const todaySlots = (data.timetables || []).filter(t => t.day === dayName && (t.classId === user.classId || t.classId === 'all'))
            .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1><i class="fas fa-user-graduate" style="color: var(--gold-400);"></i> Student Portal</h1>
                    <p>
                        Welcome, <strong>${Lms.esc(user.name)}</strong>
                        <span class="status-pill primary" style="margin-left: 6px;">Roll No: ${Lms.esc(user.rollNo || '—')}</span>
                        <span style="font-family: 'Amiri', serif; margin-left: 8px; color: var(--gold-700);">${Lms.esc(user.urduName || '')}</span>
                    </p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-gold btn-sm" onclick="App.navigate('virtual-class')"><i class="fas fa-video"></i> Online Classes</button>
                    <button class="btn btn-primary btn-sm" onclick="App.navigate('assignments')"><i class="fas fa-file-upload"></i> Submit Homework</button>
                </div>
            </div>

            ${window.AttendanceModule ? window.AttendanceModule.renderDashboardCheckInWidget(user) : ''}

            ${!cls ? `
                <div class="card" style="border-left: 4px solid var(--warning);">
                    <strong><i class="fas fa-exclamation-triangle" style="color: var(--warning);"></i> You are not enrolled in a class yet.</strong>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">The Academic Office will assign your class. Assignments, exams and online classes appear here once you are enrolled.</div>
                </div>` : ''}

            <div class="metrics-grid">
                <div class="metric-card gold" style="cursor: pointer;" onclick="App.navigate('classes')">
                    <div class="metric-icon-box"><i class="fas fa-book-open"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">My Class</span>
                        <span class="metric-value" style="font-size: 1.05rem;">${Lms.esc(cls ? cls.name : 'Not enrolled')}</span>
                        <span class="metric-hint">${cls ? Lms.classCourseIds(cls.id).length + ' kitabs • ' + Lms.esc(cls.section || '') : ''}</span>
                    </div>
                </div>
                <div class="metric-card" style="cursor: pointer;" onclick="App.navigate('assignments')">
                    <div class="metric-icon-box"><i class="fas fa-tasks"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Assignments Pending</span>
                        <span class="metric-value">${pending.length}</span>
                        <span class="metric-hint">${pending[0] ? 'Next due ' + Lms.fmtDate(pending[0].dueDate) : 'Nothing pending'}</span>
                    </div>
                </div>
                <div class="metric-card info" style="cursor: pointer;" onclick="App.navigate('exams')">
                    <div class="metric-icon-box"><i class="fas fa-award"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Upcoming / Open Exams</span>
                        <span class="metric-value">${myExams.length}</span>
                        <span class="metric-hint">${results.length} result(s) published</span>
                    </div>
                </div>
                <div class="metric-card ${dues.length ? 'danger' : 'success'}" style="cursor: pointer;" onclick="App.navigate('fees')">
                    <div class="metric-icon-box"><i class="fas fa-file-invoice"></i></div>
                    <div class="metric-content">
                        <span class="metric-label">Fee Dues</span>
                        <span class="metric-value">${Lms.money(dues.reduce((s, c) => s + (Number(c.netPayable) || 0), 0))}</span>
                        <span class="metric-hint">${dues.length} unpaid challan(s) • ${loans.length} library book(s)</span>
                    </div>
                </div>
            </div>

            <div class="dash-two-col" style="display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 24px;">
                <div>
                    ${this.liveSessionCard(liveOrNext, false)}

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-tasks"></i> Homework To Do</h3>
                            <button class="btn btn-secondary btn-sm" onclick="App.navigate('assignments')">All Assignments</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            ${pending.length ? pending.slice(0, 5).map(a => this.dashListItem(Lms.esc(a.title),
                                `${Lms.esc(Lms.courseTitle(a.courseId))} • Due ${Lms.fmtDate(a.dueDate)}${a.dueDate < today ? ' <strong style="color: var(--danger);">(overdue)</strong>' : ''}`,
                                `<button class="btn btn-primary btn-sm" onclick="AssignmentsModule.openStudentUploadModal('${a.id}')"><i class="fas fa-upload"></i> Submit</button>`,
                                a.dueDate < today ? 'var(--danger)' : 'var(--gold-400)')).join('') : this.dashEmpty('No pending homework. Alhamdulillah!')}
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-file-signature"></i> Exams</h3>
                            <button class="btn btn-secondary btn-sm" onclick="App.navigate('exams')">Exams & Results</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            ${myExams.length ? myExams.slice(0, 4).map(e => this.dashListItem(Lms.esc(e.title),
                                `${Lms.fmtDate(e.examDate)} at ${Lms.fmtTime(e.startTime)} • ${e.durationMinutes} min • ${e.mode === 'ONLINE' ? 'Online' : 'In hall'}`,
                                e.status === 'OPEN' && e.mode === 'ONLINE' ? `<button class="btn btn-primary btn-sm" onclick="App.navigate('exams')">Attempt</button>` : '')).join('') : this.dashEmpty('No upcoming exams.')}
                        </div>
                    </div>
                </div>

                <div>
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-calendar-alt"></i> Today (${dayName})</h3>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${todaySlots.length ? todaySlots.map(t => this.dashListItem(
                                `${Lms.fmtTime(t.startTime)} – ${Lms.fmtTime(t.endTime)}`,
                                `${Lms.esc(t.courseId ? Lms.courseTitle(t.courseId) : t.periodName)} • ${Lms.esc(t.teacherId ? Lms.userName(t.teacherId) : t.room || '')}`
                            )).join('') : this.dashEmpty(dayName === 'Friday' ? 'Jumu\'ah — no classes today.' : 'No periods scheduled today.')}
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-bell"></i> Notifications</h3>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.82rem;">${this.dashNotices()}</div>
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
        const roleInfo = window.AuthRBAC.roleInfo(role);
        const roleDef = { title: Lms.esc(roleInfo.name || role), badgeClass: roleInfo.badgeClass };

        const titleEl = document.getElementById('modal-title-text');
        const bodyEl = document.getElementById('modal-body-container');
        const footerEl = document.getElementById('modal-footer-container');

        if (titleEl) titleEl.innerHTML = `<i class="fas fa-id-badge" style="color: var(--gold-400);"></i> Institutional Profile`;
        if (bodyEl) {
            bodyEl.innerHTML = `
                <div style="text-align: center; margin-bottom: 20px;">
                    <div class="user-avatar" style="width: 72px; height: 72px; font-size: 1.6rem; margin: 0 auto 12px; border: 2px solid var(--gold-400);">${Lms.esc(user.avatar || 'JA')}</div>
                    <h3 style="color: var(--primary-950); margin-bottom: 4px;">${Lms.esc(user.name)}</h3>
                    <div style="font-family: 'Amiri', serif; font-size: 1.25rem; color: var(--gold-700);">${Lms.esc(user.urduName || '')}</div>
                    <span class="status-pill ${roleDef.badgeClass || 'gold'}" style="margin-top: 6px;">${roleDef.title}</span>
                </div>

                <div style="background: var(--bg-surface-elevated); border-radius: var(--radius-sm); padding: 16px; font-size: 0.85rem; line-height: 1.9;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
                        <span style="color: var(--text-muted);"><i class="fas fa-envelope"></i> Official Email:</span>
                        <strong style="color: var(--text-primary);">${Lms.esc(user.email || 'N/A')}</strong>
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
                ${window.AuthRBAC.isSuperAdmin() ? `
                    <button class="btn btn-gold" onclick="RolesModule.editSuperAdminProfile()">
                        <i class="fas fa-user-edit"></i> Edit Profile
                    </button>
                ` : ''}
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

        // Messages often contain names and other text people typed, so they are always shown as plain text
        toast.innerHTML = `<i class="${icon}" style="font-size: 1.1rem;"></i> <span></span>`;
        toast.querySelector('span').textContent = String(message === undefined || message === null ? '' : message);
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
                // The session cookie identifies the user; the server works out their classes itself
                const res = await fetch('/api/notifications', { cache: 'no-store' });
                if (res.status === 401) {
                    window.location.replace('login.html?expired=1');
                    return;
                }
                if (res.ok) {
                    const data = await res.json();
                    if (data && Array.isArray(data.notifications)) {
                        if (window.LmsData) {
                            const prevTopId = window.LmsData.notifications?.[0]?.id;
                            const prevUnread = this.lastUnreadCount;
                            window.LmsData.notifications = data.notifications;
                            this.lastUnreadCount = data.unreadCount;
                            if (prevUnread !== undefined && data.unreadCount > prevUnread && data.notifications[0]?.id !== prevTopId) {
                                this.playChime();
                                this.showToast(`New notification: ${data.notifications[0].title}`, 'gold');
                            }
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
        const unreadCount = (window.NotificationsModule ? window.NotificationsModule.visibleList() : (window.LmsData?.notifications || [])).filter(n => !n.isRead).length;
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
