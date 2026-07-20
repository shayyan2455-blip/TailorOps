-- ============================================================
-- 0019 — Fix: ensure expenses.payee_name column exists
-- ============================================================

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payee_name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS credit NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Recreate functions that reference these columns

DROP FUNCTION IF EXISTS get_expense_ledgers(uuid);
CREATE FUNCTION get_expense_ledgers(p_tenant_id UUID)
RETURNS TABLE(
  expense_id    UUID,
  description   TEXT,
  payee_name    TEXT,
  total_amount  NUMERIC,
  amount_paid   NUMERIC,
  balance       NUMERIC,
  credit_balance NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id, e.description, e.payee_name,
    e.total_amount,
    e.amount_paid,
    e.total_amount - e.amount_paid,
    e.credit
  FROM expenses e
  WHERE e.tenant_id = p_tenant_id
  ORDER BY e.created_at DESC;
$$;

DROP FUNCTION IF EXISTS apply_expense_credit(uuid,uuid);
CREATE FUNCTION apply_expense_credit(
  p_expense_id UUID,
  p_tenant_id  UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payee       TEXT;
  v_credit      NUMERIC;
  v_balance     NUMERIC;
  v_apply       NUMERIC;
  v_expense     RECORD;
BEGIN
  SELECT * INTO v_expense FROM expenses WHERE id = p_expense_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(credit), 0) INTO v_credit
  FROM expenses
  WHERE tenant_id = p_tenant_id AND payee_name = v_expense.payee_name AND id != p_expense_id;

  IF v_credit <= 0 THEN RETURN 0; END IF;

  v_balance := v_expense.total_amount - v_expense.amount_paid;
  v_apply := LEAST(v_credit, v_balance);

  IF v_apply > 0 THEN
    INSERT INTO expense_payments (tenant_id, expense_id, amount, payment_date, payment_mode, notes, invoice_number)
    VALUES (p_tenant_id, p_expense_id, v_apply, CURRENT_DATE, 'Credit', 'Auto-applied from expense credit', generate_expense_invoice_number(p_tenant_id));

    UPDATE expenses SET amount_paid = amount_paid + v_apply WHERE id = p_expense_id;

    WITH credit_src AS (
      SELECT id, credit FROM expenses
      WHERE tenant_id = p_tenant_id AND payee_name = v_expense.payee_name AND id != p_expense_id AND credit > 0
      ORDER BY created_at ASC
    )
    UPDATE expenses e SET credit = e.credit - LEAST(e.credit, v_apply)
    FROM credit_src cs
    WHERE e.id = cs.id;
  END IF;

  RETURN v_apply;
END;
$$;

DROP FUNCTION IF EXISTS get_expense_ledger_detail(uuid,uuid);
CREATE FUNCTION get_expense_ledger_detail(
  p_expense_id UUID,
  p_tenant_id  UUID
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
      e.created_at::DATE AS date,
      e.description AS description,
      'Expense' AS ref,
      e.total_amount AS debit,
      0::NUMERIC AS credit,
      e.created_at AS sort_key,
      'expense' AS entry_type
    FROM expenses e
    WHERE e.id = p_expense_id

    UNION ALL

    SELECT
      ep.payment_date AS date,
      CASE WHEN ep.payment_mode = 'Credit' THEN 'Credit applied' ELSE COALESCE(ep.notes, 'Payment') END AS description,
      COALESCE(ep.invoice_number, ep.payment_mode) AS ref,
      0::NUMERIC AS debit,
      ep.amount AS credit,
      ep.created_at AS sort_key,
      'payment' AS entry_type
    FROM expense_payments ep
    WHERE ep.expense_id = p_expense_id
  )
  SELECT
    c.date, c.description, c.ref,
    c.debit, c.credit,
    SUM(c.debit - c.credit) OVER (ORDER BY c.sort_key, c.date) AS running_balance,
    c.entry_type
  FROM combined c
  ORDER BY c.sort_key, c.date;
$$;
