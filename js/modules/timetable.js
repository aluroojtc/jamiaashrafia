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
                    <button class="btn btn-secondary btn-sm" onclick="TimetableModule.printTimetable()"><i class="fas fa-print"></i> Print</button>
                    ${canManage ? `<button class="btn btn-gold btn-sm" onclick="TimetableModule.openAddSlotModal()"><i class="fas fa-calendar-plus"></i> Add Period</button>` : ''}
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
        const canManage = this.canManage();
        const isToday = this.selectedDay === this.todayName();
        const now = new Date().toTimeString().slice(0, 5);
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
                    <span class="status-pill gold">${slots.length} period(s)</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${this.selectedDay === 'Friday' && !slots.length ? `
                        <div style="padding: 16px; background: linear-gradient(135deg, rgba(18, 72, 85, 0.08) 0%, rgba(170, 134, 55, 0.12) 100%); border-left: 4px solid var(--gold-600); border-radius: var(--radius-sm);">
                            <strong style="color: var(--gold-800);">Jumu'ah</strong>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">Friday is reserved for Surah al-Kahf, Jumu'ah in the Grand Jamia Mosque and personal revision (Mutala'ah). Classes resume Saturday with the Fajr Dars.</div>
                        </div>` : ''}
                    ${slots.length ? slots.map(slot => {
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
                                    <div style="text-align: right;">
                                        <div style="font-family: monospace; font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">${Lms.fmtTime(slot.startTime)} – ${Lms.fmtTime(slot.endTime)}</div>
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
        const times = Array.from(new Set(slots.map(s => `${s.startTime}-${s.endTime}`))).sort();
        const days = this.DAYS.filter(d => d !== 'Friday' || slots.some(s => s.day === 'Friday'));
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
                                        <td style="font-family: monospace; font-size: 0.78rem; white-space: nowrap;">${Lms.fmtTime(st)}<br>${Lms.fmtTime(en)}</td>
                                        ${days.map(d => {
                                            const cell = slots.filter(s => s.day === d && s.startTime === st && s.endTime === en);
                                            return `<td style="font-size: 0.76rem; vertical-align: top;">${cell.map(s => `
                                                <div style="padding: 4px 6px; margin-bottom: 4px; border-radius: 4px; background: ${s.courseId ? 'var(--primary-50)' : 'var(--gold-50)'}; ${this.canManage() ? 'cursor: pointer;' : ''}" ${this.canManage() ? `onclick="TimetableModule.editSlot('${s.id}')"` : ''}>
                                                    <strong>${Lms.esc(s.courseId ? (Lms.getCourse(s.courseId) || {}).code || Lms.courseTitle(s.courseId) : s.periodName)}</strong>
                                                    ${this.classFilter === 'ALL' || this.classFilter === 'MINE' ? `<div style="color: var(--text-muted);">${Lms.esc(s.classId === 'all' ? '' : (Lms.getClass(s.classId) || {}).name || '')}</div>` : ''}
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
                        <div style="display: flex; gap: 10px; padding: 10px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm); border-left: 3px solid ${i.color}; cursor: pointer;" onclick="App.navigate('${i.route}')">
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
    openAddSlotModal(slotId) {
        this._confirmedConflicts = false;
        this._autoRoom = null;
        const slot = slotId ? (window.LmsData.timetables || []).find(t => t.id === slotId) : null;
        const defaultClass = slot ? slot.classId : (this.classFilter && !['ALL', 'MINE'].includes(this.classFilter) ? this.classFilter : (window.LmsData.classes[0] || {}).id);
        Lms.openModal(
            `<i class="fas fa-calendar-plus" style="color: var(--gold-400);"></i> ${slot ? 'Edit Period' : 'Add Period to Timetable'}`,
            `<div class="form-group" style="margin-bottom: 14px;">
                <label>Day(s) *</label>
                <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                    ${this.DAYS.map(d => `
                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                            <input type="checkbox" class="slot-day" value="${d}" ${(slot ? slot.day === d : d === this.selectedDay) ? 'checked' : ''} ${slot ? 'onclick="return this.checked || document.querySelectorAll(\'.slot-day:checked\').length > 0"' : ''}> ${d}
                        </label>`).join('')}
                </div>
                ${slot ? '' : '<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">Tick several days to repeat this period through the week.</div>'}
            </div>
            <div class="form-grid">
                <div class="form-group"><label>Start Time *</label><input type="time" id="slot-start" class="form-control" value="${Lms.esc(slot ? slot.startTime : '08:00')}"></div>
                <div class="form-group"><label>End Time *</label><input type="time" id="slot-end" class="form-control" value="${Lms.esc(slot ? slot.endTime : '09:30')}"></div>
                <div class="form-group"><label>Class *</label>
                    <select id="slot-class" class="form-control" onchange="TimetableModule.refreshSlotCourses()">
                        <option value="all" ${defaultClass === 'all' ? 'selected' : ''}>All classes (prayer / break / assembly)</option>
                        ${Lms.classOptions(defaultClass)}
                    </select>
                </div>
                <div class="form-group"><label>Course / Kitab</label><select id="slot-course" class="form-control" onchange="TimetableModule.autoTeacher()"></select></div>
                <div class="form-group"><label>Teacher (Ustad)</label><select id="slot-teacher" class="form-control">${Lms.teacherOptions(slot ? slot.teacherId : '', true)}</select></div>
                <div class="form-group"><label>Hall / Room</label><input type="text" id="slot-room" class="form-control" value="${Lms.esc(slot ? slot.room : '')}" placeholder="e.g. Hall Imam Bukhari"></div>
                <div class="form-group"><label>Period Name</label><input type="text" id="slot-name" class="form-control" value="${Lms.esc(slot ? slot.periodName : '')}" placeholder="e.g. Fajr Dars / Sabq 2 / Namaz-e-Zuhr"></div>
            </div>
            <div id="slot-conflicts"></div>`,
            `<button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
             <button class="btn btn-gold" onclick="TimetableModule.saveSlot('${slot ? slot.id : ''}')"><i class="fas fa-save"></i> ${slot ? 'Save Changes' : 'Save to Timetable'}</button>`
        );
        this.refreshSlotCourses(slot ? slot.courseId : undefined, !!slot);
    },

    refreshSlotCourses(selected, keepTeacher) {
        const classId = Lms.val('slot-class');
        const ids = classId === 'all' ? [] : Lms.classCourseIds(classId);
        const list = ids.length ? ids : (window.LmsData.courses || []).map(c => c.id);
        document.getElementById('slot-course').innerHTML = `<option value="">— No kitab (break / prayer / other) —</option>` + Lms.courseOptions(selected, classId === 'all' ? [] : list);
        if (!keepTeacher) this.autoTeacher();
        // Follow the class's own room unless the user typed a different one
        const cls = Lms.getClass(classId);
        const room = document.getElementById('slot-room');
        if (cls && room && (!room.value || room.value === this._autoRoom)) {
            room.value = cls.room || '';
            this._autoRoom = room.value;
        }
    },

    autoTeacher() {
        const classId = Lms.val('slot-class');
        const courseId = Lms.val('slot-course');
        if (!courseId) return;
        const teacherId = Lms.courseTeacherId(classId, courseId);
        if (teacherId) document.getElementById('slot-teacher').value = teacherId;
    },

    // Overlapping periods on the same day that share the teacher, the room or the class
    findConflicts(candidate, ignoreId) {
        const overlaps = (a, b) => a.startTime < b.endTime && b.startTime < a.endTime;
        return (window.LmsData.timetables || []).filter(t => t.id !== ignoreId && t.day === candidate.day && overlaps(t, candidate)).map(t => {
            const reasons = [];
            if (candidate.teacherId && t.teacherId === candidate.teacherId) reasons.push(`${Lms.userName(t.teacherId)} is already teaching`);
            if (candidate.room && t.room && t.room.toLowerCase() === candidate.room.toLowerCase() && candidate.classId !== 'all' && t.classId !== 'all') reasons.push(`room "${t.room}" is in use`);
            if (candidate.classId !== 'all' && t.classId === candidate.classId) reasons.push(`${Lms.className(t.classId)} already has a period`);
            return reasons.length ? { slot: t, reasons } : null;
        }).filter(Boolean);
    },

    saveSlot(slotId) {
        const days = Array.from(document.querySelectorAll('.slot-day:checked')).map(c => c.value);
        const fields = {
            startTime: Lms.val('slot-start'),
            endTime: Lms.val('slot-end'),
            classId: Lms.val('slot-class'),
            courseId: Lms.val('slot-course') || null,
            teacherId: Lms.val('slot-teacher') || null,
            room: Lms.val('slot-room'),
            periodName: Lms.val('slot-name')
        };
        if (!days.length || !fields.startTime || !fields.endTime) {
            window.App.showToast('Choose at least one day and the start/end time', 'warning');
            return;
        }
        if (fields.endTime <= fields.startTime) {
            window.App.showToast('End time must be after start time', 'warning');
            return;
        }
        if (!fields.courseId && !fields.periodName) {
            window.App.showToast('Choose a kitab or give the period a name (e.g. Namaz-e-Zuhr)', 'warning');
            return;
        }
        if (!fields.periodName) fields.periodName = Lms.courseTitle(fields.courseId);

        const conflicts = days.flatMap(day => this.findConflicts({ ...fields, day }, slotId));
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

        if (slotId) {
            const slot = window.LmsData.timetables.find(t => t.id === slotId);
            Object.assign(slot, fields, { day: days[0] });
        } else {
            days.forEach(day => window.LmsData.timetables.push({ id: Lms.uid('tt'), day, ...fields }));
        }
        Lms.save();
        if (fields.teacherId) {
            Lms.notifyUser(fields.teacherId, 'Timetable Updated',
                `${fields.periodName} • ${Lms.className(fields.classId)} • ${days.join(', ')} ${Lms.fmtTime(fields.startTime)}–${Lms.fmtTime(fields.endTime)} • ${fields.room || ''}`, 'ACADEMIC', 'timetable');
        }
        if (fields.classId !== 'all') {
            Lms.notifyClass(fields.classId, 'Class Timetable Updated',
                `${fields.periodName} on ${days.join(', ')} at ${Lms.fmtTime(fields.startTime)} (${fields.room || 'room TBA'}).`, 'ACADEMIC', 'timetable');
        }
        window.App.closeModal();
        window.App.showToast(slotId ? 'Period updated' : `Period added for ${days.length} day(s)`, 'success');
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

    printTimetable() {
        if (this.view !== 'week') {
            this.view = 'week';
            window.App.navigate('timetable');
        }
        setTimeout(() => window.print(), 150);
    }
};

window.TimetableModule = TimetableModule;
