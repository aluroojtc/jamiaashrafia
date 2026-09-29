/**
 * Jamia Ashrafia Lahore - Cloud LMS Dev & Production Server
 * Native Node.js HTTP Server with full MIME handling, RBAC API endpoints, and Security Middleware
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

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
});
