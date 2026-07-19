-- 1. Add credit column to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit NUMERIC NOT NULL DEFAULT 0;

-- 2. Updated distribute_customer_payment — stores excess as customer credit
DROP FUNCTION IF EXISTS distribute_customer_payment(uuid,numeric,date,text,text,uuid);
CREATE FUNCTION distribute_customer_payment(
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
  order_balance  NUMERIC,
  credit_stored  NUMERIC
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
  v_existing_credit NUMERIC;
BEGIN
  -- Use any existing credit first
  SELECT COALESCE(credit, 0) INTO v_existing_credit FROM customers WHERE id = p_customer_id;
  v_remaining := v_remaining + v_existing_credit;
  UPDATE customers SET credit = 0 WHERE id = p_customer_id;

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
      credit_stored := 0;
      RETURN NEXT;

      v_remaining := v_remaining - v_alloc;
      IF v_remaining <= 0 THEN EXIT; END IF;
    END IF;
  END LOOP;

  -- Store remainder as customer credit
  IF v_remaining > 0 THEN
    UPDATE customers SET credit = COALESCE(credit, 0) + v_remaining WHERE id = p_customer_id;
    IF NOT v_any_alloc THEN
      payment_id    := NULL;
      order_id      := NULL;
      order_number  := 'CREDIT_ONLY';
      allocated     := 0;
      order_balance := 0;
      credit_stored := v_remaining;
      RETURN NEXT;
    END IF;
  END IF;

  IF NOT v_any_alloc AND v_remaining <= 0 THEN
    payment_id    := NULL;
    order_id      := NULL;
    order_number  := 'NO_UNPAID_ORDERS';
    allocated     := 0;
    order_balance := p_amount;
    credit_stored := 0;
    RETURN NEXT;
  END IF;
END;
$$;

-- 3. Apply stored credit to a newly created order
DROP FUNCTION IF EXISTS apply_customer_credit(uuid,uuid,uuid);
CREATE FUNCTION apply_customer_credit(
  p_customer_id UUID,
  p_order_id    UUID,
  p_tenant_id   UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit      NUMERIC;
  v_order_total NUMERIC;
  v_apply       NUMERIC;
BEGIN
  SELECT COALESCE(credit, 0) INTO v_credit FROM customers WHERE id = p_customer_id;
  IF v_credit <= 0 THEN RETURN 0; END IF;

  SELECT total_amount INTO v_order_total FROM orders WHERE id = p_order_id;

  v_apply := LEAST(v_credit, v_order_total);

  INSERT INTO payments (tenant_id, order_id, amount, payment_date, payment_mode, notes)
  VALUES (p_tenant_id, p_order_id, v_apply, CURRENT_DATE, 'Credit', 'Auto-applied from customer credit');

  UPDATE customers SET credit = credit - v_apply WHERE id = p_customer_id;

  RETURN v_apply;
END;
$$;
