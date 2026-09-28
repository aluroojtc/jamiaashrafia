/**
 * JAMIA ASHRAFIA LAHORE - SCHEDULES & TIMETABLES MODULE
 * Prayer-synchronized lecture grids, Hall allocations, and weekly schedule
 */

const TimetableModule = {
    selectedDay: "Monday",

    render() {
        const timetables = window.LmsData.timetables;
        const canManage = window.AuthRBAC.can("timetable:manage") || window.AuthRBAC.isAdmin();

        return `
            <div class="view-header">
                <div class="view-title-group">
                    <h1>
                        <i class="fas fa-calendar-alt" style="color: var(--primary-400);"></i>
                        Schedules & Daily Timetables
                    </h1>
                    <p>Academic lectures synchronized with the 5 daily prayer times (مواقيت الصلاة) and Madaris tradition</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-secondary btn-sm" onclick="window.print()">
                        <i class="fas fa-print"></i> Print Weekly Grid
                    </button>
                    ${canManage ? `
                        <button class="btn btn-gold btn-sm" onclick="TimetableModule.openAddSlotModal()">
                            <i class="fas fa-calendar-plus"></i> Add Lecture Period
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- DAY SELECTOR TABS -->
            <div class="tabs-nav">
                ${["Monday", "Tuesday", "Wednesday", "Thursday", "Saturday", "Sunday"].map(day => `
                    <button class="tab-btn ${this.selectedDay === day ? 'active' : ''}" onclick="TimetableModule.selectDay('${day}')">
                        <i class="fas fa-clock"></i> ${day}
                    </button>
                `).join('')}
            </div>

            <!-- TIMETABLE CARDS GRID -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-chalkboard"></i> ${this.selectedDay}'s Daily Lecture & Prayer Schedule
                    </h3>
                    <span class="status-pill gold"><i class="fas fa-mosque"></i> Grand Mosque Synchronized</span>
                </div>

                <div style="display: flex; flex-direction: column; gap: 14px;">
                    ${timetables.map(slot => {
                        const isPrayer = !slot.courseId;
                        const course = slot.courseId ? window.LmsData.courses.find(c => c.id === slot.courseId) : null;

                        return `
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: ${isPrayer ? 'rgba(6, 78, 59, 0.25)' : 'var(--bg-surface-elevated)'}; border: 1px solid ${isPrayer ? 'var(--primary-600)' : 'var(--border-subtle)'}; border-radius: var(--radius-md); flex-wrap: wrap; gap: 12px;">
                                <div style="display: flex; align-items: center; gap: 16px;">
                                    <div style="width: 44px; height: 44px; border-radius: var(--radius-sm); background: ${isPrayer ? 'rgba(217, 119, 6, 0.25)' : 'rgba(6, 78, 59, 0.3)'}; color: ${isPrayer ? 'var(--gold-300)' : 'var(--primary-400)'}; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                                        <i class="${isPrayer ? 'fas fa-mosque' : 'fas fa-book-reader'}"></i>
                                    </div>
                                    <div>
                                        <div style="font-weight: 700; font-size: 1rem; color: #ffffff;">
                                            ${isPrayer ? slot.periodName : course?.title}
                                        </div>
                                        <div style="font-size: 0.8rem; color: var(--gold-300);">
                                            ${course ? course.urduTitle : 'نماز باجماعت، طعام اور قیلولہ'}
                                        </div>
                                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                                            <i class="fas fa-user-tie"></i> ${slot.teacher} • <i class="fas fa-door-open"></i> ${slot.room}
                                        </div>
                                    </div>
                                </div>

                                <div style="display: flex; align-items: center; gap: 14px;">
                                    <div style="text-align: right;">
                                        <div style="font-family: monospace; font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">${slot.time}</div>
                                        <span class="status-pill ${isPrayer ? 'gold' : 'info'}" style="font-size: 0.65rem;">
                                            ${slot.periodName}
                                        </span>
                                    </div>
                                    ${canManage ? `
                                        <button class="btn btn-secondary btn-sm" onclick="TimetableModule.editSlot('${slot.id}')">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- FRIDAY ADVICE NOTE -->
            <div class="card" style="background: linear-gradient(135deg, rgba(6, 78, 59, 0.2) 0%, rgba(180, 83, 9, 0.15) 100%); border-left: 4px solid var(--gold-400);">
                <h4 style="color: var(--gold-300); margin-bottom: 6px;"><i class="fas fa-info-circle"></i> Friday (Jumu'ah) Tradition at Jamia Ashrafia</h4>
                <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.7;">
                    In accordance with century-old madrasa practice, Friday is reserved for Quranic recitation (Surah al-Kahf), 
                    preparation for the historic Jumu'ah sermon in the Grand Jamia Mosque led by Hazrat Mohtamim, and personal research revision (Mutala'ah). 
                    Formal classes resume on Saturday morning with the Fajr Dars.
                </p>
            </div>
        `;
    },

    selectDay(day) {
        this.selectedDay = day;
        window.App.navigate('timetable');
    },

    openAddSlotModal() {
        const modalBody = document.getElementById('modal-body-container');
        const modalTitle = document.getElementById('modal-title-text');
        
        modalTitle.innerHTML = `<i class="fas fa-calendar-plus" style="color: var(--gold-400);"></i> Add Lecture Slot to Timetable`;
        modalBody.innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    <label>Day of Week</label>
                    <select id="slot-day" class="form-control">
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Saturday">Saturday</option>
                        <option value="Sunday">Sunday</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Period Title / Name *</label>
                    <input type="text" id="slot-name" class="form-control" placeholder="e.g. Sabq 1 / Hadith Dars">
                </div>
                <div class="form-group">
                    <label>Time Interval *</label>
                    <input type="text" id="slot-time" class="form-control" placeholder="08:00 AM - 09:30 AM">
                </div>
                <div class="form-group">
                    <label>Course / Kitab</label>
                    <select id="slot-course" class="form-control">
                        ${window.LmsData.courses.map(c => `<option value="${c.id}">${c.title}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Teacher (Ustad)</label>
                    <select id="slot-teacher" class="form-control">
                        ${window.LmsData.users.filter(u => u.role === 'TEACHER').map(t => `<option value="${t.name}">${t.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Lecture Hall / Room</label>
                    <input type="text" id="slot-room" class="form-control" value="Hall Imam Bukhari">
                </div>
            </div>
        `;

        const modalFooter = document.getElementById('modal-footer-container');
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="window.App.closeModal()">Cancel</button>
            <button class="btn btn-gold" onclick="TimetableModule.saveSlot()">Save to Timetable</button>
        `;
        window.App.openModal();
    },

    saveSlot() {
        const name = document.getElementById('slot-name').value.trim();
        const time = document.getElementById('slot-time').value.trim();
        const courseId = document.getElementById('slot-course').value;
        const teacher = document.getElementById('slot-teacher').value;
        const room = document.getElementById('slot-room').value.trim();

        if (!name || !time) {
            window.App.showToast("Please provide period name and time", "warning");
            return;
        }

        const newSlot = {
            id: `tt_${Date.now()}`,
            day: document.getElementById('slot-day').value,
            period: window.LmsData.timetables.length + 1,
            time: time,
            periodName: name,
            courseId: courseId,
            teacher: teacher,
            room: room || "Main Hall",
            classId: "cls_dawra_a"
        };

        window.LmsData.timetables.push(newSlot);
        window.DataStore.save(window.LmsData);
        window.App.closeModal();
        window.App.showToast("Timetable period successfully added!", "success");
        window.App.navigate('timetable');
    }
};

window.TimetableModule = TimetableModule;
