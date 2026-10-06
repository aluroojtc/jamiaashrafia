/**
 * Jamia Ashrafia Lahore - Cloud LMS Dev & Production Server
 * Native Node.js HTTP Server with full MIME handling, RBAC API endpoints, and Security Middleware
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./database/db');
const lmsApi = require('./server/lms-api');
const auth = require('./server/auth');
const roles = require('./server/roles');
const audit = require('./server/audit');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.resolve(__dirname);

const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.sql': 'text/plain; charset=UTF-8',
    '.md': 'text/markdown; charset=UTF-8',
    '.pdf': 'application/pdf'
};

// What the signed-in user may do comes from the roles tables (server/roles.js)
function can(req, permission) {
    return !!req.auth && roles.effectiveForAuth(req.auth).permissions.has(permission);
}

function forbidden(res, message) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '403 Forbidden', message }));
}

function legacyHandler(req, res) {
    // The portal and its API share one origin, so no cross-origin (CORS) access is granted
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // =========================================================================
    // BACKEND API & AUTHORIZATION MIDDLEWARE
    // =========================================================================

    // API Health check
    if (pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'online',
            institution: 'Jamia Ashrafia Lahore',
            motto: 'Knowledge & Piety (علم اور تقویٰ)',
            established: 1947,
            timestamp: new Date().toISOString()
        }));
        return;
    }

    // =========================================================================
    // API: ACADEMIC MASTER DATA (PHASE 1: MYSQL / MARIADB BACKED)
    // =========================================================================

    // GET /api/branches (Retrieves all institutional branches from MySQL)
    if (pathname === '/api/branches' && req.method === 'GET') {
        (async () => {
            try {
                const [rows] = await db.query(
                    `SELECT 
                        id, code, name, urdu_name AS urduName, 
                        address, city, is_womens_branch AS isWomens,
                        contact_phone AS contactPhone, contact_email AS contactEmail,
                        established_year AS established, student_count AS students,
                        created_at AS createdAt
                    FROM branches
                    ORDER BY established_year ASC, code ASC`
                );
                rows.forEach(r => { r.isWomens = !!r.isWomens; });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    status: 'success',
                    count: rows.length,
                    branches: rows
                }));
            } catch (err) {
                console.error('[DB] GET /api/branches Error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Database query failed for branches' }));
            }
        })();
        return;
    }

    // GET /api/departments (Retrieves academic departments from MySQL)
    if (pathname === '/api/departments' && req.method === 'GET') {
        (async () => {
            try {
                const [rows] = await db.query(
                    `SELECT 
                        id, code, name, urdu_name AS urduName,
                        description, hod_id AS hodId, created_at AS createdAt
                    FROM departments
                    ORDER BY code ASC`
                );

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    status: 'success',
                    count: rows.length,
                    departments: rows
                }));
            } catch (err) {
                console.error('[DB] GET /api/departments Error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Database query failed for departments' }));
            }
        })();
        return;
    }

    // GET /api/programs (Retrieves academic programs with department details from MySQL)
    if (pathname === '/api/programs' && req.method === 'GET') {
        (async () => {
            try {
                const [rows] = await db.query(
                    `SELECT 
                        p.id, p.code, p.name, p.urdu_name AS urduName,
                        p.duration_years AS durationYears, p.duration_years AS years,
                        p.wifaq_equivalence AS wifaqEquivalence,
                        p.description, p.department_id AS departmentId,
                        d.name AS departmentName, d.urdu_name AS departmentUrduName,
                        p.created_at AS createdAt
                    FROM academic_programs p
                    JOIN departments d ON p.department_id = d.id
                    ORDER BY p.duration_years DESC, p.code ASC`
                );

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    status: 'success',
                    count: rows.length,
                    programs: rows
                }));
            } catch (err) {
                console.error('[DB] GET /api/programs Error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Database query failed for programs' }));
            }
        })();
        return;
    }

    // GET /api/sessions (Retrieves academic sessions from MySQL)
    if (pathname === '/api/sessions' && req.method === 'GET') {
        (async () => {
            try {
                const [rows] = await db.query(
                    `SELECT 
                        id, name, 
                        DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
                        DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
                        is_current AS isCurrent,
                        created_at AS createdAt
                    FROM academic_sessions
                    ORDER BY start_date DESC`
                );
                rows.forEach(r => { r.isCurrent = !!r.isCurrent; });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    status: 'success',
                    count: rows.length,
                    sessions: rows
                }));
            } catch (err) {
                console.error('[DB] GET /api/sessions Error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Database query failed for sessions' }));
            }
        })();
        return;
    }

    // =========================================================================
    // API: ADMISSIONS MANAGEMENT (DATABASE-BACKED: MYSQL / MARIADB)
    // =========================================================================

    // GET /api/admissions (Protected: Retrieves admissions from database with category, status & search filtering)
    if (pathname === '/api/admissions' && req.method === 'GET') {
        if (!can(req, 'admissions.view')) {
            forbidden(res, 'Access Denied: You are not allowed to see the admissions registry.');
            return;
        }

        const studentTypeFilter = parsedUrl.searchParams.get('studentType');
        const statusFilter = parsedUrl.searchParams.get('status');
        const search = parsedUrl.searchParams.get('search');

        (async () => {
            try {
                let sql = `
                    SELECT 
                        id, 
                        application_no AS applicationNo, 
                        student_type AS studentType,
                        branch_id AS branchId, 
                        program_id AS programId, 
                        candidate_name AS name,
                        father_name AS fatherName, 
                        guardian_contact AS guardianContact,
                        email, 
                        phone, 
                        cnic_bform AS cnic, 
                        passport_number AS passport,
                        country, 
                        previous_madrasa AS previousMadrasa, 
                        hafiz_status AS hafizStatus, 
                        hostel_required AS hostelRequired, 
                        status,
                        DATE_FORMAT(interview_date, '%Y-%m-%d %H:%i') AS interviewDate,
                        interview_score AS interviewScore, 
                        allotted_roll_number AS allottedRollNo,
                        DATE_FORMAT(created_at, '%Y-%m-%d') AS appliedAt,
                        created_at AS createdAt
                    FROM student_admissions 
                    WHERE 1=1
                `;
                const params = [];

                if (studentTypeFilter && studentTypeFilter !== 'ALL') {
                    sql += ' AND student_type = ?';
                    params.push(studentTypeFilter);
                }
                if (statusFilter && statusFilter !== 'ALL') {
                    sql += ' AND status = ?';
                    params.push(statusFilter);
                }
                if (search && search.trim()) {
                    sql += ' AND (candidate_name LIKE ? OR application_no LIKE ? OR cnic_bform LIKE ? OR passport_number LIKE ? OR country LIKE ?)';
                    const term = `%${search.trim()}%`;
                    params.push(term, term, term, term, term);
                }

                sql += ' ORDER BY created_at DESC';

                const [rows] = await db.query(sql, params);
                rows.forEach(r => {
                    r.hafizStatus = !!r.hafizStatus;
                    r.hostelRequired = !!r.hostelRequired;
                    if (r.interviewScore !== null) r.interviewScore = Number(r.interviewScore);
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'success',
                    count: rows.length,
                    admissions: rows
                }));
            } catch (err) {
                console.error('[DB] GET /api/admissions Error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    error: 'Database query failed', 
                    message: 'Could not retrieve admissions from database: ' + err.message 
                }));
            }
        })();
        return;
    }

    // GET /api/admissions/:id (Protected: Retrieves a single admission from database)
    if (pathname.startsWith('/api/admissions/') && req.method === 'GET') {
        if (!can(req, 'admissions.view')) {
            forbidden(res, 'Access Denied: You are not allowed to see admission applications.');
            return;
        }

        const appId = pathname.replace('/api/admissions/', '').trim();
        (async () => {
            try {
                const [rows] = await db.query(
                    `SELECT 
                        id, application_no AS applicationNo, student_type AS studentType,
                        branch_id AS branchId, program_id AS programId, candidate_name AS name,
                        father_name AS fatherName, guardian_contact AS guardianContact,
                        email, phone, cnic_bform AS cnic, passport_number AS passport,
                        country, previous_madrasa AS previousMadrasa, 
                        hafiz_status AS hafizStatus, hostel_required AS hostelRequired, status,
                        DATE_FORMAT(interview_date, '%Y-%m-%d %H:%i') AS interviewDate,
                        interview_score AS interviewScore, allotted_roll_number AS allottedRollNo,
                        DATE_FORMAT(created_at, '%Y-%m-%d') AS appliedAt,
                        created_at AS createdAt
                    FROM student_admissions 
                    WHERE id = ? OR application_no = ? LIMIT 1`,
                    [appId, appId]
                );

                if (!rows || rows.length === 0) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Admission application not found in database' }));
                    return;
                }

                const record = rows[0];
                record.hafizStatus = !!record.hafizStatus;
                record.hostelRequired = !!record.hostelRequired;
                if (record.interviewScore !== null) record.interviewScore = Number(record.interviewScore);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success', admission: record }));
            } catch (err) {
                console.error('[DB] GET /api/admissions/:id Error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database query failed' }));
            }
        })();
        return;
    }

    // POST /api/admissions (Public: Online Student Registration with Transaction & Duplicate Check)
    if (pathname === '/api/admissions' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            (async () => {
                let conn = null;
                try {
                    const data = JSON.parse(body);
                    const studentType = (data.studentType || 'LOCAL').toUpperCase();
                    const name = (data.name || '').trim();
                    const fatherName = (data.fatherName || '').trim();
                    const phone = (data.phone || '').trim();
                    const email = (data.email || 'applicant@jamiaashrafia.org').trim();
                    const branchId = data.branchId || 'b1';
                    const programId = data.programId || 'p1';
                    const hostel = !!data.hostelRequired;
                    const prevMadrasa = (data.previousMadrasa || 'None').trim();
                    const hafiz = !!data.hafizStatus;

                    if (!name || !fatherName || !phone) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, status: 'error', error: 'Candidate name, father name, and phone number are required.' }));
                        return;
                    }

                    let cnic = null;
                    let passport = null;
                    let country = 'Pakistan';

                    if (studentType === 'LOCAL') {
                        const rawCnic = (data.cnic || '').trim();
                        const cnicDigits = rawCnic.replace(/\D/g, '');
                        if (!rawCnic || cnicDigits.length !== 13) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ 
                                success: false,
                                status: 'error',
                                error: 'Invalid CNIC: Pakistani Local students must provide a valid 13-digit CNIC / B-Form number.' 
                            }));
                            return;
                        }
                        cnic = rawCnic;
                        country = 'Pakistan';
                    } else if (studentType === 'INTERNATIONAL') {
                        passport = (data.passport || '').trim();
                        country = (data.country || '').trim();

                        if (!passport || passport.length < 3) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ 
                                success: false,
                                status: 'error',
                                error: 'Invalid Passport: International students must provide a valid Passport Number (minimum 3 characters).' 
                            }));
                            return;
                        }
                        if (!country) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ 
                                success: false,
                                status: 'error',
                                error: 'Country of residence is required for International students.' 
                            }));
                            return;
                        }
                    } else {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, status: 'error', error: 'Invalid studentType. Must be LOCAL or INTERNATIONAL.' }));
                        return;
                    }

                    // 1. Duplicate Application Check in Database
                    if (studentType === 'LOCAL') {
                        const [dupLocal] = await db.query(
                            `SELECT id, application_no AS applicationNo, status FROM student_admissions 
                             WHERE cnic_bform = ? AND status IN ('APPLIED', 'UNDER_REVIEW', 'INTERVIEW_SCHEDULED') LIMIT 1`,
                            [cnic]
                        );
                        if (dupLocal && dupLocal.length > 0) {
                            res.writeHead(409, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ 
                                success: false,
                                status: 'error',
                                error: `An admission application for this CNIC (${cnic}) is already active and under review (Application No: ${dupLocal[0].applicationNo}). Duplicate submission rejected.` 
                            }));
                            return;
                        }
                    } else {
                        const [dupIntl] = await db.query(
                            `SELECT id, application_no AS applicationNo, status FROM student_admissions 
                             WHERE passport_number = ? AND status IN ('APPLIED', 'UNDER_REVIEW', 'INTERVIEW_SCHEDULED') LIMIT 1`,
                            [passport]
                        );
                        if (dupIntl && dupIntl.length > 0) {
                            res.writeHead(409, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ 
                                success: false,
                                status: 'error',
                                error: `An admission application for this Passport Number (${passport}) is already active and under review (Application No: ${dupIntl[0].applicationNo}). Duplicate submission rejected.` 
                            }));
                            return;
                        }
                    }

                    // 2. Generate unique application number and record ID
                    const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM student_admissions`);
                    const nextSeq = (countRows && countRows[0] ? countRows[0].total : 0) + 96;
                    const appNo = `ASH-ADM-2024-${String(nextSeq).padStart(3, '0')}`;
                    const newId = `adm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

                    // 3. Execute Database Transaction (Admission Insert + Admin Notification Insert)
                    conn = await db.getConnection();
                    await conn.beginTransaction();

                    await conn.execute(
                        `INSERT INTO student_admissions (
                            id, application_no, student_type, branch_id, program_id,
                            candidate_name, father_name, guardian_contact, email, phone,
                            cnic_bform, passport_number, country, previous_madrasa,
                            hafiz_status, hostel_required, status, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPLIED', NOW(), NOW())`,
                        [
                            newId, appNo, studentType, branchId, programId,
                            name, fatherName, phone, email, phone,
                            cnic, passport, country, prevMadrasa,
                            hafiz ? 1 : 0, hostel ? 1 : 0
                        ]
                    );

                    // Insert Admin Notification into notifications table
                    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                    const notifTitle = `New Student Admission: ${name}`;
                    const idDoc = studentType === 'LOCAL' ? `CNIC ${cnic}` : `Passport ${passport} (${country})`;
                    const notifMsg = `Candidate ${name} s/o ${fatherName} (${idDoc}) submitted an admission application (${appNo}). Status: APPLIED.`;

                    await conn.execute(
                        `INSERT INTO notifications (
                            id, sender_id, target_role, title, message, category, is_read, created_at
                        ) VALUES (?, NULL, 'ACADEMIC_ADMIN', ?, ?, 'ADMISSION', 0, NOW())`,
                        [notifId, notifTitle, notifMsg]
                    );

                    await conn.commit();
                    conn.release();
                    conn = null;

                    const newRecord = {
                        id: newId,
                        applicationNo: appNo,
                        studentType: studentType,
                        name: name,
                        fatherName: fatherName,
                        cnic: cnic,
                        passport: passport,
                        country: country,
                        phone: phone,
                        email: email,
                        programId: programId,
                        branchId: branchId,
                        hostelRequired: hostel,
                        previousMadrasa: prevMadrasa,
                        hafizStatus: hafiz,
                        status: 'APPLIED',
                        interviewDate: null,
                        interviewScore: null,
                        allottedRollNo: null,
                        appliedAt: new Date().toISOString().split('T')[0],
                        createdAt: new Date().toISOString()
                    };

                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        status: 'success',
                        message: 'Admission application registered successfully in database.',
                        record: newRecord
                    }));
                } catch (err) {
                    if (conn) {
                        try { await conn.rollback(); } catch (rbErr) {}
                        conn.release();
                    }
                    console.error('[DB] POST /api/admissions Error:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: false,
                        status: 'error',
                        error: 'Registration failed due to a database error. Please verify your details and try again.' 
                    }));
                }
            })();
        });
        return;
    }

    // PUT /api/admissions/:id or POST /api/admissions/update (Admin updates admission details in database)
    if ((pathname.startsWith('/api/admissions/') && (req.method === 'PUT' || req.method === 'PATCH')) ||
        (pathname === '/api/admissions/update' && req.method === 'POST')) {
        const editors = ['admissions.update', 'admissions.schedule_interview', 'admissions.decide', 'admissions.enroll'];
        if (!editors.some(p => can(req, p))) {
            forbidden(res, 'Access Denied: You are not allowed to change admission applications.');
            return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            (async () => {
                try {
                    const data = JSON.parse(body);
                    const appId = pathname.startsWith('/api/admissions/') 
                        ? pathname.replace('/api/admissions/', '').trim()
                        : (data.id || data.applicationNo);

                    const [rows] = await db.query(
                        `SELECT * FROM student_admissions WHERE id = ? OR application_no = ? LIMIT 1`,
                        [appId, appId]
                    );

                    if (!rows || rows.length === 0) {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Admission application not found in database.' }));
                        return;
                    }

                    const existing = rows[0];
                    const studentType = (data.studentType || existing.student_type || 'LOCAL').toUpperCase();
                    let cnic = existing.cnic_bform;
                    let passport = existing.passport_number;
                    let country = existing.country;

                    if (studentType === 'LOCAL') {
                        if (data.cnic !== undefined) cnic = data.cnic.trim();
                        passport = null;
                        country = 'Pakistan';
                    } else if (studentType === 'INTERNATIONAL') {
                        if (data.passport !== undefined) passport = data.passport.trim();
                        if (data.country !== undefined) country = data.country.trim();
                        cnic = null;
                    }

                    const candidateName = data.name !== undefined ? data.name.trim() : existing.candidate_name;
                    const fatherName = data.fatherName !== undefined ? data.fatherName.trim() : existing.father_name;
                    const phone = data.phone !== undefined ? data.phone.trim() : existing.phone;
                    const email = data.email !== undefined ? data.email.trim() : existing.email;
                    const programId = data.programId !== undefined ? data.programId : existing.program_id;
                    const branchId = data.branchId !== undefined ? data.branchId : existing.branch_id;
                    const hostel = data.hostelRequired !== undefined ? (data.hostelRequired ? 1 : 0) : existing.hostel_required;
                    const hafiz = data.hafizStatus !== undefined ? (data.hafizStatus ? 1 : 0) : existing.hafiz_status;
                    const prev = data.previousMadrasa !== undefined ? data.previousMadrasa : existing.previous_madrasa;
                    const status = data.status !== undefined ? data.status : existing.status;
                    const interviewDate = data.interviewDate !== undefined ? data.interviewDate : existing.interview_date;
                    const interviewScore = data.interviewScore !== undefined ? data.interviewScore : existing.interview_score;
                    const allottedRollNo = data.allottedRollNo !== undefined ? data.allottedRollNo : existing.allotted_roll_number;

                    // Each step of the admission workflow needs its own permission
                    const statusChanged = status !== existing.status;
                    const needed = new Set();
                    if (statusChanged && ['APPROVED', 'REJECTED'].includes(status)) needed.add('admissions.decide');
                    if (statusChanged && status === 'ENROLLED') needed.add('admissions.enroll');
                    if ((statusChanged && status === 'INTERVIEW_SCHEDULED')
                        || (data.interviewScore !== undefined && Number(data.interviewScore || 0) !== Number(existing.interview_score || 0))) {
                        needed.add('admissions.schedule_interview');
                    }
                    if (statusChanged && !needed.size) needed.add('admissions.update');
                    const details = [[candidateName, existing.candidate_name], [fatherName, existing.father_name], [phone, existing.phone],
                        [email, existing.email], [cnic, existing.cnic_bform], [passport, existing.passport_number], [country, existing.country],
                        [programId, existing.program_id], [branchId, existing.branch_id], [hostel, existing.hostel_required],
                        [hafiz, existing.hafiz_status], [prev, existing.previous_madrasa]];
                    if (details.some(([a, b]) => String(a === null || a === undefined ? '' : a) !== String(b === null || b === undefined ? '' : b))) {
                        needed.add('admissions.update');
                    }
                    const missing = Array.from(needed).filter(p => !can(req, p));
                    if (missing.length) {
                        forbidden(res, `You are not allowed to make this change (${missing.join(', ')}).`);
                        return;
                    }

                    await db.query(
                        `UPDATE student_admissions SET
                            student_type = ?,
                            candidate_name = ?,
                            father_name = ?,
                            phone = ?,
                            email = ?,
                            cnic_bform = ?,
                            passport_number = ?,
                            country = ?,
                            program_id = ?,
                            branch_id = ?,
                            hostel_required = ?,
                            hafiz_status = ?,
                            previous_madrasa = ?,
                            status = ?,
                            interview_date = ?,
                            interview_score = ?,
                            allotted_roll_number = ?,
                            updated_at = NOW()
                        WHERE id = ? OR application_no = ?`,
                        [
                            studentType, candidateName, fatherName, phone, email,
                            cnic, passport, country, programId, branchId,
                            hostel, hafiz, prev, status,
                            interviewDate || null, interviewScore || null, allottedRollNo || null,
                            appId, appId
                        ]
                    );
                    if (statusChanged) {
                        await audit.log({
                            req, action: 'admission.status', entityType: 'admission', entityId: existing.application_no,
                            summary: `Application ${existing.application_no} (${candidateName}): ${existing.status} → ${status}`,
                            before: { status: existing.status }, after: { status, allottedRollNo: allottedRollNo || null }
                        });
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        status: 'success',
                        message: 'Admission application updated successfully in database.',
                        record: {
                            id: existing.id,
                            applicationNo: existing.application_no,
                            status: status,
                            name: candidateName,
                            fatherName: fatherName,
                            studentType: studentType,
                            allottedRollNo: allottedRollNo
                        }
                    }));
                } catch (err) {
                    console.error('[DB] PUT /api/admissions Error:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, status: 'error', error: 'Database update failed: ' + err.message }));
                }
            })();
        });
        return;
    }

    // =========================================================================
    // API: VIRTUAL CLASSROOM & WEBRTC SUITE (BACKEND RBAC SECURITY)
    // =========================================================================

    let backendVirtualClassRecordings = [
        {
            id: "rec_201",
            sessionId: "vc_101",
            title: "Sahih al-Bukhari - Kitab al-Iman & Bab Halat al-Qalb (Lecture 14)",
            urduTitle: "صحیح البخاری شریف - کتاب الایمان (لیکچر ۱۴)",
            classId: "cls_dawra_a",
            className: "Dawra-e-Hadith (Section A)",
            courseName: "Sahih al-Bukhari",
            teacherName: "Qari Arshad Ubaid",
            teacherId: "u_teacher_1",
            recordedDate: "2026-09-27",
            recordedTime: "11:00 AM",
            durationMinutes: 72,
            durationFormatted: "1h 12m",
            fileSizeBytes: 713031680,
            fileSizeFormatted: "680 MB",
            format: "MP4 (1080p H.264)",
            storageKey: "s3://ashrafia-lms-vault/recordings/2026/09/bukhari_lec14.mp4",
            retentionExpiryDate: "2026-12-26",
            daysRemaining: 89,
            viewsCount: 54,
            downloadsCount: 18,
            autoDeleteProtected: false,
            status: "ACTIVE"
        },
        {
            id: "rec_202",
            sessionId: "vc_102",
            title: "Contemporary Islamic Banking: Murabaha & Diminishing Musharakah Structuring",
            urduTitle: "اسلامی بینکاری: مرابحہ اور مشارکہ متناقصہ کی فقہی شرائط",
            classId: "cls_ifta",
            className: "Takhassus fil-Ifta (1st Year)",
            courseName: "Islamic Banking & Modern Jurisprudence",
            teacherName: "Mufti Ahmadur Rahman",
            teacherId: "u_teacher_2",
            recordedDate: "2026-09-25",
            recordedTime: "03:15 PM",
            durationMinutes: 85,
            durationFormatted: "1h 25m",
            fileSizeBytes: 849346560,
            fileSizeFormatted: "810 MB",
            format: "MP4 (1080p H.264)",
            storageKey: "s3://ashrafia-lms-vault/recordings/2026/09/banking_murabaha.mp4",
            retentionExpiryDate: "2026-12-24",
            daysRemaining: 87,
            viewsCount: 29,
            downloadsCount: 12,
            autoDeleteProtected: true,
            status: "ACTIVE"
        },
        {
            id: "rec_203",
            sessionId: "vc_103",
            title: "Al-Hidayah fi al-Fiqh: Kitab al-Buyu & Shuf'ah (Lec 28)",
            urduTitle: "ہدایہ فقہ حنفی: کتاب البیوع و شفعہ کی تشریح",
            classId: "cls_aaliyah",
            className: "Aaliyah (7th Year)",
            courseName: "Al-Hidayah fi al-Fiqh",
            teacherName: "Mufti Ahmadur Rahman",
            teacherId: "u_teacher_2",
            recordedDate: "2026-09-24",
            recordedTime: "10:30 AM",
            durationMinutes: 58,
            durationFormatted: "58m",
            fileSizeBytes: 566231040,
            fileSizeFormatted: "540 MB",
            format: "MP4 (1080p H.264)",
            storageKey: "s3://ashrafia-lms-vault/recordings/2026/09/hidayah_buyu.mp4",
            retentionExpiryDate: "2026-12-23",
            daysRemaining: 86,
            viewsCount: 46,
            downloadsCount: 14,
            autoDeleteProtected: false,
            status: "ACTIVE"
        },
        {
            id: "rec_204",
            sessionId: "vc_105",
            title: "Tajweed & Sifat al-Huroof: Al-Muqaddimah al-Jazariyyah (Session 09)",
            urduTitle: "تجوید و صفات الحروف: شرح المقدمة الجزریة",
            classId: "cls_hifz_3",
            className: "Hifz-ul-Quran (Daur-e-Kamil)",
            courseName: "Al-Muqaddimah al-Jazariyyah",
            teacherName: "Qari Arshad Ubaid",
            teacherId: "u_teacher_1",
            recordedDate: "2026-09-22",
            recordedTime: "07:00 AM",
            durationMinutes: 45,
            durationFormatted: "45m",
            fileSizeBytes: 450887680,
            fileSizeFormatted: "430 MB",
            format: "MP4 (1080p H.264)",
            storageKey: "s3://ashrafia-lms-vault/recordings/2026/09/tajweed_makharij.mp4",
            retentionExpiryDate: "2026-12-21",
            daysRemaining: 84,
            viewsCount: 38,
            downloadsCount: 9,
            autoDeleteProtected: false,
            status: "ACTIVE"
        }
    ];

    let backendRetentionSettings = {
        retentionDays: 90,
        autoRecord: true,
        allowStudentDownload: false,
        storageQuotaGB: 50,
        usedStorageGB: 2.46,
        cloudProvider: "Jamia Ashrafia Secure AWS S3 Vault (AES-256)",
        autoCleanupEnabled: true,
        lastCleanupDate: "2026-09-28"
    };

    // POST /api/virtual-class/retention (Super Admin Retention Configuration & Cleanup)
    if (pathname === '/api/virtual-class/retention' && req.method === 'POST') {
        if (!can(req, 'settings.recordings')) {
            forbidden(res, 'You are not allowed to change recording retention.');
            return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (data.retentionDays !== undefined) {
                    backendRetentionSettings.retentionDays = Number(data.retentionDays);
                }
                if (data.triggerCleanup) {
                    backendRetentionSettings.lastCleanupDate = new Date().toISOString().split('T')[0];
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'success',
                    message: 'Recording retention policy updated and storage audit finalized.',
                    settings: backendRetentionSettings
                }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid retention payload' }));
            }
        });
        return;
    }

    // POST /api/virtual-class/cleanup (Automated Expired Recording Purge)
    if (pathname === '/api/virtual-class/cleanup' && req.method === 'POST') {
        if (!can(req, 'settings.recordings')) {
            forbidden(res, 'You are not allowed to run recording clean-up.');
            return;
        }

        const retentionDays = backendRetentionSettings.retentionDays;
        const now = new Date();
        const initialCount = backendVirtualClassRecordings.length;

        // Purge recordings whose daysRemaining <= 0 and not autoDeleteProtected
        backendVirtualClassRecordings = backendVirtualClassRecordings.filter(rec => {
            if (rec.autoDeleteProtected) return true;
            return rec.daysRemaining > 0;
        });

        const purgedCount = initialCount - backendVirtualClassRecordings.length;
        // Recalculate storage used
        const totalBytes = backendVirtualClassRecordings.reduce((sum, r) => sum + (r.fileSizeBytes || 0), 0);
        backendRetentionSettings.usedStorageGB = parseFloat((totalBytes / (1024 * 1024 * 1024)).toFixed(2));
        backendRetentionSettings.lastCleanupDate = new Date().toISOString().split('T')[0];

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'success',
            message: `Storage retention audit executed. ${purgedCount} expired recordings removed from cloud storage.`,
            purgedCount,
            activeCount: backendVirtualClassRecordings.length,
            settings: backendRetentionSettings
        }));
        return;
    }

    // =========================================================================
    // ROUTING & STATIC FILE SERVING
    // =========================================================================

    // Unknown API endpoints must not fall through to the login page
    if (pathname.startsWith('/api/')) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
    }

    // Requirement 1: Default landing page MUST be login.html
    if (pathname === '/' || pathname === '' || pathname === '/login') {
        pathname = '/login.html';
    }

    let filePath = path.join(PUBLIC_DIR, pathname);

    // Security: Prevent path traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // Fallback for clean URLs without extensions
            if (!path.extname(filePath)) {
                filePath = path.join(PUBLIC_DIR, 'login.html');
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end(`404 Not Found: ${pathname}`);
                return;
            }
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (readErr, content) => {
            if (readErr) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error');
                return;
            }

            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-cache',
                'X-Content-Type-Options': 'nosniff'
            });
            res.end(content);
        });
    });
}

// Paths that may be served as static files. Everything else (source, .env, .git, SQL, archives) stays private.
const PUBLIC_FILES = new Set(['/index.html', '/login.html']);
const PUBLIC_DIRS = ['/css/', '/js/', '/assets/', '/uploads/'];
const INLINE_UPLOAD_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp3', '.m4a', '.mp4', '.webm', '.txt']);

function isPublicPath(pathname) {
    if (pathname.split('/').some(seg => seg.startsWith('.'))) return false;
    return PUBLIC_FILES.has(pathname) || PUBLIC_DIRS.some(d => pathname.startsWith(d));
}

// API routes anyone may call without signing in (login, the public admission form and its status tracker)
const PUBLIC_API = new Set([
    'GET /api/health',
    'POST /api/auth/login',
    'POST /api/auth/logout',
    'GET /api/auth/me',
    'POST /api/admissions',
    'GET /api/admissions/status',
    'GET /api/settings/admissions',
    'GET /api/branches',
    'GET /api/departments',
    'GET /api/programs',
    'GET /api/sessions'
]);
// While previewing a role, nothing can be changed; only these are reachable besides reading
const PREVIEW_ALLOWED = new Set(['DELETE /api/preview', 'POST /api/auth/logout']);
// While a temporary password is in use, only these are reachable
const MUST_CHANGE_API = new Set(['GET /api/auth/me', 'POST /api/auth/change-password', 'POST /api/auth/logout']);

function sendJsonError(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=UTF-8' });
    res.end(JSON.stringify(payload));
}

// Identifies the caller from the session cookie. Identity headers sent by old browsers are discarded.
async function authenticate(req) {
    delete req.headers['x-user-role'];
    delete req.headers['x-user-id'];
    delete req.headers['x-user-class'];
    await lmsApi.ensureSchema();
    req.auth = await auth.resolveSession(req);
    // A Super Admin previewing a role sees the portal through that role (and, if chosen, one person holding it)
    if (req.auth && req.auth.previewRequest && roles.isSuperAdminUser(req.auth.user)) {
        const pr = req.auth.previewRequest;
        const real = req.auth.user;
        const person = pr.userId ? await auth.loadUser(pr.userId) : null;
        const shown = person && !auth.INACTIVE_STATUSES.includes(person.status) ? { ...person } : real;
        delete shown.password;
        req.auth = {
            ...req.auth,
            id: shown.id,
            role: shown.role,
            user: shown,
            realUser: real,
            preview: { roleId: pr.roleId, userId: shown === real ? null : shown.id, userName: shown === real ? null : shown.name, realId: real.id, realName: real.name }
        };
    }
    return req.auth;
}

const server = http.createServer(async (req, res) => {
    let pathname = '/';
    try {
        pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('400 Bad Request');
        return;
    }
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'same-origin');

    if (pathname.startsWith('/api/') || pathname.startsWith('/uploads/')) {
        try {
            await authenticate(req);
        } catch (err) {
            console.error('[Auth] Session lookup failed:', err.message);
            sendJsonError(res, 503, { success: false, error: 'Database unavailable' });
            return;
        }
    }

    if (pathname.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store');
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        const routeKey = `${req.method} ${pathname}`;
        if (!req.auth && !PUBLIC_API.has(routeKey)) {
            sendJsonError(res, 401, { success: false, error: 'Please sign in.' });
            return;
        }
        if (req.auth && req.auth.preview && req.method !== 'GET' && !PREVIEW_ALLOWED.has(routeKey)) {
            sendJsonError(res, 403, { success: false, previewReadOnly: true, error: 'You are previewing a role, so nothing can be changed. Leave the preview to make changes.' });
            return;
        }
        if (req.auth && req.auth.mustChange && !MUST_CHANGE_API.has(routeKey) && !PUBLIC_API.has(routeKey)) {
            sendJsonError(res, 403, { success: false, mustChangePassword: true, error: 'Please choose a new password before continuing.' });
            return;
        }
        if (await lmsApi.handle(req, res)) return;
    } else if (!['/', '', '/login'].includes(pathname) && !isPublicPath(pathname)) {
        if (path.extname(pathname) || pathname.split('/').some(seg => seg.startsWith('.'))) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end(`404 Not Found: ${pathname}`);
            return;
        }
        // Extension-less app URLs fall back to the login page
        req.url = '/login';
    }

    if (pathname.startsWith('/uploads/')) {
        // Uploaded files (payment proofs, papers, submissions) are only served to signed-in users
        if (!req.auth) {
            res.writeHead(401, { 'Content-Type': 'text/plain' });
            res.end('401 Unauthorized: please sign in to the portal to open this file.');
            return;
        }
        res.setHeader('Cache-Control', 'private, no-store');
        // Never let the browser treat them as HTML/script
        // (PDF, images, audio/video and plain text are shown inline; everything else downloads)
        const ext = path.extname(pathname).toLowerCase();
        if (!INLINE_UPLOAD_EXT.has(ext)) {
            res.setHeader('Content-Disposition', `attachment; filename="${path.basename(pathname).replace(/"/g, '')}"`);
        }
    }

    legacyHandler(req, res);
});

server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Jamia Ashrafia Lahore - Cloud LMS Portal Started`);
    console.log(` Default Landing URL: http://localhost:${PORT}/ (Login Required)`);
    console.log(` Institutional Heritage: Est. 1947 | Ferozepur Road`);
    console.log(`=======================================================`);
    db.testConnection().then(ok => {
        if (!ok) return;
        lmsApi.ensureSchema()
            .then(() => console.log('[DB] LMS shared record store and roles ready'))
            .catch(err => console.warn('[DB] LMS schema setup failed:', err.message));
    });
});

