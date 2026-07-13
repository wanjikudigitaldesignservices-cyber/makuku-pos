import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import type { ProcessSaleResult, HeldSale } from '@/types/database'
import { processSaleSchema, type ProcessSaleInput } from '@/lib/validators/sale'
import { useCartStore } from '@/stores/cart.store'

/**
 * Process a complete sale through the atomic DB function.
 * Validates input with Zod, then calls the `process_sale` RPC.
 */
export async function processSale(input: ProcessSaleInput): Promise<ProcessSaleResult> {
  // Validate all inputs before sending to server
  const validated = processSaleSchema.parse(input)

  const { data, error } = await supabase.rpc('process_sale', {
    p_shift_id: validated.shift_id,
    p_branch_id: validated.branch_id,
    p_cashier_id: validated.cashier_id,
    p_items: validated.items as unknown as never,
    p_payments: validated.payments as unknown as never,
    p_discount_total: validated.discount_total || 0,
    p_idempotency_key: validated.idempotency_key || uuidv4(),
  })

  if (error) throw error
  return data as unknown as ProcessSaleResult
}

/**
 * Void a completed sale (requires manager permission).
 * Reverses stock and marks the sale as voided.
 */
export async function voidSale(
  saleId: string,
  voidedBy: string,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc('void_sale', {
    p_sale_id: saleId,
    p_voided_by: voidedBy,
    p_reason: reason,
  })

  if (error) throw error
}

/**
 * Hold (park) the current cart for later resume.
 */
export async function holdSale(
  shiftId: string,
  cashierId: string,
  branchId: string,
  note?: string
): Promise<HeldSale> {
  const items = useCartStore.getState().getItemsForHold()

  if (items.length === 0) {
    throw new Error('Cannot hold an empty cart')
  }

  const { data, error } = await supabase
    .from('held_sales')
    .insert({
      shift_id: shiftId,
      cashier_id: cashierId,
      branch_id: branchId,
      items: items as unknown as never,
      note: note || null,
    })
    .select()
    .single()

  if (error) throw error

  // Clear the cart after holding
  useCartStore.getState().clearCart()

  return data as unknown as HeldSale
}

/**
 * Get all held sales for the current shift/branch.
 */
export async function getHeldSales(branchId: string): Promise<HeldSale[]> {
  const { data, error } = await supabase
    .from('held_sales')
    .select('*')
    .eq('branch_id', branchId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as unknown as HeldSale[]
}

/**
 * Resume a held sale — loads items into cart and deletes the hold record.
 */
export async function resumeHeldSale(heldSaleId: string): Promise<void> {
  // Fetch the held sale
  const { data, error } = await supabase
    .from('held_sales')
    .select('*')
    .eq('id', heldSaleId)
    .single()

  if (error) throw error

  const heldSale = data as unknown as HeldSale

  // Load items into cart
  useCartStore.getState().loadFromHeld(heldSale.items)

  // Delete the held sale record
  await supabase.from('held_sales').delete().eq('id', heldSaleId)
}

/**
 * Get recent sales for a shift (for receipt reprints etc.)
 */
export async function getShiftSales(shiftId: string) {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      *,
      sale_items:sale_items(*),
      payments:payments(*)
    `)
    .eq('shift_id', shiftId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}
