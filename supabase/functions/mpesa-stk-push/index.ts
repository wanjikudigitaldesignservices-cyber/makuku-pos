import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const INTASEND_PUB_KEY = Deno.env.get('INTASEND_PUB_KEY') || ''
const INTASEND_SECRET_KEY = Deno.env.get('INTASEND_SECRET_KEY') || ''
const IS_TEST = Deno.env.get('INTASEND_TEST_MODE') === 'true'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, amount, reference } = await req.json()

    if (!phone || !amount || !reference) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Call IntaSend STK Push API
    const intasendUrl = IS_TEST 
      ? 'https://sandbox.intasend.com/api/v1/payment/mpesa-stk-push/'
      : 'https://payment.intasend.com/api/v1/payment/mpesa-stk-push/'

    const response = await fetch(intasendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INTASEND_SECRET_KEY}`,
      },
      body: JSON.stringify({
        phone_number: phone,
        amount: amount,
        api_ref: reference, // Sale ID
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.errors?.[0]?.detail || 'IntaSend API error')
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
