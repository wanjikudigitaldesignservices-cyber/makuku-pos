/**
 * Database types for Makuku POS
 * These mirror the Supabase schema and provide type safety across the app.
 * In production, generate these with: npx supabase gen types typescript
 */

export interface Database {
  public: {
    Tables: {
      branches: {
        Row: Branch
        Insert: Omit<Branch, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Branch, 'id'>>
      }
      staff: {
        Row: Staff
        Insert: Omit<Staff, 'created_at'> & { created_at?: string }
        Update: Partial<Omit<Staff, 'id'>>
      }
      suppliers: {
        Row: Supplier
        Insert: Omit<Supplier, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Supplier, 'id'>>
      }
      categories: {
        Row: Category
        Insert: Omit<Category, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Category, 'id'>>
      }
      products: {
        Row: Product
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Omit<Product, 'id'>>
      }
      stock: {
        Row: Stock
        Insert: Omit<Stock, 'updated_at'> & { updated_at?: string }
        Update: Partial<Stock>
      }
      stock_movements: {
        Row: StockMovement
        Insert: Omit<StockMovement, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<StockMovement, 'id'>>
      }
      tills: {
        Row: Till
        Insert: Omit<Till, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Till, 'id'>>
      }
      shifts: {
        Row: Shift
        Insert: Omit<Shift, 'id' | 'opened_at'> & { id?: string; opened_at?: string }
        Update: Partial<Omit<Shift, 'id'>>
      }
      sales: {
        Row: Sale
        Insert: Omit<Sale, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Sale, 'id'>>
      }
      sale_items: {
        Row: SaleItem
        Insert: Omit<SaleItem, 'id'> & { id?: string }
        Update: Partial<Omit<SaleItem, 'id'>>
      }
      payments: {
        Row: Payment
        Insert: Omit<Payment, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Payment, 'id'>>
      }
      held_sales: {
        Row: HeldSale
        Insert: Omit<HeldSale, 'id' | 'created_at' | 'expires_at'> & { id?: string; created_at?: string; expires_at?: string }
        Update: Partial<Omit<HeldSale, 'id'>>
      }
    }
    Functions: {
      process_sale: {
        Args: {
          p_shift_id: string
          p_branch_id: string
          p_cashier_id: string
          p_items: SaleItemInput[]
          p_payments: PaymentInput[]
          p_discount_total?: number
          p_idempotency_key?: string
        }
        Returns: ProcessSaleResult
      }
      close_shift: {
        Args: {
          p_shift_id: string
          p_counted_cash: number
        }
        Returns: CloseShiftResult
      }
      void_sale: {
        Args: {
          p_sale_id: string
          p_voided_by: string
          p_reason: string
        }
        Returns: VoidSaleResult
      }
      get_shift_report: {
        Args: { p_shift_id: string }
        Returns: ShiftReport
      }
      get_daily_summary: {
        Args: {
          p_branch_id: string
          p_date?: string
        }
        Returns: DailySummary
      }
      get_low_stock_products: {
        Args: { p_branch_id: string }
        Returns: LowStockProduct[]
      }
    }
    Views: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ============================================================================
// Table Row Types
// ============================================================================

export interface Branch {
  id: string
  name: string
  location: string | null
  created_at: string
}

export interface Staff {
  id: string
  branch_id: string
  full_name: string
  role: 'admin' | 'manager' | 'cashier'
  pin_hash: string
  active: boolean
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  active: boolean
  created_at: string
}

export interface Category {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface Product {
  id: string
  branch_id: string
  category_id: string
  supplier_id: string | null
  barcode: string | null
  plu_code: string | null
  name: string
  description: string | null
  is_weighed: boolean
  cost_price: number
  selling_price: number
  vat_rate: number
  reorder_level: number
  image_url: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface Stock {
  product_id: string
  branch_id: string
  quantity: number
  updated_at: string
}

export interface StockMovement {
  id: string
  product_id: string
  branch_id: string
  change: number
  reason: 'sale' | 'goods_received' | 'adjustment' | 'return' | 'void_reversal'
  reference_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface Till {
  id: string
  branch_id: string
  name: string
  active: boolean
  created_at: string
}

export interface Shift {
  id: string
  till_id: string
  cashier_id: string
  branch_id: string
  opening_float: number
  closing_cash_counted: number | null
  expected_cash: number | null
  variance: number | null
  status: 'open' | 'closed'
  opened_at: string
  closed_at: string | null
}

export interface Sale {
  id: string
  shift_id: string
  branch_id: string
  cashier_id: string | null
  receipt_number: string | null
  subtotal: number
  vat_total: number
  discount_total: number
  grand_total: number
  status: 'completed' | 'voided' | 'refunded'
  voided_by: string | null
  void_reason: string | null
  idempotency_key: string | null
  created_at: string
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  discount_amount: number
  vat_rate: number
  line_total: number
}

export interface Payment {
  id: string
  sale_id: string
  method: 'cash' | 'mpesa' | 'card'
  amount: number
  tendered: number | null
  change_due: number
  intasend_ref: string | null
  mpesa_phone: string | null
  status: 'pending' | 'confirmed' | 'failed'
  confirmed_at: string | null
  created_at: string
}

export interface HeldSale {
  id: string
  shift_id: string
  cashier_id: string | null
  branch_id: string
  items: HeldSaleItem[]
  note: string | null
  created_at: string
  expires_at: string
}

// ============================================================================
// Input Types (for RPC calls)
// ============================================================================

export interface SaleItemInput {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  discount_amount: number
  vat_rate: number
}

export interface PaymentInput {
  method: 'cash' | 'mpesa' | 'card'
  amount: number
  tendered?: number
  change_due?: number
  intasend_ref?: string
  mpesa_phone?: string
  status?: 'pending' | 'confirmed' | 'failed'
}

// ============================================================================
// Result Types
// ============================================================================

export interface ProcessSaleResult {
  sale_id: string
  receipt_number: string
  grand_total: number
  vat_total: number
  status: 'completed' | 'already_processed'
  message?: string
}

export interface CloseShiftResult {
  shift_id: string
  opening_float: number
  cash_sales: number
  cash_refunds: number
  expected_cash: number
  counted_cash: number
  variance: number
  status: 'closed'
}

export interface VoidSaleResult {
  sale_id: string
  status: 'voided'
  message: string
}

export interface ShiftReport {
  shift_id: string
  cashier: string
  till: string
  opened_at: string
  opening_float: number
  total_sales: number
  total_revenue: number
  total_vat: number
  cash_total: number
  mpesa_total: number
  card_total: number
  voided_count: number
  voided_total: number
}

export interface DailySummary {
  date: string
  branch_id: string
  total_sales_count: number
  total_revenue: number
  total_vat: number
  total_discounts: number
  average_basket: number
  payment_breakdown: Record<string, number>
  hourly_sales: Array<{ hour: number; count: number; revenue: number }>
  top_products: Array<{ product_name: string; quantity_sold: number; revenue: number }>
}

export interface LowStockProduct {
  product_id: string
  product_name: string
  category_name: string
  current_stock: number
  reorder_level: number
  urgency_ratio: number
}

// ============================================================================
// Cart Types (client-side)
// ============================================================================

export interface HeldSaleItem {
  product_id: string
  product_name: string
  barcode: string | null
  quantity: number
  unit_price: number
  vat_rate: number
  is_weighed: boolean
  discount_amount: number
}

export interface CartItem extends HeldSaleItem {
  line_total: number
  line_vat: number
}

// ============================================================================
// Extended Types (with JOINed data)
// ============================================================================

export interface ProductWithStock extends Product {
  stock: Stock | null
  category: Category | null
  supplier: Supplier | null
}

export interface SaleWithDetails extends Sale {
  items: SaleItem[]
  payments: Payment[]
  cashier: Staff | null
}

export interface ShiftWithDetails extends Shift {
  cashier: Staff | null
  till: Till | null
  sales_count?: number
  total_revenue?: number
}
