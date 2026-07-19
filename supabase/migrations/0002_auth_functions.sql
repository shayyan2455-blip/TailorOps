-- ============================================================
-- Phase 2 — Auth helper functions (SECURITY DEFINER)
-- ============================================================

-- Creates a tenant + links the calling user as owner.
-- Called from the frontend after supabase.auth.signUp().
CREATE OR REPLACE FUNCTION create_tenant_and_profile(
  tenant_name TEXT,
  owner_name  TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
  safe_slug     TEXT;
BEGIN
  -- Generate a URL-safe slug from the shop name
  safe_slug := lower(regexp_replace(
    regexp_replace(tenant_name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ));

  -- Ensure uniqueness by appending a short suffix if needed
  WHILE EXISTS (SELECT 1 FROM tenants WHERE slug = safe_slug) LOOP
    safe_slug := safe_slug || '-' || substr(gen_random_uuid()::text, 1, 6);
  END LOOP;

  INSERT INTO tenants (name, slug)
  VALUES (tenant_name, safe_slug)
  RETURNING id INTO new_tenant_id;

  INSERT INTO profiles (id, tenant_id, role, full_name)
  VALUES (auth.uid(), new_tenant_id, 'owner', owner_name);

  RETURN new_tenant_id;
END;
$$;
