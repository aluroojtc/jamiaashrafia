-- ==============================================================================
-- JAMIA ASHRAFIA LAHORE - CLOUD LEARNING MANAGEMENT SYSTEM (LMS)
-- Comprehensive Enterprise Relational Database Schema (PostgreSQL / MySQL Compatible)
-- Institutional Origin: Est. 1947 by Mufti Muhammad Hassan Amritsari
-- Main Campus: Ferozepur Road & Canal Road, Lahore, Pakistan
-- ==============================================================================

-- 1. EXTENSIONS (PostgreSQL compatible)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
CREATE TYPE user_role AS ENUM (
    'SUPER_ADMIN',        -- Hazrat Mohtamim / Executive Shura
    'ACADEMIC_ADMIN',     -- Nazim-e-Taleemat
    'TEACHER',            -- Sheikh-ul-Hadith / Ustad / Muallim
    'STUDENT',            -- Talib-e-Ilm
    'ACCOUNTANT',         -- Nazim-e-Maliyat / Finance Officer
    'LIBRARIAN',          -- Nazim-e-Kutub Khana
    'DONOR'               -- Muhsin / Donor
);

CREATE TYPE admission_status AS ENUM (
    'APPLIED',
    'UNDER_REVIEW',
    'INTERVIEW_SCHEDULED',
    'APPROVED',
    'REJECTED',
    'ENROLLED'
);

CREATE TYPE payment_status AS ENUM (
    'PENDING',
    'PAID',
    'OVERDUE',
    'WAIVED_SCHOLARSHIP',
    'REFUNDED'
);

CREATE TYPE donation_type AS ENUM (
    'ZAKAT',
    'SADAQAH',
    'GENERAL_FUND',
    'KAFALAT_E_TALIB_E_ILM',
    'CONSTRUCTION_EXPANSION',
    'HOSPITAL_FREE_MEDICINE'
);

CREATE TYPE exam_type AS ENUM (
    'CLASS_TEST',
    'SHASHMAHI_MIDTERM',
    'SALANA_FINAL',
    'WIFAQ_MOCK'
);

CREATE TYPE wifaq_grade AS ENUM (
    'MUMTAZ',          -- Excellent (>=80%)
    'JAYYID_JIDDAN',   -- Very Good (70-79%)
    'JAYYID',          -- Good (60-69%)
    'MAQBOOL',         -- Pass (40-59%)
    'RASIB'            -- Fail (<40%)
);

-- 3. CORE INSTITUTIONAL ENTITIES: BRANCHES
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    urdu_name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) DEFAULT 'Lahore',
    is_womens_branch BOOLEAN DEFAULT FALSE,
    contact_phone VARCHAR(50),
    contact_email VARCHAR(100),
    established_year INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. ROLES & PERMISSIONS (RBAC)
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    module VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
    role user_role NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role, permission_id)
);

-- 5. USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    role user_role NOT NULL DEFAULT 'STUDENT',
    registration_no VARCHAR(50) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    urdu_name VARCHAR(255),
    father_name VARCHAR(255),
    cnic_bform VARCHAR(30) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    gender VARCHAR(10) DEFAULT 'MALE',
    date_of_birth DATE,
    blood_group VARCHAR(10),
    profile_image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TEACHER PROFILES
CREATE TABLE teacher_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    specialization VARCHAR(255),               -- e.g. Hadith, Fiqh, Usul, Qira'at
    highest_degree VARCHAR(255),              -- e.g. Shahadat-ul-Alimiyyah, Takhassus
    sanad_institution VARCHAR(255),           -- e.g. Jamia Ashrafia Lahore, Darul Uloom Deoband
    wifaq_teacher_id VARCHAR(100),
    biography TEXT,
    joining_date DATE,
    is_hod BOOLEAN DEFAULT FALSE
);

-- 7. ACADEMIC DEPARTMENTS & PROGRAMS
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    urdu_name VARCHAR(255) NOT NULL,
    description TEXT,
    hod_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE academic_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    urdu_name VARCHAR(255) NOT NULL,
    duration_years INT NOT NULL,
    wifaq_equivalence VARCHAR(255),            -- e.g. Equivalent to M.A Islamic Studies
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. COURSES / KITABS
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES academic_programs(id) ON DELETE CASCADE,
    code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    urdu_title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    level_year INT NOT NULL,                   -- Year 1 to 8 (Dawra-e-Hadith)
    credit_hours INT DEFAULT 4,
    syllabus_summary TEXT,
    recommended_kitab VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. ACADEMIC SESSIONS & CLASSES
CREATE TABLE academic_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,               -- e.g. 1445-1446 AH / 2024-2025 CE
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT FALSE
);

CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES academic_programs(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,               -- e.g. Dawra-e-Hadith (Class of Bukhari)
    section VARCHAR(20) DEFAULT 'A',
    room_number VARCHAR(50),
    max_capacity INT DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. TEACHER-CLASS ALLOCATIONS
CREATE TABLE teacher_class_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(teacher_id, class_id, course_id)
);

-- 11. STUDENT ENROLLMENTS
CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    roll_number VARCHAR(50) NOT NULL,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    UNIQUE(class_id, roll_number),
    UNIQUE(class_id, student_id)
);

-- 12. STUDENT ADMISSIONS
CREATE TABLE student_admissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_no VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID NOT NULL REFERENCES branches(id),
    program_id UUID NOT NULL REFERENCES academic_programs(id),
    candidate_name VARCHAR(255) NOT NULL,
    father_name VARCHAR(255) NOT NULL,
    guardian_contact VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    cnic_bform VARCHAR(30) NOT NULL,
    date_of_birth DATE NOT NULL,
    previous_madrasa VARCHAR(255),
    hafiz_status BOOLEAN DEFAULT FALSE,
    hostel_required BOOLEAN DEFAULT FALSE,
    status admission_status DEFAULT 'APPLIED',
    interview_date TIMESTAMP WITH TIME ZONE,
    interview_score NUMERIC(5,2),
    reviewer_notes TEXT,
    allotted_roll_number VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. TIMETABLES & SCHEDULES
CREATE TABLE timetables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL,         -- Monday to Saturday (Friday off / Dars)
    period_number INT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room_hall VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. ASSIGNMENTS & HOMEWORK
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    max_marks INT DEFAULT 100,
    file_attachment_url TEXT,
    rubric_guidelines TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assignment_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submission_text TEXT,
    file_attachment_url TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    marks_obtained NUMERIC(5,2),
    teacher_feedback TEXT,
    is_graded BOOLEAN DEFAULT FALSE,
    graded_at TIMESTAMP WITH TIME ZONE,
    graded_by UUID REFERENCES users(id),
    UNIQUE(assignment_id, student_id)
);

-- 15. EXAMINATIONS & WIFAQ RESULTS
CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    exam_type exam_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    exam_date DATE NOT NULL,
    start_time TIME NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 180,
    total_marks INT NOT NULL DEFAULT 100,
    passing_marks INT NOT NULL DEFAULT 40,
    question_paper_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE exam_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answer_sheet_text TEXT,
    scanned_paper_url TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    marks_obtained NUMERIC(5,2),
    wifaq_grade wifaq_grade,
    examiner_remarks TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id),
    UNIQUE(exam_id, student_id)
);

-- 16. FEE STRUCTURE & CHALLANS
CREATE TABLE fee_structures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES academic_programs(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    admission_fee NUMERIC(10,2) DEFAULT 0.00,
    tuition_monthly NUMERIC(10,2) DEFAULT 0.00,
    hostel_mess_monthly NUMERIC(10,2) DEFAULT 0.00,
    examination_fee NUMERIC(10,2) DEFAULT 0.00,
    library_deposit NUMERIC(10,2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'PKR'
);

CREATE TABLE fee_challans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challan_number VARCHAR(50) UNIQUE NOT NULL,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id),
    billing_month VARCHAR(50) NOT NULL,
    due_date DATE NOT NULL,
    amount_tuition NUMERIC(10,2) DEFAULT 0.00,
    amount_hostel NUMERIC(10,2) DEFAULT 0.00,
    amount_misc NUMERIC(10,2) DEFAULT 0.00,
    scholarship_discount NUMERIC(10,2) DEFAULT 0.00,
    total_payable NUMERIC(10,2) NOT NULL,
    status payment_status DEFAULT 'PENDING',
    payment_method VARCHAR(50),
    paid_at TIMESTAMP WITH TIME ZONE,
    bank_reference VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. DONATIONS & SADAQAT / ZAKAT MANAGEMENT
CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    donor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    donor_name VARCHAR(255) NOT NULL,
    donor_phone VARCHAR(50),
    donor_email VARCHAR(255),
    is_anonymous BOOLEAN DEFAULT FALSE,
    donation_type donation_type NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'PKR',
    designated_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    student_sponsored_id UUID REFERENCES users(id) ON DELETE SET NULL,
    payment_channel VARCHAR(50) NOT NULL,      -- Online Gateway, Bank Transfer, Cash Desk
    transaction_ref VARCHAR(100),
    official_receipt_url TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. LIBRARY MANAGEMENT (MAKTABA ASHRAFIA)
CREATE TABLE library_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    urdu_name VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE library_books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES library_categories(id) ON DELETE CASCADE,
    accession_number VARCHAR(50) UNIQUE NOT NULL,
    isbn VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    arabic_urdu_title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    publisher VARCHAR(255) DEFAULT 'Maktaba Ashrafia Lahore',
    publication_year INT,
    rack_location VARCHAR(50),
    total_copies INT DEFAULT 1,
    available_copies INT DEFAULT 1,
    is_digital_available BOOLEAN DEFAULT FALSE,
    pdf_attachment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE library_loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    borrow_date DATE DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    returned_date DATE,
    fine_amount NUMERIC(8,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'ISSUED'        -- ISSUED, RETURNED, OVERDUE, LOST
);

-- 19. ZOOM-LIKE VIRTUAL CLASSROOM SESSIONS
CREATE TABLE virtual_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_uuid VARCHAR(100) UNIQUE NOT NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    host_teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic VARCHAR(255) NOT NULL,
    passcode VARCHAR(50) NOT NULL,
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INT DEFAULT 60,
    is_live BOOLEAN DEFAULT FALSE,
    recording_url TEXT,
    whiteboard_snapshot_url TEXT,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. NOTIFICATIONS & BROADCAST ANNOUNCEMENTS
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_role user_role,                     -- If null, sent to specific user
    target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'ACADEMIC',   -- ACADEMIC, FEE, EXAM, LIVE_CLASS, GENERAL
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 21. AUDIT LOGS FOR SECURITY
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    ip_address VARCHAR(50),
    user_agent TEXT,
    payload_diff JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 22. ATTENDANCE & DAILY CHECK-IN TRACKING
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL,                   -- STUDENT, TEACHER
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIME NOT NULL,
    check_out_time TIME,
    status VARCHAR(30) NOT NULL DEFAULT 'PRESENT', -- PRESENT, LATE, ABSENT, HALF_DAY, EXCUSED
    session_type VARCHAR(50) DEFAULT 'DAILY_ACADEMIC', -- DAILY_ACADEMIC, FAJR_DARS, EXAM
    ip_address VARCHAR(50),
    user_agent TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_attendance_date UNIQUE (user_id, attendance_date, session_type)
);

-- 23. PERFORMANCE INDEXES
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_cnic ON users(cnic_bform);
CREATE INDEX idx_admissions_status ON student_admissions(status);
CREATE INDEX idx_fee_challans_student ON fee_challans(student_id);
CREATE INDEX idx_fee_challans_status ON fee_challans(status);
CREATE INDEX idx_donations_type ON donations(donation_type);
CREATE INDEX idx_library_books_search ON library_books(title, arabic_urdu_title, author);
CREATE INDEX idx_virtual_classes_live ON virtual_classes(is_live);
CREATE INDEX idx_notifications_user ON notifications(target_user_id, is_read);
CREATE INDEX idx_timetables_class ON timetables(class_id, day_of_week);
CREATE INDEX idx_attendance_user_date ON attendance(user_id, attendance_date);
CREATE INDEX idx_attendance_date_role ON attendance(attendance_date, role, status);
CREATE INDEX idx_attendance_class_date ON attendance(class_id, attendance_date);

