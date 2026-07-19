-- ============================================================
-- 0013 — Tailor payments table + ledger functions
-- ============================================================

CREATE TABLE tailor_payments (
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
CREATE POLICY tenant_isolation ON tailor_payments FOR ALL USING (tenant_id = current_tenant_id());

CREATE OR REPLACE FUNCTION get_tailor_ledgers(p_tenant_id UUID)
RETURNS TABLE(
  tailor_id   UUID,
  tailor_name TEXT,
  total_paid  NUMERIC,
  mobile      TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.name,
    COALESCE(SUM(tp.amount), 0) AS total_paid,
    t.mobile
  FROM tailors t
  LEFT JOIN tailor_payments tp ON tp.tailor_id = t.id AND tp.tenant_id = p_tenant_id
  WHERE t.tenant_id = p_tenant_id
  GROUP BY t.id, t.name, t.mobile
  ORDER BY t.name;
$$;

CREATE OR REPLACE FUNCTION get_tailor_ledger(
  p_tailor_id UUID,
  p_tenant_id UUID
)
RETURNS TABLE(
  date        DATE,
  description TEXT,
  amount      NUMERIC,
  mode        TEXT,
  created_at  TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tp.payment_date AS date,
    COALESCE(tp.notes, 'Payment') AS description,
    tp.amount,
    tp.payment_mode AS mode,
    tp.created_at
  FROM tailor_payments tp
  WHERE tp.tailor_id = p_tailor_id AND tp.tenant_id = p_tenant_id
  ORDER BY tp.payment_date ASC, tp.created_at ASC;
$$;

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
