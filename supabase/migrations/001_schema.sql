-- ============================================================================
-- Makuku Supermarket POS — Database Schema
-- Migration 001: Core Tables
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- BRANCHES (multi-branch ready, single row for MVP)
-- ============================================================================
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STAFF (RBAC: admin, manager, cashier)
-- Links to Supabase auth.users for session management
-- ============================================================================
CREATE TABLE staff (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'cashier')),
  pin_hash TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_staff_branch ON staff(branch_id);
CREATE INDEX idx_staff_role ON staff(role);

-- ============================================================================
-- SUPPLIERS
-- ============================================================================
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- CATEGORIES
-- ============================================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- PRODUCTS
-- ============================================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  barcode TEXT UNIQUE,
  plu_code TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_weighed BOOLEAN DEFAULT false,
  cost_price NUMERIC(10,2) NOT NULL CHECK (cost_price >= 0),
  selling_price NUMERIC(10,2) NOT NULL CHECK (selling_price >= 0),
  vat_rate NUMERIC(4,2) NOT NULL DEFAULT 16.00 CHECK (vat_rate >= 0 AND vat_rate <= 100),
  reorder_level INTEGER DEFAULT 5 CHECK (reorder_level >= 0),
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_plu ON products(plu_code);
CREATE INDEX idx_products_branch_category ON products(branch_id, category_id);
CREATE INDEX idx_products_name_search ON products USING gin(to_tsvector('english', name));

-- ============================================================================
-- STOCK (one row per product per branch)
-- ============================================================================
CREATE TABLE stock (
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  quantity NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (product_id, branch_id)
);

-- ============================================================================
-- STOCK MOVEMENTS (audit trail)
-- ============================================================================
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
  change NUMERIC(10,3) NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('sale', 'goods_received', 'adjustment', 'return', 'void_reversal')),
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_branch ON stock_movements(branch_id);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at);

-- ============================================================================
-- TILLS
-- ============================================================================
CREATE TABLE tills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SHIFTS (X/Z report reconciliation)
-- ============================================================================
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  till_id UUID REFERENCES tills(id) ON DELETE RESTRICT,
  cashier_id UUID REFERENCES staff(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
  opening_float NUMERIC(10,2) NOT NULL CHECK (opening_float >= 0),
  closing_cash_counted NUMERIC(10,2) CHECK (closing_cash_counted >= 0),
  expected_cash NUMERIC(10,2),
  variance NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_shifts_cashier ON shifts(cashier_id);
CREATE INDEX idx_shifts_till ON shifts(till_id);
CREATE INDEX idx_shifts_status ON shifts(status);
CREATE INDEX idx_shifts_opened ON shifts(opened_at);

-- ============================================================================
-- SALES (header)
-- ============================================================================
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID REFERENCES shifts(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
  cashier_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  receipt_number TEXT UNIQUE,
  subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  vat_total NUMERIC(10,2) NOT NULL CHECK (vat_total >= 0),
  discount_total NUMERIC(10,2) DEFAULT 0 CHECK (discount_total >= 0),
  grand_total NUMERIC(10,2) NOT NULL CHECK (grand_total >= 0),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided', 'refunded')),
  voided_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  void_reason TEXT,
  idempotency_key UUID UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sales_shift ON sales(shift_id);
CREATE INDEX idx_sales_branch ON sales(branch_id);
CREATE INDEX idx_sales_created ON sales(created_at);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_receipt ON sales(receipt_number);

-- ============================================================================
-- SALE ITEMS (line items)
-- ============================================================================
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity NUMERIC(10,3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  discount_amount NUMERIC(10,2) DEFAULT 0 CHECK (discount_amount >= 0),
  vat_rate NUMERIC(4,2) NOT NULL DEFAULT 16.00,
  line_total NUMERIC(10,2) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

-- ============================================================================
-- PAYMENTS (supports split: part cash, part M-Pesa, part card)
-- ============================================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('cash', 'mpesa', 'card')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  tendered NUMERIC(10,2),
  change_due NUMERIC(10,2) DEFAULT 0,
  intasend_ref TEXT,
  mpesa_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_payments_intasend_ref ON payments(intasend_ref) WHERE intasend_ref IS NOT NULL;
CREATE INDEX idx_payments_sale ON payments(sale_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ============================================================================
-- HELD SALES (park/resume)
-- ============================================================================
CREATE TABLE held_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
  cashier_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
  items JSONB NOT NULL DEFAULT '[]',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

CREATE INDEX idx_held_sales_shift ON held_sales(shift_id);
CREATE INDEX idx_held_sales_expires ON held_sales(expires_at);

-- ============================================================================
-- RECEIPT NUMBER SEQUENCE
-- ============================================================================
CREATE SEQUENCE receipt_number_seq START WITH 1000;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER stock_updated_at
  BEFORE UPDATE ON stock
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tills ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE held_sales ENABLE ROW LEVEL SECURITY;
