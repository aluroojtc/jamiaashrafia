/**
 * JAMIA ASHRAFIA LAHORE - NOTIFICATIONS & BROADCASTS
 * Per-user notification inbox (delivered by the server to a user, a class or a role),
 * read / unread state per person, links to the related page, and targeted broadcasts
 * by administrators (everyone, students, teachers, a class, one person) and teachers (their classes).
 */

const NotificationsModule = {
    filter: 'ALL',
    tab: 'inbox',          // inbox | sent
    sent: null,

    CATEGORIES: {
        ACADEMIC: ['Academic', 'fas fa-book', 'info'],
        EXAM: ['Exams & Results', 'fas fa-award', 'gold'],
        FEE: ['Fees & Payments', 'fas fa-file-invoice-dollar', 'warning'],
        LIVE_CLASS: ['Online Class', 'fas fa-video', 'danger'],
        ADMISSION: ['Admissions', 'fas fa-user-plus', 'primary'],
        GENERAL: ['General', 'fas fa-info-circle', 'info']
    },

    canBroadcast() {
        return window.AuthRBAC.canAny(['notifications.broadcast_all', 'notifications.broadcast_role', 'notifications.send_class']);
    },

    headers() {
        const me = Lms.me();
        return { 'Content-Type': 'application/json' };
    },

    // Offline / locally-created notices are filtered by their target like the server does
    visibleList() {
        const me = Lms.me();
        return (window.LmsData.notifications || []).filter(n => {
            if (!String(n.id || '').startsWith('notif_local')) return true;
            if (n.targetUserId) return n.targetUserId === me.id;
            if (n.targetClassId) return Lms.portal() === 'student' && me.classId === n.targetClassId;
            return !n.targetRole || ['ALL', me.role].includes(n.targetRole);
        });
    },

    render() {
        const list = this.visibleList();
        const unread = list.filter(n => !n.isRead).length;
        const shown = list.filter(n => this.filter === 'ALL' || (this.filter === 'UNREAD' ? !n.isRead : n.category === this.filter));
        const cats = Array.from(new Set(list.map(n => n.category).filter(Boolean)));

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1><i class="fas fa-bell" style="color: var(--gold-400);"></i> Notifications</h1>
                    <p>Assignments, exams, results, fees, online classes and official announcements meant for you</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-secondary btn-sm" onclick="NotificationsModule.markAllAsRead()" ${unread ? '' : 'disabled'}><i class="fas fa-check-double"></i> Mark All as Read</button>
                    ${this.canBroadcast() ? `<button class="btn btn-gold btn-sm" onclick="NotificationsModule.openBroadcastModal()"><i class="fas fa-bullhorn"></i> ${Lms.portal() === 'teacher' ? 'Notify My Students' : 'Send Announcement'}</button>` : ''}
                </div>
            </div>

            ${this.canBroadcast() ? `
                <div class="tabs-nav">
                    <button class="tab-btn ${this.tab === 'inbox' ? 'active' : ''}" onclick="NotificationsModule.setTab('inbox')"><i class="fas fa-inbox"></i> Inbox ${unread ? `<span class="badge-pill gold" style="margin-left: 4px;">${unread}</span>` : ''}</button>
                    <button class="tab-btn ${this.tab === 'sent' ? 'active' : ''}" onclick="NotificationsModule.setTab('sent')"><i class="fas fa-paper-plane"></i> Sent by Me</button>
                </div>` : ''}

            ${this.tab === 'sent' && this.canBroadcast() ? this.renderSent() : `
                <div class="filter-bar" style="flex-wrap: wrap; gap: 6px;">
                    ${[['ALL', 'All'], ['UNREAD', `Unread (${unread})`], ...cats.map(c => [c, (this.CATEGORIES[c] || [c])[0]])].map(([k, l]) => `
                        <button class="btn btn-sm ${this.filter === k ? 'btn-primary' : 'btn-secondary'}" onclick="NotificationsModule.setFilter('${Lms.esc(k)}')">${Lms.esc(l)}</button>`).join('')}
                </div>
                <div class="card">
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${shown.length ? shown.map(n => this.renderItem(n)).join('') : window.App.dashEmpty('No notifications here.')}
                    </div>
                </div>`}
        `;
    },

    renderItem(n) {
        const [label, icon, pill] = this.CATEGORIES[n.category] || [n.category || 'General', 'fas fa-info-circle', 'info'];
        return `
            <div style="display: flex; align-items: flex-start; gap: 14px; padding: 14px; background: ${n.isRead ? 'var(--bg-surface-elevated)' : 'var(--primary-50)'}; border: 1px solid ${n.isRead ? 'var(--border-subtle)' : 'var(--primary-300)'}; border-radius: var(--radius-sm); ${n.linkRoute ? 'cursor: pointer;' : ''}"
                ${n.linkRoute ? `onclick="NotificationsModule.open('${Lms.esc(n.id)}')"` : ''}>
                <div style="width: 38px; height: 38px; flex-shrink: 0; border-radius: 50%; background: var(--bg-surface); border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: center; color: var(--gold-700);">
                    <i class="${icon}"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            ${n.isRead ? '' : '<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--primary-600); display: inline-block;"></span>'}
                            <span style="font-weight: 700; font-size: 0.95rem; color: var(--primary-950);">${Lms.esc(n.title)}</span>
                            <span class="status-pill ${pill}" style="font-size: 0.65rem;">${Lms.esc(label)}</span>
                        </div>
                        <span style="font-size: 0.75rem; color: var(--text-muted);"><i class="fas fa-clock"></i> ${Lms.esc(n.time || '')}</span>
                    </div>
                    <div style="font-size: 0.78rem; color: var(--primary-700); font-weight: 600; margin-bottom: 4px;"><i class="fas fa-paper-plane"></i> ${Lms.esc(n.sender || n.senderName || 'Jamia Ashrafia')}</div>
                    <p style="font-size: 0.86rem; color: var(--text-secondary); line-height: 1.6; margin: 0;">${Lms.multiline(n.message)}</p>
                    ${n.linkRoute ? `<div style="font-size: 0.75rem; color: var(--primary-700); margin-top: 6px; font-weight: 600;">Open <i class="fas fa-arrow-right"></i></div>` : ''}
                </div>
                <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); NotificationsModule.toggleRead('${Lms.esc(n.id)}')" title="${n.isRead ? 'Mark as unread' : 'Mark as read'}">
                    <i class="${n.isRead ? 'fas fa-envelope-open' : 'fas fa-envelope'}"></i>
                </button>
            </div>`;
    },

    setFilter(f) {
        this.filter = f;
        window.App.navigate('notifications');
    },

    setTab(t) {
        this.tab = t;
        if (t === 'sent') this.loadSent();
        window.App.navigate('notifications');
    },

    async sendReadState(ids, unread) {
        if (!ids.length) return;
        try {
            await fetch('/api/notifications/read', {
                method: 'POST',
                headers: this.headers(),
                body: JSON.stringify(ids.length === 1 ? { id: ids[0], unread } : { markAll: true, ids, unread })
            });
        } catch (e) { /* offline: local state only */ }
    },

    async toggleRead(id) {
        const n = (window.LmsData.notifications || []).find(x => x.id === id);
        if (!n) return;
        n.isRead = !n.isRead;
        Lms.save();
        window.App.navigate('notifications', { preserveScroll: true });
        await this.sendReadState([id], !n.isRead);
        window.App.updateNotificationBadge();
    },

    async open(id) {
        const n = (window.LmsData.notifications || []).find(x => x.id === id);
        if (!n) return;
        if (!n.isRead) {
            n.isRead = true;
            Lms.save();
            this.sendReadState([id], false).then(() => window.App.updateNotificationBadge());
        }
        if (n.linkRoute && window.AuthRBAC.canAccessRoute(n.linkRoute)) {
            window.location.hash = n.linkRoute;
            window.App.navigate(n.linkRoute);
        }
    },

    async markAllAsRead() {
        const unread = this.visibleList().filter(n => !n.isRead);
        unread.forEach(n => { n.isRead = true; });
        Lms.save();
        window.App.navigate('notifications');
        await this.sendReadState(unread.map(n => n.id), false);
        window.App.updateNotificationBadge();
        window.App.showToast('All notifications marked as read', 'info');
    },

    // ---------------------------------------------------------------------
    // SENT BY ME
    // ---------------------------------------------------------------------
    async loadSent() {
        try {
            const res = await fetch('/api/notifications?sent=1', { headers: this.headers() });
            const data = await res.json();
            this.sent = data.notifications || [];
        } catch (e) {
            this.sent = [];
        }
        if (window.App.currentRoute === 'notifications' && this.tab === 'sent') window.App.navigate('notifications', { preserveScroll: true });
    },

    audienceLabel(n) {
        if (n.targetUserId) return `To ${Lms.userName(n.targetUserId, 'one person')}`;
        if (n.targetClassId) return `Class: ${Lms.className(n.targetClassId)}`;
        return ({ ALL: 'Everyone', STUDENT: 'All students', TEACHER: 'All teachers', STUDENTS_AND_TEACHERS: 'Students & teachers', ACADEMIC_ADMIN: 'Academic office', ACCOUNTANT: 'Accounts office', SUPER_ADMIN: 'Mohtamim' })[n.targetRole] || n.targetRole;
    },

    renderSent() {
        if (this.sent === null) {
            this.loadSent();
            return `<div class="card">${window.App.dashEmpty('<i class="fas fa-spinner fa-spin"></i> Loading...')}</div>`;
        }
        return `
            <div class="card">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr><th>Announcement</th><th>Audience</th><th>Sent</th><th>Read by</th></tr></thead>
                        <tbody>
                            ${this.sent.length ? this.sent.map(n => `
                                <tr>
                                    <td><div style="font-weight: 700;">${Lms.esc(n.title)}</div><div style="font-size: 0.78rem; color: var(--text-muted); max-width: 420px;">${Lms.esc(String(n.message).slice(0, 140))}</div></td>
                                    <td style="font-size: 0.8rem;">${Lms.esc(this.audienceLabel(n))}</td>
                                    <td style="font-size: 0.8rem;">${Lms.esc(n.time)}</td>
                                    <td><span class="status-pill info">${Number(n.readCount) || 0}</span></td>
                                </tr>`).join('') : `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">You haven't sent any notifications yet.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>`;
    },

    // ---------------------------------------------------------------------
    // BROADCAST
    // ---------------------------------------------------------------------
    openBroadcastModal() {
        // Audiences follow the notification permissions; the server checks the same rules
        const portal = Lms.portal();
        const isTeacher = portal === 'teacher';
        const classIds = Lms.myClassIds();
        const audiences = [];
        if (Lms.can('notifications.broadcast_all')) audiences.push(['ALL', 'Everyone (students, teachers & staff)']);
        if (Lms.can('notifications.broadcast_role')) audiences.push(['STUDENT', 'All students'], ['TEACHER', 'All teachers'], ['STUDENTS_AND_TEACHERS', 'All students & teachers']);
        if (Lms.can('notifications.send_class')) audiences.push(['CLASS', isTeacher ? 'Students of one of my classes' : 'Students of one class']);
        if (Lms.can('notifications.send_individual')) audiences.push(['USER', 'One person']);
        const people = isTeacher
            ? Lms.students().filter(s => classIds.includes(s.classId))
            : (window.LmsData.users || []).filter(u => u.id !== Lms.me().id);
        const financeOnly = Lms.can('fees.challans.generate') && !Lms.can('notifications.send_class');

        Lms.openModal(
            `<i class="fas fa-bullhorn" style="color: var(--gold-400);"></i> ${isTeacher ? 'Notify My Students' : 'Send Announcement'}`,
            `<div class="form-grid">
                <div class="form-group"><label>Send To *</label>
                    <select id="bc-target" class="form-control" onchange="NotificationsModule.toggleAudienceFields()">${audiences.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
                </div>
                <div class="form-group" id="bc-class-wrap" style="display: none;"><label>Class *</label><select id="bc-class" class="form-control">${Lms.classOptions(null, portal === 'staff' ? null : classIds)}</select></div>
                <div class="form-group" id="bc-user-wrap" style="display: none;"><label>Person *</label>
                    <select id="bc-user" class="form-control">${people.map(u => `<option value="${Lms.esc(u.id)}">${Lms.esc(u.name)} — ${Lms.esc(u.rollNo || u.designation || u.role)}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>Category *</label>
                    <select id="bc-cat" class="form-control">${Object.entries(this.CATEGORIES).filter(([k]) => !financeOnly || ['FEE', 'GENERAL'].includes(k)).map(([k, [l]]) => `<option value="${k}" ${(financeOnly ? 'FEE' : 'ACADEMIC') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
                </div>
            </div>
            <div class="form-group"><label>Title *</label><input type="text" id="bc-title" class="form-control" maxlength="200" placeholder="e.g. Special Dars-e-Hadith on Thursday"></div>
            <div class="form-group" style="margin-top: 10px;"><label>Message *</label><textarea id="bc-msg" class="form-control" style="min-height: 120px;" placeholder="Write the full announcement..."></textarea></div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="NotificationsModule.sendBroadcast(this)"><i class="fas fa-paper-plane"></i> Send</button>`
        );
        this.toggleAudienceFields();
    },

    toggleAudienceFields() {
        const t = Lms.val('bc-target');
        document.getElementById('bc-class-wrap').style.display = t === 'CLASS' ? '' : 'none';
        document.getElementById('bc-user-wrap').style.display = t === 'USER' ? '' : 'none';
    },

    async sendBroadcast(btn) {
        const title = Lms.val('bc-title');
        const message = document.getElementById('bc-msg').value.trim();
        const target = Lms.val('bc-target');
        const category = Lms.val('bc-cat');
        if (!title || !message) {
            window.App.showToast('Please provide a title and message', 'warning');
            return;
        }
        const n = { title, message, category };
        if (target === 'CLASS') Object.assign(n, { targetClassId: Lms.val('bc-class'), targetRole: 'STUDENT' });
        else if (target === 'USER') Object.assign(n, { targetUserId: Lms.val('bc-user') });
        else n.targetRole = target;
        if ((target === 'CLASS' && !n.targetClassId) || (target === 'USER' && !n.targetUserId)) {
            window.App.showToast('Choose who should receive this', 'warning');
            return;
        }
        await Lms.busy(btn, async () => {
            const res = await fetch('/api/notifications', { method: 'POST', headers: this.headers(), body: JSON.stringify({ ...n, senderName: Lms.me().name }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Could not send (${res.status})`);
            window.App.closeModal();
            window.App.playChime();
            window.App.showToast(`Sent to ${this.audienceLabel(n)}`, 'gold');
            this.sent = null;
            window.App.updateNotificationBadge();
            window.App.navigate('notifications');
        }, 'Sending...');
    }
};

window.NotificationsModule = NotificationsModule;
