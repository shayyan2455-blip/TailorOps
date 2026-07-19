-- Make generate_order_number() SECURITY DEFINER to bypass RLS
-- (in case tenant_order_sequences has RLS enabled)

CREATE OR REPLACE FUNCTION generate_order_number(p_tenant_id UUID)
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

  INSERT INTO tenant_order_sequences (tenant_id, year, last_number)
  VALUES (p_tenant_id, yr, 0)
  ON CONFLICT (tenant_id, year) DO NOTHING;

  UPDATE tenant_order_sequences
  SET last_number = last_number + 1
  WHERE tenant_id = p_tenant_id AND year = yr
  RETURNING last_number INTO next_num;

  RETURN 'TOD-' || yr || '-' || LPAD(next_num::text, 4, '0');
END;
$$;
