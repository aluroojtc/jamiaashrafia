/**
 * JAMIA ASHRAFIA LAHORE - CLASS RECORDINGS
 * Recordings of live classes (made with Start / Stop Recording in the Live Studio Room) and lecture
 * recordings added by hand. Students see only their own class's recordings (the server sends nothing
 * else, and streams each video only after checking the same rule). People who manage recordings rename,
 * keep or delete them, and decide on recordings still waiting for "Save Recording" or "Do Not Save".
 */

const ClassRecordingsModule = {
    pending: [],          // captures waiting for a decision (or processing after "Save")
    pendingLoaded: false,
    _pollTimer: null,

    canManage() {
        return window.AuthRBAC.can('recordings.manage');
    },

    canDownload() {
        return window.AuthRBAC.can('recordings.download') || !!(window.VirtualClassModule?.recordingSettings || {}).allowStudentDownload;
    },

    recordings() {
        const me = window.AuthRBAC?.currentUser || {};
        const list = (window.LmsData?.virtualClassRecordings || []).slice();
        // The server already limits students to their class; this keeps an old cached copy from showing more
        const mine = window.AuthRBAC.isStudent() ? list.filter(r => r.classId === me.classId) : list;
        return mine.sort((a, b) => `${b.recordedDate || ''} ${b.recordedTime || ''}`.localeCompare(`${a.recordedDate || ''} ${a.recordedTime || ''}`));
    },

    render() {
        this.load();
        const recs = this.recordings();
        const isStudent = window.AuthRBAC.isStudent();
        const totalBytes = recs.reduce((s, r) => s + (Number(r.fileSizeBytes) || 0), 0);
        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1><i class="fas fa-film" style="color: var(--gold-500);"></i> Class Recordings</h1>
                    <p>${isStudent ? 'Recorded lessons of your class. Watch again any time, at your own pace.' : 'Recorded live classes and lecture recordings, by class.'}</p>
                </div>
                ${!isStudent ? `<div class="view-actions">
                    <span class="status-pill gold"><i class="fas fa-database"></i> ${Lms.esc(Lms.fileSize(totalBytes) || '0 B')}</span>
                    <span class="status-pill neutral"><i class="fas fa-film"></i> ${recs.length} recordings</span>
                </div>` : ''}
            </div>

            <div id="crec-pending">${this.renderPending()}</div>

            ${recs.length ? Lms.filterBar('crec-list', {
                search: 'Search title, kitab or teacher...',
                selects: [isStudent ? null : Lms.classFilter(Array.from(new Set(recs.map(r => r.classId).filter(Boolean))))],
                date: { key: 'date', label: 'Recorded on' }
            }) : ''}

            <div id="crec-list" style="display: flex; flex-direction: column; gap: 14px;">
                ${recs.length ? recs.map(r => this.renderCard(r)).join('') : `
                    <div class="card" style="text-align: center; padding: 50px 20px; color: var(--text-muted);">
                        <i class="fas fa-film" style="font-size: 2.5rem; margin-bottom: 12px; opacity: 0.5;"></i>
                        <h4>No class recordings yet</h4>
                        <p>${isStudent ? 'When your teacher saves a recording of a live class, it appears here and you get a notification.' : 'Recordings saved from the Live Studio Room appear here.'}</p>
                    </div>`}
            </div>`;
    },

    renderCard(rec) {
        const vc = window.VirtualClassModule;
        const left = vc ? vc.daysRemaining(rec) : null;
        const manage = this.canManage();
        const live = rec.source === 'LIVE_RECORDING';
        return `
            <div class="vc-vault-card" data-f-person="${Lms.esc(rec.teacherId || '')}" data-f-class="${Lms.esc(rec.classId || '')}"
                 data-f-date="${Lms.isoDate(rec.recordedDate)}" data-f-search="${Lms.esc([rec.title, rec.courseName, rec.teacherName].filter(Boolean).join(' '))}">
                <div style="display: flex; align-items: center; gap: 16px; flex: 1; min-width: 0;">
                    <button type="button" onclick="ClassRecordingsModule.openPlayer('${Lms.esc(rec.id)}')" title="Watch"
                        style="width: 54px; height: 54px; border-radius: 10px; border: none; cursor: pointer; background: rgba(16, 185, 129, 0.15); color: var(--primary-500); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink: 0;">
                        <i class="fas fa-play-circle"></i>
                    </button>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                            <h4 style="color: var(--primary-950); margin: 0; font-size: 1.05rem; font-weight: 700;">${Lms.esc(Lms.localName(rec.title, rec.urduTitle, true))}</h4>
                            ${rec.className || rec.classId ? `<span class="status-pill neutral" style="font-size: 0.72rem;">${Lms.esc(rec.className || Lms.className(rec.classId))}</span>` : ''}
                            ${live ? '<span class="status-pill info" style="font-size: 0.72rem;"><i class="fas fa-video"></i> Live class</span>' : ''}
                            ${manage ? (left === null
                                ? '<span class="vc-retention-pill"><i class="fas fa-lock"></i> Kept permanently</span>'
                                : `<span class="vc-retention-pill ${left < 15 ? 'warning' : ''}"><i class="fas fa-hourglass-half"></i> ${I18n.t('{n} days remaining in vault', { n: left })}</span>`) : ''}
                        </div>
                        <div style="display: flex; gap: 16px; font-size: 0.78rem; color: var(--text-muted); flex-wrap: wrap;">
                            <span><i class="fas fa-user-tie" style="color: var(--primary-400);"></i> ${Lms.esc(Lms.personName(rec.teacherId, rec.teacherName))}</span>
                            ${rec.courseName ? `<span><i class="fas fa-book" style="color: var(--primary-400);"></i> ${Lms.esc(rec.courseName)}</span>` : ''}
                            <span><i class="fas fa-calendar" style="color: var(--primary-400);"></i> ${Lms.fmtDate(rec.recordedDate)}${rec.recordedTime ? ' ' + Lms.esc(Lms.fmtTime(rec.recordedTime)) : ''}</span>
                            ${rec.durationFormatted ? `<span><i class="fas fa-clock" style="color: var(--primary-400);"></i> ${Lms.esc(rec.durationFormatted)}</span>` : ''}
                            ${rec.fileSizeBytes ? `<span><i class="fas fa-file-video" style="color: var(--primary-400);"></i> ${Lms.esc(Lms.fileSize(rec.fileSizeBytes))}</span>` : rec.externalUrl ? '<span><i class="fas fa-link" style="color: var(--primary-400);"></i> External link</span>' : ''}
                            ${manage ? `<span><i class="fas fa-eye" style="color: var(--primary-400);"></i> ${Lms.esc(rec.viewsCount || 0)} views</span>` : ''}
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0; flex-wrap: wrap;">
                    <button class="btn btn-primary btn-sm" onclick="ClassRecordingsModule.openPlayer('${Lms.esc(rec.id)}')"><i class="fas fa-play"></i> Watch</button>
                    ${this.canDownload() && rec.videoUrl ? `<a class="btn btn-secondary btn-sm" href="${Lms.esc(this.downloadUrl(rec))}" download title="Download"><i class="fas fa-download"></i></a>` : ''}
                    ${manage ? `
                        <button class="btn btn-secondary btn-sm" onclick="ClassRecordingsModule.openEdit('${Lms.esc(rec.id)}')" title="Rename"><i class="fas fa-pen"></i></button>
                        <button class="btn btn-secondary btn-sm" onclick="ClassRecordingsModule.toggleKeep('${Lms.esc(rec.id)}')" title="${rec.autoDeleteProtected ? 'Allow the retention clean-up to remove it' : 'Keep permanently (never removed by the clean-up)'}">
                            <i class="fas ${rec.autoDeleteProtected ? 'fa-lock' : 'fa-lock-open'}" style="color: var(--gold-600);"></i></button>
                        <button class="btn btn-secondary btn-sm" style="color: #f87171;" onclick="ClassRecordingsModule.confirmDelete('${Lms.esc(rec.id)}')" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </div>`;
    },

    downloadUrl(rec) {
        const url = rec.videoUrl || '';
        return url.startsWith('/api/class-recordings/') ? `${url}?download=1` : url;
    },

    // -------------------------------------------------------------------------
    // Recordings waiting for a decision
    // -------------------------------------------------------------------------
    async load() {
        if (window.VirtualClassModule && !this._settingsLoaded) {
            this._settingsLoaded = true;
            window.VirtualClassModule.loadRecordingSettings().then(() => this.refreshList());
        }
        if (!this.canManage()) return;
        const before = new Set(this.pending.map(c => c.id));
        try {
            const data = await Lms.api('GET', '/api/class-recordings/pending');
            this.pending = data.captures || [];
        } catch (e) {
            this.pending = [];
        }
        // One left the list (published or discarded): fetch the recordings now rather than at the next sync
        if (this.pendingLoaded && [...before].some(id => !this.pending.some(c => c.id === id))) window.DataStore?.syncNow();
        this.pendingLoaded = true;
        const box = document.getElementById('crec-pending');
        if (box) box.innerHTML = this.renderPending();
        // While a saved recording is still being processed, look again shortly
        clearTimeout(this._pollTimer);
        if (this.pending.some(c => c.decision === 'SAVE' || c.status === 'STOPPED')) {
            this._pollTimer = setTimeout(() => { if (window.App?.currentRoute === 'class-recordings') this.load(); }, 20000);
        }
    },

    refreshList() {
        if (window.App?.currentRoute !== 'class-recordings') return;
        const list = document.getElementById('crec-list');
        if (list) list.innerHTML = this.recordings().map(r => this.renderCard(r)).join('') || list.innerHTML;
    },

    renderPending() {
        if (!this.canManage() || !this.pending.length) return '';
        const row = c => {
            const waiting = !c.decision;
            const state = c.status === 'RECORDING' ? '<span class="status-pill danger"><i class="fas fa-circle"></i> Recording</span>'
                : waiting ? '<span class="status-pill gold"><i class="fas fa-question-circle"></i> Waiting for your decision</span>'
                    : '<span class="status-pill info"><i class="fas fa-spinner fa-spin"></i> Saving — processing the video</span>';
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 0; border-top: 1px solid var(--border-subtle);">
                    <div>
                        <div style="font-weight: 700; color: var(--primary-950);">${Lms.esc(c.title || 'Class recording')}</div>
                        <div style="font-size: 0.78rem; color: var(--text-muted);">
                            ${Lms.esc(Lms.className(c.classId) || '')} • ${Lms.fmtDateTime(c.startedAt)}${c.durationSeconds ? ` • ${Lms.esc(this.duration(c.durationSeconds))}` : ''}${c.startedByName ? ` • ${Lms.esc(c.startedByName)}` : ''}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        ${state}
                        ${waiting && c.status !== 'RECORDING' ? `<button class="btn btn-gold btn-sm" onclick="ClassRecordingsModule.openDecision('${Lms.esc(c.id)}')"><i class="fas fa-gavel"></i> Decide</button>` : ''}
                    </div>
                </div>`;
        };
        return `
            <div class="card" style="padding: 16px 20px; margin-bottom: 18px; border-left: 4px solid var(--gold-500);">
                <h3 style="margin: 0 0 6px; font-size: 1rem; color: var(--primary-950);"><i class="fas fa-hourglass-half" style="color: var(--gold-600);"></i> Recordings not yet published</h3>
                <p style="margin: 0 0 6px; font-size: 0.82rem; color: var(--text-secondary);">Students see a recording only after it is saved.</p>
                ${this.pending.map(row).join('')}
            </div>`;
    },

    duration(seconds) {
        const s = Math.max(0, Math.round(seconds || 0));
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const pad = n => String(n).padStart(2, '0');
        return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
    },

    // -------------------------------------------------------------------------
    // Save Recording / Do Not Save (opened when recording stops; cannot be dismissed by accident)
    // -------------------------------------------------------------------------
    async openDecision(captureOrId) {
        let capture = typeof captureOrId === 'object' ? captureOrId : this.pending.find(c => c.id === captureOrId);
        if (!capture) {
            try {
                capture = (await Lms.api('GET', `/api/class-recordings/${encodeURIComponent(captureOrId)}`)).capture;
            } catch (e) {
                window.App?.showToast(e.message, 'error');
                return;
            }
        }
        this._decision = { capture, title: capture.title || '' };
        this.showSaveStep();
    },

    decisionModal(html) {
        let modal = document.getElementById('crec-decision-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'crec-decision-modal';
            modal.className = 'modal-backdrop open';
            modal.style.zIndex = '3000';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `<div class="modal-window" role="dialog" aria-modal="true" style="max-width: 520px;">${html}</div>`;
        const focus = modal.querySelector('[data-autofocus]');
        if (focus) focus.focus();
    },

    closeDecision() {
        const modal = document.getElementById('crec-decision-modal');
        if (modal) modal.remove();
        this._decision = null;
    },

    showSaveStep() {
        const d = this._decision;
        if (!d) return;
        const c = d.capture;
        const seconds = c.durationSeconds || (c.startedAt ? Math.round(((c.stoppedAt ? Date.parse(c.stoppedAt) : Date.now()) - Date.parse(c.startedAt)) / 1000) : 0);
        this.decisionModal(`
            <div class="modal-header">
                <div class="modal-title-group"><h3 style="margin: 0;"><i class="fas fa-film" style="color: var(--gold-500);"></i> Save this class recording?</h3></div>
            </div>
            <div class="modal-body">
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.7;">
                    <div><strong>Class:</strong> ${Lms.esc(Lms.className(c.classId) || '—')}</div>
                    <div><strong>Started:</strong> ${Lms.fmtDateTime(c.startedAt)}${seconds > 0 ? ` • <strong>Length:</strong> ${Lms.esc(this.duration(seconds))}` : ''}</div>
                </div>
                <div class="form-group" style="margin-bottom: 10px;">
                    <label for="crec-title">Recording title (students see this)</label>
                    <input type="text" id="crec-title" class="form-control" maxlength="200" value="${Lms.esc(d.title)}" oninput="ClassRecordingsModule._decision && (ClassRecordingsModule._decision.title = this.value)">
                </div>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Saved recordings appear in Class Recordings for the students of this class, and they are notified.</p>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
                <button class="btn btn-secondary" style="color: var(--danger);" onclick="ClassRecordingsModule.showDiscardStep()"><i class="fas fa-trash-alt"></i> Do Not Save</button>
                <button class="btn btn-gold" data-autofocus onclick="ClassRecordingsModule.decide(this, true)"><i class="fas fa-save"></i> Save Recording</button>
            </div>`);
    },

    showDiscardStep() {
        const d = this._decision;
        if (!d) return;
        this.decisionModal(`
            <div class="modal-header">
                <div class="modal-title-group"><h3 style="margin: 0; color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> Discard this recording?</h3></div>
            </div>
            <div class="modal-body">
                <p style="font-size: 0.9rem; line-height: 1.6; margin: 0 0 10px;">The recording of <strong>${Lms.esc(d.title || 'this class')}</strong> will be <strong>permanently deleted</strong> from the server.</p>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">This cannot be undone. Students will never see it.</p>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
                <button class="btn btn-secondary" data-autofocus onclick="ClassRecordingsModule.showSaveStep()"><i class="fas fa-arrow-left"></i> Cancel</button>
                <button class="btn btn-danger" onclick="ClassRecordingsModule.decide(this, false)"><i class="fas fa-trash-alt"></i> Confirm Do Not Save</button>
            </div>`);
    },

    async decide(btn, save) {
        const d = this._decision;
        if (!d) return;
        const title = String(d.title || '').trim();
        if (save && !title) {
            window.App?.showToast('Enter a title for the recording', 'warning');
            return;
        }
        await Lms.busy(btn, async () => {
            try {
                const data = await Lms.api('POST', `/api/class-recordings/${encodeURIComponent(d.capture.id)}/decision`,
                    save ? { save: true, title } : { save: false, confirmDiscard: true });
                this.closeDecision();
                const c = data.capture || {};
                window.App?.showToast(!save ? 'Recording discarded and deleted.'
                    : c.status === 'SAVED' ? 'Recording saved. Students of the class have been notified.'
                        : 'Recording will be saved. It is published, and students are notified, as soon as the video finishes processing.', save ? 'success' : 'info');
                window.DataStore?.syncNow();
                if (window.App?.currentRoute === 'class-recordings') this.load();
            } catch (e) {
                window.App?.showToast(e.message, 'error');
            }
        }, save ? 'Saving...' : 'Deleting...');
    },

    // -------------------------------------------------------------------------
    // Player: speed, ±10 s, resume where the viewer stopped
    // -------------------------------------------------------------------------
    openPlayer(recId) {
        const rec = (window.LmsData?.virtualClassRecordings || []).find(r => r.id === recId);
        if (!rec) return;
        if (!rec.videoUrl && rec.externalUrl) {
            window.open(rec.externalUrl, '_blank', 'noopener');
            return;
        }
        if (!rec.videoUrl) {
            window.App?.showToast('The video file for this recording has not been uploaded yet.', 'info');
            return;
        }
        this.closePlayer();
        const download = this.canDownload();
        const speeds = [0.75, 1, 1.25, 1.5, 2];
        const wrap = document.createElement('div');
        wrap.innerHTML = `
            <div class="modal-backdrop open" id="crec-player-modal" style="z-index: 2500;" onclick="if (event.target === this) ClassRecordingsModule.closePlayer()">
                <div class="modal-window" style="max-width: 960px; background: #0b1114; overflow: hidden;">
                    <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
                        <div class="modal-title-group">
                            <h3 style="color: #ffffff; margin: 0; font-size: 1.05rem;"><i class="fas fa-play-circle" style="color: var(--primary-500);"></i> ${Lms.esc(Lms.localName(rec.title, rec.urduTitle, true))}</h3>
                        </div>
                        <button class="icon-btn" onclick="ClassRecordingsModule.closePlayer()" aria-label="Close" style="width: 32px; height: 32px; color: #ffffff; background: rgba(255,255,255,0.12); border-color: transparent;"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body" style="padding: 0; background: #000;">
                        <video id="crec-video" controls playsinline preload="metadata" ${download ? '' : 'controlsList="nodownload" oncontextmenu="return false;"'}
                            style="width: 100%; max-height: 70vh; display: block; outline: none; background: #000;">
                            <source src="${Lms.esc(rec.videoUrl)}" type="${Lms.esc(rec.mimeType || 'video/mp4')}">
                            Your browser does not support HTML5 video.
                        </video>
                        <div style="padding: 12px 18px; background: #162026; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                            <div>
                                <div style="font-weight: 600; color: #ffffff; font-size: 0.92rem;">${Lms.esc(Lms.personName(rec.teacherId, rec.teacherName))}</div>
                                <div style="font-size: 0.78rem; color: #94a3b8;">${Lms.esc(rec.className || Lms.className(rec.classId) || '')} • ${Lms.fmtDate(rec.recordedDate)}${rec.durationFormatted ? ` • ${Lms.esc(rec.durationFormatted)}` : ''}</div>
                            </div>
                            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                                <button class="btn btn-secondary btn-sm" onclick="ClassRecordingsModule.skip(-10)" title="Back 10 seconds"><i class="fas fa-undo"></i> 10s</button>
                                <button class="btn btn-secondary btn-sm" onclick="ClassRecordingsModule.skip(10)" title="Forward 10 seconds">10s <i class="fas fa-redo"></i></button>
                                <select class="form-control" style="width: auto; padding: 4px 8px; font-size: 0.8rem;" title="Playback speed" onchange="ClassRecordingsModule.setSpeed(this.value)">
                                    ${speeds.map(s => `<option value="${s}" ${s === 1 ? 'selected' : ''}>${s}×</option>`).join('')}
                                </select>
                                ${download ? `<a class="btn btn-secondary btn-sm" href="${Lms.esc(this.downloadUrl(rec))}" download><i class="fas fa-download"></i> Download</a>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(wrap.firstElementChild);
        const video = document.getElementById('crec-video');
        const key = `crec-pos:${rec.id}`;
        let saved = 0;
        try { saved = Number(localStorage.getItem(key)) || 0; } catch (e) { /* private mode */ }
        video.addEventListener('loadedmetadata', () => {
            if (saved > 5 && saved < video.duration - 10) {
                video.currentTime = saved;
                window.App?.showToast(I18n.t('Resuming from {time}', { time: this.duration(saved) }), 'info');
            }
        }, { once: true });
        let lastSave = 0;
        video.addEventListener('timeupdate', () => {
            if (Date.now() - lastSave < 5000) return;
            lastSave = Date.now();
            try {
                if (video.duration && video.currentTime > video.duration - 10) localStorage.removeItem(key);
                else localStorage.setItem(key, String(Math.floor(video.currentTime)));
            } catch (e) { /* storage unavailable */ }
        });
        video.addEventListener('error', () => window.App?.showToast('This video could not be loaded. You may not have access to it, or it was removed.', 'error'));
        this._keyHandler = e => {
            if (e.key === 'Escape') this.closePlayer();
            else if (e.target === document.body || e.target === video) {
                if (e.key === 'ArrowLeft') { this.skip(-10); e.preventDefault(); }
                if (e.key === 'ArrowRight') { this.skip(10); e.preventDefault(); }
                if (e.key === ' ') { video.paused ? video.play() : video.pause(); e.preventDefault(); }
            }
        };
        document.addEventListener('keydown', this._keyHandler);
        video.play().catch(() => { /* autoplay blocked: the viewer presses play */ });
    },

    skip(seconds) {
        const v = document.getElementById('crec-video');
        if (v) v.currentTime = Math.max(0, Math.min((v.duration || Infinity), v.currentTime + seconds));
    },

    setSpeed(rate) {
        const v = document.getElementById('crec-video');
        if (v) v.playbackRate = Number(rate) || 1;
    },

    closePlayer() {
        const modal = document.getElementById('crec-player-modal');
        if (modal) {
            const v = modal.querySelector('video');
            if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
            modal.remove();
        }
        if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
        this._keyHandler = null;
    },

    // -------------------------------------------------------------------------
    // Managing recordings
    // -------------------------------------------------------------------------
    find(recId) {
        return (window.LmsData.virtualClassRecordings || []).find(r => r.id === recId);
    },

    openEdit(recId) {
        const rec = this.find(recId);
        if (!rec) return;
        Lms.openModal(
            '<i class="fas fa-pen" style="color: var(--gold-400);"></i> Rename Recording',
            `<div class="form-group" style="margin-bottom: 12px;"><label for="crec-edit-title">Title</label>
                <input type="text" id="crec-edit-title" class="form-control" maxlength="200" value="${Lms.esc(rec.title || '')}"></div>
             <div class="form-group" style="margin-bottom: 0;"><label for="crec-edit-urdu">Urdu title (optional)</label>
                <input type="text" id="crec-edit-urdu" class="form-control" dir="rtl" maxlength="200" value="${Lms.esc(rec.urduTitle || '')}"></div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="ClassRecordingsModule.saveEdit('${Lms.esc(rec.id)}')"><i class="fas fa-save"></i> Save</button>`
        );
    },

    saveEdit(recId) {
        const rec = this.find(recId);
        const title = Lms.val('crec-edit-title');
        if (!rec) return;
        if (!title) {
            window.App?.showToast('Enter a title', 'warning');
            return;
        }
        Object.assign(rec, { title, urduTitle: Lms.val('crec-edit-urdu') });
        window.DataStore.save(window.LmsData);
        window.App?.closeModal();
        window.App?.showToast('Recording renamed', 'success');
        this.refreshList();
    },

    toggleKeep(recId) {
        const rec = this.find(recId);
        if (!rec) return;
        rec.autoDeleteProtected = !rec.autoDeleteProtected;
        window.DataStore.save(window.LmsData);
        window.App?.showToast(rec.autoDeleteProtected ? 'Recording will be kept permanently' : 'Recording follows the retention policy again', 'success');
        this.refreshList();
    },

    confirmDelete(recId) {
        const rec = this.find(recId);
        if (!rec) return;
        Lms.openModal(
            '<i class="fas fa-trash" style="color: var(--danger);"></i> Delete Recording',
            `<p style="margin: 0 0 8px;">Delete <strong>${Lms.esc(rec.title || 'this recording')}</strong>?</p>
             <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">${rec.source === 'LIVE_RECORDING' ? 'The video file is permanently removed from the server. ' : ''}Students will no longer see it. This cannot be undone.</p>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-danger" onclick="ClassRecordingsModule.deleteRecording('${Lms.esc(rec.id)}')"><i class="fas fa-trash"></i> Delete</button>`
        );
    },

    deleteRecording(recId) {
        window.LmsData.virtualClassRecordings = (window.LmsData.virtualClassRecordings || []).filter(r => r.id !== recId);
        window.DataStore.save(window.LmsData);
        window.App?.closeModal();
        window.App?.showToast('Recording deleted', 'info');
        if (window.App?.currentRoute === 'class-recordings') window.App.navigate('class-recordings', { preserveScroll: true });
    }
};

window.ClassRecordingsModule = ClassRecordingsModule;
