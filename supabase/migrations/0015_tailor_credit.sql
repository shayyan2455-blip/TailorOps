-- ============================================================
-- 0015 — Tailor credit: overpayment → credit, auto-apply,
--         ledger balance accounts for credit
-- ============================================================

-- 1. Add credit column to tailors
ALTER TABLE tailors ADD COLUMN IF NOT EXISTS credit NUMERIC NOT NULL DEFAULT 0;

-- 2. record_tailor_payment: only store applied portion, excess → credit
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
  v_total_assign  NUMERIC;
  v_total_paid    NUMERIC;
  v_existing_cred NUMERIC;
  v_net_balance   NUMERIC;
  v_applied       NUMERIC;
  v_credit_added  NUMERIC;
  v_payment_id    UUID;
BEGIN
  SELECT COALESCE(SUM(wa.amount), 0) INTO v_total_assign
  FROM work_assignments wa WHERE wa.tailor_id = p_tailor_id AND wa.tenant_id = p_tenant_id;

  SELECT COALESCE(SUM(tp.amount), 0) INTO v_total_paid
  FROM tailor_payments tp WHERE tp.tailor_id = p_tailor_id AND tp.tenant_id = p_tenant_id;

  SELECT COALESCE(credit, 0) INTO v_existing_cred FROM tailors WHERE id = p_tailor_id;

  v_net_balance := v_total_assign - v_total_paid - v_existing_cred;

  IF v_net_balance > 0 THEN
    v_applied := LEAST(p_amount, v_net_balance);
    v_credit_added := p_amount - v_applied;
  ELSE
    v_applied := 0;
    v_credit_added := p_amount;
  END IF;

  IF v_applied > 0 THEN
    INSERT INTO tailor_payments (tenant_id, tailor_id, amount, payment_date, payment_mode, notes)
    VALUES (p_tenant_id, p_tailor_id, v_applied, p_payment_date, p_payment_mode, p_notes)
    RETURNING id INTO v_payment_id;
  ELSE
    v_payment_id := NULL;
  END IF;

  IF v_credit_added > 0 THEN
    UPDATE tailors SET credit = COALESCE(credit, 0) + v_credit_added WHERE id = p_tailor_id;
  END IF;

  payment_id := v_payment_id;
  applied_amount := v_applied;
  credit_stored := v_credit_added;
  RETURN NEXT;
END;
$$;

-- 3. Apply tailor credit to a work assignment (called after setting amount)
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

  INSERT INTO tailor_payments (tenant_id, tailor_id, amount, payment_date, payment_mode, notes)
  VALUES (p_tenant_id, p_tailor_id, v_apply, CURRENT_DATE, 'Credit', 'Auto-applied from tailor credit');

  UPDATE tailors SET credit = credit - v_apply WHERE id = p_tailor_id;

  RETURN v_apply;
END;
$$;

-- 4. Update get_tailor_ledgers — balance = total_assign - total_paid - credit
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
    t.id,
    t.name,
    COALESCE(wv.total, 0),
    COALESCE(pt.total, 0),
    COALESCE(wv.total, 0) - COALESCE(pt.total, 0) - COALESCE(t.credit, 0),
    t.mobile,
    COALESCE(t.credit, 0)
  FROM tailors t
  LEFT JOIN work_value wv ON wv.tailor_id = t.id
  LEFT JOIN pay_total pt ON pt.tailor_id = t.id
  WHERE t.tenant_id = p_tenant_id
  ORDER BY t.name;
$$;

-- 5. Update get_tailor_ledger_detail — descriptive entry for Credit-mode payments
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
      CASE WHEN tp.payment_mode = 'Credit' THEN 'Credit applied' ELSE COALESCE(tp.notes, 'Payment') END AS description,
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
