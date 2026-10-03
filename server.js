/**
 * Jamia Ashrafia Lahore - Cloud LMS Dev & Production Server
 * Native Node.js HTTP Server with full MIME handling, RBAC API endpoints, and Security Middleware
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./database/db');

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

// In-memory backend permissions store (synchronized with client)
let systemRolePermissions = {
    STUDENT: {
        classes: true,
        assignments: true,
        exams: true,
        timetable: true,
        virtual_class: true,
        notifications: true,
        library: true,
        attendance: true,
        students: false,
        reports: false,
        users: false,
        roles: false,
        admissions: false,
        teachers: false,
        fees: false,
        heritage: true,
        permissions: false,
        security: false
    },
    TEACHER: {
        classes: true,
        assignments: true,
        exams: true,
        timetable: true,
        virtual_class: true,
        notifications: true,
        library: true,
        teachers: true,
        students: true,
        attendance: true,
        reports: false,
        users: false,
        roles: false,
        admissions: false,
        fees: false,
        heritage: true,
        permissions: false,
        security: false
    },
    ACADEMIC_ADMIN: {
        classes: true,
        assignments: true,
        exams: true,
        timetable: true,
        virtual_class: true,
        notifications: true,
        library: true,
        teachers: true,
        students: true,
        attendance: true,
        reports: true,
        users: false,
        roles: false,
        admissions: true,
        fees: false,
        heritage: true,
        permissions: false,
        security: false
    },
    ACCOUNTANT: {
        classes: false,
        assignments: false,
        exams: false,
        timetable: false,
        virtual_class: false,
        notifications: true,
        library: false,
        teachers: false,
        students: false,
        attendance: true,
        reports: true,
        users: false,
        roles: false,
        admissions: false,
        fees: true,
        heritage: true,
        permissions: false,
        security: false
    },
    SUPER_ADMIN: {
        classes: true,
        assignments: true,
        exams: true,
        timetable: true,
        virtual_class: true,
        notifications: true,
        library: true,
        admissions: true,
        teachers: true,
        students: true,
        attendance: true,
        reports: true,
        users: true,
        roles: true,
        fees: true,
        heritage: true,
        permissions: true,
        security: true
    }
};

// In-memory backend attendance store
let systemAttendance = [
    {
        id: "att_today_1",
        userId: "u_student_2",
        userName: "Hafiz Usman Tariq",
        role: "STUDENT",
        identifier: "ASH-2024-042",
        classId: "cls_aaliyah",
        className: "Aaliyah (1st Year)",
        date: "2026-09-28",
        checkInTime: "07:45 AM",
        checkOutTime: null,
        status: "PRESENT",
        session: "DAILY_ACADEMIC"
    },
    {
        id: "att_today_5",
        userId: "u_teacher_2",
        userName: "Mufti Ahmadur Rahman",
        role: "TEACHER",
        identifier: "darulifta@jamiaashrafia.org",
        classId: "cls_ifta",
        className: "Fiqh & Fatawa Dept",
        date: "2026-09-28",
        checkInTime: "07:30 AM",
        checkOutTime: null,
        status: "PRESENT",
        session: "DAILY_ACADEMIC"
    }
];

// In-memory backend admissions store (seeded with local and international records)
let systemAdmissions = [
    {
        id: "adm_101",
        applicationNo: "ASH-ADM-2024-089",
        studentType: "LOCAL",
        name: "Ahmad Raza Siddiqui",
        fatherName: "Maulana Muhammad Siddique",
        cnic: "35201-8934521-3",
        passport: "",
        country: "Pakistan",
        phone: "+92 300 4589211",
        email: "ahmad.raza@gmail.com",
        programId: "p1",
        branchId: "b1",
        hostelRequired: true,
        previousMadrasa: "Jamia Farooqia Karachi (Sanawiyyah Passed)",
        hafizStatus: true,
        status: "INTERVIEW_SCHEDULED",
        interviewDate: "2026-10-05 10:00 AM",
        interviewScore: null,
        allottedRollNo: null,
        appliedAt: "2026-09-24"
    },
    {
        id: "adm_102",
        applicationNo: "ASH-ADM-2024-090",
        studentType: "LOCAL",
        name: "Zubair Ahmad Qasmi",
        fatherName: "Hafiz Abdul Qadir",
        cnic: "38403-1249872-5",
        passport: "",
        country: "Pakistan",
        phone: "+92 321 7845123",
        email: "zubair.qasmi@outlook.com",
        programId: "p2",
        branchId: "b1",
        hostelRequired: true,
        previousMadrasa: "Jamia Ashrafia Lahore (Dawra-e-Hadith Mumtaz)",
        hafizStatus: true,
        status: "APPROVED",
        interviewDate: "2026-09-20 11:30 AM",
        interviewScore: 94.5,
        allottedRollNo: "ASH-IFT-018",
        appliedAt: "2026-09-18"
    },
    {
        id: "adm_103",
        applicationNo: "ASH-ADM-2024-091",
        studentType: "LOCAL",
        name: "Zainab Bint Tariq",
        fatherName: "Tariq Mahmood",
        cnic: "35202-6721980-6",
        passport: "",
        country: "Pakistan",
        phone: "+92 333 9812470",
        email: "zainab.tariq@gmail.com",
        programId: "p5",
        branchId: "b2",
        hostelRequired: false,
        previousMadrasa: "Madrisatul Faisal Lil Bannat Model Town",
        hafizStatus: true,
        status: "ENROLLED",
        interviewDate: "2026-09-15",
        interviewScore: 91.0,
        allottedRollNo: "ASH-B-114",
        appliedAt: "2026-09-12"
    },
    {
        id: "adm_104",
        applicationNo: "ASH-ADM-2024-092",
        studentType: "LOCAL",
        name: "Abdullah Haroon",
        fatherName: "Haroon Rashid",
        cnic: "37405-5544123-1",
        passport: "",
        country: "Pakistan",
        phone: "+92 301 6677889",
        email: "abdullah.haroon@yahoo.com",
        programId: "p3",
        branchId: "b4",
        hostelRequired: false,
        previousMadrasa: "Government High School Lahore",
        hafizStatus: false,
        status: "UNDER_REVIEW",
        interviewDate: null,
        interviewScore: null,
        allottedRollNo: null,
        appliedAt: "2026-09-27"
    },
    {
        id: "adm_105",
        applicationNo: "ASH-ADM-2024-093",
        studentType: "INTERNATIONAL",
        name: "Tariq Abdul Majeed",
        fatherName: "Maulana Abdul Majeed",
        cnic: "",
        passport: "GBR-98421054",
        country: "United Kingdom",
        phone: "+44 7700 900123",
        email: "tariq.majeed@gmail.com",
        programId: "p1",
        branchId: "b1",
        hostelRequired: true,
        previousMadrasa: "Darul Uloom London",
        hafizStatus: true,
        status: "APPLIED",
        interviewDate: null,
        interviewScore: null,
        allottedRollNo: null,
        appliedAt: "2026-09-28"
    }
];

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Role, X-User-Id');

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

    // API: Permissions Management
    if (pathname === '/api/permissions') {
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'success',
                permissions: systemRolePermissions
            }));
            return;
        }

        if (req.method === 'POST') {
            const userRole = req.headers['x-user-role'];
            // Backend Enforcement: Only Super Admin can change permissions
            if (userRole !== 'SUPER_ADMIN') {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: '403 Forbidden',
                    message: 'Access Denied: Only Super Admin can modify institutional role permissions.'
                }));
                return;
            }

            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (parsed && parsed.permissions) {
                        systemRolePermissions = { ...systemRolePermissions, ...parsed.permissions };
                        // Hard-code full permissions for SUPER_ADMIN at system level
                        if (!systemRolePermissions.SUPER_ADMIN) systemRolePermissions.SUPER_ADMIN = {};
                        ['classes', 'assignments', 'exams', 'timetable', 'virtual_class', 'notifications',
                         'library', 'admissions', 'teachers', 'students', 'attendance', 'reports', 'users',
                         'roles', 'fees', 'heritage', 'permissions', 'security'].forEach(m => {
                            systemRolePermissions.SUPER_ADMIN[m] = true;
                        });
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 'success',
                        message: 'Role permissions successfully saved on server.',
                        permissions: systemRolePermissions
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
                }
            });
            return;
        }
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
        const userRole = (req.headers['x-user-role'] || '').toUpperCase();
        if (userRole !== 'SUPER_ADMIN' && userRole !== 'ACADEMIC_ADMIN') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                error: '403 Forbidden', 
                message: 'Access Denied: Only Super Admin and Academic Nazim can access the admissions registry.' 
            }));
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
        const userRole = (req.headers['x-user-role'] || '').toUpperCase();
        if (userRole !== 'SUPER_ADMIN' && userRole !== 'ACADEMIC_ADMIN') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '403 Forbidden', message: 'Access Denied.' }));
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
        const userRole = (req.headers['x-user-role'] || '').toUpperCase();
        if (userRole !== 'SUPER_ADMIN' && userRole !== 'ACADEMIC_ADMIN') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '403 Forbidden', message: 'Access Denied.' }));
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
    // API: NOTIFICATIONS SYSTEM (DATABASE-BACKED: MYSQL / MARIADB)
    // =========================================================================

    // GET /api/notifications (Protected: Retrieves notifications for authenticated administrative user)
    if (pathname === '/api/notifications' && req.method === 'GET') {
        const userRole = (req.headers['x-user-role'] || '').toUpperCase();
        if (!userRole) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '401 Unauthorized', message: 'Authentication required.' }));
            return;
        }

        (async () => {
            try {
                let sql = `
                    SELECT 
                        id, 
                        sender_id AS senderId, 
                        target_role AS targetRole, 
                        title, 
                        message, 
                        category, 
                        is_read AS isRead,
                        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS time,
                        created_at AS createdAt
                    FROM notifications
                `;
                const params = [];

                if (userRole === 'SUPER_ADMIN') {
                    // Super Admin (Hazrat Mohtamim) can oversee all institutional broadcasts and admissions
                    sql += ' WHERE target_role IN (?, ?, ?, ?) OR target_role IS NULL';
                    params.push('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'TEACHER', 'ALL');
                } else if (userRole === 'ACADEMIC_ADMIN') {
                    sql += ' WHERE target_role IN (?, ?) OR target_role IS NULL';
                    params.push('ACADEMIC_ADMIN', 'ALL');
                } else {
                    sql += ' WHERE target_role IN (?, ?) OR target_role IS NULL';
                    params.push(userRole, 'ALL');
                }

                sql += ' ORDER BY created_at DESC LIMIT 50';

                const [rows] = await db.query(sql, params);
                rows.forEach(r => {
                    r.isRead = !!r.isRead;
                    r.sender = r.targetRole === 'ACADEMIC_ADMIN' ? 'Online Admissions Portal' : 'Jamia Ashrafia Admin';
                });

                const unreadCount = rows.filter(r => !r.isRead).length;

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'success',
                    unreadCount: unreadCount,
                    notifications: rows
                }));
            } catch (err) {
                console.error('[DB] GET /api/notifications Error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to retrieve notifications from database' }));
            }
        })();
        return;
    }

    // POST /api/notifications/read (Protected: Marks single notification or all as read in database)
    if (pathname === '/api/notifications/read' && req.method === 'POST') {
        const userRole = (req.headers['x-user-role'] || '').toUpperCase();
        if (!userRole) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '401 Unauthorized' }));
            return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            (async () => {
                try {
                    const data = body ? JSON.parse(body) : {};
                    const notifId = data.id || data.notificationId;

                    if (notifId) {
                        await db.query(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [notifId]);
                    } else if (data.markAll) {
                        if (userRole === 'SUPER_ADMIN') {
                            await db.query(`UPDATE notifications SET is_read = 1`);
                        } else {
                            await db.query(`UPDATE notifications SET is_read = 1 WHERE target_role IN (?, 'ALL')`, [userRole]);
                        }
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, status: 'success', message: 'Notification read state updated.' }));
                } catch (err) {
                    console.error('[DB] POST /api/notifications/read Error:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, status: 'error', error: 'Database update failed' }));
                }
            })();
        });
        return;
    }


    // =========================================================================
    // API: ATTENDANCE & CHECK-IN SYSTEM
    // =========================================================================

    // POST /api/attendance/checkin (Marks attendance with duplicate prevention)
    if (pathname === '/api/attendance/checkin' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const record = JSON.parse(body);
                const userId = record.userId || req.headers['x-user-id'];
                const date = record.date || new Date().toISOString().split('T')[0];

                if (!userId) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'User ID is required' }));
                    return;
                }

                // In-memory duplicate check
                const existing = systemAttendance.find(a => a.userId === userId && a.date === date);
                if (existing) {
                    res.writeHead(409, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: '409 Conflict',
                        message: `Attendance already recorded for today at ${existing.checkInTime}. Duplicate check-in prevented.`
                    }));
                    return;
                }

                record.id = record.id || ('att_' + Date.now());
                record.createdAt = new Date().toISOString();
                systemAttendance.unshift(record);

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'success',
                    message: 'Check-in recorded successfully on server.',
                    record: record
                }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid attendance payload' }));
            }
        });
        return;
    }

    // POST /api/attendance/checkout (Records check-out time)
    if (pathname === '/api/attendance/checkout' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const userId = data.userId || req.headers['x-user-id'];
                const date = data.date || new Date().toISOString().split('T')[0];
                const checkOutTime = data.checkOutTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const record = systemAttendance.find(a => a.userId === userId && a.date === date);
                if (record) {
                    record.checkOutTime = checkOutTime;
                    record.updatedAt = new Date().toISOString();
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'success',
                    message: 'Check-out recorded successfully.',
                    checkOutTime: checkOutTime
                }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid checkout payload' }));
            }
        });
        return;
    }

    // GET /api/attendance (Filtered attendance retrieval with RBAC)
    if (pathname === '/api/attendance' && req.method === 'GET') {
        const userRole = req.headers['x-user-role'] || 'STUDENT';
        const currentUserId = req.headers['x-user-id'];
        const queryUserId = parsedUrl.searchParams.get('userId');
        const queryRole = parsedUrl.searchParams.get('role');
        const queryDate = parsedUrl.searchParams.get('date');

        // RBAC Enforcement: Students may ONLY view their own attendance
        if (userRole === 'STUDENT') {
            if (queryUserId && queryUserId !== currentUserId) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: '403 Forbidden',
                    message: 'Access Denied: Students are not permitted to inspect other scholars attendance records.'
                }));
                return;
            }
        }

        let filtered = systemAttendance;
        if (userRole === 'STUDENT') {
            filtered = filtered.filter(a => a.userId === currentUserId);
        } else {
            if (queryUserId) filtered = filtered.filter(a => a.userId === queryUserId);
            if (queryRole) filtered = filtered.filter(a => a.role === queryRole);
            if (queryDate && queryDate !== 'ALL') filtered = filtered.filter(a => a.date === queryDate);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'success',
            count: filtered.length,
            records: filtered
        }));
        return;
    }

    // =========================================================================
    // API: STUDENTS MANAGEMENT (RBAC ENFORCED)
    // =========================================================================
    if (pathname === '/api/students' && req.method === 'GET') {
        const userRole = req.headers['x-user-role'];
        // Backend Enforcement: Students cannot access the administrative roster
        if (userRole === 'STUDENT') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '403 Forbidden',
                message: 'Access Denied: Student role is not permitted to access student roster management API.'
            }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'success',
            institution: 'Jamia Ashrafia Lahore',
            message: 'Students directory authorized'
        }));
        return;
    }

    // =========================================================================
    // API: REPORTS SYSTEM (RBAC ENFORCED)
    // =========================================================================
    if (pathname.startsWith('/api/reports') && req.method === 'GET') {
        const userRole = req.headers['x-user-role'];
        if (userRole !== 'SUPER_ADMIN') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '403 Forbidden',
                message: 'Access Denied: Executive Reports require Super Admin authority.'
            }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'success',
            reportType: parsedUrl.searchParams.get('category') || 'ALL',
            generatedAt: new Date().toISOString()
        }));
        return;
    }

    // =========================================================================
    // API: USERS & ROLES MANAGEMENT (RBAC ENFORCED)
    // =========================================================================
    if (pathname === '/api/users' && req.method === 'GET') {
        const userRole = req.headers['x-user-role'];
        if (userRole !== 'SUPER_ADMIN') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '403 Forbidden',
                message: 'Access Denied: User account administration requires Super Admin authority.'
            }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'success',
            message: 'Users API verified'
        }));
        return;
    }

    if (pathname === '/api/roles' && req.method === 'GET') {
        const userRole = req.headers['x-user-role'];
        if (userRole !== 'SUPER_ADMIN') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '403 Forbidden',
                message: 'Access Denied: Roles management requires Super Admin authority.'
            }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'success',
            message: 'Roles API verified'
        }));
        return;
    }

    // API: Protected Admin Endpoints Middleware
    if (pathname.startsWith('/api/admin/')) {
        const userRole = req.headers['x-user-role'];
        if (userRole !== 'SUPER_ADMIN') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: '403 Forbidden',
                message: 'Access Denied: Administrative privileges required.'
            }));
            return;
        }
    }

    // API: Auth Logout
    if (pathname === '/api/auth/logout') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', message: 'Logged out successfully' }));
        return;
    }

    // =========================================================================
    // API: VIRTUAL CLASSROOM & WEBRTC SUITE (BACKEND RBAC SECURITY)
    // =========================================================================

    // User-to-Class Enrollment Registry for Backend Authorization Enforcement
    const backendStudentClassMap = {
        'u_student_1': 'cls_dawra_a',
        'u_student_2': 'cls_aaliyah',
        'u_student_3': 'cls_ifta',
        'u_student_5': 'cls_hifz_3',
        'u_student_6': 'cls_dawra_a',
        'u_student_7': 'cls_women_alim',
        'u_student_8': 'cls_dawra_b'
    };

    const backendTeacherClassMap = {
        'u_teacher_1': ['cls_dawra_a', 'cls_dawra_b', 'cls_hifz_3'],
        'u_teacher_2': ['cls_aaliyah', 'cls_ifta']
    };

    // In-memory virtual classes store on backend
    let backendVirtualClasses = [
        {
            id: "vc_101",
            meetingUuid: "ASH-ZOOM-982-114-889",
            title: "Live Dars: Sahih al-Bukhari - Kitab al-Iman & Bab Halat al-Qalb",
            urduTitle: "درسِ براہ راست: صحیح البخاری شریف - کتاب الایمان",
            hostTeacher: "Qari Arshad Ubaid (Sheikh-ul-Hadith)",
            hostId: "u_teacher_1",
            classId: "cls_dawra_a",
            className: "Dawra-e-Hadith (Alimiyyah Final) - Section A",
            courseId: "c_bukhari_1",
            courseName: "Sahih al-Bukhari (Jild 1)",
            roomName: "Hall Imam Bukhari (Virtual Studio 1)",
            scheduledStart: "2026-09-28 11:00 AM",
            durationMinutes: 75,
            passcode: "ASHRAFIA1947",
            status: "LIVE",
            isLive: true,
            activeParticipants: 42,
            recordingStatus: "RECORDING_ACTIVE"
        },
        {
            id: "vc_102",
            meetingUuid: "ASH-ZOOM-451-870-221",
            title: "Takhassus Fiqh: Contemporary Islamic Contracts & Crypto Rulings",
            urduTitle: "فقہی سیمینار: جدید مالیاتی معاملات اور ڈیجیٹل کرنسی کا شرعی حکم",
            hostTeacher: "Mufti Ahmadur Rahman (Darul Ifta)",
            hostId: "u_teacher_2",
            classId: "cls_ifta",
            className: "Takhassus fil-Ifta (1st Year)",
            courseId: "c_banking",
            courseName: "Islamic Banking & Modern Jurisprudence",
            roomName: "Darul Ifta Conference Studio",
            scheduledStart: "2026-09-28 11:15 AM",
            durationMinutes: 90,
            passcode: "IFTA2026",
            status: "LIVE",
            isLive: true,
            activeParticipants: 19,
            recordingStatus: "RECORDING_ACTIVE"
        },
        {
            id: "vc_103",
            meetingUuid: "ASH-ZOOM-773-902-114",
            title: "Al-Hidayah fi al-Fiqh: Kitab al-Buyu & Shuf'ah Discourse",
            urduTitle: "ہدایہ فقہ حنفی: کتاب البیوع و شفعہ کی تشریح",
            hostTeacher: "Mufti Ahmadur Rahman",
            hostId: "u_teacher_2",
            classId: "cls_aaliyah",
            className: "Aaliyah (7th Year)",
            courseId: "c_hidayah",
            courseName: "Al-Hidayah fi al-Fiqh",
            roomName: "Room 201 (Virtual Hall B)",
            scheduledStart: "2026-09-28 10:30 AM",
            durationMinutes: 60,
            passcode: "HIDAYAH7",
            status: "LIVE",
            isLive: true,
            activeParticipants: 35,
            recordingStatus: "RECORDING_PAUSED"
        },
        {
            id: "vc_104",
            meetingUuid: "ASH-ZOOM-612-884-390",
            title: "Jami' at-Tirmidhi: Abwab al-Buyu & Fiqh al-Hadith",
            urduTitle: "جامع الترمذی: ابواب البیوع وفقہ الحدیث",
            hostTeacher: "Qari Arshad Ubaid (Sheikh-ul-Hadith)",
            hostId: "u_teacher_1",
            classId: "cls_dawra_a",
            className: "Dawra-e-Hadith (Alimiyyah Final) - Section A",
            courseId: "c_tirmidhi",
            courseName: "Jami' at-Tirmidhi",
            roomName: "Hall Imam Bukhari",
            scheduledStart: "2026-09-28 04:30 PM",
            durationMinutes: 60,
            passcode: "TIRMIDHI26",
            status: "UPCOMING",
            isLive: false,
            activeParticipants: 0,
            recordingStatus: "SCHEDULED"
        },
        {
            id: "vc_105",
            meetingUuid: "ASH-ZOOM-230-551-789",
            title: "Tajweed & Sifat al-Huroof: Al-Muqaddimah al-Jazariyyah",
            urduTitle: "تجوید و صفات الحروف: شرح المقدمة الجزریة",
            hostTeacher: "Qari Arshad Ubaid",
            hostId: "u_teacher_1",
            classId: "cls_hifz_3",
            className: "Hifz-ul-Quran (Daur-e-Kamil)",
            courseId: "c_jazariyyah",
            courseName: "Al-Muqaddimah al-Jazariyyah",
            roomName: "Maktaba Tajweed Studio",
            scheduledStart: "2026-09-29 07:00 AM",
            durationMinutes: 45,
            passcode: "JAZARIYYAH",
            status: "UPCOMING",
            isLive: false,
            activeParticipants: 0,
            recordingStatus: "SCHEDULED"
        }
    ];

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

    // GET /api/virtual-class/sessions (Class-Filtered Session Retrieval)
    if (pathname === '/api/virtual-class/sessions' && req.method === 'GET') {
        const userRole = req.headers['x-user-role'] || 'STUDENT';
        const currentUserId = req.headers['x-user-id'];

        let accessible = backendVirtualClasses;
        if (userRole === 'STUDENT') {
            const studentClass = backendStudentClassMap[currentUserId] || req.headers['x-user-class'];
            accessible = backendVirtualClasses.filter(vc => vc.classId === studentClass);
        } else if (userRole === 'TEACHER') {
            const teacherClasses = backendTeacherClassMap[currentUserId] || [];
            accessible = backendVirtualClasses.filter(vc => vc.hostId === currentUserId || teacherClasses.includes(vc.classId));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'success',
            role: userRole,
            count: accessible.length,
            sessions: accessible
        }));
        return;
    }

    // POST /api/virtual-class/verify-access (Strict Backend Access Guard)
    if (pathname === '/api/virtual-class/verify-access' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const userRole = req.headers['x-user-role'] || data.role || 'STUDENT';
                const userId = req.headers['x-user-id'] || data.userId;
                const sessionId = data.sessionId;
                const classId = data.classId;

                const session = backendVirtualClasses.find(vc => vc.id === sessionId || vc.meetingUuid === sessionId);
                if (!session) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '404 Not Found', message: 'Classroom session does not exist.' }));
                    return;
                }

                // Super Admin & Academic Admin have full access
                if (userRole === 'SUPER_ADMIN' || userRole === 'ACADEMIC_ADMIN') {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'success', authorized: true, role: userRole, session }));
                    return;
                }

                // Teacher validation
                if (userRole === 'TEACHER') {
                    const assignedClasses = backendTeacherClassMap[userId] || [];
                    if (session.hostId === userId || assignedClasses.includes(session.classId)) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'success', authorized: true, isHost: true, session }));
                        return;
                    }
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: '403 Forbidden',
                        message: 'Access Denied: You are not assigned to instruct or moderate this classroom.'
                    }));
                    return;
                }

                // Student validation: Must strictly belong to the session classId
                const enrolledClass = backendStudentClassMap[userId] || data.userClassId;
                if (enrolledClass === session.classId) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'success', authorized: true, isHost: false, session }));
                    return;
                }

                // If not matching, strictly reject access!
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: '403 Forbidden',
                    message: 'Access Denied: Scholar is not enrolled in this academic class. Classroom access restricted.'
                }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid verification payload' }));
            }
        });
        return;
    }

    // POST /api/virtual-class/join (Attendance Auto-Record & Session Entrance)
    if (pathname === '/api/virtual-class/join' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const userId = req.headers['x-user-id'] || data.userId;
                const userRole = req.headers['x-user-role'] || data.role;
                const userName = data.userName || "Scholar";
                const sessionId = data.sessionId;
                const classId = data.classId;
                const className = data.className || "Class";

                const session = backendVirtualClasses.find(vc => vc.id === sessionId);
                if (session) {
                    session.activeParticipants = (session.activeParticipants || 0) + 1;
                }

                // Automatically record attendance into backend registry
                const today = new Date().toISOString().split('T')[0];
                const existingAtt = systemAttendance.find(a => a.userId === userId && a.date === today && a.session === 'VIRTUAL_CLASS');
                if (!existingAtt) {
                    systemAttendance.unshift({
                        id: 'att_vc_' + Date.now(),
                        userId: userId,
                        userName: userName,
                        role: userRole,
                        identifier: data.rollNo || data.email || userId,
                        classId: classId,
                        className: className,
                        date: today,
                        checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        checkOutTime: null,
                        status: 'PRESENT',
                        session: 'VIRTUAL_CLASS',
                        createdAt: new Date().toISOString()
                    });
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'success',
                    message: 'Successfully joined classroom. Virtual attendance recorded.',
                    attendanceLogged: true,
                    session
                }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid join payload' }));
            }
        });
        return;
    }

    // POST /api/virtual-class/retention (Super Admin Retention Configuration & Cleanup)
    if (pathname === '/api/virtual-class/retention' && req.method === 'POST') {
        const userRole = req.headers['x-user-role'];
        if (userRole !== 'SUPER_ADMIN') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '403 Forbidden', message: 'Retention management requires Super Admin authority.' }));
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

    // GET /api/virtual-class/recordings (Role & Class Protected Recordings)
    if (pathname === '/api/virtual-class/recordings' && req.method === 'GET') {
        const userRole = req.headers['x-user-role'] || 'STUDENT';
        const currentUserId = req.headers['x-user-id'];

        let accessible = backendVirtualClassRecordings;
        if (userRole === 'STUDENT') {
            const studentClass = backendStudentClassMap[currentUserId] || req.headers['x-user-class'];
            accessible = backendVirtualClassRecordings.filter(rec => rec.classId === studentClass);
        } else if (userRole === 'TEACHER') {
            const teacherClasses = backendTeacherClassMap[currentUserId] || [];
            accessible = backendVirtualClassRecordings.filter(rec => rec.teacherId === currentUserId || teacherClasses.includes(rec.classId));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'success',
            role: userRole,
            count: accessible.length,
            recordings: accessible,
            retentionSettings: backendRetentionSettings
        }));
        return;
    }

    // POST /api/virtual-class/cleanup (Automated Expired Recording Purge)
    if (pathname === '/api/virtual-class/cleanup' && req.method === 'POST') {
        const userRole = req.headers['x-user-role'];
        if (userRole !== 'SUPER_ADMIN') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '403 Forbidden', message: 'Storage cleanup requires Super Admin authority.' }));
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

    // POST /api/virtual-class/create (Schedule / Launch New Classroom)
    if (pathname === '/api/virtual-class/create' && req.method === 'POST') {
        const userRole = req.headers['x-user-role'];
        if (userRole === 'STUDENT') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '403 Forbidden', message: 'Only Teachers and Academic Administrators can schedule classrooms.' }));
            return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const newId = 'vc_' + Date.now();
                const newMeeting = {
                    id: newId,
                    meetingUuid: 'ASH-ZOOM-' + Math.floor(100 + Math.random() * 900) + '-' + Math.floor(100 + Math.random() * 900) + '-' + Math.floor(100 + Math.random() * 900),
                    title: data.title || 'Live Virtual Classroom',
                    urduTitle: data.urduTitle || 'آن لائن کلاس',
                    hostTeacher: data.hostTeacher || 'Sheikh / Ustad',
                    hostId: data.hostId || req.headers['x-user-id'] || 'u_teacher_1',
                    classId: data.classId,
                    className: data.className || 'Academic Class',
                    courseId: data.courseId || 'c_bukhari_1',
                    courseName: data.courseName || 'Islamic Course',
                    roomName: data.roomName || 'Virtual Studio',
                    scheduledStart: data.scheduledStart || new Date().toLocaleString(),
                    durationMinutes: Number(data.durationMinutes) || 60,
                    passcode: data.passcode || 'ASHRAFIA' + Math.floor(1000 + Math.random() * 9000),
                    status: data.isLive ? 'LIVE' : 'UPCOMING',
                    isLive: !!data.isLive,
                    activeParticipants: data.isLive ? 1 : 0,
                    recordingStatus: data.isLive ? 'RECORDING_ACTIVE' : 'SCHEDULED'
                };

                backendVirtualClasses.unshift(newMeeting);

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'success',
                    message: 'Virtual Classroom scheduled and synchronized successfully.',
                    session: newMeeting
                }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid session payload' }));
            }
        });
        return;
    }

    // POST /api/virtual-class/session-status (Live Status Updates)
    if (pathname === '/api/virtual-class/session-status' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const session = backendVirtualClasses.find(vc => vc.id === data.sessionId);
                if (!session) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Session not found' }));
                    return;
                }

                if (data.status) session.status = data.status;
                if (data.isLive !== undefined) session.isLive = data.isLive;
                if (data.recordingStatus) session.recordingStatus = data.recordingStatus;
                if (data.activeParticipants !== undefined) session.activeParticipants = data.activeParticipants;

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success', session }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid status payload' }));
            }
        });
        return;
    }

    // =========================================================================
    // ROUTING & STATIC FILE SERVING
    // =========================================================================

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
});

server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Jamia Ashrafia Lahore - Cloud LMS Portal Started`);
    console.log(` Default Landing URL: http://localhost:${PORT}/ (Login Required)`);
    console.log(` Institutional Heritage: Est. 1947 | Ferozepur Road`);
    console.log(`=======================================================`);
    db.testConnection();
});

