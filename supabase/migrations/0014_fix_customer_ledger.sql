-- ============================================================
-- 0014 — Fix customer ledger balance to account for credit
-- ============================================================

DROP FUNCTION IF EXISTS get_customer_ledgers(uuid);
CREATE FUNCTION get_customer_ledgers(p_tenant_id UUID)
RETURNS TABLE(
  customer_id    UUID,
  customer_name  TEXT,
  total_orders   NUMERIC,
  total_paid     NUMERIC,
  balance        NUMERIC,
  credit_balance NUMERIC
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
    SELECT p.customer_id,
      COALESCE(SUM(p.amount), 0) AS total_all,
      COALESCE(SUM(CASE WHEN p.order_id IS NOT NULL THEN p.amount ELSE 0 END), 0) AS total_applied
    FROM payments p
    WHERE p.tenant_id = p_tenant_id AND p.customer_id IS NOT NULL
    GROUP BY p.customer_id
  )
  SELECT
    c.id,
    c.name,
    COALESCE(ot.total, 0),
    COALESCE(pt.total_all, 0),
    COALESCE(ot.total, 0) - COALESCE(pt.total_applied, 0) - COALESCE(c.credit, 0),
    COALESCE(c.credit, 0)
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
  date             DATE,
  description      TEXT,
  invoice_or_order TEXT,
  debit            NUMERIC,
  credit           NUMERIC,
  running_balance  NUMERIC,
  entry_type       TEXT
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
      CASE WHEN p.order_id IS NULL THEN 'Credit stored' ELSE 'Payment' END AS description,
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
