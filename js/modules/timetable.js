/**
 * JAMIA ASHRAFIA LAHORE - SCHEDULES & TIMETABLES MODULE
 * Day and weekly timetables per class / teacher, clash detection (teacher, room, class),
 * and an upcoming schedule of exams, online classes and assignment deadlines.
 */

const TimetableModule = {
    DAYS: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    selectedDay: null,
    view: 'day',            // day | week
    classFilter: null,      // class id, 'MINE' (teacher's own periods) or 'ALL'

    canManage() {
        return Lms.can('timetable.manage');
    },

    todayName() {
        return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
    },

    defaultFilter() {
        const me = Lms.me();
        if (Lms.portal() === 'student') return me.classId || 'NONE';
        if (Lms.portal() === 'teacher') return 'MINE';
        return 'ALL';
    },

    // Slots visible under the current filter
    filteredSlots() {
        const me = Lms.me();
        const all = window.LmsData.timetables || [];
        const f = this.classFilter;
        if (Lms.portal() === 'student') return all.filter(t => t.classId === me.classId || t.classId === 'all');
        if (f === 'MINE') return all.filter(t => t.teacherId === me.id || t.classId === 'all');
        if (f === 'ALL' || !f) return all;
        return all.filter(t => t.classId === f || t.classId === 'all');
    },

    sortSlots(list) {
        return list.slice().sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
    },

    render() {
        if (!this.selectedDay) this.selectedDay = this.todayName();
        if (!this.classFilter) this.classFilter = this.defaultFilter();
        const me = Lms.me();
        const canManage = this.canManage();
        const visibleClassIds = Lms.myClassIds();
        const filterLabel = this.classFilter === 'MINE' ? 'My teaching schedule'
            : this.classFilter === 'ALL' ? 'All classes' : Lms.className(this.classFilter);

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1><i class="fas fa-calendar-alt" style="color: var(--primary-400);"></i> Schedules & Timetables</h1>
                    <p>Daily lecture periods synchronized with prayer times, plus your upcoming exams, online classes and deadlines</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-secondary btn-sm" onclick="TimetableModule.setView('${this.view === 'day' ? 'week' : 'day'}')">
                        <i class="fas ${this.view === 'day' ? 'fa-th' : 'fa-list'}"></i> ${this.view === 'day' ? 'Weekly Grid' : 'Day View'}
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="TimetableModule.printTimetable()"><i class="fas fa-print"></i> Print Timetable</button>
                    <button class="btn btn-secondary btn-sm" onclick="TimetableModule.downloadPdf(this)"><i class="fas fa-file-pdf" style="color: var(--danger);"></i> Download PDF</button>
                    ${canManage ? `<button class="btn btn-gold btn-sm" onclick="TimetableModule.openAddSlotModal()"><i class="fas fa-calendar-plus"></i> Add Timetable</button>` : ''}
                </div>
            </div>

            ${Lms.portal() !== 'student' ? `
                <div class="filter-bar">
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <label style="font-weight: 600; font-size: 0.85rem;">Showing:</label>
                        <select class="form-control" style="max-width: 360px;" onchange="TimetableModule.setClassFilter(this.value)">
                            ${Lms.portal() === 'teacher' ? `<option value="MINE" ${this.classFilter === 'MINE' ? 'selected' : ''}>My teaching schedule</option>` : ''}
                            ${Lms.portal() !== 'teacher' ? `<option value="ALL" ${this.classFilter === 'ALL' ? 'selected' : ''}>All classes</option>` : ''}
                            ${Lms.classOptions(this.classFilter, Lms.portal() === 'teacher' ? visibleClassIds : null)}
                        </select>
                    </div>
                </div>` : ''}

            <div class="timetable-layout" style="display: grid; grid-template-columns: minmax(0, 3fr) minmax(260px, 1fr); gap: 24px; align-items: start;">
                <div>${this.view === 'day' ? this.renderDayView(filterLabel) : this.renderWeekView(filterLabel)}</div>
                <div>${this.renderUpcoming()}</div>
            </div>
        `;
    },

    setView(v) {
        this.view = v;
        window.App.navigate('timetable');
    },

    setClassFilter(v) {
        this.classFilter = v;
        window.App.navigate('timetable');
    },

    selectDay(day) {
        this.selectedDay = day;
        window.App.navigate('timetable');
    },

    renderDayView(filterLabel) {
        const slots = this.sortSlots(this.filteredSlots().filter(t => t.day === this.selectedDay));
        const free = this.freeRowsFor(this.selectedDay, slots);
        const freeMinutes = free.reduce((s, f) => s + f.minutes, 0);
        const canManage = this.canManage();
        const isToday = this.selectedDay === this.todayName();
        const now = new Date().toTimeString().slice(0, 5);
        const showClass = ['ALL', 'MINE'].includes(this.classFilter);
        return `
            <div class="tabs-nav" style="flex-wrap: wrap;">
                ${this.DAYS.map(day => `
                    <button class="tab-btn ${this.selectedDay === day ? 'active' : ''}" onclick="TimetableModule.selectDay('${day}')">
                        ${day === this.todayName() ? '<i class="fas fa-circle" style="font-size: 0.5rem; color: var(--success);"></i> ' : ''}${day}
                    </button>`).join('')}
            </div>
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-chalkboard"></i> ${this.selectedDay} — ${Lms.esc(filterLabel)}</h3>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <span class="status-pill gold">${slots.length} period(s)</span>
                        ${free.length ? `<span class="status-pill info"><i class="fas fa-mug-hot"></i> ${freeMinutes} min free</span>` : ''}
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${this.selectedDay === 'Friday' && !slots.length ? `
                        <div style="padding: 16px; background: linear-gradient(135deg, rgba(18, 72, 85, 0.08) 0%, rgba(170, 134, 55, 0.12) 100%); border-inline-start: 4px solid var(--gold-600); border-radius: var(--radius-sm);">
                            <strong style="color: var(--gold-800);">Jumu'ah</strong>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">Friday is reserved for Surah al-Kahf, Jumu'ah in the Grand Jamia Mosque and personal revision (Mutala'ah). Classes resume Saturday with the Fajr Dars.</div>
                        </div>` : ''}
                    ${slots.length ? this.sortSlots(slots.concat(free)).map(slot => {
                        if (slot.free) return `
                            <div class="tt-free-row">
                                <div style="display: flex; align-items: center; gap: 14px; min-width: 0;">
                                    <div class="tt-free-icon"><i class="fas fa-mug-hot"></i></div>
                                    <div>
                                        <div style="font-weight: 700; color: var(--primary-800);">Free Time</div>
                                        ${showClass ? `<div style="font-size: 0.78rem; color: var(--text-muted);">${Lms.esc(Lms.className(slot.classId))}</div>` : ''}
                                    </div>
                                </div>
                                <div style="text-align: end;">
                                    <div style="font-family: monospace; font-size: 0.9rem; font-weight: 700; color: var(--primary-800);">${Lms.fmtTime(slot.startTime)} – ${Lms.fmtTime(slot.endTime)}</div>
                                    <div style="font-size: 0.72rem; color: var(--text-muted);">${slot.minutes} min</div>
                                </div>
                            </div>`;
                        const isBreak = !slot.courseId;
                        const live = isToday && now >= slot.startTime && now < slot.endTime;
                        return `
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: ${isBreak ? 'var(--primary-50)' : 'var(--bg-surface-elevated)'}; border: ${live ? '2px solid var(--success)' : `1px solid ${isBreak ? 'var(--primary-200)' : 'var(--border-subtle)'}`}; border-radius: var(--radius-md); flex-wrap: wrap; gap: 12px;">
                                <div style="display: flex; align-items: center; gap: 14px; min-width: 0;">
                                    <div style="width: 44px; height: 44px; flex-shrink: 0; border-radius: var(--radius-sm); background: ${isBreak ? 'var(--gold-100)' : 'var(--primary-100)'}; color: ${isBreak ? 'var(--gold-800)' : 'var(--primary-800)'}; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                                        <i class="${isBreak ? 'fas fa-mosque' : 'fas fa-book-reader'}"></i>
                                    </div>
                                    <div style="min-width: 0;">
                                        <div style="font-weight: 700; font-size: 1rem; color: var(--primary-950);">${Lms.esc(isBreak ? slot.periodName : Lms.courseTitle(slot.courseId))}</div>
                                        <div style="font-size: 0.78rem; color: var(--gold-700);">${Lms.esc(isBreak ? 'All campus' : (slot.periodName || ''))} • ${Lms.esc(Lms.className(slot.classId))}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                                            ${slot.teacherId ? `<i class="fas fa-user-tie"></i> ${Lms.esc(Lms.userName(slot.teacherId))} • ` : ''}<i class="fas fa-door-open"></i> ${Lms.esc(slot.room || '—')}
                                        </div>
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="text-align: end;">
                                        <div style="font-family: monospace; font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">${Lms.fmtTime(slot.startTime)} – ${Lms.fmtTime(slot.endTime)}</div>
                                        ${this.duration(slot.startTime, slot.endTime) ? `<div style="font-size: 0.72rem; color: var(--text-muted);"><i class="fas fa-hourglass-half"></i> ${this.duration(slot.startTime, slot.endTime)}</div>` : ''}
                                        ${live ? '<span class="status-pill success" style="font-size: 0.65rem;">In progress</span>' : ''}
                                    </div>
                                    ${canManage ? `
                                        <button class="btn btn-secondary btn-sm" title="Edit" onclick="TimetableModule.editSlot('${slot.id}')"><i class="fas fa-edit"></i></button>
                                        <button class="btn btn-secondary btn-sm" title="Delete" onclick="TimetableModule.deleteSlot('${slot.id}')"><i class="fas fa-trash" style="color: var(--danger);"></i></button>` : ''}
                                </div>
                            </div>`;
                    }).join('') : (this.selectedDay === 'Friday' ? '' : window.App.dashEmpty('No periods scheduled for this day.'))}
                </div>
            </div>
        `;
    },

    renderWeekView(filterLabel) {
        const slots = this.filteredSlots();
        const days = this.DAYS.filter(d => d !== 'Friday' || slots.some(s => s.day === 'Friday'));
        const free = days.flatMap(d => this.freeRowsFor(d, slots));
        const items = slots.concat(free);
        const times = Array.from(new Set(items.map(s => `${s.startTime}-${s.endTime}`))).sort();
        const showClass = this.classFilter === 'ALL' || this.classFilter === 'MINE';
        return `
            <div class="card" id="timetable-print-area">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-th"></i> Weekly Timetable — ${Lms.esc(filterLabel)}</h3>
                </div>
                <div class="table-responsive">
                    <table class="data-table" style="min-width: 760px;">
                        <thead><tr><th style="width: 120px;">Time</th>${days.map(d => `<th>${d}</th>`).join('')}</tr></thead>
                        <tbody>
                            ${times.length ? times.map(t => {
                                const [st, en] = t.split('-');
                                return `
                                    <tr>
                                        <td style="font-family: monospace; font-size: 0.78rem; white-space: nowrap;">${Lms.fmtTime(st)}<br>${Lms.fmtTime(en)}${this.duration(st, en) ? `<div style="font-family: inherit; color: var(--text-muted); font-size: 0.7rem;">${this.duration(st, en)}</div>` : ''}</td>
                                        ${days.map(d => {
                                            const cell = items.filter(s => s.day === d && s.startTime === st && s.endTime === en);
                                            return `<td style="font-size: 0.76rem; vertical-align: top;">${cell.map(s => s.free ? `
                                                <div class="tt-free-cell">
                                                    <strong><i class="fas fa-mug-hot"></i> Free Time</strong>
                                                    <div>${s.minutes} min</div>
                                                    ${showClass ? `<div style="color: var(--text-muted);">${Lms.esc((Lms.getClass(s.classId) || {}).name || '')}</div>` : ''}
                                                </div>` : `
                                                <div style="padding: 4px 6px; margin-bottom: 4px; border-radius: 4px; background: ${s.courseId ? 'var(--primary-50)' : 'var(--gold-50)'}; ${this.canManage() ? 'cursor: pointer;' : ''}" ${this.canManage() ? `onclick="TimetableModule.editSlot('${s.id}')"` : ''}>
                                                    <strong>${Lms.esc(s.courseId ? (Lms.getCourse(s.courseId) || {}).code || Lms.courseTitle(s.courseId) : s.periodName)}</strong>
                                                    ${showClass ? `<div style="color: var(--text-muted);">${Lms.esc(s.classId === 'all' ? '' : (Lms.getClass(s.classId) || {}).name || '')}</div>` : ''}
                                                    ${s.teacherId ? `<div style="color: var(--primary-700);">${Lms.esc(Lms.userName(s.teacherId))}</div>` : ''}
                                                    <div style="color: var(--text-muted);">${Lms.esc(s.room || '')}</div>
                                                </div>`).join('')}</td>`;
                                        }).join('')}
                                    </tr>`;
                            }).join('') : `<tr><td colspan="${days.length + 1}" style="text-align: center; color: var(--text-muted);">No periods scheduled.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    // Upcoming exams, online classes and deadlines relevant to the signed-in user
    renderUpcoming() {
        const me = Lms.me();
        const today = Lms.today();
        const horizon = Lms.addDays(today, 21);
        const classIds = Lms.myClassIds();
        const items = [];
        (window.LmsData.exams || []).filter(e => classIds.includes(e.classId) && e.examDate >= today && e.examDate <= horizon && e.status !== 'CLOSED')
            .forEach(e => items.push({ date: e.examDate, time: e.startTime, icon: 'fa-file-signature', color: 'var(--danger)', title: e.title, sub: `${e.mode === 'ONLINE' ? 'Online exam' : 'Hall exam'} • ${Lms.className(e.classId)}`, route: 'exams' }));
        (window.LmsData.assignments || []).filter(a => classIds.includes(a.classId) && a.dueDate >= today && a.dueDate <= horizon)
            .filter(a => Lms.portal() !== 'student' || !(window.LmsData.assignmentSubmissions || []).some(s => s.assignmentId === a.id && s.studentId === me.id))
            .forEach(a => items.push({ date: a.dueDate, time: '23:59', icon: 'fa-tasks', color: 'var(--warning)', title: `Due: ${a.title}`, sub: Lms.className(a.classId), route: 'assignments' }));
        (window.LmsData.virtualClasses || []).filter(v => (classIds.includes(v.classId) || v.hostId === me.id) && v.status === 'UPCOMING')
            .forEach(v => {
                const d = new Date(v.startsAt || v.scheduledStart);
                const date = isNaN(d) ? today : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                items.push({ date, time: isNaN(d) ? '' : d.toTimeString().slice(0, 5), icon: 'fa-video', color: 'var(--primary-600)', title: v.title, sub: `Online class • ${v.className || ''}`, route: 'virtual-class' });
            });
        items.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-calendar-week"></i> Upcoming (3 weeks)</h3>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${items.length ? items.slice(0, 12).map(i => `
                        <div style="display: flex; gap: 10px; padding: 10px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm); border-inline-start: 3px solid ${i.color}; cursor: pointer;" onclick="App.navigate('${i.route}')">
                            <i class="fas ${i.icon}" style="color: ${i.color}; margin-top: 3px;"></i>
                            <div style="min-width: 0;">
                                <div style="font-weight: 700; font-size: 0.85rem; color: var(--primary-950);">${Lms.esc(i.title)}</div>
                                <div style="font-size: 0.72rem; color: var(--text-muted);">${Lms.fmtDate(i.date)}${i.time && i.time !== '23:59' ? ' • ' + Lms.fmtTime(i.time) : ''} • ${Lms.esc(i.sub)}</div>
                            </div>
                        </div>`).join('') : window.App.dashEmpty('Nothing scheduled in the next three weeks.')}
                </div>
            </div>
        `;
    },

    // ---------------------------------------------------------------------
    // ADD / EDIT / DELETE
    // ---------------------------------------------------------------------
    // Working days of the week in a madrasa (Friday off), and the usual Monday–Friday week
    DAY_PRESETS: {
        'Sat–Thu': ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
        'Mon–Fri': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    },

    // "HH:MM" <-> minutes since midnight
    toMin(t) {
        const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
        return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
    },

    fromMin(n) {
        return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
    },

    // "3 hrs", "1 hr 30 min", "45 min" between two "HH:MM" times, or '' when the range is not valid
    duration(start, end) {
        const mins = this.toMin(end) - this.toMin(start);
        if (!(mins > 0)) return '';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return [h ? `${h} ${h === 1 ? 'hr' : 'hrs'}` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
    },

    // Unused time inside a class's time range: the parts of [spanStart, spanEnd] that none of its periods
    // covers. The range is the saved class time (blockStart / blockEnd), else its first start to last end.
    // Returns [{ startTime, endTime, minutes }]
    freeGaps(classEntries, span) {
        const own = classEntries.map(e => [this.toMin(e.startTime), this.toMin(e.endTime)]).filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
        if (!own.length) return [];
        const spanStart = span ? span[0] : own[0][0];
        const spanEnd = span ? span[1] : Math.max(...own.map(r => r[1]));
        const gaps = [];
        let cursor = spanStart;
        own.forEach(([s, e]) => {
            if (s > cursor && cursor < spanEnd) gaps.push([cursor, Math.min(s, spanEnd)]);
            cursor = Math.max(cursor, e);
        });
        if (cursor < spanEnd) gaps.push([cursor, spanEnd]);
        return gaps.filter(([s, e]) => e > s).map(([s, e]) => ({ startTime: this.fromMin(s), endTime: this.fromMin(e), minutes: e - s }));
    },

    // A class's saved time range on a day: { start, end } in minutes, or null when it has no periods
    classSpan(entries) {
        const valid = entries.filter(e => this.toMin(e.endTime) > this.toMin(e.startTime));
        if (!valid.length) return null;
        return {
            start: Math.min(...valid.map(e => this.toMin(e.blockStart || e.startTime))),
            end: Math.max(...valid.map(e => this.toMin(e.blockEnd || e.endTime)))
        };
    },

    // Free-time rows for every class among the given periods, on one day
    freeRowsFor(day, slots) {
        const all = window.LmsData.timetables || [];
        const classIds = Array.from(new Set(slots.filter(s => s.day === day && s.classId !== 'all').map(s => s.classId)));
        return classIds.flatMap(classId => {
            const entries = all.filter(t => t.day === day && t.classId === classId);
            const span = this.classSpan(entries);
            return this.freeGaps(entries, span && [span.start, span.end]).map(g => ({ ...g, day, classId, free: true }));
        });
    },

    // The periods of a class's time range that one entry belongs to (entries saved together share blockStart / blockEnd)
    blockOf(slot) {
        if (!slot || slot.classId === 'all') return slot ? [slot] : [];
        if (!slot.blockStart || !slot.blockEnd) return [slot];
        return (window.LmsData.timetables || []).filter(t => t.classId === slot.classId && t.day === slot.day
            && t.blockStart === slot.blockStart && t.blockEnd === slot.blockEnd);
    },

    openAddSlotModal(slotId) {
        this._confirmedConflicts = false;
        this._autoRoom = null;
        this._timeTouched = false;
        const slot = slotId ? (window.LmsData.timetables || []).find(t => t.id === slotId) : null;
        const block = this.blockOf(slot).sort((a, b) => a.startTime.localeCompare(b.startTime));
        this._editIds = block.map(t => t.id);
        const span = slot && slot.classId !== 'all' ? this.classSpan(block) : null;
        const defaultClass = slot ? slot.classId : (this.classFilter && !['ALL', 'MINE'].includes(this.classFilter) ? this.classFilter : (window.LmsData.classes[0] || {}).id);
        const hasExtras = !!(slot && (slot.room || (slot.classId === 'all' && slot.periodName)));
        const start = span ? this.fromMin(span.start) : (slot ? slot.startTime : '09:00');
        const end = span ? this.fromMin(span.end) : (slot ? slot.endTime : '12:00');
        Lms.openModal(
            `<i class="fas fa-calendar-plus" style="color: var(--gold-400);"></i> ${slot ? 'Edit Timetable Entry' : 'Add Timetable'}`,
            `<div class="form-grid" style="margin-bottom: 6px;">
                <div class="form-group"><label for="slot-class">Class *</label>
                    <select id="slot-class" class="form-control" onchange="TimetableModule.refreshSlotCourses()">
                        <option value="all" ${defaultClass === 'all' ? 'selected' : ''}>All classes (prayer / break / assembly)</option>
                        ${Lms.classOptions(defaultClass)}
                    </select>
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                    <label style="margin: 0;">Class Days *</label>
                    ${slot ? '' : `<div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        ${Object.keys(this.DAY_PRESETS).map(p => `<button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.72rem;" onclick="TimetableModule.pickDays('${p}')">${p}</button>`).join('')}
                        <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.72rem;" onclick="TimetableModule.pickDays()">Clear</button>
                    </div>`}
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
                    ${this.DAYS.map(d => `
                        <label class="slot-day-chip">
                            <input type="${slot ? 'radio' : 'checkbox'}" name="slot-day" class="slot-day" value="${d}" ${(slot ? slot.day === d : d === this.selectedDay) ? 'checked' : ''} onchange="TimetableModule.prefillClassTime()" style="accent-color: var(--primary-600);"> ${d}
                        </label>`).join('')}
                </div>
                <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 6px;">${slot ? 'An entry belongs to one day; add another entry for other days.' : 'The class repeats at the same time on every day you tick.'}</div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
                <label>Class Time *</label>
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <input type="time" id="slot-start" class="form-control" style="max-width: 150px;" aria-label="From" value="${Lms.esc(start)}" oninput="TimetableModule._timeTouched = true; TimetableModule.showDuration()">
                    <span style="color: var(--text-muted); font-weight: 600;">to</span>
                    <input type="time" id="slot-end" class="form-control" style="max-width: 150px;" aria-label="To" value="${Lms.esc(end)}" oninput="TimetableModule._timeTouched = true; TimetableModule.showDuration()">
                    <span id="slot-duration" class="status-pill info" style="font-size: 0.78rem;"></span>
                </div>
            </div>

            <!-- The class's courses, one after another inside the class time; each row: course, minutes, calculated time -->
            <div id="slot-more-courses" oninput="TimetableModule.showDuration()" onchange="TimetableModule.showDuration()"></div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px;">
                <button type="button" id="slot-add-course" class="btn btn-secondary btn-sm" onclick="TimetableModule.addCourseRow()"><i class="fas fa-plus"></i> Add another course</button>
                <div id="slot-free-time" style="display: flex; gap: 6px; flex-wrap: wrap;"></div>
            </div>

            <details ${hasExtras ? 'open' : ''} style="margin-bottom: 10px;">
                <summary style="cursor: pointer; font-weight: 600; font-size: 0.85rem; color: var(--primary-700); margin-bottom: 10px;">Teacher, room & period name</summary>
                <div class="form-grid">
                    <div class="form-group"><label for="slot-teacher">Teacher (Ustad)</label><select id="slot-teacher" class="form-control">${Lms.teacherOptions(slot && slot.classId === 'all' ? slot.teacherId : '', true)}</select></div>
                    <div class="form-group"><label for="slot-room">Hall / Room</label><input type="text" id="slot-room" class="form-control" value="${Lms.esc(slot ? slot.room : '')}" placeholder="e.g. Hall Imam Bukhari"></div>
                    <div class="form-group"><label for="slot-name">Period Name</label><input type="text" id="slot-name" class="form-control" value="${Lms.esc(slot && slot.classId === 'all' ? slot.periodName : '')}" placeholder="Defaults to the kitab's name; e.g. Namaz-e-Zuhr for a break"></div>
                </div>
            </details>
            <div id="slot-conflicts"></div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="TimetableModule.saveSlot('${slot ? slot.id : ''}')"><i class="fas fa-save"></i> ${slot ? 'Save Changes' : 'Save to Timetable'}</button>`
        );
        // The courses being edited, in order, each with its own length; a new timetable starts with one course row
        const rows = slot && slot.classId !== 'all' ? block.map(t => [t.courseId, this.toMin(t.endTime) - this.toMin(t.startTime)]) : [];
        this.refreshSlotCourses(rows.length ? rows : null);
        if (!slot) this.prefillClassTime();
    },

    pickDays(preset) {
        const days = this.DAY_PRESETS[preset] || [];
        document.querySelectorAll('.slot-day').forEach(c => { c.checked = days.includes(c.value); });
        this.prefillClassTime();
    },

    // A new timetable for a class that already has one shows that class's time range (until the admin changes it)
    prefillClassTime() {
        const classId = Lms.val('slot-class');
        if (this._editIds.length || this._timeTouched || !classId || classId === 'all') { this.showDuration(); return; }
        const all = (window.LmsData.timetables || []).filter(t => t.classId === classId);
        const day = (document.querySelector('.slot-day:checked') || {}).value;
        const sameDay = all.filter(t => t.day === day);
        const source = sameDay.length ? sameDay : all.filter(t => t.day === (all[0] || {}).day);
        const span = this.classSpan(source);
        if (span) {
            document.getElementById('slot-start').value = this.fromMin(span.start);
            document.getElementById('slot-end').value = this.fromMin(span.end);
        }
        this.showDuration();
    },

    // Class time total, each course's calculated time, and the free time left over (or the overrun)
    showDuration() {
        const el = document.getElementById('slot-duration');
        if (!el) return;
        const d = this.duration(Lms.val('slot-start'), Lms.val('slot-end'));
        el.className = `status-pill ${d ? 'info' : 'danger'}`;
        el.innerHTML = d ? `<i class="fas fa-hourglass-half"></i> Total: ${d}` : `<i class="fas fa-exclamation-circle"></i> End must be after start`;

        const plan = this.planCourses();
        document.querySelectorAll('#slot-more-courses .tt-extra-row').forEach((row, i) => {
            const p = plan.rows[i];
            const pill = row.querySelector('.tt-x-time');
            const bad = !p.minutes || (plan.classMinutes > 0 && p.end > plan.classEnd);
            pill.className = `tt-x-time status-pill ${bad ? 'danger' : 'info'}`;
            pill.textContent = !p.minutes ? 'Enter minutes' : `${Lms.fmtTime(this.fromMin(p.start))} – ${Lms.fmtTime(this.fromMin(p.end))}`;
        });

        const free = document.getElementById('slot-free-time');
        if (!free) return;
        if (Lms.val('slot-class') === 'all' || !plan.rows.length || !(plan.classMinutes > 0)) { free.innerHTML = ''; return; }
        if (plan.used > plan.classMinutes) {
            free.innerHTML = `<span class="status-pill danger" style="font-size: 0.72rem; text-transform: none;"><i class="fas fa-exclamation-circle"></i> ${I18n.t('The courses need {a} min but the class time is only {b} min. Reduce them by {c} min.', { a: plan.used, b: plan.classMinutes, c: plan.used - plan.classMinutes })}</span>`;
            return;
        }
        const remaining = plan.classMinutes - plan.used;
        free.innerHTML = remaining > 0
            ? `<span class="status-pill info" style="font-size: 0.72rem;"><i class="fas fa-mug-hot"></i> Free Time ${Lms.fmtTime(this.fromMin(plan.classEnd - remaining))} – ${Lms.fmtTime(this.fromMin(plan.classEnd))} (${remaining} min)</span>`
            : '';
    },

    // Courses one after another from the class start: { classStart, classEnd, classMinutes, used, rows: [{ courseId, minutes, start, end }] }
    planCourses() {
        const classStart = this.toMin(Lms.val('slot-start'));
        const classEnd = this.toMin(Lms.val('slot-end'));
        let cursor = classStart;
        const rows = Array.from(document.querySelectorAll('#slot-more-courses .tt-extra-row')).map(row => {
            const minutes = Math.max(0, Math.round(Number(row.querySelector('.tt-x-min').value) || 0));
            const r = { courseId: row.querySelector('.tt-x-course').value || null, minutes, start: cursor, end: cursor + minutes };
            cursor += minutes;
            return r;
        });
        return { classStart, classEnd, classMinutes: classEnd - classStart, used: rows.reduce((s, r) => s + r.minutes, 0), rows };
    },

    // One more course after the last one, 60 minutes unless changed
    addCourseRow(courseId, minutes) {
        const box = document.getElementById('slot-more-courses');
        const classId = Lms.val('slot-class');
        if (!box || classId === 'all') return;
        box.insertAdjacentHTML('beforeend', `
            <div class="tt-extra-row">
                <select class="form-control tt-x-course" aria-label="Course / Kitab">${this.courseChoices(classId, courseId)}</select>
                <label class="tt-x-min-wrap"><input type="number" class="form-control tt-x-min" min="5" max="720" step="5" value="${Number(minutes) > 0 ? Number(minutes) : 60}" aria-label="Duration (min)" onwheel="this.blur()"> min</label>
                <span class="tt-x-time status-pill info" style="font-size: 0.72rem;"></span>
                <button type="button" class="btn btn-secondary btn-sm" title="Remove" onclick="this.closest('.tt-extra-row').remove(); TimetableModule.showDuration()"><i class="fas fa-times" style="color: var(--danger);"></i></button>
            </div>`);
        this.showDuration();
    },

    courseChoices(classId, selected) {
        const ids = classId === 'all' ? [] : Lms.classCourseIds(classId);
        const list = ids.length ? ids : (window.LmsData.courses || []).map(c => c.id);
        return `<option value="">— Select course / kitab —</option>` + Lms.courseOptions(selected, list);
    },

    // rows: [[courseId, minutes], …] to show (editing); otherwise the current rows follow the new class
    refreshSlotCourses(rows) {
        const classId = Lms.val('slot-class');
        const more = document.getElementById('slot-more-courses');
        const addBtn = document.getElementById('slot-add-course');
        if (more) {
            if (classId === 'all') more.innerHTML = '';
            else if (rows) { more.innerHTML = ''; rows.forEach(([c, m]) => this.addCourseRow(c, m)); }
            else if (!more.children.length) this.addCourseRow();
            else more.querySelectorAll('.tt-x-course').forEach(sel => { sel.innerHTML = this.courseChoices(classId, sel.value); });
        }
        if (addBtn) addBtn.style.display = classId === 'all' ? 'none' : '';
        // Follow the class's own room unless the user typed a different one
        const cls = Lms.getClass(classId);
        const room = document.getElementById('slot-room');
        if (cls && room && (!room.value || room.value === this._autoRoom)) {
            room.value = cls.room || '';
            this._autoRoom = room.value;
        }
        this.prefillClassTime();
    },

    // Overlapping periods on the same day that share the teacher, the room or the class
    findConflicts(candidate, ignoreIds) {
        const overlaps = (a, b) => a.startTime < b.endTime && b.startTime < a.endTime;
        return (window.LmsData.timetables || []).filter(t => !ignoreIds.includes(t.id) && t.day === candidate.day && overlaps(t, candidate)).map(t => {
            const reasons = [];
            if (candidate.teacherId && t.teacherId === candidate.teacherId) reasons.push(`${Lms.userName(t.teacherId)} is already teaching`);
            if (candidate.room && t.room && t.room.toLowerCase() === candidate.room.toLowerCase() && candidate.classId !== 'all' && t.classId !== 'all') reasons.push(`room "${t.room}" is in use`);
            if (candidate.classId !== 'all' && t.classId === candidate.classId) reasons.push(`${Lms.className(t.classId)} already has a period`);
            return reasons.length ? { slot: t, reasons } : null;
        }).filter(Boolean);
    },

    saveSlot(slotId) {
        const days = Array.from(document.querySelectorAll('.slot-day:checked')).map(c => c.value);
        const classId = Lms.val('slot-class');
        const startTime = Lms.val('slot-start');
        const endTime = Lms.val('slot-end');
        const room = Lms.val('slot-room');
        const periodName = Lms.val('slot-name');
        const teacherId = Lms.val('slot-teacher') || null;
        const editIds = this._editIds || [];
        if (!days.length || !startTime || !endTime) {
            window.App.showToast('Choose at least one day and the start/end time', 'warning');
            return;
        }
        if (endTime <= startTime) {
            window.App.showToast('End time must be after start time', 'warning');
            return;
        }

        let entries;
        if (classId === 'all') {
            if (!periodName) {
                window.App.showToast('Choose a kitab or give the period a name (e.g. Namaz-e-Zuhr)', 'warning');
                return;
            }
            entries = [{ startTime, endTime, classId, courseId: null, teacherId, room, periodName }];
        } else {
            const plan = this.planCourses();
            if (!plan.rows.length) {
                window.App.showToast('Add at least one course', 'warning');
                return;
            }
            if (plan.rows.some(r => !r.courseId)) {
                window.App.showToast('Choose the course / kitab for every course', 'warning');
                return;
            }
            if (plan.rows.some(r => !(r.minutes > 0))) {
                window.App.showToast('Enter a duration for every course', 'warning');
                return;
            }
            if (plan.used > plan.classMinutes) {
                window.App.showToast(I18n.t('The courses need {a} min but the class time is only {b} min. Reduce them by {c} min.', { a: plan.used, b: plan.classMinutes, c: plan.used - plan.classMinutes }), 'warning');
                this.showDuration();
                return;
            }
            entries = plan.rows.map(r => ({
                startTime: this.fromMin(r.start), endTime: this.fromMin(r.end), classId, courseId: r.courseId,
                teacherId: Lms.courseTeacherId(classId, r.courseId) || teacherId, room,
                periodName: plan.rows.length === 1 && periodName ? periodName : Lms.courseTitle(r.courseId),
                blockStart: startTime, blockEnd: endTime
            }));

            // The class's time range may not overlap its other periods that day
            const classClash = days.flatMap(day => (window.LmsData.timetables || []).filter(t => !editIds.includes(t.id) && t.classId === classId && t.day === day
                && startTime < t.endTime && t.startTime < endTime));
            if (classClash.length) {
                document.getElementById('slot-conflicts').innerHTML = `
                    <div style="border: 1px solid var(--danger); background: rgba(220, 38, 38, 0.08); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 0.82rem;">
                        <strong style="color: var(--danger);"><i class="fas fa-ban"></i> ${Lms.esc(Lms.className(classId))} already has a period at this time</strong>
                        <ul style="margin: 6px 0 6px 18px;">${classClash.map(t => `<li>${Lms.esc(t.day)} ${Lms.fmtTime(t.startTime)}–${Lms.fmtTime(t.endTime)}: ${Lms.esc(t.periodName || Lms.courseTitle(t.courseId))}</li>`).join('')}</ul>
                    </div>`;
                return;
            }
        }

        const conflicts = days.flatMap(day => entries.flatMap(e => this.findConflicts({ ...e, day }, editIds)));
        if (conflicts.length && !this._confirmedConflicts) {
            document.getElementById('slot-conflicts').innerHTML = `
                <div style="border: 1px solid var(--danger); background: rgba(220, 38, 38, 0.08); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 0.82rem;">
                    <strong style="color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> Timetable clash</strong>
                    <ul style="margin: 6px 0 6px 18px;">${conflicts.map(c => `<li>${Lms.esc(c.slot.day)} ${Lms.fmtTime(c.slot.startTime)}–${Lms.fmtTime(c.slot.endTime)}: ${Lms.esc(c.reasons.join(', '))}</li>`).join('')}</ul>
                    <button class="btn btn-secondary btn-sm" onclick="TimetableModule._confirmedConflicts = true; TimetableModule.saveSlot('${slotId || ''}')">Save anyway</button>
                </div>`;
            return;
        }
        this._confirmedConflicts = false;

        const all = window.LmsData.timetables;
        if (slotId) {
            // Keep the existing records (same ids) in order, add any extra courses, drop removed ones
            const old = editIds.map(id => all.find(t => t.id === id)).filter(Boolean).sort((a, b) => a.startTime.localeCompare(b.startTime));
            entries.forEach((e, i) => {
                if (old[i]) Object.assign(old[i], e, { day: days[0] });
                else all.push({ id: Lms.uid('tt'), day: days[0], ...e });
            });
            const drop = new Set(old.slice(entries.length).map(t => t.id));
            window.LmsData.timetables = all.filter(t => !drop.has(t.id));
        } else {
            days.forEach(day => entries.forEach(e => all.push({ id: Lms.uid('tt'), day, ...e })));
        }
        Lms.save();
        Array.from(new Set(entries.map(e => e.teacherId).filter(Boolean))).forEach(tid => {
            entries.filter(e => e.teacherId === tid).forEach(e => Lms.notifyUser(tid, 'Timetable Updated',
                `${e.periodName} • ${Lms.className(e.classId)} • ${days.join(', ')} ${Lms.fmtTime(e.startTime)}–${Lms.fmtTime(e.endTime)} • ${e.room || ''}`, 'ACADEMIC', 'timetable'));
        });
        if (classId !== 'all') {
            Lms.notifyClass(classId, 'Class Timetable Updated',
                `${entries.map(e => `${e.periodName} at ${Lms.fmtTime(e.startTime)}`).join(', ')} on ${days.join(', ')} (${room || 'room TBA'}).`, 'ACADEMIC', 'timetable');
        }
        window.App.closeModal();
        window.App.showToast(slotId ? 'Timetable entry updated' : `Timetable saved for ${days.length} day(s)`, 'success');
        window.App.navigate('timetable');
    },

    editSlot(slotId) {
        this._confirmedConflicts = false;
        this.openAddSlotModal(slotId);
    },

    deleteSlot(slotId) {
        const slot = (window.LmsData.timetables || []).find(t => t.id === slotId);
        if (!slot || !confirm(`Delete ${slot.periodName} (${slot.day} ${Lms.fmtTime(slot.startTime)})?`)) return;
        window.LmsData.timetables = window.LmsData.timetables.filter(t => t.id !== slotId);
        Lms.save();
        window.App.showToast('Period removed', 'success');
        window.App.navigate('timetable');
    },

    // ---------------------------------------------------------------------
    // PRINT & PDF: the timetable currently shown (class filter / teacher / student), as an official A4 sheet.
    // Reads the saved periods and the free-time calculation above; changes nothing.
    // ---------------------------------------------------------------------
    PDF_LIBS: [
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
    ],
    LOGO_URL: 'assets/images/logo.png',

    printModel() {
        const me = Lms.me();
        const inst = window.LmsData.institution || {};
        const portal = Lms.portal();
        const slots = this.filteredSlots();
        const classId = portal === 'student' ? me.classId : (!['ALL', 'MINE'].includes(this.classFilter) ? this.classFilter : null);
        const cls = classId ? Lms.getClass(classId) : null;
        const multiClass = !cls;
        const session = (window.LmsData.sessions || []).find(s => s.isCurrent) || null;
        const days = this.DAYS.filter(d => slots.some(s => s.day === d));
        const rowOf = s => {
            const minutes = this.toMin(s.endTime) - this.toMin(s.startTime);
            return {
                free: !!s.free, startTime: s.startTime, endTime: s.endTime, minutes,
                time: `${Lms.fmtTime(s.startTime)} – ${Lms.fmtTime(s.endTime)}`,
                course: s.free ? 'Free Time' : (s.courseId ? Lms.courseTitle(s.courseId) : (s.periodName || '—')),
                code: s.free || !s.courseId ? '' : ((Lms.getCourse(s.courseId) || {}).code || ''),
                teacher: s.free || !s.teacherId ? '—' : Lms.userName(s.teacherId),
                room: s.free ? '' : (s.room || '—'),
                className: s.classId === 'all' ? 'All classes' : Lms.className(s.classId)
            };
        };
        const dayBlocks = days.map(day => {
            const rows = this.sortSlots(slots.filter(s => s.day === day).concat(this.freeRowsFor(day, slots))).map(rowOf);
            return {
                day, rows,
                teaching: rows.filter(r => !r.free).reduce((s, r) => s + r.minutes, 0),
                freeMinutes: rows.filter(r => r.free).reduce((s, r) => s + r.minutes, 0)
            };
        });
        const branch = Lms.branchName((cls && cls.branchId) || inst.mainBranchId || '');
        const classTeacher = cls && cls.teacherId ? Lms.userName(cls.teacherId) : '';
        const program = cls ? (Lms.program(cls.programId) || {}).name || '' : '';
        const subject = cls ? Lms.className(cls.id)
            : (portal === 'teacher' && this.classFilter === 'MINE' ? `${me.name || ''} — Teaching Schedule` : 'All Classes');
        const meta = [
            ['Class', cls ? Lms.className(cls.id) : (portal === 'teacher' && this.classFilter === 'MINE' ? 'All classes taught' : 'All classes')],
            program ? ['Program', program] : null,
            classTeacher ? ['Class Teacher', classTeacher] : null,
            portal === 'teacher' && this.classFilter === 'MINE' ? ['Teacher', me.name || ''] : null,
            cls && cls.room ? ['Room', cls.room] : null,
            branch ? ['Campus', branch] : null,
            session ? ['Academic Session', session.name] : null,
            ['Generated on', Lms.fmtDateTime(new Date().toISOString())]
        ].filter(Boolean);
        return {
            institution: inst.name || 'Jamia Ashrafia Lahore',
            urduName: inst.urduName || '',
            subtitle: [inst.motto, inst.affiliation].filter(Boolean).join(' • '),
            address: [inst.mainCampus, inst.phone, inst.website].filter(Boolean).join(' • '),
            title: cls ? 'Class Timetable' : 'Timetable',
            subject, meta, multiClass, dayBlocks,
            totalTeaching: dayBlocks.reduce((s, b) => s + b.teaching, 0),
            totalFree: dayBlocks.reduce((s, b) => s + b.freeMinutes, 0),
            fileName: `Timetable-${subject}`.replace(/[^A-Za-z0-9]+/g, '-').replace(/-+$/, '') + `-${Lms.today()}.pdf`
        };
    },

    // The printable sheet (HTML) for the browser's print dialog
    printSheetHtml(m) {
        const cols = m.multiClass ? 7 : 6;
        return `
            <div class="tt-sheet">
                <header class="tt-sheet-head">
                    <img src="${this.LOGO_URL}" alt="" class="tt-sheet-logo">
                    <div class="tt-sheet-inst">
                        <div class="tt-sheet-name">${Lms.esc(m.institution)}</div>
                        ${m.urduName ? `<div class="tt-sheet-urdu" dir="rtl" translate="no">${Lms.esc(m.urduName)}</div>` : ''}
                        ${m.subtitle ? `<div class="tt-sheet-sub">${Lms.esc(m.subtitle)}</div>` : ''}
                        ${m.address ? `<div class="tt-sheet-sub">${Lms.esc(m.address)}</div>` : ''}
                    </div>
                    <img src="${this.LOGO_URL}" alt="" class="tt-sheet-logo" style="visibility: hidden;">
                </header>
                <div class="tt-sheet-title">${Lms.esc(m.title)}</div>
                <div class="tt-sheet-meta">
                    ${m.meta.map(([k, v]) => `<div><span>${Lms.esc(k)}:</span> <strong>${Lms.esc(v)}</strong></div>`).join('')}
                </div>
                <table class="tt-sheet-table">
                    <thead><tr>
                        <th style="width: 11%;">Day</th><th style="width: 17%;">Time</th><th style="width: 9%;">Duration</th>
                        <th>Course / Kitab</th>${m.multiClass ? '<th style="width: 16%;">Class</th>' : ''}<th style="width: 15%;">Teacher</th><th style="width: 16%;">Room</th>
                    </tr></thead>
                    ${m.dayBlocks.map(b => `
                        <tbody class="tt-sheet-day">
                            ${b.rows.map((r, i) => `
                                <tr class="${r.free ? 'is-free' : ''}">
                                    ${i === 0 ? `<td rowspan="${b.rows.length}" class="tt-sheet-dayname">${Lms.esc(b.day)}</td>` : ''}
                                    <td class="tt-sheet-time">${Lms.esc(r.time)}</td>
                                    <td>${r.minutes} min</td>
                                    <td>${r.free ? '<em>Free Time</em>' : `<strong>${Lms.esc(r.course)}</strong>${r.code ? ` <span class="tt-sheet-code">${Lms.esc(r.code)}</span>` : ''}`}</td>
                                    ${m.multiClass ? `<td>${Lms.esc(r.className)}</td>` : ''}
                                    <td>${Lms.esc(r.teacher)}</td>
                                    <td>${Lms.esc(r.room)}</td>
                                </tr>`).join('')}
                            <tr class="tt-sheet-total"><td colspan="${cols}">${b.day}: Teaching ${b.teaching} min${b.freeMinutes ? ` • Free Time ${b.freeMinutes} min` : ''}</td></tr>
                        </tbody>`).join('')}
                </table>
                <div class="tt-sheet-summary">Weekly total: Teaching ${m.totalTeaching} min${m.totalFree ? ` • Free Time ${m.totalFree} min` : ''}</div>
                <div class="tt-sheet-sign">
                    <div><span></span>Class Teacher</div>
                    <div><span></span>Nazim-e-Taleemat</div>
                    <div><span></span>Mohtamim</div>
                </div>
                <footer class="tt-sheet-foot">Generated from ${Lms.esc(m.institution)} LMS</footer>
            </div>`;
    },

    printTimetable() {
        const m = this.printModel();
        if (!m.dayBlocks.length) {
            window.App.showToast('There are no periods to print for this selection.', 'warning');
            return;
        }
        let sheet = document.getElementById('tt-print-sheet');
        if (!sheet) {
            sheet = document.createElement('div');
            sheet.id = 'tt-print-sheet';
            document.body.appendChild(sheet);
        }
        sheet.innerHTML = this.printSheetHtml(m);
        // A4 landscape for this print only; removed again afterwards
        const page = document.createElement('style');
        page.id = 'tt-print-page';
        page.textContent = '@page { size: A4 landscape; margin: 10mm; }';
        document.head.appendChild(page);
        document.body.classList.add('tt-printing');
        const cleanup = () => {
            document.body.classList.remove('tt-printing');
            page.remove();
            window.removeEventListener('afterprint', cleanup);
        };
        window.addEventListener('afterprint', cleanup);
        // Let the logo load before the print dialog takes its snapshot
        const logo = sheet.querySelector('.tt-sheet-logo');
        const go = () => setTimeout(() => window.print(), 50);
        if (logo && !logo.complete) { logo.onload = go; logo.onerror = go; } else go();
    },

    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error(`Could not load ${src}`));
            document.head.appendChild(s);
        });
    },

    async logoDataUrl() {
        try {
            const blob = await (await fetch(this.LOGO_URL)).blob();
            return await new Promise(resolve => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.onerror = () => resolve(null);
                r.readAsDataURL(blob);
            });
        } catch (e) {
            return null;
        }
    },

    async downloadPdf(btn) {
        const m = this.printModel();
        if (!m.dayBlocks.length) {
            window.App.showToast('There are no periods to download for this selection.', 'warning');
            return;
        }
        await Lms.busy(btn, async () => {
            try {
                for (const src of this.PDF_LIBS) await this.loadScript(src);
            } catch (e) {
                throw new Error('The PDF tool could not be loaded (no internet connection?). Use Print Timetable and choose "Save as PDF" instead.');
            }
            const doc = this.buildPdf(m, await this.logoDataUrl());
            doc.save(m.fileName);
            this._lastPdf = doc;
            window.App.showToast('Timetable PDF downloaded', 'success');
        }, 'Preparing PDF...');
    },

    // A4 landscape PDF with the same content as the printed sheet (text, not an image)
    buildPdf(m, logo) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const W = doc.internal.pageSize.getWidth();
        const H = doc.internal.pageSize.getHeight();
        const M = 12;
        const TEAL = [26, 94, 111];
        const GOLD = [170, 134, 55];
        // Built-in PDF fonts are Latin only: keep the English text (names, titles) and drop other scripts
        const t = s => String(s === undefined || s === null ? '' : s).replace(/[^\u0000-ɏ–—•‘’“”]/g, '').trim();

        let y = M;
        if (logo) {
            const p = doc.getImageProperties(logo);
            const h = 20;
            doc.addImage(logo, 'PNG', M, y, h * p.width / p.height, h);
        }
        doc.setTextColor(...TEAL).setFont('helvetica', 'bold').setFontSize(18).text(t(m.institution), W / 2, y + 7, { align: 'center' });
        doc.setTextColor(90).setFont('helvetica', 'normal').setFontSize(9);
        if (t(m.subtitle)) doc.text(t(m.subtitle), W / 2, y + 13, { align: 'center' });
        if (t(m.address)) doc.text(t(m.address), W / 2, y + 18, { align: 'center' });
        y += 24;
        doc.setDrawColor(...GOLD).setLineWidth(0.6).line(M, y, W - M, y);
        y += 3;
        doc.setFillColor(...TEAL).rect(M, y, W - 2 * M, 9, 'F');
        doc.setTextColor(255).setFont('helvetica', 'bold').setFontSize(12).text(t(m.title).toUpperCase(), W / 2, y + 6.2, { align: 'center' });
        y += 14;

        // Class information, three to a line
        doc.setFontSize(9.5);
        const colW = (W - 2 * M) / 3;
        m.meta.forEach(([k, v], i) => {
            const x = M + (i % 3) * colW;
            const yy = y + Math.floor(i / 3) * 5.5;
            doc.setFont('helvetica', 'normal').setTextColor(100).text(`${t(k)}:`, x, yy);
            doc.setFont('helvetica', 'bold').setTextColor(30).text(t(v), x + doc.getTextWidth(`${t(k)}: `), yy, { maxWidth: colW - doc.getTextWidth(`${t(k)}: `) - 2 });
        });
        y += Math.ceil(m.meta.length / 3) * 5.5 + 2;

        const head = [['Day', 'Time', 'Duration', 'Course / Kitab'].concat(m.multiClass ? ['Class'] : [], ['Teacher', 'Room'])];
        const cols = head[0].length;
        const body = [];
        m.dayBlocks.forEach(b => {
            b.rows.forEach((r, i) => {
                const style = r.free ? { fillColor: [232, 244, 247], textColor: TEAL, fontStyle: 'italic' } : {};
                const cell = (content, extra = {}) => ({ content: t(content), styles: { ...style, ...extra } });
                const row = [];
                if (i === 0) row.push({ content: t(b.day), rowSpan: b.rows.length, styles: { fontStyle: 'bold', valign: 'middle', textColor: TEAL } });
                row.push(cell(r.time), cell(`${r.minutes} min`),
                    cell(r.free ? 'Free Time' : `${r.course}${r.code ? `  (${r.code})` : ''}`, r.free ? {} : { fontStyle: 'bold' }));
                if (m.multiClass) row.push(cell(r.className));
                row.push(cell(r.teacher), cell(r.room));
                body.push(row);
            });
            body.push([{
                content: t(`${b.day}: Teaching ${b.teaching} min${b.freeMinutes ? ` • Free Time ${b.freeMinutes} min` : ''}`), colSpan: cols,
                styles: { halign: 'right', fontSize: 8, textColor: 90, fillColor: [248, 250, 252], fontStyle: 'italic' }
            }]);
        });

        doc.autoTable({
            startY: y, head, body, theme: 'grid', margin: { left: M, right: M, bottom: 16 },
            styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.2, lineColor: [204, 216, 223], lineWidth: 0.2, textColor: 30, valign: 'middle' },
            headStyles: { fillColor: TEAL, textColor: 255, fontStyle: 'bold', halign: 'left' },
            columnStyles: m.multiClass
                ? { 0: { cellWidth: 26 }, 1: { cellWidth: 40 }, 2: { cellWidth: 22 }, 4: { cellWidth: 42 }, 5: { cellWidth: 40 }, 6: { cellWidth: 30 } }
                : { 0: { cellWidth: 28 }, 1: { cellWidth: 44 }, 2: { cellWidth: 24 }, 4: { cellWidth: 48 }, 5: { cellWidth: 36 } }
        });

        let end = doc.lastAutoTable.finalY + 6;
        if (end > H - 40) { doc.addPage(); end = M + 6; }
        doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...TEAL)
            .text(t(`Weekly total: Teaching ${m.totalTeaching} min${m.totalFree ? ` • Free Time ${m.totalFree} min` : ''}`), M, end);
        const signY = end + 22;
        ['Class Teacher', 'Nazim-e-Taleemat', 'Mohtamim'].forEach((label, i) => {
            const x = M + 10 + i * ((W - 2 * M - 20) / 3);
            doc.setDrawColor(120).setLineWidth(0.3).line(x, signY, x + 60, signY);
            doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(80).text(label, x + 30, signY + 5, { align: 'center' });
        });

        const pages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pages; i++) {
            doc.setPage(i);
            doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(130);
            doc.text(t(`Generated from ${m.institution} LMS • ${m.meta.find(x => x[0] === 'Generated on')[1]}`), M, H - 7);
            doc.text(`Page ${i} of ${pages}`, W - M, H - 7, { align: 'right' });
        }
        return doc;
    }
};

window.TimetableModule = TimetableModule;
