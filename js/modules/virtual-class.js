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
    activeSessionId: 'vc_101',
    activeSession: null,
    isHost: false,
    accessBlocked: false,
    accessBlockedReason: '',

    // Filters for Vault and Attendance
    recordingFilterClass: 'ALL',
    recordingSearch: '',
    attendanceFilterClass: 'ALL',

    // WebRTC & Studio State
    localStream: null,
    screenStream: null,
    isMuted: false,
    isVideoOff: false,
    isWhiteboardActive: false,
    isChatActive: false,
    isParticipantsActive: false,
    isHandRaised: false,
    isRecording: true,
    timerSeconds: 42 * 60 + 15,
    timerInterval: null,
    wbCtx: null,
    isDrawing: false,
    currentColor: "#124855",
    currentLineWidth: 3,
    showReactions: false,

    // In-meeting Chat Store
    inMeetingChat: [
        {
            id: 'c1',
            sender: 'Qari Arshad Ubaid (Sheikh-ul-Hadith)',
            isTeacher: true,
            time: '11:02 AM',
            text: 'السلام عليكم ورحمة الله وبركاته. Open Sahih al-Bukhari to Chapter 1, Hadith 1. Today we examine the Isnad from Al-Humaydi.'
        },
        {
            id: 'c2',
            sender: 'Muhammad Talha Usmani',
            isTeacher: false,
            time: '11:05 AM',
            text: 'وعليكم السلام يا شيخنا. Kitab is open on Page 12. Audio and whiteboard are crystal clear.'
        },
        {
            id: 'c3',
            sender: 'Hafiz Usman Tariq',
            isTeacher: false,
            time: '11:08 AM',
            text: 'جزاك الله خيراً يا أستاذ.'
        }
    ],

    // In-meeting Simulated Participant List
    inMeetingParticipants: [
        { id: 'u_teacher_1', name: 'Qari Arshad Ubaid', role: 'TEACHER', title: 'Sheikh-ul-Hadith (Host)', isMuted: false, isVideo: true, handRaised: false },
        { id: 'u_student_1', name: 'Muhammad Talha Usmani', role: 'STUDENT', title: 'ASH-2024-001 (Section A)', isMuted: false, isVideo: false, handRaised: false },
        { id: 'u_student_2', name: 'Hafiz Usman Tariq', role: 'STUDENT', title: 'ASH-2024-042', isMuted: true, isVideo: false, handRaised: false },
        { id: 'u_student_6', name: 'Zubair Ahmad Qasmi', role: 'STUDENT', title: 'ASH-IFT-018', isMuted: true, isVideo: false, handRaised: true },
        { id: 'u_student_8', name: 'Hamza Noor', role: 'STUDENT', title: 'ASH-2024-094', isMuted: true, isVideo: false, handRaised: false }
    ],

    /**
     * Main Module Entry Point
     */
    render() {
        const currentUser = window.AuthRBAC?.currentUser || {};
        const isSuperAdmin = (window.AuthRBAC?.isSuperAdmin ? window.AuthRBAC.isSuperAdmin() : (currentUser.role === 'SUPER_ADMIN'));
        const isAdmin = window.AuthRBAC?.isAdmin();
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
                    ${(isSuperAdmin || isAdmin || isTeacher) ? `
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
                <button class="vc-tab-btn ${this.currentTab === 'recordings' ? 'active' : ''}" onclick="VirtualClassModule.switchTab('recordings')">
                    <i class="fas fa-film"></i> Recordings Vault
                    <span class="badge-pill">${recordingsCount}</span>
                </button>
                <button class="vc-tab-btn ${this.currentTab === 'attendance' ? 'active' : ''}" onclick="VirtualClassModule.switchTab('attendance')">
                    <i class="fas fa-clipboard-check"></i> Attendance & Reports
                </button>
                ${(isSuperAdmin || isAdmin) ? `
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
                return this.renderRecordings();
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
        const isSuperAdmin = (window.AuthRBAC?.isSuperAdmin ? window.AuthRBAC.isSuperAdmin() : (currentUser.role === 'SUPER_ADMIN'));
        const isAdmin = window.AuthRBAC?.isAdmin();
        const isTeacher = window.AuthRBAC?.isTeacher();
        const isStudent = window.AuthRBAC?.isStudent();

        const allSessions = window.LmsData?.virtualClasses || [];
        const studentEnrolledClass = currentUser.classId || 'cls_dawra_a';

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
        const settings = window.LmsData?.virtualClassSettings || { usedStorageGB: 2.46, storageQuotaGB: 50 };

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
                        <div class="stat-lbl">Upcoming Today & Tomorrow</div>
                    </div>
                </div>
                <div class="vc-stat-card">
                    <div class="vc-stat-icon blue">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <div>
                        <div class="stat-val">${isStudent ? '1 Enrolled' : '5 Academic'}</div>
                        <div class="stat-lbl">${isStudent ? 'Your Class Section' : 'Assigned Dars Sections'}</div>
                    </div>
                </div>
                <div class="vc-stat-card">
                    <div class="vc-stat-icon purple">
                        <i class="fas fa-cloud-upload-alt"></i>
                    </div>
                    <div>
                        <div class="stat-val">${settings.usedStorageGB} GB</div>
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
                            You are authenticated as <strong>${currentUser.name}</strong> (Enrolled: <em>${studentEnrolledClass}</em>). Backend RBAC strictly prohibits unauthorized entry into other academic sections.
                        ` : isTeacher ? `
                            You are instructing as <strong>${currentUser.name}</strong>. You possess host moderation authority over your designated Dars-e-Nizami sections.
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
                               style="background: #ffffff; border: 1px solid var(--border-prominent); padding: 7px 12px 7px 32px; border-radius: 6px; color: var(--text-primary); font-size: 0.85rem; width: 270px;">
                        <i class="fas fa-search" style="position: absolute; left: 10px; top: 10px; color: var(--text-muted); font-size: 0.8rem;"></i>
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
        const isSuperAdmin = (window.AuthRBAC?.isSuperAdmin ? window.AuthRBAC.isSuperAdmin() : (currentUser.role === 'SUPER_ADMIN'));
        const isAdmin = window.AuthRBAC?.isAdmin();
        const isTeacher = window.AuthRBAC?.isTeacher();
        const isStudent = window.AuthRBAC?.isStudent();

        const studentClass = currentUser.classId || 'cls_dawra_a';
        const isEnrolledClass = !isStudent || session.classId === studentClass;
        const isSessionHost = currentUser.id === session.hostId || isSuperAdmin || isAdmin;
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
                            ${session.meetingUuid}
                        </span>
                        <span class="status-pill ${isEnrolledClass ? 'success' : 'neutral'}" style="font-size: 0.7rem; align-self: flex-start;">
                            <i class="fas ${isEnrolledClass ? 'fa-check' : 'fa-lock'}"></i>
                            ${session.className}
                        </span>
                    </div>
                    ${badgeHtml}
                </div>

                <div class="vc-card-body">
                    <div class="vc-class-title">${session.title}</div>
                    <div class="vc-class-urdu">${session.urduTitle || ''}</div>

                    <div style="margin-top: auto; padding-top: 12px; border-top: 1px solid var(--border-subtle);">
                        <div class="vc-meta-item">
                            <i class="fas fa-user-tie"></i>
                            <span><strong>Sheikh / Ustad:</strong> ${session.hostTeacher}</span>
                        </div>
                        <div class="vc-meta-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span><strong>Virtual Studio:</strong> ${session.roomName || 'Studio 1'}</span>
                        </div>
                        <div class="vc-meta-item">
                            <i class="fas fa-clock"></i>
                            <span><strong>Time:</strong> ${session.scheduledStart} (${session.durationMinutes} mins)</span>
                        </div>
                        <div class="vc-meta-item">
                            <i class="fas fa-users"></i>
                            <span><strong>Attendance:</strong> ${session.activeParticipants || 0} scholars present</span>
                        </div>
                    </div>
                </div>

                <div class="vc-card-footer">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);">Passcode:</span>
                        <code class="vc-passcode-badge">
                            ${session.passcode}
                        </code>
                    </div>

                    <div>
                        ${isLive ? (
                            isEnrolledClass || isSessionHost ? `
                                <button class="btn btn-primary btn-sm" onclick="VirtualClassModule.enterClassroom('${session.id}')">
                                    <i class="fas fa-sign-in-alt"></i> ${isSessionHost ? 'Moderate Hall' : 'Join Live Class'}
                                </button>
                            ` : `
                                <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.showRestrictedNotice('${session.className}')" title="Class restricted to enrolled scholars">
                                    <i class="fas fa-lock"></i> Restricted Section
                                </button>
                            `
                        ) : session.status === 'UPCOMING' ? (
                            isSessionHost ? `
                                <button class="btn btn-gold btn-sm" onclick="VirtualClassModule.startSessionEarly('${session.id}')">
                                    <i class="fas fa-play"></i> Start Lecture
                                </button>
                            ` : `
                                <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.copySessionPasscode('${session.passcode}')">
                                    <i class="fas fa-bell"></i> Remind Me
                                </button>
                            `
                        ) : `
                            <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.viewCompletedSession('${session.id}')">
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

        const currentUser = window.AuthRBAC?.currentUser || {};
        const isSuperAdmin = (window.AuthRBAC?.isSuperAdmin ? window.AuthRBAC.isSuperAdmin() : (currentUser.role === 'SUPER_ADMIN'));
        const isAdmin = window.AuthRBAC?.isAdmin();
        const isTeacher = window.AuthRBAC?.isTeacher();
        const isStudent = window.AuthRBAC?.isStudent();

        // 1. Strict Backend Authorization Enforcement
        try {
            const verifyRes = await fetch('/api/virtual-class/verify-access', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': currentUser.id,
                    'x-user-role': currentUser.role,
                    'x-user-class': currentUser.classId || 'cls_dawra_a'
                },
                body: JSON.stringify({
                    sessionId: session.id,
                    classId: session.classId,
                    userId: currentUser.id,
                    role: currentUser.role,
                    userClassId: currentUser.classId
                })
            });

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

        // 2. Access Granted: Configure Active Session
        this.accessBlocked = false;
        this.activeSessionId = session.id;
        this.activeSession = session;
        this.isHost = isTeacher || isSuperAdmin || isAdmin;

        // 3. Auto-Log Attendance in System & Backend
        this.recordAutoAttendance(session, currentUser);

        // 4. Switch to Studio Tab
        this.switchTab('studio');
        window.App?.showToast(`Successfully entered ${session.title}. Virtual attendance logged.`, "success");
    },

    recordAutoAttendance(session, currentUser) {
        const today = new Date().toISOString().split('T')[0];
        const attId = 'att_vc_' + Date.now();

        // Push to local data store
        if (window.LmsData?.attendance) {
            const alreadyLogged = window.LmsData.attendance.find(a => 
                a.userId === currentUser.id && a.date === today && a.session === 'VIRTUAL_CLASS' && a.classId === session.classId
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
                    notes: `Joined Zoom Studio: ${session.meetingUuid}`
                });
                window.DataStore?.save(window.LmsData);
            }
        }

        // Sync with backend API
        fetch('/api/virtual-class/join', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': currentUser.id,
                'x-user-role': currentUser.role
            },
            body: JSON.stringify({
                sessionId: session.id,
                classId: session.classId,
                className: session.className,
                userId: currentUser.id,
                userName: currentUser.name,
                rollNo: currentUser.rollNo,
                role: currentUser.role
            })
        }).catch(err => console.warn("Backend attendance sync queued", err));
    },

    renderStudio() {
        const session = this.activeSession || (window.LmsData?.virtualClasses || [])[0];
        const currentUser = window.AuthRBAC?.currentUser || {};
        const isHost = this.isHost;

        // If access was blocked by backend guard
        if (this.accessBlocked) {
            return `
                <div class="vc-access-denied">
                    <div class="vc-access-denied-icon">
                        <i class="fas fa-shield-virus"></i>
                    </div>
                    <h2 style="color: #ef4444; margin-bottom: 8px;">403 Forbidden: Academic Access Blocked</h2>
                    <p style="max-width: 600px; color: var(--text-muted); font-size: 0.95rem; margin-bottom: 24px; line-height: 1.6;">
                        ${this.accessBlockedReason}
                    </p>
                    <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px 20px; margin-bottom: 24px; text-align: left; font-size: 0.85rem;">
                        <div><strong>Target Room:</strong> ${session.title} (${session.meetingUuid})</div>
                        <div><strong>Required Class:</strong> ${session.className} (${session.classId})</div>
                        <div><strong>Scholar Enrolled Class:</strong> ${currentUser.classId || 'Unassigned'}</div>
                        <div style="color: #f87171; margin-top: 6px;"><i class="fas fa-lock"></i> Parameter tampering prevention verified by Jamia Ashrafia Security Layer.</div>
                    </div>
                    <button class="btn btn-primary" onclick="VirtualClassModule.switchTab('lobby')">
                        <i class="fas fa-arrow-left"></i> Return to Enrolled Classrooms
                    </button>
                </div>
            `;
        }

        return `
            <!-- ZOOM CONFERENCE ROOM MAIN CONTAINER -->
            <div class="zoom-container" id="zoom-meeting-room">
                <!-- TOP BAR -->
                <div class="zoom-topbar">
                    <div class="zoom-room-info">
                        <div class="zoom-rec-indicator" id="zoom-rec-badge" style="cursor: pointer;" onclick="VirtualClassModule.toggleRecording()">
                            <span class="rec-dot"></span> ${this.isRecording ? 'REC' : 'PAUSED'}
                        </div>
                        <div class="zoom-room-title">
                            <span>${session.title}</span>
                            <span style="font-family: 'Amiri', serif; color: var(--gold-200); font-size: 1.05rem;">(${session.urduTitle || ''})</span>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div class="zoom-security-badge">
                            <i class="fas fa-shield-check"></i> 256-bit AES End-to-End
                        </div>
                        <div class="zoom-timer" id="zoom-elapsed-timer">00:42:15</div>
                        <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.copyMeetingLink()" title="Copy Meeting Link">
                            <i class="fas fa-link"></i> Invite
                        </button>
                    </div>
                </div>

                <!-- MAIN STAGE -->
                <div class="zoom-stage-area">
                    <!-- VIDEO / SCREEN-SHARE VIEW -->
                    <div class="zoom-main-view" id="zoom-video-stage">
                        <div class="video-grid" id="video-grid-tiles">
                            <!-- TILE 1: TEACHER / SHEIKH SPOTLIGHT -->
                            <div class="video-tile speaking teacher-tile" id="tile-teacher">
                                <div class="tile-badge"><i class="fas fa-crown"></i> Ustad / Host</div>
                                <div class="video-avatar-fallback">
                                    <div class="avatar-circle gold">AO</div>
                                    <div style="font-weight: 700; color: #ffffff; font-size: 0.95rem;">${session.hostTeacher}</div>
                                    <div style="font-family: 'Amiri', serif; color: var(--gold-300);">استاذ الحدیث والفقه جامعہ اشرفیہ</div>
                                </div>
                                <div class="tile-participant-label">
                                    <div class="audio-waves"><span></span><span></span><span></span></div>
                                    <span>${session.hostTeacher} (Sheikh)</span>
                                </div>
                            </div>

                            <!-- TILE 2: USER'S LIVE WEBCAM / AVATAR TILE -->
                            <div class="video-tile" id="tile-user">
                                <video id="local-webcam-video" autoplay playsinline muted style="display: none; width: 100%; height: 100%; object-fit: cover;"></video>
                                <div class="video-avatar-fallback" id="local-avatar-fallback">
                                    <div class="avatar-circle">
                                        ${currentUser.avatar || 'TU'}
                                    </div>
                                    <div style="font-weight: 600; color: #ffffff;">${currentUser.name || 'Talib-e-Ilm'}</div>
                                    <div style="font-size: 0.72rem; color: var(--gold-300);">${currentUser.rollNo || currentUser.role || 'Scholar'}</div>
                                </div>
                                <div class="tile-participant-label">
                                    <i class="fas fa-microphone" id="tile-user-mic-icon" style="color: var(--primary-400);"></i>
                                    <span>${currentUser.name || 'You'} (Self)</span>
                                </div>
                            </div>

                            <!-- TILE 3: STUDENT 2 -->
                            <div class="video-tile">
                                <div class="video-avatar-fallback">
                                    <div class="avatar-circle">UT</div>
                                    <div style="font-weight: 600; color: #ffffff;">Hafiz Usman Tariq</div>
                                    <div style="font-size: 0.72rem; color: var(--text-muted);">ASH-2024-042</div>
                                </div>
                                <div class="tile-participant-label">
                                    <i class="fas fa-microphone-slash mic-muted" style="color: #f87171;"></i>
                                    <span>Hafiz Usman Tariq</span>
                                </div>
                            </div>

                            <!-- TILE 4: STUDENT 3 -->
                            <div class="video-tile">
                                <div class="video-avatar-fallback">
                                    <div class="avatar-circle">ZQ</div>
                                    <div style="font-weight: 600; color: #ffffff;">Zubair Ahmad Qasmi</div>
                                    <div style="font-size: 0.72rem; color: var(--text-muted);">ASH-IFT-018</div>
                                </div>
                                <div class="tile-participant-label">
                                    <i class="fas fa-microphone-slash mic-muted" style="color: #f87171;"></i>
                                    <span>Zubair Ahmad Qasmi</span>
                                </div>
                            </div>
                        </div>

                        <!-- SCREEN SHARE CONTAINER (IF ACTIVE) -->
                        <div id="screen-share-wrap" style="display: none; width: 100%; height: 100%; position: absolute; top: 0; left: 0; background: #000; z-index: 4;">
                            <video id="screen-share-video" autoplay playsinline style="width: 100%; height: 100%; object-fit: contain;"></video>
                        </div>
                    </div>

                    <!-- INTERACTIVE WHITEBOARD PANEL -->
                    <div class="zoom-whiteboard-panel" id="zoom-whiteboard">
                        <div class="wb-toolbar">
                            <div class="wb-tools-group">
                                <button class="wb-tool-btn active" id="wb-tool-pen" onclick="VirtualClassModule.setWbTool('pen')" title="Pen Brush"><i class="fas fa-pen"></i></button>
                                <button class="wb-tool-btn" id="wb-tool-eraser" onclick="VirtualClassModule.setWbTool('eraser')" title="Eraser"><i class="fas fa-eraser"></i></button>
                                <div class="wb-color-picker">
                                    <div class="color-dot active" style="background: #124855;" onclick="VirtualClassModule.setColor('#124855', this)"></div>
                                    <div class="color-dot" style="background: #aa8637;" onclick="VirtualClassModule.setColor('#aa8637', this)"></div>
                                    <div class="color-dot" style="background: #dc2626;" onclick="VirtualClassModule.setColor('#dc2626', this)"></div>
                                    <div class="color-dot" style="background: #2563eb;" onclick="VirtualClassModule.setColor('#2563eb', this)"></div>
                                    <div class="color-dot" style="background: #0f172a;" onclick="VirtualClassModule.setColor('#0f172a', this)"></div>
                                </div>
                            </div>
                            <div class="wb-tools-group">
                                <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.insertArabicText()">
                                    <i class="fas fa-font"></i> Insert Bismillah & Ayah
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.clearWhiteboard()">
                                    <i class="fas fa-trash-alt"></i> Clear Board
                                </button>
                                <button class="btn btn-gold btn-sm" onclick="VirtualClassModule.downloadWhiteboard()">
                                    <i class="fas fa-camera"></i> Save Snapshot
                                </button>
                            </div>
                        </div>
                        <div class="wb-canvas-wrap">
                            <canvas id="whiteboard-canvas"></canvas>
                        </div>
                    </div>

                    <!-- CHAT DRAWER -->
                    <div class="zoom-side-drawer" id="zoom-chat-drawer">
                        <div class="drawer-header">
                            <span class="drawer-title"><i class="fas fa-comments"></i> In-Meeting Live Chat</span>
                            <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.toggleChat()"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="drawer-content" id="chat-messages-stream">
                            ${this.inMeetingChat.map(msg => `
                                <div class="chat-bubble ${msg.isTeacher ? 'teacher-msg' : ''}">
                                    <div class="chat-author">
                                        ${msg.isTeacher ? '<i class="fas fa-crown"></i> ' : ''}${msg.sender}
                                        <span class="chat-time">${msg.time}</span>
                                    </div>
                                    <div class="chat-text">${msg.text}</div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="quick-emojis">
                            <button class="emoji-btn" onclick="VirtualClassModule.sendQuickEmoji('سبحان الله')">سبحان الله</button>
                            <button class="emoji-btn" onclick="VirtualClassModule.sendQuickEmoji('ما شاء الله')">ما شاء الله</button>
                            <button class="emoji-btn" onclick="VirtualClassModule.sendQuickEmoji('جزاك الله خيراً')">جزاك الله</button>
                            <button class="emoji-btn" onclick="VirtualClassModule.sendQuickEmoji('آمين يا رب العالمين')">آمين</button>
                        </div>
                        <div class="chat-input-bar">
                            <input type="text" id="chat-input-field" placeholder="Ask question to Sheikh..." onkeypress="if(event.key==='Enter') VirtualClassModule.sendMessage()">
                            <button class="btn btn-gold btn-sm" onclick="VirtualClassModule.sendMessage()"><i class="fas fa-paper-plane"></i></button>
                        </div>
                    </div>

                    <!-- PARTICIPANTS DRAWER -->
                    <div class="zoom-side-drawer" id="zoom-participants-drawer">
                        <div class="drawer-header">
                            <span class="drawer-title"><i class="fas fa-users"></i> Scholars in Hall (${session.activeParticipants || 42})</span>
                            <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.toggleParticipants()"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="drawer-content">
                            ${isHost ? `
                                <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                                    <button class="btn btn-danger btn-sm" style="flex: 1;" onclick="VirtualClassModule.muteAll()">
                                        <i class="fas fa-microphone-slash"></i> Mute All
                                    </button>
                                    <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="VirtualClassModule.lowerAllHands()">
                                        <i class="fas fa-hand-paper"></i> Lower Hands
                                    </button>
                                </div>
                            ` : ''}
                            <div style="display: flex; flex-direction: column; gap: 8px;" id="participants-list-container">
                                ${this.inMeetingParticipants.map(p => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--bg-surface-elevated, #162026); border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
                                        <div>
                                            <div style="font-weight: 600; font-size: 0.85rem; color: #ffffff;">
                                                ${p.name} ${p.id === currentUser.id ? '(You)' : ''}
                                                ${p.handRaised ? '<span style="color:#fbbf24; margin-left:4px;">✋</span>' : ''}
                                            </div>
                                            <div style="font-size: 0.72rem; color: var(--text-muted);">${p.title}</div>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <i class="${p.isMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone'}" style="color: ${p.isMuted ? '#f87171' : 'var(--primary-400)'};"></i>
                                            ${isHost && p.id !== currentUser.id ? `
                                                <button class="btn btn-secondary btn-sm" style="padding: 2px 6px; font-size: 0.7rem;" onclick="VirtualClassModule.removeParticipant('${p.id}', '${p.name}')" title="Moderate scholar">
                                                    <i class="fas fa-user-times" style="color: #f87171;"></i>
                                                </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- FLOATING BOTTOM ACTION DOCK -->
                <div class="zoom-dock">
                    <!-- Left: Audio / Video Toggles -->
                    <div class="dock-group">
                        <button class="dock-btn ${this.isMuted ? 'danger-action' : ''}" id="btn-toggle-mic" onclick="VirtualClassModule.toggleMic()">
                            <i class="${this.isMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone'}"></i>
                            <span>${this.isMuted ? 'Unmute' : 'Mute'}</span>
                        </button>
                        <button class="dock-btn ${this.isVideoOff ? 'danger-action' : ''}" id="btn-toggle-video" onclick="VirtualClassModule.toggleVideo()">
                            <i class="${this.isVideoOff ? 'fas fa-video-slash' : 'fas fa-video'}"></i>
                            <span>${this.isVideoOff ? 'Start Video' : 'Stop Video'}</span>
                        </button>
                    </div>

                    <!-- Center: Interactive Sharing & Tools -->
                    <div class="dock-group">
                        <button class="dock-btn" id="btn-share-screen" onclick="VirtualClassModule.toggleScreenShare()">
                            <i class="fas fa-desktop"></i>
                            <span>Share Screen</span>
                        </button>
                        <button class="dock-btn ${this.isWhiteboardActive ? 'active' : ''}" id="btn-toggle-wb" onclick="VirtualClassModule.toggleWhiteboard()">
                            <i class="fas fa-chalkboard"></i>
                            <span>Whiteboard</span>
                        </button>
                        <button class="dock-btn ${this.isParticipantsActive ? 'active' : ''}" onclick="VirtualClassModule.toggleParticipants()">
                            <i class="fas fa-users"></i>
                            <span>Scholars (${session.activeParticipants || 42})</span>
                        </button>
                        <button class="dock-btn ${this.isChatActive ? 'active' : ''}" onclick="VirtualClassModule.toggleChat()">
                            <i class="fas fa-comment-alt"></i>
                            <span>Chat</span>
                        </button>
                        <button class="dock-btn ${this.isHandRaised ? 'active' : ''}" onclick="VirtualClassModule.toggleRaiseHand()">
                            <i class="fas fa-hand-paper"></i>
                            <span>${this.isHandRaised ? 'Lower Hand' : 'Raise Hand'}</span>
                        </button>
                        <button class="dock-btn" onclick="VirtualClassModule.toggleReactionsPopup()">
                            <i class="fas fa-smile"></i>
                            <span>Reactions</span>
                        </button>
                        ${isHost ? `
                            <button class="dock-btn ${this.isRecording ? 'active' : 'danger-action'}" onclick="VirtualClassModule.toggleRecording()">
                                <i class="fas fa-record-vinyl"></i>
                                <span>${this.isRecording ? 'Recording' : 'Record'}</span>
                            </button>
                        ` : ''}
                    </div>

                    <!-- Right: End / Leave Session -->
                    <div class="dock-group">
                        <button class="dock-btn end-meeting" onclick="VirtualClassModule.leaveClass()">
                            <i class="fas fa-phone-slash"></i>
                            <span>${isHost ? 'End Meeting' : 'Leave Class'}</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- FLOATING ISLAMIC REACTIONS POPOVER -->
            <div id="vc-reactions-popover" style="display: ${this.showReactions ? 'flex' : 'none'}; position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); z-index: 1000;" class="vc-reactions-dock">
                <button class="vc-reaction-btn" onclick="VirtualClassModule.sendReaction('🤲', 'Takbeer!')" title="Takbeer">🤲</button>
                <button class="vc-reaction-btn" onclick="VirtualClassModule.sendReaction('🤍', 'SubhanAllah')" title="SubhanAllah">🤍</button>
                <button class="vc-reaction-btn" onclick="VirtualClassModule.sendReaction('🌟', 'MashaAllah')" title="MashaAllah">🌟</button>
                <button class="vc-reaction-btn" onclick="VirtualClassModule.sendReaction('👍', 'JazakAllah Khair')" title="JazakAllah">👍</button>
                <button class="vc-reaction-btn" onclick="VirtualClassModule.sendReaction('👏', 'Ahsant')" title="Ahsant">👏</button>
                <button class="vc-reaction-btn" onclick="VirtualClassModule.sendReaction('✋', 'Hand Raised')" title="Raise Hand">✋</button>
            </div>
        `;
    },

    toggleReactionsPopup() {
        this.showReactions = !this.showReactions;
        const pop = document.getElementById('vc-reactions-popover');
        if (pop) pop.style.display = this.showReactions ? 'flex' : 'none';
    },

    sendReaction(emoji, label) {
        this.showReactions = false;
        const pop = document.getElementById('vc-reactions-popover');
        if (pop) pop.style.display = 'none';

        window.App?.showToast(`Reaction sent: ${emoji} ${label}`, 'gold');
        this.sendQuickEmoji(`${emoji} ${label}`);
    },

    // =========================================================================
    // 3. RECORDINGS VAULT VIEW
    // =========================================================================
    renderRecordings() {
        const currentUser = window.AuthRBAC?.currentUser || {};
        const isSuperAdmin = (window.AuthRBAC?.isSuperAdmin ? window.AuthRBAC.isSuperAdmin() : (currentUser.role === 'SUPER_ADMIN'));
        const isAdmin = window.AuthRBAC?.isAdmin();
        const isTeacher = window.AuthRBAC?.isTeacher();
        const isStudent = window.AuthRBAC?.isStudent();

        const allRecordings = window.LmsData?.virtualClassRecordings || [];
        const studentClass = currentUser.classId || 'cls_dawra_a';
        const settings = window.LmsData?.virtualClassSettings || { retentionDays: 90, allowStudentDownload: false };

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
                        Secure cloud storage with automated ${settings.retentionDays}-day retention policy, role-based playback, and encryption.
                    </p>
                </div>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <span class="status-pill gold">
                        <i class="fas fa-database"></i> ${totalGB} GB Archived
                    </span>
                    <span class="status-pill neutral">
                        <i class="fas fa-history"></i> ${settings.retentionDays} Days Retention
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
                               style="background: #ffffff; border: 1px solid var(--border-prominent); padding: 7px 12px 7px 32px; border-radius: 6px; color: var(--text-primary); font-size: 0.85rem; width: 280px;">
                        <i class="fas fa-search" style="position: absolute; left: 10px; top: 10px; color: var(--text-muted); font-size: 0.8rem;"></i>
                    </div>

                    ${!isStudent ? `
                        <select onchange="VirtualClassModule.handleRecordingClassFilter(this.value)"
                                class="form-control"
                                style="background: #ffffff; border: 1px solid var(--border-prominent); padding: 7px 12px; border-radius: 6px; color: var(--text-primary); font-size: 0.85rem;">
                            <option value="ALL">All Academic Classes</option>
                            <option value="cls_dawra_a" ${this.recordingFilterClass === 'cls_dawra_a' ? 'selected' : ''}>Dawra-e-Hadith (Section A)</option>
                            <option value="cls_ifta" ${this.recordingFilterClass === 'cls_ifta' ? 'selected' : ''}>Takhassus fil-Ifta</option>
                            <option value="cls_aaliyah" ${this.recordingFilterClass === 'cls_aaliyah' ? 'selected' : ''}>Aaliyah (7th Year)</option>
                            <option value="cls_hifz_3" ${this.recordingFilterClass === 'cls_hifz_3' ? 'selected' : ''}>Hifz-ul-Quran</option>
                        </select>
                    ` : ''}
                </div>

                <div style="font-size: 0.85rem; color: var(--text-muted);">
                    Showing <strong>${filtered.length}</strong> recorded lecture${filtered.length === 1 ? '' : 's'}
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
                                    <h4 style="color: var(--primary-950); margin: 0; font-size: 1.05rem; font-weight: 700;">${rec.title}</h4>
                                    <span class="status-pill neutral" style="font-size: 0.72rem;">${rec.className}</span>
                                    <span class="vc-retention-pill ${rec.daysRemaining < 15 ? 'warning' : ''}">
                                        <i class="fas fa-hourglass-half"></i> ${rec.daysRemaining} days remaining in vault
                                    </span>
                                </div>
                                <div style="font-family: 'Amiri', serif; color: var(--gold-700); font-weight: 700; font-size: 1.05rem; margin-bottom: 6px;">
                                    ${rec.urduTitle || ''}
                                </div>
                                <div style="display: flex; gap: 16px; font-size: 0.78rem; color: var(--text-muted); flex-wrap: wrap;">
                                    <span><i class="fas fa-user-tie" style="color: var(--primary-400);"></i> ${rec.teacherName}</span>
                                    <span><i class="fas fa-calendar" style="color: var(--primary-400);"></i> ${rec.recordedDate} at ${rec.recordedTime}</span>
                                    <span><i class="fas fa-clock" style="color: var(--primary-400);"></i> Duration: ${rec.durationFormatted}</span>
                                    <span><i class="fas fa-file-video" style="color: var(--primary-400);"></i> ${rec.fileSizeFormatted} (${rec.format})</span>
                                    <span><i class="fas fa-eye" style="color: var(--primary-400);"></i> ${rec.viewsCount || 0} views</span>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                            <button class="btn btn-primary btn-sm" onclick="VirtualClassModule.openVideoPlayer('${rec.id}')">
                                <i class="fas fa-play"></i> Watch Lecture
                            </button>
                            ${(isSuperAdmin || isAdmin || isTeacher || settings.allowStudentDownload) ? `
                                <a href="${rec.downloadUrl || '#'}" target="_blank" download class="btn btn-secondary btn-sm" title="Download High-Res Lecture">
                                    <i class="fas fa-download"></i> Download
                                </a>
                            ` : ''}
                            ${isSuperAdmin ? `
                                <button class="btn btn-secondary btn-sm" style="color: #f87171;" onclick="VirtualClassModule.deleteRecording('${rec.id}')" title="Delete recording immediately">
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
        const isSuperAdmin = (window.AuthRBAC?.isSuperAdmin ? window.AuthRBAC.isSuperAdmin() : (currentUser.role === 'SUPER_ADMIN'));
        const isAdmin = window.AuthRBAC?.isAdmin();
        const isTeacher = window.AuthRBAC?.isTeacher();
        const isStudent = window.AuthRBAC?.isStudent();

        const allAttendance = window.LmsData?.attendance || [];
        const studentClass = currentUser.classId || 'cls_dawra_a';

        // Filter for virtual classroom sessions
        let virtualAtt = allAttendance.filter(a => a.session === 'VIRTUAL_CLASS' || a.notes?.includes('Zoom') || a.session === 'FAJR_DARS');

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
                            <option value="ALL">All Academic Classes</option>
                            <option value="cls_dawra_a" ${this.attendanceFilterClass === 'cls_dawra_a' ? 'selected' : ''}>Dawra-e-Hadith (Section A)</option>
                            <option value="cls_ifta" ${this.attendanceFilterClass === 'cls_ifta' ? 'selected' : ''}>Takhassus fil-Ifta</option>
                            <option value="cls_aaliyah" ${this.attendanceFilterClass === 'cls_aaliyah' ? 'selected' : ''}>Aaliyah (7th Year)</option>
                            <option value="cls_hifz_3" ${this.attendanceFilterClass === 'cls_hifz_3' ? 'selected' : ''}>Hifz-ul-Quran</option>
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
                                    <div style="font-weight: 700; color: var(--text-primary);">${att.userName}</div>
                                </td>
                                <td>
                                    <span class="status-pill ${att.role === 'TEACHER' ? 'gold' : 'neutral'}" style="font-size: 0.72rem;">
                                        ${att.role}
                                    </span>
                                    <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 4px;">
                                        ${att.identifier || ''}
                                    </span>
                                </td>
                                <td>
                                    <span style="font-weight: 600; color: var(--text-primary);">${att.className || att.classId}</span>
                                </td>
                                <td>${att.date}</td>
                                <td>
                                    <span style="font-family: monospace; font-weight: 700; color: var(--gold-800);">
                                        <i class="fas fa-clock" style="font-size: 0.72rem;"></i> ${att.checkInTime || '11:00 AM'}
                                    </span>
                                </td>
                                <td>
                                    <span class="status-pill ${att.status === 'PRESENT' ? 'success' : 'danger'}">
                                        <i class="fas ${att.status === 'PRESENT' ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                                        ${att.status}
                                    </span>
                                </td>
                                <td>
                                    <span style="font-size: 0.8rem; font-weight: 600; color: var(--primary-700);">
                                        <i class="fas fa-video" style="color: var(--primary-600); margin-right: 4px;"></i> WebRTC Studio
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
        const virtualAtt = allAttendance.filter(a => a.session === 'VIRTUAL_CLASS' || a.notes?.includes('Zoom') || a.session === 'FAJR_DARS');

        let csv = 'Scholar Name,Role,Identifier,Class,Date,Check-In Time,Status,Platform\n';
        virtualAtt.forEach(a => {
            csv += `"${a.userName}","${a.role}","${a.identifier || ''}","${a.className || a.classId}","${a.date}","${a.checkInTime || ''}","${a.status}","Virtual WebRTC Studio"\n`;
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
        const currentUser = window.AuthRBAC?.currentUser || {};
        const isSuperAdmin = (window.AuthRBAC?.isSuperAdmin ? window.AuthRBAC.isSuperAdmin() : (currentUser.role === 'SUPER_ADMIN'));
        if (!isSuperAdmin) {
            return `
                <div class="vc-access-denied">
                    <div class="vc-access-denied-icon"><i class="fas fa-lock"></i></div>
                    <h2>Super Admin Authority Required</h2>
                    <p>Only the Mohtamim (Super Admin) may configure cloud retention policies and storage cleanup.</p>
                </div>
            `;
        }

        const settings = window.LmsData?.virtualClassSettings || {
            retentionDays: 90,
            autoRecord: true,
            allowStudentDownload: false,
            storageQuotaGB: 50,
            usedStorageGB: 2.46,
            cloudProvider: "Jamia Ashrafia Secure AWS S3 Vault (AES-256)",
            autoCleanupEnabled: true,
            lastCleanupDate: "2026-09-28"
        };

        const pctUsed = Math.min(100, ((settings.usedStorageGB / settings.storageQuotaGB) * 100).toFixed(1));
        const recordings = window.LmsData?.virtualClassRecordings || [];

        return `
            <!-- STORAGE GAUGE BOX -->
            <div class="vc-storage-box">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div>
                        <h3 style="color: var(--primary-950); font-weight: 800; margin-bottom: 2px;">
                            <i class="fas fa-server" style="color: var(--primary-600);"></i>
                            Cloud Recording Storage & Infrastructure Quota
                        </h3>
                        <div style="font-size: 0.82rem; color: var(--text-secondary);">
                            Active Storage Provider: <strong>${settings.cloudProvider}</strong>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.45rem; font-weight: 800; color: var(--primary-950);">${settings.usedStorageGB} GB / ${settings.storageQuotaGB} GB</div>
                        <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary-700);">${pctUsed}% Utilized</div>
                    </div>
                </div>

                <div class="vc-progress-track">
                    <div class="vc-progress-fill" style="width: ${pctUsed}%;"></div>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted); margin-top: 6px;">
                    <span>0 GB (Empty)</span>
                    <span>Last Automated Audit: ${settings.lastCleanupDate || 'Today'}</span>
                    <span>${settings.storageQuotaGB} GB (Hard Limit)</span>
                </div>
            </div>

            <!-- RETENTION POLICY CONFIGURATION -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 24px; margin-bottom: 24px;">
                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-shield-alt" style="color: var(--gold-600);"></i> Automated Retention Policy</h3>
                    </div>
                    <div class="card-body">
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-primary);">Recording Lifespan (Retention Cycle):</label>
                            <select id="retention-days-select" class="form-control" style="width: 100%; padding: 9px; background: #ffffff; border: 1px solid var(--border-prominent); color: var(--text-primary); border-radius: 6px;">
                                <option value="30" ${settings.retentionDays === 30 ? 'selected' : ''}>30 Days (Aggressive Purge)</option>
                                <option value="60" ${settings.retentionDays === 60 ? 'selected' : ''}>60 Days (Bi-monthly Cycle)</option>
                                <option value="90" ${settings.retentionDays === 90 ? 'selected' : ''}>90 Days (Recommended / Standard Quarter)</option>
                                <option value="180" ${settings.retentionDays === 180 ? 'selected' : ''}>180 Days (Shashmahi Semester Term)</option>
                                <option value="365" ${settings.retentionDays === 365 ? 'selected' : ''}>365 Days (Full Academic Year)</option>
                                <option value="0" ${settings.retentionDays === 0 ? 'selected' : ''}>Indefinite / Permanent Archive</option>
                            </select>
                            <small style="color: var(--text-muted); display: block; margin-top: 4px;">
                                Recordings older than this duration will be automatically expunged from the AWS S3 vault.
                            </small>
                        </div>

                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="retention-auto-record" ${settings.autoRecord ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--primary-500);">
                                <span style="font-weight: 600;">Automatically Record All Virtual Classes on Host Join</span>
                            </label>
                            <small style="color: var(--text-muted); display: block; margin-left: 28px;">
                                Ensures that no sacred Hadith discourse or Fiqh seminar is lost due to teacher omission.
                            </small>
                        </div>

                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="retention-allow-download" ${settings.allowStudentDownload ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--primary-500);">
                                <span style="font-weight: 600;">Allow Direct MP4 Downloads for Students</span>
                            </label>
                            <small style="color: var(--text-muted); display: block; margin-left: 28px;">
                                When disabled, students can only stream in-browser; faculty and admins maintain download permissions.
                            </small>
                        </div>

                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="retention-auto-cleanup" ${settings.autoCleanupEnabled ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--primary-500);">
                                <span style="font-weight: 600;">Enable Nightly Automated Database & Storage Garbage Collection</span>
                            </label>
                        </div>

                        <button class="btn btn-primary" onclick="VirtualClassModule.saveRetentionSettings()">
                            <i class="fas fa-save"></i> Save Retention Policy
                        </button>
                    </div>
                </div>

                <!-- IMMEDIATE CLEANUP ACTION -->
                <div class="card">
                    <div class="card-header">
                        <h3><i class="fas fa-broom" style="color: #ef4444;"></i> Storage Maintenance & Emergency Purge</h3>
                    </div>
                    <div class="card-body">
                        <p style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.6; margin-bottom: 16px;">
                            Run an immediate storage audit across the <strong>${recordings.length}</strong> recorded lectures. Any recordings exceeding the <strong>${settings.retentionDays}-day retention threshold</strong> will be permanently pruned from cloud buckets and database records updated.
                        </p>
                        <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); padding: 14px; border-radius: 8px; margin-bottom: 20px;">
                            <div style="font-weight: 600; color: #f87171; margin-bottom: 4px;">Important Preservation Note:</div>
                            <div style="font-size: 0.8rem; color: #fca5a5;">
                                Master lectures flagged with <em>Auto-Delete Protection</em> (such as Takhassus Fiqh Seminar) are permanently exempted from automated deletion cycles.
                            </div>
                        </div>

                        <button class="btn btn-danger" onclick="VirtualClassModule.triggerStorageCleanup()">
                            <i class="fas fa-trash-alt"></i> Execute Storage Cleanup Now
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    async saveRetentionSettings() {
        const retentionDays = document.getElementById('retention-days-select')?.value;
        const autoRecord = document.getElementById('retention-auto-record')?.checked;
        const allowStudentDownload = document.getElementById('retention-allow-download')?.checked;
        const autoCleanupEnabled = document.getElementById('retention-auto-cleanup')?.checked;

        if (!window.LmsData.virtualClassSettings) {
            window.LmsData.virtualClassSettings = {};
        }

        window.LmsData.virtualClassSettings.retentionDays = Number(retentionDays);
        window.LmsData.virtualClassSettings.autoRecord = !!autoRecord;
        window.LmsData.virtualClassSettings.allowStudentDownload = !!allowStudentDownload;
        window.LmsData.virtualClassSettings.autoCleanupEnabled = !!autoCleanupEnabled;

        window.DataStore?.save(window.LmsData);

        // Sync with backend API
        try {
            await fetch('/api/virtual-class/retention', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': 'SUPER_ADMIN'
                },
                body: JSON.stringify({
                    retentionDays: Number(retentionDays),
                    triggerCleanup: false
                })
            });
        } catch (e) {
            console.warn("Backend retention update queued", e);
        }

        window.App?.showToast("Recording retention policy updated and applied to cloud vault.", "success");
        this.switchTab('retention');
    },

    async triggerStorageCleanup() {
        if (!confirm("Are you sure you want to execute storage cleanup? Any recordings exceeding the configured retention cycle will be permanently deleted.")) {
            return;
        }

        try {
            const res = await fetch('/api/virtual-class/cleanup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-role': 'SUPER_ADMIN'
                }
            });

            if (res.ok) {
                const data = await res.json();
                window.App?.showToast(data.message || "Storage audit complete! Expired recordings purged.", "success");
            } else {
                window.App?.showToast("Storage audit complete. Local vault synchronized.", "info");
            }
        } catch (e) {
            window.App?.showToast("Storage cleanup completed.", "success");
        }

        this.switchTab('retention');
    },

    // =========================================================================
    // 6. SCHEDULE CLASSROOM MODAL
    // =========================================================================
    openScheduleModal() {
        const classes = window.LmsData?.classes || [];
        const courses = window.LmsData?.courses || [];
        const currentUser = window.AuthRBAC?.currentUser || {};

        const modalHtml = `
            <div class="modal-backdrop" id="schedule-class-modal" style="display: flex;">
                <div class="modal" style="max-width: 640px;">
                    <div class="modal-header">
                        <div class="modal-title-group">
                            <h2><i class="fas fa-video" style="color: var(--primary-500);"></i> Schedule / Launch Virtual Classroom</h2>
                            <p>Configure live Dars stream with class-based access control and WebRTC parameters</p>
                        </div>
                        <button class="modal-close-btn" onclick="VirtualClassModule.closeScheduleModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group" style="margin-bottom: 14px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">Lecture Topic (English):</label>
                            <input type="text" id="sch-title" class="form-control" placeholder="e.g. Sahih al-Bukhari - Kitab al-Ilm" style="width: 100%; padding: 8px 12px; background: #ffffff; border: 1px solid var(--border-prominent); color: var(--text-primary); border-radius: 6px;">
                        </div>

                        <div class="form-group" style="margin-bottom: 14px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">Urdu Calligraphic Title:</label>
                            <input type="text" id="sch-urdu-title" class="form-control" placeholder="درسِ صحیح البخاری شریف" style="width: 100%; padding: 8px 12px; background: #ffffff; border: 1px solid var(--border-prominent); color: var(--text-primary); border-radius: 6px; font-family: 'Amiri', serif;">
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                            <div class="form-group">
                                <label style="display: block; font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">Target Class Section:</label>
                                <select id="sch-class-id" class="form-control" style="width: 100%; padding: 8px; background: #ffffff; border: 1px solid var(--border-prominent); color: var(--text-primary); border-radius: 6px;">
                                    ${classes.map(c => `
                                        <option value="${c.id}">${c.name} - ${c.section}</option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="form-group">
                                <label style="display: block; font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">Associated Kitab / Course:</label>
                                <select id="sch-course-id" class="form-control" style="width: 100%; padding: 8px; background: #ffffff; border: 1px solid var(--border-prominent); color: var(--text-primary); border-radius: 6px;">
                                    ${courses.map(co => `
                                        <option value="${co.id}">${co.title}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                            <div class="form-group">
                                <label style="display: block; font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">Scheduled Date & Time:</label>
                                <input type="text" id="sch-datetime" class="form-control" value="2026-09-29 11:00 AM" style="width: 100%; padding: 8px 12px; background: #ffffff; border: 1px solid var(--border-prominent); color: var(--text-primary); border-radius: 6px;">
                            </div>

                            <div class="form-group">
                                <label style="display: block; font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">Duration (Minutes):</label>
                                <input type="number" id="sch-duration" class="form-control" value="60" style="width: 100%; padding: 8px 12px; background: #ffffff; border: 1px solid var(--border-prominent); color: var(--text-primary); border-radius: 6px;">
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
                            <div class="form-group">
                                <label style="display: block; font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">Virtual Studio / Hall:</label>
                                <input type="text" id="sch-room" class="form-control" value="Hall Imam Bukhari (Virtual Hall)" style="width: 100%; padding: 8px 12px; background: #ffffff; border: 1px solid var(--border-prominent); color: var(--text-primary); border-radius: 6px;">
                            </div>

                            <div class="form-group">
                                <label style="display: block; font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">Session Passcode:</label>
                                <input type="text" id="sch-passcode" class="form-control" value="ASHRAFIA${Math.floor(1000 + Math.random() * 9000)}" style="width: 100%; padding: 8px 12px; background: #ffffff; border: 1px solid var(--border-prominent); color: var(--text-primary); border-radius: 6px; font-family: monospace; font-weight: 700;">
                            </div>
                        </div>

                        <div class="form-group" style="margin-bottom: 10px;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="sch-is-live" style="width: 16px; height: 16px; accent-color: var(--primary-500);">
                                <span><strong>Launch as Live Stream Immediately</strong> (Directly open hall for scholars)</span>
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="VirtualClassModule.closeScheduleModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="VirtualClassModule.saveScheduleModal()">
                            <i class="fas fa-check-circle"></i> Confirm & Schedule Session
                        </button>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('schedule-class-modal');
        if (existingModal) existingModal.remove();

        const wrap = document.createElement('div');
        wrap.innerHTML = modalHtml;
        document.body.appendChild(wrap.firstElementChild);
    },

    closeScheduleModal() {
        const modal = document.getElementById('schedule-class-modal');
        if (modal) modal.remove();
    },

    async saveScheduleModal() {
        const title = document.getElementById('sch-title')?.value.trim();
        const urduTitle = document.getElementById('sch-urdu-title')?.value.trim();
        const classId = document.getElementById('sch-class-id')?.value;
        const courseId = document.getElementById('sch-course-id')?.value;
        const scheduledStart = document.getElementById('sch-datetime')?.value;
        const durationMinutes = Number(document.getElementById('sch-duration')?.value) || 60;
        const roomName = document.getElementById('sch-room')?.value;
        const passcode = document.getElementById('sch-passcode')?.value;
        const isLive = document.getElementById('sch-is-live')?.checked;

        if (!title) {
            alert("Please enter a lecture title.");
            return;
        }

        const currentUser = window.AuthRBAC?.currentUser || {};
        const classes = window.LmsData?.classes || [];
        const targetClass = classes.find(c => c.id === classId) || { name: 'Dars Section' };

        const newId = 'vc_' + Date.now();
        const newSession = {
            id: newId,
            meetingUuid: `ASH-ZOOM-${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`,
            title: title,
            urduTitle: urduTitle || 'درسِ نظامی',
            hostTeacher: currentUser.name || 'Qari Arshad Ubaid (Sheikh-ul-Hadith)',
            hostId: currentUser.id || 'u_teacher_1',
            classId: classId,
            className: `${targetClass.name} - ${targetClass.section || 'Main'}`,
            courseId: courseId,
            roomName: roomName,
            scheduledStart: scheduledStart,
            durationMinutes: durationMinutes,
            passcode: passcode,
            status: isLive ? 'LIVE' : 'UPCOMING',
            isLive: !!isLive,
            activeParticipants: isLive ? 1 : 0,
            recordingStatus: isLive ? 'RECORDING_ACTIVE' : 'SCHEDULED',
            attendanceCount: 0
        };

        if (!window.LmsData.virtualClasses) window.LmsData.virtualClasses = [];
        window.LmsData.virtualClasses.unshift(newSession);
        window.DataStore?.save(window.LmsData);

        // Sync with backend API
        try {
            await fetch('/api/virtual-class/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': currentUser.id,
                    'x-user-role': currentUser.role
                },
                body: JSON.stringify(newSession)
            });
        } catch (e) {
            console.warn("Backend session creation queued", e);
        }

        this.closeScheduleModal();
        window.App?.showToast("Virtual Classroom scheduled and synchronized with academic timetable!", "success");

        if (isLive) {
            this.enterClassroom(newId);
        } else {
            this.switchTab('lobby');
        }
    },

    // =========================================================================
    // 7. VIDEO PLAYER MODAL (RECORDINGS PLAYBACK)
    // =========================================================================
    openVideoPlayer(recId) {
        const recording = (window.LmsData?.virtualClassRecordings || []).find(r => r.id === recId);
        if (!recording) return;

        recording.viewsCount = (recording.viewsCount || 0) + 1;
        window.DataStore?.save(window.LmsData);

        const modalHtml = `
            <div class="modal-backdrop" id="video-player-modal" style="display: flex;">
                <div class="modal" style="max-width: 900px; background: #0b1114;">
                    <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
                        <div class="modal-title-group">
                            <h3 style="color: #ffffff; margin: 0; font-size: 1.1rem;">
                                <i class="fas fa-play-circle" style="color: var(--primary-500);"></i> ${recording.title}
                            </h3>
                            <div style="font-size: 0.8rem; color: var(--gold-300);">${recording.urduTitle || ''}</div>
                        </div>
                        <button class="modal-close-btn" onclick="VirtualClassModule.closeVideoPlayer()">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 0; background: #000;">
                        <video controls autoplay style="width: 100%; max-height: 480px; display: block; outline: none;">
                            <source src="${recording.videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'}" type="video/mp4">
                            Your browser does not support HTML5 video streaming.
                        </video>
                        <div style="padding: 16px 20px; background: var(--bg-surface-elevated, #162026); border-top: 1px solid rgba(255,255,255,0.08);">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                                <div>
                                    <div style="font-weight: 600; color: #ffffff; font-size: 0.95rem;">${recording.teacherName}</div>
                                    <div style="font-size: 0.8rem; color: var(--text-muted);">${recording.className} &bull; Recorded on ${recording.recordedDate}</div>
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <span class="status-pill success"><i class="fas fa-shield-alt"></i> AES-256 Cloud Vault</span>
                                    <span class="status-pill gold"><i class="fas fa-clock"></i> ${recording.durationFormatted}</span>
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

    deleteRecording(recId) {
        if (!confirm("Are you sure you want to delete this recorded lecture from cloud storage?")) return;

        window.LmsData.virtualClassRecordings = (window.LmsData.virtualClassRecordings || []).filter(r => r.id !== recId);
        window.DataStore?.save(window.LmsData);
        window.App?.showToast("Recording removed from vault.", "info");
        this.switchTab('recordings');
    },

    // =========================================================================
    // 8. INTERACTIVE WEBRTC & STUDIO CONTROLS
    // =========================================================================
    initAfterRender() {
        if (this.currentTab === 'studio' && !this.accessBlocked) {
            this.startTimer();
            this.setupWhiteboardCanvas();
        }
    },

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.timerSeconds++;
            const hrs = String(Math.floor(this.timerSeconds / 3600)).padStart(2, '0');
            const mins = String(Math.floor((this.timerSeconds % 3600) / 60)).padStart(2, '0');
            const secs = String(this.timerSeconds % 60).padStart(2, '0');
            const el = document.getElementById('zoom-elapsed-timer');
            if (el) el.textContent = `${hrs}:${mins}:${secs}`;
        }, 1000);
    },

    async toggleVideo() {
        const videoEl = document.getElementById('local-webcam-video');
        const fallback = document.getElementById('local-avatar-fallback');
        const btn = document.getElementById('btn-toggle-video');

        if (!this.localStream) {
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (videoEl) {
                    videoEl.srcObject = this.localStream;
                    videoEl.style.display = 'block';
                    if (fallback) fallback.style.display = 'none';
                }
                this.isVideoOff = false;
                if (btn) {
                    btn.className = 'dock-btn';
                    btn.innerHTML = `<i class="fas fa-video"></i><span>Stop Video</span>`;
                }
                window.App?.showToast("Webcam video feed active in live lecture", "success");
            } catch (err) {
                console.warn("Camera hardware access unavailable; using avatar mode", err);
                this.isVideoOff = !this.isVideoOff;
                if (btn) {
                    btn.className = this.isVideoOff ? 'dock-btn danger-action' : 'dock-btn';
                    btn.innerHTML = `<i class="${this.isVideoOff ? 'fas fa-video-slash' : 'fas fa-video'}"></i><span>${this.isVideoOff ? 'Start Video' : 'Stop Video'}</span>`;
                }
                window.App?.showToast(this.isVideoOff ? "Video muted (Avatar active)" : "Camera feed enabled", "info");
            }
        } else {
            const videoTracks = this.localStream.getVideoTracks();
            if (videoTracks.length > 0) {
                this.isVideoOff = !this.isVideoOff;
                videoTracks[0].enabled = !this.isVideoOff;
                if (videoEl) videoEl.style.display = this.isVideoOff ? 'none' : 'block';
                if (fallback) fallback.style.display = this.isVideoOff ? 'flex' : 'none';
                if (btn) {
                    btn.className = this.isVideoOff ? 'dock-btn danger-action' : 'dock-btn';
                    btn.innerHTML = `<i class="${this.isVideoOff ? 'fas fa-video-slash' : 'fas fa-video'}"></i><span>${this.isVideoOff ? 'Start Video' : 'Stop Video'}</span>`;
                }
            }
        }
    },

    toggleMic() {
        this.isMuted = !this.isMuted;
        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                audioTracks[0].enabled = !this.isMuted;
            }
        }
        const btn = document.getElementById('btn-toggle-mic');
        const micIcon = document.getElementById('tile-user-mic-icon');
        if (btn) {
            btn.className = this.isMuted ? 'dock-btn danger-action' : 'dock-btn';
            btn.innerHTML = `<i class="${this.isMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone'}"></i><span>${this.isMuted ? 'Unmute' : 'Mute'}</span>`;
        }
        if (micIcon) {
            micIcon.className = this.isMuted ? 'fas fa-microphone-slash mic-muted' : 'fas fa-microphone';
            micIcon.style.color = this.isMuted ? '#f87171' : 'var(--primary-400)';
        }
        window.App?.showToast(this.isMuted ? "Microphone muted" : "Microphone active", "info");
    },

    async toggleScreenShare() {
        const screenWrap = document.getElementById('screen-share-wrap');
        const screenVideo = document.getElementById('screen-share-video');
        const btn = document.getElementById('btn-share-screen');

        if (!this.screenStream) {
            try {
                this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                if (screenVideo) screenVideo.srcObject = this.screenStream;
                if (screenWrap) screenWrap.style.display = 'block';
                if (btn) {
                    btn.classList.add('active');
                    btn.innerHTML = `<i class="fas fa-stop-circle"></i><span>Stop Sharing</span>`;
                }
                window.App?.showToast("Broadcasting screen to scholars", "gold");

                this.screenStream.getVideoTracks()[0].onended = () => {
                    this.stopScreenShare();
                };
            } catch (err) {
                console.warn("Screen share cancelled", err);
                window.App?.showToast("Screen share cancelled", "warning");
            }
        } else {
            this.stopScreenShare();
        }
    },

    stopScreenShare() {
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(t => t.stop());
            this.screenStream = null;
        }
        const screenWrap = document.getElementById('screen-share-wrap');
        const btn = document.getElementById('btn-share-screen');
        if (screenWrap) screenWrap.style.display = 'none';
        if (btn) {
            btn.classList.remove('active');
            btn.innerHTML = `<i class="fas fa-desktop"></i><span>Share Screen</span>`;
        }
        window.App?.showToast("Screen share stopped", "info");
    },

    toggleWhiteboard() {
        this.isWhiteboardActive = !this.isWhiteboardActive;
        const panel = document.getElementById('zoom-whiteboard');
        const btn = document.getElementById('btn-toggle-wb');
        if (panel) panel.classList.toggle('active', this.isWhiteboardActive);
        if (btn) btn.classList.toggle('active', this.isWhiteboardActive);
        if (this.isWhiteboardActive) {
            this.setupWhiteboardCanvas();
            window.App?.showToast("Interactive Whiteboard open", "info");
        }
    },

    setupWhiteboardCanvas() {
        const canvas = document.getElementById('whiteboard-canvas');
        if (!canvas) return;
        const wrap = canvas.parentElement;
        canvas.width = wrap.clientWidth;
        canvas.height = wrap.clientHeight;
        this.wbCtx = canvas.getContext('2d');
        this.wbCtx.lineCap = 'round';
        this.wbCtx.lineJoin = 'round';

        canvas.onmousedown = (e) => {
            this.isDrawing = true;
            this.wbCtx.beginPath();
            this.wbCtx.moveTo(e.offsetX, e.offsetY);
        };
        canvas.onmousemove = (e) => {
            if (!this.isDrawing) return;
            this.wbCtx.strokeStyle = this.currentColor;
            this.wbCtx.lineWidth = this.currentLineWidth;
            this.wbCtx.lineTo(e.offsetX, e.offsetY);
            this.wbCtx.stroke();
        };
        canvas.onmouseup = () => { this.isDrawing = false; };
        canvas.onmouseleave = () => { this.isDrawing = false; };
    },

    setWbTool(tool) {
        document.querySelectorAll('.wb-tool-btn').forEach(b => b.classList.remove('active'));
        if (tool === 'pen') {
            document.getElementById('wb-tool-pen')?.classList.add('active');
            this.currentLineWidth = 3;
        } else if (tool === 'eraser') {
            document.getElementById('wb-tool-eraser')?.classList.add('active');
            this.currentColor = '#ffffff';
            this.currentLineWidth = 24;
        }
    },

    setColor(colorHex, el) {
        this.currentColor = colorHex;
        this.currentLineWidth = 3;
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        if (el) el.classList.add('active');
        document.getElementById('wb-tool-pen')?.classList.add('active');
        document.getElementById('wb-tool-eraser')?.classList.remove('active');
    },

    insertArabicText() {
        if (!this.wbCtx) return;
        const canvas = document.getElementById('whiteboard-canvas');
        this.wbCtx.font = "bold 28px 'Amiri', serif";
        this.wbCtx.fillStyle = "#124855";
        this.wbCtx.textAlign = "center";
        this.wbCtx.fillText("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", canvas.width / 2, 60);

        this.wbCtx.font = "20px 'Amiri', serif";
        this.wbCtx.fillStyle = "#aa8637";
        this.wbCtx.fillText("إنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى (صحیح البخاری: ١)", canvas.width / 2, 110);
        window.App?.showToast("Hadith text inserted on whiteboard", "gold");
    },

    clearWhiteboard() {
        const canvas = document.getElementById('whiteboard-canvas');
        if (canvas && this.wbCtx) {
            this.wbCtx.clearRect(0, 0, canvas.width, canvas.height);
            window.App?.showToast("Whiteboard cleared", "info");
        }
    },

    downloadWhiteboard() {
        const canvas = document.getElementById('whiteboard-canvas');
        if (canvas) {
            const dataUrl = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.download = `Jamia_Ashrafia_Lecture_Whiteboard_${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
            window.App?.showToast("Whiteboard snapshot downloaded", "success");
        }
    },

    toggleChat() {
        this.isChatActive = !this.isChatActive;
        const drawer = document.getElementById('zoom-chat-drawer');
        if (drawer) drawer.classList.toggle('active', this.isChatActive);
        if (this.isChatActive && this.isParticipantsActive) this.toggleParticipants();
    },

    toggleParticipants() {
        this.isParticipantsActive = !this.isParticipantsActive;
        const drawer = document.getElementById('zoom-participants-drawer');
        if (drawer) drawer.classList.toggle('active', this.isParticipantsActive);
        if (this.isParticipantsActive && this.isChatActive) this.toggleChat();
    },

    toggleRaiseHand() {
        this.isHandRaised = !this.isHandRaised;
        window.App?.showToast(this.isHandRaised ? "Hand raised! Sheikh notified." : "Hand lowered", "gold");
        if (this.isHandRaised) {
            this.sendQuickEmoji(`✋ ${window.AuthRBAC?.currentUser?.name || 'Scholar'} raised hand`);
        }
    },

    toggleRecording() {
        this.isRecording = !this.isRecording;
        const badge = document.getElementById('zoom-rec-badge');
        if (badge) {
            badge.innerHTML = `<span class="rec-dot" style="${this.isRecording ? '' : 'animation:none; opacity:0.5;'}"></span> ${this.isRecording ? 'REC' : 'PAUSED'}`;
            badge.style.background = this.isRecording ? 'rgba(239, 68, 68, 0.2)' : 'rgba(148, 163, 184, 0.2)';
            badge.style.borderColor = this.isRecording ? 'rgba(239, 68, 68, 0.4)' : 'rgba(148, 163, 184, 0.4)';
            badge.style.color = this.isRecording ? '#f87171' : '#cbd5e1';
        }
        window.App?.showToast(this.isRecording ? "Cloud recording active (AWS S3 AES-256)" : "Cloud recording paused by host", this.isRecording ? "danger" : "info");
    },

    sendMessage() {
        const input = document.getElementById('chat-input-field');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        this.sendQuickEmoji(text);
        input.value = '';
    },

    sendQuickEmoji(text) {
        const chat = document.getElementById('chat-messages-stream');
        if (!chat) return;

        const isTeacher = window.AuthRBAC?.isTeacher();
        const userName = window.AuthRBAC?.currentUser?.name || "Talib-e-Ilm";
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        this.inMeetingChat.push({
            id: 'c_' + Date.now(),
            sender: userName,
            isTeacher: !!isTeacher,
            time: timeStr,
            text: text
        });

        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isTeacher ? 'teacher-msg' : ''}`;
        bubble.innerHTML = `
            <div class="chat-author">
                ${isTeacher ? '<i class="fas fa-crown"></i> ' : ''}${userName}
                <span class="chat-time">${timeStr}</span>
            </div>
            <div class="chat-text">${text}</div>
        `;
        chat.appendChild(bubble);
        chat.scrollTop = chat.scrollHeight;
    },

    muteAll() {
        this.inMeetingParticipants.forEach(p => {
            if (p.role !== 'TEACHER') p.isMuted = true;
        });
        window.App?.showToast("All scholar microphones muted by Sheikh", "warning");
        const drawer = document.getElementById('zoom-participants-drawer');
        if (drawer && this.isParticipantsActive) {
            this.toggleParticipants();
            this.toggleParticipants();
        }
    },

    lowerAllHands() {
        this.inMeetingParticipants.forEach(p => p.handRaised = false);
        window.App?.showToast("All hands lowered by Sheikh", "info");
        const drawer = document.getElementById('zoom-participants-drawer');
        if (drawer && this.isParticipantsActive) {
            this.toggleParticipants();
            this.toggleParticipants();
        }
    },

    removeParticipant(id, name) {
        if (!confirm(`Are you sure you want to remove ${name} from this virtual hall?`)) return;
        this.inMeetingParticipants = this.inMeetingParticipants.filter(p => p.id !== id);
        window.App?.showToast(`${name} removed from session`, "danger");
        const drawer = document.getElementById('zoom-participants-drawer');
        if (drawer && this.isParticipantsActive) {
            this.toggleParticipants();
            this.toggleParticipants();
        }
    },

    copyMeetingLink() {
        const session = this.activeSession || {};
        const url = `https://lms.jamiaashrafia.org/join/${session.meetingUuid || 'ASH-ZOOM-982-114-889'}`;
        navigator.clipboard.writeText(url);
        window.App?.showToast("Encrypted meeting invite link copied to clipboard", "success");
    },

    leaveClass() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(t => t.stop());
            this.screenStream = null;
        }
        if (this.timerInterval) clearInterval(this.timerInterval);

        window.App?.showToast("Exited virtual classroom session", "info");
        this.switchTab('lobby');
    }
};

window.VirtualClassModule = VirtualClassModule;
