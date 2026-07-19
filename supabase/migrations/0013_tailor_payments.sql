-- ============================================================
-- 0013 — Tailor payments table + ledger functions
-- ============================================================

CREATE TABLE IF NOT EXISTS tailor_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tailor_id     UUID NOT NULL REFERENCES tailors(id) ON DELETE CASCADE,
  amount        NUMERIC(10,2) NOT NULL,
  payment_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode  TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tailor_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tailor_payments;
CREATE POLICY tenant_isolation ON tailor_payments FOR ALL USING (tenant_id = current_tenant_id());

-- Add amount column to work_assignments for stage-level work value
ALTER TABLE work_assignments ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2);

DROP FUNCTION IF EXISTS get_tailor_ledgers(uuid);
CREATE FUNCTION get_tailor_ledgers(p_tenant_id UUID)
RETURNS TABLE(
  tailor_id   UUID,
  tailor_name TEXT,
  total_amount NUMERIC,
  total_paid  NUMERIC,
  balance     NUMERIC,
  mobile      TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH work_value AS (
    SELECT
      wa.tailor_id,
      COALESCE(SUM(wa.amount), 0) AS total
    FROM work_assignments wa
    WHERE wa.tenant_id = p_tenant_id
    GROUP BY wa.tailor_id
  ),
  pay_total AS (
    SELECT
      tp.tailor_id,
      COALESCE(SUM(tp.amount), 0) AS paid
    FROM tailor_payments tp
    WHERE tp.tenant_id = p_tenant_id
    GROUP BY tp.tailor_id
  )
  SELECT
    t.id,
    t.name,
    COALESCE(wv.total, 0) AS total_amount,
    COALESCE(pt.paid, 0) AS total_paid,
    COALESCE(wv.total, 0) - COALESCE(pt.paid, 0) AS balance,
    t.mobile
  FROM tailors t
  LEFT JOIN work_value wv ON wv.tailor_id = t.id
  LEFT JOIN pay_total pt ON pt.tailor_id = t.id
  WHERE t.tenant_id = p_tenant_id
  ORDER BY t.name;
$$;

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
    c.date,
    c.description,
    c.ref,
    c.debit,
    c.credit,
    SUM(c.debit - c.credit) OVER (ORDER BY c.sort_key, c.date) AS running_balance,
    c.entry_type
  FROM combined c
  ORDER BY c.sort_key, c.date;
$$;

DROP FUNCTION IF EXISTS record_tailor_payment(uuid,uuid,numeric,date,text,text);
CREATE OR REPLACE FUNCTION record_tailor_payment(
  p_tenant_id    UUID,
  p_tailor_id    UUID,
  p_amount       NUMERIC,
  p_payment_date DATE,
  p_payment_mode TEXT,
  p_notes        TEXT
)
RETURNS TABLE(payment_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id UUID;
BEGIN
  INSERT INTO tailor_payments (tenant_id, tailor_id, amount, payment_date, payment_mode, notes)
  VALUES (p_tenant_id, p_tailor_id, p_amount, p_payment_date, p_payment_mode, p_notes)
  RETURNING id INTO v_payment_id;

  payment_id := v_payment_id;
  RETURN NEXT;
END;
$$;
