-- ============================================================
-- 0021 — Super admins table (portable admin identity)
-- ============================================================

-- 1. Super admins table — admin identities independent of auth.users
CREATE TABLE IF NOT EXISTS super_admins (
  email      TEXT PRIMARY KEY,
  added_by   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- 2. Add a super admin by email (for migrations / seeding)
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

-- 4. Claim super admin — lets the current user become admin if none exists yet
CREATE OR REPLACE FUNCTION claim_super_admin()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_count BIGINT;
BEGIN
  v_email := auth.email();
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COUNT(*) INTO v_count FROM super_admins;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'A super admin already exists. Ask an existing admin to add you.';
  END IF;

  INSERT INTO super_admins (email, added_by)
  VALUES (v_email, v_email)
  ON CONFLICT (email) DO NOTHING;

  RETURN v_email;
END;
$$;

-- 5. Check if current user is a super admin
CREATE OR REPLACE FUNCTION check_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email());
$$;

-- 6. Replace is_super_admin (used by admin_* functions) to only check the table
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM super_admins WHERE email = auth.email());
$$;
