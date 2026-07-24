-- ============================================================
-- 0031 — Fix expense column: use `amount` instead of `total_amount`
-- The production DB column is `amount`, but RPCs referenced `total_amount`
-- ============================================================

-- 1. Migrate column if needed (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'expenses' AND column_name = 'amount') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'expenses' AND column_name = 'total_amount') THEN
      ALTER TABLE expenses RENAME COLUMN total_amount TO amount;
    ELSE
      ALTER TABLE expenses ADD COLUMN amount NUMERIC(10,2) NOT NULL DEFAULT 0;
    END IF;
  END IF;
END $$;

-- 2. Record expense payment — use `amount` instead of `total_amount`
DROP FUNCTION IF EXISTS record_expense_payment(uuid,uuid,numeric,date,text,text);
CREATE FUNCTION record_expense_payment(
  p_tenant_id    UUID,
  p_expense_id   UUID,
  p_amount       NUMERIC,
  p_payment_date DATE,
  p_payment_mode TEXT,
  p_notes        TEXT
)
RETURNS TABLE(
  payment_id     UUID,
  applied_amount NUMERIC,
  credit_stored  NUMERIC,
  invoice_number TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance      NUMERIC;
  v_excess       NUMERIC;
  v_payment_id   UUID;
  v_invoice      TEXT;
  v_new_paid     NUMERIC;
BEGIN
  SELECT amount - amount_paid - credit INTO v_balance
  FROM expenses WHERE id = p_expense_id;

  IF v_balance > 0 THEN
    v_excess := GREATEST(0, p_amount - v_balance);
  ELSE
    v_excess := p_amount;
  END IF;

  v_invoice := generate_expense_invoice_number(p_tenant_id);

  INSERT INTO expense_payments (tenant_id, expense_id, amount, payment_date, payment_mode, notes, invoice_number)
  VALUES (p_tenant_id, p_expense_id, p_amount, p_payment_date, p_payment_mode, p_notes, v_invoice)
  RETURNING id INTO v_payment_id;

  v_new_paid := p_amount - v_excess;
  UPDATE expenses
  SET amount_paid = amount_paid + v_new_paid,
      credit = credit + v_excess
  WHERE id = p_expense_id;

  payment_id     := v_payment_id;
  applied_amount := v_new_paid;
  credit_stored  := v_excess;
  invoice_number := v_invoice;
  RETURN NEXT;
END;
$$;

-- 3. Apply expense credit — use `amount` instead of `total_amount`
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

  -- Find if same payee has credit from another expense
  SELECT COALESCE(SUM(credit), 0) INTO v_credit
  FROM expenses
  WHERE tenant_id = p_tenant_id AND payee_name = v_expense.payee_name AND id != p_expense_id;

  IF v_credit <= 0 THEN RETURN 0; END IF;

  v_balance := v_expense.amount - v_expense.amount_paid;
  v_apply := LEAST(v_credit, v_balance);

  IF v_apply > 0 THEN
    INSERT INTO expense_payments (tenant_id, expense_id, amount, payment_date, payment_mode, notes, invoice_number)
    VALUES (p_tenant_id, p_expense_id, v_apply, CURRENT_DATE, 'Credit', 'Auto-applied from expense credit', generate_expense_invoice_number(p_tenant_id));

    UPDATE expenses SET amount_paid = amount_paid + v_apply WHERE id = p_expense_id;

    -- Reduce credit from the source expense(s)
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

-- 4. Get expense ledgers — use `amount` instead of `total_amount`
DROP FUNCTION IF EXISTS get_expense_ledgers(uuid);
CREATE FUNCTION get_expense_ledgers(p_tenant_id UUID)
RETURNS TABLE(
  expense_id    UUID,
  description   TEXT,
  payee_name    TEXT,
  amount        NUMERIC,
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
    e.amount,
    e.amount_paid,
    e.amount - e.amount_paid,
    e.credit
  FROM expenses e
  WHERE e.tenant_id = p_tenant_id
  ORDER BY e.created_at DESC;
$$;

-- 5. Get expense ledger detail — use `amount` instead of `total_amount`
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
      e.amount AS debit,
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
