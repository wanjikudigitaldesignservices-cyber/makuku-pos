import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

serve(async (req) => {
  try {
    // IntaSend webhook payload
    const payload = await req.json()
    
    // We expect payload.api_ref to be our sale_id
    // and payload.state to be COMPLETE, FAILED, etc.
    const saleId = payload.api_ref
    const state = payload.state
    const intasendRef = payload.invoice_id
    
    if (!saleId) {
      return new Response('Missing api_ref', { status: 400 })
    }

    let status = 'pending'
    if (state === 'COMPLETE') status = 'confirmed'
    if (state === 'FAILED') status = 'failed'

    // Update the payment record
    const { error } = await supabase
      .from('payments')
      .update({ 
        status, 
        intasend_ref: intasendRef 
      })
      .eq('sale_id', saleId)
      .eq('method', 'mpesa')

    if (error) throw error

    // If payment failed, we might need to void the sale or alert the cashier
    // But typically the cashier is waiting on the screen via Realtime

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
