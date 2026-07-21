-- ============================================================
-- 0026 — remove_team_member also deletes the auth user
-- ============================================================

CREATE OR REPLACE FUNCTION remove_team_member(p_user_id UUID, p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  SELECT role::TEXT INTO v_caller_role
  FROM profiles WHERE id = auth.uid() AND tenant_id = p_tenant_id;

  IF v_caller_role IS NULL OR v_caller_role != 'owner' THEN
    RAISE EXCEPTION 'Only the shop owner can remove team members';
  END IF;

  SELECT role::TEXT INTO v_target_role
  FROM profiles WHERE id = p_user_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found in your shop';
  END IF;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot remove the shop owner';
  END IF;

  -- Remove FK references before deleting the auth user
  DELETE FROM tenant_audit_log WHERE performed_by = p_user_id;
  UPDATE order_stage_history SET changed_by = NULL WHERE changed_by = p_user_id;

  DELETE FROM profiles WHERE id = p_user_id AND tenant_id = p_tenant_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;
