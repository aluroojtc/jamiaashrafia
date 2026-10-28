-- =====================================================================================================
-- JAMIA ASHRAFIA LAHORE LMS - 2026-10-27: Candidate gender on admission applications
--
-- Adds student_admissions.gender ('MALE' / 'FEMALE'). Applications made before it was asked keep NULL
-- ("Not specified") and can be completed with Edit Details. Student, teacher and staff accounts keep their
-- gender on the user record itself, so they need no change here.
--
-- The Node.js server applies exactly this on its first start with the new code (server/lms-api.js
-- ensureSchema), so running this file by hand is only needed if the app cannot alter tables itself.
-- Safe to run more than once. In phpMyAdmin: select the LMS database, open the SQL tab, paste, press Go.
-- =====================================================================================================

SET @has_gender = (SELECT COUNT(*) FROM information_schema.columns
                   WHERE table_schema = DATABASE() AND table_name = 'student_admissions' AND column_name = 'gender');
SET @sql = IF(@has_gender = 0,
    'ALTER TABLE student_admissions ADD COLUMN gender VARCHAR(10) NULL AFTER father_name',
    'SELECT ''student_admissions.gender already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
