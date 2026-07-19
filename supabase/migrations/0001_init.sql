-- ============================================================
-- Phase 1 — Full Schema + Multi-Tenancy (RLS from day one)
-- ============================================================

-- 1. Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Custom Enums
-- ============================================================
CREATE TYPE order_stage AS ENUM (
  'Booked',
  'Cutting',
  'Stitching',
  'Ready',
  'Delivered'
);

CREATE TYPE user_role AS ENUM ('owner', 'staff');

-- 3. Tables
-- ============================================================

-- 3a. Tenants
CREATE TABLE tenants (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NOT NULL,
  slug      TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3b. Profiles (links auth.users to a tenant + role)
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role       user_role NOT NULL DEFAULT 'staff',
  full_name  TEXT,
  mobile     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3c. Customers
CREATE TABLE customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  mobile     TEXT,
  address    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_tenant ON customers (tenant_id);
CREATE INDEX idx_customers_name  ON customers (tenant_id, name);

-- 3d. Orders
CREATE TABLE orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id    UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_number   TEXT NOT NULL,
  current_stage  order_stage NOT NULL DEFAULT 'Booked',
  total_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  advance_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_date  DATE,
  notes          TEXT,

  -- stage timestamps
  booked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  cutting_at    TIMESTAMPTZ,
  stitching_at  TIMESTAMPTZ,
  ready_at      TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, order_number)
);

CREATE INDEX idx_orders_tenant    ON orders (tenant_id);
CREATE INDEX idx_orders_customer  ON orders (tenant_id, customer_id);
CREATE INDEX idx_orders_stage     ON orders (tenant_id, current_stage);

-- 3e. Order Items
CREATE TABLE order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  garment_name TEXT NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 1,
  rate         NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount       NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_order_items_order  ON order_items (order_id);

-- 3f. Measurements
CREATE TABLE measurements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_measurements_customer ON measurements (tenant_id, customer_id);
CREATE INDEX idx_measurements_order    ON measurements (order_id);

-- 3g. Tailors / Workers
CREATE TABLE tailors (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  mobile     TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tailors_tenant ON tailors (tenant_id);

-- 3h. Work Assignments (tailor ↔ order ↔ stage)
CREATE TABLE work_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tailor_id   UUID NOT NULL REFERENCES tailors(id) ON DELETE CASCADE,
  stage       order_stage NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_assignments_order  ON work_assignments (order_id);
CREATE INDEX idx_work_assignments_tailor ON work_assignments (tenant_id, tailor_id);

-- 3i. Payments
CREATE TABLE payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount       NUMERIC(10,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_order  ON payments (order_id);

-- 3j. Expenses
CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_tenant ON expenses (tenant_id);

-- 4. Helper: current_tenant_id()
-- ============================================================
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$;

-- 5. Updated-at trigger for orders
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 6. Row-Level Security
-- ============================================================

-- 6a. Enable RLS on every tenant-scoped table
ALTER TABLE tenants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tailors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses      ENABLE ROW LEVEL SECURITY;

-- 6b. Tenant isolation — every row-level operation is scoped to the
--     current user's tenant.  The USING clause double-checks via the
--     current_tenant_id() helper so PostgreSQL itself prevents leaks.

-- tenants: only the owning tenant can see its own row
CREATE POLICY tenant_isolation ON tenants
  FOR ALL
  USING (id = current_tenant_id());

-- profiles: a user sees profiles in their own tenant; a profile row
--          is visible to the user it belongs to (so login works).
CREATE POLICY tenant_isolation ON profiles
  FOR ALL
  USING (
    tenant_id = current_tenant_id()
    OR id = auth.uid()
  );

-- customers
CREATE POLICY tenant_isolation ON customers
  FOR ALL
  USING (tenant_id = current_tenant_id());

-- orders
CREATE POLICY tenant_isolation ON orders
  FOR ALL
  USING (tenant_id = current_tenant_id());

-- order_items
CREATE POLICY tenant_isolation ON order_items
  FOR ALL
  USING (tenant_id = current_tenant_id());

-- measurements
CREATE POLICY tenant_isolation ON measurements
  FOR ALL
  USING (tenant_id = current_tenant_id());

-- tailors
CREATE POLICY tenant_isolation ON tailors
  FOR ALL
  USING (tenant_id = current_tenant_id());

-- work_assignments
CREATE POLICY tenant_isolation ON work_assignments
  FOR ALL
  USING (tenant_id = current_tenant_id());

-- payments
CREATE POLICY tenant_isolation ON payments
  FOR ALL
  USING (tenant_id = current_tenant_id());

-- expenses
CREATE POLICY tenant_isolation ON expenses
  FOR ALL
  USING (tenant_id = current_tenant_id());
