/**
 * JAMIA ASHRAFIA LAHORE - LIVE CLASS TAB (live.html?session=<id>)
 * Every live class opens in its own browser tab: the meeting fills the tab, with a slim bar for the class name,
 * the host's Start / Stop Recording and End Class, and Leave. Sign-in, the access check, attendance, the meeting
 * token and recording all work as in the portal (js/modules/virtual-class.js runs here too, without the portal
 * around it). On the public meet.jit.si service, or for a class on Zoom / Meet / Teams, the tab goes straight there.
 *
 * The host of a public meeting uses this tab too (live.html?publicMeeting=<id>; guests use meet.html): recording
 * works as for a class, and the tab tells the server and the portal's lobby when the meeting ends.
 *
 * The bar also holds the Meeting Settings (host) and Record to Computer / Ask to Record (js/meeting-controls.js),
 * and, under it, the participants asking the host to record (#mc-requests).
 */

// What the portal's scripts expect from the page around them (js/app.js is not loaded here)
const App = {
    currentRoute: 'live-room',
    navigate() {},
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
        const icon = { success: 'fa-check-circle', error: 'fa-exclamation-circle', danger: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle' }[type] || 'fa-info-circle';
        toast.innerHTML = `<i class="fas ${icon}" style="font-size: 1.1rem;"></i> <span></span>`;
        toast.querySelector('span').textContent = String(message === undefined || message === null ? '' : message);
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },
    dashEmpty(text) {
        return `<div style="padding: 20px; text-align: center;">${Lms.esc(text)}</div>`;
    }
};
window.App = App;

const LiveRoom = {
    sessionId: new URLSearchParams(location.search).get('session') || '',
    // A plain meeting link (meet.<domain>/<room>) opened without the portal: the meeting server sends it here
    room: new URLSearchParams(location.search).get('room') || '',
    publicMeetingId: new URLSearchParams(location.search).get('publicMeeting') || '',

    message(icon, title, text, buttons = '') {
        const box = document.getElementById('jitsi-container');
        box.innerHTML = `
            <div class="live-message">
                <i class="fas ${icon}" style="font-size: 2.4rem; color: var(--gold-400, #fbbf24);"></i>
                <h2>${Lms.esc(I18n.t(title))}</h2>
                <p>${Lms.esc(I18n.t(text))}</p>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">${buttons}</div>
            </div>`;
        document.getElementById('live-actions').innerHTML = '';
    },

    // Signing in from this tab comes back to this class (login.html reads it; the tab's own storage)
    rememberForLogin() {
        try { sessionStorage.setItem('JAMIA_AFTER_LOGIN', `live.html${location.search}`); } catch (e) { /* storage blocked */ }
    },

    forgetForLogin() {
        try { sessionStorage.removeItem('JAMIA_AFTER_LOGIN'); } catch (e) { /* storage blocked */ }
    },

    // Signed out (e.g. a student opening a shared class link): a small sign-in box in this tab, then straight into the class
    async signedIn() {
        let data = null;
        try {
            const res = await fetch('/api/auth/me', { cache: 'no-store' });
            data = res.ok ? await res.json().catch(() => null) : (res.status === 401 ? {} : null);
        } catch (e) { /* offline: verifySession reports it */ }
        if (!data || data.user) return true;
        localStorage.removeItem('JAMIA_CURRENT_USER_ID');
        return new Promise(resolve => this.showSignIn(resolve));
    },

    showSignIn(done) {
        const box = document.getElementById('jitsi-container');
        box.innerHTML = `
            <form class="live-signin" id="live-signin-form" autocomplete="on">
                <div class="live-signin-head">
                    <img src="assets/images/crest.png" alt="">
                    <h2>${Lms.esc(I18n.t('Sign in to join the class'))}</h2>
                    <p>${Lms.esc(I18n.t('Use your portal ID and password. Only students of this class can join.'))}</p>
                </div>
                <label for="live-signin-id">${Lms.esc(I18n.t('ID'))}</label>
                <input type="text" id="live-signin-id" class="form-control" autocomplete="username" required placeholder="${Lms.esc(I18n.t('Roll No, Email or Teacher ID'))}">
                <label for="live-signin-password">${Lms.esc(I18n.t('Password'))}</label>
                <input type="password" id="live-signin-password" class="form-control" autocomplete="current-password" required>
                <div class="live-signin-error" id="live-signin-error"></div>
                <button type="submit" class="btn btn-primary" id="live-signin-btn"><i class="fas fa-sign-in-alt"></i> ${Lms.esc(I18n.t('Sign in and join'))}</button>
            </form>`;
        document.getElementById('live-actions').innerHTML = '';
        document.getElementById('live-signin-id').focus();
        const error = text => {
            const el = document.getElementById('live-signin-error');
            el.textContent = I18n.t(text);
            el.style.display = text ? 'block' : 'none';
        };
        document.getElementById('live-signin-form').addEventListener('submit', async e => {
            e.preventDefault();
            const btn = document.getElementById('live-signin-btn');
            const pwd = document.getElementById('live-signin-password');
            btn.disabled = true;
            error('');
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier: document.getElementById('live-signin-id').value.trim(), password: pwd.value })
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.success && data.user) {
                    if (data.language) I18n.remember(data.language);
                    // A temporary password is changed on the login page first, which then comes back to this class
                    if (data.mustChangePassword) {
                        this.rememberForLogin();
                        location.replace('login.html#change-password');
                        return;
                    }
                    // As login.html: start from a clean copy, nothing cached for a previous user of this browser stays
                    window.DataStore.clearLocal();
                    const list = window.LmsData.users = (window.LmsData.users || []).filter(u => u.id !== data.user.id);
                    list.push(data.user);
                    window.DataStore.save(window.LmsData);
                    localStorage.setItem('JAMIA_CURRENT_USER_ID', data.user.id);
                    box.innerHTML = `<div style="text-align: center;"><i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i><div style="margin-top: 10px;">${Lms.esc(I18n.t('Joining the class...'))}</div></div>`;
                    done(true);
                    return;
                }
                error(data.error || 'Sign-in failed. Please check your ID and password.');
            } catch (err) {
                error('The portal server cannot be reached. Please check your connection and try again.');
            }
            btn.disabled = false;
            pwd.value = '';
            pwd.focus();
        });
    },

    closeButton() {
        return `<button class="btn btn-secondary" onclick="LiveRoom.closeTab()"><i class="fas fa-times"></i> ${I18n.t('Close this tab')}</button>`;
    },

    // A tab the portal opened can close itself; otherwise go back to the portal
    closeTab() {
        window.close();
        setTimeout(() => { location.href = 'index.html#virtual-class'; }, 200);
    },

    // The access check, retried briefly: a class launched a moment ago may still be on its way to the server
    async verify() {
        for (let attempt = 0; attempt < 8; attempt++) {
            const res = await fetch('/api/virtual-class/verify-access', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.sessionId ? { sessionId: this.sessionId } : { room: this.room }), cache: 'no-store'
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.authorized) {
                // From here on the tab is this class's own tab
                if (!this.sessionId && data.session?.id) {
                    this.sessionId = data.session.id;
                    history.replaceState(null, '', `live.html?session=${encodeURIComponent(this.sessionId)}`);
                }
                return { ok: true, session: data.session, isHost: !!data.isHost };
            }
            if (res.status !== 404 || !this.sessionId) return { ok: false, message: data.message || data.error || 'You cannot join this class.' };
            await new Promise(r => setTimeout(r, 2000));
        }
        return { ok: false, message: 'This online class could not be found. It may have been removed.' };
    },

    renderBar() {
        const vc = VirtualClassModule;
        const session = vc.activeSession;
        const live = session.status === 'LIVE' || session.isLive;
        document.title = `${session.title || 'Live Class'} - Jamia Ashrafia Lahore`;
        document.getElementById('live-title').textContent = session.title || I18n.t('Live Class');
        document.getElementById('live-subtitle').textContent = [session.className || Lms.className(session.classId), vc.isHost ? I18n.t('You are the host') : ''].filter(Boolean).join(' • ');
        document.getElementById('live-actions').innerHTML = `
            ${live ? '<span class="status-pill danger"><i class="fas fa-circle"></i> LIVE</span>' : ''}
            <span id="mc-tools" class="mc-tools"></span>
            ${vc.canRecord(session) ? `<span id="vc-rec-controls" style="display: inline-flex; gap: 8px; align-items: center;">${vc.recordingControlsHtml()}</span>` : ''}
            ${vc.isHost && live ? `<button class="btn btn-danger btn-sm" onclick="VirtualClassModule.endSession('${Lms.esc(session.id)}')"><i class="fas fa-stop-circle"></i> ${I18n.t('End Class for Everyone')}</button>` : ''}
            <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.leaveClass()"><i class="fas fa-sign-out-alt"></i> ${I18n.t('Leave')}</button>`;
        if (window.MeetingControls && MeetingControls.current) MeetingControls.current.render();
    },

    // -------------------------------------------------------------------------
    // The host's tab of a public meeting
    // -------------------------------------------------------------------------
    publicMeeting: null, // { others: ids of the other people inside, joined, closing: null | 'leave' | 'end' }

    async startPublicMeeting() {
        const vc = VirtualClassModule;
        let data;
        try {
            data = await Lms.api('POST', `/api/public-meetings/${encodeURIComponent(this.publicMeetingId)}/host`);
        } catch (e) {
            vc.tellPublicMeetingTabs('changed', this.publicMeetingId);
            this.message('fa-door-closed', 'This meeting cannot be opened', e.message, this.closeButton());
            return;
        }
        await vc.loadMeetingConfig();
        const m = data.meeting;
        // The fields a class has that the room code uses, so recording and the meeting itself run as for a class
        const session = { id: m.id, title: m.title, link: m.link, status: 'LIVE', isLive: true, publicMeeting: true, join: data.join };
        Object.assign(vc, { activeSessionId: session.id, activeSession: session, accessBlocked: false, isHost: true, currentTab: 'studio' });
        // A service that cannot be embedded (public meet.jit.si): the tab goes straight to it
        if (!vc.canEmbed()) {
            location.replace(vc.publicMeetingUrl(data.join, m.title));
            return;
        }
        this.publicMeeting = { others: new Set(), joined: false, closing: null };
        this.renderPublicBar();
        this.followPublicMeeting();
        await vc.mountMeeting();
    },

    renderPublicBar() {
        const vc = VirtualClassModule;
        const session = vc.activeSession;
        document.title = `${session.title} - Jamia Ashrafia Lahore`;
        document.getElementById('live-title').textContent = session.title;
        document.getElementById('live-subtitle').textContent = 'Public meeting • You are the host';
        document.getElementById('live-actions').innerHTML = `
            <span class="status-pill danger"><i class="fas fa-circle"></i> LIVE</span>
            <span id="mc-tools" class="mc-tools"></span>
            ${vc.canRecord(session) ? `<span id="vc-rec-controls" style="display: inline-flex; gap: 8px; align-items: center;">${vc.recordingControlsHtml()}</span>` : ''}
            <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.copyMeetingLink()"><i class="fas fa-link"></i> Copy Link</button>
            <button class="btn btn-danger btn-sm" onclick="LiveRoom.endPublicMeeting(true)"><i class="fas fa-stop-circle"></i> End Meeting for Everyone</button>
            <button class="btn btn-secondary btn-sm" onclick="LiveRoom.leavePublicMeeting()"><i class="fas fa-sign-out-alt"></i> Leave</button>`;
        if (window.MeetingControls && MeetingControls.current) MeetingControls.current.render();
    },

    // Called by VirtualClassModule.mountMeeting with the meeting it opened
    watchPublicMeeting(api) {
        const vc = VirtualClassModule;
        const pm = this.publicMeeting;
        api.addListener('videoConferenceJoined', () => { pm.joined = true; });
        api.addListener('participantJoined', e => pm.others.add(e.id));
        api.addListener('participantLeft', e => pm.others.delete(e.id));
        api.addListener('recordingStatusChanged', e => vc.onRecordingStatus(e));
        api.addListener('toolbarButtonClicked', e => {
            if (!e) return;
            if (e.key === 'recording') vc.recording ? vc.stopRecording() : vc.startRecording();
            if (e.key === 'hangup') this.leavePublicMeeting();
            if (e.key === 'end-meeting') this.endPublicMeeting(false);
        });
        // Removed by another host: this person is out, the meeting goes on
        api.addListener('participantKickedOut', e => {
            if (e && e.kicked && e.kicked.local) pm.closing = pm.closing || 'leave';
        });
        api.addListener('readyToClose', () => this.publicMeetingClosed());
    },

    // Who is inside, just before this person goes (the meeting reports everyone as gone once they have left)
    alonePublicMeeting() {
        const pm = this.publicMeeting;
        return !!pm && pm.joined && pm.others.size === 0;
    },

    // Waits for the meeting to confirm; a command the meeting no longer answers must not leave the tab stuck
    awaitPublicMeetingClose() {
        clearTimeout(this._publicCloseTimer);
        this._publicCloseTimer = setTimeout(() => this.publicMeetingClosed(), 4000);
    },

    /** Leave (the bar's button or the meeting's own): with nobody else inside, the meeting is over. */
    async leavePublicMeeting() {
        const pm = this.publicMeeting;
        const vc = VirtualClassModule;
        if (!pm || pm.closing) return;
        if (this.alonePublicMeeting()) {
            await this.endPublicMeeting(false);
            return;
        }
        pm.closing = 'leave';
        if (vc.recording) await vc.stopRecording();
        if (vc.jitsiApi) {
            try { vc.jitsiApi.executeCommand('hangup'); } catch (e) { /* the meeting already closed */ }
        }
        this.awaitPublicMeetingClose();
    },

    /** End Meeting for Everyone (the bar's button or the meeting's own): the link stops working and everyone is out. */
    async endPublicMeeting(ask) {
        const pm = this.publicMeeting;
        const vc = VirtualClassModule;
        if (!pm || pm.closing === 'end') return;
        if (ask && !confirm('End this meeting for everyone? The public link stops working at once.')) return;
        pm.closing = 'end';
        if (vc.recording) await vc.stopRecording();
        await this.reportPublicMeetingEnded();
        if (vc.jitsiApi) {
            try { vc.jitsiApi.executeCommand('endConference'); } catch (e) { /* the meeting already closed */ }
        }
        this.awaitPublicMeetingClose();
    },

    async reportPublicMeetingEnded() {
        const pm = this.publicMeeting;
        const vc = VirtualClassModule;
        try {
            await Lms.api('POST', `/api/public-meetings/${encodeURIComponent(vc.activeSession.id)}/end`);
            pm.reported = true;
            vc.tellPublicMeetingTabs('ended', vc.activeSession.id);
        } catch (e) {
            pm.reportFailed = e.message;
        }
    },

    // The meeting has closed in this tab: by this person, or from inside by another host ending it for everyone
    async publicMeetingClosed() {
        const pm = this.publicMeeting;
        const vc = VirtualClassModule;
        if (!pm || pm.closed) return;
        clearTimeout(this._publicCloseTimer);
        clearInterval(this._publicWatchTimer);
        pm.closed = true;
        const ended = pm.closing === 'end' || (!pm.closing && pm.joined);
        if (vc.recording) await vc.stopRecording();
        if (ended && !pm.reported && !pm.endedElsewhere) await this.reportPublicMeetingEnded();
        vc.disposeMeeting();
        if (pm.reportFailed) {
            this.message('fa-exclamation-triangle', 'The meeting could not be marked as ended', `${pm.reportFailed} End it from Open Public Meetings in the Classrooms Lobby.`, this.closeButton());
        } else if (ended) {
            this.message('fa-door-closed', 'The meeting has ended', 'The public link no longer works. You can close this tab.', this.closeButton());
        } else {
            this.message('fa-door-open', 'You have left the meeting', 'The meeting stays open and the link still works. You can rejoin as host, or end it from Open Public Meetings in the Classrooms Lobby.',
                `<button class="btn btn-gold" onclick="location.reload()"><i class="fas fa-sign-in-alt"></i> Rejoin as Host</button>${this.closeButton()}`);
        }
    },

    // The meeting ended somewhere else (the lobby here, another administrator): close it here, which removes the people inside
    publicMeetingEndedElsewhere() {
        const pm = this.publicMeeting;
        const vc = VirtualClassModule;
        if (!pm || pm.closed || pm.closing === 'end') return;
        pm.closing = 'end';
        pm.endedElsewhere = true;
        window.App.showToast('This public meeting was ended from the portal.', 'info');
        if (vc.jitsiApi) {
            try { vc.jitsiApi.executeCommand('endConference'); } catch (e) { /* the meeting already closed */ }
        }
        this.awaitPublicMeetingClose();
    },

    // News of this meeting while the tab is open: from the lobby in this browser at once, from anywhere else within seconds
    followPublicMeeting() {
        const vc = VirtualClassModule;
        const id = vc.activeSession.id;
        const channel = vc.publicMeetingChannel();
        if (channel) {
            channel.addEventListener('message', e => {
                if (e.data && e.data.type === 'ended' && e.data.id === id) this.publicMeetingEndedElsewhere();
            });
        }
        this._publicWatchTimer = setInterval(async () => {
            try {
                const { meeting } = await Lms.api('GET', `/api/public-meetings/${encodeURIComponent(id)}`);
                if (meeting.status === 'ENDED') this.publicMeetingEndedElsewhere();
            } catch (e) { /* offline for a moment: ask again next time */ }
        }, PUBLIC_MEETING_POLL_MS);
        // Closing the tab with nobody else inside ends the meeting, unless the host comes back at once (a reload)
        window.addEventListener('pagehide', () => {
            const pm = this.publicMeeting;
            if (!pm || pm.closed || pm.closing || !this.alonePublicMeeting()) return;
            navigator.sendBeacon(`/api/public-meetings/${encodeURIComponent(id)}/left`);
            vc.tellPublicMeetingTabs('tab-closed', id);
        });
    },

    async start() {
        if (!this.sessionId && !this.room && !this.publicMeetingId) {
            this.message('fa-video-slash', 'No class chosen', 'Open the live class from Online Classes in the portal.', this.closeButton());
            return;
        }
        await this.signedIn();
        this.rememberForLogin();
        const user = await AuthRBAC.verifySession();
        if (!user) return; // sent to the login page (e.g. to change a temporary password), which comes back here
        this.forgetForLogin();
        if (user === 'offline') {
            this.message('fa-plug', 'The portal server cannot be reached', 'Check your internet connection, then try again.',
                `<button class="btn btn-gold" onclick="location.reload()"><i class="fas fa-redo"></i> ${I18n.t('Try again')}</button>`);
            return;
        }
        await DataStore.startSync();
        if (!AuthRBAC.init()) return;

        const vc = VirtualClassModule;
        vc.inLiveRoom = true;
        // Here the meeting always fills the tab (except on public meet.jit.si, which cannot be embedded)
        vc.canEmbed = () => vc.meetingDomain() !== 'meet.jit.si';
        // Leaving shows a short page in this tab instead of the portal's lobby
        vc.leaveClass = async function () {
            if (this.recording) await this.stopRecording();
            this.disposeMeeting();
            LiveRoom.message('fa-door-open', 'You have left the class', 'You can rejoin while the class is live, or close this tab.',
                `<button class="btn btn-gold" onclick="location.reload()"><i class="fas fa-sign-in-alt"></i> ${I18n.t('Rejoin')}</button>${LiveRoom.closeButton()}`);
        };

        if (this.publicMeetingId) {
            await this.startPublicMeeting();
            return;
        }

        const access = await this.verify();
        if (!access.ok) {
            this.message('fa-shield-alt', 'You cannot join this class', access.message, this.closeButton());
            return;
        }
        const session = { ...((window.LmsData.virtualClasses || []).find(s => s.id === this.sessionId) || {}), ...access.session };
        await vc.loadMeetingConfig();
        Object.assign(vc, { activeSessionId: session.id, activeSession: session, accessBlocked: false, isHost: access.isHost, currentTab: 'studio' });

        // A class held on Zoom / Google Meet / Teams: this tab goes there
        if (session.platform === 'EXTERNAL' && session.externalUrl) {
            vc.recordAutoAttendance(session, AuthRBAC.currentUser || {});
            location.replace(session.externalUrl);
            return;
        }
        if (session.status !== 'LIVE' && !session.isLive && !vc.isHost) {
            this.message('fa-clock', 'This class has not started yet', 'This tab opens the class as soon as your teacher starts it. Try again in a moment.',
                `<button class="btn btn-gold" onclick="location.reload()"><i class="fas fa-redo"></i> ${I18n.t('Try again')}</button>${this.closeButton()}`);
            return;
        }
        vc.recordAutoAttendance(session, AuthRBAC.currentUser || {});

        // The public meet.jit.si service ends embedded calls after 5 minutes, so this tab goes to it directly
        if (!vc.canEmbed()) {
            try {
                location.replace(vc.meetingUrl(session, await vc.joinToken(session)));
            } catch (e) {
                this.message('fa-exclamation-triangle', 'The live classroom could not be opened', e.message, this.closeButton());
            }
            return;
        }
        this.renderBar();
        await vc.mountMeeting();
    }
};
window.LiveRoom = LiveRoom;

LiveRoom.start().catch(err => {
    console.error('[Live room]', err);
    LiveRoom.message('fa-exclamation-triangle', 'The live classroom could not be opened', err.message || String(err), LiveRoom.closeButton());
});
