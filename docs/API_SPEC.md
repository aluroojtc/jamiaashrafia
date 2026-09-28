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
- **Whiteboard Stroke Broadcast:** `{ "type": "wb_draw", "x": 120, "y": 80, "color": "#064e3b" }`
- **Host Mute Decree:** `{ "type": "host_mute_all" }`
