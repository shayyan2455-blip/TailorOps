-- ============================================================
-- 0016 — Store full tailor payment amounts; credit is meta
--         Remove Credit Bal. column from ledger formulas.
--         apply_tailor_credit just reduces credit (no payment).
-- ============================================================

-- 1. record_tailor_payment: store FULL amount, excess → credit
DROP FUNCTION IF EXISTS record_tailor_payment(uuid,uuid,numeric,date,text,text);
CREATE FUNCTION record_tailor_payment(
  p_tenant_id    UUID,
  p_tailor_id    UUID,
  p_amount       NUMERIC,
  p_payment_date DATE,
  p_payment_mode TEXT,
  p_notes        TEXT
)
RETURNS TABLE(
  payment_id     UUID,
  applied_amount NUMERIC,
  credit_stored  NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_assign NUMERIC;
  v_total_paid   NUMERIC;
  v_balance      NUMERIC;
  v_excess       NUMERIC;
  v_payment_id   UUID;
BEGIN
  SELECT COALESCE(SUM(wa.amount), 0) INTO v_total_assign
  FROM work_assignments wa WHERE wa.tailor_id = p_tailor_id AND wa.tenant_id = p_tenant_id;

  SELECT COALESCE(SUM(tp.amount), 0) INTO v_total_paid
  FROM tailor_payments tp WHERE tp.tailor_id = p_tailor_id AND tp.tenant_id = p_tenant_id;

  v_balance := v_total_assign - v_total_paid;

  IF v_balance > 0 THEN
    v_excess := GREATEST(0, p_amount - v_balance);
  ELSE
    v_excess := p_amount;
  END IF;

  INSERT INTO tailor_payments (tenant_id, tailor_id, amount, payment_date, payment_mode, notes)
  VALUES (p_tenant_id, p_tailor_id, p_amount, p_payment_date, p_payment_mode, p_notes)
  RETURNING id INTO v_payment_id;

  IF v_excess > 0 THEN
    UPDATE tailors SET credit = COALESCE(credit, 0) + v_excess WHERE id = p_tailor_id;
  END IF;

  payment_id     := v_payment_id;
  applied_amount := p_amount - v_excess;
  credit_stored  := v_excess;
  RETURN NEXT;
END;
$$;

-- 2. apply_tailor_credit: just reduce credit, no payment row created
DROP FUNCTION IF EXISTS apply_tailor_credit(uuid,uuid,text,uuid);
CREATE FUNCTION apply_tailor_credit(
  p_tailor_id UUID,
  p_order_id  UUID,
  p_stage     TEXT,
  p_tenant_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit     NUMERIC;
  v_assign_amt NUMERIC;
  v_apply      NUMERIC;
BEGIN
  SELECT COALESCE(credit, 0) INTO v_credit FROM tailors WHERE id = p_tailor_id;
  IF v_credit <= 0 THEN RETURN 0; END IF;

  SELECT COALESCE(wa.amount, 0) INTO v_assign_amt
  FROM work_assignments wa
  WHERE wa.order_id = p_order_id AND wa.stage = p_stage AND wa.tailor_id = p_tailor_id;

  IF v_assign_amt <= 0 THEN RETURN 0; END IF;

  v_apply := LEAST(v_credit, v_assign_amt);
  UPDATE tailors SET credit = credit - v_apply WHERE id = p_tailor_id;
  RETURN v_apply;
END;
$$;

-- 3. get_tailor_ledgers: balance = total_assign - total_paid (simple)
DROP FUNCTION IF EXISTS get_tailor_ledgers(uuid);
CREATE FUNCTION get_tailor_ledgers(p_tenant_id UUID)
RETURNS TABLE(
  tailor_id      UUID,
  tailor_name    TEXT,
  total_amount   NUMERIC,
  total_paid     NUMERIC,
  balance        NUMERIC,
  mobile         TEXT,
  credit_balance NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH work_value AS (
    SELECT wa.tailor_id, COALESCE(SUM(wa.amount), 0) AS total
    FROM work_assignments wa WHERE wa.tenant_id = p_tenant_id
    GROUP BY wa.tailor_id
  ),
  pay_total AS (
    SELECT tp.tailor_id, COALESCE(SUM(tp.amount), 0) AS total
    FROM tailor_payments tp WHERE tp.tenant_id = p_tenant_id
    GROUP BY tp.tailor_id
  )
  SELECT
    t.id, t.name,
    COALESCE(wv.total, 0),
    COALESCE(pt.total, 0),
    COALESCE(wv.total, 0) - COALESCE(pt.total, 0),
    t.mobile,
    COALESCE(t.credit, 0)
  FROM tailors t
  LEFT JOIN work_value wv ON wv.tailor_id = t.id
  LEFT JOIN pay_total pt ON pt.tailor_id = t.id
  WHERE t.tenant_id = p_tenant_id
  ORDER BY t.name;
$$;

-- 4. get_tailor_ledger_detail: show everything, no special credit entries
DROP FUNCTION IF EXISTS get_tailor_ledger_detail(uuid,uuid);
CREATE FUNCTION get_tailor_ledger_detail(
  p_tailor_id UUID,
  p_tenant_id UUID
)
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
SECURITY DEFINER
SET search_path = public
AS $$
  WITH combined AS (
    SELECT
      wa.assigned_at::DATE AS date,
      ('Work - ' || wa.stage) AS description,
      o.order_number AS ref,
      COALESCE(wa.amount, 0) AS debit,
      0::NUMERIC AS credit,
      wa.assigned_at AS sort_key,
      'assignment' AS entry_type
    FROM work_assignments wa
    JOIN orders o ON o.id = wa.order_id
    WHERE wa.tailor_id = p_tailor_id AND o.tenant_id = p_tenant_id

    UNION ALL

    SELECT
      tp.payment_date AS date,
      COALESCE(tp.notes, 'Payment') AS description,
      tp.payment_mode AS ref,
      0::NUMERIC AS debit,
      tp.amount AS credit,
      tp.created_at AS sort_key,
      'payment' AS entry_type
    FROM tailor_payments tp
    WHERE tp.tailor_id = p_tailor_id AND tp.tenant_id = p_tenant_id
  )
  SELECT
    c.date, c.description, c.ref,
    c.debit, c.credit,
    SUM(c.debit - c.credit) OVER (ORDER BY c.sort_key, c.date) AS running_balance,
    c.entry_type
  FROM combined c
  ORDER BY c.sort_key, c.date;
$$;

-- 5. get_customer_ledgers: balance = total_orders - total_paid - credit
--    (keep from 0014 but drop credit_balance from output)
DROP FUNCTION IF EXISTS get_customer_ledgers(uuid);
CREATE FUNCTION get_customer_ledgers(p_tenant_id UUID)
RETURNS TABLE(
  customer_id    UUID,
  customer_name  TEXT,
  total_orders   NUMERIC,
  total_paid     NUMERIC,
  balance        NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH order_totals AS (
    SELECT customer_id, SUM(total_amount) AS total
    FROM orders WHERE tenant_id = p_tenant_id
    GROUP BY customer_id
  ),
  payment_totals AS (
    SELECT p.customer_id,
      COALESCE(SUM(p.amount), 0) AS total_all,
      COALESCE(SUM(CASE WHEN p.order_id IS NOT NULL THEN p.amount ELSE 0 END), 0) AS total_applied
    FROM payments p
    WHERE p.tenant_id = p_tenant_id AND p.customer_id IS NOT NULL
    GROUP BY p.customer_id
  )
  SELECT
    c.id, c.name,
    COALESCE(ot.total, 0),
    COALESCE(pt.total_all, 0),
    COALESCE(ot.total, 0) - COALESCE(pt.total_applied, 0) - COALESCE(c.credit, 0)
  FROM customers c
  LEFT JOIN order_totals ot ON ot.customer_id = c.id
  LEFT JOIN payment_totals pt ON pt.customer_id = c.id
  WHERE c.tenant_id = p_tenant_id
  ORDER BY c.name;
$$;
