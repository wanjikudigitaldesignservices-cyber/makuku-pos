-- ============================================================================
-- Makuku Supermarket POS — Row Level Security Policies
-- Migration 002: Deny-by-default + explicit allow policies per role
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTION: Get current staff role
-- Wrapping in a function avoids repeated subqueries in policies
-- ============================================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM staff WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_branch()
RETURNS UUID AS $$
  SELECT branch_id FROM staff WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT (SELECT get_my_role()) = 'admin'
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_manager_or_admin()
RETURNS BOOLEAN AS $$
  SELECT (SELECT get_my_role()) IN ('admin', 'manager')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- BRANCHES
-- ============================================================================
-- All authenticated staff can read branches
CREATE POLICY "staff_read_branches"
  ON branches FOR SELECT
  TO authenticated
  USING (true);

-- Only admin can modify branches
CREATE POLICY "admin_manage_branches"
  ON branches FOR ALL
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- ============================================================================
-- STAFF
-- ============================================================================
-- Staff can read their own record
CREATE POLICY "staff_read_own"
  ON staff FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Manager can read staff in their branch
CREATE POLICY "manager_read_branch_staff"
  ON staff FOR SELECT
  TO authenticated
  USING (
    (SELECT is_manager_or_admin())
    AND (branch_id = (SELECT get_my_branch()) OR (SELECT is_admin()))
  );

-- Admin can manage all staff
CREATE POLICY "admin_manage_staff"
  ON staff FOR ALL
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- Manager can update staff in their branch (e.g., reset PIN)
CREATE POLICY "manager_update_branch_staff"
  ON staff FOR UPDATE
  TO authenticated
  USING (
    (SELECT get_my_role()) = 'manager'
    AND branch_id = (SELECT get_my_branch())
  )
  WITH CHECK (
    (SELECT get_my_role()) = 'manager'
    AND branch_id = (SELECT get_my_branch())
  );

-- ============================================================================
-- SUPPLIERS
-- ============================================================================
-- All staff can read suppliers
CREATE POLICY "staff_read_suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (true);

-- Manager/admin can manage suppliers
CREATE POLICY "manager_manage_suppliers"
  ON suppliers FOR ALL
  TO authenticated
  USING ((SELECT is_manager_or_admin()))
  WITH CHECK ((SELECT is_manager_or_admin()));

-- ============================================================================
-- CATEGORIES
-- ============================================================================
-- All staff can read categories
CREATE POLICY "staff_read_categories"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

-- Manager/admin can manage categories
CREATE POLICY "manager_manage_categories"
  ON categories FOR ALL
  TO authenticated
  USING ((SELECT is_manager_or_admin()))
  WITH CHECK ((SELECT is_manager_or_admin()));

-- ============================================================================
-- PRODUCTS
-- ============================================================================
-- All staff can read active products
CREATE POLICY "staff_read_products"
  ON products FOR SELECT
  TO authenticated
  USING (active = true OR (SELECT is_manager_or_admin()));

-- Manager/admin can manage products
CREATE POLICY "manager_manage_products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_manager_or_admin()));

CREATE POLICY "manager_update_products"
  ON products FOR UPDATE
  TO authenticated
  USING ((SELECT is_manager_or_admin()))
  WITH CHECK ((SELECT is_manager_or_admin()));

CREATE POLICY "manager_delete_products"
  ON products FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ============================================================================
-- STOCK
-- ============================================================================
-- All staff can read stock for their branch
CREATE POLICY "staff_read_stock"
  ON stock FOR SELECT
  TO authenticated
  USING (
    branch_id = (SELECT get_my_branch())
    OR (SELECT is_manager_or_admin())
  );

-- Stock updates happen through DB functions (service_role), but allow
-- manager/admin direct updates for adjustments
CREATE POLICY "manager_manage_stock"
  ON stock FOR ALL
  TO authenticated
  USING ((SELECT is_manager_or_admin()))
  WITH CHECK ((SELECT is_manager_or_admin()));

-- ============================================================================
-- STOCK MOVEMENTS
-- ============================================================================
-- Staff can read movements for their branch
CREATE POLICY "staff_read_stock_movements"
  ON stock_movements FOR SELECT
  TO authenticated
  USING (
    branch_id = (SELECT get_my_branch())
    OR (SELECT is_manager_or_admin())
  );

-- Cashiers can insert sale-related movements
CREATE POLICY "cashier_insert_sale_movements"
  ON stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (reason = 'sale' OR (SELECT is_manager_or_admin()));

-- Manager/admin can insert all types
CREATE POLICY "manager_manage_movements"
  ON stock_movements FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_manager_or_admin()));

-- ============================================================================
-- TILLS
-- ============================================================================
-- Staff can read tills in their branch
CREATE POLICY "staff_read_tills"
  ON tills FOR SELECT
  TO authenticated
  USING (
    branch_id = (SELECT get_my_branch())
    OR (SELECT is_manager_or_admin())
  );

-- Admin can manage tills
CREATE POLICY "admin_manage_tills"
  ON tills FOR ALL
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- ============================================================================
-- SHIFTS
-- ============================================================================
-- Staff can read their own shifts
CREATE POLICY "staff_read_own_shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (
    cashier_id = auth.uid()
    OR (SELECT is_manager_or_admin())
  );

-- Staff can open shifts (insert)
CREATE POLICY "staff_open_shift"
  ON shifts FOR INSERT
  TO authenticated
  WITH CHECK (cashier_id = auth.uid());

-- Staff can close their own shift (update)
CREATE POLICY "staff_close_own_shift"
  ON shifts FOR UPDATE
  TO authenticated
  USING (cashier_id = auth.uid() OR (SELECT is_manager_or_admin()))
  WITH CHECK (cashier_id = auth.uid() OR (SELECT is_manager_or_admin()));

-- ============================================================================
-- SALES
-- ============================================================================
-- Staff can read sales from their shifts; manager/admin can read all
CREATE POLICY "staff_read_sales"
  ON sales FOR SELECT
  TO authenticated
  USING (
    cashier_id = auth.uid()
    OR (SELECT is_manager_or_admin())
  );

-- Staff can create sales in their active shift
CREATE POLICY "staff_create_sales"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (cashier_id = auth.uid());

-- Only manager/admin can update sales (void/refund)
CREATE POLICY "manager_update_sales"
  ON sales FOR UPDATE
  TO authenticated
  USING ((SELECT is_manager_or_admin()))
  WITH CHECK ((SELECT is_manager_or_admin()));

-- ============================================================================
-- SALE ITEMS
-- ============================================================================
-- Staff can read sale items for their sales; manager/admin all
CREATE POLICY "staff_read_sale_items"
  ON sale_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.id = sale_items.sale_id 
      AND (sales.cashier_id = auth.uid() OR (SELECT is_manager_or_admin()))
    )
  );

-- Staff can insert sale items
CREATE POLICY "staff_create_sale_items"
  ON sale_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.id = sale_items.sale_id 
      AND sales.cashier_id = auth.uid()
    )
  );

-- ============================================================================
-- PAYMENTS
-- ============================================================================
-- Staff can read payments for their sales
CREATE POLICY "staff_read_payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.id = payments.sale_id 
      AND (sales.cashier_id = auth.uid() OR (SELECT is_manager_or_admin()))
    )
  );

-- Staff can create payments for their sales
CREATE POLICY "staff_create_payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.id = payments.sale_id 
      AND sales.cashier_id = auth.uid()
    )
  );

-- Webhook handler uses service_role to update payment status
-- Manager/admin can also update
CREATE POLICY "manager_update_payments"
  ON payments FOR UPDATE
  TO authenticated
  USING ((SELECT is_manager_or_admin()))
  WITH CHECK ((SELECT is_manager_or_admin()));

-- ============================================================================
-- HELD SALES
-- ============================================================================
-- Staff can manage their own held sales
CREATE POLICY "staff_read_held_sales"
  ON held_sales FOR SELECT
  TO authenticated
  USING (
    cashier_id = auth.uid()
    OR (SELECT is_manager_or_admin())
  );

CREATE POLICY "staff_create_held_sales"
  ON held_sales FOR INSERT
  TO authenticated
  WITH CHECK (cashier_id = auth.uid());

CREATE POLICY "staff_delete_held_sales"
  ON held_sales FOR DELETE
  TO authenticated
  USING (cashier_id = auth.uid() OR (SELECT is_manager_or_admin()));
