/**
 * JAMIA ASHRAFIA LAHORE - ENHANCED VIRTUAL CLASSROOM SUITE
 * Multi-Room Simultaneous Sessions, Backend RBAC Access Control, Interactive WebRTC Studio,
 * Attendance Check-In, Recordings Vault, and Super Admin Storage Retention Management.
 */

const VirtualClassModule = {
    // Current Active View State
    currentTab: 'lobby', // 'lobby' | 'studio' | 'recordings' | 'attendance' | 'retention'
    lobbyFilter: 'ALL',   // 'ALL' | 'LIVE' | 'UPCOMING' | 'COMPLETED'
    lobbySearch: '',
    activeSessionId: null,
    activeSession: null,
    isHost: false,
    accessBlocked: false,
    accessBlockedReason: '',

    // Filters for Vault and Attendance
    recordingFilterClass: 'ALL',
    recordingSearch: '',
    attendanceFilterClass: 'ALL',

    // Recording retention and storage (server: /api/settings/recordings)
    recordingSettings: { retentionDays: 90, allowStudentDownload: false, autoCleanupEnabled: false, storageQuotaGB: 50, usedBytes: 0, recordingCount: 0, lastCleanupDate: null },

    async loadRecordingSettings() {
        try {
            const data = await Lms.api('GET', '/api/settings/recordings');
            if (data.settings) this.recordingSettings = data.settings;
        } catch (e) { /* keep the last known settings */ }
        return this.recordingSettings;
    },

    usedStorageGB() {
        return Math.round(((this.recordingSettings.usedBytes || 0) / (1024 * 1024 * 1024)) * 100) / 100;
    },

    // Days a recording has left before the retention clean-up removes it (null: kept permanently)
    daysRemaining(rec) {
        const keep = Number(this.recordingSettings.retentionDays) || 0;
        if (!keep || rec.autoDeleteProtected) return null;
        const recorded = Date.parse(`${String(rec.recordedDate || '').slice(0, 10)}T00:00:00`);
        if (Number.isNaN(recorded)) return null;
        return Math.max(0, keep - Math.floor((Date.now() - recorded) / 86400000));
    },

    // Class filter options built from the classes that exist
    classFilterOptions(selected) {
        return `<option value="ALL">All Academic Classes</option>` + (window.LmsData.classes || [])
            .map(c => `<option value="${Lms.esc(c.id)}" ${selected === c.id ? 'selected' : ''}>${Lms.esc(Lms.className(c.id))}</option>`).join('');
    },

    // Students (and staff) who checked in to this online class
    attendeeCount(session) {
        return (window.LmsData.attendance || []).filter(a => a.session === 'VIRTUAL_CLASS' && a.virtualSessionId === session.id).length;
    },

    // Where an online class ran, for attendance lists
    platformOf(sessionId) {
        const s = (window.LmsData.virtualClasses || []).find(v => v.id === sessionId);
        if (!s) return 'Online class';
        return s.platform === 'EXTERNAL' && s.externalUrl ? this.platformName(s.externalUrl) : 'Built-in live classroom';
    },

    /**
     * Main Module Entry Point
     */
    render() {
        if (!this._meetingConfigLoaded) {
            this._meetingConfigLoaded = true;
            Promise.all([this.loadMeetingConfig(), this.loadRecordingSettings()]).then(() => {
                if (window.App?.currentRoute === 'virtual-class' && this.currentTab !== 'studio') this.switchTab(this.currentTab);
            });
        }
        const currentUser = window.AuthRBAC?.currentUser || {};
        // Recording retention & vault administration, and managing every class (not just one's own)
        const canRetention = window.AuthRBAC.can('settings.recordings');
        const canManageAll = window.AuthRBAC.can('virtual_classes.manage');
        const isTeacher = window.AuthRBAC?.isTeacher();
        const isStudent = window.AuthRBAC?.isStudent();

        // Get sessions from data store
        const allSessions = window.LmsData?.virtualClasses || [];
        const liveCount = allSessions.filter(s => s.isLive || s.status === 'LIVE').length;
        const recordingsCount = (window.LmsData?.virtualClassRecordings || []).length;

        return `
            <!-- VIRTUAL CLASSROOM HEADER -->
            <div class="view-header" style="margin-bottom: 16px;">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-video" style="color: var(--primary-500, #10b981);"></i>
                        Virtual Classroom: Jamia Live Dars Suite
                        ${liveCount > 0 ? `
                            <span class="status-pill danger" style="animation: pulse 2s infinite; font-size: 0.78rem;">
                                <i class="fas fa-circle"></i> ${liveCount} Live Session${liveCount > 1 ? 's' : ''} Now
                            </span>
                        ` : ''}
                    </h1>
                    <p>HD Interactive Video Conferencing, Class-Restricted Halls, Attendance Sync & Sacred Knowledge Archive</p>
                </div>
                <div class="view-actions">
                    ${window.AuthRBAC.can('virtual_classes.host') ? `
                        <button class="btn btn-primary btn-sm" onclick="VirtualClassModule.openScheduleModal()">
                            <i class="fas fa-plus-circle"></i> Schedule / Launch Class
                        </button>
                    ` : ''}
                    ${this.currentTab === 'studio' ? `
                        <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.switchTab('lobby')">
                            <i class="fas fa-th-large"></i> Back to Classrooms Lobby
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- SUB-TAB NAVIGATION BAR -->
            <div class="vc-tab-nav">
                <button class="vc-tab-btn ${this.currentTab === 'lobby' ? 'active' : ''}" onclick="VirtualClassModule.switchTab('lobby')">
                    <i class="fas fa-chalkboard-teacher"></i> Classrooms Lobby
                    <span class="badge-pill">${allSessions.length}</span>
                </button>
                <button class="vc-tab-btn ${this.currentTab === 'studio' ? 'active' : ''}" onclick="VirtualClassModule.switchTab('studio')">
                    <i class="fas fa-video"></i> Live Studio Room
                    ${this.activeSession?.isLive ? `<span class="rec-dot" style="width: 6px; height: 6px;"></span>` : ''}
                </button>
                ${window.AuthRBAC.can('recordings.view') ? `<button class="vc-tab-btn ${this.currentTab === 'recordings' ? 'active' : ''}" onclick="VirtualClassModule.switchTab('recordings')">
                    <i class="fas fa-film"></i> Recordings Vault
                    <span class="badge-pill">${recordingsCount}</span>
                </button>` : ''}
                <button class="vc-tab-btn ${this.currentTab === 'attendance' ? 'active' : ''}" onclick="VirtualClassModule.switchTab('attendance')">
                    <i class="fas fa-clipboard-check"></i> Attendance & Reports
                </button>
                ${canRetention ? `
                    <button class="vc-tab-btn ${this.currentTab === 'retention' ? 'active' : ''}" onclick="VirtualClassModule.switchTab('retention')">
                        <i class="fas fa-database"></i> Storage & Retention
                    </button>
                ` : ''}
            </div>

            <!-- DYNAMIC VIEW TAB CONTENT -->
            <div id="vc-tab-content-area">
                ${this.renderCurrentTabContent()}
            </div>
        `;
    },

    renderCurrentTabContent() {
        switch (this.currentTab) {
            case 'lobby':
                return this.renderLobby();
            case 'studio':
                return this.renderStudio();
            case 'recordings':
                // Watching recordings depends on the person's role or type
                return window.AuthRBAC.can('recordings.view') ? this.renderRecordings() : this.renderLobby();
            case 'attendance':
                return this.renderAttendance();
            case 'retention':
                return this.renderRetention();
            default:
                return this.renderLobby();
        }
    },

    switchTab(tabName) {
        this.currentTab = tabName;
        const area = document.getElementById('vc-tab-content-area');
        if (area) {
            // Update active state in nav buttons
            document.querySelectorAll('.vc-tab-btn').forEach(btn => btn.classList.remove('active'));
            const activeBtn = Array.from(document.querySelectorAll('.vc-tab-btn')).find(b => b.textContent.toLowerCase().includes(tabName.substring(0, 4)));
            if (activeBtn) activeBtn.classList.add('active');

            area.innerHTML = this.renderCurrentTabContent();
            this.initAfterRender();
        } else {
            window.App?.navigate('virtual-class');
        }
    },

    // =========================================================================
    // 1. CLASSROOMS LOBBY VIEW
    // =========================================================================
    renderLobby() {
        const currentUser = window.AuthRBAC?.currentUser || {};
        // Recording retention & vault administration, and managing every class (not just one's own)
        const canRetention = window.AuthRBAC.can('settings.recordings');
        const canManageAll = window.AuthRBAC.can('virtual_classes.manage');
        const isTeacher = window.AuthRBAC?.isTeacher();
        const isStudent = window.AuthRBAC?.isStudent();

        const myClassIds = Lms.myClassIds();
        const allSessions = (window.LmsData?.virtualClasses || []).filter(s => canManageAll || myClassIds.includes(s.classId) || s.hostId === currentUser.id);
        const studentEnrolledClass = currentUser.classId || '';

        // Filter sessions by search & status
        let filteredSessions = allSessions.filter(session => {
            if (this.lobbyFilter === 'LIVE' && !session.isLive && session.status !== 'LIVE') return false;
            if (this.lobbyFilter === 'UPCOMING' && session.status !== 'UPCOMING') return false;
            if (this.lobbyFilter === 'COMPLETED' && session.status !== 'COMPLETED') return false;

            if (this.lobbySearch) {
                const q = this.lobbySearch.toLowerCase();
                const matchTitle = session.title?.toLowerCase().includes(q);
                const matchClass = session.className?.toLowerCase().includes(q);
                const matchTeacher = session.hostTeacher?.toLowerCase().includes(q);
                if (!matchTitle && !matchClass && !matchTeacher) return false;
            }
            return true;
        });

        // Compute metrics
        const liveRooms = allSessions.filter(s => s.isLive || s.status === 'LIVE').length;
        const upcomingRooms = allSessions.filter(s => s.status === 'UPCOMING').length;
        const completedRooms = allSessions.filter(s => s.status === 'COMPLETED').length;
        const settings = this.recordingSettings;

        return `
            <!-- QUICK METRICS STATS BAR -->
            <div class="vc-stats-grid">
                <div class="vc-stat-card">
                    <div class="vc-stat-icon green">
                        <i class="fas fa-tower-broadcast"></i>
                    </div>
                    <div>
                        <div class="stat-val">${liveRooms} Active</div>
                        <div class="stat-lbl">Concurrent Live Rooms</div>
                    </div>
                </div>
                <div class="vc-stat-card">
                    <div class="vc-stat-icon gold">
                        <i class="fas fa-calendar-alt"></i>
                    </div>
                    <div>
                        <div class="stat-val">${upcomingRooms} Scheduled</div>
                        <div class="stat-lbl">Scheduled Classes</div>
                    </div>
                </div>
                <div class="vc-stat-card">
                    <div class="vc-stat-icon blue">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <div>
                        <div class="stat-val">${myClassIds.length} ${isStudent ? 'Enrolled' : 'Class' + (myClassIds.length === 1 ? '' : 'es')}</div>
                        <div class="stat-lbl">${isStudent ? 'Your Class Section' : 'Sections you can host'}</div>
                    </div>
                </div>
                <div class="vc-stat-card">
                    <div class="vc-stat-icon purple">
                        <i class="fas fa-cloud-upload-alt"></i>
                    </div>
                    <div>
                        <div class="stat-val">${this.usedStorageGB()} GB</div>
                        <div class="stat-lbl">Cloud Storage Used (of ${settings.storageQuotaGB} GB)</div>
                    </div>
                </div>
            </div>

            <!-- SECURITY / ACCESS CONTROL NOTICE -->
            <div class="vc-security-shield">
                <i class="fas fa-shield-alt"></i>
                <div style="flex: 1;">
                    <strong style="color: #991b1b;">Institutional Security & Class Access Enforcement Active:</strong>
                    <span>
                        ${isStudent ? `
                            ${I18n.t("You are signed in as {name} (Class: {cls}). Only your own class's live sessions can be joined.", { name: `<strong>${Lms.esc(currentUser.name)}</strong>`, cls: `<em>${Lms.esc(studentEnrolledClass ? Lms.className(studentEnrolledClass) : I18n.t('not enrolled'))}</em>` })}
                        ` : isTeacher ? `
                            ${I18n.t('You are instructing as {name}. You possess host moderation authority over your designated Dars-e-Nizami sections.', { name: `<strong>${Lms.esc(currentUser.name)}</strong>` })}
                        ` : `
                            Super Admin Global Oversight active. Full supervisory authority, moderation override, and storage retention privileges enabled.
                        `}
                    </span>
                </div>
            </div>

            <!-- TOOLBAR: FILTER TABS & SEARCH -->
            <div class="vc-filter-toolbar">
                <div class="vc-filter-group">
                    <button class="vc-filter-btn ${this.lobbyFilter === 'ALL' ? 'active' : ''}" onclick="VirtualClassModule.setLobbyFilter('ALL')">
                        All Classrooms (${allSessions.length})
                    </button>
                    <button class="vc-filter-btn ${this.lobbyFilter === 'LIVE' ? 'active' : ''}" onclick="VirtualClassModule.setLobbyFilter('LIVE')">
                        <i class="fas fa-circle" style="color: #ef4444; font-size: 0.6rem;"></i> Live Now (${liveRooms})
                    </button>
                    <button class="vc-filter-btn ${this.lobbyFilter === 'UPCOMING' ? 'active' : ''}" onclick="VirtualClassModule.setLobbyFilter('UPCOMING')">
                        Upcoming (${upcomingRooms})
                    </button>
                    <button class="vc-filter-btn ${this.lobbyFilter === 'COMPLETED' ? 'active' : ''}" onclick="VirtualClassModule.setLobbyFilter('COMPLETED')">
                        Completed (${completedRooms})
                    </button>
                </div>

                <div style="display: flex; gap: 8px; align-items: center;">
                    <div style="position: relative;">
                        <input type="text" placeholder="Search class, course or Sheikh..." value="${this.lobbySearch}" 
                               oninput="VirtualClassModule.handleLobbySearch(this.value)"
                               class="form-control"
                               style="background: #ffffff; border: 1px solid var(--border-prominent); padding-block: 7px; padding-inline: 32px 12px; border-radius: 6px; color: var(--text-primary); font-size: 0.85rem; width: 270px;">
                        <i class="fas fa-search" style="position: absolute; inset-inline-start: 10px; top: 10px; color: var(--text-muted); font-size: 0.8rem;"></i>
                    </div>
                </div>
            </div>

            <!-- CLASSROOM CARDS GRID -->
            <div class="vc-lobby-grid">
                ${filteredSessions.length === 0 ? `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: var(--text-muted);">
                        <i class="fas fa-video-slash" style="font-size: 3rem; margin-bottom: 12px; opacity: 0.5;"></i>
                        <h4>No Virtual Classrooms Found</h4>
                        <p>No lectures match the active filter or search criteria.</p>
                    </div>
                ` : filteredSessions.map(session => this.renderClassroomCard(session, currentUser)).join('')}
            </div>
        `;
    },

    renderClassroomCard(session, currentUser) {
        // Recording retention & vault administration, and managing every class (not just one's own)
        const canRetention = window.AuthRBAC.can('settings.recordings');
        const canManageAll = window.AuthRBAC.can('virtual_classes.manage');
        const isTeacher = window.AuthRBAC?.isTeacher();
        const isStudent = window.AuthRBAC?.isStudent();

        const studentClass = currentUser.classId || '';
        const isEnrolledClass = !isStudent || session.classId === studentClass;
        const isSessionHost = this.canHost(session);
        const isLive = session.isLive || session.status === 'LIVE';

        // Badge determination
        let badgeHtml = '';
        if (isLive) {
            badgeHtml = `<span class="vc-card-badge live"><span class="rec-dot" style="width:6px;height:6px;"></span> Live Now</span>`;
        } else if (session.status === 'UPCOMING') {
            badgeHtml = `<span class="vc-card-badge upcoming"><i class="fas fa-clock"></i> Upcoming</span>`;
        } else {
            badgeHtml = `<span class="vc-card-badge completed"><i class="fas fa-check-circle"></i> Completed</span>`;
        }

        return `
            <div class="vc-card ${isLive ? 'is-live' : ''}">
                <div class="vc-card-header">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="font-size: 0.74rem; font-family: monospace; font-weight: 700; color: var(--primary-800);">
                            ${Lms.esc(session.meetingUuid)}
                        </span>
                        <span class="status-pill ${isEnrolledClass ? 'success' : 'neutral'}" style="font-size: 0.7rem; align-self: flex-start;">
                            <i class="fas ${isEnrolledClass ? 'fa-check' : 'fa-lock'}"></i>
                            ${Lms.esc(session.className)}
                        </span>
                    </div>
                    ${badgeHtml}
                </div>

                <div class="vc-card-body">
                    <div class="vc-class-title">${Lms.esc(Lms.localName(session.title, session.urduTitle, true))}</div>

                    <div style="margin-top: auto; padding-top: 12px; border-top: 1px solid var(--border-subtle);">
                        <div class="vc-meta-item">
                            <i class="fas fa-user-tie"></i>
                            <span><strong>Sheikh / Ustad:</strong> ${Lms.esc(session.hostTeacher)}</span>
                        </div>
                        <div class="vc-meta-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span><strong>Virtual Studio:</strong> ${Lms.esc(session.roomName || 'Studio 1')}</span>
                        </div>
                        <div class="vc-meta-item">
                            <i class="fas fa-clock"></i>
                            <span><strong>Time:</strong> ${Lms.esc(session.scheduledStart)} (${Lms.esc(session.durationMinutes)} mins)</span>
                        </div>
                        <div class="vc-meta-item">
                            <i class="fas fa-users"></i>
                            <span><strong>Attendance:</strong> ${I18n.t('{n} joined', { n: this.attendeeCount(session) })}</span>
                        </div>
                    </div>
                </div>

                <div class="vc-card-footer">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);">Passcode:</span>
                        <code class="vc-passcode-badge">
                            ${Lms.esc(session.passcode)}
                        </code>
                    </div>

                    <div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
                        ${isSessionHost ? `
                            <button class="btn btn-secondary btn-sm" title="Edit" onclick="VirtualClassModule.openScheduleModal('${Lms.esc(session.id)}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-secondary btn-sm" title="Delete" onclick="VirtualClassModule.deleteSession('${Lms.esc(session.id)}')"><i class="fas fa-trash" style="color: var(--danger);"></i></button>` : ''}
                        ${isLive ? (
                            !isSessionHost && isEnrolledClass && !window.AuthRBAC.can('virtual_classes.join') ? `
                                <span class="status-pill info"><i class="fas fa-lock"></i> Joining online classes is not part of your type</span>
                            ` : isEnrolledClass || isSessionHost ? `
                                <button class="btn btn-primary btn-sm" onclick="VirtualClassModule.enterClassroom('${Lms.esc(session.id)}')">
                                    <i class="fas fa-sign-in-alt"></i> ${isSessionHost ? 'Open Live Room' : 'Join Live Class'}
                                </button>
                                ${isSessionHost ? `<button class="btn btn-secondary btn-sm" title="End this session" onclick="VirtualClassModule.endSession('${Lms.esc(session.id)}')"><i class="fas fa-stop-circle" style="color: var(--danger);"></i></button>` : ''}
                            ` : `
                                <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.showRestrictedNotice('${Lms.esc(session.className)}')" title="Class restricted to enrolled scholars">
                                    <i class="fas fa-lock"></i> Restricted Section
                                </button>
                            `
                        ) : session.status === 'UPCOMING' ? (
                            isSessionHost ? `
                                <button class="btn btn-gold btn-sm" onclick="VirtualClassModule.startSessionEarly('${Lms.esc(session.id)}')">
                                    <i class="fas fa-play"></i> Start Lecture
                                </button>
                            ` : `
                                <span class="status-pill gold" style="font-size: 0.72rem;"><i class="fas fa-clock"></i> Starts ${Lms.esc(session.scheduledStart || '')}</span>
                            `
                        ) : `
                            <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.viewCompletedSession('${Lms.esc(session.id)}')">
                                <i class="fas fa-history"></i> Session Log
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    },

    setLobbyFilter(filter) {
        this.lobbyFilter = filter;
        const area = document.getElementById('vc-tab-content-area');
        if (area) area.innerHTML = this.renderLobby();
    },

    handleLobbySearch(query) {
        this.lobbySearch = query;
        const area = document.getElementById('vc-tab-content-area');
        if (area) area.innerHTML = this.renderLobby();
    },

    showRestrictedNotice(className) {
        window.App?.showToast(`Access Restricted: You are not enrolled in ${className}. Section access is protected at the API level.`, 'warning');
    },

    copySessionPasscode(passcode) {
        navigator.clipboard.writeText(passcode);
        window.App?.showToast(`Classroom passcode ${passcode} copied to clipboard! Reminder active.`, 'success');
    },

    // =========================================================================
    // 2. LIVE STUDIO ROOM (INTERACTIVE WEBRTC SUITE)
    // =========================================================================
    async enterClassroom(sessionId) {
        const session = (window.LmsData?.virtualClasses || []).find(s => s.id === sessionId);
        if (!session) {
            window.App?.showToast("Classroom session not found", "danger");
            return;
        }
        // The server decides again (/api/virtual-classes/.../join); this only avoids a pointless attempt
        if (!window.AuthRBAC.canAny(['virtual_classes.join', 'virtual_classes.host', 'virtual_classes.manage'])) {
            window.App?.showToast('Joining online classes is not part of your type.', 'warning');
            return;
        }

        const currentUser = window.AuthRBAC?.currentUser || {};
        // Recording retention & vault administration, and managing every class (not just one's own)
        const canRetention = window.AuthRBAC.can('settings.recordings');
        const canManageAll = window.AuthRBAC.can('virtual_classes.manage');
        const isTeacher = window.AuthRBAC?.isTeacher();
        const isStudent = window.AuthRBAC?.isStudent();

        // 1. Strict Backend Authorization Enforcement
        try {
            const verifyRes = await fetch('/api/virtual-class/verify-access', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: session.id,
                    classId: session.classId,
                    userId: currentUser.id,
                    role: currentUser.role,
                    userClassId: currentUser.classId
                })
            });

            const verdict = verifyRes.ok ? await verifyRes.clone().json().catch(() => ({})) : null;
            if (verdict && verdict.unverified && isStudent && currentUser.classId !== session.classId) {
                this.accessBlocked = true;
                this.accessBlockedReason = 'You are not enrolled in this class, so this live session is restricted.';
                this.activeSession = session;
                this.switchTab('studio');
                return;
            }
            if (!verifyRes.ok) {
                const errData = await verifyRes.json();
                this.accessBlocked = true;
                this.accessBlockedReason = errData.message || 'Access Denied: Scholar is not enrolled in this academic section.';
                this.activeSession = session;
                this.switchTab('studio');
                return;
            }
        } catch (e) {
            console.warn("Backend verification offline; applying local RBAC security policy", e);
            if (isStudent && currentUser.classId !== session.classId) {
                this.accessBlocked = true;
                this.accessBlockedReason = `Access Denied: Scholar is enrolled in ${currentUser.classId}, but attempted to access ${session.className}. Enforced at backend.`;
                this.activeSession = session;
                this.switchTab('studio');
                return;
            }
        }

        await this.loadMeetingConfig();

        // 2. Access Granted: Configure Active Session
        this.accessBlocked = false;
        this.activeSessionId = session.id;
        this.activeSession = session;
        this.isHost = this.canHost(session);
        if (session.status !== 'LIVE' && !session.isLive && !this.isHost) {
            window.App?.showToast('This class has not started yet.', 'info');
            return;
        }

        // 3. Auto-Log Attendance in System & Backend
        this.recordAutoAttendance(session, currentUser);

        // 4. Switch to Studio Tab
        this.switchTab('studio');
        window.App?.showToast(`Joined ${session.title}. Attendance recorded.`, "success");
    },

    recordAutoAttendance(session, currentUser) {
        const today = new Date().toISOString().split('T')[0];
        const attId = 'att_vc_' + Date.now();

        // Push to local data store
        if (window.LmsData?.attendance) {
            const alreadyLogged = window.LmsData.attendance.find(a =>
                a.userId === currentUser.id && a.session === 'VIRTUAL_CLASS' && (a.virtualSessionId === session.id || (!a.virtualSessionId && a.date === today && a.classId === session.classId))
            );
            if (!alreadyLogged) {
                window.LmsData.attendance.unshift({
                    id: attId,
                    userId: currentUser.id,
                    userName: currentUser.name,
                    role: currentUser.role,
                    identifier: currentUser.rollNo || currentUser.email || currentUser.id,
                    classId: session.classId,
                    className: session.className,
                    date: today,
                    checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    checkOutTime: null,
                    status: 'PRESENT',
                    session: 'VIRTUAL_CLASS',
                    virtualSessionId: session.id,
                    notes: `Joined online class: ${session.title}`
                });
                window.DataStore?.save(window.LmsData);
            }
        }
        // The attendance record reaches the server through the shared record store
    },

    renderStudio() {
        const session = this.activeSession;
        const currentUser = window.AuthRBAC?.currentUser || {};
        const isHost = this.isHost;

        if (!session) {
            return `<div class="card">${window.App.dashEmpty('Choose a live class from the Classrooms Lobby to join it.')}</div>`;
        }

        // If access was blocked by backend guard
        if (this.accessBlocked) {
            return `
                <div class="vc-access-denied">
                    <div class="vc-access-denied-icon"><i class="fas fa-shield-virus"></i></div>
                    <h2 style="color: #ef4444; margin-bottom: 8px;">Access Restricted</h2>
                    <p style="max-width: 600px; color: var(--text-muted); font-size: 0.95rem; margin-bottom: 24px; line-height: 1.6;">${Lms.esc(this.accessBlockedReason)}</p>
                    <div style="background: rgba(0,0,0,0.05); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 14px 20px; margin-bottom: 24px; text-align: start; font-size: 0.85rem;">
                        <div><strong>Session:</strong> ${Lms.esc(session.title)}</div>
                        <div><strong>For class:</strong> ${Lms.esc(session.className || Lms.className(session.classId))}</div>
                        <div><strong>Your class:</strong> ${Lms.esc(currentUser.classId ? Lms.className(currentUser.classId) : 'Not enrolled')}</div>
                    </div>
                    <button class="btn btn-primary" onclick="VirtualClassModule.switchTab('lobby')"><i class="fas fa-arrow-left"></i> Back to Lobby</button>
                </div>`;
        }

        const isExternal = session.platform === 'EXTERNAL' && session.externalUrl;
        return `
            <div class="card" style="padding: 14px 18px; margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            ${session.status === 'LIVE' ? '<span class="status-pill danger"><i class="fas fa-circle"></i> LIVE</span>' : `<span class="status-pill gold">${Lms.esc(session.status || '')}</span>`}
                            <strong style="font-size: 1.05rem; color: var(--primary-950);">${Lms.esc(session.title)}</strong>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
                            <i class="fas fa-user-tie"></i> ${Lms.esc(session.hostTeacher || '')} • ${Lms.esc(session.className || '')} • Passcode <code>${Lms.esc(session.passcode || '—')}</code>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.copyMeetingLink()"><i class="fas fa-link"></i> Copy Link</button>
                        ${isHost && session.status === 'LIVE' ? `<button class="btn btn-danger btn-sm" onclick="VirtualClassModule.endSession('${Lms.esc(session.id)}')"><i class="fas fa-stop-circle"></i> End Class for Everyone</button>` : ''}
                        <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.leaveClass()"><i class="fas fa-sign-out-alt"></i> Leave</button>
                    </div>
                </div>
            </div>
            ${!isExternal && !this.canEmbed() ? `
                <div class="card" style="text-align: center; padding: 40px 20px;">
                    <i class="fas fa-video" style="font-size: 2.4rem; color: var(--primary-600);"></i>
                    <h3 style="margin: 12px 0 6px;">The live classroom opens in a new tab</h3>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 6px;">Your attendance has been recorded. Keep this portal open in the other tab.</p>
                    <p style="color: var(--text-muted); font-size: 0.82rem; margin-bottom: 16px;">
                        ${isHost ? 'As the teacher, sign in when the meeting asks (Google / GitHub) to start the class as moderator. ' : 'If the teacher has not started yet, wait on the meeting page — it opens automatically. '}
                        ${session.passcode ? `Passcode if asked: <code>${Lms.esc(session.passcode)}</code>` : ''}
                    </p>
                    <button class="btn btn-primary" onclick="VirtualClassModule.openMeetingTab()"><i class="fas fa-external-link-alt"></i> Open Live Classroom</button>
                </div>` : ''}
            ${isExternal ? `
                <div class="card" style="text-align: center; padding: 40px 20px;">
                    <i class="fas fa-external-link-alt" style="font-size: 2.4rem; color: var(--primary-600);"></i>
                    <h3 style="margin: 12px 0 6px;">This class runs on ${Lms.esc(this.platformName(session.externalUrl))}</h3>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 16px;">${session.passcode
                        ? I18n.t('Your attendance has been recorded. Open the meeting in a new tab and use passcode {code} if asked.', { code: `<code>${Lms.esc(session.passcode)}</code>` })
                        : I18n.t('Your attendance has been recorded. Open the meeting in a new tab.')}</p>
                    <a class="btn btn-primary" href="${Lms.esc(session.externalUrl)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-video"></i> Open Meeting</a>
                </div>` : !this.canEmbed() ? '' : `
                <div id="jitsi-container" style="width: 100%; height: 72vh; min-height: 460px; background: #0b1114; border-radius: var(--radius-md); overflow: hidden; display: flex; align-items: center; justify-content: center; color: #cbd5e1;">
                    <div style="text-align: center;"><i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i><div style="margin-top: 10px;">Connecting to the live classroom...</div></div>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px;">
                    Video, audio, screen sharing, chat, raise-hand and the whiteboard are inside the meeting toolbar. Allow camera and microphone access when the browser asks.
                </div>`}
        `;
    },

    platformName(url) {
        const u = String(url || '').toLowerCase();
        if (u.includes('zoom.')) return 'Zoom';
        if (u.includes('meet.google.')) return 'Google Meet';
        if (u.includes('teams.')) return 'Microsoft Teams';
        return 'an external meeting service';
    },

    // =========================================================================
    // 3. RECORDINGS VAULT VIEW
    // =========================================================================
    renderRecordings() {
        const currentUser = window.AuthRBAC?.currentUser || {};
        // Recording retention & vault administration, and managing every class (not just one's own)
        const canRetention = window.AuthRBAC.can('settings.recordings');
        const canManageAll = window.AuthRBAC.can('virtual_classes.manage');
        const isTeacher = window.AuthRBAC?.isTeacher();
        const isStudent = window.AuthRBAC?.isStudent();

        const allRecordings = window.LmsData?.virtualClassRecordings || [];
        const studentClass = currentUser.classId || '';
        const settings = this.recordingSettings;

        // Class and text filtering
        let filtered = allRecordings.filter(rec => {
            // Students can only see their enrolled class recordings!
            if (isStudent && rec.classId !== studentClass) return false;

            if (this.recordingFilterClass !== 'ALL' && rec.classId !== this.recordingFilterClass) return false;

            if (this.recordingSearch) {
                const q = this.recordingSearch.toLowerCase();
                const matchTitle = rec.title?.toLowerCase().includes(q);
                const matchTeacher = rec.teacherName?.toLowerCase().includes(q);
                const matchCourse = rec.courseName?.toLowerCase().includes(q);
                if (!matchTitle && !matchTeacher && !matchCourse) return false;
            }
            return true;
        });

        // Compute total vault storage
        const totalBytes = allRecordings.reduce((sum, r) => sum + (r.fileSizeBytes || 0), 0);
        const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);

        return `
            <!-- VAULT OVERVIEW HEADER -->
            <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: var(--radius-lg, 12px); padding: 20px 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; box-shadow: var(--shadow-sm);">
                <div>
                    <h3 style="color: var(--primary-950); font-weight: 800; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-video-slash" style="color: var(--gold-600);"></i>
                        Sacred Lectures Archive & Cloud Recordings Vault
                    </h3>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0;">
                        ${settings.retentionDays ? I18n.t('Recordings are kept for {days} days, then removed by the retention clean-up.', { days: settings.retentionDays }) : 'Recordings are kept permanently.'}
                    </p>
                </div>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <span class="status-pill gold">
                        <i class="fas fa-database"></i> ${totalGB} GB Archived
                    </span>
                    <span class="status-pill neutral">
                        <i class="fas fa-history"></i> ${settings.retentionDays ? I18n.t('{n} Days Retention', { n: settings.retentionDays }) : 'Kept permanently'}
                    </span>
                </div>
            </div>

            <!-- SEARCH & CLASS FILTER BAR -->
            <div class="vc-filter-toolbar">
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <div style="position: relative;">
                        <input type="text" placeholder="Search lectures, teachers, topics..." value="${this.recordingSearch}" 
                               oninput="VirtualClassModule.handleRecordingSearch(this.value)"
                               class="form-control"
                               style="background: #ffffff; border: 1px solid var(--border-prominent); padding-block: 7px; padding-inline: 32px 12px; border-radius: 6px; color: var(--text-primary); font-size: 0.85rem; width: 280px;">
                        <i class="fas fa-search" style="position: absolute; inset-inline-start: 10px; top: 10px; color: var(--text-muted); font-size: 0.8rem;"></i>
                    </div>

                    ${!isStudent ? `
                        <select onchange="VirtualClassModule.handleRecordingClassFilter(this.value)"
                                class="form-control"
                                style="background: #ffffff; border: 1px solid var(--border-prominent); padding: 7px 12px; border-radius: 6px; color: var(--text-primary); font-size: 0.85rem;">
                            ${this.classFilterOptions(this.recordingFilterClass)}
                        </select>
                    ` : ''}
                </div>

                <div style="font-size: 0.85rem; color: var(--text-muted);">
                    ${I18n.t('Showing {n} recorded lecture(s)', { n: `<strong>${filtered.length}</strong>` })}
                </div>
            </div>

            <!-- RECORDINGS LIST / CARDS -->
            <div style="display: flex; flex-direction: column; gap: 14px;">
                ${filtered.length === 0 ? `
                    <div style="text-align: center; padding: 50px 20px; background: var(--bg-surface); border-radius: 8px; color: var(--text-muted);">
                        <i class="fas fa-film" style="font-size: 2.5rem; margin-bottom: 12px; opacity: 0.5;"></i>
                        <h4>No Cloud Recordings Found</h4>
                        <p>No recorded sessions match the selected class or search filter.</p>
                    </div>
                ` : filtered.map(rec => `
                    <div class="vc-vault-card">
                        <div style="display: flex; align-items: center; gap: 16px; flex: 1;">
                            <div style="width: 50px; height: 50px; border-radius: 8px; background: rgba(16, 185, 129, 0.15); color: var(--primary-400); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">
                                <i class="fas fa-play-circle"></i>
                            </div>
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                                    <h4 style="color: var(--primary-950); margin: 0; font-size: 1.05rem; font-weight: 700;">${Lms.esc(Lms.localName(rec.title, rec.urduTitle, true))}</h4>
                                    <span class="status-pill neutral" style="font-size: 0.72rem;">${Lms.esc(rec.className)}</span>
                                    ${(() => {
                                        const left = this.daysRemaining(rec);
                                        return left === null
                                            ? `<span class="vc-retention-pill"><i class="fas fa-lock"></i> Kept permanently</span>`
                                            : `<span class="vc-retention-pill ${left < 15 ? 'warning' : ''}"><i class="fas fa-hourglass-half"></i> ${I18n.t('{n} days remaining in vault', { n: left })}</span>`;
                                    })()}
                                </div>
                                <div style="display: flex; gap: 16px; font-size: 0.78rem; color: var(--text-muted); flex-wrap: wrap;">
                                    <span><i class="fas fa-user-tie" style="color: var(--primary-400);"></i> ${Lms.esc(rec.teacherName)}</span>
                                    <span><i class="fas fa-calendar" style="color: var(--primary-400);"></i> ${Lms.fmtDate(rec.recordedDate)}${rec.recordedTime ? ' ' + Lms.esc(rec.recordedTime) : ''}</span>
                                    <span><i class="fas fa-clock" style="color: var(--primary-400);"></i> Duration: ${Lms.esc(rec.durationFormatted)}</span>
                                    ${rec.fileSizeBytes ? `<span><i class="fas fa-file-video" style="color: var(--primary-400);"></i> ${Lms.esc(Lms.fileSize(rec.fileSizeBytes))}</span>` : rec.externalUrl ? `<span><i class="fas fa-link" style="color: var(--primary-400);"></i> External link</span>` : ''}
                                    <span><i class="fas fa-eye" style="color: var(--primary-400);"></i> ${Lms.esc(rec.viewsCount || 0)} views</span>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                            <button class="btn btn-primary btn-sm" onclick="VirtualClassModule.openVideoPlayer('${Lms.esc(rec.id)}')">
                                <i class="fas fa-play"></i> Watch Lecture
                            </button>
                            ${(window.AuthRBAC.can('recordings.download') || settings.allowStudentDownload) && rec.videoUrl ? `
                                <a href="${Lms.esc(rec.videoUrl)}" target="_blank" download class="btn btn-secondary btn-sm" title="Download Lecture">
                                    <i class="fas fa-download"></i> Download
                                </a>
                            ` : ''}
                            ${window.AuthRBAC.can('recordings.manage') ? `
                                <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.toggleKeepRecording('${Lms.esc(rec.id)}')" title="${rec.autoDeleteProtected ? 'Allow the retention clean-up to remove it' : 'Keep permanently (never removed by the clean-up)'}">
                                    <i class="fas ${rec.autoDeleteProtected ? 'fa-lock' : 'fa-lock-open'}" style="color: var(--gold-600);"></i>
                                </button>` : ''}
                            ${window.AuthRBAC.can('recordings.manage') ? `
                                <button class="btn btn-secondary btn-sm" style="color: #f87171;" onclick="VirtualClassModule.deleteRecording('${Lms.esc(rec.id)}')" title="Delete recording immediately">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    handleRecordingSearch(q) {
        this.recordingSearch = q;
        const area = document.getElementById('vc-tab-content-area');
        if (area) area.innerHTML = this.renderRecordings();
    },

    handleRecordingClassFilter(cls) {
        this.recordingFilterClass = cls;
        const area = document.getElementById('vc-tab-content-area');
        if (area) area.innerHTML = this.renderRecordings();
    },

    // =========================================================================
    // 4. ATTENDANCE & SESSION REPORTS VIEW
    // =========================================================================
    renderAttendance() {
        const currentUser = window.AuthRBAC?.currentUser || {};
        // Recording retention & vault administration, and managing every class (not just one's own)
        const canRetention = window.AuthRBAC.can('settings.recordings');
        const canManageAll = window.AuthRBAC.can('virtual_classes.manage');
        const isTeacher = window.AuthRBAC?.isTeacher();
        const isStudent = window.AuthRBAC?.isStudent();

        const allAttendance = window.LmsData?.attendance || [];
        // Check-ins recorded on entering an online class
        let virtualAtt = allAttendance.filter(a => a.session === 'VIRTUAL_CLASS');

        if (isStudent) {
            virtualAtt = virtualAtt.filter(a => a.userId === currentUser.id);
        } else if (this.attendanceFilterClass !== 'ALL') {
            virtualAtt = virtualAtt.filter(a => a.classId === this.attendanceFilterClass);
        }

        return `
            <!-- ATTENDANCE OVERVIEW HEADER -->
            <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: var(--radius-lg, 12px); padding: 20px 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; box-shadow: var(--shadow-sm);">
                <div>
                    <h3 style="color: var(--primary-950); font-weight: 800; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-clipboard-user" style="color: var(--primary-600);"></i>
                        Virtual Classroom Attendance Registry
                    </h3>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0;">
                        Real-time digital check-in records automatically registered upon entering Jamia Ashrafia virtual rooms.
                    </p>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.exportAttendanceCSV()">
                        <i class="fas fa-file-csv"></i> Export CSV
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window.print()">
                        <i class="fas fa-print"></i> Print Report
                    </button>
                </div>
            </div>

            <!-- FILTER BAR -->
            ${!isStudent ? `
                <div class="vc-filter-toolbar">
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">Filter by Class:</span>
                        <select onchange="VirtualClassModule.handleAttendanceClassFilter(this.value)"
                                class="form-control"
                                style="background: #ffffff; border: 1px solid var(--border-prominent); padding: 7px 12px; border-radius: 6px; color: var(--text-primary); font-size: 0.85rem;">
                            ${this.classFilterOptions(this.attendanceFilterClass)}
                        </select>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">
                        Total <strong>${virtualAtt.length}</strong> logged check-in entries
                    </div>
                </div>
            ` : ''}

            <!-- ATTENDANCE TABLE -->
            <div class="card" style="padding: 0; overflow: hidden;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Scholar / Teacher</th>
                            <th>Role & Identifier</th>
                            <th>Classroom Section</th>
                            <th>Date</th>
                            <th>Check-In Time</th>
                            <th>Status</th>
                            <th>Platform & Verification</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${virtualAtt.length === 0 ? `
                            <tr>
                                <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
                                    <i class="fas fa-calendar-times" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.5;"></i>
                                    <div>No virtual attendance records logged for this selection.</div>
                                </td>
                            </tr>
                        ` : virtualAtt.map(att => `
                            <tr>
                                <td>
                                    <div style="font-weight: 700; color: var(--text-primary);">${Lms.esc(att.userName)}</div>
                                </td>
                                <td>
                                    <span class="status-pill ${att.role === 'TEACHER' ? 'gold' : 'neutral'}" style="font-size: 0.72rem;">
                                        ${Lms.esc(att.role)}
                                    </span>
                                    <span style="font-size: 0.75rem; color: var(--text-muted); margin-inline-start: 4px;">
                                        ${Lms.esc(att.identifier || '')}
                                    </span>
                                </td>
                                <td>
                                    <span style="font-weight: 600; color: var(--text-primary);">${Lms.esc(att.className || att.classId)}</span>
                                </td>
                                <td>${Lms.esc(att.date)}</td>
                                <td>
                                    <span style="font-family: monospace; font-weight: 700; color: var(--gold-800);">
                                        <i class="fas fa-clock" style="font-size: 0.72rem;"></i> ${Lms.esc(att.checkInTime || '—')}
                                    </span>
                                </td>
                                <td>
                                    <span class="status-pill ${att.status === 'PRESENT' ? 'success' : 'danger'}">
                                        <i class="fas ${att.status === 'PRESENT' ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                                        ${Lms.esc(att.status)}
                                    </span>
                                </td>
                                <td>
                                    <span style="font-size: 0.8rem; font-weight: 600; color: var(--primary-700);">
                                        <i class="fas fa-video" style="color: var(--primary-600); margin-inline-end: 4px;"></i> ${Lms.esc(this.platformOf(att.virtualSessionId))}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    handleAttendanceClassFilter(cls) {
        this.attendanceFilterClass = cls;
        const area = document.getElementById('vc-tab-content-area');
        if (area) area.innerHTML = this.renderAttendance();
    },

    exportAttendanceCSV() {
        const allAttendance = window.LmsData?.attendance || [];
        const virtualAtt = allAttendance.filter(a => a.session === 'VIRTUAL_CLASS'
            && (this.attendanceFilterClass === 'ALL' || a.classId === this.attendanceFilterClass));
        const cell = v => `"${String(v === undefined || v === null ? '' : v).replace(/"/g, '""')}"`;

        let csv = 'Scholar Name,Role,Identifier,Class,Date,Check-In Time,Status,Platform\n';
        virtualAtt.forEach(a => {
            csv += [a.userName, a.role, a.identifier, a.className || a.classId, a.date, a.checkInTime, a.status, this.platformOf(a.virtualSessionId)].map(cell).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Jamia_Ashrafia_Virtual_Attendance_${Date.now()}.csv`;
        link.click();
        window.App?.showToast("Attendance CSV report exported successfully", "success");
    },

    // =========================================================================
    // 5. STORAGE & CONFIGURABLE RECORDING RETENTION (SUPER ADMIN ONLY)
    // =========================================================================
    renderRetention() {
        if (!window.AuthRBAC.can('settings.recordings')) {
            return `
                <div class="vc-access-denied">
                    <div class="vc-access-denied-icon"><i class="fas fa-lock"></i></div>
                    <h2>Super Admin Authority Required</h2>
                    <p>Only the Mohtamim (Super Admin) may configure cloud retention policies and storage cleanup.</p>
                </div>
            `;
        }

        const settings = this.recordingSettings;
        const used = this.usedStorageGB();
        const quota = Number(settings.storageQuotaGB) || 0;
        const pctUsed = quota ? Math.min(100, Math.round((used / quota) * 1000) / 10) : 0;
        const days = Number(settings.retentionDays) || 0;

        return `
            <!-- STORAGE GAUGE BOX -->
            <div class="vc-storage-box">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 12px; flex-wrap: wrap;">
                    <div>
                        <h3 style="color: var(--primary-950); font-weight: 800; margin-bottom: 2px;">
                            <i class="fas fa-server" style="color: var(--primary-600);"></i>
                            Recording Storage
                        </h3>
                        <div style="font-size: 0.82rem; color: var(--text-secondary);">
                            ${I18n.t('{n} recordings. Uploaded videos are stored on the portal server; linked recordings (YouTube, Drive) use no space here.', { n: settings.recordingCount || 0 })}
                        </div>
                    </div>
                    <div style="text-align: end;">
                        <div style="font-size: 1.45rem; font-weight: 800; color: var(--primary-950);">${used} GB / ${quota} GB</div>
                        <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary-700);">${I18n.t('{n}% Utilized', { n: pctUsed })}</div>
                    </div>
                </div>

                <div class="vc-progress-track">
                    <div class="vc-progress-fill" style="width: ${pctUsed}%;"></div>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted); margin-top: 6px;">
                    <span>0 GB</span>
                    <span>${settings.lastCleanupDate ? I18n.t('Last clean-up: {date}', { date: Lms.fmtDate(settings.lastCleanupDate) }) : 'No clean-up has run yet'}</span>
                    <span>${quota} GB</span>
                </div>
            </div>

            <!-- RETENTION POLICY CONFIGURATION -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 24px; margin-bottom: 24px;">
                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-shield-alt" style="color: var(--gold-600);"></i> Retention Policy</h3>
                    </div>
                    <div class="card-body">
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label for="retention-days-select" style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-primary);">Keep recordings for</label>
                            <select id="retention-days-select" class="form-control" style="width: 100%;">
                                ${[[30, '30 days'], [60, '60 days'], [90, '90 days (one quarter)'], [180, '180 days (one term)'], [365, '365 days (one academic year)'], [0, 'Permanently']]
                                    .map(([v, l]) => `<option value="${v}" ${days === v ? 'selected' : ''}>${l}</option>`).join('')}
                            </select>
                            <small style="color: var(--text-muted); display: block; margin-top: 4px;">
                                The clean-up removes recordings older than this. Recordings marked "Keep permanently" are never removed.
                            </small>
                        </div>

                        <div class="form-group" style="margin-bottom: 16px;">
                            <label for="retention-quota" style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-primary);">Storage quota (GB)</label>
                            <input type="number" id="retention-quota" class="form-control" min="1" value="${Lms.esc(quota || 50)}">
                        </div>

                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="retention-allow-download" ${settings.allowStudentDownload ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--primary-500);">
                                <span style="font-weight: 600;">Allow students to download uploaded recordings</span>
                            </label>
                            <small style="color: var(--text-muted); display: block; margin-inline-start: 28px;">
                                When off, students watch in the browser; staff with the download permission can still download.
                            </small>
                        </div>

                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="retention-auto-cleanup" ${settings.autoCleanupEnabled ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--primary-500);">
                                <span style="font-weight: 600;">Run the clean-up automatically every day</span>
                            </label>
                        </div>

                        <button class="btn btn-primary" onclick="VirtualClassModule.saveRetentionSettings(this)">
                            <i class="fas fa-save"></i> Save Retention Policy
                        </button>
                    </div>
                </div>

                <!-- LIVE CLASSROOM SERVICE -->
                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-video" style="color: var(--primary-600);"></i> Live Classroom Service</h3>
                    </div>
                    <div class="card-body">
                        <p style="color: var(--text-muted); font-size: 0.85rem; line-height: 1.6; margin-bottom: 14px;">
                            ${I18n.t('The free public {service} service ends embedded calls after 5 minutes, so classes on it open in a new tab (no time limit). If you run your own Jitsi server or an 8x8 JaaS account, enter its domain and tick "embed" to show classes inside the portal.', { service: '<strong>meet.jit.si</strong>' })}
                        </p>
                        <div class="form-group" style="margin-bottom: 12px;">
                            <label>Jitsi server domain</label>
                            <input type="text" id="meeting-domain" class="form-control" value="${Lms.esc(this.meetingDomain())}" placeholder="meet.jit.si">
                        </div>
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin-bottom: 16px;">
                            <input type="checkbox" id="meeting-embed" ${this.canEmbed() ? 'checked' : ''} style="width: 18px; height: 18px;">
                            <span>Embed the classroom inside the portal (own Jitsi server / JaaS only)</span>
                        </label>
                        <button class="btn btn-primary" onclick="VirtualClassModule.saveMeetingConfig()"><i class="fas fa-save"></i> Save Classroom Service</button>
                    </div>
                </div>

                <!-- IMMEDIATE CLEANUP ACTION -->
                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-broom" style="color: #ef4444;"></i> Run Clean-up Now</h3>
                    </div>
                    <div class="card-body">
                        <p style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.6; margin-bottom: 16px;">
                            ${days
                                ? I18n.t('Removes recordings older than {days} days now, including their uploaded video files. This cannot be undone.', { days: `<strong>${days}</strong>` })
                                : 'Recordings are kept permanently, so the clean-up removes nothing. Choose a retention period first.'}
                        </p>
                        <button class="btn btn-danger" ${days ? '' : 'disabled'} onclick="VirtualClassModule.triggerStorageCleanup(this)">
                            <i class="fas fa-trash-alt"></i> Run Clean-up Now
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    async saveRetentionSettings(btn) {
        await Lms.busy(btn, async () => {
            const data = await Lms.api('POST', '/api/settings/recordings', {
                retentionDays: Number(Lms.val('retention-days-select')),
                storageQuotaGB: Number(Lms.val('retention-quota')),
                allowStudentDownload: document.getElementById('retention-allow-download').checked,
                autoCleanupEnabled: document.getElementById('retention-auto-cleanup').checked
            });
            this.recordingSettings = data.settings;
            window.App?.showToast('Recording retention policy saved', 'success');
            this.switchTab('retention');
        });
    },

    async triggerStorageCleanup(btn) {
        if (!confirm("Run the clean-up now? Recordings older than the retention period will be permanently deleted.")) return;
        await Lms.busy(btn, async () => {
            const data = await Lms.api('POST', '/api/virtual-class/cleanup');
            this.recordingSettings = data.settings;
            window.App?.showToast(I18n.t('Clean-up finished: {n} expired recording(s) removed.', { n: data.purgedCount }), 'success');
            await window.DataStore.syncNow();
            this.switchTab('retention');
        }, 'Cleaning...');
    },

    // =========================================================================
    // 6. SCHEDULE CLASSROOM MODAL
    // =========================================================================
    // New class (no id) or change a scheduled one (id)
    openScheduleModal(sessionId) {
        const existing = sessionId ? (window.LmsData.virtualClasses || []).find(s => s.id === sessionId) : null;
        if (existing && !this.canHost(existing)) return;
        const classIds = window.AuthRBAC.can('virtual_classes.manage') ? (window.LmsData.classes || []).map(c => c.id) : Lms.myClassIds();
        if (existing && existing.classId && !classIds.includes(existing.classId) && Lms.getClass(existing.classId)) classIds.push(existing.classId);
        if (!classIds.length) {
            window.App?.showToast(window.AuthRBAC.can('virtual_classes.manage') ? 'Create a class in Classes & Courses first.' : 'No classes are allocated to you yet.', 'warning');
            return;
        }
        const pad = n => String(n).padStart(2, '0');
        const toLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        const startDate = existing && existing.startsAt && !Number.isNaN(Date.parse(existing.startsAt)) ? new Date(existing.startsAt) : null;
        const local = startDate ? toLocal(startDate) : (() => { const d = new Date(Date.now() + 60 * 60000); d.setMinutes(0); return toLocal(d); })();
        const d = existing || {};
        const isExternal = d.platform === 'EXTERNAL';
        Lms.openModal(
            `<i class="fas fa-video" style="color: var(--primary-500);"></i> ${existing ? 'Edit Online Class' : 'Schedule / Start Online Class'}`,
            `<div class="form-grid">
                <div class="form-group"><label>Lecture Topic *</label><input type="text" id="sch-title" class="form-control" value="${Lms.esc(d.title || '')}" placeholder="e.g. Sahih al-Bukhari - Kitab al-Ilm"></div>
                <div class="form-group"><label>Urdu Title</label><input type="text" id="sch-urdu-title" class="form-control" dir="rtl" value="${Lms.esc(d.urduTitle || '')}"></div>
                <div class="form-group"><label>Class *</label>
                    <select id="sch-class-id" class="form-control" onchange="VirtualClassModule.refreshScheduleCourses()">${Lms.classOptions(d.classId && classIds.includes(d.classId) ? d.classId : classIds[0], classIds)}</select>
                </div>
                <div class="form-group"><label>Kitab / Course *</label><select id="sch-course-id" class="form-control"></select></div>
                ${window.AuthRBAC.can('virtual_classes.manage') ? `<div class="form-group"><label>Teacher (host)</label>
                    <select id="sch-host-id" class="form-control">${this.hostOptions(d.hostId)}</select></div>` : ''}
                <div class="form-group"><label>Date & Time *</label><input type="datetime-local" id="sch-datetime" class="form-control" value="${local}"></div>
                <div class="form-group"><label>Duration (minutes) *</label><input type="number" id="sch-duration" min="10" max="240" class="form-control" value="${Lms.esc(d.durationMinutes || 60)}"></div>
                <div class="form-group"><label>Meeting Platform *</label>
                    <select id="sch-platform" class="form-control" onchange="document.getElementById('sch-external-wrap').style.display = this.value === 'EXTERNAL' ? '' : 'none'">
                        <option value="BUILTIN" ${isExternal ? '' : 'selected'}>Built-in live classroom (video, screen share, chat)</option>
                        <option value="EXTERNAL" ${isExternal ? 'selected' : ''}>Zoom / Google Meet / Teams link</option>
                    </select>
                </div>
                <div class="form-group"><label>Passcode</label><input type="text" id="sch-passcode" class="form-control" value="${Lms.esc(existing ? (d.passcode || '') : `ASH${Math.floor(100000 + Math.random() * 900000)}`)}" style="font-family: monospace;"></div>
                <div class="form-group" id="sch-external-wrap" style="${isExternal ? '' : 'display: none;'}"><label>Meeting Link *</label><input type="url" id="sch-external" class="form-control" value="${Lms.esc(d.externalUrl || '')}" placeholder="https://zoom.us/j/..."></div>
            </div>
            ${existing ? '' : `<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="sch-is-live" style="width: 16px; height: 16px;">
                <span><strong>Start now</strong> — open the room immediately and notify students</span>
            </label>`}`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-primary" onclick="VirtualClassModule.saveScheduleModal('${existing ? Lms.esc(existing.id) : ''}')"><i class="fas fa-check-circle"></i> Save</button>`
        );
        this.refreshScheduleCourses(d.courseId);
    },

    // Active teachers, plus the current host if they are no longer listed
    hostOptions(selectedId) {
        const me = window.AuthRBAC?.currentUser || {};
        const list = Lms.teachers().slice();
        const current = selectedId && !list.some(t => t.id === selectedId) ? Lms.user(selectedId) : null;
        if (current) list.unshift(current);
        return `<option value="${Lms.esc(me.id)}" ${!selectedId || selectedId === me.id ? 'selected' : ''}>${Lms.esc(me.name)} (me)</option>`
            + list.filter(t => t.id !== me.id).map(t => `<option value="${Lms.esc(t.id)}" ${t.id === selectedId ? 'selected' : ''}>${Lms.esc(t.name)}</option>`).join('');
    },

    refreshScheduleCourses(selectedCourseId) {
        const classId = Lms.val('sch-class-id');
        const me = window.AuthRBAC?.currentUser || {};
        let ids = Lms.classCourseIds(classId);
        if (Lms.portal() === 'teacher') {
            const mine = Lms.teacherCourseIds(me.id, classId);
            const cls = Lms.getClass(classId);
            if (!(cls && cls.teacherId === me.id) && mine.length) ids = mine;
        }
        if (!ids.length) ids = (window.LmsData.courses || []).map(c => c.id);
        document.getElementById('sch-course-id').innerHTML = Lms.courseOptions(selectedCourseId, ids)
            || '<option value="">No courses yet</option>';
    },

    closeScheduleModal() {
        window.App.closeModal();
    },

    saveScheduleModal(sessionId) {
        const existing = sessionId ? (window.LmsData.virtualClasses || []).find(s => s.id === sessionId) : null;
        const title = Lms.val('sch-title');
        const when = Lms.val('sch-datetime');
        const durationMinutes = parseInt(Lms.val('sch-duration'), 10) || 0;
        const platform = Lms.val('sch-platform');
        const externalUrl = Lms.val('sch-external');
        const liveBox = document.getElementById('sch-is-live');
        const isLive = !!(liveBox && liveBox.checked);
        if (!title || !when || durationMinutes < 10) {
            window.App.showToast('Topic, date/time and a duration of at least 10 minutes are required', 'warning');
            return;
        }
        if (platform === 'EXTERNAL' && !/^https:\/\//i.test(externalUrl)) {
            window.App.showToast('Paste the full https:// meeting link', 'warning');
            return;
        }
        const currentUser = window.AuthRBAC?.currentUser || {};
        const classId = Lms.val('sch-class-id');
        const cls = Lms.getClass(classId) || { name: 'Class' };
        const hostId = Lms.val('sch-host-id') || (existing ? existing.hostId : currentUser.id);
        const host = Lms.user(hostId) || currentUser;
        const startsAt = new Date(when);
        const fields = {
            title,
            urduTitle: Lms.val('sch-urdu-title'),
            hostTeacher: host.name,
            hostId,
            classId,
            className: `${cls.name}${cls.section ? ' - ' + cls.section : ''}`,
            courseId: Lms.val('sch-course-id') || null,
            courseName: Lms.courseTitle(Lms.val('sch-course-id')),
            roomName: platform === 'EXTERNAL' ? this.platformName(externalUrl) : 'Built-in live classroom',
            platform,
            externalUrl: platform === 'EXTERNAL' ? externalUrl : null,
            startsAt: startsAt.toISOString(),
            scheduledStart: startsAt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            durationMinutes,
            passcode: Lms.val('sch-passcode')
        };
        window.LmsData.virtualClasses = window.LmsData.virtualClasses || [];
        if (existing) {
            Object.assign(existing, fields, { updatedAt: new Date().toISOString() });
            window.DataStore.save(window.LmsData);
            if (existing.status === 'UPCOMING') {
                Lms.notifyClass(classId, `Online class updated: ${title}`, `${fields.scheduledStart} • ${durationMinutes} min with ${host.name}.`, 'LIVE_CLASS', 'virtual-class');
            }
            window.App.closeModal();
            window.App.showToast('Online class updated', 'success');
            this.switchTab('lobby');
            return;
        }
        const rand = () => Math.floor(100 + Math.random() * 900);
        const session = {
            id: Lms.uid('vc'),
            meetingUuid: `ASH-${rand()}-${rand()}-${rand()}`,
            ...fields,
            createdBy: currentUser.id,
            status: isLive ? 'LIVE' : 'UPCOMING',
            isLive,
            startedAt: isLive ? new Date().toISOString() : null,
            activeParticipants: 0,
            attendanceCount: 0
        };
        window.LmsData.virtualClasses.unshift(session);
        window.DataStore.save(window.LmsData);
        Lms.notifyClass(classId,
            isLive ? `Live class started: ${title}` : `Online class scheduled: ${title}`,
            isLive ? `${host.name} is live now. Open Online Classes to join.` : `${session.scheduledStart} • ${durationMinutes} min with ${host.name}.`,
            'LIVE_CLASS', 'virtual-class');
        window.App.closeModal();
        window.App?.showToast(isLive ? 'Class started — students have been notified' : 'Online class scheduled and students notified', 'success');
        if (isLive) {
            if (window.App.currentRoute !== 'virtual-class') window.App.navigate('virtual-class');
            this.enterClassroom(session.id);
        } else {
            this.switchTab('lobby');
        }
    },

    // Removes an online class from the lobby; its attendance records and recording stay
    async deleteSession(sessionId) {
        const session = (window.LmsData.virtualClasses || []).find(s => s.id === sessionId);
        if (!session || !this.canHost(session)) return;
        if (!confirm(I18n.t('Delete the online class "{title}"? Attendance already recorded for it is kept.', { title: session.title }))) return;
        const wasUpcoming = session.status === 'UPCOMING';
        window.LmsData.virtualClasses = window.LmsData.virtualClasses.filter(s => s.id !== sessionId);
        if (this.activeSession && this.activeSession.id === sessionId) this.activeSession = null;
        window.DataStore.save(window.LmsData);
        await window.DataStore.syncNow();
        if ((window.LmsData.virtualClasses || []).some(s => s.id === sessionId)) return; // refused by the server (message shown)
        if (wasUpcoming) {
            Lms.notifyClass(session.classId, `Online class cancelled: ${session.title}`, `The class scheduled for ${session.scheduledStart || ''} will not take place.`, 'LIVE_CLASS', 'virtual-class');
        }
        window.App?.showToast('Online class deleted', 'success');
        this.switchTab('lobby');
    },

    // =========================================================================
    // 7. VIDEO PLAYER MODAL (RECORDINGS PLAYBACK)
    // =========================================================================
    openVideoPlayer(recId) {
        const recording = (window.LmsData?.virtualClassRecordings || []).find(r => r.id === recId);
        if (!recording) return;
        if (!recording.videoUrl && recording.externalUrl) {
            window.open(recording.externalUrl, '_blank', 'noopener');
            return;
        }
        if (!recording.videoUrl) {
            window.App?.showToast('The video file for this recording has not been uploaded yet.', 'info');
            return;
        }

        recording.viewsCount = (recording.viewsCount || 0) + 1;
        window.DataStore?.save(window.LmsData);

        const modalHtml = `
            <div class="modal-backdrop" id="video-player-modal" style="display: flex;">
                <div class="modal" style="max-width: 900px; background: #0b1114;">
                    <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
                        <div class="modal-title-group">
                            <h3 style="color: #ffffff; margin: 0; font-size: 1.1rem;">
                                <i class="fas fa-play-circle" style="color: var(--primary-500);"></i> ${Lms.esc(Lms.localName(recording.title, recording.urduTitle, true))}
                            </h3>
                        </div>
                        <button class="modal-close-btn" onclick="VirtualClassModule.closeVideoPlayer()">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 0; background: #000;">
                        <video controls autoplay style="width: 100%; max-height: 480px; display: block; outline: none;">
                            <source src="${Lms.esc(recording.videoUrl)}">
                            Your browser does not support HTML5 video streaming.
                        </video>
                        <div style="padding: 16px 20px; background: var(--bg-surface-elevated, #162026); border-top: 1px solid rgba(255,255,255,0.08);">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                                <div>
                                    <div style="font-weight: 600; color: #ffffff; font-size: 0.95rem;">${Lms.esc(recording.teacherName)}</div>
                                    <div style="font-size: 0.8rem; color: var(--text-muted);">${Lms.esc(recording.className)} &bull; Recorded on ${Lms.esc(recording.recordedDate)}</div>
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    ${recording.durationFormatted ? `<span class="status-pill gold"><i class="fas fa-clock"></i> ${Lms.esc(recording.durationFormatted)}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existing = document.getElementById('video-player-modal');
        if (existing) existing.remove();

        const wrap = document.createElement('div');
        wrap.innerHTML = modalHtml;
        document.body.appendChild(wrap.firstElementChild);
    },

    closeVideoPlayer() {
        const modal = document.getElementById('video-player-modal');
        if (modal) {
            const video = modal.querySelector('video');
            if (video) video.pause();
            modal.remove();
        }
    },

    // "Keep permanently": the retention clean-up never removes this recording
    toggleKeepRecording(recId) {
        const rec = (window.LmsData.virtualClassRecordings || []).find(r => r.id === recId);
        if (!rec) return;
        rec.autoDeleteProtected = !rec.autoDeleteProtected;
        window.DataStore?.save(window.LmsData);
        window.App?.showToast(rec.autoDeleteProtected ? 'Recording will be kept permanently' : 'Recording follows the retention policy again', 'success');
        this.switchTab('recordings');
    },

    deleteRecording(recId) {
        if (!confirm("Are you sure you want to delete this recorded lecture from cloud storage?")) return;

        window.LmsData.virtualClassRecordings = (window.LmsData.virtualClassRecordings || []).filter(r => r.id !== recId);
        window.DataStore?.save(window.LmsData);
        window.App?.showToast("Recording removed from vault.", "info");
        this.switchTab('recordings');
    },

    // =========================================================================
    // 8. LIVE ROOM (Jitsi Meet embed), SESSION LIFECYCLE
    // =========================================================================
    jitsiApi: null,

    meetingConfig: { domain: 'meet.jit.si', embed: false },

    async loadMeetingConfig() {
        try {
            const data = await fetch('/api/settings/meeting').then(r => r.json());
            if (data && data.settings) this.meetingConfig = data.settings;
        } catch (e) { /* keep defaults */ }
        return this.meetingConfig;
    },

    meetingDomain() {
        return this.meetingConfig.domain || 'meet.jit.si';
    },

    // Public meet.jit.si ends embedded calls after 5 minutes, so it is never embedded
    canEmbed() {
        return !!this.meetingConfig.embed && this.meetingDomain() !== 'meet.jit.si';
    },

    meetingUrl(session) {
        const me = window.AuthRBAC?.currentUser || {};
        const name = `${me.name || 'Guest'}${this.isHost ? ' (Ustad)' : me.rollNo ? ' - ' + me.rollNo : ''}`;
        return `https://${this.meetingDomain()}/${this.roomNameFor(session)}#userInfo.displayName=${encodeURIComponent(JSON.stringify(name))}&config.subject=${encodeURIComponent(JSON.stringify(session.title || ''))}&config.prejoinConfig.enabled=false`;
    },

    openMeetingTab() {
        if (!this.activeSession) return;
        const win = window.open(this.meetingUrl(this.activeSession), '_blank', 'noopener');
        if (!win) window.App?.showToast('Your browser blocked the new tab. Allow pop-ups for this site and try again.', 'warning');
    },

    async saveMeetingConfig() {
        const me = window.AuthRBAC?.currentUser || {};
        try {
            const res = await fetch('/api/settings/meeting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain: Lms.val('meeting-domain'), embed: document.getElementById('meeting-embed').checked })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
            this.meetingConfig = data.settings;
            window.App?.showToast(data.settings.embed ? 'Live classes will open inside the portal' : 'Live classes will open in a new tab', 'success');
            this.switchTab('retention');
        } catch (e) {
            window.App?.showToast(e.message, 'error');
        }
    },

    roomNameFor(session) {
        return `JamiaAshrafia${String(session.meetingUuid || session.id).replace(/[^a-zA-Z0-9]/g, '')}${String(session.id).replace(/[^a-zA-Z0-9]/g, '').slice(-6)}`;
    },

    initAfterRender() {
        if (this.currentTab === 'studio' && this.activeSession && !this.accessBlocked && !(this.activeSession.platform === 'EXTERNAL' && this.activeSession.externalUrl) && this.canEmbed()) {
            this.mountMeeting();
        } else {
            this.disposeMeeting();
        }
    },

    loadJitsiScript(domain) {
        if (window.JitsiMeetExternalAPI) return Promise.resolve();
        if (this._jitsiLoading) return this._jitsiLoading;
        this._jitsiLoading = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = `https://${domain}/external_api.js`;
            s.async = true;
            s.onload = resolve;
            s.onerror = () => {
                this._jitsiLoading = null;
                reject(new Error(`Could not load the meeting service from ${domain}`));
            };
            document.head.appendChild(s);
        });
        return this._jitsiLoading;
    },

    async mountMeeting() {
        const container = document.getElementById('jitsi-container');
        const session = this.activeSession;
        if (!container || !session) return;
        this.disposeMeeting();
        const domain = this.meetingDomain();
        const me = window.AuthRBAC?.currentUser || {};
        try {
            await this.loadJitsiScript(domain);
            if (!document.getElementById('jitsi-container')) return; // navigated away meanwhile
            container.innerHTML = '';
            const api = new window.JitsiMeetExternalAPI(domain, {
                roomName: this.roomNameFor(session),
                parentNode: container,
                width: '100%',
                height: '100%',
                userInfo: { displayName: `${me.name || 'Guest'}${this.isHost ? ' (Ustad)' : me.rollNo ? ' • ' + me.rollNo : ''}`, email: me.email || '' },
                configOverwrite: {
                    subject: session.title,
                    prejoinPageEnabled: false,
                    prejoinConfig: { enabled: false },
                    startWithAudioMuted: !this.isHost,
                    startWithVideoMuted: !this.isHost,
                    disableDeepLinking: true
                },
                interfaceConfigOverwrite: { MOBILE_APP_PROMO: false, SHOW_JITSI_WATERMARK: false }
            });
            this.jitsiApi = api;
            // Host locks the room with the session passcode; participants supply it automatically
            api.addListener('participantRoleChanged', e => {
                if (e.role === 'moderator' && session.passcode) api.executeCommand('password', session.passcode);
            });
            api.addListener('passwordRequired', () => {
                if (session.passcode) api.executeCommand('password', session.passcode);
            });
            api.addListener('readyToClose', () => this.leaveClass());
        } catch (err) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; max-width: 520px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #fbbf24;"></i>
                    <div style="margin: 10px 0;">${Lms.esc(err.message)}. Check your internet connection.</div>
                    <a class="btn btn-primary" href="https://${Lms.esc(domain)}/${Lms.esc(this.roomNameFor(session))}" target="_blank" rel="noopener noreferrer"><i class="fas fa-external-link-alt"></i> Open the classroom in a new tab</a>
                </div>`;
        }
    },

    disposeMeeting() {
        if (this.jitsiApi) {
            try { this.jitsiApi.dispose(); } catch (e) { /* already closed */ }
            this.jitsiApi = null;
        }
    },

    // Called by the router when the user leaves the Online Classes page
    onLeaveRoute() {
        this.disposeMeeting();
        if (this.currentTab === 'studio') this.currentTab = 'lobby';
    },

    canHost(session) {
        const me = window.AuthRBAC?.currentUser || {};
        if (window.AuthRBAC.can('virtual_classes.manage')) return true;
        return window.AuthRBAC.can('virtual_classes.host') && (session.hostId === me.id || Lms.portal() === 'staff' || Lms.teacherClassIds(me.id).includes(session.classId));
    },

    startSessionEarly(sessionId) {
        const session = (window.LmsData?.virtualClasses || []).find(s => s.id === sessionId);
        if (!session || !this.canHost(session)) return;
        Object.assign(session, { status: 'LIVE', isLive: true, startedAt: new Date().toISOString() });
        window.DataStore.save(window.LmsData);
        Lms.notifyClass(session.classId, `Live class started: ${session.title}`,
            `${session.hostTeacher} is live now. Open Online Classes and press "Join Live Class".`, 'LIVE_CLASS', 'virtual-class');
        this.enterClassroom(sessionId);
    },

    endSession(sessionId) {
        const session = (window.LmsData?.virtualClasses || []).find(s => s.id === sessionId);
        if (!session || !confirm('End this class for everyone? Students will no longer be able to join.')) return;
        Object.assign(session, { status: 'COMPLETED', isLive: false, endedAt: new Date().toISOString() });
        session.attendanceCount = (window.LmsData.attendance || []).filter(a => a.session === 'VIRTUAL_CLASS' && a.virtualSessionId === session.id && a.role === 'STUDENT').length;
        window.DataStore.save(window.LmsData);
        if (this.jitsiApi) {
            try { this.jitsiApi.executeCommand('endConference'); } catch (e) { /* not moderator */ }
        }
        this.leaveClass();
        window.App?.showToast('Class ended', 'success');
    },

    viewCompletedSession(sessionId) {
        const session = (window.LmsData?.virtualClasses || []).find(s => s.id === sessionId);
        if (!session) return;
        const attendees = (window.LmsData.attendance || []).filter(a => a.session === 'VIRTUAL_CLASS'
            && (a.virtualSessionId === session.id || (!a.virtualSessionId && a.classId === session.classId && session.startedAt && a.date === session.startedAt.slice(0, 10))));
        const recording = (window.LmsData.virtualClassRecordings || []).find(r => r.sessionId === session.id);
        const roster = Lms.studentsInClass(session.classId);
        Lms.openModal(
            `<i class="fas fa-history" style="color: var(--gold-400);"></i> Session Log: ${Lms.esc(session.title)}`,
            `<div style="font-size: 0.85rem; line-height: 1.8; margin-bottom: 14px;">
                <div><strong>Class:</strong> ${Lms.esc(session.className || Lms.className(session.classId))}</div>
                <div><strong>Teacher:</strong> ${Lms.esc(session.hostTeacher || '')}</div>
                <div><strong>Scheduled:</strong> ${Lms.esc(session.scheduledStart || '')} (${Lms.esc(session.durationMinutes)} min)</div>
                ${session.startedAt ? `<div><strong>Started:</strong> ${Lms.fmtDateTime(session.startedAt)}${session.endedAt ? ` • <strong>Ended:</strong> ${Lms.fmtDateTime(session.endedAt)}` : ''}</div>` : ''}
                <div><strong>Attendance:</strong> ${attendees.filter(a => a.role === 'STUDENT').length} of ${roster.length} students joined</div>
            </div>
            ${recording ? `<button class="btn btn-gold btn-sm" style="margin-bottom: 12px;" onclick="App.closeModal(); VirtualClassModule.openVideoPlayer('${Lms.esc(recording.id)}')"><i class="fas fa-play"></i> Watch Recording</button>` : ''}
            <div class="table-responsive">
                <table class="data-table">
                    <thead><tr><th>Participant</th><th>Joined</th></tr></thead>
                    <tbody>
                        ${attendees.length ? attendees.map(a => `<tr><td>${Lms.esc(a.userName)} <span style="font-size: 0.72rem; color: var(--text-muted);">${Lms.esc(a.identifier || '')}</span></td><td>${Lms.esc(a.date)} ${Lms.esc(a.checkInTime || '')}</td></tr>`).join('')
                            : '<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">No attendance recorded for this session.</td></tr>'}
                    </tbody>
                </table>
            </div>
            ${roster.length ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 10px;"><strong>Did not join:</strong> ${roster.filter(s => !attendees.some(a => a.userId === s.id)).map(s => Lms.esc(s.name)).join(', ') || 'None'}</div>` : ''}`,
            this.canHost(session) ? `
                <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
                <button class="btn btn-gold" onclick="VirtualClassModule.openAddRecordingModal('${Lms.esc(session.id)}')"><i class="fas fa-upload"></i> ${recording ? 'Replace' : 'Add'} Recording</button>` : null
        );
    },

    copyMeetingLink() {
        const session = this.activeSession || {};
        const url = session.platform === 'EXTERNAL' && session.externalUrl
            ? session.externalUrl
            : `https://${this.meetingDomain()}/${this.roomNameFor(session)}`;
        navigator.clipboard.writeText(url).then(
            () => window.App?.showToast('Meeting link copied', 'success'),
            () => window.App?.showToast(url, 'info')
        );
    },

    leaveClass() {
        this.disposeMeeting();
        this.activeSession = null;
        this.switchTab('lobby');
    },

    // =========================================================================
    // 9. RECORDINGS UPLOAD
    // =========================================================================
    openAddRecordingModal(sessionId) {
        const session = (window.LmsData?.virtualClasses || []).find(s => s.id === sessionId);
        if (!session) return;
        Lms.openModal(
            `<i class="fas fa-film" style="color: var(--gold-400);"></i> Add Lecture Recording`,
            `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">${Lms.esc(session.title)} • ${Lms.esc(session.className || '')}</div>
            <div class="form-group" style="margin-bottom: 12px;"><label>Recording link (YouTube / Google Drive / Dropbox)</label>
                <input type="url" id="rec-link" class="form-control" placeholder="https://..."></div>
            <div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; margin-bottom: 12px;">— or upload the video file —</div>
            ${Lms.fileInput('rec-file', { label: 'Upload MP4 / WebM / MP3 (max 25 MB)', accept: '.mp4,.webm,.mp3,.m4a', hint: 'For longer lectures upload to YouTube or Drive and paste the link above' })}`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="VirtualClassModule.saveRecording(this, '${Lms.esc(session.id)}')"><i class="fas fa-save"></i> Save Recording</button>`
        );
    },

    async saveRecording(btn, sessionId) {
        const session = (window.LmsData?.virtualClasses || []).find(s => s.id === sessionId);
        const link = Lms.val('rec-link');
        const input = document.getElementById('rec-file');
        if (!link && !(input && input.files.length)) {
            window.App.showToast('Paste a link or choose a file', 'warning');
            return;
        }
        if (link && !/^https?:\/\//i.test(link)) {
            window.App.showToast('The link must start with http:// or https://', 'warning');
            return;
        }
        await Lms.busy(btn, async () => {
            const [file] = link ? [] : await Lms.uploadFromInput('rec-file');
            const list = window.LmsData.virtualClassRecordings = window.LmsData.virtualClassRecordings || [];
            let rec = list.find(r => r.sessionId === sessionId);
            if (!rec) {
                rec = { id: Lms.uid('rec'), sessionId, viewsCount: 0 };
                list.unshift(rec);
            }
            Object.assign(rec, {
                title: session.title, urduTitle: session.urduTitle || '', teacherName: session.hostTeacher, teacherId: session.hostId,
                classId: session.classId, className: session.className, courseId: session.courseId, courseName: Lms.courseTitle(session.courseId),
                recordedDate: (session.startedAt || new Date().toISOString()).slice(0, 10),
                durationFormatted: `${session.durationMinutes || 60} min`,
                videoUrl: file ? file.url : null, externalUrl: link || null, fileSizeBytes: file ? file.size : 0
            });
            window.DataStore.save(window.LmsData);
            Lms.notifyClass(session.classId, `Recording available: ${session.title}`, 'The lecture recording is now in Online Classes → Recordings Vault.', 'LIVE_CLASS', 'virtual-class');
            window.App.showToast('Recording saved to the Recordings Vault', 'success');
            window.App.closeModal();
            this.switchTab('recordings');
        }, 'Uploading...');
    }
};

window.VirtualClassModule = VirtualClassModule;
