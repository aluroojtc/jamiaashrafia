-- ==============================================================================
-- JAMIA ASHRAFIA LAHORE - CLOUD LEARNING MANAGEMENT SYSTEM (LMS)
-- MySQL / MariaDB Production Schema for cPanel Shared Hosting & Local Staging
-- Tables: student_admissions, notifications (Preserving existing schema & seed data)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS student_admissions (
    id VARCHAR(50) PRIMARY KEY,
    application_no VARCHAR(50) UNIQUE NOT NULL,
    student_type VARCHAR(30) NOT NULL DEFAULT 'LOCAL', -- 'LOCAL' or 'INTERNATIONAL'
    branch_id VARCHAR(50) NOT NULL DEFAULT 'b1',
    program_id VARCHAR(50) NOT NULL DEFAULT 'p1',
    candidate_name VARCHAR(255) NOT NULL,
    father_name VARCHAR(255) NOT NULL,
    guardian_contact VARCHAR(50) NULL,
    email VARCHAR(255) NULL,
    phone VARCHAR(50) NOT NULL,
    cnic_bform VARCHAR(30) NULL,                         -- Required for LOCAL students
    passport_number VARCHAR(50) NULL,                    -- Required for INTERNATIONAL students
    country VARCHAR(100) NOT NULL DEFAULT 'Pakistan',    -- Required for INTERNATIONAL students
    date_of_birth DATE NULL,
    previous_madrasa VARCHAR(255) NULL,
    hafiz_status TINYINT(1) DEFAULT 0,
    hostel_required TINYINT(1) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'APPLIED',                -- 'APPLIED', 'UNDER_REVIEW', 'INTERVIEW_SCHEDULED', 'APPROVED', 'REJECTED', 'ENROLLED'
    interview_date DATETIME NULL,
    interview_score DECIMAL(5,2) NULL,
    reviewer_notes TEXT NULL,
    allotted_roll_number VARCHAR(50) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_admissions_status (status),
    INDEX idx_admissions_cnic (cnic_bform),
    INDEX idx_admissions_passport (passport_number),
    INDEX idx_admissions_app_no (application_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) PRIMARY KEY,
    sender_id VARCHAR(50) NULL,
    target_role VARCHAR(50) NOT NULL DEFAULT 'ACADEMIC_ADMIN', -- 'SUPER_ADMIN', 'ACADEMIC_ADMIN', etc.
    target_user_id VARCHAR(50) NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'ADMISSION',                  -- 'ADMISSION', 'ACADEMIC', 'FEE', 'EXAM', 'LIVE_CLASS'
    is_read TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notifications_role (target_role, is_read),
    INDEX idx_notifications_user (target_user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- Initial Seed Data Preservation (Insert only if not already present)
-- ==============================================================================

INSERT IGNORE INTO student_admissions 
(id, application_no, student_type, branch_id, program_id, candidate_name, father_name, phone, email, cnic_bform, country, previous_madrasa, hafiz_status, hostel_required, status, interview_date, interview_score, allotted_roll_number, created_at)
VALUES
('adm_101', 'ASH-ADM-2024-089', 'LOCAL', 'b1', 'p1', 'Ahmad Raza Siddiqui', 'Maulana Muhammad Siddique', '+92 300 4589211', 'ahmad.raza@gmail.com', '35201-8934521-3', 'Pakistan', 'Jamia Farooqia Karachi (Sanawiyyah Passed)', 1, 1, 'INTERVIEW_SCHEDULED', '2026-10-05 10:00:00', NULL, NULL, '2026-09-24 09:00:00'),
('adm_102', 'ASH-ADM-2024-090', 'LOCAL', 'b1', 'p2', 'Zubair Ahmad Qasmi', 'Hafiz Abdul Qadir', '+92 321 7845123', 'zubair.qasmi@outlook.com', '38403-1249872-5', 'Pakistan', 'Jamia Ashrafia Lahore (Dawra-e-Hadith Mumtaz)', 1, 1, 'APPROVED', '2026-09-20 11:30:00', 94.50, 'ASH-IFT-018', '2026-09-18 10:00:00'),
('adm_103', 'ASH-ADM-2024-091', 'LOCAL', 'b2', 'p5', 'Zainab Bint Tariq', 'Tariq Mahmood', '+92 333 9812470', 'zainab.tariq@gmail.com', '35202-6721980-6', 'Pakistan', 'Madrisatul Faisal Lil Bannat Model Town', 1, 0, 'ENROLLED', '2026-09-15 09:30:00', 91.00, 'ASH-B-114', '2026-09-12 11:00:00'),
('adm_104', 'ASH-ADM-2024-092', 'LOCAL', 'b4', 'p3', 'Abdullah Haroon', 'Haroon Rashid', '+92 301 6677889', 'abdullah.haroon@yahoo.com', '37405-5544123-1', 'Pakistan', 'Government High School Lahore', 0, 0, 'APPLIED', NULL, NULL, NULL, '2026-09-26 14:00:00'),
('adm_105', 'ASH-ADM-2024-093', 'INTERNATIONAL', 'b1', 'p1', 'Abdur Rahman Al-Afghani', 'Mawlawi Abdullah Jan', '+93 70 1234567', 'abdurrahman.kbl@gmail.com', NULL, 'Afghanistan', 'Madrasa Darul Uloom Kabul', 1, 1, 'INTERVIEW_SCHEDULED', '2026-10-06 14:00:00', NULL, NULL, '2026-09-27 10:00:00');

INSERT IGNORE INTO notifications
(id, sender_id, target_role, title, message, category, is_read, created_at)
VALUES
('notif_seed_1', NULL, 'SUPER_ADMIN', 'Welcome to Academic Session 1446-1447 AH', 'Welcome to all scholars and faculty. Institutional admissions and sessions have commenced.', 'ACADEMIC', 0, '2026-10-01 08:00:00'),
('notif_seed_2', NULL, 'ACADEMIC_ADMIN', 'Shashmahi Midterm Exam Date Sheet Published', 'The Wifaq-pattern examination for all Dars-e-Nizami years will commence from 15 October 2026.', 'EXAM', 0, '2026-10-02 09:00:00');
