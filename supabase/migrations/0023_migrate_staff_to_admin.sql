-- ============================================================
-- 0023 — Migrate existing 'staff' rows to 'admin'
-- (Must run in its own transaction — enum values added in 0022
--  are not visible until that migration commits.)
-- ============================================================

UPDATE profiles SET role = 'admin' WHERE role = 'staff';
