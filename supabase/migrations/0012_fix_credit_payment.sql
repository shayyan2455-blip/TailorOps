-- ============================================================
-- 0012 — Always create a payment row (even for credit-only)
-- ============================================================

ALTER TABLE payments ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;

-- Recreate distribute_customer_payment — always INSERT a payment row
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
  invoice_number TEXT,
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
  v_invoice   TEXT;
  v_any_alloc BOOLEAN := false;
  v_existing_credit NUMERIC;
BEGIN
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
      v_invoice := generate_invoice_number(p_tenant_id);

      INSERT INTO payments (tenant_id, customer_id, order_id, amount, payment_date, payment_mode, notes, invoice_number)
      VALUES (p_tenant_id, p_customer_id, v_order.id, v_alloc, p_payment_date, p_payment_mode, p_notes, v_invoice)
      RETURNING id INTO v_payment_id;

      v_any_alloc := true;
      payment_id    := v_payment_id;
      order_id      := v_order.id;
      order_number  := v_order.order_number;
      invoice_number := v_invoice;
      allocated     := v_alloc;
      order_balance := v_balance - v_alloc;
      credit_stored := 0;
      RETURN NEXT;

      v_remaining := v_remaining - v_alloc;
      IF v_remaining <= 0 THEN EXIT; END IF;
    END IF;
  END LOOP;

  -- Always create a payment row so it shows in Payments page
  -- even when the entire amount becomes credit (no unpaid orders)
  IF v_remaining > 0 THEN
    v_invoice := generate_invoice_number(p_tenant_id);
    INSERT INTO payments (tenant_id, customer_id, order_id, amount, payment_date, payment_mode, notes, invoice_number)
    VALUES (p_tenant_id, p_customer_id, NULL, v_remaining, p_payment_date, p_payment_mode,
            COALESCE(p_notes || ' — ', '') || 'Credit stored', v_invoice)
    RETURNING id INTO v_payment_id;

    UPDATE customers SET credit = COALESCE(credit, 0) + v_remaining WHERE id = p_customer_id;

    payment_id    := v_payment_id;
    order_id      := NULL;
    order_number  := 'CREDIT';
    invoice_number := v_invoice;
    allocated     := v_remaining;
    order_balance := 0;
    credit_stored := v_remaining;
    RETURN NEXT;
  END IF;

  IF NOT v_any_alloc AND v_remaining <= 0 THEN
    payment_id    := NULL;
    order_id      := NULL;
    order_number  := 'NO_UNPAID_ORDERS';
    invoice_number := NULL;
    allocated     := 0;
    order_balance := p_amount;
    credit_stored := 0;
    RETURN NEXT;
  END IF;
END;
$$;

-- Recreate apply_customer_credit with customer_id
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
  v_invoice     TEXT;
BEGIN
  SELECT COALESCE(credit, 0) INTO v_credit FROM customers WHERE id = p_customer_id;
  IF v_credit <= 0 THEN RETURN 0; END IF;

  SELECT total_amount INTO v_order_total FROM orders WHERE id = p_order_id;
  v_apply := LEAST(v_credit, v_order_total);
  v_invoice := generate_invoice_number(p_tenant_id);

  INSERT INTO payments (tenant_id, customer_id, order_id, amount, payment_date, payment_mode, notes, invoice_number)
  VALUES (p_tenant_id, p_customer_id, p_order_id, v_apply, CURRENT_DATE, 'Credit', 'Auto-applied from customer credit', v_invoice);

  UPDATE customers SET credit = credit - v_apply WHERE id = p_customer_id;
  RETURN v_apply;
END;
$$;

-- Recreate ledger functions to use payments.customer_id directly
DROP FUNCTION IF EXISTS get_customer_ledgers(uuid);
CREATE FUNCTION get_customer_ledgers(p_tenant_id UUID)
RETURNS TABLE(
  customer_id   UUID,
  customer_name TEXT,
  total_orders  NUMERIC,
  total_paid    NUMERIC,
  balance       NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH order_totals AS (
    SELECT customer_id, SUM(total_amount) AS total
    FROM orders WHERE tenant_id = p_tenant_id
    GROUP BY customer_id
  ),
  payment_totals AS (
    SELECT p.customer_id, SUM(p.amount) AS total
    FROM payments p
    WHERE p.tenant_id = p_tenant_id AND p.customer_id IS NOT NULL
    GROUP BY p.customer_id
  )
  SELECT
    c.id,
    c.name,
    COALESCE(ot.total, 0),
    COALESCE(pt.total, 0),
    COALESCE(ot.total, 0) - COALESCE(pt.total, 0)
  FROM customers c
  LEFT JOIN order_totals ot ON ot.customer_id = c.id
  LEFT JOIN payment_totals pt ON pt.customer_id = c.id
  WHERE c.tenant_id = p_tenant_id
  ORDER BY c.name;
$$;

DROP FUNCTION IF EXISTS get_customer_ledger(uuid,uuid);
CREATE FUNCTION get_customer_ledger(
  p_customer_id UUID,
  p_tenant_id   UUID
)
RETURNS TABLE(
  date            DATE,
  description     TEXT,
  invoice_or_order TEXT,
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
      o.created_at::DATE AS date,
      'Order' AS description,
      o.order_number AS invoice_or_order,
      o.total_amount AS debit,
      0::NUMERIC AS credit,
      o.created_at AS sort_key,
      'order' AS entry_type
    FROM orders o
    WHERE o.customer_id = p_customer_id AND o.tenant_id = p_tenant_id

    UNION ALL

    SELECT
      p.payment_date AS date,
      CASE WHEN p.order_id IS NULL THEN 'Credit (no order)' ELSE 'Payment' END AS description,
      COALESCE(p.invoice_number, '—') AS invoice_or_order,
      0::NUMERIC AS debit,
      p.amount AS credit,
      p.created_at AS sort_key,
      'payment' AS entry_type
    FROM payments p
    WHERE p.customer_id = p_customer_id AND p.tenant_id = p_tenant_id
  )
  SELECT
    c.date,
    c.description,
    c.invoice_or_order,
    c.debit,
    c.credit,
    SUM(c.debit - c.credit) OVER (ORDER BY c.sort_key, c.date, c.entry_type) AS running_balance,
    c.entry_type
  FROM combined c
  ORDER BY c.sort_key, c.date, c.entry_type;
$$;
