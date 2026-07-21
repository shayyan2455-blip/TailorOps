-- ============================================================
-- 0025 — invite_team_member (profile + tailor only)
-- Auth user creation moved to Vercel API (/api/send-invite-email)
-- which has access to the Supabase service_role key.
-- ============================================================

CREATE OR REPLACE FUNCTION invite_team_member(
  p_email      TEXT,
  p_full_name  TEXT,
  p_role       TEXT,
  p_tailor_id  UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_tenant_id UUID;
  v_caller_role      TEXT;
  v_tailor_id        UUID;
  v_temp_password    TEXT;
  v_shop_name        TEXT;
  v_result           JSONB;
BEGIN
  SELECT tenant_id, role::TEXT INTO v_caller_tenant_id, v_caller_role
  FROM profiles WHERE id = auth.uid();

  IF v_caller_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Caller not found in any tenant';
  END IF;

  IF v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owners and admins can invite members';
  END IF;

  -- Check if email already linked to this tenant
  PERFORM 1 FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.email = p_email AND p.tenant_id = v_caller_tenant_id;

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

  -- Generate a temp password (Vercel API will hash it properly)
  v_temp_password := replace(gen_random_uuid()::text, '-', '') || 'Aa1!';

  -- Get shop name for the email
  SELECT name INTO v_shop_name FROM tenants WHERE id = v_caller_tenant_id;

  -- Build result — Vercel API uses this to create the auth user + send email
  SELECT jsonb_build_object(
    'email', p_email,
    'full_name', p_full_name,
    'role', p_role,
    'tailor_id', v_tailor_id,
    'temp_password', v_temp_password,
    'tenant_id', v_caller_tenant_id,
    'shop_name', v_shop_name
  ) INTO v_result;

  RETURN v_result;
END;
$$;
