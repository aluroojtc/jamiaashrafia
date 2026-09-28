# Jamia Ashrafia Lahore - Security & Role-Based Access Control (RBAC) Specification

## 1. Security Philosophy
The Jamia Ashrafia Cloud LMS handles sensitive student records, financial contributions (Zakat and Sadaqat), academic credentials (Asanid and degrees), and confidential examination data. Security is built as a zero-trust model across all application layers.

---

## 2. Role-Based Access Control (RBAC) Matrix

| Module / Action | Super Admin (Mohtamim) | Academic Admin (Nazim-e-Taleemat) | Teacher (Sheikh / Ustad) | Student (Talib-e-Ilm) | Accountant (Maliyat / Donor) |
|---|:---:|:---:|:---:|:---:|:---:|
| **Admissions Approval & Roll No.** | Full | Full | Read-Only | Submit Application | - |
| **Class & Teacher Allotment** | Full | Full | View Assigned | View Enrolled | - |
| **Curriculum & Courses** | Full | Full | View Syllabus | View Syllabus | - |
| **Attendance Taking** | Audit | Full | Mark Assigned Class | View Own | - |
| **Assignments Creation** | Audit | Full | Create / Edit Own | - | - |
| **Assignment Submission** | - | - | View Submissions | Submit Own Files | - |
| **Assignment Grading / Feedback** | Audit | Audit | Grade & Feedback | View Grade | - |
| **Exam Creation & Paper Upload** | Full | Full | Submit Questions | - | - |
| **Exam Marking & Wifaq Grades** | Full | Full | Grade Assigned Kitab | View Own Results | - |
| **Fee Challan Generation** | Full | View | - | Download Own | Full |
| **Donations Ledger & Zakat Audit** | Full | - | - | Make Donation | Full |
| **Library Catalog & Management** | Full | View | Borrow Books | Search & Reserve | View |
| **Live Virtual Classroom Host** | Full | Full | Host & Moderate | Attend as Participant| - |
| **Broadcast Announcements** | Full | Full | To Assigned Classes| - | - |
| **System Audit Logs & Security** | Full | - | - | - | - |

---

## 3. Authentication & Authorization Architecture
1. **Cryptographic Storage:** Passwords hashed using `Argon2id` or `bcrypt` with salt rounds >= 12.
2. **Session Security:** Short-lived JWT access tokens (15-minute validity) coupled with HTTP-only, SameSite=Strict secure refresh tokens stored in Redis.
3. **Multi-Factor Authentication (MFA):** Optional TOTP (Google Authenticator) for Asatizah and mandatory for Mohtamim, Nazim-e-Taleemat, and Maliyat personnel.
4. **Rate Limiting:** Sliding-window rate limiter (e.g. 5 failed login attempts triggers 15-minute lock on IP/username).
5. **Role Spoofing Prevention:** Context-bound claims in JWT payload verified on every server-side request; client role switcher in demo/sandbox strictly adheres to simulated token claims.

---

## 4. OWASP Top 10 Safeguards
- **Injection Protection:** Parameterized queries and ORM prevents SQL injection; DOMPurify sanitizes rich-text assignment feedback and Arabic descriptions.
- **Cross-Site Scripting (XSS):** Strict Content-Security-Policy (CSP) headers; context-aware output encoding.
- **Sensitive Data Exposure:** TLS 1.3 enforced for all transport; Zakat donor privacy modes (Option for completely anonymous Sadaqah with blinded ledger entries).
- **Broken Object Level Authorization (BOLA):** Strict checks that a student can only view/download their own fee challans and exam answer sheets.
- **Secure File Uploads:** Uploaded homework and scanned papers verified via MIME magic bytes (PDF, JPEG, PNG only), renamed to UUIDs, and served via signed S3 URLs.
