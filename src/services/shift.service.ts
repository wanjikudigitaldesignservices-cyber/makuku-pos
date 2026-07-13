import { supabase } from '@/lib/supabase'
import type { ShiftReport, CloseShiftResult } from '@/types/database'

/**
 * Get the X-report (mid-shift snapshot) for a given shift.
 */
export async function getXReport(shiftId: string): Promise<ShiftReport> {
  const { data, error } = await supabase.rpc('get_shift_report', {
    p_shift_id: shiftId,
  })

  if (error) throw error
  return data as unknown as ShiftReport
}

/**
 * Close a shift and get the Z-report data.
 */
export async function closeShift(
  shiftId: string,
  countedCash: number
): Promise<CloseShiftResult> {
  const { data, error } = await supabase.rpc('close_shift', {
    p_shift_id: shiftId,
    p_counted_cash: countedCash,
  })

  if (error) throw error
  return data as unknown as CloseShiftResult
}

/**
 * Get shift history for a cashier or branch.
 */
export async function getShiftHistory(options: {
  branchId?: string
  cashierId?: string
  limit?: number
}) {
  let query = supabase
    .from('shifts')
    .select(`
      *,
      cashier:staff(full_name, role),
      till:tills(name)
    `)
    .order('opened_at', { ascending: false })
    .limit(options.limit || 20)

  if (options.branchId) {
    query = query.eq('branch_id', options.branchId)
  }
  if (options.cashierId) {
    query = query.eq('cashier_id', options.cashierId)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

/**
 * Get available tills for a branch.
 */
export async function getTills(branchId: string) {
  const { data, error } = await supabase
    .from('tills')
    .select('*')
    .eq('branch_id', branchId)
    .eq('active', true)
    .order('name')

  if (error) throw error
  return data
}
