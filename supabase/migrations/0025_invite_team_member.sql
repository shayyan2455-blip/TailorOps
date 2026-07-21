-- ============================================================
-- 0025 — invite_team_member RPC (replaces Edge Function)
-- Creates auth user + profile + optional tailor record,
-- all within the database using SECURITY DEFINER.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION invite_team_member(
  p_email      TEXT,
  p_full_name  TEXT,
  p_role       TEXT,       -- 'admin' or 'tailor'
  p_tailor_id  UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_tenant_id UUID;
  v_caller_role      TEXT;
  v_user_id          UUID;
  v_tailor_id        UUID;
  v_temp_password    TEXT;
  v_encrypted_pw     TEXT;
  v_existing         RECORD;
  v_result           JSONB;
BEGIN
  -- Resolve caller's tenant and role
  SELECT tenant_id, role::TEXT INTO v_caller_tenant_id, v_caller_role
  FROM profiles WHERE id = auth.uid();

  IF v_caller_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Caller not found in any tenant';
  END IF;

  IF v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owners and admins can invite members';
  END IF;

  -- Check for existing user with this email (in any tenant)
  SELECT u.id INTO v_existing
  FROM auth.users u
  JOIN profiles p ON p.id = u.id
  WHERE u.email = p_email AND p.tenant_id = v_caller_tenant_id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'User with email % already exists in this shop', p_email;
  END IF;

  -- Resolve tailor_id
  IF p_role = 'tailor' THEN
    IF p_tailor_id IS NOT NULL AND p_tailor_id != '00000000-0000-0000-0000-000000000000' THEN
      v_tailor_id := p_tailor_id;
      UPDATE tailors SET invited = true WHERE id = v_tailor_id;
    ELSE
      INSERT INTO tailors (tenant_id, name, active, invited)
      VALUES (v_caller_tenant_id, p_full_name, true, true)
      RETURNING id INTO v_tailor_id;
    END IF;
  END IF;

  -- Generate user ID and temp password
  v_user_id := gen_random_uuid();
  v_temp_password := replace(gen_random_uuid()::text, '-', '') || 'Aa1!';
  v_encrypted_pw := crypt(v_temp_password, gen_salt('bf'));

  -- Create auth user
  INSERT INTO auth.users (
    id, email, encrypted_password,
    email_confirmed_at, confirmation_sent_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, aud, role
  ) VALUES (
    v_user_id, p_email, v_encrypted_pw, now(), now(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('full_name', p_full_name, 'role', p_role),
    now(), now(), 'authenticated', 'authenticated'
  );

  -- Create profile
  IF v_tailor_id IS NOT NULL THEN
    INSERT INTO profiles (id, tenant_id, full_name, role, tailor_id)
    VALUES (v_user_id, v_caller_tenant_id, p_full_name, p_role::user_role, v_tailor_id);
  ELSE
    INSERT INTO profiles (id, tenant_id, full_name, role)
    VALUES (v_user_id, v_caller_tenant_id, p_full_name, p_role::user_role);
  END IF;

  -- Build result
  SELECT jsonb_build_object(
    'user_id', v_user_id,
    'email', p_email,
    'full_name', p_full_name,
    'role', p_role,
    'tailor_id', v_tailor_id,
    'temp_password', v_temp_password
  ) INTO v_result;

  RETURN v_result;
END;
$$;
