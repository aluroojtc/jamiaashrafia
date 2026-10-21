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
| **Institution Setup (campuses, programmes, sessions, profile)** | Full | - | - | - | - |
| **Delete students, teachers, admission applications** | Full | - | - | - | - |
| **Sample data clean-up** | Full (Super Admin only) | - | - | - | - |

The live permissions are defined in `server/permissions.js` and assigned per role on the Roles & Permissions page;
the table shows the defaults. `settings.master_data` and `admissions.delete` are held only by the Super Admin
until given to another role.

### 2.1 Three separate authorization domains

| Domain | Who | Managed in | Data scope | Can hold |
|---|---|---|---|---|
| **System user roles** (`roles.domain = SYSTEM`) | Office staff: Admin, Finance Officer, custom roles | Users & Roles → Roles & Permissions | Chosen per role | Any permission the editor holds |
| **Student types** (`STUDENT`) | Student accounts | Students Management → Student Types & Permissions | Own records (fixed) | Student portal permissions only (`DOMAIN_CEILING.STUDENT`) |
| **Teacher types** (`TEACHER`) | Teacher accounts | Teachers & Portals → Teacher Types & Permissions | Classes they teach (fixed) | Teacher portal permissions only (`DOMAIN_CEILING.TEACHER`) |

- A student or teacher account keeps `role: STUDENT` / `role: TEACHER` on its record: that is the **account type**.
  Which type (permission group) of its domain it belongs to is its primary `user_roles` row; with none, the account
  is in the domain's **default type**, the built-in Student / Teacher role. Existing accounts therefore kept exactly
  their access when the domains were introduced (migration `database/migration_2026_10_21_permission_groups.sql`).
- **Effective permissions** of a student or teacher = type permissions + individual *allow* − individual *deny*
  (`user_permission_overrides`), always cut down to the domain ceiling. A deny also removes what depends on the
  permission. A teacher may additionally hold **system** roles (e.g. Librarian) given by someone with
  `users.assign_roles`; a student never holds additional roles.
- **Isolation rules, enforced for everyone including the Super Admin** (`accountStructureAllowed` in
  `server/access-policy.js`): a system user's role must be a system role; a type is never an account role or an
  additional role; an account never moves between system user, teacher and student. Student and Teacher no longer
  appear in the system user role lists.
- **Who may do what:** only the Super Admin creates, edits and deletes types and sets individual overrides.
  Choosing or changing a person's type needs the Super Admin, or `students.assign_group` / `teachers.assign_group`
  (held by nobody else by default; the Super Admin may give them to a role). The default type cannot be deleted;
  another type can be deleted once nobody belongs to it. Types are never switched off.
- The portals hide what a person's type does not allow (submitting work, sitting online papers, uploading payment
  proof, joining online classes, recordings, daily check-in), but the server refuses those actions on its own.
- Every change is audited: `group.create|update|delete`, `user.group_change`, `user.permissions_change`.

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
