/**
 * JAMIA ASHRAFIA LAHORE - CLOUD LMS DATA STORE
 * Browser copy of the shared record store (MySQL on the server) and the engine that keeps it in sync.
 * No institutional records are written in this file: teachers, students, classes, online classes, branches,
 * programmes and everything else come from the server and are managed by administrators in the portal.
 */

const STORAGE_KEY = 'JAMIA_ASHRAFIA_LMS_DATA_V1';

// Global Comprehensive World Countries List for International Student Admissions
const WORLD_COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Argentina", "Australia", "Austria", "Azerbaijan",
    "Bahrain", "Bangladesh", "Belgium", "Bosnia and Herzegovina", "Brazil", "Brunei", "Bulgaria",
    "Canada", "China", "Cyprus", "Czech Republic", "Denmark", "Egypt", "Fiji", "Finland",
    "France", "Georgia", "Germany", "Ghana", "Greece", "Hong Kong", "Hungary", "India",
    "Indonesia", "Iran", "Iraq", "Ireland", "Italy", "Japan", "Jordan", "Kazakhstan",
    "Kenya", "Kuwait", "Kyrgyzstan", "Lebanon", "Libya", "Malaysia", "Maldives", "Mauritius",
    "Mexico", "Morocco", "Nepal", "Netherlands", "New Zealand", "Nigeria", "Norway", "Oman",
    "Pakistan", "Palestine", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia",
    "Saudi Arabia", "Singapore", "Somalia", "South Africa", "South Korea", "Spain", "Sri Lanka",
    "Sudan", "Sweden", "Switzerland", "Syria", "Tajikistan", "Tanzania", "Thailand", "Tunisia",
    "Turkey", "Turkmenistan", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
    "United States", "Uzbekistan", "Yemen", "Zambia", "Zimbabwe"
];
window.WORLD_COUNTRIES = WORLD_COUNTRIES;

// Shape of the browser copy before anything has been loaded from the server
const EMPTY_DATA = {
    institution: { branches: [] },
    programs: [],
    sessions: [],
    departments: [],
    roles: [],
    users: [],
    classes: [],
    courses: [],
    courseMaterials: [],
    admissions: [],
    assignments: [],
    assignmentSubmissions: [],
    exams: [],
    examSubmissions: [],
    examResults: [],
    feeStructures: [],
    feeChallans: [],
    donations: [],
    libraryBooks: [],
    libraryLoans: [],
    timetables: [],
    virtualClasses: [],
    virtualClassRecordings: [],
    notifications: [],
    attendance: []
};

// DATA STORE CONTROLLER
// Version 4: browsers no longer carry built-in sample records. A copy saved by an older version is discarded
// and fetched again from the server, so sample records cached in a browser are never sent back.
const DATA_SCHEMA_VERSION = 4;
const clone = (v) => JSON.parse(JSON.stringify(v));

// Collections shared with every other user through the server record store (see server/lms-api.js)
const SYNC_COLLECTIONS = [
    'users', 'classes', 'courses', 'courseMaterials', 'assignments', 'assignmentSubmissions',
    'exams', 'examSubmissions', 'examResults', 'timetables', 'libraryBooks', 'libraryLoans',
    'feeStructures', 'feeChallans', 'donations', 'virtualClasses', 'virtualClassRecordings', 'attendance'
];

// ---------------------------------------------------------------------------
// Multi-user sync engine: pulls other users' changes and pushes local ones
// ---------------------------------------------------------------------------

const SYNC_STATE_KEY = 'JAMIA_ASHRAFIA_LMS_SYNC_V1';
// Set at sign-in: the next full pull replaces the local copy with what the server shares with this user
const FRESH_SESSION_KEY = 'JAMIA_ASHRAFIA_FRESH_SESSION';

function hashString(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + ':' + str.length;
}

function recordHash(collection, rec) {
    if (collection === 'users' && rec && 'password' in rec) {
        const copy = { ...rec };
        delete copy.password;
        return hashString(JSON.stringify(copy));
    }
    return hashString(JSON.stringify(rec));
}

const SyncEngine = {
    enabled: false,
    online: false,
    since: null,
    snap: {},       // collection -> id -> hash of the record as last agreed with the server
    pw: {},         // user id -> hash of the password last sent
    forceFull: false,
    rejected: {},   // collection -> Set of ids the server refused in the last push
    pushTimer: null,
    chain: Promise.resolve(),
    lastFullAt: 0,

    loadState() {
        try {
            const st = JSON.parse(localStorage.getItem(SYNC_STATE_KEY) || '{}');
            this.since = st.since || null;
            this.snap = st.snap || {};
            this.pw = st.pw || {};
        } catch (e) {
            this.since = null; this.snap = {}; this.pw = {};
        }
    },

    saveState() {
        try {
            localStorage.setItem(SYNC_STATE_KEY, JSON.stringify({ since: this.since, snap: this.snap, pw: this.pw }));
        } catch (e) { /* quota: state is rebuilt on next full pull */ }
    },

    // Who is calling is known to the server from the session cookie; no identity is sent from here
    headers() {
        return { 'Content-Type': 'application/json' };
    },

    // The session ended (signed out elsewhere, password reset, account deactivated) or needs a new password
    checkAuth(res) {
        if (res.status === 401) {
            this.enabled = false;
            localStorage.removeItem('JAMIA_CURRENT_USER_ID');
            if (!/login\.html$/.test(window.location.pathname)) window.location.replace('login.html?expired=1');
            throw new Error('signed out');
        }
        if (res.status === 403 && res.headers.get('content-type')?.includes('json')) {
            return res.clone().json().then(body => {
                if (body && body.mustChangePassword) {
                    this.enabled = false;
                    window.location.replace('login.html#change-password');
                    throw new Error('password change required');
                }
            }, () => {});
        }
    },

    enqueue(fn) {
        this.chain = this.chain.then(fn, fn).catch(err => console.warn('[Sync]', err));
        return this.chain;
    },

    mergeCollection(data, coll, serverRecs, opts) {
        if (!Array.isArray(data[coll])) data[coll] = [];
        const local = data[coll];
        const snap = this.snap[coll] = this.snap[coll] || {};
        const indexById = new Map();
        local.forEach((r, i) => { if (r && r.id) indexById.set(r.id, i); });
        const serverIds = new Set();
        let changed = false;

        (serverRecs || []).forEach(rec => {
            serverIds.add(rec.id);
            const sh = recordHash(coll, rec);
            const idx = indexById.get(rec.id);
            if (idx === undefined) {
                // Deleted here while offline and untouched on the server: keep it deleted (pushed next)
                if (snap[rec.id] === sh) return;
                local.push(rec);
                indexById.set(rec.id, local.length - 1);
                snap[rec.id] = sh;
                if (coll === 'users') this.pw[rec.id] = undefined;
                changed = true;
                return;
            }
            const cur = local[idx];
            const lh = recordHash(coll, cur);
            if (lh === sh) {
                snap[rec.id] = sh;
                if (coll === 'users' && cur.password) this.pw[rec.id] = this.pw[rec.id] || hashString(cur.password);
                return;
            }
            // Changed locally since last sync while the server copy is unchanged: keep ours, push later
            if (snap[rec.id] !== undefined && snap[rec.id] === sh && lh !== sh) return;
            const merged = (coll === 'users' && cur.password) ? { ...rec, password: cur.password } : rec;
            local[idx] = merged;
            snap[rec.id] = sh;
            if (coll === 'users' && cur.password) this.pw[rec.id] = hashString(cur.password);
            changed = true;
        });

        if (opts.full && opts.present) {
            for (let i = local.length - 1; i >= 0; i--) {
                const r = local[i];
                if (!r || !r.id || serverIds.has(r.id)) continue;
                // Known to the server before and unchanged here: someone else deleted it
                if (snap[r.id] !== undefined && recordHash(coll, r) === snap[r.id]) {
                    local.splice(i, 1);
                    delete snap[r.id];
                    changed = true;
                }
            }
        }

        (opts.deleted || []).forEach(id => {
            const idx = local.findIndex(r => r && r.id === id);
            if (idx >= 0 && (snap[id] === undefined || recordHash(coll, local[idx]) === snap[id])) {
                local.splice(idx, 1);
                changed = true;
            }
            delete snap[id];
        });
        return changed;
    },

    async pull(full) {
        const data = window.LmsData;
        const url = full || !this.since ? '/api/store' : `/api/store?since=${encodeURIComponent(this.since)}`;
        const res = await fetch(url, { headers: this.headers(), cache: 'no-store' });
        await this.checkAuth(res);
        if (!res.ok) throw new Error(`pull failed (${res.status})`);
        const payload = await res.json();
        const isFull = !!payload.full;
        const present = new Set(payload.presentCollections || []);
        const changedCollections = [];

        // First full pull after signing in: the server's copy (only what this user may see) replaces the local one.
        if (isFull && localStorage.getItem(FRESH_SESSION_KEY) === '1') {
            SYNC_COLLECTIONS.forEach(coll => {
                if (!present.has(coll)) return;
                const recs = (payload.collections || {})[coll] || [];
                data[coll] = recs.slice();
                const snap = this.snap[coll] = {};
                recs.forEach(r => { snap[r.id] = recordHash(coll, r); });
                changedCollections.push(coll);
            });
            this.pw = {};
            localStorage.removeItem(FRESH_SESSION_KEY);
        }

        // Private collections the server only shares with their owner: drop other people's
        // records locally (e.g. seed data) without treating that as a deletion to push
        const myId = localStorage.getItem('JAMIA_CURRENT_USER_ID');
        Object.entries(payload.scope || {}).forEach(([coll, field]) => {
            if (!Array.isArray(data[coll])) return;
            const snap = this.snap[coll] = this.snap[coll] || {};
            const before = data[coll].length;
            data[coll] = data[coll].filter(r => {
                if (!r || (r[field] === myId && (coll !== 'examResults' || r.published))) return true;
                delete snap[r.id];
                return false;
            });
            if (data[coll].length !== before) changedCollections.push(coll);
        });

        SYNC_COLLECTIONS.forEach(coll => {
            const recs = (payload.collections || {})[coll] || [];
            const deleted = (payload.deleted || {})[coll] || [];
            if (!recs.length && !deleted.length && !(isFull && present.has(coll))) return;
            if (this.mergeCollection(data, coll, recs, { full: isFull, present: present.has(coll), deleted })) {
                changedCollections.push(coll);
            }
        });

        // Local records the server refused and does not have: they were never valid, drop them
        if (isFull) {
            Object.entries(this.rejected).forEach(([coll, ids]) => {
                const onServer = new Set(((payload.collections || {})[coll] || []).map(r => r.id));
                const before = (data[coll] || []).length;
                data[coll] = (data[coll] || []).filter(r => !(ids.has(r.id) && !onServer.has(r.id)));
                if (data[coll].length !== before && !changedCollections.includes(coll)) changedCollections.push(coll);
            });
            this.rejected = {};
        }

        this.since = payload.serverTime;
        if (isFull) this.lastFullAt = Date.now();
        this.online = true;
        if (changedCollections.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
        this.saveState();
        if (changedCollections.length) {
            window.dispatchEvent(new CustomEvent('lms:data_synced', { detail: { collections: changedCollections } }));
        }
        return changedCollections;
    },

    computePush() {
        const data = window.LmsData;
        const upserts = {};
        const deletes = {};
        const meta = {};
        SYNC_COLLECTIONS.forEach(coll => {
            const local = data[coll];
            if (!Array.isArray(local)) return;
            const snap = this.snap[coll] = this.snap[coll] || {};
            const seen = new Set();
            local.forEach(rec => {
                if (!rec || !rec.id) return;
                seen.add(rec.id);
                const h = recordHash(coll, rec);
                let send = snap[rec.id] !== h;
                let payload = rec;
                let ph;
                if (coll === 'users') {
                    ph = rec.password ? hashString(rec.password) : undefined;
                    if (ph && this.pw[rec.id] !== ph) {
                        send = true;
                    } else if ('password' in rec) {
                        payload = { ...rec };
                        delete payload.password;
                    }
                }
                if (send) {
                    (upserts[coll] = upserts[coll] || []).push(payload);
                    (meta[coll] = meta[coll] || {})[rec.id] = { h, ph };
                }
            });
            Object.keys(snap).forEach(id => {
                if (!seen.has(id)) (deletes[coll] = deletes[coll] || []).push(id);
            });
        });
        return { upserts, deletes, meta };
    },

    async push() {
        if (!localStorage.getItem('JAMIA_CURRENT_USER_ID')) return;
        // Previewing a role: nothing is sent (the local copy is discarded when the preview ends)
        if (this.readOnly) return;
        const { upserts, deletes, meta } = this.computePush();
        if (!Object.keys(upserts).length && !Object.keys(deletes).length) return;

        const res = await fetch('/api/store/sync', {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({ upserts, deletes })
        });
        await this.checkAuth(res);
        if (!res.ok) throw new Error(`push failed (${res.status})`);
        const out = await res.json();
        this.online = true;

        let passwordsSent = false;
        Object.entries(out.accepted || {}).forEach(([coll, ids]) => {
            const snap = this.snap[coll] = this.snap[coll] || {};
            ids.forEach(id => {
                const m = meta[coll] && meta[coll][id];
                if (m) {
                    snap[id] = m.h;
                    if (coll === 'users' && m.ph) {
                        // The server keeps only a hash; never leave the password in this browser's storage
                        const rec = (window.LmsData.users || []).find(u => u.id === id);
                        if (rec) delete rec.password;
                        delete this.pw[id];
                        passwordsSent = true;
                    }
                } else {
                    delete snap[id]; // accepted delete
                }
            });
        });
        if (passwordsSent) {
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(window.LmsData)); } catch (e) { /* storage full */ }
        }
        // Explain refusals the person can act on (e.g. a password that is too short, an email already in use)
        const messages = [];
        Object.values(out.errors || {}).forEach(byId => Object.values(byId).forEach(msg => messages.push(msg)));
        if (messages.length && window.App && window.App.showToast) {
            window.App.showToast(`Not saved: ${[...new Set(messages)].join(' ')}`, 'danger');
        }
        let rejectedAny = false;
        Object.entries(out.rejected || {}).forEach(([coll, ids]) => {
            ids.forEach(id => {
                rejectedAny = true;
                if (this.snap[coll]) delete this.snap[coll][id];
                if (coll === 'users') {
                    // A refused password is not retried; the administrator sets a valid one again
                    const rec = (window.LmsData.users || []).find(u => u.id === id);
                    if (rec) delete rec.password;
                    delete this.pw[id];
                }
                (this.rejected[coll] = this.rejected[coll] || new Set()).add(id);
            });
            console.warn(`[Sync] Server rejected changes to ${coll}:`, ids);
        });
        if (rejectedAny) this.forceFull = true;
        this.saveState();
    },

    async cycle(pullFirst) {
        try {
            if (pullFirst) {
                await this.pull(true);
                await this.push();
            } else {
                await this.push();
                const full = this.forceFull || (Date.now() - this.lastFullAt > 5 * 60 * 1000);
                this.forceFull = false;
                await this.pull(full);
            }
        } catch (err) {
            this.online = false;
            console.warn('[Sync] offline, changes kept locally:', err.message);
        }
    },

    schedulePush() {
        if (!this.enabled) return;
        clearTimeout(this.pushTimer);
        this.pushTimer = setTimeout(() => this.enqueue(() => this.push().catch(err => {
            this.online = false;
            console.warn('[Sync] push deferred:', err.message);
        })), 400);
    },

    async start() {
        if (this.enabled) return;
        this.enabled = true;
        this.loadState();
        const initial = this.enqueue(() => this.cycle(true));
        // Don't block the UI for long if the server is slow or offline
        await Promise.race([initial, new Promise(r => setTimeout(r, 6000))]);
        setInterval(() => {
            if (document.visibilityState === 'visible') this.enqueue(() => this.cycle(false));
        }, 15000);
        window.addEventListener('focus', () => this.enqueue(() => this.cycle(false)));
    }
};

const DataStore = {
    get() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if ((parsed.schemaVersion || 1) >= DATA_SCHEMA_VERSION) {
                    // Collections added since this copy was saved start empty
                    let dirty = false;
                    Object.keys(EMPTY_DATA).forEach(key => {
                        if (parsed[key] === undefined || parsed[key] === null) {
                            parsed[key] = clone(EMPTY_DATA[key]);
                            dirty = true;
                        }
                    });
                    if (dirty) localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
                    return parsed;
                }
                // Saved by an older version (may contain built-in sample records): start again from the server
                localStorage.removeItem(SYNC_STATE_KEY);
                localStorage.setItem(FRESH_SESSION_KEY, '1');
            } catch (e) {
                console.error("Failed to parse stored LMS data, starting from the server copy", e);
            }
        }
        const fresh = clone(EMPTY_DATA);
        fresh.schemaVersion = DATA_SCHEMA_VERSION;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        return fresh;
    },

    save(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('[DataStore] Could not save locally:', e);
            if (window.App && window.App.showToast) {
                window.App.showToast('Browser storage is full. Changes are being saved to the server only.', 'warning');
            }
        }
        SyncEngine.schedulePush();
    },

    reset() {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SYNC_STATE_KEY);
        return this.get();
    },

    // Forgets everything this browser cached, so the next person on a shared computer starts from
    // only what the server shares with them. Called at sign-in and sign-out.
    clearLocal() {
        clearTimeout(SyncEngine.pushTimer);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SYNC_STATE_KEY);
        localStorage.setItem(FRESH_SESSION_KEY, '1');
        SyncEngine.since = null;
        SyncEngine.snap = {};
        SyncEngine.pw = {};
        window.LmsData = this.get();
        return window.LmsData;
    },

    // Starts multi-user sync (called once the portal has loaded)
    startSync() {
        return SyncEngine.start();
    },

    // Push pending changes and fetch everyone else's right now
    syncNow() {
        clearTimeout(SyncEngine.pushTimer);
        return SyncEngine.enqueue(() => SyncEngine.cycle(false));
    },

    // While a Super Admin previews a role, changes stay in this browser and are never sent
    setReadOnly(on) {
        SyncEngine.readOnly = !!on;
    },

    isOnline() {
        return SyncEngine.online;
    }
};

window.LmsData = DataStore.get();
window.DataStore = DataStore;
window.SYNC_COLLECTIONS = SYNC_COLLECTIONS;
