-- current_tenant_id() must bypass RLS to avoid infinite recursion:
--   customers RLS → current_tenant_id() → SELECT profiles → profiles RLS → current_tenant_id() → …
-- SECURITY DEFINER lets the function run as the table owner, skipping RLS.

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$;
