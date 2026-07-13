import { supabase } from '@/lib/supabase'
import type { DailySummary } from '@/types/database'

/**
 * Get daily sales summary for a branch.
 */
export async function getDailySummary(branchId: string, date?: string): Promise<DailySummary> {
  const { data, error } = await supabase.rpc('get_daily_summary', {
    p_branch_id: branchId,
    p_date: date || new Date().toISOString().split('T')[0],
  })

  if (error) throw error
  return data as unknown as DailySummary
}

/**
 * Get best-selling products for a date range.
 */
export async function getBestSellers(
  branchId: string,
  startDate: string,
  endDate: string,
  limit = 20
) {
  const { data, error } = await supabase
    .from('sale_items')
    .select(`
      product_id,
      product_name,
      quantity,
      line_total,
      sales!inner(branch_id, created_at, status)
    `)
    .eq('sales.branch_id', branchId)
    .eq('sales.status', 'completed')
    .gte('sales.created_at', startDate)
    .lte('sales.created_at', endDate)

  if (error) throw error

  // Aggregate by product
  const aggregated = new Map<string, {
    product_id: string
    product_name: string
    total_quantity: number
    total_revenue: number
  }>()

  for (const item of data || []) {
    const existing = aggregated.get(item.product_id) || {
      product_id: item.product_id,
      product_name: item.product_name,
      total_quantity: 0,
      total_revenue: 0,
    }
    existing.total_quantity += item.quantity
    existing.total_revenue += item.line_total
    aggregated.set(item.product_id, existing)
  }

  return Array.from(aggregated.values())
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, limit)
}

/**
 * Get cashier performance metrics.
 */
export async function getCashierPerformance(
  branchId: string,
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      id,
      cashier_id,
      grand_total,
      created_at,
      status,
      cashier:staff(full_name)
    `)
    .eq('branch_id', branchId)
    .eq('status', 'completed')
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  if (error) throw error

  // Aggregate by cashier
  const aggregated = new Map<string, {
    cashier_id: string
    cashier_name: string
    sales_count: number
    total_revenue: number
    average_basket: number
  }>()

  for (const sale of data || []) {
    if (!sale.cashier_id) continue
    const existing = aggregated.get(sale.cashier_id) || {
      cashier_id: sale.cashier_id,
      cashier_name: (sale.cashier as unknown as { full_name: string })?.full_name || 'Unknown',
      sales_count: 0,
      total_revenue: 0,
      average_basket: 0,
    }
    existing.sales_count += 1
    existing.total_revenue += sale.grand_total
    existing.average_basket = existing.total_revenue / existing.sales_count
    aggregated.set(sale.cashier_id, existing)
  }

  return Array.from(aggregated.values())
    .sort((a, b) => b.total_revenue - a.total_revenue)
}

/**
 * Get stock valuation report.
 */
export async function getStockValuation(branchId: string) {
  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      cost_price,
      selling_price,
      category:categories(name),
      stock!inner(quantity)
    `)
    .eq('branch_id', branchId)
    .eq('active', true)
    .eq('stock.branch_id', branchId)

  if (error) throw error

  return (data || []).map((product) => {
    const qty = (product.stock as unknown as { quantity: number }[])?.[0]?.quantity || 0
    return {
      product_id: product.id,
      product_name: product.name,
      category: (product.category as unknown as { name: string })?.name || 'Uncategorized',
      quantity: qty,
      cost_price: product.cost_price,
      selling_price: product.selling_price,
      stock_value: qty * product.cost_price,
      retail_value: qty * product.selling_price,
      potential_margin: qty * (product.selling_price - product.cost_price),
    }
  })
}
