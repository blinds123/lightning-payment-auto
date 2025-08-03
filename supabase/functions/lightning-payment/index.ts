import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { pathname } = new URL(req.url)
    
    if (pathname === '/create-invoice') {
      const { amount, description, customer_email } = await req.json()
      
      // Validate amount ($20-100 range)
      if (!amount || amount < 20 || amount > 100) {
        return new Response(
          JSON.stringify({ error: 'Amount must be between $20 and $100' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create Lightning invoice (using Strike API or BTCPay)
      const invoice = {
        id: `inv_${crypto.randomUUID()}`,
        amount,
        description: description || 'Lightning payment',
        payment_request: `lnbc${amount}m1p${crypto.randomUUID().replace(/-/g, '').substring(0, 20)}`,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        status: 'pending',
        customer_email,
        created_at: new Date().toISOString()
      }

      // Store in Supabase
      const { data, error } = await supabaseClient
        .from('lightning_invoices')
        .insert([invoice])
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (pathname.startsWith('/check-payment/')) {
      const invoiceId = pathname.split('/').pop()
      
      const { data, error } = await supabaseClient
        .from('lightning_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})