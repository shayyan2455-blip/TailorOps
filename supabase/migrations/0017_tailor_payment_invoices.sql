-- ============================================================
-- 0017 — Tailor payment invoice numbers (TP-YYYY-NNNN)
-- ============================================================

-- 1. Invoice column on tailor_payments
ALTER TABLE tailor_payments ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- 2. Separate sequence table for tailor payments
CREATE TABLE IF NOT EXISTS tailor_invoice_sequences (
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year         TEXT NOT NULL,
  last_number  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, year)
);

-- 3. Generate tailor invoice number
CREATE OR REPLACE FUNCTION generate_tailor_invoice_number(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr       TEXT;
  next_num INTEGER;
BEGIN
  yr := to_char(now(), 'YYYY');
  INSERT INTO tailor_invoice_sequences (tenant_id, year, last_number)
  VALUES (p_tenant_id, yr, 0)
  ON CONFLICT (tenant_id, year) DO NOTHING;
  UPDATE tailor_invoice_sequences
  SET last_number = last_number + 1
  WHERE tenant_id = p_tenant_id AND year = yr
  RETURNING last_number INTO next_num;
  RETURN 'TP-' || yr || '-' || LPAD(next_num::text, 4, '0');
END;
$$;

-- 4. Update record_tailor_payment to generate invoice number
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
  credit_stored  NUMERIC,
  invoice_number TEXT
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
  v_invoice      TEXT;
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

  v_invoice := generate_tailor_invoice_number(p_tenant_id);

  INSERT INTO tailor_payments (tenant_id, tailor_id, amount, payment_date, payment_mode, notes, invoice_number)
  VALUES (p_tenant_id, p_tailor_id, p_amount, p_payment_date, p_payment_mode, p_notes, v_invoice)
  RETURNING id INTO v_payment_id;

  IF v_excess > 0 THEN
    UPDATE tailors SET credit = COALESCE(credit, 0) + v_excess WHERE id = p_tailor_id;
  END IF;

  payment_id     := v_payment_id;
  applied_amount := p_amount - v_excess;
  credit_stored  := v_excess;
  invoice_number := v_invoice;
  RETURN NEXT;
END;
$$;

-- 5. Update ledger detail to show invoice_number as ref
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
      COALESCE(tp.invoice_number, tp.payment_mode) AS ref,
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
