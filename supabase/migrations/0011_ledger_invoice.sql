-- ============================================================
-- 0011 — Invoice numbering + customer ledger functions
-- ============================================================

-- 1. Invoice sequence table
CREATE TABLE IF NOT EXISTS tenant_invoice_sequences (
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year         TEXT NOT NULL,
  last_number  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, year)
);

-- 2. Generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_tenant_id UUID)
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
  INSERT INTO tenant_invoice_sequences (tenant_id, year, last_number)
  VALUES (p_tenant_id, yr, 0)
  ON CONFLICT (tenant_id, year) DO NOTHING;
  UPDATE tenant_invoice_sequences
  SET last_number = last_number + 1
  WHERE tenant_id = p_tenant_id AND year = yr
  RETURNING last_number INTO next_num;
  RETURN 'INV-' || yr || '-' || LPAD(next_num::text, 4, '0');
END;
$$;

-- 3. Add invoice_number column
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- 4. Recreate distribute_customer_payment with invoice numbers
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

      INSERT INTO payments (tenant_id, order_id, amount, payment_date, payment_mode, notes, invoice_number)
      VALUES (p_tenant_id, v_order.id, v_alloc, p_payment_date, p_payment_mode, p_notes, v_invoice)
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

  IF v_remaining > 0 THEN
    UPDATE customers SET credit = COALESCE(credit, 0) + v_remaining WHERE id = p_customer_id;
    IF NOT v_any_alloc THEN
      payment_id    := NULL;
      order_id      := NULL;
      order_number  := 'CREDIT_ONLY';
      invoice_number := NULL;
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
    invoice_number := NULL;
    allocated     := 0;
    order_balance := p_amount;
    credit_stored := 0;
    RETURN NEXT;
  END IF;
END;
$$;

-- 5. Recreate apply_customer_credit with invoice numbers
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

  INSERT INTO payments (tenant_id, order_id, amount, payment_date, payment_mode, notes, invoice_number)
  VALUES (p_tenant_id, p_order_id, v_apply, CURRENT_DATE, 'Credit', 'Auto-applied from customer credit', v_invoice);

  UPDATE customers SET credit = credit - v_apply WHERE id = p_customer_id;
  RETURN v_apply;
END;
$$;

-- 6. Customer ledger summaries (all customers for the list view)
CREATE OR REPLACE FUNCTION get_customer_ledgers(p_tenant_id UUID)
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
    SELECT o.customer_id, SUM(p.amount) AS total
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    WHERE o.tenant_id = p_tenant_id
    GROUP BY o.customer_id
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

-- 7. Single-customer detailed ledger (for the expanded view)
CREATE OR REPLACE FUNCTION get_customer_ledger(
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
      'Payment' AS description,
      COALESCE(p.invoice_number, 'INV-—') AS invoice_or_order,
      0::NUMERIC AS debit,
      p.amount AS credit,
      p.created_at AS sort_key,
      'payment' AS entry_type
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    WHERE o.customer_id = p_customer_id AND o.tenant_id = p_tenant_id
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
