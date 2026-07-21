-- ============================================================
-- 0028 — Admin metrics: add oldest_pending_days + shop growth
-- ============================================================

-- 1. Update admin_get_metrics to include oldest pending days
DROP FUNCTION IF EXISTS admin_get_metrics();

CREATE OR REPLACE FUNCTION admin_get_metrics()
RETURNS TABLE(
  total_shops        BIGINT,
  active_shops       BIGINT,
  pending_shops      BIGINT,
  rejected_shops     BIGINT,
  suspended_shops    BIGINT,
  added_this_month   BIGINT,
  oldest_pending_days INT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE status = 'active')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'suspended')::BIGINT,
    COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now()))::BIGINT,
    COALESCE(
      EXTRACT(DAY FROM (now() - MIN(created_at) FILTER (WHERE status = 'pending')))::INT,
      0
    )
  FROM tenants;
$$;

-- 2. Admin: get shop growth (tenants created per month)
CREATE OR REPLACE FUNCTION admin_get_shop_growth(p_months INT DEFAULT 6)
RETURNS TABLE(month TEXT, shop_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    to_char(series.month, 'Mon') AS month,
    COUNT(t.id)::BIGINT AS shop_count
  FROM generate_series(
    date_trunc('month', now()) - ((p_months - 1) || ' months')::INTERVAL,
    date_trunc('month', now()),
    '1 month'
  ) series(month)
  LEFT JOIN tenants t ON date_trunc('month', t.created_at) = series.month
  GROUP BY series.month
  ORDER BY series.month;
$$;
