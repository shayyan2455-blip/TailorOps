-- ============================================================
-- 0020 — Super Admin Portal + Tenant Approval Workflow
-- ============================================================

-- 1. Status columns on tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

-- 2. Tenant audit log
CREATE TABLE IF NOT EXISTS tenant_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_audit_tenant ON tenant_audit_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_created ON tenant_audit_log (created_at DESC);

ALTER TABLE tenant_audit_log ENABLE ROW LEVEL SECURITY;
-- No RLS policies needed — only SECURITY DEFINER functions access this

-- 3. Email notifications queue
CREATE TABLE IF NOT EXISTS email_notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email   TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  sent       BOOLEAN NOT NULL DEFAULT false,
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_notifications_sent ON email_notifications (sent);
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- 4. Update RLS on tenants — SELECT only for tenant users
DROP POLICY IF EXISTS tenant_isolation ON tenants;
CREATE POLICY tenant_select ON tenants FOR SELECT USING (id = current_tenant_id());

-- 5. Update create_tenant_and_profile to set status = 'pending'
CREATE OR REPLACE FUNCTION create_tenant_and_profile(
  tenant_name TEXT,
  owner_name  TEXT,
  user_id     UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
  safe_slug     TEXT;
  v_email       TEXT;
BEGIN
  safe_slug := lower(regexp_replace(
    regexp_replace(tenant_name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ));

  WHILE EXISTS (SELECT 1 FROM tenants WHERE slug = safe_slug) LOOP
    safe_slug := safe_slug || '-' || substr(gen_random_uuid()::text, 1, 6);
  END LOOP;

  INSERT INTO tenants (name, slug, status)
  VALUES (tenant_name, safe_slug, 'pending')
  RETURNING id INTO new_tenant_id;

  INSERT INTO profiles (id, tenant_id, role, full_name)
  VALUES (user_id, new_tenant_id, 'owner', owner_name);

  RETURN new_tenant_id;
END;
$$;

-- 6. Helper: get tenant status for the current user
CREATE OR REPLACE FUNCTION get_my_tenant_status()
RETURNS TABLE(status TEXT, rejection_reason TEXT, tenant_name TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.status, t.rejection_reason, t.name
  FROM tenants t
  WHERE t.id = current_tenant_id();
$$;

-- 7. Admin helper: check if calling user is the super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.email() = 'liberaltech.official@gmail.com';
$$;

-- 8. Admin: approve a tenant
CREATE OR REPLACE FUNCTION admin_approve_tenant(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_name TEXT;
  v_owner_email TEXT;
  v_owner_name  TEXT;
  v_result      JSONB;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only super admin can perform this action';
  END IF;

  SELECT name INTO v_tenant_name FROM tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  UPDATE tenants SET status = 'active', status_updated_at = now()
  WHERE id = p_tenant_id;

  INSERT INTO tenant_audit_log (tenant_id, action, performed_by, reason)
  VALUES (p_tenant_id, 'approved', auth.uid(), NULL);

  SELECT email INTO v_owner_email
  FROM auth.users
  WHERE id = (SELECT id FROM profiles WHERE tenant_id = p_tenant_id AND role = 'owner' LIMIT 1);

  SELECT full_name INTO v_owner_name
  FROM profiles
  WHERE tenant_id = p_tenant_id AND role = 'owner' LIMIT 1;

  INSERT INTO email_notifications (to_email, subject, body)
  VALUES (
    v_owner_email,
    'Your shop has been approved — TailorOps',
    'Hi ' || COALESCE(v_owner_name, 'there') || ',

Good news — your shop "' || v_tenant_name || '" has been approved!

You can now sign in at: https://tailorops.vercel.app

Happy tailoring!
— The TailorOps Team'
  );

  SELECT jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'status', 'active',
    'tenant_name', v_tenant_name,
    'notified', v_owner_email
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 9. Admin: reject a tenant
CREATE OR REPLACE FUNCTION admin_reject_tenant(p_tenant_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_name TEXT;
  v_owner_email TEXT;
  v_owner_name  TEXT;
  v_result      JSONB;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only super admin can perform this action';
  END IF;

  IF p_reason IS NULL OR p_reason = '' THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;

  SELECT name INTO v_tenant_name FROM tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  UPDATE tenants SET status = 'rejected', rejection_reason = p_reason, status_updated_at = now()
  WHERE id = p_tenant_id;

  INSERT INTO tenant_audit_log (tenant_id, action, performed_by, reason)
  VALUES (p_tenant_id, 'rejected', auth.uid(), p_reason);

  SELECT email INTO v_owner_email
  FROM auth.users
  WHERE id = (SELECT id FROM profiles WHERE tenant_id = p_tenant_id AND role = 'owner' LIMIT 1);

  SELECT full_name INTO v_owner_name
  FROM profiles
  WHERE tenant_id = p_tenant_id AND role = 'owner' LIMIT 1;

  INSERT INTO email_notifications (to_email, subject, body)
  VALUES (
    v_owner_email,
    'Your shop registration — TailorOps',
    'Hi ' || COALESCE(v_owner_name, 'there') || ',

Thank you for your interest in TailorOps.

Unfortunately, your shop registration for "' || v_tenant_name || '" was not approved.

Reason: ' || p_reason || '

If you believe this is a mistake, please contact support at support@tailorops.com.

— The TailorOps Team'
  );

  SELECT jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'status', 'rejected',
    'reason', p_reason
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 10. Admin: suspend a tenant
CREATE OR REPLACE FUNCTION admin_suspend_tenant(p_tenant_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_name TEXT;
  v_owner_email TEXT;
  v_owner_name  TEXT;
  v_result      JSONB;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only super admin can perform this action';
  END IF;

  SELECT name INTO v_tenant_name FROM tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  UPDATE tenants SET status = 'suspended', status_updated_at = now()
  WHERE id = p_tenant_id;

  INSERT INTO tenant_audit_log (tenant_id, action, performed_by, reason)
  VALUES (p_tenant_id, 'suspended', auth.uid(), p_reason);

  SELECT email INTO v_owner_email
  FROM auth.users
  WHERE id = (SELECT id FROM profiles WHERE tenant_id = p_tenant_id AND role = 'owner' LIMIT 1);

  SELECT full_name INTO v_owner_name
  FROM profiles
  WHERE tenant_id = p_tenant_id AND role = 'owner' LIMIT 1;

  INSERT INTO email_notifications (to_email, subject, body)
  VALUES (
    v_owner_email,
    'Your shop has been suspended — TailorOps',
    'Hi ' || COALESCE(v_owner_name, 'there') || ',

Your shop "' || v_tenant_name || '" has been suspended.'
    || CASE WHEN p_reason IS NOT NULL AND p_reason <> '' THEN E'\n\nReason: ' || p_reason ELSE '' END
    || E'\n\nIf you have any questions, please contact support at support@tailorops.com.

— The TailorOps Team'
  );

  SELECT jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'status', 'suspended',
    'reason', p_reason
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 11. Admin: reactivate a tenant
CREATE OR REPLACE FUNCTION admin_reactivate_tenant(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_name TEXT;
  v_owner_email TEXT;
  v_owner_name  TEXT;
  v_result      JSONB;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only super admin can perform this action';
  END IF;

  SELECT name INTO v_tenant_name FROM tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  UPDATE tenants SET status = 'active', rejection_reason = NULL, status_updated_at = now()
  WHERE id = p_tenant_id;

  INSERT INTO tenant_audit_log (tenant_id, action, performed_by, reason)
  VALUES (p_tenant_id, 'reactivated', auth.uid(), NULL);

  SELECT email INTO v_owner_email
  FROM auth.users
  WHERE id = (SELECT id FROM profiles WHERE tenant_id = p_tenant_id AND role = 'owner' LIMIT 1);

  SELECT full_name INTO v_owner_name
  FROM profiles
  WHERE tenant_id = p_tenant_id AND role = 'owner' LIMIT 1;

  INSERT INTO email_notifications (to_email, subject, body)
  VALUES (
    v_owner_email,
    'Your shop has been reactivated — TailorOps',
    'Hi ' || COALESCE(v_owner_name, 'there') || ',

Great news — your shop "' || v_tenant_name || '" has been reactivated.

You can sign in again at: https://tailorops.vercel.app

— The TailorOps Team'
  );

  SELECT jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'status', 'active'
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 12. Admin: list all tenants (with optional status filter)
CREATE OR REPLACE FUNCTION admin_list_tenants(p_status TEXT DEFAULT NULL)
RETURNS TABLE(
  tenant_id       UUID,
  tenant_name     TEXT,
  slug            TEXT,
  status          TEXT,
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ,
  status_updated_at TIMESTAMPTZ,
  owner_name      TEXT,
  owner_email     TEXT,
  owner_mobile    TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id, t.name, t.slug, t.status, t.rejection_reason,
    t.created_at, t.status_updated_at,
    p.full_name, u.email::text, p.mobile
  FROM tenants t
  LEFT JOIN profiles p ON p.tenant_id = t.id AND p.role = 'owner'
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE (p_status IS NULL OR t.status = p_status)
  ORDER BY t.created_at DESC;
$$;

-- 13. Admin: get single tenant detail
CREATE OR REPLACE FUNCTION admin_get_tenant(p_tenant_id UUID)
RETURNS TABLE(
  tenant_id       UUID,
  tenant_name     TEXT,
  slug            TEXT,
  status          TEXT,
  rejection_reason TEXT,
  address         TEXT,
  phone           TEXT,
  currency        TEXT,
  created_at      TIMESTAMPTZ,
  status_updated_at TIMESTAMPTZ,
  owner_name      TEXT,
  owner_email     TEXT,
  owner_mobile    TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id, t.name, t.slug, t.status, t.rejection_reason,
    t.address, t.phone, t.currency,
    t.created_at, t.status_updated_at,
    p.full_name, u.email::text, p.mobile
  FROM tenants t
  LEFT JOIN profiles p ON p.tenant_id = t.id AND p.role = 'owner'
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE t.id = p_tenant_id;
$$;

-- 14. Admin: get audit log for a tenant or all
CREATE OR REPLACE FUNCTION admin_get_audit_log(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE(
  log_id        UUID,
  tenant_id     UUID,
  tenant_name   TEXT,
  action        TEXT,
  reason        TEXT,
  performed_by  UUID,
  admin_email   TEXT,
  created_at    TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    al.id, al.tenant_id, t.name, al.action, al.reason,
    al.performed_by, u.email::text, al.created_at
  FROM tenant_audit_log al
  JOIN tenants t ON t.id = al.tenant_id
  LEFT JOIN auth.users u ON u.id = al.performed_by
  WHERE (p_tenant_id IS NULL OR al.tenant_id = p_tenant_id)
  ORDER BY al.created_at DESC;
$$;

-- 15. Admin: get metrics
CREATE OR REPLACE FUNCTION admin_get_metrics()
RETURNS TABLE(
  total_shops       BIGINT,
  active_shops      BIGINT,
  pending_shops     BIGINT,
  rejected_shops    BIGINT,
  suspended_shops   BIGINT,
  added_this_month  BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE status = 'active')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'suspended')::BIGINT,
    COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now()))::BIGINT
  FROM tenants;
$$;

-- 16. Admin: get pending email notifications
CREATE OR REPLACE FUNCTION admin_get_pending_emails()
RETURNS TABLE(
  id         UUID,
  to_email   TEXT,
  subject    TEXT,
  body       TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, to_email, subject, body, created_at
  FROM email_notifications
  WHERE sent = false
  ORDER BY created_at ASC;
$$;

-- 17. Admin: mark email as sent (no admin check — called by Edge Function with service role)
CREATE OR REPLACE FUNCTION admin_mark_email_sent(p_email_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE email_notifications SET sent = true, sent_at = now()
  WHERE id = p_email_id;
$$;
