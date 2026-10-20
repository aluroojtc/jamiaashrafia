-- =====================================================================================================
-- JAMIA ASHRAFIA LAHORE LMS - 2026-10-18: Admin role -> approved three-role permission matrix
--
-- Removes from the Admin role (ACADEMIC_ADMIN) the 18 permissions kept for the Super Admin alone or that
-- belong to student self-service. Adds nothing. The approved Admin set (86 permissions) is the code
-- default in server/permissions.js, so the same result can be reached from the portal instead:
--   Super Admin -> Roles & Permissions -> Admin -> Restore defaults -> Save   (preferred: shows the diff)
--
-- Run only AFTER the new code is uploaded and the Node.js app restarted once.
-- Safe to run more than once: a second run removes nothing and writes no audit entry.
-- In phpMyAdmin: select the LMS database, open the SQL tab, paste everything below, press Go.
-- =====================================================================================================

-- 1) Before: how many permissions Admin holds now (86 after the change)
SELECT COUNT(*) AS admin_permissions_before FROM role_permissions WHERE role_id = 'ACADEMIC_ADMIN';

-- 2) The change, in one transaction, with an audit log entry
START TRANSACTION;

DELETE FROM role_permissions
WHERE role_id = 'ACADEMIC_ADMIN'
  AND permission IN (
    'users.create', 'users.update', 'users.deactivate', 'users.delete', 'users.reset_password', 'users.assign_roles', 'users.export',
    'roles.create', 'roles.update', 'roles.delete',
    'audit.view', 'settings.recordings', 'students.delete', 'teachers.delete', 'donations.view_donor_identity',
    'assignments.submit', 'exams.attempt', 'fees.challans.submit_proof'
  );
SET @removed = ROW_COUNT();

UPDATE roles SET version = version + 1, updated_by = 'system'
WHERE id = 'ACADEMIC_ADMIN' AND @removed > 0;

INSERT INTO audit_log (actor_id, actor_role, action, entity_type, entity_id, summary)
SELECT 'system', 'SYSTEM', 'role.update', 'role', 'ACADEMIC_ADMIN',
       CONCAT('Changed role Admin: +0 / -', @removed, ' permission(s) (approved three-role permission matrix, applied by SQL)')
FROM DUAL WHERE @removed > 0;

COMMIT;

-- 3) After: should be 86. If it is lower, Admin was narrower than the approved set on this server:
--    use "Restore defaults" in the portal to add what is missing.
SELECT COUNT(*) AS admin_permissions_after FROM role_permissions WHERE role_id = 'ACADEMIC_ADMIN';

-- The running app reloads roles within 15 seconds; no restart is needed after this script.
