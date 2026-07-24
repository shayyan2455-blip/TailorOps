CREATE OR REPLACE FUNCTION record_order_payment(
  p_tenant_id UUID, p_order_id UUID, p_amount NUMERIC,
  p_payment_date DATE, p_payment_mode TEXT, p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_payment_id UUID;
BEGIN
  SELECT customer_id INTO v_customer_id
  FROM orders WHERE id = p_order_id AND tenant_id = p_tenant_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Order not found for this tenant';
  END IF;

  INSERT INTO payments (tenant_id, order_id, customer_id, amount, payment_date, payment_mode, notes)
  VALUES (p_tenant_id, p_order_id, v_customer_id, p_amount, p_payment_date, p_payment_mode, p_notes)
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;
