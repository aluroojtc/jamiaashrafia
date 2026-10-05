-- ==============================================================================
-- JAMIA ASHRAFIA LAHORE - LMS PHASE 2: SHARED ACADEMIC DATA, LOGIN, NOTIFICATIONS
-- server/lms-api.js creates these automatically on startup. Run this file manually
-- only on hosting where the database user is not allowed to CREATE / ALTER tables.
-- ==============================================================================

-- Shared records for classes, courses, assignments, exams, fees, library, timetable,
-- online classes and attendance (one JSON document per record, soft-deleted for sync)
CREATE TABLE IF NOT EXISTS lms_records (
    collection VARCHAR(64) NOT NULL,
    id VARCHAR(120) NOT NULL,
    data LONGTEXT NOT NULL,
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    updated_by VARCHAR(120) NULL,
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (collection, id),
    INDEX idx_lms_records_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hashed (scrypt) portal passwords
CREATE TABLE IF NOT EXISTS user_credentials (
    user_id VARCHAR(120) PRIMARY KEY,
    password_hash VARCHAR(255) NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Admissions window (open / closed, session, deadline, fees) and role permissions
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value LONGTEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications can target one user, a class, or a role; read state is per person
ALTER TABLE notifications ADD COLUMN target_class_id VARCHAR(50) NULL;
ALTER TABLE notifications ADD COLUMN sender_name VARCHAR(255) NULL;
ALTER TABLE notifications ADD COLUMN link_route VARCHAR(100) NULL;

CREATE TABLE IF NOT EXISTS notification_reads (
    notification_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(120) NOT NULL,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
