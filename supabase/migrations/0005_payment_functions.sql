-- ============================================================
-- Phase 7 — Balance computation (derived, never stored)
-- ============================================================

CREATE OR REPLACE FUNCTION get_order_balance(p_order_id UUID)
RETURNS TABLE(total_amount NUMERIC, total_paid NUMERIC, balance NUMERIC)
LANGUAGE sql
STABLE
AS $$
  SELECT
    o.total_amount,
    COALESCE(SUM(p.amount), 0)::NUMERIC(10,2) AS total_paid,
    (o.total_amount - COALESCE(SUM(p.amount), 0))::NUMERIC(10,2) AS balance
  FROM orders o
  LEFT JOIN payments p ON p.order_id = o.id
  WHERE o.id = p_order_id
  GROUP BY o.id, o.total_amount;
$$;
