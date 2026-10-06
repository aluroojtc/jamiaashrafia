/**
 * JAMIA ASHRAFIA LAHORE - SHARED LMS HELPERS
 * Escaping, modals, file uploads, notifications and academic lookups used by every module.
 */

const Lms = {
    // ---------------------------------------------------------------------
    // Formatting & safety
    // ---------------------------------------------------------------------
    esc(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    // Escaped text with line breaks preserved
    multiline(value) {
        return this.esc(value).replace(/\n/g, '<br>');
    },

    // Random temporary password for accounts created or reset by staff (the person must change it at first sign-in)
    tempPassword(length = 10) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const bytes = new Uint32Array(length);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, b => chars[b % chars.length]).join('');
    },

    MIN_PASSWORD_LENGTH: 8,

    // Changes the signed-in user's own password; resolves to null on success or an error message
    async changeOwnPassword(currentPassword, newPassword) {
        if (String(newPassword || '').length < this.MIN_PASSWORD_LENGTH) return `The new password must be at least ${this.MIN_PASSWORD_LENGTH} characters.`;
        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            const data = await res.json().catch(() => ({}));
            return res.ok && data.success ? null : (data.error || `Password could not be changed (${res.status}).`);
        } catch (e) {
            return 'The portal server cannot be reached. Please try again.';
        }
    },

    openChangePasswordModal() {
        this.openModal(
            `<i class="fas fa-key" style="color: var(--gold-400);"></i> Change Password`,
            `<div class="form-group"><label for="cpw-current">Current password</label><input type="password" id="cpw-current" class="form-control" autocomplete="current-password"></div>
             <div class="form-group"><label for="cpw-new">New password</label><input type="password" id="cpw-new" class="form-control" autocomplete="new-password">
                <small style="color: var(--text-muted);">At least ${this.MIN_PASSWORD_LENGTH} characters. Other devices signed in to your account will be signed out.</small></div>
             <div class="form-group"><label for="cpw-confirm">Confirm new password</label><input type="password" id="cpw-confirm" class="form-control" autocomplete="new-password"></div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="Lms.submitChangePassword(this)"><i class="fas fa-save"></i> Change Password</button>`
        );
    },

    async submitChangePassword(btn) {
        const next = this.val('cpw-new');
        if (next !== this.val('cpw-confirm')) {
            window.App.showToast('The two new passwords do not match.', 'warning');
            return;
        }
        const error = await this.busy(btn, () => this.changeOwnPassword(document.getElementById('cpw-current').value, next), 'Saving...');
        if (error) {
            window.App.showToast(error, 'danger');
            return;
        }
        window.App.closeModal();
        window.App.showToast('Your password has been changed.', 'success');
    },

    uid(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    },

    today() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    addDays(dateStr, days) {
        const d = new Date(`${dateStr}T00:00:00`);
        d.setDate(d.getDate() + days);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    fmtDate(value) {
        if (!value) return '—';
        const d = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
        if (isNaN(d)) return this.esc(value);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    fmtDateTime(value) {
        if (!value) return '—';
        const d = new Date(value);
        if (isNaN(d)) return this.esc(value);
        return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    },

    // "14:15" -> "02:15 PM"
    fmtTime(hhmm) {
        const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})/);
        if (!m) return hhmm || '';
        let h = parseInt(m[1], 10);
        const ap = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${String(h).padStart(2, '0')}:${m[2]} ${ap}`;
    },

    money(n) {
        return 'PKR ' + (Number(n) || 0).toLocaleString('en-PK');
    },

    fileSize(bytes) {
        const b = Number(bytes) || 0;
        if (b < 1024) return `${b} B`;
        if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
        return `${(b / 1024 / 1024).toFixed(1)} MB`;
    },

    initials(name) {
        return String(name || '').split(/\s+/).filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'JA';
    },

    // Wifaq-ul-Madaris grading scale
    wifaqGrade(percent) {
        const p = Number(percent) || 0;
        if (p >= 80) return { code: 'MUMTAZ', urdu: 'ممتاز', label: 'Mumtaz (Excellent)', pill: 'success' };
        if (p >= 70) return { code: 'JAYYID_JIDDAN', urdu: 'جید جدا', label: 'Jayyid Jiddan (Very Good)', pill: 'success' };
        if (p >= 60) return { code: 'JAYYID', urdu: 'جید', label: 'Jayyid (Good)', pill: 'info' };
        if (p >= 40) return { code: 'MAQBOOL', urdu: 'مقبول', label: 'Maqbool (Pass)', pill: 'warning' };
        return { code: 'RASIB', urdu: 'راسب', label: 'Rasib (Fail)', pill: 'danger' };
    },

    // ---------------------------------------------------------------------
    // Modal shortcuts
    // ---------------------------------------------------------------------
    openModal(titleHtml, bodyHtml, footerHtml, opts = {}) {
        document.getElementById('modal-title-text').innerHTML = titleHtml;
        document.getElementById('modal-body-container').innerHTML = bodyHtml;
        document.getElementById('modal-footer-container').innerHTML = footerHtml
            || `<button class="btn btn-secondary" onclick="App.closeModal()">Close</button>`;
        const win = document.querySelector('#global-modal-backdrop .modal-window');
        if (win) win.style.maxWidth = opts.wide ? '980px' : '';
        window.App.openModal();
    },

    val(id) {
        const el = document.getElementById(id);
        return el ? String(el.value || '').trim() : '';
    },

    // ---------------------------------------------------------------------
    // Current user & academic lookups
    // ---------------------------------------------------------------------
    me() {
        return window.AuthRBAC.currentUser || {};
    },

    role() {
        return window.AuthRBAC.getRole();
    },

    // Whole-institution staff (the office), as opposed to the teacher or student portals
    isStaffAdmin() {
        return window.AuthRBAC.scope() === 'ALL';
    },

    can(permission) {
        return window.AuthRBAC.can(permission);
    },

    // 'staff' | 'teacher' | 'student': which version of a page to show (follows the role's data scope)
    portal() {
        return window.AuthRBAC.portal();
    },

    user(id) {
        return (window.LmsData.users || []).find(u => u.id === id) || null;
    },

    userName(id, fallback = '—') {
        const u = this.user(id);
        return u ? u.name : fallback;
    },

    teachers() {
        return (window.LmsData.users || []).filter(u => u.role === 'TEACHER' && u.status !== 'INACTIVE');
    },

    students() {
        return (window.LmsData.users || []).filter(u => u.role === 'STUDENT');
    },

    getClass(id) {
        return (window.LmsData.classes || []).find(c => c.id === id) || null;
    },

    className(id) {
        if (id === 'all') return 'All Classes';
        const c = this.getClass(id);
        return c ? `${c.name}${c.section ? ' — ' + c.section : ''}` : (id || '—');
    },

    getCourse(id) {
        return (window.LmsData.courses || []).find(c => c.id === id) || null;
    },

    courseTitle(id) {
        const c = this.getCourse(id);
        return c ? c.title : '—';
    },

    program(id) {
        return (window.LmsData.programs || []).find(p => p.id === id) || null;
    },

    studentsInClass(classId) {
        return this.students().filter(s => s.classId === classId && s.status !== 'INACTIVE');
    },

    // Classes a teacher is responsible for: class teacher or teaching one of its kitabs
    teacherClassIds(teacherId) {
        return (window.LmsData.classes || [])
            .filter(c => c.teacherId === teacherId || (c.courseTeachers || []).some(ct => ct.teacherId === teacherId))
            .map(c => c.id);
    },

    // Course ids taught by a teacher in a class (or anywhere when classId is omitted)
    teacherCourseIds(teacherId, classId) {
        const ids = new Set();
        (window.LmsData.classes || []).forEach(c => {
            if (classId && c.id !== classId) return;
            (c.courseTeachers || []).forEach(ct => { if (ct.teacherId === teacherId) ids.add(ct.courseId); });
        });
        const u = this.user(teacherId);
        if (!classId && u && Array.isArray(u.assignedCourses)) u.assignedCourses.forEach(id => ids.add(id));
        return Array.from(ids);
    },

    classCourseIds(classId) {
        const c = this.getClass(classId);
        return c ? (c.courseTeachers || []).map(ct => ct.courseId) : [];
    },

    courseTeacherId(classId, courseId) {
        const c = this.getClass(classId);
        const ct = c && (c.courseTeachers || []).find(x => x.courseId === courseId);
        return ct ? ct.teacherId : (c ? c.teacherId : null);
    },

    // Classes the signed-in user can see / act on
    myClassIds() {
        const me = this.me();
        const portal = this.portal();
        if (portal === 'staff') return (window.LmsData.classes || []).map(c => c.id);
        if (portal === 'teacher') return this.teacherClassIds(me.id);
        return me.classId ? [me.classId] : [];
    },

    classOptions(selectedId, ids) {
        const list = (window.LmsData.classes || []).filter(c => !ids || ids.includes(c.id));
        return list.map(c => `<option value="${this.esc(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${this.esc(c.name)} — ${this.esc(c.section || '')}</option>`).join('');
    },

    courseOptions(selectedId, ids) {
        const list = (window.LmsData.courses || []).filter(c => !ids || ids.includes(c.id));
        return list.map(c => `<option value="${this.esc(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${this.esc(c.code)} — ${this.esc(c.title)}</option>`).join('');
    },

    teacherOptions(selectedId, includeNone) {
        return (includeNone ? `<option value="">— Not assigned —</option>` : '') + this.teachers()
            .map(t => `<option value="${this.esc(t.id)}" ${t.id === selectedId ? 'selected' : ''}>${this.esc(t.name)}${t.designation ? ' (' + this.esc(t.designation) + ')' : ''}</option>`).join('');
    },

    // ---------------------------------------------------------------------
    // Persistence
    // ---------------------------------------------------------------------
    save() {
        window.DataStore.save(window.LmsData);
    },

    // ---------------------------------------------------------------------
    // File uploads (stored on the server under /uploads)
    // ---------------------------------------------------------------------
    async uploadFile(file) {
        if (!file) return null;
        if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name} is larger than 25 MB`);
        const res = await fetch('/api/uploads', {
            method: 'POST',
            headers: {
                'Content-Type': file.type || 'application/octet-stream',
                'X-File-Name': encodeURIComponent(file.name)
            },
            body: file
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || `Upload failed (${res.status})`);
        return data.file;
    },

    async uploadFromInput(inputId) {
        const input = document.getElementById(inputId);
        const files = input && input.files ? Array.from(input.files) : [];
        const uploaded = [];
        for (const f of files) uploaded.push(await this.uploadFile(f));
        return uploaded;
    },

    fileInput(id, opts = {}) {
        return `
            <label for="${id}" class="lms-dropzone" style="display: block; border: 2px dashed var(--border-prominent); padding: 18px; text-align: center; border-radius: var(--radius-sm); cursor: pointer; background: var(--bg-surface-elevated);">
                <i class="fas fa-cloud-upload-alt" style="font-size: 1.8rem; color: var(--primary-700); margin-bottom: 6px;"></i>
                <div style="font-size: 0.85rem; color: var(--text-primary);">${this.esc(opts.label || 'Click to choose file(s)')}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">${this.esc(opts.hint || 'PDF, Word, images, ZIP • max 25 MB each')}</div>
                <div id="${id}-names" style="font-size: 0.78rem; color: var(--primary-700); margin-top: 6px; font-weight: 600;"></div>
                <input type="file" id="${id}" ${opts.multiple ? 'multiple' : ''} accept="${opts.accept || '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt,.zip,.ppt,.pptx,.xls,.xlsx'}" style="display: none;"
                    onchange="document.getElementById('${id}-names').textContent = Array.from(this.files).map(f => f.name + ' (' + Lms.fileSize(f.size) + ')').join(', ')">
            </label>`;
    },

    fileLinks(files) {
        if (!files || !files.length) return '';
        return files.map(f => `
            <a href="${this.esc(f.url)}" target="_blank" rel="noopener" class="status-pill info" style="text-decoration: none; font-size: 0.72rem; margin: 2px 4px 2px 0; display: inline-flex;">
                <i class="fas fa-paperclip"></i> ${this.esc(f.name)}${f.size ? ' · ' + this.fileSize(f.size) : ''}
            </a>`).join('');
    },

    // Disable a button while an async action runs
    async busy(btn, fn, label = 'Saving...') {
        const original = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${label}`; }
        try {
            return await fn();
        } catch (err) {
            window.App.showToast(err.message || 'Something went wrong', 'error');
            return undefined;
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = original; }
        }
    },

    // ---------------------------------------------------------------------
    // Notifications: delivered through the server to a user, a class, or a role
    // ---------------------------------------------------------------------
    async notify(items) {
        const list = (Array.isArray(items) ? items : [items]).filter(n => n && n.title && n.message);
        if (!list.length) return;
        const me = this.me();
        const payload = list.map(n => ({
            senderName: n.senderName || me.name || 'Jamia Ashrafia',
            category: n.category || 'GENERAL',
            ...n
        }));
        try {
            const res = await fetch('/api/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notifications: payload })
            });
            if (res.status >= 400 && res.status < 500) {
                console.warn('[Notify] Rejected:', (await res.json().catch(() => ({}))).error || res.status);
                return;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            console.warn('[Notify] Server unavailable, notification kept locally:', err.message);
            // Offline fallback: show to this browser only
            payload.forEach(n => {
                (window.LmsData.notifications = window.LmsData.notifications || []).unshift({
                    id: this.uid('notif_local'), sender: n.senderName, title: n.title, message: n.message,
                    category: n.category, time: new Date().toLocaleString(), isRead: false,
                    targetRole: n.targetRole, targetUserId: n.targetUserId, targetClassId: n.targetClassId, linkRoute: n.linkRoute
                });
            });
            this.save();
        }
        if (window.App) window.App.updateNotificationBadge();
    },

    notifyUser(userId, title, message, category, linkRoute) {
        if (!userId) return Promise.resolve();
        return this.notify({ targetUserId: userId, title, message, category, linkRoute });
    },

    notifyClass(classId, title, message, category, linkRoute) {
        if (!classId) return Promise.resolve();
        return this.notify({ targetClassId: classId, targetRole: 'STUDENT', title, message, category, linkRoute });
    }
};

window.Lms = Lms;
