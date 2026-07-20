-- ============================================================
-- 0022 — Add new enum values only
-- (Must be alone — new enum values cannot be used until
--  this migration commits.  Migration 0023 has the rest.)
-- ============================================================

ALTER TYPE user_role ADD VALUE 'admin';
ALTER TYPE user_role ADD VALUE 'tailor';
