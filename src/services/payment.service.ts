import { supabase } from '@/lib/supabase'

/**
 * Initiate an M-Pesa STK Push via Supabase Edge Function.
 */
export async function initiateSTKPush(
  phone: string,
  amount: number,
  saleReference: string
): Promise<{ invoice_id: string; status: string }> {
  const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
    body: { phone, amount, reference: saleReference },
  })

  if (error) throw error
  return data
}

/**
 * Check payment status for a given IntaSend reference.
 */
export async function checkPaymentStatus(intasendRef: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('intasend_ref', intasendRef)
    .single()

  if (error) throw error
  return data
}

/**
 * Subscribe to payment status changes for real-time updates.
 */
export function subscribeToPayment(
  saleId: string,
  callback: (status: string) => void
) {
  const channel = supabase
    .channel(`payment-${saleId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'payments',
        filter: `sale_id=eq.${saleId}`,
      },
      (payload) => {
        const newStatus = payload.new as { status: string }
        callback(newStatus.status)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
