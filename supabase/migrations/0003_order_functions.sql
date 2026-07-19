-- ============================================================
-- Phase 4 — Per-tenant sequential order numbering
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_order_sequences (
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year         TEXT NOT NULL,
  last_number  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, year)
);

CREATE OR REPLACE FUNCTION generate_order_number(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  yr       TEXT;
  next_num INTEGER;
BEGIN
  yr := to_char(now(), 'YYYY');

  -- Ensure a counter row exists for this tenant + year
  INSERT INTO tenant_order_sequences (tenant_id, year, last_number)
  VALUES (p_tenant_id, yr, 0)
  ON CONFLICT (tenant_id, year) DO NOTHING;

  -- Atomically increment and return
  UPDATE tenant_order_sequences
  SET last_number = last_number + 1
  WHERE tenant_id = p_tenant_id AND year = yr
  RETURNING last_number INTO next_num;

  RETURN 'TOD-' || yr || '-' || LPAD(next_num::text, 4, '0');
END;
$$;
