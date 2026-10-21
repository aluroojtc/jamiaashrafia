-- =====================================================================================================
-- JAMIA ASHRAFIA LAHORE LMS - 2026-10-21: Separate system roles, student types and teacher types
--
-- Three authorization domains (server/permissions.js DOMAINS):
--   SYSTEM  - office roles (Admin, Finance Officer, custom roles)   -> Users & Roles
--   STUDENT - student types / permission groups                     -> Student Management -> Student Types
--   TEACHER - teacher types / permission groups                     -> Teacher Management -> Teacher Types
--
-- Additive only. Nothing is deleted and no account changes access:
--   * roles.domain is added; every existing role stays SYSTEM, the built-in STUDENT and TEACHER roles become
--     the default student type and default teacher type (same permissions, same ids).
--   * Student and teacher accounts keep role STUDENT / TEACHER on their record (the account type). Their type is
--     their primary user_roles row; accounts without one are in the default type, which is what they had.
--   * user_permission_overrides is created empty (individual allow / deny, set by the Super Admin).
--
-- The Node.js server applies exactly this on its first start with the new code (server/roles.js
-- ensureDomainSchema), so running this file by hand is only needed if the app cannot alter tables itself.
-- Safe to run more than once. In phpMyAdmin: select the LMS database, open the SQL tab, paste, press Go.
-- =====================================================================================================

-- 1) roles.domain (added only if missing; works on MySQL 5.7+ and MariaDB)
SET @has_domain = (SELECT COUNT(*) FROM information_schema.columns
                   WHERE table_schema = DATABASE() AND table_name = 'roles' AND column_name = 'domain');
SET @sql = IF(@has_domain = 0,
    'ALTER TABLE roles ADD COLUMN domain VARCHAR(16) NOT NULL DEFAULT ''SYSTEM'' AFTER scope, ADD INDEX idx_roles_domain (domain)',
    'SELECT ''roles.domain already present'' AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) The built-in Student and Teacher roles become the default types of their domains
UPDATE roles SET domain = 'STUDENT' WHERE id = 'STUDENT' AND domain <> 'STUDENT';
UPDATE roles SET domain = 'TEACHER' WHERE id = 'TEACHER' AND domain <> 'TEACHER';

-- 3) Individual permission overrides for students and teachers
CREATE TABLE IF NOT EXISTS user_permission_overrides (
    user_id VARCHAR(120) NOT NULL,
    permission VARCHAR(80) NOT NULL,
    effect VARCHAR(8) NOT NULL,            -- 'ALLOW' or 'DENY'
    granted_by VARCHAR(120) NULL,
    granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, permission)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Check: roles per domain, and accounts per kind (nothing should have changed)
SELECT domain, COUNT(*) AS roles FROM roles GROUP BY domain;
SELECT JSON_UNQUOTE(JSON_EXTRACT(data, '$.role')) AS account_role, COUNT(*) AS accounts
FROM lms_records WHERE collection = 'users' AND deleted = 0 GROUP BY account_role;

-- =====================================================================================================
-- ROLLBACK (only if you go back to the previous code). Run the statements below by hand.
-- Accounts in a custom student or teacher type return to the plain Student / Teacher role (their record role),
-- so first note who is in which type:
--   SELECT ur.user_id, ur.role_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
--   WHERE r.domain IN ('STUDENT', 'TEACHER') AND r.id NOT IN ('STUDENT', 'TEACHER');
--
--   UPDATE user_roles ur JOIN roles r ON r.id = ur.role_id SET ur.role_id = r.domain
--   WHERE ur.is_primary = 1 AND r.domain IN ('STUDENT', 'TEACHER');
--   DELETE rp FROM role_permissions rp JOIN roles r ON r.id = rp.role_id
--   WHERE r.domain IN ('STUDENT', 'TEACHER') AND r.id NOT IN ('STUDENT', 'TEACHER');
--   DELETE FROM roles WHERE domain IN ('STUDENT', 'TEACHER') AND id NOT IN ('STUDENT', 'TEACHER');
--   DROP TABLE user_permission_overrides;
--   ALTER TABLE roles DROP INDEX idx_roles_domain, DROP COLUMN domain;
-- =====================================================================================================
