-- ============================================================
-- 0019 — Fix expenses schema (runs standalone after 0018)
-- Ensures all columns + functions exist regardless of 0018 state
-- ============================================================

-- Ensure all columns exist on expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payee_name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS credit NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Ensure expense_payments exists
CREATE TABLE IF NOT EXISTS expense_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  expense_id      UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL,
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode    TEXT,
  notes           TEXT,
  invoice_number  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expense_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON expense_payments;
CREATE POLICY tenant_isolation ON expense_payments FOR ALL USING (tenant_id = current_tenant_id());

-- Ensure invoice sequence table exists
CREATE TABLE IF NOT EXISTS expense_invoice_sequences (
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year         TEXT NOT NULL,
  last_number  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, year)
);

-- Recreate all functions (DROP first to handle return type changes)

DROP FUNCTION IF EXISTS generate_expense_invoice_number(uuid);
CREATE FUNCTION generate_expense_invoice_number(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE yr TEXT; next_num INTEGER;
BEGIN
  yr := to_char(now(), 'YYYY');
  INSERT INTO expense_invoice_sequences (tenant_id, year, last_number)
  VALUES (p_tenant_id, yr, 0) ON CONFLICT (tenant_id, year) DO NOTHING;
  UPDATE expense_invoice_sequences SET last_number = last_number + 1
  WHERE tenant_id = p_tenant_id AND year = yr RETURNING last_number INTO next_num;
  RETURN 'EP-' || yr || '-' || LPAD(next_num::text, 4, '0');
END;
$$;

DROP FUNCTION IF EXISTS record_expense_payment(uuid,uuid,numeric,date,text,text);
CREATE FUNCTION record_expense_payment(
  p_tenant_id UUID, p_expense_id UUID, p_amount NUMERIC,
  p_payment_date DATE, p_payment_mode TEXT, p_notes TEXT
)
RETURNS TABLE(payment_id UUID, applied_amount NUMERIC, credit_stored NUMERIC, invoice_number TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_balance NUMERIC; v_excess NUMERIC; v_payment_id UUID; v_invoice TEXT; v_new_paid NUMERIC;
BEGIN
  SELECT total_amount - amount_paid - credit INTO v_balance FROM expenses WHERE id = p_expense_id;
  IF v_balance > 0 THEN v_excess := GREATEST(0, p_amount - v_balance); ELSE v_excess := p_amount; END IF;
  v_invoice := generate_expense_invoice_number(p_tenant_id);
  INSERT INTO expense_payments (tenant_id, expense_id, amount, payment_date, payment_mode, notes, invoice_number)
  VALUES (p_tenant_id, p_expense_id, p_amount, p_payment_date, p_payment_mode, p_notes, v_invoice) RETURNING id INTO v_payment_id;
  v_new_paid := p_amount - v_excess;
  UPDATE expenses SET amount_paid = amount_paid + v_new_paid, credit = credit + v_excess WHERE id = p_expense_id;
  payment_id := v_payment_id; applied_amount := v_new_paid; credit_stored := v_excess; invoice_number := v_invoice;
  RETURN NEXT;
END;
$$;

DROP FUNCTION IF EXISTS apply_expense_credit(uuid,uuid);
CREATE FUNCTION apply_expense_credit(p_expense_id UUID, p_tenant_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_payee TEXT; v_credit NUMERIC; v_balance NUMERIC; v_apply NUMERIC; v_expense RECORD;
BEGIN
  SELECT * INTO v_expense FROM expenses WHERE id = p_expense_id; IF NOT FOUND THEN RETURN 0; END IF;
  SELECT COALESCE(SUM(credit), 0) INTO v_credit
  FROM expenses WHERE tenant_id = p_tenant_id AND payee_name = v_expense.payee_name AND id != p_expense_id;
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
    UPDATE expenses e SET credit = e.credit - LEAST(e.credit, v_apply) FROM credit_src cs WHERE e.id = cs.id;
  END IF;
  RETURN v_apply;
END;
$$;

DROP FUNCTION IF EXISTS get_expense_ledgers(uuid);
CREATE FUNCTION get_expense_ledgers(p_tenant_id UUID)
RETURNS TABLE(expense_id UUID, description TEXT, payee_name TEXT, total_amount NUMERIC, amount_paid NUMERIC, balance NUMERIC, credit_balance NUMERIC)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, e.description, e.payee_name, e.total_amount, e.amount_paid, e.total_amount - e.amount_paid, e.credit
  FROM expenses e WHERE e.tenant_id = p_tenant_id ORDER BY e.created_at DESC;
$$;

DROP FUNCTION IF EXISTS get_expense_ledger_detail(uuid,uuid);
CREATE FUNCTION get_expense_ledger_detail(p_expense_id UUID, p_tenant_id UUID)
RETURNS TABLE(date DATE, description TEXT, ref TEXT, debit NUMERIC, credit NUMERIC, running_balance NUMERIC, entry_type TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  WITH combined AS (
    SELECT e.created_at::DATE AS date, e.description, 'Expense' AS ref, e.total_amount AS debit, 0::NUMERIC AS credit, e.created_at AS sort_key, 'expense' AS entry_type
    FROM expenses e WHERE e.id = p_expense_id
    UNION ALL
    SELECT ep.payment_date AS date, CASE WHEN ep.payment_mode = 'Credit' THEN 'Credit applied' ELSE COALESCE(ep.notes, 'Payment') END, COALESCE(ep.invoice_number, ep.payment_mode), 0::NUMERIC, ep.amount, ep.created_at, 'payment'
    FROM expense_payments ep WHERE ep.expense_id = p_expense_id
  )
  SELECT c.date, c.description, c.ref, c.debit, c.credit, SUM(c.debit - c.credit) OVER (ORDER BY c.sort_key, c.date), c.entry_type
  FROM combined c ORDER BY c.sort_key, c.date;
$$;
