-- ============================================================
-- 0024 — get_shop_profit_summary
-- Returns aggregated profit numbers for the Reports module.
-- Caller must own or be an admin of p_tenant_id.
-- ============================================================

CREATE OR REPLACE FUNCTION get_shop_profit_summary(
  p_tenant_id UUID,
  p_start     DATE,
  p_end       DATE
)
RETURNS TABLE(
  total_customer_payments NUMERIC,
  total_tailor_payments   NUMERIC,
  total_expenses_paid     NUMERIC,
  net_profit              NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cust_pay AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM payments
    WHERE tenant_id = p_tenant_id
      AND payment_date >= p_start
      AND payment_date <= p_end
  ),
  tailor_pay AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM tailor_payments
    WHERE tenant_id = p_tenant_id
      AND payment_date >= p_start
      AND payment_date <= p_end
  ),
  expense_pay AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM expense_payments
    WHERE tenant_id = p_tenant_id
      AND payment_date >= p_start
      AND payment_date <= p_end
  )
  SELECT
    cp.total,
    tp.total,
    ep.total,
    cp.total - tp.total - ep.total
  FROM cust_pay cp, tailor_pay tp, expense_pay ep;
$$;
