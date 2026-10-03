-- ==============================================================================
-- JAMIA ASHRAFIA LAHORE - CLOUD LEARNING MANAGEMENT SYSTEM (LMS)
-- PHASE 1: ACADEMIC MASTER DATA DATABASE MIGRATION
-- Tables: branches, departments, academic_programs, academic_sessions
-- ==============================================================================

-- 1. BRANCHES TABLE
CREATE TABLE IF NOT EXISTS branches (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    urdu_name VARCHAR(255) NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) DEFAULT 'Lahore',
    is_womens_branch BOOLEAN DEFAULT FALSE,
    contact_phone VARCHAR(50) NULL,
    contact_email VARCHAR(100) NULL,
    established_year INT NULL,
    student_count INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_branches_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS departments (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    urdu_name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    hod_id VARCHAR(50) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_departments_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. ACADEMIC PROGRAMS TABLE
CREATE TABLE IF NOT EXISTS academic_programs (
    id VARCHAR(50) PRIMARY KEY,
    department_id VARCHAR(50) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    urdu_name VARCHAR(255) NOT NULL,
    duration_years INT NOT NULL,
    wifaq_equivalence VARCHAR(255) NULL,
    description TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_programs_code (code),
    INDEX idx_programs_department (department_id),
    CONSTRAINT fk_programs_department FOREIGN KEY (department_id) 
        REFERENCES departments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. ACADEMIC SESSIONS TABLE
CREATE TABLE IF NOT EXISTS academic_sessions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sessions_current (is_current)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- SEED DATA INSERTION (Preserving all frontend institutional master data)
-- ==============================================================================

-- Seed Branches
INSERT IGNORE INTO branches 
(id, code, name, urdu_name, address, city, is_womens_branch, established_year, student_count)
VALUES
('b1', 'MAIN', 'Main Campus (Central Headquarters & Dawra-e-Hadith)', 'مرکزی کیمپس، فیروز پور روڈ', 'Ferozepur Road & Canal Road, Lahore', 'Lahore', 0, 1955, 1450),
('b2', 'MFB', 'Madrisatul Faisal Lil Bannat (Premier Women\'s Campus)', 'مدرسۃ الفیصل للبنات، ماڈل ٹاؤن', 'Model Town, Lahore', 'Lahore', 1, 1978, 850),
('b3', 'ANAR', 'Madrisa Ashrafia (Historic Founding Building)', 'مدرسہ اشرفیہ قدیم، انارکلی', 'Nila Gumbad, Old Anarkali, Lahore', 'Lahore', 0, 1947, 300),
('b4', 'MQB', 'Mahad al-Quba', 'معہد القبا، جوہر ٹاؤن', 'Johar Town, Lahore', 'Lahore', 0, 1994, 420),
('b5', 'MBQ', 'Madrisa Baitul Quran', 'مدرسہ بیت القرآن، سمن آباد', 'Samanabad, Lahore', 'Lahore', 0, 1985, 280),
('b6', 'IBA', 'Iqra Badrul Atfaal', 'اقراء بدر الاطفال', 'Allama Iqbal Town, Lahore', 'Lahore', 0, 1999, 350),
('b7', 'AMK', 'Ahsanul Makatib', 'احسن المکاتب', 'Gujjar Pura, Lahore', 'Lahore', 0, 1991, 210),
('b8', 'MHB', 'Madrisatul Hassan', 'مدرسۃ الحسن، بیدیاں روڈ', 'Bedian Road, Lahore', 'Lahore', 0, 2004, 310),
('b9', 'MSQ', 'Madrisa Sadiq', 'مدرسہ صادق، رائے ونڈ روڈ', 'Raiwind Road, Lahore', 'Lahore', 0, 2008, 260),
('b10', 'MAB', 'Madrisa Ashrafia lil Bannat', 'مدرسہ اشرفیہ للبنات، گارڈن ٹاؤن', 'Garden Town, Lahore', 'Lahore', 1, 2002, 400),
('b11', 'ABZ', 'Madrisa Abdullah bin Zubair', 'مدرسہ عبد اللہ بن زبیر', 'Gulshan-e-Ravi, Lahore', 'Lahore', 0, 2011, 240),
('b12', 'MHA', 'Madrisatul Hassan (Regional Branch)', 'مدرسۃ الحسن، حسن ابدال', 'Hassan Abdal, Rawalpindi District', 'Hassan Abdal', 0, 1996, 380);

-- Seed Departments
INSERT IGNORE INTO departments
(id, code, name, urdu_name, description)
VALUES
('dept_dars', 'DARS', 'Department of Dars-e-Nizami', 'شعبہ درس نظامی و کتب فقہ و حدیث', 'Classical Islamic Higher Education (Alimiyyah curriculum accredited by Wifaq-ul-Madaris)'),
('dept_ifta', 'IFTA', 'Department of Ifta & Islamic Jurisprudence', 'دار الافتاء و تخصص فی الفقہ الاسلامی', 'Postgraduate Islamic Legal Specialization and Shariah Ruling Research Center'),
('dept_quran', 'QURAN', 'Department of Tahfeez-ul-Quran', 'شعبہ حفظ القرآن الکریم', 'Memorization of the Holy Quran with Tajweed rules and basic Islamic etiquette'),
('dept_qiraat', 'QIRAAT', 'Department of Qira\'at & Tajweed', 'شعبہ تجوید و قراءات عشرہ', 'Specialization in the Ten Canonical Recitations (Qira\'at Sab\'ah and Asharah)'),
('dept_women', 'WOMEN', 'Department of Women\'s Islamic Education', 'شعبہ تعلیم البنات (مدرسۃ الفیصل)', 'Dedicated Alimiyyah curriculum for female scholars at Model Town & Garden Town campuses');

-- Seed Academic Programs
INSERT IGNORE INTO academic_programs
(id, department_id, code, name, urdu_name, duration_years, wifaq_equivalence, description)
VALUES
('p1', 'dept_dars', 'DN-8', 'Dars-e-Nizami (Shahadat-ul-Alimiyyah)', 'درس نظامی (شہادۃ العالمیہ)', 8, 'Recognized as M.A Islamic Studies / Arabic by HEC', 'Comprehensive eight-year curriculum covering Sarf, Nahw, Mantiq, Usul al-Fiqh, Balaghah, Tafsir, and Sihah Sitta Hadith'),
('p2', 'dept_ifta', 'TKH-IFTA', 'Takhassus fil-Fiqh wal-Ifta (Postgraduate)', 'تخصص فی الفقہ و الافتاء', 2, 'Postgraduate M.Phil equivalence in Islamic Jurisprudence', 'Rigorous training in Fiqh rulings, Usul al-Ifta, modern Islamic financial transactions, and fatwa drafting'),
('p3', 'dept_quran', 'HIFZ', 'Hifz-ul-Quran & Tajweed', 'حفظ القرآن الکریم مع التجوید', 3, 'Wifaq Tahfeez Certification', 'Complete memorization of the 30 Paras with classical Makharij and daily revision circles'),
('p4', 'dept_qiraat', 'QIR-10', 'Qira\'at Sab\'ah and Asharah', 'قراءات سبعہ و عشرہ', 2, 'Shahadat-ut-Tajweed wal-Qira\'at', 'Advanced study of classical recitation modes with sanad muttasil back to the Holy Prophet ﷺ'),
('p5', 'dept_women', 'DN-WOMEN', 'Alimiyyah for Women (Lil Bannat)', 'شہادۃ العالمیہ للبنات', 6, 'Recognized as M.A Islamic Studies by HEC', 'Structured Alimiyyah syllabus tailored for female scholars with focus on Hadith, Fiqh, and Islamic family values');

-- Seed Academic Sessions
INSERT IGNORE INTO academic_sessions
(id, name, start_date, end_date, is_current)
VALUES
('sess_2024_2025', '1445-1446 AH (2024-2025 CE)', '2024-08-01', '2025-06-30', 1),
('sess_2025_2026', '1446-1447 AH (2025-2026 CE)', '2025-08-01', '2026-06-30', 0),
('sess_2023_2024', '1444-1445 AH (2023-2024 CE)', '2023-08-01', '2024-06-30', 0);
