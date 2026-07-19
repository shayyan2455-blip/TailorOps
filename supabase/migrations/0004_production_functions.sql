-- ============================================================
-- Phase 5 — Production tracking: stage history + transition
-- ============================================================

-- Stage history log (who moved what, when)
CREATE TABLE IF NOT EXISTS order_stage_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_stage  order_stage,
  to_stage    order_stage NOT NULL,
  changed_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stage_history_order ON order_stage_history (order_id);

-- Enable RLS on the history table
ALTER TABLE order_stage_history ENABLE ROW LEVEL SECURITY;

-- RLS: users see history for orders in their tenant via the order's tenant_id
CREATE POLICY tenant_isolation ON order_stage_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_stage_history.order_id
        AND orders.tenant_id = current_tenant_id()
    )
  );

-- Atomically transition an order to a new stage, set the timestamp,
-- and record the history entry.
CREATE OR REPLACE FUNCTION transition_order_stage(
  p_order_id UUID,
  p_new_stage order_stage
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_stage order_stage;
  v_result    JSONB;
BEGIN
  -- Lock the row and read the current stage
  SELECT current_stage INTO v_old_stage
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING HINT = p_order_id::text;
  END IF;

  -- Set the appropriate timestamp column
  CASE p_new_stage
    WHEN 'Cutting'   THEN UPDATE orders SET cutting_at   = now() WHERE id = p_order_id;
    WHEN 'Stitching' THEN UPDATE orders SET stitching_at = now() WHERE id = p_order_id;
    WHEN 'Ready'     THEN UPDATE orders SET ready_at     = now() WHERE id = p_order_id;
    WHEN 'Delivered' THEN UPDATE orders SET delivered_at = now() WHERE id = p_order_id;
    ELSE NULL;
  END CASE;

  -- Update the stage
  UPDATE orders SET current_stage = p_new_stage WHERE id = p_order_id;

  -- Record history
  INSERT INTO order_stage_history (order_id, from_stage, to_stage, changed_by)
  VALUES (p_order_id, v_old_stage, p_new_stage, auth.uid());

  -- Return the updated order as JSON
  SELECT row_to_json(o)::jsonb INTO v_result
  FROM (SELECT * FROM orders WHERE id = p_order_id) o;

  RETURN v_result;
END;
$$;
