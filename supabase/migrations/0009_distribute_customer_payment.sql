-- Distribute a customer payment across their unpaid orders (oldest first).
-- Returns one row per order that received allocation.
CREATE OR REPLACE FUNCTION distribute_customer_payment(
  p_customer_id UUID,
  p_amount      NUMERIC,
  p_payment_date DATE,
  p_payment_mode TEXT,
  p_notes       TEXT,
  p_tenant_id   UUID
)
RETURNS TABLE(
  payment_id     UUID,
  order_id       UUID,
  order_number   TEXT,
  allocated      NUMERIC,
  order_balance  NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining NUMERIC := p_amount;
  v_order     RECORD;
  v_balance   NUMERIC;
  v_alloc     NUMERIC;
  v_payment_id UUID;
  v_any_alloc BOOLEAN := false;
BEGIN
  FOR v_order IN
    SELECT o.id, o.order_number, o.total_amount
    FROM orders o
    WHERE o.customer_id = p_customer_id
      AND o.tenant_id = p_tenant_id
      AND o.current_stage != 'Delivered'
    ORDER BY o.created_at ASC
  LOOP
    SELECT COALESCE(SUM(p.amount), 0) INTO v_balance
    FROM payments p
    WHERE p.order_id = v_order.id;

    v_balance := v_order.total_amount - v_balance;
    IF v_balance > 0 THEN
      v_alloc := LEAST(v_remaining, v_balance);

      INSERT INTO payments (tenant_id, order_id, amount, payment_date, payment_mode, notes)
      VALUES (p_tenant_id, v_order.id, v_alloc, p_payment_date, p_payment_mode, p_notes)
      RETURNING id INTO v_payment_id;

      v_any_alloc := true;
      payment_id    := v_payment_id;
      order_id      := v_order.id;
      order_number  := v_order.order_number;
      allocated     := v_alloc;
      order_balance := v_balance - v_alloc;
      RETURN NEXT;

      v_remaining := v_remaining - v_alloc;
      IF v_remaining <= 0 THEN EXIT; END IF;
    END IF;
  END LOOP;

  IF NOT v_any_alloc THEN
    payment_id    := NULL;
    order_id      := NULL;
    order_number  := 'NO_UNPAID_ORDERS';
    allocated     := 0;
    order_balance := p_amount;
    RETURN NEXT;
  END IF;
END;
$$;
