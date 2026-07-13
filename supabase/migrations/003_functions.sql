-- ============================================================================
-- Makuku Supermarket POS — Database Functions
-- Migration 003: Business logic functions (transactional)
-- ============================================================================

-- ============================================================================
-- GENERATE RECEIPT NUMBER
-- Format: MKK-YYYYMMDD-NNNN (e.g., MKK-20260712-1042)
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT AS $$
DECLARE
  seq_val INTEGER;
BEGIN
  SELECT nextval('receipt_number_seq') INTO seq_val;
  RETURN 'MKK-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(seq_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PROCESS SALE (atomic: creates sale + items + stock deductions + payments)
-- Called from the frontend via RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION process_sale(
  p_shift_id UUID,
  p_branch_id UUID,
  p_cashier_id UUID,
  p_items JSONB,
  p_payments JSONB,
  p_discount_total NUMERIC DEFAULT 0,
  p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_sale_id UUID;
  v_receipt_number TEXT;
  v_subtotal NUMERIC(10,2) := 0;
  v_vat_total NUMERIC(10,2) := 0;
  v_grand_total NUMERIC(10,2) := 0;
  v_item JSONB;
  v_payment JSONB;
  v_line_total NUMERIC(10,2);
  v_line_vat NUMERIC(10,2);
  v_current_stock NUMERIC(10,3);
  v_existing_sale UUID;
BEGIN
  -- Idempotency check: if this sale was already processed, return existing
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_sale 
    FROM sales 
    WHERE idempotency_key = p_idempotency_key;
    
    IF v_existing_sale IS NOT NULL THEN
      RETURN jsonb_build_object(
        'sale_id', v_existing_sale,
        'status', 'already_processed',
        'message', 'Sale was already processed with this idempotency key'
      );
    END IF;
  END IF;

  -- Validate shift is open
  IF NOT EXISTS (
    SELECT 1 FROM shifts 
    WHERE id = p_shift_id 
    AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Shift is not open or does not exist';
  END IF;

  -- Generate receipt number
  v_receipt_number := generate_receipt_number();

  -- Calculate totals from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_line_total := (v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC 
                    - COALESCE((v_item->>'discount_amount')::NUMERIC, 0);
    v_line_vat := v_line_total * (v_item->>'vat_rate')::NUMERIC / (100 + (v_item->>'vat_rate')::NUMERIC);
    
    v_subtotal := v_subtotal + v_line_total;
    v_vat_total := v_vat_total + v_line_vat;
  END LOOP;

  v_grand_total := v_subtotal - p_discount_total;

  -- Create sale header
  INSERT INTO sales (
    id, shift_id, branch_id, cashier_id, receipt_number,
    subtotal, vat_total, discount_total, grand_total,
    status, idempotency_key
  ) VALUES (
    gen_random_uuid(), p_shift_id, p_branch_id, p_cashier_id, v_receipt_number,
    v_subtotal, v_vat_total, p_discount_total, v_grand_total,
    'completed', p_idempotency_key
  ) RETURNING id INTO v_sale_id;

  -- Insert sale items and deduct stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_line_total := (v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC
                    - COALESCE((v_item->>'discount_amount')::NUMERIC, 0);

    -- Insert sale item
    INSERT INTO sale_items (
      sale_id, product_id, product_name, quantity, 
      unit_price, discount_amount, vat_rate, line_total
    ) VALUES (
      v_sale_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      COALESCE((v_item->>'discount_amount')::NUMERIC, 0),
      (v_item->>'vat_rate')::NUMERIC,
      v_line_total
    );

    -- Check stock availability (FOR UPDATE locks the row)
    SELECT quantity INTO v_current_stock
    FROM stock
    WHERE product_id = (v_item->>'product_id')::UUID
    AND branch_id = p_branch_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Product % not found in stock', v_item->>'product_name';
    END IF;

    IF v_current_stock < (v_item->>'quantity')::NUMERIC THEN
      RAISE EXCEPTION 'Insufficient stock for %. Available: %, Requested: %',
        v_item->>'product_name', v_current_stock, v_item->>'quantity';
    END IF;

    -- Deduct stock
    UPDATE stock
    SET quantity = quantity - (v_item->>'quantity')::NUMERIC,
        updated_at = now()
    WHERE product_id = (v_item->>'product_id')::UUID
    AND branch_id = p_branch_id;

    -- Record stock movement
    INSERT INTO stock_movements (
      product_id, branch_id, change, reason, reference_id, created_by
    ) VALUES (
      (v_item->>'product_id')::UUID,
      p_branch_id,
      -(v_item->>'quantity')::NUMERIC,
      'sale',
      v_sale_id,
      p_cashier_id
    );
  END LOOP;

  -- Insert payments
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    INSERT INTO payments (
      sale_id, method, amount, tendered, change_due,
      intasend_ref, mpesa_phone, status
    ) VALUES (
      v_sale_id,
      v_payment->>'method',
      (v_payment->>'amount')::NUMERIC,
      (v_payment->>'tendered')::NUMERIC,
      COALESCE((v_payment->>'change_due')::NUMERIC, 0),
      v_payment->>'intasend_ref',
      v_payment->>'mpesa_phone',
      COALESCE(v_payment->>'status', 
        CASE WHEN v_payment->>'method' = 'cash' THEN 'confirmed' ELSE 'pending' END
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'receipt_number', v_receipt_number,
    'grand_total', v_grand_total,
    'vat_total', v_vat_total,
    'status', 'completed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CLOSE SHIFT (calculates expected cash, flags variance)
-- ============================================================================
CREATE OR REPLACE FUNCTION close_shift(
  p_shift_id UUID,
  p_counted_cash NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  v_opening_float NUMERIC(10,2);
  v_cash_sales NUMERIC(10,2);
  v_cash_refunds NUMERIC(10,2);
  v_expected_cash NUMERIC(10,2);
  v_variance NUMERIC(10,2);
BEGIN
  -- Get opening float
  SELECT opening_float INTO v_opening_float
  FROM shifts
  WHERE id = p_shift_id AND status = 'open'
  FOR UPDATE;

  IF v_opening_float IS NULL THEN
    RAISE EXCEPTION 'Shift not found or already closed';
  END IF;

  -- Calculate cash sales for this shift
  SELECT COALESCE(SUM(p.amount), 0) INTO v_cash_sales
  FROM payments p
  JOIN sales s ON p.sale_id = s.id
  WHERE s.shift_id = p_shift_id
  AND p.method = 'cash'
  AND p.status = 'confirmed'
  AND s.status = 'completed';

  -- Calculate cash refunds for this shift
  SELECT COALESCE(SUM(p.amount), 0) INTO v_cash_refunds
  FROM payments p
  JOIN sales s ON p.sale_id = s.id
  WHERE s.shift_id = p_shift_id
  AND p.method = 'cash'
  AND p.status = 'confirmed'
  AND s.status = 'refunded';

  -- Expected = opening + sales - refunds
  v_expected_cash := v_opening_float + v_cash_sales - v_cash_refunds;
  v_variance := p_counted_cash - v_expected_cash;

  -- Close the shift
  UPDATE shifts
  SET closing_cash_counted = p_counted_cash,
      expected_cash = v_expected_cash,
      variance = v_variance,
      status = 'closed',
      closed_at = now()
  WHERE id = p_shift_id;

  RETURN jsonb_build_object(
    'shift_id', p_shift_id,
    'opening_float', v_opening_float,
    'cash_sales', v_cash_sales,
    'cash_refunds', v_cash_refunds,
    'expected_cash', v_expected_cash,
    'counted_cash', p_counted_cash,
    'variance', v_variance,
    'status', 'closed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VOID SALE (reverses stock, marks voided)
-- ============================================================================
CREATE OR REPLACE FUNCTION void_sale(
  p_sale_id UUID,
  p_voided_by UUID,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_item RECORD;
  v_branch_id UUID;
BEGIN
  -- Check sale exists and is completed
  SELECT branch_id INTO v_branch_id
  FROM sales
  WHERE id = p_sale_id AND status = 'completed'
  FOR UPDATE;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'Sale not found or not in completed status';
  END IF;

  -- Reverse stock for each item
  FOR v_item IN 
    SELECT product_id, quantity 
    FROM sale_items 
    WHERE sale_id = p_sale_id
  LOOP
    -- Add stock back
    UPDATE stock
    SET quantity = quantity + v_item.quantity,
        updated_at = now()
    WHERE product_id = v_item.product_id
    AND branch_id = v_branch_id;

    -- Record reversal movement
    INSERT INTO stock_movements (
      product_id, branch_id, change, reason, reference_id, created_by
    ) VALUES (
      v_item.product_id,
      v_branch_id,
      v_item.quantity,
      'void_reversal',
      p_sale_id,
      p_voided_by
    );
  END LOOP;

  -- Mark sale as voided
  UPDATE sales
  SET status = 'voided',
      voided_by = p_voided_by,
      void_reason = p_reason
  WHERE id = p_sale_id;

  -- Mark payments as failed
  UPDATE payments
  SET status = 'failed'
  WHERE sale_id = p_sale_id;

  RETURN jsonb_build_object(
    'sale_id', p_sale_id,
    'status', 'voided',
    'message', 'Sale voided and stock reversed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SHIFT REPORT (X-report: read-only mid-shift snapshot)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_shift_report(p_shift_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'shift_id', s.id,
    'cashier', st.full_name,
    'till', t.name,
    'opened_at', s.opened_at,
    'opening_float', s.opening_float,
    'total_sales', (
      SELECT COUNT(*) FROM sales 
      WHERE shift_id = p_shift_id AND status = 'completed'
    ),
    'total_revenue', (
      SELECT COALESCE(SUM(grand_total), 0) FROM sales 
      WHERE shift_id = p_shift_id AND status = 'completed'
    ),
    'total_vat', (
      SELECT COALESCE(SUM(vat_total), 0) FROM sales 
      WHERE shift_id = p_shift_id AND status = 'completed'
    ),
    'cash_total', (
      SELECT COALESCE(SUM(p.amount), 0)
      FROM payments p JOIN sales sa ON p.sale_id = sa.id
      WHERE sa.shift_id = p_shift_id AND p.method = 'cash' 
      AND p.status = 'confirmed' AND sa.status = 'completed'
    ),
    'mpesa_total', (
      SELECT COALESCE(SUM(p.amount), 0)
      FROM payments p JOIN sales sa ON p.sale_id = sa.id
      WHERE sa.shift_id = p_shift_id AND p.method = 'mpesa' 
      AND p.status = 'confirmed' AND sa.status = 'completed'
    ),
    'card_total', (
      SELECT COALESCE(SUM(p.amount), 0)
      FROM payments p JOIN sales sa ON p.sale_id = sa.id
      WHERE sa.shift_id = p_shift_id AND p.method = 'card' 
      AND p.status = 'confirmed' AND sa.status = 'completed'
    ),
    'voided_count', (
      SELECT COUNT(*) FROM sales 
      WHERE shift_id = p_shift_id AND status = 'voided'
    ),
    'voided_total', (
      SELECT COALESCE(SUM(grand_total), 0) FROM sales 
      WHERE shift_id = p_shift_id AND status = 'voided'
    )
  ) INTO v_result
  FROM shifts s
  JOIN staff st ON s.cashier_id = st.id
  JOIN tills t ON s.till_id = t.id
  WHERE s.id = p_shift_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DAILY SUMMARY REPORT
-- ============================================================================
CREATE OR REPLACE FUNCTION get_daily_summary(
  p_branch_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'date', p_date,
    'branch_id', p_branch_id,
    'total_sales_count', (
      SELECT COUNT(*) FROM sales 
      WHERE branch_id = p_branch_id 
      AND created_at::DATE = p_date 
      AND status = 'completed'
    ),
    'total_revenue', (
      SELECT COALESCE(SUM(grand_total), 0) FROM sales 
      WHERE branch_id = p_branch_id 
      AND created_at::DATE = p_date 
      AND status = 'completed'
    ),
    'total_vat', (
      SELECT COALESCE(SUM(vat_total), 0) FROM sales 
      WHERE branch_id = p_branch_id 
      AND created_at::DATE = p_date 
      AND status = 'completed'
    ),
    'total_discounts', (
      SELECT COALESCE(SUM(discount_total), 0) FROM sales 
      WHERE branch_id = p_branch_id 
      AND created_at::DATE = p_date 
      AND status = 'completed'
    ),
    'average_basket', (
      SELECT COALESCE(AVG(grand_total), 0) FROM sales 
      WHERE branch_id = p_branch_id 
      AND created_at::DATE = p_date 
      AND status = 'completed'
    ),
    'payment_breakdown', (
      SELECT jsonb_object_agg(method, total) FROM (
        SELECT p.method, COALESCE(SUM(p.amount), 0) as total
        FROM payments p
        JOIN sales s ON p.sale_id = s.id
        WHERE s.branch_id = p_branch_id
        AND s.created_at::DATE = p_date
        AND s.status = 'completed'
        AND p.status = 'confirmed'
        GROUP BY p.method
      ) sub
    ),
    'hourly_sales', (
      SELECT jsonb_agg(jsonb_build_object(
        'hour', hour,
        'count', cnt,
        'revenue', rev
      )) FROM (
        SELECT EXTRACT(HOUR FROM created_at)::INT as hour,
               COUNT(*) as cnt,
               SUM(grand_total) as rev
        FROM sales
        WHERE branch_id = p_branch_id
        AND created_at::DATE = p_date
        AND status = 'completed'
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      ) sub
    ),
    'top_products', (
      SELECT jsonb_agg(jsonb_build_object(
        'product_name', product_name,
        'quantity_sold', qty,
        'revenue', rev
      )) FROM (
        SELECT si.product_name,
               SUM(si.quantity) as qty,
               SUM(si.line_total) as rev
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE s.branch_id = p_branch_id
        AND s.created_at::DATE = p_date
        AND s.status = 'completed'
        GROUP BY si.product_name
        ORDER BY rev DESC
        LIMIT 10
      ) sub
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- LOW STOCK ALERT
-- ============================================================================
CREATE OR REPLACE FUNCTION get_low_stock_products(p_branch_id UUID)
RETURNS TABLE(
  product_id UUID,
  product_name TEXT,
  category_name TEXT,
  current_stock NUMERIC,
  reorder_level INTEGER,
  urgency_ratio NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.name as product_name,
    c.name as category_name,
    s.quantity as current_stock,
    p.reorder_level,
    CASE 
      WHEN p.reorder_level = 0 THEN 999
      ELSE ROUND(s.quantity / p.reorder_level, 2)
    END as urgency_ratio
  FROM products p
  JOIN stock s ON p.id = s.product_id AND s.branch_id = p_branch_id
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE p.active = true
  AND s.quantity <= p.reorder_level
  AND p.branch_id = p_branch_id
  ORDER BY urgency_ratio ASC, s.quantity ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFY STAFF PIN (returns staff record if PIN matches)
-- ============================================================================
CREATE OR REPLACE FUNCTION verify_staff_pin(
  p_pin_hash TEXT,
  p_branch_id UUID
)
RETURNS TABLE(
  staff_id UUID,
  full_name TEXT,
  role TEXT,
  branch_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.full_name, s.role, s.branch_id
  FROM staff s
  WHERE s.pin_hash = p_pin_hash
  AND s.branch_id = p_branch_id
  AND s.active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CLEAN UP EXPIRED HELD SALES
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_held_sales()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM held_sales WHERE expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
