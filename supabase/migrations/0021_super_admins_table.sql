-- ============================================================
-- 0021 — Super admins table (portable, separate from auth.users)
-- ============================================================

-- 1. Super admins table — stores admin identities independent of auth.users
CREATE TABLE IF NOT EXISTS super_admins (
  email      TEXT PRIMARY KEY,
  added_by   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
-- No public access; only SECURITY DEFINER functions manage this table

-- 2. Add a super admin (callable from SQL or RPC)
CREATE OR REPLACE FUNCTION add_super_admin(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO super_admins (email, added_by)
  VALUES (p_email, COALESCE(auth.email(), 'system'))
  ON CONFLICT (email) DO NOTHING;
  RETURN p_email;
END;
$$;

-- 3. Remove a super admin
CREATE OR REPLACE FUNCTION remove_super_admin(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM super_admins WHERE email = p_email;
  RETURN p_email;
END;
$$;

-- 4. Update is_super_admin to check both hardcoded email AND super_admins table
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.email() = 'liberaltech.official@gmail.com'
    OR EXISTS (
      SELECT 1 FROM super_admins WHERE email = auth.email()
    );
$$;

-- 5. Seed the initial super admin (safe — only inserts if email not in use)
-- Run this AFTER creating the user in Supabase Auth (via Dashboard or signup)
-- SELECT add_super_admin('liberaltech.official@gmail.com');
