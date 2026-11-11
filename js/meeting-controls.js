/**
 * JAMIA ASHRAFIA LAHORE - MEETING CONTROLS (the host's Meeting Settings; server/meeting-controls.js)
 *
 * Runs in every meeting tab: live.html (a class, or the host of a public meeting) and meet.html (public meeting
 * guests). The host changes the settings in the Meeting Settings window; every tab asks the server for them every
 * few seconds (at once when the host's tab sends a nudge through the meeting) and applies them:
 *   chat            Jitsi's chat is switched off for everyone (disableChat)
 *   rename          participants' names are read-only, and a changed name is put back
 *   unmute, video   the host's tab switches Jitsi's audio / video moderation, which the meeting server enforces;
 *                   a participant then raises a hand and the host lets them speak (or show video) from the
 *                   participants list
 *   recordRequests  participants may ask to record to their computer; the host allows or refuses each request
 * Always on: one screen share at a time. When someone starts sharing, the previous sharer's tab stops its share.
 *
 * Recording to a computer is done by this page, not by Jitsi (Jitsi's own "save to computer" only works when
 * the meeting is not embedded in another site). The browser asks which tab to record (this one is offered first);
 * the meeting's sound and the person's own microphone are mixed in, and the file is saved to the computer
 * (Downloads) when the recording stops. Nothing is uploaded.
 *
 * Needs only the browser: meet.html loads it without the portal's scripts.
 */
(function () {
    'use strict';

    const DEFAULTS = { chat: true, rename: true, unmute: true, video: true, recordRequests: false };
    const HOST_POLL_MS = 4000;
    const PARTICIPANT_POLL_MS = 6000;
    const NUDGE = 'jamia-meeting-controls';

    function esc(v) {
        return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function clock(since) {
        const secs = Math.max(0, Math.floor((Date.now() - since) / 1000));
        const h = Math.floor(secs / 3600);
        return `${h ? h + ':' : ''}${String(Math.floor((secs % 3600) / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
    }

    async function post(path, body, credentials) {
        const res = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: credentials || 'same-origin',
            cache: 'no-store',
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw Object.assign(new Error(data.error || data.message || `Request failed (${res.status})`), { status: res.status });
        return data;
    }

    // =========================================================================
    // Recording to this computer
    // =========================================================================
    const LocalRecorder = {
        active: null, // { recorder, chunks, mime, title, since, streams, ctx, micGain, onEnded }

        supported() {
            return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && window.MediaRecorder);
        },

        pickMime() {
            const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
            return types.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
        },

        /**
         * Must be called straight from a click: the browser only shows its "choose what to record" window then.
         * Resolves when recording has started; rejects with a readable message.
         */
        async start(title, onEnded) {
            if (this.active) return;
            if (!this.supported()) throw new Error('Recording to your computer needs a desktop browser (Chrome, Edge or Firefox).');
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const ctx = AudioCtx ? new AudioCtx() : null; // made inside the click, so it may play
            let display;
            try {
                display = await navigator.mediaDevices.getDisplayMedia({
                    video: { displaySurface: 'browser', frameRate: { ideal: 24, max: 30 } },
                    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false },
                    preferCurrentTab: true,
                    selfBrowserSurface: 'include',
                    surfaceSwitching: 'exclude',
                    systemAudio: 'include'
                });
            } catch (e) {
                if (ctx) ctx.close().catch(() => {});
                throw new Error(e && e.name === 'NotAllowedError' ? 'Recording was cancelled.' : 'This browser could not start recording the screen.');
            }
            let mic = null;
            try {
                mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            } catch (e) { /* no microphone permission: the meeting's sound is still recorded */ }

            const tracks = [...display.getVideoTracks()];
            let micGain = null;
            if (ctx) {
                const dest = ctx.createMediaStreamDestination();
                if (display.getAudioTracks().length) ctx.createMediaStreamSource(new MediaStream(display.getAudioTracks())).connect(dest);
                if (mic) {
                    micGain = ctx.createGain();
                    ctx.createMediaStreamSource(mic).connect(micGain);
                    micGain.connect(dest);
                }
                ctx.resume().catch(() => {});
                tracks.push(...dest.stream.getAudioTracks());
            } else {
                tracks.push(...display.getAudioTracks());
            }
            const mime = this.pickMime();
            let recorder;
            try {
                recorder = new MediaRecorder(new MediaStream(tracks), { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 1500000, audioBitsPerSecond: 128000 });
            } catch (e) {
                [display, mic].forEach(s => s && s.getTracks().forEach(t => t.stop()));
                if (ctx) ctx.close().catch(() => {});
                throw new Error('This browser cannot record video.');
            }
            const rec = { recorder, chunks: [], mime: recorder.mimeType || mime || 'video/webm', title, since: Date.now(), streams: [display, mic].filter(Boolean), ctx, micGain, onEnded, micWarning: !mic };
            recorder.ondataavailable = e => { if (e.data && e.data.size) rec.chunks.push(e.data); };
            // The browser's own "Stop sharing" ends it too
            display.getVideoTracks().forEach(t => t.addEventListener('ended', () => {
                if (this.active === rec) this.stop().then(file => rec.onEnded && rec.onEnded(file));
            }));
            recorder.start(1000);
            this.active = rec;
        },

        // The meeting's mute button also silences the microphone in the recording
        setMicMuted(muted) {
            const rec = this.active;
            if (rec && rec.micGain) rec.micGain.gain.value = muted ? 0 : 1;
        },

        /** Stops and saves the file; resolves with its name (null when nothing was recording). */
        stop() {
            const rec = this.active;
            if (!rec) return Promise.resolve(null);
            this.active = null;
            return new Promise(resolve => {
                const finish = () => {
                    rec.streams.forEach(s => s.getTracks().forEach(t => t.stop()));
                    if (rec.ctx) rec.ctx.close().catch(() => {});
                    if (!rec.chunks.length) {
                        resolve(null);
                        return;
                    }
                    const blob = new Blob(rec.chunks, { type: rec.mime.split(';')[0] });
                    const d = new Date();
                    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}`;
                    const name = `${String(rec.title || 'Meeting').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Meeting'} ${stamp}.${rec.mime.includes('mp4') ? 'mp4' : 'webm'}`;
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = name;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60 * 1000);
                    resolve(name);
                };
                rec.recorder.onstop = finish;
                try {
                    if (rec.recorder.state !== 'inactive') rec.recorder.stop();
                    else finish();
                } catch (e) {
                    finish();
                }
            });
        }
    };

    // Closing the tab while recording to the computer would lose the file
    window.addEventListener('beforeunload', e => {
        if (!LocalRecorder.active) return;
        e.preventDefault();
        e.returnValue = '';
    });

    // =========================================================================
    // One meeting's controls
    // =========================================================================
    const SETTING_ROWS = [
        { key: 'chat', icon: 'fa-comment-dots', label: 'Chat box', on: 'On for everyone', off: 'Off: nobody can send or read chat messages' },
        { key: 'rename', icon: 'fa-id-badge', label: 'Participants can rename themselves', on: 'Allowed', off: 'Not allowed: everyone keeps the name they joined with' },
        { key: 'unmute', icon: 'fa-microphone', label: 'Participants can unmute themselves', on: 'Allowed', off: 'Not allowed: they raise a hand, and you let them speak from the participants list' },
        { key: 'video', icon: 'fa-video', label: 'Participants can turn on their camera', on: 'Allowed', off: 'Not allowed: you let them turn it on from the participants list' },
        { key: 'recordRequests', icon: 'fa-download', label: 'Participants can ask to record to their computer', on: 'Allowed: each request waits for you to allow it', off: 'Not allowed' }
    ];

    class Controls {
        /**
         * opts: {
         *   api            the JitsiMeetExternalAPI of the meeting
         *   target         what identifies the meeting and person to the server ({ sessionId } | { publicMeetingId } | { code, guestId, guestName, guestKey })
         *   isHost
         *   settings       as loaded before the meeting was opened (MeetingControls.load)
         *   title          the meeting's name, used for the recording's file name
         *   credentials    'omit' for guests
         *   toast(message, type)
         *   openPanel(titleHtml, bodyHtml, footerHtml), closePanel()   the host's window (the portal's popup)
         *   onEnded()      the meeting has ended (the server says so)
         * }
         */
        constructor(opts) {
            this.opts = opts;
            this.api = opts.api;
            this.isHost = !!opts.isHost;
            this.settings = { ...DEFAULTS, ...(opts.settings || {}) };
            this.requests = [];      // the host's list
            this.request = null;     // a participant's own request
            this.localId = null;
            this.joinedName = null;
            this.chatOpen = false;
            this.moderator = false;
            this.moderation = { audio: null, video: null }; // what the host's tab last set in the meeting
            this.seenRequests = new Set();
            this.lastNameFix = 0;
            this.sharing = false;       // this tab is sharing its screen
            this.sharers = new Set();   // everyone sharing, as last told by the meeting
            this.destroyed = false;
        }

        toast(message, type) {
            if (this.opts.toast) this.opts.toast(message, type || 'info');
        }

        start() {
            const api = this.api;
            api.addListener('videoConferenceJoined', e => {
                this.localId = e && e.id;
                this.joinedName = e && e.displayName;
                this.applyToTab();
                if (this.isHost && e && e.role === 'moderator') this.becameModerator();
            });
            api.addListener('participantRoleChanged', e => {
                if (this.isHost && e && e.role === 'moderator' && (!this.localId || e.id === this.localId)) this.becameModerator();
            });
            api.addListener('chatUpdated', e => { this.chatOpen = !!(e && e.isOpen); });
            api.addListener('displayNameChange', e => this.onNameChange(e));
            api.addListener('audioMuteStatusChanged', e => LocalRecorder.setMicMuted(!!(e && e.muted)));
            api.addListener('endpointTextMessageReceived', e => {
                let msg = null;
                try { msg = JSON.parse(e && e.data && e.data.eventData && e.data.eventData.text); } catch (err) { /* someone else's message */ }
                if (msg && msg.type === NUDGE) this.refresh();
            });
            api.addListener('screenSharingStatusChanged', e => { this.sharing = !!(e && e.on); });
            api.addListener('contentSharingParticipantsChanged', e => this.onSharersChanged(e));
            // The host may also switch moderation in Jitsi's own participants list: the settings follow
            if (this.isHost) api.addListener('moderationStatusChanged', e => this.onModerationChanged(e));
            this.timer = setInterval(() => this.refresh(), this.isHost ? HOST_POLL_MS : PARTICIPANT_POLL_MS);
            this.render();
            return this;
        }

        async destroy() {
            this.destroyed = true;
            clearInterval(this.timer);
            clearInterval(this.clockTimer);
            if (LocalRecorder.active) await this.stopRecording(true);
            const tools = document.getElementById('mc-tools');
            if (tools) tools.innerHTML = '';
            const reqs = document.getElementById('mc-requests');
            if (reqs) reqs.innerHTML = '';
        }

        // Everyone else's tab asks again at once (through the meeting); the server stays the one that decides
        nudge() {
            try { this.api.executeCommand('sendEndpointTextMessage', '', JSON.stringify({ type: NUDGE })); } catch (e) { /* they ask within seconds anyway */ }
        }

        async refresh() {
            if (this.destroyed || this._refreshing) return;
            this._refreshing = true;
            try {
                const data = await post('/api/meeting-controls/state', this.opts.target, this.opts.credentials);
                if (!this.destroyed) this.update(data);
            } catch (e) {
                if (e.status === 410 && this.opts.onEnded) this.opts.onEnded();
                /* otherwise offline for a moment: ask again next time */
            } finally {
                this._refreshing = false;
            }
        }

        update(data) {
            const before = this.settings;
            if (data.settings) this.settings = { ...DEFAULTS, ...data.settings };
            const changed = Object.keys(DEFAULTS).filter(k => before[k] !== this.settings[k]);
            if (changed.length) {
                this.applyToTab();
                if (this.isHost) this.applyModeration();
                else this.tellParticipant(changed);
            }
            if (this.isHost) this.updateRequests(data.requests || []);
            else this.updateOwnRequest(data.request || null);
            this.render();
        }

        // ---------------------------------------------------------------------
        // Applying the settings
        // ---------------------------------------------------------------------

        // Chat for everyone; names for participants
        applyToTab() {
            const s = this.settings;
            try {
                if (!s.chat && this.chatOpen) this.api.executeCommand('toggleChat');
                this.api.executeCommand('overwriteConfig', MeetingControls.config(s, this.isHost));
            } catch (e) { /* the meeting is closing */ }
            if (!this.isHost && !s.rename) this.restoreName();
        }

        tellParticipant(changed) {
            const s = this.settings;
            const notes = {
                chat: s.chat ? 'The host turned the chat on.' : 'The host turned the chat off.',
                rename: s.rename ? 'The host allows changing your name.' : 'The host does not allow changing names.',
                unmute: s.unmute ? 'The host allows you to unmute yourself.' : 'The host has muted participants. Raise your hand to ask to speak.',
                video: s.video ? 'The host allows you to turn on your camera.' : 'The host has turned off participants\' cameras. Raise your hand to ask to show video.',
                recordRequests: s.recordRequests ? 'The host allows you to ask to record this meeting to your computer.' : 'The host no longer allows recording to your computer.'
            };
            changed.forEach(k => this.toast(notes[k], 'info'));
        }

        // Names not allowed: the name this person joined with is put back (also after an earlier allowed change)
        onNameChange(e) {
            if (!e || this.isHost || this.settings.rename || !this.localId || e.id !== this.localId) return;
            const name = e.displayname !== undefined ? e.displayname : e.displayName;
            if (this.joinedName && name !== this.joinedName) this.restoreName(true);
        }

        restoreName(told) {
            if (!this.joinedName || Date.now() - this.lastNameFix < 1500) return;
            this.lastNameFix = Date.now();
            try { this.api.executeCommand('displayName', this.joinedName); } catch (e) { /* closing */ }
            if (told) this.toast('The host does not allow changing names.', 'warning');
        }

        // One screen at a time: when someone else starts sharing, this tab stops its own share.
        // (The one who just started sees the earlier sharer as already known, so theirs stays.)
        onSharersChanged(e) {
            const list = (e && Array.isArray(e.data) ? e.data : []).map(String);
            const known = this.sharers;
            this.sharers = new Set(list);
            const me = this.localId ? String(this.localId) : null;
            if (me && list.includes(me) && !known.has(me)) return; // this tab is the one that just started
            const newcomer = list.find(id => id !== me && !known.has(id));
            if (!newcomer || !this.sharing) return;
            this.sharing = false;
            let name = '';
            try { name = this.api.getDisplayName(newcomer) || ''; } catch (err) { /* unknown */ }
            try { this.api.executeCommand('toggleShareScreen'); } catch (err) { /* closing */ }
            this.toast(`Your screen sharing stopped because ${name || 'someone else'} started sharing.`, 'info');
        }

        // The meeting forgets moderation when it empties, so the host's tab sets it again on (re)joining
        becameModerator() {
            this.moderator = true;
            this.moderation = { audio: null, video: null };
            this.applyModeration();
        }

        applyModeration() {
            if (!this.isHost || !this.moderator) return;
            [['audio', 'unmute'], ['video', 'video']].forEach(([type, key]) => {
                const restrict = !this.settings[key];
                if (this.moderation[type] === restrict) return;
                this.moderation[type] = restrict;
                try {
                    this.api.executeCommand('toggleModeration', restrict, type);
                    // Moderation only stops people turning it on: those already on are switched off
                    if (restrict) this.api.executeCommand('muteEveryone', type);
                } catch (e) { /* closing */ }
            });
        }

        onModerationChanged(e) {
            if (!e || !['audio', 'video'].includes(e.mediaType)) return;
            const key = e.mediaType === 'audio' ? 'unmute' : 'video';
            this.moderation[e.mediaType] = !!e.enabled;
            if (this.settings[key] === !e.enabled) return;
            this.save({ [key]: !e.enabled }, true);
        }

        // ---------------------------------------------------------------------
        // The host: Meeting Settings and recording requests
        // ---------------------------------------------------------------------

        async save(patch, quiet) {
            const before = this.settings;
            this.settings = { ...this.settings, ...patch };
            this.applyToTab();
            this.applyModeration();
            this.render();
            try {
                const data = await post('/api/meeting-controls/settings', { ...this.opts.target, settings: patch }, this.opts.credentials);
                this.settings = { ...DEFAULTS, ...data.settings };
                this.updateRequests(data.requests || []);
                this.nudge();
                if (!quiet) this.toast('Meeting settings saved. Everyone in the meeting gets them within seconds.', 'success');
            } catch (e) {
                this.settings = before;
                this.applyToTab();
                this.applyModeration();
                this.toast(e.message, 'error');
            }
            this.render();
        }

        toggle(key, value) {
            if (!this.isHost || !(key in DEFAULTS)) return;
            this.save({ [key]: !!value });
        }

        updateRequests(list) {
            this.requests = list;
            list.filter(r => r.status === 'pending' && !this.seenRequests.has(r.id)).forEach(r => {
                this.seenRequests.add(r.id);
                this.toast(`${r.name} asks to record this meeting to their computer.`, 'info');
            });
        }

        async answer(requestId, allow) {
            try {
                const data = await post('/api/meeting-controls/answer', { ...this.opts.target, requestId, allow }, this.opts.credentials);
                this.updateRequests(data.requests || []);
                this.nudge();
            } catch (e) {
                this.toast(e.message, 'error');
                this.refresh();
            }
            this.render();
        }

        openSettings() {
            if (!this.isHost || !this.opts.openPanel) return;
            const html = this.panelHtml();
            this.opts.openPanel(
                '<i class="fas fa-sliders-h" style="color: var(--primary-500, #0ea5e9);"></i> Meeting Settings',
                `<div id="mc-panel">${html}</div>`,
                '<button class="btn btn-primary" onclick="App.closeModal()">Done</button>'
            );
            const panel = document.getElementById('mc-panel');
            if (panel) panel.mcHtml = html; // drawn already (see render)
        }

        panelHtml() {
            const s = this.settings;
            const rows = SETTING_ROWS.map(r => `
                <label class="mc-row">
                    <span class="mc-row-icon"><i class="fas ${r.icon}"></i></span>
                    <span class="mc-row-text"><strong>${esc(r.label)}</strong><small>${esc(s[r.key] ? r.on : r.off)}</small></span>
                    <span class="mc-switch"><input type="checkbox" role="switch" aria-label="${esc(r.label)}" ${s[r.key] ? 'checked' : ''} onchange="MeetingControls.current && MeetingControls.current.toggle('${r.key}', this.checked)"><span></span></span>
                </label>`).join('');
            const people = this.requests.filter(r => r.status !== 'pending');
            return `
                <p class="mc-note">Changes reach everyone in the meeting within a few seconds and stay for this meeting if you rejoin.</p>
                ${rows}
                ${people.length ? `
                    <div class="mc-subhead">Allowed to record to their computer</div>
                    ${people.map(r => `
                        <div class="mc-person">
                            <span>${esc(r.name)}${r.status === 'recording' ? ' <span class="status-pill danger"><i class="fas fa-circle"></i> Recording</span>' : ''}</span>
                            <button class="btn btn-secondary btn-sm" onclick="MeetingControls.current.answer('${esc(r.id)}', false)">${r.status === 'recording' ? 'Stop their recording' : 'Withdraw'}</button>
                        </div>`).join('')}` : ''}`;
        }

        // ---------------------------------------------------------------------
        // A participant: asking to record
        // ---------------------------------------------------------------------

        updateOwnRequest(request) {
            const before = this.request;
            this.request = request;
            const was = before && before.status;
            const now = request && request.status;
            if (was === 'pending' && now === 'allowed') this.toast('The host allowed you to record. Press Record to Computer to start.', 'success');
            if (was === 'pending' && (now === 'denied' || !now)) this.toast('The host did not allow you to record.', 'warning');
            // Permission withdrawn (or requests switched off) while recording: what was recorded is saved
            if (LocalRecorder.active && (!this.settings.recordRequests || !now || now === 'denied')) {
                this.stopRecording(false, 'The host stopped your recording. What was recorded is saved to your computer.');
            }
        }

        async askToRecord() {
            try {
                const data = await post('/api/meeting-controls/request', this.opts.target, this.opts.credentials);
                this.request = data.request;
                this.nudge();
                if (this.request && this.request.status === 'pending') this.toast('Request sent. The host will allow or refuse it.', 'info');
            } catch (e) {
                this.toast(e.message, 'error');
            }
            this.render();
        }

        async cancelRequest() {
            try {
                await post('/api/meeting-controls/request', { ...this.opts.target, cancel: true }, this.opts.credentials);
                this.request = null;
                this.nudge();
            } catch (e) {
                this.toast(e.message, 'error');
            }
            this.render();
        }

        // ---------------------------------------------------------------------
        // Recording to this computer (host, or a participant who was allowed)
        // ---------------------------------------------------------------------

        canRecordNow() {
            return this.isHost || (this.settings.recordRequests && this.request && ['allowed', 'recording'].includes(this.request.status));
        }

        // Straight from the button's click (see LocalRecorder.start)
        async startRecording() {
            if (LocalRecorder.active || !this.canRecordNow()) return;
            try {
                await LocalRecorder.start(this.opts.title, file => this.recordingEnded(file));
            } catch (e) {
                this.toast(e.message, 'error');
                return;
            }
            try {
                const muted = await this.api.isAudioMuted();
                LocalRecorder.setMicMuted(!!muted);
            } catch (e) { /* keep the microphone on */ }
            if (LocalRecorder.active && LocalRecorder.active.micWarning) this.toast('Recording without your microphone (the browser did not allow it). The meeting\'s sound is recorded.', 'warning');
            else this.toast('Recording to your computer. Keep this tab open; the file is saved when you stop.', 'success');
            if (!this.isHost) {
                post('/api/meeting-controls/recording', { ...this.opts.target, on: true }, this.opts.credentials).then(() => this.nudge()).catch(() => {});
            }
            this.render();
        }

        async stopRecording(quiet, message) {
            const file = await LocalRecorder.stop();
            this.recordingEnded(file, quiet, message);
        }

        recordingEnded(file, quiet, message) {
            if (!this.isHost) {
                post('/api/meeting-controls/recording', { ...this.opts.target, on: false }, this.opts.credentials).then(() => this.nudge()).catch(() => {});
            }
            if (!quiet || message) {
                this.toast(message || (file ? `Recording saved to your computer: ${file}` : 'Recording stopped. Nothing was recorded.'), file ? 'success' : 'info');
            }
            this.render();
        }

        // ---------------------------------------------------------------------
        // The bar: #mc-tools (buttons) and, for the host, #mc-requests (people asking)
        // ---------------------------------------------------------------------

        toolsHtml() {
            const rec = LocalRecorder.active;
            if (rec) {
                return `<span class="status-pill danger mc-rec-pill" title="Recording to your computer"><i class="fas fa-download"></i> REC ${clock(rec.since)}</span>
                    <button class="btn btn-danger btn-sm" onclick="MeetingControls.current.stopRecording()"><i class="fas fa-stop"></i> Stop &amp; Save</button>`;
            }
            if (this.isHost) {
                const waiting = this.requests.filter(r => r.status === 'pending').length;
                return `<button class="btn btn-secondary btn-sm" onclick="MeetingControls.current.startRecording()" title="Record this meeting to your own computer"><i class="fas fa-download"></i> Record to Computer</button>
                    <button class="btn btn-secondary btn-sm mc-settings-btn" onclick="MeetingControls.current.openSettings()" title="Chat, names, microphones, cameras and recording for participants">
                        <i class="fas fa-sliders-h"></i> Meeting Settings${waiting ? ` <span class="mc-badge">${waiting}</span>` : ''}</button>`;
            }
            if (!this.settings.recordRequests) return '';
            const status = this.request && this.request.status;
            if (status === 'allowed' || status === 'recording') {
                return `<button class="btn btn-secondary btn-sm" onclick="MeetingControls.current.startRecording()"><i class="fas fa-download"></i> Record to Computer</button>`;
            }
            if (status === 'pending') {
                return `<button class="btn btn-secondary btn-sm" disabled><i class="fas fa-hourglass-half"></i> Waiting for the host...</button>
                    <button class="btn btn-secondary btn-sm" onclick="MeetingControls.current.cancelRequest()" title="Cancel the request"><i class="fas fa-times"></i></button>`;
            }
            return `<button class="btn btn-secondary btn-sm" onclick="MeetingControls.current.askToRecord()" title="Ask the host to let you record this meeting to your computer"><i class="fas fa-download"></i> Ask to Record</button>`;
        }

        requestsHtml() {
            return this.requests.filter(r => r.status === 'pending').map(r => `
                <div class="mc-request">
                    <i class="fas fa-download"></i>
                    <span><strong>${esc(r.name)}</strong> asks to record this meeting to their computer</span>
                    <button class="btn btn-primary btn-sm" onclick="MeetingControls.current.answer('${esc(r.id)}', true)">Allow</button>
                    <button class="btn btn-secondary btn-sm" onclick="MeetingControls.current.answer('${esc(r.id)}', false)">Don't Allow</button>
                </div>`).join('');
        }

        render() {
            if (this.destroyed) return;
            // Only what changed is redrawn, so a click or keyboard focus is not lost to the regular refresh
            const put = (id, html) => {
                const el = document.getElementById(id);
                if (el && el.mcHtml !== html) {
                    el.innerHTML = html;
                    el.mcHtml = html;
                }
            };
            put('mc-tools', this.toolsHtml());
            put('mc-requests', this.isHost ? this.requestsHtml() : '');
            if (this.isHost) put('mc-panel', this.panelHtml());
            clearInterval(this.clockTimer);
            if (LocalRecorder.active) this.clockTimer = setInterval(() => this.render(), 1000);
        }
    }

    const MeetingControls = {
        DEFAULTS,
        LocalRecorder,
        current: null,

        /** The settings before the meeting opens (so it opens with them); the defaults if the server cannot say. */
        async load(target, credentials) {
            try {
                const data = await post('/api/meeting-controls/state', target, credentials);
                return { ...DEFAULTS, ...(data.settings || {}) };
            } catch (e) {
                if (e.status === 410) throw e;
                return { ...DEFAULTS };
            }
        },

        /** The part of the meeting's configuration the settings decide (also sent while it runs). */
        config(settings, isHost) {
            const s = { ...DEFAULTS, ...(settings || {}) };
            return {
                disableChat: !s.chat,
                ...(isHost ? {} : { readOnlyName: !s.rename }),
                // Jitsi's own "save to computer" is replaced by this page's (see LocalRecorder)
                localRecording: { disable: true }
            };
        },

        /** Starts the controls of the meeting just opened (one per tab). */
        attach(opts) {
            if (this.current) this.current.destroy();
            this.current = new Controls(opts).start();
            return this.current;
        },

        async detach() {
            const c = this.current;
            this.current = null;
            if (c) await c.destroy();
        }
    };

    window.MeetingControls = MeetingControls;
})();
