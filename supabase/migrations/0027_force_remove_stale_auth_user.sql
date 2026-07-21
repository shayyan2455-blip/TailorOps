-- ============================================================
-- 0027 — force_remove_stale_auth_user RPC
-- Deletes a dangling auth user by email (skips profile, since
-- the profile is already gone). Safe for re-invite flows.
-- ============================================================

CREATE OR REPLACE FUNCTION force_remove_stale_auth_user(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

  IF FOUND THEN
    -- User exists in auth.users — clean up FK refs and delete
    DELETE FROM tenant_audit_log WHERE performed_by = v_user_id;
    UPDATE order_stage_history SET changed_by = NULL WHERE changed_by = v_user_id;
    DELETE FROM auth.identities WHERE user_id = v_user_id;
    DELETE FROM auth.sessions WHERE user_id = v_user_id;
    DELETE FROM auth.mfa_factors WHERE user_id = v_user_id;
    DELETE FROM auth.mfa_challenges WHERE user_id = v_user_id;
    DELETE FROM auth.users WHERE id = v_user_id;
    RETURN v_user_id;
  ELSE
    -- User already gone from auth.users, but ghost identity may remain.
    -- Delete identities by provider_id = email for the 'email' provider.
    DELETE FROM auth.identities
    WHERE provider = 'email' AND provider_id = p_email;
    RETURN NULL;
  END IF;
END;
$$;
