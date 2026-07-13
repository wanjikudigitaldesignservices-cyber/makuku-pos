import { supabase } from '@/lib/supabase'
import type { LowStockProduct } from '@/types/database'
import { type GoodsReceivedInput, goodsReceivedSchema, type StockAdjustmentInput, stockAdjustmentSchema } from '@/lib/validators/stock'

/**
 * Process goods received — increments stock and records movements.
 */
export async function processGoodsReceived(input: GoodsReceivedInput, createdBy: string): Promise<void> {
  const validated = goodsReceivedSchema.parse(input)

  for (const item of validated.items) {
    // Increment stock
    const { error: stockError } = await supabase.rpc('', {}) // We'll do direct update
    
    // Direct stock update with upsert
    const { data: currentStock } = await supabase
      .from('stock')
      .select('quantity')
      .eq('product_id', item.product_id)
      .eq('branch_id', validated.branch_id)
      .single()

    if (currentStock) {
      const { error } = await supabase
        .from('stock')
        .update({ quantity: currentStock.quantity + item.quantity })
        .eq('product_id', item.product_id)
        .eq('branch_id', validated.branch_id)

      if (error) throw error
    }

    // Record stock movement
    const { error: movError } = await supabase
      .from('stock_movements')
      .insert({
        product_id: item.product_id,
        branch_id: validated.branch_id,
        change: item.quantity,
        reason: 'goods_received',
        notes: `Supplier: ${validated.supplier_id}${validated.notes ? ` — ${validated.notes}` : ''}`,
        created_by: createdBy,
      })

    if (movError) throw movError

    // Optionally update cost price
    if (item.update_cost_price) {
      await supabase
        .from('products')
        .update({ cost_price: item.cost_price })
        .eq('id', item.product_id)
    }
  }
}

/**
 * Process a stock adjustment (breakage, expiry, count correction).
 */
export async function processStockAdjustment(input: StockAdjustmentInput, createdBy: string): Promise<void> {
  const validated = stockAdjustmentSchema.parse(input)

  // Get current stock
  const { data: currentStock, error: fetchError } = await supabase
    .from('stock')
    .select('quantity')
    .eq('product_id', validated.product_id)
    .eq('branch_id', validated.branch_id)
    .single()

  if (fetchError) throw fetchError
  if (!currentStock) throw new Error('Product not found in stock')

  const newQuantity = currentStock.quantity + validated.quantity_change
  if (newQuantity < 0) throw new Error('Adjustment would result in negative stock')

  // Update stock
  const { error: updateError } = await supabase
    .from('stock')
    .update({ quantity: newQuantity })
    .eq('product_id', validated.product_id)
    .eq('branch_id', validated.branch_id)

  if (updateError) throw updateError

  // Record movement
  const { error: movError } = await supabase
    .from('stock_movements')
    .insert({
      product_id: validated.product_id,
      branch_id: validated.branch_id,
      change: validated.quantity_change,
      reason: 'adjustment',
      notes: validated.notes,
      created_by: createdBy,
    })

  if (movError) throw movError
}

/**
 * Get low stock products for a branch.
 */
export async function getLowStockProducts(branchId: string): Promise<LowStockProduct[]> {
  const { data, error } = await supabase.rpc('get_low_stock_products', {
    p_branch_id: branchId,
  })

  if (error) throw error
  return (data || []) as unknown as LowStockProduct[]
}

/**
 * Get stock movement history for a product.
 */
export async function getStockMovements(productId: string, branchId: string, limit = 50) {
  const { data, error } = await supabase
    .from('stock_movements')
    .select(`
      *,
      created_by_staff:staff(full_name)
    `)
    .eq('product_id', productId)
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}
