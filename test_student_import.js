/**
 * Jamia Ashrafia LMS - Bulk student import tests
 *
 * Sets up two throw-away campuses with a class each, a Super Admin, an Admin of campus A only and a teacher, then
 * checks the Excel import through the real HTTP API with real sessions: the template, a good file, a bad file, empty
 * and broken files, a large file (2000 students), duplicates, permissions and campus limits, and that imported
 * students can sign in with the temporary passwords from the login details file. Everything created is removed
 * afterwards (ids, roll numbers and codes start with "imptest_").
 *
 *   npm run test:import
 */

const http = require('http');
const db = require('./database/db');
const auth = require('./server/auth');
const catalog = require('./server/permissions');
const xlsx = require('./server/xlsx');
const { COLUMNS } = require('./server/student-import');

const TEST_PORT = 3059;
process.env.PORT = TEST_PORT;

const P = `imptest_${Date.now().toString(36)}_`;
const R = P.toUpperCase();
const ADMIN_ROLE = `${R}ADMIN`;
const B = { A: `${P}bA`, B: `${P}bB` };
const ids = { super: `${P}super`, adminA: `${P}admina`, teacher: `${P}teacher`, clsA: `${P}clsA`, clsB: `${P}clsB`, existing: `${P}existing` };
const passwords = {};
const createdIds = new Set();

let passed = 0;
let failed = 0;
function check(name, ok, detail) {
    if (ok) { passed++; console.log(`[PASS] ${name}`); } else { failed++; console.log(`[FAIL] ${name}${detail ? `\n       ${String(detail).slice(0, 600)}` : ''}`); }
}

function request(method, path, { cookie, body, binary } = {}) {
    return new Promise((resolve, reject) => {
        const data = body === undefined ? null : JSON.stringify(body);
        const req = http.request({
            hostname: '127.0.0.1', port: TEST_PORT, path, method,
            headers: {
                ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
                ...(cookie ? { Cookie: cookie } : {})
            }
        }, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const buf = Buffer.concat(chunks);
                let parsed = buf;
                if (!binary || !String(res.headers['content-type'] || '').includes('spreadsheetml')) {
                    try { parsed = JSON.parse(buf.toString('utf8')); } catch (e) { parsed = buf.toString('utf8'); }
                }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function login(identifier, password) {
    const r = await request('POST', '/api/auth/login', { body: { identifier, password } });
    const set = [].concat(r.headers['set-cookie'] || []).find(c => c.startsWith(`${auth.COOKIE_NAME}=`));
    return { status: r.status, body: r.body, cookie: set ? set.split(';')[0] : null };
}

async function insertRecord(collection, rec) {
    await db.query(
        `INSERT INTO lms_records (collection, id, data, deleted, updated_by, updated_at) VALUES (?, ?, ?, 0, 'imptest', NOW(3))
         ON DUPLICATE KEY UPDATE data = VALUES(data), deleted = 0`,
        [collection, rec.id, JSON.stringify(rec)]
    );
}

async function stored(collection, id) {
    const [rows] = await db.query(`SELECT data, deleted FROM lms_records WHERE collection = ? AND id = ?`, [collection, id]);
    return rows.length ? { ...JSON.parse(rows[0].data), _deleted: !!rows[0].deleted } : null;
}

async function createUser(id, fields) {
    await insertRecord('users', { id, status: 'ACTIVE', name: `Imptest ${id.slice(-6)}`, email: `${id}@test.local`, ...fields });
    if (fields.role === 'SUPER_ADMIN') await db.query(`INSERT IGNORE INTO super_admins (user_id, granted_by) VALUES (?, 'imptest')`, [id]);
    passwords[id] = auth.temporaryPassword(12);
    await auth.setPassword(null, id, passwords[id], false);
}

async function setup() {
    await db.query(`INSERT INTO branches (id, code, name, address, city) VALUES (?, ?, 'Imptest campus A', 'Test address', 'Lahore')`, [B.A, `${R}A`]);
    await db.query(`INSERT INTO branches (id, code, name, address, city) VALUES (?, ?, 'Imptest campus B', 'Test address', 'Lahore')`, [B.B, `${R}B`]);
    await db.query(`INSERT INTO roles (id, name, scope, is_system, status, version, updated_by) VALUES (?, 'Imptest Admin', 'ALL', 0, 'ACTIVE', 1, 'imptest')`, [ADMIN_ROLE]);
    for (const perm of catalog.DEFAULT_PERMISSIONS.ACADEMIC_ADMIN) await db.query(`INSERT INTO role_permissions (role_id, permission) VALUES (?, ?)`, [ADMIN_ROLE, perm]);
    await insertRecord('classes', { id: ids.clsA, name: `Imptest Darja ${P}`, section: 'A', branchId: B.A, courseTeachers: [] });
    await insertRecord('classes', { id: ids.clsB, name: `Imptest Darja ${P}`, section: 'B', branchId: B.B, courseTeachers: [] });
    await createUser(ids.super, { role: 'SUPER_ADMIN' });
    await createUser(ids.adminA, { role: ADMIN_ROLE, branchId: B.A, allCampuses: false, campusIds: [B.A] });
    await createUser(ids.teacher, { role: 'TEACHER', branchId: B.A, allCampuses: false, campusIds: [B.A] });
    // A student already in the portal (for duplicate checks)
    await insertRecord('users', { id: ids.existing, role: 'STUDENT', name: 'Imptest Existing', rollNo: `${P}EX1`, email: `${P}ex1@test.local`,
        cnic: '35201-9999999-1', wifaqReg: `${P}WF-EX`, classId: ids.clsA, branchId: B.A, status: 'ACTIVE' });
    await require('./server/roles').load();
}

async function cleanup() {
    const like = `${P}%`;
    const imported = Array.from(createdIds);
    for (let i = 0; i < imported.length; i += 500) {
        const chunk = imported.slice(i, i + 500);
        const marks = chunk.map(() => '?').join(',');
        await db.query(`DELETE FROM lms_records WHERE collection = 'users' AND id IN (${marks})`, chunk);
        await db.query(`DELETE FROM user_credentials WHERE user_id IN (${marks})`, chunk);
        await db.query(`DELETE FROM user_roles WHERE user_id IN (${marks})`, chunk);
        await db.query(`DELETE FROM auth_sessions WHERE user_id IN (${marks})`, chunk);
        await db.query(`DELETE FROM audit_log WHERE entity_id IN (${marks})`, chunk);
    }
    await db.query(`DELETE FROM lms_records WHERE id LIKE ?`, [like]);
    await db.query(`DELETE FROM user_credentials WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM auth_sessions WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM super_admins WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM user_roles WHERE user_id LIKE ?`, [like]);
    await db.query(`DELETE FROM role_permissions WHERE role_id LIKE ?`, [`${R}%`]);
    await db.query(`DELETE FROM roles WHERE id LIKE ?`, [`${R}%`]);
    await db.query(`DELETE FROM branches WHERE id LIKE ?`, [like]);
    await db.query(`DELETE FROM audit_log WHERE entity_id LIKE ? OR actor_id LIKE ? OR summary LIKE ?`, [like, like, `%${P}%`]);
}

// A workbook laid out like the template: headings in row 1, one student per row
const HEAD = COLUMNS.map(c => `${c.label}${c.required === true ? ' *' : ''}`);
function workbook(rows, opts = {}) {
    const head = opts.head || HEAD;
    const data = rows.map(r => (Array.isArray(r) ? r : COLUMNS.map(c => (r[c.key] === undefined ? '' : r[c.key]))));
    return xlsx.write({ sheets: [{ name: opts.sheet || 'Students', rows: [head, ...data] }] }).toString('base64');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitForJob(cookie, jobId, limitMs = 300000) {
    const start = Date.now();
    for (;;) {
        const r = await request('GET', `/api/students/import/jobs/${jobId}`, { cookie });
        const job = r.body.job;
        if (!job || job.status !== 'running') return job || r.body;
        if (Date.now() - start > limitMs) return job;
        await sleep(500);
    }
}

async function importFile(cookie, file, preview, extra = {}) {
    const r = await request('POST', '/api/students/import/commit', { cookie, body: {
        file, fileName: 'test.xlsx', confirm: true, expectedCount: preview.summary.valid, fingerprint: preview.fingerprint, ...extra } });
    if (r.status !== 200) return { start: r };
    const job = await waitForJob(cookie, r.body.jobId);
    (job.students || []).forEach(s => createdIds.add(s.id));
    return { start: r, job };
}

const errorsOf = (preview, row) => ((preview.rows || []).find(r => r.row === row) || { errors: [] }).errors;
const hasError = (preview, row, column, pattern) => errorsOf(preview, row).some(e => e.column === column && pattern.test(e.message));

async function run() {
    if (!(await db.testConnection())) process.exit(1);
    require('./server');
    await sleep(1200);
    try {
        await setup();
        const sup = (await login(`${ids.super}@test.local`, passwords[ids.super])).cookie;
        const adminA = (await login(`${ids.adminA}@test.local`, passwords[ids.adminA])).cookie;
        const teacher = (await login(`${ids.teacher}@test.local`, passwords[ids.teacher])).cookie;
        const preview = async (cookie, file) => request('POST', '/api/students/import/preview', { cookie, body: { file, fileName: 'test.xlsx' } });

        // --- Permissions --------------------------------------------------------------------
        check('Signed-out request is refused', (await request('GET', '/api/students/import/template')).status === 401);
        check('Teacher cannot download the template', (await request('GET', '/api/students/import/template', { cookie: teacher })).status === 403);
        check('Teacher cannot preview an import', (await preview(teacher, workbook([{ name: 'X' }]))).status === 403);

        // --- Template -----------------------------------------------------------------------
        const tpl = await request('GET', '/api/students/import/template', { cookie: sup, binary: true });
        check('Template downloads as an Excel file', tpl.status === 200 && String(tpl.headers['content-type']).includes('spreadsheetml') && Buffer.isBuffer(tpl.body));
        const book = xlsx.read(tpl.body);
        const names = book.sheets.map(s => s.name);
        check('Template has Students, Instructions and Lists sheets', JSON.stringify(names) === JSON.stringify(['Students', 'Instructions', 'Lists']), names);
        check('Template headings are the registration fields, required ones marked *', JSON.stringify(book.sheets[0].rows[0]) === JSON.stringify(HEAD));
        const lists = book.sheets[2].rows;
        const listCol = name => lists.slice(1).map(r => r[lists[0].indexOf(name)]).filter(Boolean);
        check('Template class list names classes with their campus when names repeat', listCol('Class').includes(`Imptest Darja ${P} - A`) && listCol('Class').includes(`Imptest Darja ${P} - B`));
        check('Template lists campuses, genders and categories', listCol('Campus').includes(`Imptest campus A (${R}A)`) && listCol('Gender').join() === 'Male,Female' && listCol('Student Category').join() === 'Local,International');
        const rawTpl = xlsx.unzip(tpl.body);
        const sheetXml = rawTpl.get('xl/worksheets/sheet1.xml').toString();
        check('Template has drop-downs and help prompts', /type="list"/.test(sheetXml) && /promptTitle=/.test(sheetXml) && /<formula1>Lists!\$/.test(sheetXml));
        check('Template keeps CNIC / phone cells as text (no lost zeros)', /<col min="7" max="7"[^>]*style="3"/.test(sheetXml));
        const tplA = xlsx.read((await request('GET', '/api/students/import/template', { cookie: adminA, binary: true })).body).sheets[2].rows;
        const tplAClasses = tplA.slice(1).map(r => r[tplA[0].indexOf('Class')]).filter(Boolean);
        check('Campus-A Admin\'s template lists only campus A classes', tplAClasses.includes(`Imptest Darja ${P} - A`) && !tplAClasses.includes(`Imptest Darja ${P} - B`));

        // --- Good file ----------------------------------------------------------------------
        const good = workbook([
            { category: 'Local', name: 'Imptest Ahmad Raza', urduName: 'احمد رضا', fatherName: 'Imptest Father One', gender: 'Male', cnic: '3520112345671', cls: `Imptest Darja ${P} - A`, phone: '3001234567' },
            { category: 'International', name: 'Imptest Yusuf Ali', fatherName: 'Imptest Father Two', gender: 'male', passport: 'ab1234567', country: 'united kingdom', campus: `${R}B` },
            { category: 'local', name: 'Imptest Fatima Bibi', fatherName: 'Imptest Father Three', gender: 'Female', cnic: '35202-7654321-2', cls: `Imptest Darja ${P} - B`,
                rollNo: `${P}R003`, wifaqReg: `${P}WF003`, email: `${P}fatima@Example.com`, enrollmentDate: '15/04/2025', phone: '+92 321 7654321' }
        ]);
        const gp = (await preview(sup, good)).body;
        check('Good file: every row is ready', gp.success && gp.summary.total === 3 && gp.summary.valid === 3 && gp.summary.invalid === 0, JSON.stringify(gp).slice(0, 600));
        const g1 = gp.rows.find(r => r.row === 2);
        const g2 = gp.rows.find(r => r.row === 3);
        const g3 = gp.rows.find(r => r.row === 4);
        check('Blank roll number gets the next ASH-<year>-NNN, blank email the scholar.<roll> address', g1 && g1.rollAuto && /^ASH-\d{4}-\d{3,}$/.test(g1.rollNo) && g1.emailAuto && g1.email === `scholar.${g1.rollNo.toLowerCase().replace(/[^a-z0-9]/g, '')}@jamiaashrafia.org`, JSON.stringify(g1));
        check('Auto roll numbers follow each other', g2 && Number(g2.rollNo.split('-').pop()) === Number(g1.rollNo.split('-').pop()) + 1, `${g1.rollNo} ${g2 && g2.rollNo}`);
        check('Class decides the campus; campus without class is used', g1.campus === `Imptest campus A (${R}A)` && g2.campus === `Imptest campus B (${R}B)` && g3.campus === `Imptest campus B (${R}B)`);
        check('A phone number that lost its leading 0 is fixed with a warning', g1.warnings.some(w => w.column === 'Phone / WhatsApp'));
        check('Preview saves nothing', !(await db.query(`SELECT id FROM lms_records WHERE collection = 'users' AND data LIKE ?`, [`%Imptest Ahmad Raza%`]))[0].length);

        const noConfirm = await request('POST', '/api/students/import/commit', { cookie: sup, body: { file: good, expectedCount: 3, fingerprint: gp.fingerprint } });
        check('Import needs confirmation', noConfirm.status === 400);
        const stale = await request('POST', '/api/students/import/commit', { cookie: sup, body: { file: good, confirm: true, expectedCount: 3, fingerprint: 'x' } });
        check('Import refuses when the result would differ from the preview', stale.status === 409);

        const gi = await importFile(sup, good, gp);
        check('Good file imports all rows', gi.job && gi.job.status === 'done' && gi.job.imported === 3, JSON.stringify(gi.job || gi.start.body));
        const byRow = new Map((gi.job.students || []).map(s => [s.row, s]));
        const s1 = await stored('users', byRow.get(2).id);
        const s2 = await stored('users', byRow.get(3).id);
        const s3 = await stored('users', byRow.get(4).id);
        check('Imported record matches Direct Enrollment fields', s1 && s1.role === 'STUDENT' && s1.status === 'ACTIVE' && s1.studentType === 'LOCAL' && s1.country === 'Pakistan'
            && s1.cnic === '35201-1234567-1' && s1.guardianName === 'Imptest Father One' && s1.urduName === 'احمد رضا' && s1.avatar === 'IA'
            && s1.enrollmentDate === new Date().toISOString().slice(0, 10) && s1.phone === '03001234567' && !('password' in s1), JSON.stringify(s1));
        check('Class and campus links are set', s1.classId === ids.clsA && s1.branchId === B.A && s3.classId === ids.clsB && s3.branchId === B.B && s2.classId === null && s2.branchId === B.B);
        check('International student keeps passport and country', s2.studentType === 'INTERNATIONAL' && s2.passport === 'AB1234567' && s2.country === 'United Kingdom' && s2.cnic === '');
        check('Given roll number, Wifaq number, email and date are kept', s3.rollNo === `${P}R003` && s3.wifaqReg === `${P}WF003` && s3.email === `${P}fatima@example.com` && s3.enrollmentDate === '2025-04-15');
        const [[cred]] = await db.query(`SELECT must_change FROM user_credentials WHERE user_id = ?`, [s1.id]);
        check('Temporary password must be changed at first sign-in', cred && Number(cred.must_change) === 1);
        const [ur] = await db.query(`SELECT role_id FROM user_roles WHERE user_id = ? AND is_primary = 1`, [s1.id]);
        check('Student is placed in the default student type', ur.length === 1 && ur[0].role_id === 'STUDENT', JSON.stringify(ur));
        const [aud] = await db.query(`SELECT action FROM audit_log WHERE (entity_id = ? AND action = 'user.create') OR (action = 'students.import' AND actor_id = ?)`, [s1.id, ids.super]);
        check('Account creation and the import are audited', aud.some(a => a.action === 'user.create') && aud.some(a => a.action === 'students.import'));

        const credFile = await request('GET', `/api/students/import/jobs/${gi.start.body.jobId}/credentials`, { cookie: sup, binary: true });
        check('Login details download as Excel', credFile.status === 200 && Buffer.isBuffer(credFile.body));
        const credRows = xlsx.read(credFile.body).sheets[0].rows;
        const c1 = credRows.find(r => r[2] === s1.rollNo);
        check('Login details list roll number, email and temporary password', c1 && c1[3] === s1.email && String(c1[4]).length >= 8);
        const li = await login(s1.email, c1[4]);
        check('Imported student can sign in with the temporary password', li.status === 200 && li.body.mustChangePassword === true, JSON.stringify(li.body));
        const liRoll = await login(s1.rollNo, c1[4]);
        check('...also with the roll number', liRoll.status === 200);
        check('Someone else cannot fetch the login details', (await request('GET', `/api/students/import/jobs/${gi.start.body.jobId}/credentials`, { cookie: adminA })).status === 404);

        // --- Same file again: duplicates are reported, nothing is overwritten ----------------
        const again = (await preview(sup, good)).body;
        check('Re-importing the same file finds every row already registered', again.summary.valid === 0 && again.summary.invalid === 3, JSON.stringify(again.summary));
        check('Duplicate CNIC is reported on its row and column', hasError(again, 2, 'CNIC / B-Form No', /Already registered to Imptest Ahmad Raza/));
        check('Duplicate passport is reported', hasError(again, 3, 'Passport No', /Already registered/));
        check('Duplicate roll number, Wifaq number and email are reported', hasError(again, 4, 'Roll No / Student ID', /Already used/) && hasError(again, 4, 'Wifaq Registration No', /Already registered/) && hasError(again, 4, 'Login Email', /Already used/));
        check('Existing records are untouched', (await stored('users', s1.id)).name === 'Imptest Ahmad Raza');

        // --- Bad file -----------------------------------------------------------------------
        const bad = workbook([
            { category: 'Local', name: '', fatherName: 'F', gender: 'Male', cnic: '35201-1111111-1' },                                // 2 no name
            { category: 'Pakistani', name: 'Imptest Bad Gender', fatherName: 'F', gender: 'M/F', cnic: '35201-1111111-2' },           // 3 gender
            { category: 'Local', name: 'Imptest Short Cnic', fatherName: 'F', gender: 'Male', cnic: '35201-12345' },                 // 4 cnic
            { category: 'International', name: 'Imptest No Passport', fatherName: 'F', gender: 'Male' },                            // 5 passport + country
            { category: 'Local', name: 'Imptest Unknown Class', fatherName: 'F', gender: 'Male', cnic: '35201-1111111-5', cls: 'Darja 99' }, // 6 class
            { category: 'Local', name: 'Imptest Campus Clash', fatherName: 'F', gender: 'Male', cnic: '35201-1111111-6', cls: `Imptest Darja ${P} - A`, campus: `${R}B` }, // 7
            { category: 'Local', name: 'Imptest Dup Roll One', fatherName: 'F', gender: 'Male', cnic: '35201-1111111-7', rollNo: `${P}DUP` }, // 8 ok
            { category: 'Local', name: 'Imptest Dup Roll Two', fatherName: 'F', gender: 'Male', cnic: '35201-1111111-8', rollNo: `${P}dup` }, // 9 dup in file
            { category: 'Local', name: 'Imptest Bad Email', fatherName: 'F', gender: 'Male', cnic: '35201-1111111-9', email: 'not-an-email' }, // 10
            { category: 'Local', name: 'Imptest Future', fatherName: 'F', gender: 'Male', cnic: '35201-1111112-0', enrollmentDate: '2999-01-01' }, // 11
            { category: 'Local', name: 'Imptest Bad Phone', fatherName: 'F', gender: 'Male', cnic: '35201-1111112-1', phone: 'call me' },   // 12
            { category: 'Local', name: 'Imptest Bad Type', fatherName: 'F', gender: 'Male', cnic: '35201-1111112-2', group: 'Nonexistent Type' }, // 13
            { category: 'Alien', name: 'Imptest Bad Category', fatherName: '', gender: 'Female' },                                   // 14 category + father
            { category: 'Local', name: 'Imptest Same Cnic', fatherName: 'F', gender: 'Male', cnic: '35201-1111111-7' },               // 15 cnic dup in file (row 8)
            { category: 'Local', name: 'Imptest Existing Cnic', fatherName: 'F', gender: 'Male', cnic: '35201-9999999-1' },           // 16 existing student
            [],                                                                                                                        // 17 blank row skipped
            { category: 'Local', name: 'Imptest Fine', fatherName: 'F', gender: 'Female', cnic: '35201-1111112-3', enrollmentDate: '2024-02-30' } // 18 bad date
        ]);
        const bp = (await preview(sup, bad)).body;
        check('Bad file: blank rows are skipped', bp.summary.total === 16, bp.summary.total);
        check('Missing name: row 2, column Full Name', hasError(bp, 2, 'Full Name (English)', /Required/));
        check('Wrong gender: row 3', hasError(bp, 3, 'Gender', /Male or Female/));
        check('Short CNIC: row 4', hasError(bp, 4, 'CNIC / B-Form No', /13 digits/));
        check('International without passport and country: row 5', hasError(bp, 5, 'Passport No', /Required/) && hasError(bp, 5, 'Country', /Required/));
        check('Unknown class: row 6', hasError(bp, 6, 'Class', /No such class/));
        check('Campus that does not match the class: row 7', hasError(bp, 7, 'Campus', /is at Imptest campus A/));
        check('Same roll number twice in the file (any case): row 9 names row 8', hasError(bp, 9, 'Roll No / Student ID', /Same roll number as row 8/) && !errorsOf(bp, 8).length);
        check('Bad email: row 10', hasError(bp, 10, 'Login Email', /Not a valid email/));
        check('Future date: row 11', hasError(bp, 11, 'Enrollment Date', /future/));
        check('Bad phone: row 12', hasError(bp, 12, 'Phone / WhatsApp', /7 to 15 digits/));
        check('Unknown student type: row 13', hasError(bp, 13, 'Student Type', /No such student type/));
        check('Bad category and missing father name: row 14', hasError(bp, 14, 'Student Category', /Local or International/) && hasError(bp, 14, 'Father Name (English)', /Required/));
        check('Same CNIC twice in the file: row 15', hasError(bp, 15, 'CNIC / B-Form No', /Same CNIC/));
        check('CNIC of an existing student: row 16', hasError(bp, 16, 'CNIC / B-Form No', /Imptest Existing/));
        check('Impossible date: row 18', hasError(bp, 18, 'Enrollment Date', /not a real date/));
        check('Only the clean row is ready', bp.summary.valid === 1 && bp.rows.find(r => r.ok).row === 8, JSON.stringify(bp.summary));
        check('An error report is offered', typeof bp.errorReport === 'string' && bp.errorReport.length > 100);
        const report = xlsx.read(Buffer.from(bp.errorReport, 'base64'));
        const reportRows = report.sheets[0].rows;
        check('Error report lists row, column, value and the fix', JSON.stringify(reportRows[0]) === JSON.stringify(['Excel Row', 'Column', 'Value entered', 'Problem and how to fix it'])
            && reportRows.some(r => r[0] === '4' && r[1] === 'CNIC / B-Form No' && r[2] === '35201-12345' && /13 digits/.test(r[3])));
        check('Error report has the rows to fix, ready to correct and upload again', report.sheets[1].name === 'Students' && report.sheets[1].rows.length === 16 && report.sheets[1].rows[0][0] === HEAD[0]);
        const refuse = await request('POST', '/api/students/import/commit', { cookie: sup, body: { file: bad, confirm: true, expectedCount: 1, fingerprint: bp.fingerprint } });
        check('Rows with errors block the import unless "only valid rows" is chosen', refuse.status === 400 && /row\(s\) have errors/.test(refuse.body.error));
        const partial = await importFile(sup, bad, bp, { skipInvalid: true });
        check('"Only valid rows" imports just the clean row', partial.job && partial.job.imported === 1 && partial.job.skipped === 15 && partial.job.students[0].rollNo === `${P}DUP`, JSON.stringify(partial.job || partial.start.body));

        // --- Campus-limited Admin -------------------------------------------------------------
        const campusFile = workbook([
            { category: 'Local', name: 'Imptest Campus A Kid', fatherName: 'F', gender: 'Male', cnic: '35201-2222222-1', cls: `Imptest Darja ${P} - A` },
            { category: 'Local', name: 'Imptest Campus B Kid', fatherName: 'F', gender: 'Male', cnic: '35201-2222222-2', cls: `Imptest Darja ${P} - B` },
            { category: 'Local', name: 'Imptest Campus B Direct', fatherName: 'F', gender: 'Male', cnic: '35201-2222222-3', campus: `Imptest campus B (${R}B)` },
            { category: 'Local', name: 'Imptest No Campus', fatherName: 'F', gender: 'Male', cnic: '35201-2222222-4' },
            { category: 'Local', name: 'Imptest Typed', fatherName: 'F', gender: 'Male', cnic: '35201-2222222-5', group: 'STUDENT' }
        ]);
        const cp = (await preview(adminA, campusFile)).body;
        check('Campus-A Admin may import into campus A', cp.rows.find(r => r.row === 2).ok, JSON.stringify(cp.rows.find(r => r.row === 2)));
        check('Campus-A Admin cannot import into a campus-B class', hasError(cp, 3, 'Class', /campus you do not have access/));
        check('Campus-A Admin cannot choose campus B', hasError(cp, 4, 'Campus', /do not have access/));
        check('A student without class or campus goes to the Admin\'s own campus', cp.rows.find(r => r.row === 5).campus === `Imptest campus A (${R}A)`);
        check('Choosing the default type is allowed without the type permission', cp.rows.find(r => r.row === 6).ok);

        // --- Empty and broken files -----------------------------------------------------------
        const onlyHead = (await preview(sup, workbook([]))).body;
        check('Headings but no students: clear message', onlyHead.fileErrors.length === 1 && /no students/.test(onlyHead.fileErrors[0]));
        const blank = (await preview(sup, xlsx.write({ sheets: [{ name: 'Sheet1', rows: [] }] }).toString('base64'))).body;
        check('Completely empty workbook: asks for the headings', blank.fileErrors.some(m => /Row 1/.test(m)));
        const missing = (await preview(sup, workbook([['Ali']], { head: ['Full Name (English) *'] }))).body;
        check('Missing required columns are named', missing.fileErrors.some(m => /"Gender" is missing/.test(m)) && missing.fileErrors.some(m => /"Student Category" is missing/.test(m)));
        const extra = (await preview(sup, workbook([{ category: 'Local', name: 'Imptest Extra', fatherName: 'F', gender: 'Male', cnic: '35201-3333333-1' }].map(r => COLUMNS.map(c => r[c.key] || '').concat(['x'])), { head: HEAD.concat(['Remarks']) }))).body;
        check('Unknown extra column is ignored with a note', extra.summary.valid === 1 && extra.fileWarnings.some(m => /Remarks/.test(m)));
        const reordered = (await preview(sup, workbook([['Male', 'Imptest Reordered', 'Local', 'F', '35201-3333333-2']], { head: ['Gender', 'Name', 'Category', 'Father Name', 'CNIC'] }))).body;
        check('Columns in another order or with common names are recognised', reordered.summary.valid === 1, JSON.stringify(reordered).slice(0, 400));
        const csv = await preview(sup, Buffer.from('name,gender\nAli,Male\n').toString('base64'));
        check('A CSV file is refused with how to convert it', csv.status === 400 && /Save As/.test(csv.body.error));
        const truncated = await preview(sup, Buffer.from(good, 'base64').slice(0, 300).toString('base64'));
        check('A damaged .xlsx is refused', truncated.status === 400 && /not a valid Excel/.test(truncated.body.error), JSON.stringify(truncated.body));
        check('No file is refused', (await preview(sup, '')).status === 400);
        // Just over the 5 MB limit (still under the 8 MB request cap, so the importer itself answers)
        const big = Buffer.alloc(5.5 * 1024 * 1024);
        big.writeUInt32LE(0x04034b50, 0);
        check('A file over 5 MB is refused', (await preview(sup, big.toString('base64'))).status === 400);
        const otherSheet = (await preview(sup, xlsx.write({ sheets: [{ name: 'Data', rows: [HEAD, COLUMNS.map(c => ({ category: 'Local', name: 'Imptest Sheet', fatherName: 'F', gender: 'Male', cnic: '35201-3333333-3' }[c.key] || ''))] }] }).toString('base64'))).body;
        check('A workbook whose sheet has another name is read from its first sheet', otherSheet.summary.valid === 1);

        // --- Large files ------------------------------------------------------------------------
        const tooMany = (await preview(sup, workbook(Array.from({ length: 3001 }, (_, i) => ({ category: 'Local', name: `Imptest Many ${i}`, fatherName: 'F', gender: 'Male', cnic: `3520${String(i).padStart(9, '0')}` }))))).body;
        check('More than 3000 students: asks to split the file', tooMany.fileErrors.some(m => /at most 3000/.test(m)));
        const N = 2000;
        const largeRows = Array.from({ length: N }, (_, i) => ({
            category: i % 10 === 0 ? 'International' : 'Local', name: `Imptest Large ${i}`, fatherName: `Imptest Father ${i}`, gender: i % 2 ? 'Female' : 'Male',
            cnic: i % 10 === 0 ? '' : `36${String(i).padStart(11, '0')}`, passport: i % 10 === 0 ? `IMP${i}X` : '', country: i % 10 === 0 ? 'Saudi Arabia' : '',
            cls: i % 2 ? `Imptest Darja ${P} - A` : `Imptest Darja ${P} - B`, rollNo: `${P}L${String(i).padStart(4, '0')}`
        }));
        const largeFile = workbook(largeRows);
        let t = Date.now();
        const lp = (await preview(sup, largeFile)).body;
        const previewMs = Date.now() - t;
        check(`Large file (${N} students, ${Math.round(Buffer.from(largeFile, 'base64').length / 1024)} KB) previews in ${previewMs} ms`, lp.summary && lp.summary.valid === N && previewMs < 30000, JSON.stringify(lp.summary || lp));
        t = Date.now();
        // The server stays responsive while it imports
        const startLarge = await request('POST', '/api/students/import/commit', { cookie: sup, body: { file: largeFile, fileName: 'large.xlsx', confirm: true, expectedCount: N, fingerprint: lp.fingerprint } });
        const pingStart = Date.now();
        const ping = await request('GET', '/api/auth/me', { cookie: sup });
        check('Server answers other requests during a large import', ping.status === 200 && Date.now() - pingStart < 3000, `${Date.now() - pingStart} ms`);
        const second = await request('POST', '/api/students/import/commit', { cookie: sup, body: { file: good, confirm: true, expectedCount: 1, fingerprint: 'x' } });
        check('A second import waits until the first has finished', second.status === 409 && /Another student import/.test(second.body.error));
        const lj = await waitForJob(sup, startLarge.body.jobId);
        (lj.students || []).forEach(s => createdIds.add(s.id));
        const importMs = Date.now() - t;
        check(`Large file imports all ${N} students in ${Math.round(importMs / 1000)} s`, lj.status === 'done' && lj.imported === N, JSON.stringify(lj).slice(0, 300));
        const [[cnt]] = await db.query(`SELECT COUNT(*) AS n FROM lms_records WHERE collection = 'users' AND deleted = 0 AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.rollNo')) LIKE ?`, [`${P}L%`]);
        check('Every large-file student is stored once', Number(cnt.n) === N, cnt.n);
        const [[credCnt]] = await db.query(`SELECT COUNT(*) AS n FROM user_credentials c JOIN lms_records r ON r.collection = 'users' AND r.id = c.user_id WHERE JSON_UNQUOTE(JSON_EXTRACT(r.data, '$.rollNo')) LIKE ?`, [`${P}L%`]);
        check('Every large-file student has a password', Number(credCnt.n) === N);
        const lcred = xlsx.read((await request('GET', `/api/students/import/jobs/${startLarge.body.jobId}/credentials`, { cookie: sup, binary: true })).body).sheets[0].rows;
        const sample = lcred[N];
        check('Large-file login details work', lcred.length === N + 1 && (await login(sample[2], sample[4])).status === 200);

        // --- Failure in the middle: nothing is saved -------------------------------------------
        const failFile = workbook([
            { category: 'Local', name: 'Imptest Rollback One', fatherName: 'F', gender: 'Male', cnic: '35201-4444444-1', rollNo: `${P}RB1` },
            { category: 'Local', name: 'Imptest Rollback Two', fatherName: 'F', gender: 'Male', cnic: '35201-4444444-2', rollNo: `${P}RB2` }
        ]);
        const fp = (await preview(sup, failFile)).body;
        // Someone registers RB2 between the preview and the import: the server checks again and saves nothing
        await insertRecord('users', { id: `${P}racer`, role: 'STUDENT', name: 'Imptest Racer', rollNo: `${P}RB2`, status: 'ACTIVE' });
        const raced = await request('POST', '/api/students/import/commit', { cookie: sup, body: { file: failFile, confirm: true, expectedCount: 2, fingerprint: fp.fingerprint } });
        check('A change after the preview stops the import', raced.status === 400 && /row\(s\) have errors/.test(raced.body.error), JSON.stringify(raced.body));
        const [rb] = await db.query(`SELECT id FROM lms_records WHERE collection = 'users' AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.rollNo')) = ?`, [`${P}RB1`]);
        check('...and nothing from that file is saved', rb.length === 0);
    } catch (err) {
        failed++;
        console.error('[FAIL] Test run stopped:', err);
    } finally {
        await cleanup();
    }
    console.log(`\n${passed} passed, ${failed} failed. Test data removed.`);
    process.exit(failed ? 1 : 0);
}

run();
