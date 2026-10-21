# Jamia Ashrafia Lahore - Cloud LMS API Specification (v1.0)

## 1. Overview
The Jamia Ashrafia Cloud LMS exposes a RESTful API for standard CRUD operations and a WebSocket gateway for real-time WebRTC signaling, in-meeting chat, and broadcast notifications.

- **Base URL:** `https://api.lms.jamiaashrafia.org/v1`
- **Authentication:** Bearer JWT in `Authorization` header (`Bearer <access_token>`)
- **Default Content-Type:** `application/json; charset=utf-8`

---

## 2. Authentication & Profile Endpoints

### `POST /auth/login`
Authenticates a scholar, faculty member, or administrator.
```json
// Request:
{
  "email": "talha.usmani@student.ashrafia.org",
  "password": "Password123#",
  "branch_code": "MAIN"
}

// Response: 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "def502005e83e...",
  "user": {
    "id": "u_student_1",
    "name": "Muhammad Talha Usmani",
    "role": "STUDENT",
    "roll_no": "ASH-2024-001",
    "branch": "Main Campus Ferozepur Road"
  }
}
```

---

## 3. Student Admissions Endpoints

### `POST /admissions/apply`
Public endpoint for prospective student application submission.
```json
// Request:
{
  "candidate_name": "Ahmad Raza Siddiqui",
  "father_name": "Maulana Muhammad Siddique",
  "cnic_bform": "35201-8934521-3",
  "phone": "+92 300 4589211",
  "email": "ahmad.raza@gmail.com",
  "program_id": "p1",
  "branch_id": "b1",
  "hostel_required": true,
  "hafiz_status": true,
  "previous_madrasa": "Jamia Farooqia Karachi"
}

// Response: 201 Created
{
  "application_no": "ASH-ADM-2024-089",
  "status": "APPLIED",
  "message": "Application received. You will receive an interview SMS shortly."
}
```

### `PATCH /admissions/{id}/approve`
**Role Required:** `SUPER_ADMIN` or `ACADEMIC_ADMIN`
Assigns roll number and promotes applicant to enrolled student.
```json
// Response: 200 OK
{
  "id": "adm_101",
  "status": "APPROVED",
  "allotted_roll_no": "ASH-2024-045",
  "interview_score": 92.5
}
```

---

## 4. Assignments & Online Checking Endpoints

### `POST /assignments`
**Role Required:** `TEACHER`
Creates a new research homework or hadith takhrij assignment.

### `POST /assignments/{id}/submissions`
**Role Required:** `STUDENT`
Submits student work with text and attachment.

### `PATCH /assignments/submissions/{id}/grade`
**Role Required:** `TEACHER`
Evaluates submission, records marks, and writes scholarly feedback.
```json
// Request:
{
  "marks_obtained": 48.5,
  "wifaq_grade": "MUMTAZ",
  "feedback": "Mumtaz! Meticulous sanad takhrij with complete Fath al-Bari citations."
}
```

---

## 5. Fees & Zakat Donations Endpoints

### `GET /fees/challans/{roll_no}`
Retrieves active fee challans for a student.

### `POST /donations/contribute`
Records online Zakat or Sadaqah contribution and generates a verified receipt.
```json
// Request:
{
  "donor_name": "Sheikh Abdul Aziz Al-Ghamdi",
  "amount": 500000,
  "currency": "PKR",
  "donation_type": "ZAKAT",
  "purpose": "Kafalat-e-Talib-e-Ilm",
  "is_anonymous": false
}

// Response: 201 Created
{
  "receipt_no": "REC-ZKT-1446-041",
  "status": "CONFIRMED",
  "receipt_pdf_url": "https://storage.jamiaashrafia.org/receipts/REC-ZKT-1446-041.pdf"
}
```

---

## 6. Virtual Classroom (WebRTC SFU) Signaling

### WebSocket URL: `wss://live.lms.jamiaashrafia.org/rooms/{meeting_uuid}`
- **Join Room:** `{ "type": "join", "token": "...", "role": "host"|"participant" }`
- **Signal Offer / Answer / ICE Candidates:** WebRTC peer exchange.
- **Whiteboard Stroke Broadcast:** `{ "type": "wb_draw", "x": 120, "y": 80, "color": "#124855" }`
- **Host Mute Decree:** `{ "type": "host_mute_all" }`

---

## 7. Institution Setup, Recordings & Data Clean-up (implemented in `server/master-data.js`, `server/sample-data.js`)

No institutional records (teachers, students, classes, online classes, campuses, programmes) are written in the
browser code. They live in MySQL and are managed by the Super Admin in the portal (**Institution Setup**,
Students, Teachers, Classes & Courses, Online Classes). Every change below is checked on the server.

| Method & path | Who may call it | Notes |
|---|---|---|
| `GET /api/branches`, `/api/departments`, `/api/programs`, `/api/sessions` | Everyone (public admission form) | Lists |
| `POST /api/<kind>` · `PUT /api/<kind>/{id}` · `DELETE /api/<kind>/{id}` | `settings.master_data` | `<kind>` = branches, departments, programs, sessions. Codes are unique (409). A record still in use (students, classes, applications, programmes, the main campus, the current session) cannot be deleted (409 with what uses it). |
| `GET /api/settings/institution` | Everyone | Name, contacts, current leadership, main campus, fee bank account |
| `POST /api/settings/institution` | `settings.master_data` | |
| `GET /api/settings/recordings` | Signed in | Retention days, quota, nightly clean-up switch, storage used (computed from the recordings) |
| `POST /api/settings/recordings` | `settings.recordings` | Retention: 0 (permanent), 30, 60, 90, 180 or 365 days |
| `POST /api/virtual-class/cleanup` | `settings.recordings` | Removes recordings older than the retention period (not those marked "Keep permanently") and their uploaded files. Also runs daily when the nightly clean-up is on. |
| `DELETE /api/admissions/{id}` | `admissions.delete` | Also removes the application's "New Student Admission" notice. The student account of an enrolled applicant stays. |
| `GET /api/admin/sample-data` · `POST /api/admin/sample-data/remove` | Super Admin only (not while previewing a role) | Reviews and removes the demonstration records that portal versions up to October 2026 copied into the database, applications left by automated tests, and (unticked by default) records that only point at those. Only offered records can be removed; the Super Admin account is never offered. |

Application numbers are `ASH-ADM-<year>-<n>`, numbered per year from the highest existing number, so a
deleted application never causes a duplicate number. Applications must name an existing programme and campus.
