/**
 * JAMIA ASHRAFIA LAHORE - VIRTUAL CLASSROOM (ZOOM-LIKE SUITE)
 * WebRTC Media, Camera Stream, Screen Sharing, Interactive Canvas Whiteboard, Chat & Host Controls
 */

const VirtualClassModule = {
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
    currentColor: "#064e3b",
    currentLineWidth: 3,

    render() {
        const session = window.LmsData.virtualClasses[0];
        const isHost = window.AuthRBAC.isTeacher() || window.AuthRBAC.isAdmin();

        return `
            <div class="view-header" style="margin-bottom: 16px;">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-video" style="color: var(--danger);"></i>
                        Virtual Classroom: Zoom-Like Live Dars
                        <span class="status-pill danger" style="animation: pulse 2s infinite;"><i class="fas fa-circle"></i> Live Now</span>
                    </h1>
                    <p>Interactive video conferencing, screen sharing, and sacred Hadith discourse</p>
                </div>
                <div class="view-actions">
                    <span class="status-pill gold" style="font-family: monospace; font-size: 0.85rem;">
                        Meeting ID: ${session.meetingUuid}
                    </span>
                    <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.copyMeetingLink()">
                        <i class="fas fa-copy"></i> Copy Invite Link
                    </button>
                </div>
            </div>

            <!-- ZOOM CONFERENCE ROOM MAIN CONTAINER -->
            <div class="zoom-container" id="zoom-meeting-room">
                <!-- TOP BAR -->
                <div class="zoom-topbar">
                    <div class="zoom-room-info">
                        <div class="zoom-rec-indicator">
                            <span class="rec-dot"></span> REC
                        </div>
                        <div class="zoom-room-title">
                            <span>${session.title}</span>
                            <span style="font-family: 'Amiri', serif; color: var(--gold-200); font-size: 1.05rem;">(${session.urduTitle})</span>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div class="zoom-security-badge">
                            <i class="fas fa-shield-check"></i> 256-bit Encrypted
                        </div>
                        <div class="zoom-timer" id="zoom-elapsed-timer">00:42:15</div>
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
                                    <div style="font-weight: 700; color: #ffffff; font-size: 0.95rem;">Qari Arshad Ubaid</div>
                                    <div style="font-family: 'Amiri', serif; color: var(--gold-300);">شیخ الحدیث جامعہ اشرفیہ</div>
                                </div>
                                <div class="tile-participant-label">
                                    <div class="audio-waves"><span></span><span></span><span></span></div>
                                    <span>Qari Arshad Ubaid (Sheikh-ul-Hadith)</span>
                                </div>
                            </div>

                            <!-- TILE 2: USER'S LIVE WEBCAM / AVATAR TILE -->
                            <div class="video-tile" id="tile-user">
                                <video id="local-webcam-video" autoplay playsinline muted style="display: none;"></video>
                                <div class="video-avatar-fallback" id="local-avatar-fallback">
                                    <div class="avatar-circle">
                                        ${window.AuthRBAC.currentUser?.avatar || 'TU'}
                                    </div>
                                    <div style="font-weight: 600; color: #ffffff;">${window.AuthRBAC.currentUser?.name || 'Talib-e-Ilm'}</div>
                                    <div style="font-size: 0.72rem; color: var(--gold-300);">${window.AuthRBAC.currentUser?.rollNo || 'Faculty'}</div>
                                </div>
                                <div class="tile-participant-label">
                                    <i class="fas fa-microphone" id="tile-user-mic-icon" style="color: var(--primary-400);"></i>
                                    <span>${window.AuthRBAC.currentUser?.name || 'You'} (Self)</span>
                                </div>
                            </div>

                            <!-- TILE 3: STUDENT 2 (HAFIZ USMAN) -->
                            <div class="video-tile">
                                <div class="video-avatar-fallback">
                                    <div class="avatar-circle">UT</div>
                                    <div style="font-weight: 600; color: #ffffff;">Hafiz Usman Tariq</div>
                                    <div style="font-size: 0.72rem; color: var(--text-muted);">ASH-2024-042</div>
                                </div>
                                <div class="tile-participant-label">
                                    <i class="fas fa-microphone-slash mic-muted"></i>
                                    <span>Hafiz Usman Tariq</span>
                                </div>
                            </div>

                            <!-- TILE 4: STUDENT 3 (AHMAD RAZA) -->
                            <div class="video-tile">
                                <div class="video-avatar-fallback">
                                    <div class="avatar-circle">AR</div>
                                    <div style="font-weight: 600; color: #ffffff;">Ahmad Raza Siddiqui</div>
                                    <div style="font-size: 0.72rem; color: var(--text-muted);">ASH-2024-089</div>
                                </div>
                                <div class="tile-participant-label">
                                    <i class="fas fa-microphone-slash mic-muted"></i>
                                    <span>Ahmad Raza Siddiqui</span>
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
                                    <div class="color-dot active" style="background: #064e3b;" onclick="VirtualClassModule.setColor('#064e3b', this)"></div>
                                    <div class="color-dot" style="background: #d97706;" onclick="VirtualClassModule.setColor('#d97706', this)"></div>
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
                            <span class="drawer-title"><i class="fas fa-comments"></i> In-Meeting Chat</span>
                            <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.toggleChat()"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="drawer-content" id="chat-messages-stream">
                            <div class="chat-bubble teacher-msg">
                                <div class="chat-author">
                                    <i class="fas fa-crown"></i> Qari Arshad Ubaid (Sheikh)
                                    <span class="chat-time">11:02 AM</span>
                                </div>
                                <div class="chat-text">
                                    السلام عليكم ورحمة الله. Open Sahih al-Bukhari to Chapter 1, Hadith 1. Today we examine the Isnad from Al-Humaydi.
                                </div>
                            </div>
                            <div class="chat-bubble">
                                <div class="chat-author">
                                    Muhammad Talha
                                    <span class="chat-time">11:05 AM</span>
                                </div>
                                <div class="chat-text">وعليكم السلام يا شيخنا. Kitab is open on Page 12.</div>
                            </div>
                        </div>
                        <div class="quick-emojis">
                            <button class="emoji-btn" onclick="VirtualClassModule.sendQuickEmoji('سبحان الله')">سبحان الله</button>
                            <button class="emoji-btn" onclick="VirtualClassModule.sendQuickEmoji('ما شاء الله')">ما شاء الله</button>
                            <button class="emoji-btn" onclick="VirtualClassModule.sendQuickEmoji('جزاك الله خيراً')">جزاك الله</button>
                            <button class="emoji-btn" onclick="VirtualClassModule.sendQuickEmoji('✋')">✋</button>
                        </div>
                        <div class="chat-input-bar">
                            <input type="text" id="chat-input-field" placeholder="Type question to Sheikh..." onkeypress="if(event.key==='Enter') VirtualClassModule.sendMessage()">
                            <button class="btn btn-gold btn-sm" onclick="VirtualClassModule.sendMessage()"><i class="fas fa-paper-plane"></i></button>
                        </div>
                    </div>

                    <!-- PARTICIPANTS DRAWER -->
                    <div class="zoom-side-drawer" id="zoom-participants-drawer">
                        <div class="drawer-header">
                            <span class="drawer-title"><i class="fas fa-users"></i> Scholars in Hall (42)</span>
                            <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.toggleParticipants()"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="drawer-content">
                            ${isHost ? `
                                <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                                    <button class="btn btn-danger btn-sm" style="flex: 1;" onclick="VirtualClassModule.muteAll()">
                                        <i class="fas fa-microphone-slash"></i> Mute All
                                    </button>
                                    <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="window.App.showToast('All hands lowered', 'info')">
                                        <i class="fas fa-hand-paper"></i> Lower Hands
                                    </button>
                                </div>
                            ` : ''}
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--bg-surface-elevated); border-radius: 4px;">
                                    <div>
                                        <div style="font-weight: 700; color: var(--gold-300); font-size: 0.85rem;">Qari Arshad Ubaid (Host)</div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted);">Sheikh-ul-Hadith</div>
                                    </div>
                                    <i class="fas fa-microphone" style="color: var(--primary-400);"></i>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--bg-surface-elevated); border-radius: 4px;">
                                    <div>
                                        <div style="font-weight: 600; font-size: 0.85rem; color: #ffffff;">${window.AuthRBAC.currentUser?.name} (Me)</div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted);">${window.AuthRBAC.currentUser?.role}</div>
                                    </div>
                                    <i class="fas fa-microphone" style="color: var(--primary-400);"></i>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--bg-surface-elevated); border-radius: 4px;">
                                    <div>
                                        <div style="font-weight: 600; font-size: 0.85rem; color: #ffffff;">Hafiz Usman Tariq</div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted);">ASH-2024-042</div>
                                    </div>
                                    <i class="fas fa-microphone-slash" style="color: #f87171;"></i>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--bg-surface-elevated); border-radius: 4px;">
                                    <div>
                                        <div style="font-weight: 600; font-size: 0.85rem; color: #ffffff;">Ahmad Raza Siddiqui</div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted);">ASH-2024-089</div>
                                    </div>
                                    <i class="fas fa-microphone-slash" style="color: #f87171;"></i>
                                </div>
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
                            <span>Scholars (42)</span>
                        </button>
                        <button class="dock-btn ${this.isChatActive ? 'active' : ''}" onclick="VirtualClassModule.toggleChat()">
                            <i class="fas fa-comment-alt"></i>
                            <span>Chat</span>
                        </button>
                        <button class="dock-btn ${this.isHandRaised ? 'active' : ''}" onclick="VirtualClassModule.toggleRaiseHand()">
                            <i class="fas fa-hand-paper"></i>
                            <span>${this.isHandRaised ? 'Lower Hand' : 'Raise Hand'}</span>
                        </button>
                    </div>

                    <!-- Right: End / Leave Session -->
                    <div class="dock-group">
                        <button class="dock-btn end-meeting" onclick="VirtualClassModule.leaveClass()">
                            <i class="fas fa-phone-slash"></i>
                            <span>${isHost ? 'End Class' : 'Leave Class'}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    initAfterRender() {
        this.startTimer();
        this.setupWhiteboardCanvas();
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
                btn.className = 'dock-btn';
                btn.innerHTML = `<i class="fas fa-video"></i><span>Stop Video</span>`;
                window.App.showToast("Webcam feed active in live lecture", "success");
            } catch (err) {
                console.warn("Camera access denied or unavailable; toggling simulated video state", err);
                this.isVideoOff = !this.isVideoOff;
                btn.className = this.isVideoOff ? 'dock-btn danger-action' : 'dock-btn';
                btn.innerHTML = `<i class="${this.isVideoOff ? 'fas fa-video-slash' : 'fas fa-video'}"></i><span>${this.isVideoOff ? 'Start Video' : 'Stop Video'}</span>`;
                window.App.showToast(this.isVideoOff ? "Video muted" : "Video camera active", "info");
            }
        } else {
            const videoTracks = this.localStream.getVideoTracks();
            if (videoTracks.length > 0) {
                this.isVideoOff = !this.isVideoOff;
                videoTracks[0].enabled = !this.isVideoOff;
                if (videoEl) videoEl.style.display = this.isVideoOff ? 'none' : 'block';
                if (fallback) fallback.style.display = this.isVideoOff ? 'flex' : 'none';
                btn.className = this.isVideoOff ? 'dock-btn danger-action' : 'dock-btn';
                btn.innerHTML = `<i class="${this.isVideoOff ? 'fas fa-video-slash' : 'fas fa-video'}"></i><span>${this.isVideoOff ? 'Start Video' : 'Stop Video'}</span>`;
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
        window.App.showToast(this.isMuted ? "Microphone muted" : "Microphone active", "info");
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
                btn.classList.add('active');
                btn.innerHTML = `<i class="fas fa-stop-circle"></i><span>Stop Sharing</span>`;
                window.App.showToast("Broadcasting screen to scholars", "gold");

                this.screenStream.getVideoTracks()[0].onended = () => {
                    this.stopScreenShare();
                };
            } catch (err) {
                console.warn("Screen share cancelled", err);
                window.App.showToast("Screen share cancelled", "warning");
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
        window.App.showToast("Screen share stopped", "info");
    },

    toggleWhiteboard() {
        this.isWhiteboardActive = !this.isWhiteboardActive;
        const panel = document.getElementById('zoom-whiteboard');
        const btn = document.getElementById('btn-toggle-wb');
        if (panel) panel.classList.toggle('active', this.isWhiteboardActive);
        if (btn) btn.classList.toggle('active', this.isWhiteboardActive);
        if (this.isWhiteboardActive) {
            this.setupWhiteboardCanvas();
            window.App.showToast("Interactive Whiteboard open", "info");
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

        // Mouse events
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
            document.getElementById('wb-tool-pen').classList.add('active');
            this.currentLineWidth = 3;
        } else if (tool === 'eraser') {
            document.getElementById('wb-tool-eraser').classList.add('active');
            this.currentColor = '#ffffff';
            this.currentLineWidth = 24;
        }
    },

    setColor(colorHex, el) {
        this.currentColor = colorHex;
        this.currentLineWidth = 3;
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        if (el) el.classList.add('active');
        document.getElementById('wb-tool-pen').classList.add('active');
        document.getElementById('wb-tool-eraser').classList.remove('active');
    },

    insertArabicText() {
        if (!this.wbCtx) return;
        const canvas = document.getElementById('whiteboard-canvas');
        this.wbCtx.font = "bold 28px 'Amiri', serif";
        this.wbCtx.fillStyle = "#064e3b";
        this.wbCtx.textAlign = "center";
        this.wbCtx.fillText("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", canvas.width / 2, 60);

        this.wbCtx.font = "20px 'Amiri', serif";
        this.wbCtx.fillStyle = "#b45309";
        this.wbCtx.fillText("إنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى (صحيح البخاري: ١)", canvas.width / 2, 110);
        window.App.showToast("Hadith text inserted on whiteboard", "gold");
    },

    clearWhiteboard() {
        const canvas = document.getElementById('whiteboard-canvas');
        if (canvas && this.wbCtx) {
            this.wbCtx.clearRect(0, 0, canvas.width, canvas.height);
            window.App.showToast("Whiteboard cleared", "info");
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
            window.App.showToast("Whiteboard snapshot downloaded", "success");
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
        window.App.showToast(this.isHandRaised ? "Hand raised! Sheikh notified." : "Hand lowered", "gold");
        const chat = document.getElementById('chat-messages-stream');
        if (chat && this.isHandRaised) {
            chat.innerHTML += `
                <div class="chat-bubble" style="border-left: 3px solid var(--gold-400);">
                    <div class="chat-author" style="color: var(--gold-300);">
                        ✋ ${window.AuthRBAC.currentUser?.name} raised hand
                    </div>
                </div>
            `;
            chat.scrollTop = chat.scrollHeight;
        }
        window.App.navigate('virtual-class');
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

        const isTeacher = window.AuthRBAC.isTeacher();
        const userName = window.AuthRBAC.currentUser?.name || "Talib-e-Ilm";

        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isTeacher ? 'teacher-msg' : ''}`;
        bubble.innerHTML = `
            <div class="chat-author">
                ${isTeacher ? '<i class="fas fa-crown"></i> ' : ''}${userName}
                <span class="chat-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="chat-text">${text}</div>
        `;
        chat.appendChild(bubble);
        chat.scrollTop = chat.scrollHeight;
    },

    muteAll() {
        window.App.showToast("All scholar microphones muted by Sheikh", "warning");
    },

    copyMeetingLink() {
        navigator.clipboard.writeText("https://lms.jamiaashrafia.org/join/ASH-ZOOM-982-114-889");
        window.App.showToast("Meeting link copied to clipboard", "success");
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
        window.App.showToast("Exited virtual classroom session", "info");
        window.App.navigate('dashboard');
    }
};

window.VirtualClassModule = VirtualClassModule;
