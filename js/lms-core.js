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
    },

    // ---------------------------------------------------------------------
    // Table filters
    // One bar for every data table (or card grid): search, dropdowns, a date range, Apply and Clear.
    // It only hides rows the page already rendered, so it can never show a record the
    // signed-in person's role or campuses do not allow.
    //
    //   Lms.filterBar('students-table', {
    //       search: 'Search name or roll no...',
    //       selects: [{ key: 'status', label: 'All statuses', options: [['ACTIVE', 'Active'], ...] },
    //                 { col: 2, label: 'All classes' }],           // options taken from the column's text
    //       date: { key: 'date', label: 'Date' }                    // rows carry data-f-date="YYYY-MM-DD"
    //   })
    //
    // Rows declare values as data-f-<key> ("a|b" for several); data-f-search adds hidden search words.
    // A row with a single spanning cell (an empty-state row) or data-f-skip is never filtered.
    // ---------------------------------------------------------------------
    _filters: {},

    // Ready-made dropdowns for filterBar (a campus dropdown only for people with more than one campus)
    campusFilter(label = 'All my campuses') {
        const mine = this.myBranches();
        return mine.length < 2 ? null : { key: 'campus', label, options: mine.map(b => [b.id, b.name]) };
    },

    // data-f-campus for a person: a student's campus, or every campus a staff member or teacher works at
    campusValues(user) {
        if (!user) return '';
        if (user.role !== 'STUDENT' && (user.role === 'SUPER_ADMIN' || user.allCampuses === true)) return this.esc(this.branches().map(b => b.id).join('|'));
        const ids = user.role === 'STUDENT' ? [user.branchId] : [...(user.campusIds || []), user.branchId];
        return this.esc(Array.from(new Set(ids.filter(Boolean))).join('|'));
    },

    classFilter(ids, label = 'All classes') {
        const list = (window.LmsData.classes || []).filter(c => !ids || ids.includes(c.id));
        return list.length < 2 ? null : { key: 'class', label, options: list.map(c => [c.id, this.className(c.id)]) };
    },

    genderFilter() {
        return { key: 'gender', label: 'All genders', options: Object.entries(this.GENDERS).concat([['NONE', 'Not specified']]) };
    },

    // The date part of a date or timestamp, for data-f-date
    isoDate(value) {
        if (!value) return '';
        const m = String(value).match(/^\d{4}-\d{2}-\d{2}/);
        if (m) return m[0];
        const d = new Date(value);
        return isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    // Forget a table's filters (for a modal that opens on a different record)
    resetFilter(tableId) {
        delete this._filters[tableId];
    },

    filterState(tableId) {
        return this._filters[tableId] || (this._filters[tableId] = { q: '', sel: {}, from: '', to: '' });
    },

    filterBar(tableId, opts = {}) {
        const st = this.filterState(tableId);
        const selects = (opts.selects || []).filter(Boolean);
        const config = { selects: selects.map(s => ({ id: s.key || `col${s.col}`, key: s.key || null, col: s.col !== undefined ? s.col : null })), date: opts.date ? { key: opts.date.key || null, col: opts.date.col !== undefined ? opts.date.col : null } : null };
        const field = (html, cls = '') => `<div class="lms-filter-field ${cls}">${html}</div>`;
        return `
            <div class="lms-filter-bar" data-lms-filter="${this.esc(tableId)}" data-config="${this.esc(JSON.stringify(config))}">
                ${opts.search === false ? '' : field(`<div class="search-input-wrap"><i class="fas fa-search"></i>
                    <input type="search" class="form-control lf-q" placeholder="${this.esc(I18n.t(opts.search || 'Search...'))}" value="${this.esc(st.q)}" aria-label="${this.esc(I18n.t('Search'))}"></div>`, 'lf-grow')}
                ${selects.map((s, i) => field(`<select class="form-control lf-sel" data-i="${this.esc(config.selects[i].id)}" aria-label="${this.esc(I18n.t(s.label || 'Filter'))}">
                    <option value="">${this.esc(I18n.t(s.label || 'All'))}</option>
                    ${(s.options || []).map(([v, t]) => `<option value="${this.esc(v)}" ${st.sel[config.selects[i].id] === String(v) ? 'selected' : ''}>${this.esc(I18n.t(t))}</option>`).join('')}
                </select>`)).join('')}
                ${opts.date ? field(`<div class="lf-dates" title="${this.esc(I18n.t(opts.date.label || 'Date'))}">
                    <i class="fas fa-calendar-alt"></i>
                    <input type="date" class="form-control lf-from" value="${this.esc(st.from)}" aria-label="${this.esc(I18n.t('From date'))}">
                    <span>–</span>
                    <input type="date" class="form-control lf-to" value="${this.esc(st.to)}" aria-label="${this.esc(I18n.t('To date'))}">
                </div>`) : ''}
                <div class="lms-filter-actions">
                    <button type="button" class="btn btn-primary btn-sm lf-apply"><i class="fas fa-filter"></i> ${I18n.t('Apply')}</button>
                    <button type="button" class="btn btn-secondary btn-sm lf-clear"><i class="fas fa-times"></i> ${I18n.t('Clear')}</button>
                    <span class="lf-count" aria-live="polite"></span>
                </div>
            </div>`;
    },

    // The filterable items: a table's body rows, or the children of a card grid / list
    _filterRows(table) {
        if (table.tagName !== 'TABLE') {
            return Array.from(table.children).filter(c => !c.classList.contains('lf-norows') && !c.hasAttribute('data-f-skip'));
        }
        const body = table.tBodies[0];
        if (!body) return [];
        return Array.from(body.rows).filter(r => !r.classList.contains('lf-norows') && !r.hasAttribute('data-f-skip')
            && !(r.cells.length === 1 && r.cells[0].colSpan > 1));
    },

    // What a person reads in a row: its text, leaving out dropdown choices and button captions
    _searchText(row) {
        const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT, {
            acceptNode: n => n.parentElement && n.parentElement.closest('select, button, script, style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
        });
        let text = '';
        while (walker.nextNode()) text += ' ' + walker.currentNode.nodeValue;
        row.querySelectorAll('select').forEach(sel => { if (sel.selectedOptions[0]) text += ' ' + sel.selectedOptions[0].textContent; });
        return text;
    },

    _cellText(row, col) {
        const cell = row.cells && row.cells[col];
        return cell ? cell.textContent.replace(/\s+/g, ' ').trim() : '';
    },

    _rowValues(row, spec) {
        if (spec.key) {
            const raw = row.getAttribute(`data-f-${spec.key}`);
            return raw === null ? [''] : String(raw).split('|');
        }
        return [this._cellText(row, spec.col)];
    },

    _rowDate(row, spec) {
        const raw = spec.key ? (row.getAttribute(`data-f-${spec.key}`) || '') : this._cellText(row, spec.col);
        const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return iso[0];
        const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
        const m = raw.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
        if (m && months[m[2].toLowerCase()]) return `${m[3]}-${String(months[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        return '';
    },

    _filterInit(bar) {
        bar._lf = true;
        const id = bar.getAttribute('data-lms-filter');
        const read = () => ({
            q: (bar.querySelector('.lf-q') || {}).value || '',
            sel: Object.fromEntries(Array.from(bar.querySelectorAll('.lf-sel')).filter(s => s.value).map(s => [s.dataset.i, s.value])),
            from: (bar.querySelector('.lf-from') || {}).value || '',
            to: (bar.querySelector('.lf-to') || {}).value || ''
        });
        const same = (a, b) => a.q.trim() === b.q.trim() && a.from === b.from && a.to === b.to && JSON.stringify(a.sel) === JSON.stringify(b.sel);
        const markPending = () => bar.querySelector('.lf-apply').classList.toggle('lf-pending', !same(read(), this.filterState(id)));
        const apply = () => {
            const next = read();
            if (next.from && next.to && next.from > next.to) [next.from, next.to] = [next.to, next.from];
            next.q = next.q.trim();
            this._filters[id] = next;
            if (bar.querySelector('.lf-from')) { bar.querySelector('.lf-from').value = next.from; bar.querySelector('.lf-to').value = next.to; }
            this._filterApply(bar);
            markPending();
        };
        bar.querySelector('.lf-apply').addEventListener('click', apply);
        bar.querySelector('.lf-clear').addEventListener('click', () => {
            bar.querySelectorAll('.lf-q, .lf-from, .lf-to').forEach(i => { i.value = ''; });
            bar.querySelectorAll('.lf-sel').forEach(s => { s.value = ''; });
            apply();
        });
        bar.addEventListener('input', markPending);
        bar.addEventListener('change', markPending);
        bar.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); apply(); } });
    },

    // Fill dropdowns whose options come from a column, keeping the chosen value
    _filterOptions(bar, table, config) {
        const rows = this._filterRows(table);
        config.selects.forEach(spec => {
            if (spec.key) return;
            const select = Array.from(bar.querySelectorAll('.lf-sel')).find(el => el.dataset.i === spec.id);
            if (!select) return;
            const values = Array.from(new Set(rows.map(r => this._cellText(r, spec.col)).filter(v => v && v !== '—'))).sort((a, b) => a.localeCompare(b));
            const sig = values.join('\u0001');
            if (select._sig === sig) return;
            select._sig = sig;
            const chosen = this.filterState(bar.getAttribute('data-lms-filter')).sel[spec.id] || '';
            const first = select.options[0].outerHTML;
            const list = chosen && !values.includes(chosen) ? values.concat([chosen]) : values;
            select.innerHTML = first + list.map(v => `<option value="${this.esc(v)}" ${v === chosen ? 'selected' : ''}>${this.esc(v)}</option>`).join('');
        });
    },

    _filterApply(bar) {
        const id = bar.getAttribute('data-lms-filter');
        const table = document.getElementById(id);
        if (!table) return;
        let config;
        try { config = JSON.parse(bar.getAttribute('data-config') || '{}'); } catch (e) { config = { selects: [] }; }
        this._filterOptions(bar, table, config);
        const st = this.filterState(id);
        const words = st.q.toLowerCase().split(/\s+/).filter(Boolean);
        const rows = this._filterRows(table);
        let shown = 0;
        rows.forEach(row => {
            let ok = true;
            if (words.length) {
                const hay = `${this._searchText(row)} ${row.getAttribute('data-f-search') || ''}`.toLowerCase();
                ok = words.every(w => hay.includes(w));
            }
            if (ok) ok = config.selects.every(spec => !st.sel[spec.id] || this._rowValues(row, spec).includes(st.sel[spec.id]));
            if (ok && config.date && (st.from || st.to)) {
                const d = this._rowDate(row, config.date);
                ok = !!d && (!st.from || d >= st.from) && (!st.to || d <= st.to);
            }
            if (row.hidden !== !ok) row.hidden = !ok;
            if (ok) shown++;
        });
        const active = !!(words.length || config.selects.some(spec => st.sel[spec.id]) || st.from || st.to);
        bar.classList.toggle('lf-active', active);
        const count = bar.querySelector('.lf-count');
        const text = active ? I18n.t('{shown} of {total} shown', { shown, total: rows.length }) : (rows.length ? I18n.t('{total} records', { total: rows.length }) : '');
        if (count.textContent !== text) count.textContent = text;
        // A visible "nothing matches" line, so a filtered-out list is never just blank
        const isTable = table.tagName === 'TABLE';
        const body = isTable ? table.tBodies[0] : table;
        let none = body && body.querySelector(':scope > .lf-norows');
        const needNone = active && rows.length > 0 && shown === 0;
        if (needNone && !none && body) {
            const message = `<i class="fas fa-filter"></i> ${this.esc(I18n.t('No records match these filters.'))} <button type="button" class="btn btn-secondary btn-sm">${this.esc(I18n.t('Clear filters'))}</button>`;
            if (isTable) {
                const cols = table.tHead && table.tHead.rows[0] ? Array.from(table.tHead.rows[0].cells).reduce((n, c) => n + (c.colSpan || 1), 0) : 1;
                none = document.createElement('tr');
                none.innerHTML = `<td colspan="${cols}">${message}</td>`;
            } else {
                none = document.createElement('div');
                none.innerHTML = message;
            }
            none.className = 'lf-norows';
            none.querySelector('button').addEventListener('click', () => bar.querySelector('.lf-clear').click());
            body.appendChild(none);
        } else if (!needNone && none) {
            none.remove();
        }
    },

    // Download a table as CSV: its header and the rows the filters leave visible. Returns false when nothing is shown.
    exportTableCsv(tableId, filename) {
        const table = document.getElementById(tableId);
        if (!table) return false;
        const rows = this._filterRows(table).filter(r => !r.hidden);
        if (!rows.length) return false;
        const clean = el => (el.innerText || el.textContent).replace(/\s+/g, ' ').trim();
        const quote = v => `"${String(v).replace(/"/g, '""')}"`;
        const head = table.tHead && table.tHead.rows[0] ? Array.from(table.tHead.rows[0].cells).map(clean) : [];
        const lines = [head].concat(rows.map(r => Array.from(r.cells).map(clean))).map(cells => cells.map(quote).join(','));
        const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        return true;
    },

    // Finds filter bars as pages and modals render, and keeps their filters applied when a table redraws
    _filterRefresh() {
        this._filterQueued = false;
        document.querySelectorAll('.lms-filter-bar[data-lms-filter]').forEach(bar => {
            if (!bar._lf) this._filterInit(bar);
            this._filterApply(bar);
        });
    },

    _filterWatch() {
        if (this._filterObserver || typeof MutationObserver === 'undefined') return;
        const queue = () => {
            if (this._filterQueued) return;
            this._filterQueued = true;
            setTimeout(() => this._filterRefresh(), 0);
        };
        this._filterObserver = new MutationObserver(queue);
        this._filterObserver.observe(document.documentElement, { childList: true, subtree: true });
        queue();
    }
};

window.Lms = Lms;
Lms._filterWatch();
