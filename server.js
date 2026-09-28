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
