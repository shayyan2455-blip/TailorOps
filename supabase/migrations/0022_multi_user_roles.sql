-- ============================================================
-- 0022 — Multi-user roles: admin + tailor login
-- ============================================================

-- 1. Expand user_role enum
ALTER TYPE user_role ADD VALUE 'admin';
ALTER TYPE user_role ADD VALUE 'tailor';

-- 2. Add tailor_id to profiles (nullable, only for tailor role)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tailor_id UUID REFERENCES tailors(id) ON DELETE SET NULL;

-- 4. Add invited flag to tailors
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS invited BOOLEAN NOT NULL DEFAULT false;

-- 5. RLS: work_assignments — tailors can only see their own rows
DROP POLICY IF EXISTS tailor_select_own_assignments ON work_assignments;
CREATE POLICY tailor_select_own_assignments ON work_assignments
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles
      WHERE role = 'tailor'
        AND tailor_id = work_assignments.tailor_id
        AND tenant_id = work_assignments.tenant_id
    )
  );

-- 6. RLS: profiles — tailors can only see their own profile row
DROP POLICY IF EXISTS tailor_profile_policy ON profiles;
CREATE POLICY tailor_profile_policy ON profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR (role IN ('owner', 'admin') AND tenant_id = current_tenant_id())
  );

-- Drop old policy to replace
DROP POLICY IF EXISTS tenant_isolation ON profiles;
CREATE POLICY tenant_isolation ON profiles
  FOR ALL
  USING (
    role IN ('owner', 'admin')
    AND tenant_id = current_tenant_id()
  )
  WITH CHECK (
    role IN ('owner', 'admin')
    AND tenant_id = current_tenant_id()
  );

-- 7. Function: get my tailor_id for the current logged-in tailor
CREATE OR REPLACE FUNCTION get_my_tailor_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tailor_id FROM profiles WHERE id = auth.uid();
$$;

-- 8. Function: tailor marks a work assignment stage complete
CREATE OR REPLACE FUNCTION tailor_mark_stage_complete(p_assignment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment RECORD;
  v_order      RECORD;
  v_tailor_id  UUID;
  v_result     JSONB;
BEGIN
  v_tailor_id := get_my_tailor_id();
  IF v_tailor_id IS NULL THEN
    RAISE EXCEPTION 'Only tailors can complete work assignments';
  END IF;

  SELECT wa.*, o.current_stage
  INTO v_assignment
  FROM work_assignments wa
  JOIN orders o ON o.id = wa.order_id
  WHERE wa.id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment not found';
  END IF;

  IF v_assignment.tailor_id != v_tailor_id THEN
    RAISE EXCEPTION 'This assignment belongs to another tailor';
  END IF;

  -- Advance the order stage
  CASE v_assignment.stage
    WHEN 'Cutting' THEN
      UPDATE orders SET cutting_at = now(), current_stage = 'Cutting'
      WHERE id = v_assignment.order_id AND current_stage = 'Booked';
    WHEN 'Stitching' THEN
      UPDATE orders SET stitching_at = now(), current_stage = 'Stitching'
      WHERE id = v_assignment.order_id AND current_stage IN ('Booked', 'Cutting');
    WHEN 'Ready' THEN
      UPDATE orders SET ready_at = now(), current_stage = 'Ready'
      WHERE id = v_assignment.order_id AND current_stage IN ('Booked', 'Cutting', 'Stitching');
    ELSE
      RAISE EXCEPTION 'Stage % cannot be completed by tailor', v_assignment.stage;
  END CASE;

  -- Record history
  INSERT INTO order_stage_history (order_id, from_stage, to_stage, changed_by)
  VALUES (v_assignment.order_id, v_assignment.current_stage,
    CASE v_assignment.stage
      WHEN 'Cutting' THEN 'Cutting'::order_stage
      WHEN 'Stitching' THEN 'Stitching'::order_stage
      WHEN 'Ready' THEN 'Ready'::order_stage
    END,
    auth.uid());

  SELECT row_to_json(o)::jsonb INTO v_result
  FROM (SELECT * FROM orders WHERE id = v_assignment.order_id) o;

  RETURN v_result;
END;
$$;

-- 9. Function: safe order view for tailors (no price/balance columns)
CREATE OR REPLACE FUNCTION get_tailor_my_work()
RETURNS TABLE(
  assignment_id UUID,
  order_id      UUID,
  order_number  TEXT,
  stage         order_stage,
  assigned_at   TIMESTAMPTZ,
  garment_name  TEXT,
  quantity      INTEGER,
  delivery_date DATE,
  notes         TEXT,
  customer_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wa.id,
    o.id,
    o.order_number,
    wa.stage,
    wa.assigned_at,
    (SELECT string_agg(oi.garment_name, ', ') FROM order_items oi WHERE oi.order_id = o.id),
    (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id)::INTEGER,
    o.delivery_date,
    o.notes,
    c.name
  FROM work_assignments wa
  JOIN orders o ON o.id = wa.order_id
  JOIN customers c ON c.id = o.customer_id
  WHERE wa.tailor_id = get_my_tailor_id()
    AND o.current_stage NOT IN ('Delivered')
  ORDER BY wa.assigned_at DESC;
$$;

-- 10. Function: tailor work history
CREATE OR REPLACE FUNCTION get_tailor_my_history()
RETURNS TABLE(
  assignment_id UUID,
  order_id      UUID,
  order_number  TEXT,
  stage         order_stage,
  assigned_at   TIMESTAMPTZ,
  garment_name  TEXT,
  quantity      INTEGER,
  completed_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wa.id,
    o.id,
    o.order_number,
    wa.stage,
    wa.assigned_at,
    (SELECT string_agg(oi.garment_name, ', ') FROM order_items oi WHERE oi.order_id = o.id),
    (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id)::INTEGER,
    CASE wa.stage
      WHEN 'Cutting' THEN o.cutting_at
      WHEN 'Stitching' THEN o.stitching_at
      WHEN 'Ready' THEN o.ready_at
      ELSE o.delivered_at
    END
  FROM work_assignments wa
  JOIN orders o ON o.id = wa.order_id
  WHERE wa.tailor_id = get_my_tailor_id()
    AND o.current_stage IN ('Delivered')
  ORDER BY wa.assigned_at DESC;
$$;

-- 11. Function: tailor's own earnings (no parameters — resolves from auth)
CREATE OR REPLACE FUNCTION get_my_tailor_ledger()
RETURNS TABLE(
  date            DATE,
  description     TEXT,
  ref             TEXT,
  debit           NUMERIC,
  credit          NUMERIC,
  running_balance NUMERIC,
  entry_type      TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_profile AS (
    SELECT tailor_id, tenant_id FROM profiles WHERE id = auth.uid()
  ),
  combined AS (
    SELECT
      wa.assigned_at::DATE AS date,
      ('Work - ' || wa.stage)::TEXT AS description,
      o.order_number AS ref,
      COALESCE(wa.amount, 0) AS debit,
      0::NUMERIC AS credit,
      wa.assigned_at AS sort_key,
      'assignment'::TEXT AS entry_type
    FROM work_assignments wa
    JOIN orders o ON o.id = wa.order_id
    JOIN my_profile mp ON mp.tailor_id IS NOT NULL
    WHERE wa.tailor_id = mp.tailor_id

    UNION ALL

    SELECT
      tp.payment_date AS date,
      COALESCE(tp.notes, 'Payment') AS description,
      tp.payment_mode AS ref,
      0::NUMERIC AS debit,
      tp.amount AS credit,
      tp.created_at AS sort_key,
      'payment'::TEXT AS entry_type
    FROM tailor_payments tp
    JOIN my_profile mp ON mp.tailor_id IS NOT NULL
    WHERE tp.tailor_id = mp.tailor_id
  )
  SELECT
    c.date, c.description, c.ref, c.debit, c.credit,
    SUM(c.debit - c.credit) OVER (ORDER BY c.sort_key, c.date) AS running_balance,
    c.entry_type
  FROM combined c
  WHERE EXISTS (SELECT 1 FROM my_profile) -- only if profile exists
  ORDER BY c.sort_key, c.date;
$$;

-- 12. Function: list team members for owner/admin
CREATE OR REPLACE FUNCTION get_team_members(p_tenant_id UUID)
RETURNS TABLE(
  user_id    UUID,
  full_name  TEXT,
  email      TEXT,
  role       TEXT,
  tailor_id  UUID,
  tailor_name TEXT,
  invited    BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    u.email::TEXT,
    p.role::TEXT,
    p.tailor_id,
    t.name,
    COALESCE(t.invited, false),
    p.created_at
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN tailors t ON t.id = p.tailor_id
  WHERE p.tenant_id = p_tenant_id
  ORDER BY p.created_at;
$$;

-- 13. Function: remove team member (owner only)
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

  DELETE FROM profiles WHERE id = p_user_id AND tenant_id = p_tenant_id;
END;
$$;
