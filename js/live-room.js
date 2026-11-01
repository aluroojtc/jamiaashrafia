/**
 * JAMIA ASHRAFIA LAHORE - LIVE CLASS TAB (live.html?session=<id>)
 * Every live class opens in its own browser tab: the meeting fills the tab, with a slim bar for the class name,
 * the host's Start / Stop Recording and End Class, and Leave. Sign-in, the access check, attendance, the meeting
 * token and recording all work as in the portal (js/modules/virtual-class.js runs here too, without the portal
 * around it). On the public meet.jit.si service, or for a class on Zoom / Meet / Teams, the tab goes straight there.
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
            ${vc.canRecord(session) ? `<span id="vc-rec-controls" style="display: inline-flex; gap: 8px; align-items: center;">${vc.recordingControlsHtml()}</span>` : ''}
            ${vc.isHost && live ? `<button class="btn btn-danger btn-sm" onclick="VirtualClassModule.endSession('${Lms.esc(session.id)}')"><i class="fas fa-stop-circle"></i> ${I18n.t('End Class for Everyone')}</button>` : ''}
            <button class="btn btn-secondary btn-sm" onclick="VirtualClassModule.leaveClass()"><i class="fas fa-sign-out-alt"></i> ${I18n.t('Leave')}</button>`;
    },

    async start() {
        if (!this.sessionId && !this.room) {
            this.message('fa-video-slash', 'No class chosen', 'Open the live class from Online Classes in the portal.', this.closeButton());
            return;
        }
        LiveRoom.rememberForLogin();
        const user = await AuthRBAC.verifySession();
        if (!user) return; // sent to the login page, which comes back here
        LiveRoom.forgetForLogin();
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
