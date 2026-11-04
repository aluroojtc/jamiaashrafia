/**
 * JAMIA ASHRAFIA LAHORE - BULK STUDENT IMPORT (Student Management -> Import Students)
 *
 *   GET  /api/students/import/template            Excel template: the registration fields, drop-downs for category,
 *                                                   gender, class, campus, country and student type, and instructions
 *   POST /api/students/import/preview  { file }    Reads and checks every row; nothing is saved. Errors name the Excel
 *                                                   row, the column and what to fix; an error report comes with them
 *   POST /api/students/import/commit   { file, confirm, expectedCount, fingerprint, skipInvalid }
 *                                                   Checks the file again and imports the valid rows in the background
 *   GET  /api/students/import/jobs/:id             Progress / result of an import
 *   GET  /api/students/import/jobs/:id/credentials Login details of the imported students (Excel, kept 30 minutes)
 *
 * Rows become accounts exactly as Direct Student Enrollment makes them: the same record fields, and every row goes
 * through writeRecord in server/lms-api.js (access policy, campus of the class, login identifiers, student type,
 * temporary password that must be changed at first sign-in, audit entry). Roll numbers and login emails left blank
 * are given the way the enrollment forms suggest them. Existing students are never changed: a row whose roll
 * number, Wifaq registration number, email, CNIC / B-Form or passport is already registered is an error. All rows
 * of an import are saved in one transaction, so an import is either complete or not saved at all.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../database/db');
const auth = require('./auth');
const roles = require('./roles');
const policy = require('./access-policy');
const campus = require('./campus');
const audit = require('./audit');
const xlsx = require('./xlsx');

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 3000;
const JOB_TTL_MS = 30 * 60 * 1000;
const EMAIL_DOMAIN = 'jamiaashrafia.org';
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// The countries offered on the admission forms (js/data.js)
const COUNTRIES = (() => {
    try {
        const src = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'data.js'), 'utf8');
        const m = /const WORLD_COUNTRIES = (\[[\s\S]*?\]);/.exec(src);
        return m ? JSON.parse(m[1]) : ['Pakistan'];
    } catch (e) {
        return ['Pakistan'];
    }
})();

// Template columns, in order. required: true = always, 'local' / 'international' = for that category only.
// list: the drop-down it gets in the template. aliases: other headings accepted for the column.
const COLUMNS = [
    { key: 'category', label: 'Student Category', required: true, width: 18, list: 'category', aliases: ['category', 'student category', 'local international'],
        help: 'Local (Pakistani, with CNIC / B-Form) or International (with passport).', example: 'Local' },
    { key: 'name', label: 'Full Name (English)', required: true, width: 26, aliases: ['name', 'student name', 'full name', 'name english'],
        help: 'Student\'s full name in English letters.', example: 'Muhammad Usman Ghani' },
    { key: 'urduName', label: 'Full Name (Urdu)', width: 24, aliases: ['urdu name', 'name urdu'],
        help: 'Optional. Name in Urdu script.', example: 'محمد عثمان غنی' },
    { key: 'fatherName', label: 'Father Name (English)', required: true, width: 26, aliases: ['father name', 'father', 'guardian name', 'father name english'],
        help: 'Father\'s full name in English letters.', example: 'Abdul Shakoor' },
    { key: 'fatherUrduName', label: 'Father Name (Urdu)', width: 24, aliases: ['father urdu name', 'father name urdu'],
        help: 'Optional. Father\'s name in Urdu script.', example: 'عبدالشکور' },
    { key: 'gender', label: 'Gender', required: true, width: 11, list: 'gender', aliases: ['sex'],
        help: 'Male or Female.', example: 'Male' },
    { key: 'cnic', label: 'CNIC / B-Form No', required: 'local', width: 18, text: true, aliases: ['cnic', 'b form', 'bform', 'cnic no', 'cnic number', 'b form no', 'cnic b form'],
        help: 'Required for Local students: 13 digits, with or without dashes (35201-1234567-1).', example: '35201-1234567-1' },
    { key: 'passport', label: 'Passport No', required: 'international', width: 16, text: true, aliases: ['passport', 'passport number'],
        help: 'Required for International students: 3 to 30 letters and digits.', example: 'A1234567' },
    { key: 'country', label: 'Country', required: 'international', width: 16, list: 'country', aliases: ['country of residence', 'nationality'],
        help: 'Required for International students. Local students are always Pakistan.', example: 'Pakistan' },
    { key: 'cls', label: 'Class', width: 30, list: 'class', aliases: ['class name', 'class section', 'class and section'],
        help: 'Optional. Choose from the drop-down. The student\'s campus and programme follow the class. Leave blank to assign a class later.', example: '(choose from the list)' },
    { key: 'campus', label: 'Campus', width: 24, list: 'campus', aliases: ['branch', 'campus branch', 'location'],
        help: 'Optional. Only needed when no class is given; with a class, the class\'s campus is used. Blank: the main campus.', example: '(choose from the list)' },
    { key: 'rollNo', label: 'Roll No / Student ID', width: 20, text: true, aliases: ['roll no', 'roll number', 'student id', 'id', 'roll no student id', 'allotted roll number'],
        help: 'Optional. Leave blank and the next roll number is given automatically (e.g. ASH-2026-051). Must not belong to anyone already.', example: 'ASH-2026-051' },
    { key: 'wifaqReg', label: 'Wifaq Registration No', width: 20, text: true, aliases: ['registration no', 'registration number', 'wifaq registration', 'wifaq reg', 'reg no', 'wifaq registration number'],
        help: 'Optional. Must not belong to another student.', example: 'WF-2025-001234' },
    { key: 'phone', label: 'Phone / WhatsApp', width: 18, text: true, aliases: ['phone', 'mobile', 'whatsapp', 'contact', 'contact phone', 'phone number'],
        help: 'Optional. 7 to 15 digits; + and spaces are fine.', example: '+92 300 1234567' },
    { key: 'email', label: 'Login Email', width: 28, text: true, aliases: ['email', 'e mail', 'student email', 'student login email'],
        help: `Optional. Leave blank to use scholar.<roll number>@${EMAIL_DOMAIN}. Students can also sign in with their roll number.`, example: 'usman.ghani@example.com' },
    { key: 'group', label: 'Student Type', width: 22, list: 'group', aliases: ['type', 'permission group', 'access group'],
        help: 'Optional. Decides what the student may do in the portal. Blank: the default type.', example: '(choose from the list)' },
    { key: 'enrollmentDate', label: 'Enrollment Date', width: 16, text: true, aliases: ['enrolment date', 'admission date', 'date of admission', 'enrollment', 'joining date'],
        help: 'Optional. Format YYYY-MM-DD (or DD/MM/YYYY). Blank: today.', example: '2026-04-15' }
];

const normHeader = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const norm = s => String(s === undefined || s === null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
const clean = s => String(s === undefined || s === null ? '' : s).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
const HEADER_LOOKUP = new Map();
for (const c of COLUMNS) {
    [c.label, c.key, ...(c.aliases || [])].forEach(h => HEADER_LOOKUP.set(normHeader(h), c.key));
}
const COLUMN = Object.fromEntries(COLUMNS.map(c => [c.key, c]));

function today() {
    return new Date().toISOString().slice(0, 10);
}

function fail(status, error, extra) {
    return Object.assign(new Error(error), { status, extra });
}

// ---------------------------------------------------------------------------
// Reference data (what the person importing may choose from)
// ---------------------------------------------------------------------------

async function loadReference(ctx, deps) {
    const [branchRows] = await db.query(`SELECT id, code, name FROM branches ORDER BY established_year ASC, code ASC`).catch(() => [[]]);
    const [programRows] = await db.query(`SELECT id, name FROM academic_programs`).catch(() => [[]]);
    const programs = new Map(programRows.map(p => [p.id, p.name]));
    const reachable = id => !ctx.campuses || ctx.campuses.has(id);

    const branches = branchRows.map(b => ({ id: b.id, code: b.code, name: b.name, label: `${b.name} (${b.code})` }));
    const branchById = new Map(branches.map(b => [b.id, b]));
    const myBranches = branches.filter(b => reachable(b.id));

    const allClasses = await deps.loadCollection('classes');
    const classes = allClasses.filter(c => c && c.id && c.name).map(c => ({
        id: c.id, name: c.name, section: c.section || '', branchId: c.branchId || ctx.defaultCampus || null, programId: c.programId || null
    }));
    // A label that names one class: "Name - Section", with the campus when two campuses use the same name
    const base = c => `${c.name}${c.section ? ` - ${c.section}` : ''}`;
    const count = new Map();
    classes.forEach(c => count.set(norm(base(c)), (count.get(norm(base(c))) || 0) + 1));
    classes.forEach(c => {
        const b = branchById.get(c.branchId);
        c.label = count.get(norm(base(c))) > 1 && b ? `${base(c)} (${b.code})` : base(c);
    });
    const seen = new Map();
    classes.forEach(c => seen.set(norm(c.label), (seen.get(norm(c.label)) || 0) + 1));
    classes.forEach(c => { if (seen.get(norm(c.label)) > 1) c.label = `${c.label} [${c.id}]`; });
    classes.sort((a, b) => a.label.localeCompare(b.label));
    const myClasses = classes.filter(c => reachable(c.branchId));

    const groupInfo = await roles.listGroups('STUDENT', false);
    const groups = groupInfo.groups.filter(g => !g.status || g.status === 'ACTIVE').map(g => ({ id: g.id, name: g.name || g.id, isDefault: g.id === groupInfo.defaultGroup }));
    const canChooseGroup = ctx.isSuperAdmin || ctx.wide('students.assign_group');

    // Where a student without a class goes: the main campus (if the importer works there), else their home campus
    let defaultBranch = ctx.defaultCampus || null;
    if (ctx.campuses && !(defaultBranch && ctx.campuses.has(defaultBranch))) {
        const home = ctx.user.branchId;
        defaultBranch = home && ctx.campuses.has(home) ? home : (myBranches[0] || {}).id || null;
    }

    return { branches, branchById, myBranches, classes, myClasses, programs, groups, defaultGroup: groupInfo.defaultGroup, canChooseGroup, defaultBranch };
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

function requiredText(c) {
    if (c.required === true) return 'Required';
    if (c.required === 'local') return 'Required for Local';
    if (c.required === 'international') return 'Required for International';
    return 'Optional';
}

function buildTemplate(ref) {
    const lists = {
        category: ['Local', 'International'],
        gender: ['Male', 'Female'],
        country: COUNTRIES,
        class: ref.myClasses.map(c => c.label),
        campus: ref.myBranches.map(b => b.label),
        group: ref.canChooseGroup ? ref.groups.map(g => g.name) : ref.groups.filter(g => g.isDefault).map(g => g.name)
    };
    const listKeys = Object.keys(lists);
    const listRows = [listKeys.map(k => ({ category: 'Student Category', gender: 'Gender', country: 'Country', class: 'Class', campus: 'Campus', group: 'Student Type' }[k]))];
    const longest = Math.max(...listKeys.map(k => lists[k].length));
    for (let i = 0; i < longest; i++) listRows.push(listKeys.map(k => lists[k][i] || ''));

    const last = MAX_ROWS + 1;
    const validations = COLUMNS.map((c, i) => {
        const col = xlsx.colName(i);
        const v = { range: `${col}2:${col}${last}`, title: `${c.label}${c.required === true ? ' *' : ''}`.slice(0, 32), prompt: `${requiredText(c)}. ${c.help}` };
        if (c.list && lists[c.list].length) {
            const li = listKeys.indexOf(c.list);
            const lc = xlsx.colName(li);
            v.list = `Lists!$${lc}$2:$${lc}$${lists[c.list].length + 1}`;
            v.error = `Choose a ${c.label.toLowerCase()} from the drop-down list.`;
            if (c.list === 'country') v.warnOnly = true;
        }
        return v;
    });

    const students = {
        name: 'Students',
        rows: [COLUMNS.map(c => `${c.label}${c.required === true ? ' *' : ''}`)],
        header: COLUMNS.map(c => (c.required === true ? xlsx.STYLE.headRequired : xlsx.STYLE.headOptional)),
        headerHeight: 32,
        columns: COLUMNS.map(c => ({ width: c.width, text: true })),
        validations,
        freezeHeader: true
    };

    const inst = [
        ['Jamia Ashrafia LMS - Bulk Student Import'],
        [''],
        ['How to use this file'],
        ['1. Fill in one student per row on the "Students" sheet, starting at row 2. Do not change or remove the headings in row 1.'],
        ['2. Columns with an orange heading and * are required for every student. Green headings are optional or required only for one category (see below).'],
        ['3. Click a cell to see what to enter. Category, Gender, Country, Class, Campus and Student Type have drop-down lists: choose from them.'],
        [`4. Up to ${MAX_ROWS} students per file. Save as Excel Workbook (.xlsx) and upload it on the Student Management page (Import Students).`],
        ['5. The portal checks every row and shows a preview first. Nothing is saved until you confirm. Rows with problems are listed with the row number, the column and what to fix.'],
        ['6. Existing students are never changed. A row whose roll number, Wifaq registration number, email, CNIC / B-Form or passport is already registered is reported as a duplicate.'],
        ['7. Every imported student gets a temporary password. After the import, download the login details file and share it safely; each student must choose a new password at first sign-in.'],
        [`8. Drop-down lists were made for your account on ${today()}. If classes or campuses change, download a new template.`],
        [''],
        ['Column', 'Required?', 'What to enter', 'Example']
    ];
    COLUMNS.forEach(c => inst.push([c.label, requiredText(c), c.help, c.example]));
    const instRowStyles = inst.map((r, i) => (i === 0 ? xlsx.STYLE.title : i === 2 || i === 12 ? xlsx.STYLE.bold : xlsx.STYLE.wrap));
    instRowStyles[1] = 0;
    instRowStyles[11] = 0;

    return xlsx.write({
        sheets: [
            students,
            { name: 'Instructions', rows: inst, rowStyles: instRowStyles, columns: [{ width: 26 }, { width: 24 }, { width: 80 }, { width: 26 }] },
            { name: 'Lists', rows: listRows, columns: listKeys.map(() => ({ width: 30 })), hidden: true }
        ]
    });
}

// ---------------------------------------------------------------------------
// Reading and checking a file
// ---------------------------------------------------------------------------

function decodeFile(body) {
    const b64 = String(body.file || '').replace(/^data:[^,]*,/, '');
    if (!b64) throw fail(400, 'Choose an Excel file (.xlsx) to upload.');
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length) throw fail(400, 'The file is empty.');
    if (buf.length > MAX_FILE_BYTES) throw fail(400, `The file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB. Split it into smaller files.`);
    if (buf.readUInt32LE(0) !== 0x04034b50) {
        throw fail(400, 'This is not an Excel .xlsx file. If it is an older .xls or a .csv file, open it in Excel and use Save As -> Excel Workbook (*.xlsx).');
    }
    return buf;
}

function parseDate(v) {
    const s = clean(v);
    if (!s) return { value: null };
    let iso = null;
    if (/^\d+(\.\d+)?$/.test(s)) iso = xlsx.excelDate(s);
    else {
        let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
        if (m) iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        m = !iso && /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
        if (m) iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    if (!iso) return { error: 'Use the format YYYY-MM-DD, for example 2026-04-15.' };
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return { error: 'This is not a real date. Use the format YYYY-MM-DD.' };
    if (iso < '1950-01-01') return { error: 'The date is too far in the past. Use the format YYYY-MM-DD.' };
    if (iso > today()) return { error: 'The enrollment date cannot be in the future.' };
    return { value: iso };
}

function formatCnic(digits) {
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

/**
 * Reads the workbook and checks every row against the registration rules and the records already stored.
 * Returns { fileErrors, warnings, rows: [{ row, values, record, errors, warnings, rollAuto, emailAuto }], ref }.
 */
async function analyse(buf, ctx, deps) {
    let book;
    try {
        book = xlsx.read(buf);
    } catch (e) {
        throw fail(400, e.badFile ? e.message : 'This file could not be read as an Excel workbook (.xlsx).');
    }
    const sheet = book.sheets.find(s => norm(s.name) === 'students') || book.sheets[0];
    const fileErrors = [];
    const fileWarnings = [];
    if (!sheet) throw fail(400, 'The workbook has no sheets.');

    // Headings -> columns
    const head = sheet.rows[0] || [];
    const colOf = {};
    head.forEach((h, i) => {
        const key = HEADER_LOOKUP.get(normHeader(h));
        if (!clean(h)) return;
        if (!key) { fileWarnings.push(`Column "${clean(h)}" is not part of the template and was ignored.`); return; }
        if (colOf[key] !== undefined) { fileErrors.push(`The column "${COLUMN[key].label}" appears twice. Keep one of them.`); return; }
        colOf[key] = i;
    });
    if (!head.some(h => clean(h))) {
        fileErrors.push(`Row 1 of the "${sheet.name}" sheet must contain the column headings. Download the template and copy your data into it.`);
    } else {
        COLUMNS.filter(c => c.required === true && colOf[c.key] === undefined)
            .forEach(c => fileErrors.push(`The required column "${c.label}" is missing from row 1. Download the template and keep its headings.`));
    }

    const dataRows = [];
    for (let i = 1; i < sheet.rows.length; i++) {
        const cells = sheet.rows[i] || [];
        const values = {};
        COLUMNS.forEach(c => { values[c.key] = colOf[c.key] !== undefined ? clean(cells[colOf[c.key]]) : ''; });
        if (Object.values(values).every(v => !v)) continue;
        dataRows.push({ row: i + 1, values });
    }
    if (!fileErrors.length && !dataRows.length) fileErrors.push('The file has no students. Fill in at least one row below the headings on the "Students" sheet.');
    if (dataRows.length > MAX_ROWS) fileErrors.push(`The file has ${dataRows.length} students. Import at most ${MAX_ROWS} at a time: split the file.`);

    const ref = await loadReference(ctx, deps);
    if (fileErrors.length) return { fileErrors, warnings: fileWarnings, rows: [], ref, sheet: sheet.name };

    // What is already registered (any account's login identifiers; students' registration numbers and documents)
    const users = await deps.loadCollection('users');
    const ids = new Map();
    users.forEach(u => ['email', 'username', 'rollNo'].forEach(f => { if (u[f]) ids.set(norm(u[f]), u); }));
    const students = users.filter(u => u.role === 'STUDENT');
    const wifaq = new Map(students.filter(u => u.wifaqReg).map(u => [norm(u.wifaqReg), u]));
    const cnics = new Map(students.filter(u => u.cnic).map(u => [String(u.cnic).replace(/\D/g, ''), u]));
    const passports = new Map(students.filter(u => u.passport).map(u => [norm(u.passport).replace(/[\s-]/g, ''), u]));
    const who = u => `${u.name || 'another account'}${u.rollNo ? ` (${u.rollNo})` : ''}`;

    const classByLabel = new Map();
    const classByBase = new Map();
    ref.classes.forEach(c => {
        classByLabel.set(norm(c.label), c);
        classByLabel.set(norm(c.id), c);
        const b = norm(`${c.name}${c.section ? ` - ${c.section}` : ''}`);
        classByBase.set(b, classByBase.has(b) ? null : c);
    });
    const branchLookup = new Map();
    ref.branches.forEach(b => [b.label, b.code, b.name, b.id].forEach(k => branchLookup.set(norm(k), b)));
    const groupLookup = new Map();
    ref.groups.forEach(g => [g.name, g.id].forEach(k => groupLookup.set(norm(k), g)));
    const countryLookup = new Map(COUNTRIES.map(c => [norm(c), c]));

    const inFile = { rollNo: new Map(), wifaqReg: new Map(), email: new Map(), cnic: new Map(), passport: new Map() };
    const results = [];

    for (const { row, values: v } of dataRows) {
        const errors = [];
        const warnings = [];
        const err = (key, message) => errors.push({ column: key ? COLUMN[key].label : '', value: key ? v[key] : '', message });
        const warn = (key, message) => warnings.push({ column: key ? COLUMN[key].label : '', value: key ? v[key] : '', message });
        const dup = (key, normValue, label) => {
            const first = inFile[key].get(normValue);
            if (first) err(key, `Same ${label} as row ${first}. Each student needs a different ${label}.`);
            else inFile[key].set(normValue, row);
        };

        // Category
        const cat = norm(v.category);
        let studentType = null;
        if (!cat) err('category', 'Required. Choose Local or International.');
        else if (['local', 'pakistani', 'pakistan', 'l'].includes(cat)) studentType = 'LOCAL';
        else if (['international', 'overseas', 'foreign', 'i'].includes(cat)) studentType = 'INTERNATIONAL';
        else err('category', 'Choose Local or International from the drop-down.');

        // Names
        if (!v.name) err('name', 'Required. Enter the student\'s full name in English.');
        else if (v.name.length > 120) err('name', 'Too long: use at most 120 characters.');
        else if (!/[A-Za-z]/.test(v.name)) err('name', 'Write the name in English letters (the Urdu name has its own column).');
        if (!v.fatherName) err('fatherName', 'Required. Enter the father\'s full name in English.');
        else if (v.fatherName.length > 120) err('fatherName', 'Too long: use at most 120 characters.');
        if (v.urduName.length > 120) err('urduName', 'Too long: use at most 120 characters.');
        if (v.fatherUrduName.length > 120) err('fatherUrduName', 'Too long: use at most 120 characters.');

        // Gender
        const g = norm(v.gender);
        let gender = null;
        if (!g) err('gender', 'Required. Choose Male or Female.');
        else if (['male', 'm', 'boy'].includes(g)) gender = 'MALE';
        else if (['female', 'f', 'girl'].includes(g)) gender = 'FEMALE';
        else err('gender', 'Choose Male or Female from the drop-down.');

        // Identity documents
        let cnic = '';
        let passport = '';
        let country = 'Pakistan';
        if (studentType === 'LOCAL') {
            const digits = v.cnic.replace(/\D/g, '');
            if (!v.cnic) err('cnic', 'Required for Local students. Enter the 13-digit CNIC / B-Form number, e.g. 35201-1234567-1.');
            else if (digits.length !== 13 || /[^\d\s-]/.test(v.cnic)) err('cnic', 'Must be exactly 13 digits, e.g. 35201-1234567-1.');
            else {
                cnic = formatCnic(digits);
                if (cnics.has(digits)) err('cnic', `Already registered to ${who(cnics.get(digits))}. This student may already be in the portal.`);
                else dup('cnic', digits, 'CNIC / B-Form');
            }
            if (v.passport) warn('passport', 'Ignored for Local students.');
            if (v.country && norm(v.country) !== 'pakistan') warn('country', 'Local students are recorded with country Pakistan.');
        } else if (studentType === 'INTERNATIONAL') {
            const key = norm(v.passport).replace(/[\s-]/g, '');
            if (!v.passport) err('passport', 'Required for International students.');
            else if (v.passport.length < 3 || v.passport.length > 30 || !/^[A-Za-z0-9 -]+$/.test(v.passport)) err('passport', 'Use 3 to 30 letters and digits.');
            else {
                passport = v.passport.toUpperCase();
                if (passports.has(key)) err('passport', `Already registered to ${who(passports.get(key))}. This student may already be in the portal.`);
                else dup('passport', key, 'passport number');
            }
            if (!v.country) err('country', 'Required for International students. Choose the country of residence.');
            else if (v.country.length > 80) err('country', 'Too long: use at most 80 characters.');
            else country = countryLookup.get(norm(v.country)) || v.country;
            if (v.cnic) warn('cnic', 'Ignored for International students.');
        }

        // Class and campus
        let cls = null;
        if (v.cls) {
            cls = classByLabel.get(norm(v.cls)) || classByBase.get(norm(v.cls)) || null;
            if (!cls) {
                const ambiguous = classByBase.has(norm(v.cls)) && classByBase.get(norm(v.cls)) === null;
                err('cls', ambiguous ? 'More than one class has this name. Choose the exact class (with its campus) from the drop-down.'
                    : 'No such class. Choose a class from the drop-down, or leave it blank to assign the class later.');
            } else if (ctx.campuses && !ctx.campuses.has(cls.branchId)) {
                err('cls', 'This class is at a campus you do not have access to.');
                cls = null;
            }
        }
        let branchId = null;
        if (v.campus) {
            const b = branchLookup.get(norm(v.campus));
            if (!b) err('campus', 'No such campus. Choose a campus from the drop-down, or leave it blank.');
            else if (cls && cls.branchId && b.id !== cls.branchId) {
                const cb = ref.branchById.get(cls.branchId);
                err('campus', `The class ${cls.label} is at ${cb ? cb.label : 'another campus'}. Leave Campus blank (the class decides it) or choose that campus.`);
            } else if (ctx.campuses && !ctx.campuses.has(b.id)) err('campus', 'You do not have access to this campus.');
            else branchId = b.id;
        }
        if (cls) branchId = cls.branchId;
        if (!branchId && !v.campus) branchId = ref.defaultBranch;

        // Identifiers
        let rollNo = '';
        if (v.rollNo) {
            if (v.rollNo.length > 40 || !/^[A-Za-z0-9][A-Za-z0-9\-/_.]*$/.test(v.rollNo)) err('rollNo', 'Use at most 40 letters, digits and - / _ . (no spaces).');
            else if (ids.has(norm(v.rollNo))) err('rollNo', `Already used by ${who(ids.get(norm(v.rollNo)))}. Leave it blank to get the next free roll number.`);
            else {
                rollNo = v.rollNo;
                dup('rollNo', norm(v.rollNo), 'roll number');
            }
        }
        let wifaqReg = '';
        if (v.wifaqReg) {
            if (v.wifaqReg.length > 40) err('wifaqReg', 'Too long: use at most 40 characters.');
            else if (wifaq.has(norm(v.wifaqReg))) err('wifaqReg', `Already registered to ${who(wifaq.get(norm(v.wifaqReg)))}.`);
            else {
                wifaqReg = v.wifaqReg;
                dup('wifaqReg', norm(v.wifaqReg), 'Wifaq registration number');
            }
        }
        let phone = '';
        if (v.phone) {
            let digits = v.phone.replace(/\D/g, '');
            if (/[^\d\s+\-()]/.test(v.phone) || digits.length < 7 || digits.length > 15) err('phone', 'Use 7 to 15 digits, e.g. +92 300 1234567 or 0300-1234567.');
            else if (/^3\d{9}$/.test(v.phone)) {
                // Excel drops the leading 0 of a mobile number typed into a number cell
                phone = `0${v.phone}`;
                warn('phone', `Read as ${phone} (Excel had removed the leading 0).`);
            } else phone = v.phone;
        }
        let email = '';
        if (v.email) {
            if (v.email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) err('email', 'Not a valid email address, e.g. name@example.com. Leave blank to make one automatically.');
            else if (ids.has(norm(v.email))) err('email', `Already used by ${who(ids.get(norm(v.email)))}. Use another email or leave it blank.`);
            else {
                email = v.email.toLowerCase();
                dup('email', norm(v.email), 'login email');
            }
        }

        // Student type
        let group = null;
        if (v.group) {
            const found = groupLookup.get(norm(v.group));
            if (!found) err('group', `No such student type. Choose one of: ${ref.groups.map(x => x.name).join(', ')}.`);
            else if (found.id !== ref.defaultGroup && !ref.canChooseGroup) err('group', 'You are not allowed to choose the student type. Leave it blank (default type).');
            else group = found.id;
        }

        const date = parseDate(v.enrollmentDate);
        if (date.error) err('enrollmentDate', date.error);

        results.push({
            row, values: v, errors, warnings,
            draft: {
                name: v.name, urduName: v.urduName, fatherName: v.fatherName, fatherUrduName: v.fatherUrduName,
                studentType, country, cnic, passport, gender, classId: cls ? cls.id : null, branchId,
                rollNo, wifaqReg, phone, email, group, enrollmentDate: date.value || today(),
                className: cls ? cls.label : '', programName: cls ? (ref.programs.get(cls.programId) || '') : ''
            }
        });
    }

    // Roll numbers for rows that left it blank: the next numbers after the highest ASH-<year>-NNN in use, the way
    // the enrollment forms suggest them (never below the student count + 51)
    const prefix = `ASH-${new Date().getFullYear()}-`;
    const used = new Set(Array.from(ids.keys()));
    results.forEach(r => [r.draft.rollNo, r.draft.email].forEach(k => { if (k) used.add(norm(k)); }));
    let next = students.length + 51;
    used.forEach(k => {
        if (k.startsWith(prefix.toLowerCase())) {
            const n = Number(k.slice(prefix.length));
            if (Number.isInteger(n) && n >= next) next = n + 1;
        }
    });
    for (const r of results) {
        if (r.errors.length) continue;
        if (!r.draft.rollNo) {
            while (used.has(norm(`${prefix}${String(next).padStart(3, '0')}`))) next++;
            r.draft.rollNo = `${prefix}${String(next).padStart(3, '0')}`;
            used.add(norm(r.draft.rollNo));
            r.rollAuto = true;
            next++;
        }
        if (!r.draft.email) {
            const local = `scholar.${r.draft.rollNo.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            let candidate = `${local}@${EMAIL_DOMAIN}`;
            for (let n = 2; ids.has(candidate) || used.has(candidate); n++) candidate = `${local}${n}@${EMAIL_DOMAIN}`;
            r.draft.email = candidate;
            used.add(candidate);
            r.emailAuto = true;
        }
        // The same access check the save will make (permission, campus, student type)
        const probe = toRecord(r.draft, `import_check_${r.row}`, ref);
        policy.assignCampus(ctx, 'users', probe, null);
        if (!policy.canWrite(ctx, 'users', probe, null)) {
            r.errors.push({ column: '', value: '', message: ctx.reason || 'You are not allowed to create this student.' });
        } else if (!policy.canSetPassword(ctx, probe, true)) {
            r.errors.push({ column: '', value: '', message: 'You are not allowed to set passwords for new students.' });
        }
    }

    return { fileErrors, warnings: fileWarnings, rows: results, ref, sheet: sheet.name };
}

// The account record, field for field as Direct Student Enrollment builds it
function toRecord(d, id, ref) {
    const rec = {
        id,
        name: d.name,
        urduName: d.urduName,
        fatherName: d.fatherName,
        fatherUrduName: d.fatherUrduName,
        guardianName: d.fatherName,
        role: 'STUDENT',
        studentType: d.studentType,
        country: d.country,
        rollNo: d.rollNo,
        classId: d.classId,
        program: d.programName,
        branchId: d.branchId || ref.defaultBranch || null,
        email: d.email,
        phone: d.phone,
        cnic: d.cnic,
        passport: d.passport,
        gender: d.gender,
        status: 'ACTIVE',
        avatar: d.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase(),
        enrollmentDate: d.enrollmentDate
    };
    if (d.wifaqReg) rec.wifaqReg = d.wifaqReg;
    if (d.group) rec.permissionGroup = d.group;
    return rec;
}

// Identifies exactly what an import would save (rows, roll numbers, emails), so the import saves what the preview showed
function fingerprint(result) {
    const valid = result.rows.filter(r => !r.errors.length).map(r => [r.row, r.draft.rollNo, r.draft.email]);
    return crypto.createHash('sha256').update(JSON.stringify(valid)).digest('hex').slice(0, 32);
}

function summarise(result) {
    const valid = result.rows.filter(r => !r.errors.length);
    const branchLabel = id => (result.ref.branchById.get(id) || {}).label || '';
    const groupName = id => (result.ref.groups.find(g => g.id === (id || result.ref.defaultGroup)) || {}).name || '';
    return {
        sheet: result.sheet,
        fingerprint: fingerprint(result),
        fileErrors: result.fileErrors,
        fileWarnings: result.warnings,
        summary: {
            total: result.rows.length,
            valid: valid.length,
            invalid: result.rows.length - valid.length,
            withWarnings: result.rows.filter(r => r.warnings.length).length,
            errorCount: result.rows.reduce((n, r) => n + r.errors.length, 0)
        },
        rows: result.rows.map(r => ({
            row: r.row,
            ok: !r.errors.length,
            name: r.values.name,
            fatherName: r.values.fatherName,
            category: r.draft.studentType || r.values.category,
            gender: r.draft.gender || r.values.gender,
            rollNo: r.draft.rollNo || r.values.rollNo,
            rollAuto: !!r.rollAuto,
            email: r.draft.email || r.values.email,
            emailAuto: !!r.emailAuto,
            className: r.draft.className,
            campus: branchLabel(r.draft.branchId),
            group: groupName(r.draft.group),
            errors: r.errors,
            warnings: r.warnings
        }))
    };
}

function errorReport(result) {
    const errorRows = [['Excel Row', 'Column', 'Value entered', 'Problem and how to fix it']];
    result.fileErrors.forEach(m => errorRows.push(['', '(whole file)', '', m]));
    result.rows.forEach(r => r.errors.forEach(e => errorRows.push([r.row, e.column || '(whole row)', e.value || '', e.message])));
    result.rows.forEach(r => r.warnings.forEach(w => errorRows.push([r.row, w.column, w.value || '', `Warning (row will still be imported): ${w.message}`])));
    const fixRows = [COLUMNS.map(c => `${c.label}${c.required === true ? ' *' : ''}`).concat(['Original Row', 'What to fix'])];
    result.rows.filter(r => r.errors.length).forEach(r => {
        fixRows.push(COLUMNS.map(c => r.values[c.key]).concat([r.row, r.errors.map(e => `${e.column ? `${e.column}: ` : ''}${e.message}`).join(' | ')]));
    });
    const errStyles = errorRows.map((_, i) => (i === 0 ? undefined : xlsx.STYLE.wrap));
    return xlsx.write({
        sheets: [
            { name: 'Errors', rows: errorRows, header: errorRows[0].map(() => xlsx.STYLE.headRequired), rowStyles: errStyles, columns: [{ width: 11 }, { width: 24 }, { width: 28 }, { width: 90 }], freezeHeader: true, autoFilter: true },
            {
                name: 'Students', rows: fixRows,
                header: fixRows[0].map((_, i) => (i >= COLUMNS.length ? xlsx.STYLE.headOptional : (COLUMNS[i].required === true ? xlsx.STYLE.headRequired : xlsx.STYLE.headOptional))),
                columns: COLUMNS.map(c => ({ width: c.width, text: true })).concat([{ width: 12 }, { width: 70, style: xlsx.STYLE.error }]),
                freezeHeader: true
            }
        ]
    });
}

// ---------------------------------------------------------------------------
// Import jobs (in this process; one import at a time)
// ---------------------------------------------------------------------------

const jobs = new Map();
let running = null;

function prune() {
    const now = Date.now();
    jobs.forEach((j, id) => { if (now - j.created > JOB_TTL_MS && j.status !== 'running') jobs.delete(id); });
}

async function runImport(job, rows, ref, ctx, who, req, deps) {
    try {
        // Temporary passwords, hashed off the main thread before the transaction starts
        job.phase = 'Preparing login details';
        const prepared = rows.map((r, i) => ({ r, id: deps.newId('u_stud'), password: auth.temporaryPassword(), index: i }));
        const hashes = new Map();
        let hashed = 0;
        const workers = Array.from({ length: 4 }, async (_, w) => {
            for (let i = w; i < prepared.length; i += 4) {
                hashes.set(prepared[i].id, await auth.hashPasswordAsync(prepared[i].password));
                job.done = Math.floor(++hashed / 2);
            }
        });
        await Promise.all(workers);

        job.phase = 'Saving students';
        const st = { allUsers: null, revoke: new Set(), audits: [], hashes };
        const conn = await db.getConnection();
        const created = [];
        try {
            await conn.beginTransaction();
            for (const p of prepared) {
                const record = { ...toRecord(p.r.draft, p.id, ref), password: p.password };
                const out = await deps.writeRecord(conn, ctx, who, 'users', record, st);
                if (out.error !== undefined) throw fail(409, `Row ${p.r.row}: ${out.error || 'could not be saved.'} Nothing was imported.`);
                created.push({ row: p.r.row, id: p.id, record: out.record, password: p.password });
                job.done = Math.floor(prepared.length / 2 + (created.length / 2));
            }
            // Audit entries go in the same transaction: one commit for the whole import, and none if it is rolled back
            job.phase = 'Recording the import';
            for (const [collection, existing, record, extra] of st.audits) await deps.auditRecordChange(req, collection, existing, record, { ...extra, conn });
            await audit.log({ req, conn, action: 'students.import', entityType: 'users', entityId: null,
                summary: `Imported ${created.length} student(s) from ${job.fileName || 'an Excel file'}`, after: { count: created.length, rows: rows.length } });
            await conn.commit();
        } catch (e) {
            await conn.rollback().catch(() => {});
            // Roles noted in memory for rows that were rolled back are dropped again
            for (const c of created) await roles.removeUserRoles(null, c.id).catch(() => {});
            throw e;
        } finally {
            conn.release();
        }

        job.credentials = created.map(c => ({
            name: c.record.name, fatherName: c.record.fatherName, rollNo: c.record.rollNo, email: c.record.email, password: c.password,
            className: (ref.classes.find(x => x.id === c.record.classId) || {}).label || '',
            campus: (ref.branchById.get(c.record.branchId) || {}).label || ''
        }));
        job.students = created.map(c => ({ row: c.row, id: c.id, name: c.record.name, rollNo: c.record.rollNo, email: c.record.email }));
        job.imported = created.length;
        job.done = job.total;
        job.status = 'done';
        job.phase = 'Finished';
    } catch (e) {
        console.error('[Import] Student import failed:', e.message);
        job.status = 'failed';
        job.error = e.status ? e.message : 'The import could not be completed, so nothing was saved. Try again; if it keeps failing, contact the administrator.';
    } finally {
        job.finished = Date.now();
        running = null;
    }
}

function credentialsFile(job) {
    const rows = [['Name', 'Father Name', 'Roll No / Student ID', 'Login Email', 'Temporary Password', 'Class', 'Campus']];
    job.credentials.forEach(c => rows.push([c.name, c.fatherName, c.rollNo, c.email, c.password, c.className, c.campus]));
    return xlsx.write({
        sheets: [{
            name: 'Login Details', rows,
            header: rows[0].map(() => xlsx.STYLE.headOptional),
            columns: [{ width: 26 }, { width: 26 }, { width: 20 }, { width: 34 }, { width: 20 }, { width: 28 }, { width: 24 }].map(c => ({ ...c, text: true })),
            freezeHeader: true
        }, {
            name: 'Read me',
            rows: [['These are temporary passwords. Each student signs in with the login email or roll number and must choose a new password at first sign-in.'],
                ['Keep this file private and delete it once the details have been shared.']],
            columns: [{ width: 120 }]
        }]
    });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

function sendFile(res, name, buf) {
    res.writeHead(200, {
        'Content-Type': XLSX_TYPE,
        'Content-Disposition': `attachment; filename="${name}"`,
        'Content-Length': buf.length,
        'Cache-Control': 'no-store'
    });
    res.end(buf);
}

async function route(req, res, url, deps) {
    const p = url.pathname;
    if (!p.startsWith('/api/students/import')) return false;
    const who = deps.caller(req);
    if (!who.id) { deps.sendJson(res, 401, { success: false, error: 'Please sign in.' }); return true; }
    if (!deps.can(req, 'students.create')) {
        deps.sendJson(res, 403, { success: false, error: 'You are not allowed to register students.' });
        return true;
    }
    prune();
    try {
        await deps.ensureSchema();
        const ctx = await policy.buildContext(who, deps.loadCollection);
        if (p === '/api/students/import/template' && req.method === 'GET') {
            const ref = await loadReference(ctx, deps);
            sendFile(res, `Jamia_Ashrafia_Student_Import_Template_${today()}.xlsx`, buildTemplate(ref));
            return true;
        }
        if (p === '/api/students/import/preview' && req.method === 'POST') {
            const body = await deps.readJson(req);
            const result = await analyse(decodeFile(body), ctx, deps);
            const out = summarise(result);
            if (out.fileErrors.length || out.summary.invalid || out.summary.withWarnings) out.errorReport = errorReport(result).toString('base64');
            deps.sendJson(res, 200, { success: true, ...out });
            return true;
        }
        if (p === '/api/students/import/commit' && req.method === 'POST') {
            const body = await deps.readJson(req);
            if (body.confirm !== true) throw fail(400, 'Confirm the import first.');
            if (running) throw fail(409, 'Another student import is running. Wait for it to finish, then try again.');
            const result = await analyse(decodeFile(body), ctx, deps);
            if (result.fileErrors.length) throw fail(400, result.fileErrors[0]);
            const valid = result.rows.filter(r => !r.errors.length);
            const invalid = result.rows.length - valid.length;
            if (invalid && body.skipInvalid !== true) throw fail(400, `${invalid} row(s) have errors. Fix them, or choose to import only the valid rows.`);
            if (Number(body.expectedCount) !== valid.length || body.fingerprint !== fingerprint(result)) {
                throw fail(409, 'Students were added or changed since the preview, so the result would differ. Check the file again before importing.');
            }
            if (!valid.length) throw fail(400, 'There are no valid rows to import.');
            const job = { id: deps.newId('imp'), owner: who.id, status: 'running', phase: 'Starting', total: valid.length, done: 0, imported: 0,
                skipped: invalid, created: Date.now(), fileName: String(body.fileName || '').slice(0, 120) };
            jobs.set(job.id, job);
            running = job.id;
            runImport(job, valid, result.ref, ctx, who, req, deps);
            deps.sendJson(res, 200, { success: true, jobId: job.id, total: job.total });
            return true;
        }
        const m = /^\/api\/students\/import\/jobs\/([\w-]+)(\/credentials)?$/.exec(p);
        if (m && req.method === 'GET') {
            const job = jobs.get(m[1]);
            if (!job || job.owner !== who.id) throw fail(404, 'This import is no longer available (results are kept for 30 minutes).');
            if (m[2]) {
                if (job.status !== 'done') throw fail(409, 'The import has not finished.');
                sendFile(res, `Student_Login_Details_${today()}.xlsx`, credentialsFile(job));
                return true;
            }
            deps.sendJson(res, 200, { success: true, job: {
                id: job.id, status: job.status, phase: job.phase, total: job.total, done: job.done, imported: job.imported,
                skipped: job.skipped, error: job.error || null, students: job.status === 'done' ? job.students : undefined
            } });
            return true;
        }
        deps.sendJson(res, 404, { success: false, error: 'Not found' });
    } catch (e) {
        if (!e.status) console.error('[Import]', e);
        deps.sendJson(res, e.status || 500, { success: false, error: e.status ? e.message : 'The file could not be processed. Please try again.' });
    }
    return true;
}

module.exports = { route, COLUMNS, MAX_ROWS, analyse, buildTemplate };
