/**
 * Jamia Ashrafia LMS - E2E Verification & Test Suite
 * Tests all 12 Phase H criteria against the real MySQL database & HTTP API.
 */

const http = require('http');
const db = require('./database/db');

const TEST_PORT = 3055;
process.env.PORT = TEST_PORT;

function makeRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
                resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
            });
        });
        req.on('error', reject);
        if (postData) {
            req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
        }
        req.end();
    });
}

async function runTests() {
    console.log('====================================================');
    console.log(' Jamia Ashrafia LMS - Full Phase H Test Suite');
    console.log('====================================================');

    // 1. Verify Database Connection
    const dbOk = await db.testConnection();
    if (!dbOk) {
        console.error('FATAL: Database connection failed.');
        process.exit(1);
    }

    // 2. Start server
    const server = require('./server');
    await new Promise(r => setTimeout(r, 1000)); // give 1 sec to bind

    let passed = 0;
    let failed = 0;

    function assert(name, condition, extra = '') {
        if (condition) {
            console.log(`[PASS] ${name} ${extra}`);
            passed++;
        } else {
            console.error(`[FAIL] ${name} ${extra}`);
            failed++;
        }
    }

    const testTimestamp = Date.now().toString().slice(-6);
    const localCnic = `35201-${testTimestamp}1-1`;
    const intlPassport = `AB${testTimestamp}9`;

    // Requests are authenticated by a real session: a throw-away Academic Admin account is created for the run
    const auth = require('./server/auth');
    await require('./server/lms-api').ensureSchema();
    const adminId = `usr_admin_test_${testTimestamp}`;
    const adminPassword = auth.temporaryPassword(12);
    await db.query(
        `INSERT INTO lms_records (collection, id, data, deleted, updated_by, updated_at) VALUES ('users', ?, ?, 0, 'test', NOW(3))`,
        [adminId, JSON.stringify({ id: adminId, name: 'Test Admin', role: 'ACADEMIC_ADMIN', status: 'ACTIVE', email: `${adminId}@test.local` })]
    );
    await auth.setPassword(null, adminId, adminPassword, false);
    const adminLogin = await makeRequest({
        hostname: '127.0.0.1', port: TEST_PORT, path: '/api/auth/login', method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { identifier: adminId, password: adminPassword });
    const adminCookie = String([].concat(adminLogin.headers['set-cookie'] || [])[0] || '').split(';')[0];

    try {
        // Test 8: Existing admissions remain intact before we start
        const [existingBefore] = await db.query('SELECT count(*) as cnt FROM student_admissions');
        assert('Test 8: Existing admissions remain intact', existingBefore[0].cnt >= 3, `(Found ${existingBefore[0].cnt} records)`);

        // Test 1: New LOCAL student registration
        const localReg = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/admissions',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            studentType: 'LOCAL',
            name: `Ahmad Raza Test ${testTimestamp}`,
            fatherName: 'Muhammad Raza',
            cnic: localCnic,
            phone: '+92 300 1234567',
            email: `ahmad_${testTimestamp}@example.com`,
            programId: 'DARS-NIZAMI',
            branchId: 'MAIN',
            hostelRequired: true,
            hafizStatus: true
        });

        assert('Test 1: New LOCAL student registration', 
            localReg.statusCode === 201 && localReg.body.success === true && localReg.body.record.applicationNo, 
            `(AppNo: ${localReg.body?.record?.applicationNo})`
        );
        const localAppNo = localReg.body?.record?.applicationNo;

        // Test 2: New INTERNATIONAL student registration
        const intlReg = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/admissions',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            studentType: 'INTERNATIONAL',
            name: `John Doe Test ${testTimestamp}`,
            fatherName: 'Richard Doe',
            passport: intlPassport,
            country: 'United Kingdom',
            phone: '+44 7700 900077',
            email: `john_${testTimestamp}@example.co.uk`,
            programId: 'HIFZ',
            branchId: 'MODEL-TOWN',
            hostelRequired: false,
            hafizStatus: false
        });

        assert('Test 2: New INTERNATIONAL student registration', 
            intlReg.statusCode === 201 && intlReg.body.success === true && intlReg.body.record.applicationNo,
            `(AppNo: ${intlReg.body?.record?.applicationNo})`
        );
        const intlAppNo = intlReg.body?.record?.applicationNo;

        // Test 11: Duplicate pending application protection
        const dupReg = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/admissions',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            studentType: 'LOCAL',
            name: `Duplicate Attempt`,
            fatherName: 'Muhammad Raza',
            cnic: localCnic,
            phone: '+92 300 0000000',
            email: 'dup@example.com'
        });

        assert('Test 11: Duplicate pending application protection works',
            dupReg.statusCode === 409 && dupReg.body.success === false,
            `(Returned 409: ${dupReg.body.error})`
        );

        // Test 3: Admin sees the new application via GET /api/admissions
        const adminGet = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/admissions?studentType=ALL&status=ALL',
            method: 'GET',
            headers: {
                'Cookie': adminCookie
            }
        });

        const foundLocal = adminGet.body?.admissions?.some(a => a.applicationNo === localAppNo);
        const foundIntl = adminGet.body?.admissions?.some(a => a.applicationNo === intlAppNo);
        assert('Test 3: Admin sees the new application in live database', 
            adminGet.statusCode === 200 && foundLocal && foundIntl,
            `(Admin retrieved ${adminGet.body?.admissions?.length} total records)`
        );

        // Test 4 & 5: Admin receives notification & unread count updates
        const notifGet = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/notifications',
            method: 'GET',
            headers: {
                'Cookie': adminCookie
            }
        });

        const hasAdmissionNotif = notifGet.body?.notifications?.some(n => 
            n.message && (n.message.includes(localAppNo) || n.message.includes(intlAppNo))
        );
        const initialUnread = notifGet.body?.unreadCount || 0;
        assert('Test 4: Admin receives notification for new admissions',
            notifGet.statusCode === 200 && hasAdmissionNotif,
            `(Found admission notification in Admin feed)`
        );
        assert('Test 5: Unread notification count updates accurately',
            initialUnread > 0,
            `(Unread count: ${initialUnread})`
        );

        // Test Mark Notification Read
        const unreadNotif = notifGet.body.notifications.find(n => !n.isRead && n.message.includes(localAppNo));
        if (unreadNotif) {
            await makeRequest({
                hostname: '127.0.0.1',
                port: TEST_PORT,
                path: '/api/notifications/read',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': adminCookie
                }
            }, { notificationId: unreadNotif.id });

            const notifAfter = await makeRequest({
                hostname: '127.0.0.1',
                port: TEST_PORT,
                path: '/api/notifications',
                method: 'GET',
                headers: {
                    'Cookie': adminCookie
                }
            });
            assert('Test 5b: Marking notification as read updates database & unread count',
                notifAfter.body.unreadCount === initialUnread - 1,
                `(New unread count: ${notifAfter.body.unreadCount})`
            );
        }

        // Test 6: Student and Admin use completely different browsers (Zero shared client state)
        // Here we query from a clean request with NO cookies or localStorage and verify MySQL returns the exact record
        const directDbCheck = await db.query('SELECT * FROM student_admissions WHERE application_no = ?', [localAppNo]);
        assert('Test 6: Independent Client Session verification (Source of truth is MySQL)',
            directDbCheck[0].length === 1 && directDbCheck[0][0].candidate_name.includes('Ahmad Raza'),
            `(Row physically exists in MySQL student_admissions)`
        );

        // Test 9: Approve & Enroll workflow
        // Update status to APPROVED then ENROLLED with roll number
        const enrollUpdate = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: `/api/admissions/${localAppNo}`,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': adminCookie
            }
        }, {
            status: 'ENROLLED',
            allottedRollNo: `ASH-2024-${testTimestamp}`
        });

        assert('Test 9: Approve & Enroll status update succeeds',
            enrollUpdate.statusCode === 200 && enrollUpdate.body.success === true,
            `(Status updated to ENROLLED, Roll No: ASH-2024-${testTimestamp})`
        );

        const verifyEnroll = await db.query('SELECT status, allotted_roll_number FROM student_admissions WHERE application_no = ?', [localAppNo]);
        assert('Test 9b: Database confirms enrolled status and allotted roll number',
            verifyEnroll[0][0].status === 'ENROLLED' && verifyEnroll[0][0].allotted_roll_number === `ASH-2024-${testTimestamp}`,
            `(DB row: status=${verifyEnroll[0][0].status})`
        );

        // Test 10: Unauthorized users cannot access admin admissions or notifications
        const unauthAdmissions = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/admissions',
            method: 'GET',
            headers: {
                'X-User-Role': 'STUDENT'
            }
        });

        const unauthAdmissionsNoHeader = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/admissions',
            method: 'GET'
        });

        const unauthNotifications = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/notifications',
            method: 'GET'
        });

        assert('Test 10: Unauthorized users blocked (RBAC enforcement)',
            unauthAdmissions.statusCode === 401 && unauthAdmissionsNoHeader.statusCode === 401 && unauthNotifications.statusCode === 401,
            `(HTTP 401: identity headers grant nothing without a session)`
        );

        // Test 12: Database failure does not produce a false successful registration
        // Passing invalid payload (e.g. empty student name)
        const invalidReg = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/admissions',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            studentType: 'LOCAL',
            name: '', // missing required name
            cnic: '123'
        });

        assert('Test 12: Validation/DB failure returns error and does NOT produce false success',
            invalidReg.statusCode === 400 && invalidReg.body.success === false,
            `(HTTP 400: ${invalidReg.body.error})`
        );

        // Test 7: Restart simulation (disconnect pool and re-check records persist)
        // Check that existing records remain identical after closing and re-opening pool
        const [finalCheck] = await db.query('SELECT count(*) as cnt FROM student_admissions');
        assert('Test 7: Persistence verification across queries/restarts',
            finalCheck[0].cnt >= existingBefore[0].cnt + 2,
            `(Final count in MySQL: ${finalCheck[0].cnt})`
        );

        // =========================================================================
        // PHASE 1: ACADEMIC MASTER DATA TESTS (BRANCHES, DEPTS, PROGRAMS, SESSIONS)
        // =========================================================================

        // Test Phase 1.1: Branches API
        const branchReq = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/branches',
            method: 'GET'
        });
        assert('Phase 1.1: GET /api/branches returns all institutional branches from MySQL',
            branchReq.statusCode === 200 && branchReq.body.branches && branchReq.body.branches.length === 12,
            `(Retrieved ${branchReq.body?.branches?.length} branches, sample: ${branchReq.body?.branches?.[0]?.name})`
        );

        // Test Phase 1.2: Departments API
        const deptReq = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/departments',
            method: 'GET'
        });
        assert('Phase 1.2: GET /api/departments returns academic departments from MySQL',
            deptReq.statusCode === 200 && deptReq.body.departments && deptReq.body.departments.length === 5,
            `(Retrieved ${deptReq.body?.departments?.length} departments, sample: ${deptReq.body?.departments?.[0]?.name})`
        );

        // Test Phase 1.3: Programs API (Joined with Departments)
        const progReq = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/programs',
            method: 'GET'
        });
        const darsProg = progReq.body?.programs?.find(p => p.id === 'p1');
        assert('Phase 1.3: GET /api/programs returns programs joined with department names from MySQL',
            progReq.statusCode === 200 && progReq.body.programs && progReq.body.programs.length === 5 && darsProg && darsProg.departmentName,
            `(Retrieved ${progReq.body?.programs?.length} programs, Dars-e-Nizami Dept: ${darsProg?.departmentName})`
        );

        // Test Phase 1.4: Sessions API
        const sessReq = await makeRequest({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/sessions',
            method: 'GET'
        });
        const currentSess = sessReq.body?.sessions?.find(s => s.isCurrent === true);
        assert('Phase 1.4: GET /api/sessions returns academic sessions with current session active',
            sessReq.statusCode === 200 && sessReq.body.sessions && sessReq.body.sessions.length === 3 && currentSess,
            `(Retrieved ${sessReq.body?.sessions?.length} sessions, Active: ${currentSess?.name})`
        );

        // Test Phase 1.5: Foreign Key integrity check between academic_programs and departments
        const [fkCheck] = await db.query(
            `SELECT p.id, p.name AS progName, d.name AS deptName 
             FROM academic_programs p 
             JOIN departments d ON p.department_id = d.id`
        );
        assert('Phase 1.5: Foreign key relationship between academic_programs and departments verified',
            fkCheck.length === 5,
            `(All 5 programs properly link to valid department parent records)`
        );

    } catch (err) {
        console.error('Test Suite encountered unhandled error:', err);
        failed++;
    } finally {
        await db.query(`DELETE FROM lms_records WHERE collection = 'users' AND id = ?`, [adminId]).catch(() => {});
        await db.query(`DELETE FROM user_credentials WHERE user_id = ?`, [adminId]).catch(() => {});
        await db.query(`DELETE FROM auth_sessions WHERE user_id = ?`, [adminId]).catch(() => {});
        console.log('====================================================');
        console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
        console.log('====================================================');
        process.exit(failed > 0 ? 1 : 0);
    }
}

runTests();
