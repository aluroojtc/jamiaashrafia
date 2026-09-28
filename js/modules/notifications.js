/**
 * JAMIA ASHRAFIA LAHORE - NOTIFICATIONS & BROADCAST ANNOUNCEMENTS
 * Real-time notification center, unread counters, audio alerts, and cohort broadcasts
 */

const NotificationsModule = {
    render() {
        const notifs = window.LmsData.notifications;
        const canBroadcast = window.AuthRBAC.isAdmin() || window.AuthRBAC.can("notifications:broadcast");

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-bell" style="color: var(--gold-400);"></i>
                        Institutional Notifications & Broadcasts
                    </h1>
                    <p>Academic dispatches from Hazrat Mohtamim, examination schedules, fee alerts, and class bulletins</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-secondary btn-sm" onclick="NotificationsModule.markAllAsRead()">
                        <i class="fas fa-check-double"></i> Mark All as Read
                    </button>
                    ${canBroadcast ? `
                        <button class="btn btn-gold btn-sm" onclick="NotificationsModule.openBroadcastModal()">
                            <i class="fas fa-bullhorn"></i> Send Official Broadcast
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- NOTIFICATIONS LIST -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-inbox"></i> Incoming Notification Stream
                    </h3>
                    <span class="status-pill gold">${notifs.filter(n => !n.isRead).length} Unread Alerts</span>
                </div>

                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${notifs.length > 0 ? notifs.map(n => {
                        let icon = 'fas fa-info-circle';
                        let pillClass = 'info';
                        if (n.category === 'EXAM') { icon = 'fas fa-award'; pillClass = 'gold'; }
                        else if (n.category === 'LIVE_CLASS') { icon = 'fas fa-video'; pillClass = 'danger'; }
                        else if (n.category === 'FEE') { icon = 'fas fa-file-invoice-dollar'; pillClass = 'warning'; }

                        return `
                            <div style="display: flex; align-items: flex-start; gap: 16px; padding: 16px; background: ${n.isRead ? 'var(--bg-surface-elevated)' : 'rgba(6, 78, 59, 0.2)'}; border: 1px solid ${n.isRead ? 'var(--border-subtle)' : 'var(--primary-600)'}; border-radius: var(--radius-sm); transition: all var(--transition-fast);">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(0,0,0,0.3); border: 1px solid var(--border-prominent); display: flex; align-items: center; justify-content: center; color: var(--gold-300); font-size: 1.1rem; flex-shrink: 0;">
                                    <i class="${icon}"></i>
                                </div>
                                <div style="flex: 1;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <span style="font-weight: 700; font-size: 0.95rem; color: #ffffff;">${n.title}</span>
                                            <span class="status-pill ${pillClass}" style="font-size: 0.65rem;">${n.badge || n.category}</span>
                                        </div>
                                        <span style="font-size: 0.75rem; color: var(--text-muted);"><i class="fas fa-clock"></i> ${n.time}</span>
                                    </div>
                                    <div style="font-size: 0.78rem; color: var(--primary-400); font-weight: 600; margin-bottom: 4px;">
                                        <i class="fas fa-paper-plane"></i> From: ${n.sender}
                                    </div>
                                    <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">
                                        ${n.message}
                                    </p>
                                </div>
                                <button class="btn btn-secondary btn-sm" onclick="NotificationsModule.toggleRead('${n.id}')" title="Toggle read state">
                                    <i class="${n.isRead ? 'fas fa-envelope-open' : 'fas fa-envelope'}"></i>
                                </button>
                            </div>
                        `;
                    }).join('') : '<div style="text-align: center; color: var(--text-muted); padding: 30px;">No notifications.</div>'}
                </div>
            </div>
        `;
    },

    toggleRead(id) {
        const notif = window.LmsData.notifications.find(n => n.id === id);
        if (notif) {
            notif.isRead = !notif.isRead;
            window.DataStore.save(window.LmsData);
            window.App.updateNotificationBadge();
            window.App.navigate('notifications');
        }
    },

    markAllAsRead() {
        window.LmsData.notifications.forEach(n => n.isRead = true);
        window.DataStore.save(window.LmsData);
        window.App.updateNotificationBadge();
        window.App.showToast("All notifications marked as read", "info");
        window.App.navigate('notifications');
    },

    openBroadcastModal() {
        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-bullhorn" style="color: var(--gold-400);"></i> Send Official Broadcast Announcement`;
        modalBody.innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    <label>Target Audience / Cohort *</label>
                    <select id="bc-target" class="form-control">
                        <option value="ALL">All Students & Teachers (Entire Jamia)</option>
                        <option value="STUDENTS">All Enrolled Scholars (Dars-e-Nizami)</option>
                        <option value="TEACHERS">All Asatizah & Faculty</option>
                        <option value="HOSTEL">Resident Hostel Students Only</option>
                        <option value="DONORS">Donors & Muhsineen</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Announcement Category *</label>
                    <select id="bc-cat" class="form-control">
                        <option value="ACADEMIC">Academic / Curricular Notice</option>
                        <option value="EXAM">Examination & Results</option>
                        <option value="FEE">Finance & Fee Notice</option>
                        <option value="LIVE_CLASS">Virtual Classroom Alert</option>
                        <option value="GENERAL">General Institutional Announcement</option>
                    </select>
                </div>
            </div>

            <div class="form-group" style="margin-top: 10px;">
                <label>Announcement Title *</label>
                <input type="text" id="bc-title" class="form-control" placeholder="e.g. Special Dars-e-Hadith by Visiting Muhaddith">
            </div>

            <div class="form-group" style="margin-top: 10px;">
                <label>Notification Message & Details *</label>
                <textarea id="bc-msg" class="form-control" placeholder="Write full text of the decree or notification..."></textarea>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Cancel</button>
            <button class="btn btn-gold" onclick="NotificationsModule.sendBroadcast()">
                <i class="fas fa-paper-plane"></i> Broadcast Notice
            </button>
        `;
        window.App.openModal();
    },

    sendBroadcast() {
        const title = document.getElementById('bc-title').value.trim();
        const msg = document.getElementById('bc-msg').value.trim();
        const cat = document.getElementById('bc-cat').value;
        const target = document.getElementById('bc-target').value;

        if (!title || !msg) {
            window.App.showToast("Please provide title and message", "warning");
            return;
        }

        const newNotice = {
            id: `notif_${Date.now()}`,
            sender: window.AuthRBAC.currentUser?.name || "Nazim-e-Taleemat Jamia Ashrafia",
            title: title,
            message: msg,
            time: "Just now",
            isRead: false,
            category: cat,
            badge: target === 'ALL' ? 'University Wide' : target
        };

        window.LmsData.notifications.unshift(newNotice);
        window.DataStore.save(window.LmsData);
        window.App.closeModal();
        window.App.playChime();
        window.App.updateNotificationBadge();
        window.App.showToast(`Broadcast published to ${target}!`, "gold");
        window.App.navigate('notifications');
    }
};

window.NotificationsModule = NotificationsModule;
