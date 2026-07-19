-- ============================================================
-- Seed Data — Demo tenant + sample records
-- ============================================================
-- NOTE: In Supabase local dev, run this AFTER at least one user
-- has signed up (so auth.users has a row).  Replace the UUID
-- below with a real auth.users.id from your local Supabase.
-- ============================================================

-- 1. Demo tenant
INSERT INTO tenants (id, name, slug)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Demo Tailor Shop', 'demo-shop');

-- 2. Link the current auth user to the demo tenant as owner
--    (replace 'CHANGE_ME' with the actual auth user id)
-- INSERT INTO profiles (id, tenant_id, role, full_name)
-- VALUES ('CHANGE_ME', 'a0000000-0000-0000-0000-000000000001', 'owner', 'Demo Owner');

-- 3. Sample customers
INSERT INTO customers (id, tenant_id, name, mobile, address) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ahmed Khan',  '0300-1234567', 'House 12, Street 5, Lahore'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Sara Ali',   '0301-7654321', 'Flat 3B, Karachi'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Usman Raza', '0312-9876543', '15-C Model Town, Islamabad');

-- 4. Sample tailors
INSERT INTO tailors (id, tenant_id, name, mobile) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Rashid Master',  '0302-1112233'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Javed Bhai',    '0303-4455667');

-- 5. Sample orders
INSERT INTO orders (id, tenant_id, customer_id, order_number, current_stage, total_amount, advance_amount, delivery_date, booked_at) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001', 'TOD-2026-0001', 'Cutting',   4500, 1500, '2026-07-25', now() - interval '3 days'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000002', 'TOD-2026-0002', 'Booked',    3200, 0,    '2026-07-28', now() - interval '1 day'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000003', 'TOD-2026-0003', 'Stitching', 6800, 3000, '2026-07-22', now() - interval '5 days');

-- 6. Order items
INSERT INTO order_items (tenant_id, order_id, garment_name, quantity, rate, amount) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Shalwar Kameez', 2, 1800, 3600),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Waistcoat',      1,  900,  900),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Kurti',          2, 1600, 3200),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Suit (3-piece)', 1, 4800, 4800),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Shirt',          2, 1000, 2000);

-- 7. Measurements (minimal JSON sample)
INSERT INTO measurements (tenant_id, customer_id, order_id, data) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001',
   '{"chest": 42, "waist": 36, "shoulder": 18, "inseam": 40, "collar": 15}'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
   'd0000000-0000-0000-0000-000000000002',
   '{"bust": 36, "waist": 28, "hip": 38, "length": 42}');

-- 8. Payments
INSERT INTO payments (tenant_id, order_id, amount, payment_date, payment_mode) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 1500, '2026-07-15', 'Cash'),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 2000, '2026-07-14', 'Cash'),
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 1000, '2026-07-16', 'JazzCash');

-- 9. Work assignments
INSERT INTO work_assignments (tenant_id, order_id, tailor_id, stage) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003',
   'c0000000-0000-0000-0000-000000000001', 'Stitching');

-- 10. Expenses
INSERT INTO expenses (tenant_id, description, amount, expense_date, category) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Thread purchase (bulk)', 850, '2026-07-10', 'Raw Material'),
  ('a0000000-0000-0000-0000-000000000001', 'Sewing machine oil',     220, '2026-07-12', 'Maintenance');
