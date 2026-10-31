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

    // Records keep an English name and often an Urdu / Arabic one (urduName, urduTitle, arabicTitle).
    // Pages show one of them, never both: the native-script name in Urdu and Arabic, the English one otherwise.
    // urduOnly: the field holds Urdu wording rather than a proper name, so Arabic pages keep the English
    // (which the catalog translates when it can).
    localName(english, native, urduOnly) {
        const lang = window.I18n ? window.I18n.lang : 'en';
        const useNative = lang === 'ur' || (lang === 'ar' && !urduOnly);
        if (useNative && native && String(native).trim()) return native;
        return english || native || '';
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

    // Copy button (js/copy-button.js) for an ID, username or password; label is its tooltip, e.g. 'Copy password'
    copyBtn(text, label, opts) {
        return window.CopyButton ? window.CopyButton.html(text, label, opts) : '';
    },

    // Login details to hand over (portal address, username, password …), each line with its own copy button
    // plus one that copies them all for pasting into a message. rows: [{ label, value, copyLabel }]
    credentialsCard(rows) {
        const list = rows.filter(r => r && r.value);
        const label = l => (window.I18n && window.I18n.translateText ? window.I18n.translateText(l) : l);
        const all = list.map(r => `${label(r.label)}: ${r.value}`).join('\n');
        return `
            <div class="credentials-card">
                ${list.map(r => `
                    <div class="credentials-row">
                        <span class="credentials-label">${this.esc(r.label)}:</span>
                        <span class="credentials-value" translate="no">${this.esc(r.value)}</span>
                        ${this.copyBtn(r.value, r.copyLabel || 'Copy')}
                    </div>`).join('')}
            </div>
            <div class="credentials-actions">${this.copyBtn(all, 'Copy all login details', { text: 'Copy all' })}</div>`;
    },

    // Modal shown after an account is created or its password reset
    credentialsModal(titleHtml, introHtml, rows, footerHtml) {
        this.openModal(
            titleHtml,
            `<p style="margin-bottom: 12px;">${introHtml}</p>
             ${this.credentialsCard(rows)}
             <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 10px;">The password is temporary: it must be changed at first sign-in.</p>`,
            footerHtml || `<button class="btn btn-primary" onclick="App.closeModal()"><i class="fas fa-check"></i> Done</button>`
        );
    },

    portalUrl() {
        return `${location.origin}/`;
    },

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

    // ---------------------------------------------------------------------
    // Gender ('MALE' | 'FEMALE'; records made before it was asked have none)
    // ---------------------------------------------------------------------
    GENDERS: { MALE: 'Male', FEMALE: 'Female' },

    genderLabel(g) {
        return this.GENDERS[g] || 'Not specified';
    },

    genderOptions(selected, includeNone = true) {
        return (includeNone ? `<option value="" ${!selected ? 'selected' : ''}>— Select gender —</option>` : '')
            + Object.entries(this.GENDERS).map(([v, l]) => `<option value="${v}" ${selected === v ? 'selected' : ''}>${l}</option>`).join('');
    },

    genderPill(g) {
        if (!this.GENDERS[g]) return '';
        const female = g === 'FEMALE';
        return `<span class="status-pill ${female ? 'gold' : 'info'}" style="font-size: 0.65rem; padding: 1px 8px;"><i class="fas ${female ? 'fa-venus' : 'fa-mars'}"></i> ${this.GENDERS[g]}</span>`;
    },

    // "Son of" / "Daughter of" (short: "S/O" / "D/O"); "Son of" when the gender is not recorded, as before
    parentOf(g, short) {
        if (g === 'FEMALE') return short ? 'D/O' : 'Daughter of';
        return short ? 'S/O' : 'Son of';
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

    // Attendance % from the student's real records (late counts as 75%), or null when nothing is recorded yet
    attendancePct(userId) {
        const recs = (window.LmsData.attendance || []).filter(r => r.userId === userId);
        if (!recs.length) return null;
        const present = recs.filter(r => r.status === 'PRESENT').length;
        const late = recs.filter(r => r.status === 'LATE').length;
        return Math.round(((present + late * 0.75) / recs.length) * 100);
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

    // Grouped by campus for people who work at more than one (the server only sends classes of their campuses)
    classOptions(selectedId, ids) {
        const list = (window.LmsData.classes || []).filter(c => !ids || ids.includes(c.id));
        const option = c => `<option value="${this.esc(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${this.esc(c.name)} — ${this.esc(c.section || '')}</option>`;
        const campuses = Array.from(new Set(list.map(c => c.branchId || '')));
        if (campuses.length < 2) return list.map(option).join('');
        return campuses.map(b => `<optgroup label="${this.esc(this.branchName(b) || I18n.t('Campus not set'))}">${list.filter(c => (c.branchId || '') === b).map(option).join('')}</optgroup>`).join('');
    },

    courseOptions(selectedId, ids) {
        const list = (window.LmsData.courses || []).filter(c => !ids || ids.includes(c.id));
        return list.map(c => `<option value="${this.esc(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${this.esc(c.code)} — ${this.esc(c.title)}</option>`).join('');
    },

    // With a campus: only teachers who work there (the server refuses to place anyone else on a class)
    teacherOptions(selectedId, includeNone, branchId) {
        return (includeNone ? `<option value="">— Not assigned —</option>` : '') + this.teachers()
            .filter(t => !branchId || t.id === selectedId || this.worksAtCampus(t, branchId))
            .map(t => `<option value="${this.esc(t.id)}" ${t.id === selectedId ? 'selected' : ''}>${this.esc(t.name)}${t.designation ? ' (' + this.esc(t.designation) + ')' : ''}</option>`).join('');
    },

    // ---------------------------------------------------------------------
    // Persistence
    // ---------------------------------------------------------------------
    save() {
        window.DataStore.save(window.LmsData);
    },

    // JSON call to the portal API; resolves to the response body, throws with the server's message on failure
    async api(method, url, body) {
        const res = await fetch(url, {
            method,
            headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
            cache: 'no-store'
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.error || data.message || `Request failed (${res.status})`);
        return data;
    },

    // Campuses set up in Institution Setup (loaded from the server at start-up)
    branches() {
        return ((window.LmsData.institution || {}).branches || []);
    },

    branchName(id) {
        const b = this.branches().find(x => x.id === id);
        return b ? b.name : '';
    },

    // "Address, City" without repeating a city the address already names
    branchLocation(b) {
        const address = String((b && b.address) || '').trim();
        const city = String((b && b.city) || '').trim();
        return city && !address.toLowerCase().includes(city.toLowerCase()) ? [address, city].filter(Boolean).join(', ') : address || city;
    },

    // The campus new records start with: the main campus chosen in Institution Setup, else the first one listed
    // (limited to the campuses of the signed-in person: their home campus first)
    defaultBranchId() {
        const list = this.myBranches().length ? this.myBranches() : this.branches();
        const home = (window.AuthRBAC.currentUser || {}).branchId;
        const main = (window.LmsData.institution || {}).mainBranchId;
        if (main && list.some(b => b.id === main)) return main;
        if (home && list.some(b => b.id === home)) return home;
        return list.length ? list[0].id : '';
    },

    // Campuses the signed-in person may choose (the server checks the same on every record)
    myBranches() {
        return this.branches().filter(b => window.AuthRBAC.hasCampus(b.id));
    },

    branchOptions(selectedId, includeNone, all) {
        const list = all ? this.branches() : this.myBranches();
        // A record already at a campus outside the list keeps showing it
        const extra = selectedId && !list.some(b => b.id === selectedId) ? this.branches().filter(b => b.id === selectedId) : [];
        return (includeNone ? `<option value="">— Not set —</option>` : '') + list.concat(extra)
            .map(b => `<option value="${this.esc(b.id)}" ${b.id === selectedId ? 'selected' : ''}>${this.esc(b.name)}</option>`).join('');
    },

    // "All campuses" or the names of an account's campuses (students: their one campus)
    campusSummary(user) {
        if (!user) return '';
        if (user.role === 'SUPER_ADMIN' || (user.role !== 'STUDENT' && user.allCampuses === true)) return I18n.t('All campuses');
        const ids = user.role === 'STUDENT' ? [user.branchId] : Array.from(new Set([...(user.campusIds || []), user.branchId].filter(Boolean)));
        return ids.map(id => this.branchName(id) || id).filter(Boolean).join(', ') || '—';
    },

    /**
     * Campus access for a staff or teacher account: home campus, "all campuses" and the campuses they work at.
     * Only campuses the signed-in person has can be given, and "all campuses" only by someone who has all of them.
     */
    campusAccessFields(prefix, user) {
        const u = user || {};
        const mine = this.myBranches();
        const canAll = window.AuthRBAC.hasAllCampuses();
        const all = canAll && (user ? u.allCampuses === true : false);
        const home = u.branchId && this.branches().some(b => b.id === u.branchId) ? u.branchId : this.defaultBranchId();
        const held = new Set([...(u.campusIds || []), home].filter(Boolean));
        const box = b => `<label style="display: inline-flex; align-items: center; gap: 6px; margin: 0 14px 6px 0; font-size: 0.85rem;">
                <input type="checkbox" class="${prefix}-campus" value="${this.esc(b.id)}" ${held.has(b.id) ? 'checked' : ''} ${all ? 'disabled' : ''}> ${this.esc(b.name)}</label>`;
        return `
            <div style="margin-bottom: 16px; padding: 12px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px;">
                <label class="form-label" style="font-weight: 600; display: block; margin-bottom: 6px;"><i class="fas fa-map-marker-alt"></i> ${I18n.t('Campus access')}</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px;">
                    <div>
                        <small style="color: var(--text-muted);">${I18n.t('Home campus')}</small>
                        <select id="${prefix}-home-campus" class="form-control">${this.branchOptions(home)}</select>
                    </div>
                    <div style="display: flex; align-items: flex-end;">
                        ${canAll ? `<label style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
                            <input type="checkbox" id="${prefix}-all-campuses" ${all ? 'checked' : ''}
                                onchange="document.querySelectorAll('.${prefix}-campus').forEach(c => { c.disabled = this.checked; })"> ${I18n.t('All campuses')}</label>` : ''}
                    </div>
                </div>
                <small style="color: var(--text-muted); display: block; margin-bottom: 4px;">${I18n.t('Works at these campuses')}</small>
                <div>${mine.map(box).join('') || `<em>${I18n.t('No campuses are set up yet.')}</em>`}</div>
            </div>`;
    },

    readCampusAccess(prefix) {
        const allBox = document.getElementById(`${prefix}-all-campuses`);
        const branchId = this.val(`${prefix}-home-campus`) || this.defaultBranchId() || null;
        if (allBox && allBox.checked) return { branchId, allCampuses: true, campusIds: [] };
        const ids = Array.from(document.querySelectorAll(`.${prefix}-campus`)).filter(c => c.checked).map(c => c.value);
        return { branchId, allCampuses: false, campusIds: Array.from(new Set([...ids, branchId].filter(Boolean))) };
    },

    worksAtCampus(user, branchId) {
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN' || (user.role !== 'STUDENT' && user.allCampuses === true)) return true;
        return user.branchId === branchId || (user.role !== 'STUDENT' && (user.campusIds || []).includes(branchId));
    },

    // A course with no campuses listed is taught at every campus
    courseAtCampus(course, branchId) {
        const ids = (course && course.campusIds) || [];
        return !ids.length || !branchId || ids.includes(branchId);
    },

    // Whether the signed-in person has every campus of this account (only then may they change it)
    managesCampusesOf(user) {
        if (window.AuthRBAC.hasAllCampuses()) return true;
        if (!user || user.role === 'SUPER_ADMIN' || (user.role !== 'STUDENT' && user.allCampuses === true)) return false;
        const ids = user.role === 'STUDENT' ? [user.branchId] : [...(user.campusIds || []), user.branchId];
        return ids.filter(Boolean).every(id => window.AuthRBAC.hasCampus(id));
    },

    // Campus filter for lists (only shown to people with more than one campus)
    campusFilterSelect(id, selected, onchange) {
        const mine = this.myBranches();
        if (mine.length < 2) return '';
        return `<select id="${id}" class="form-control" style="max-width: 240px;" onchange="${onchange}">
                <option value="">${I18n.t('All my campuses')}</option>
                ${mine.map(b => `<option value="${this.esc(b.id)}" ${b.id === selected ? 'selected' : ''}>${this.esc(b.name)}</option>`).join('')}
            </select>`;
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
