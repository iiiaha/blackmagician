import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const tossSecretKey = Deno.env.get('TOSS_SECRET_KEY')!
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, toss_customer_key')
      .eq('auth_user_id', user.id)
      .single()
    if (!profile) return new Response('Profile not found', { status: 404, headers: corsHeaders })

    const body = await req.json()
    const { authKey, customerKey } = body

    if (!authKey || !customerKey) {
      return new Response(JSON.stringify({ error: 'authKey and customerKey required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 1. 빌링키 발급
    const issueRes = await fetch('https://api.tosspayments.com/v1/billing/authorizations/issue', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(tossSecretKey + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ authKey, customerKey }),
    })

    const issueData = await issueRes.json()
    if (!issueRes.ok) {
      return new Response(JSON.stringify({ error: issueData.message || 'Billing key issue failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const billingKey = issueData.billingKey

    // 2. 첫 달 결제
    const now = new Date()
    const orderId = `BM-PRO-${profile.id.slice(0, 8)}-${now.getTime()}`
    const chargeRes = await fetch(`https://api.tosspayments.com/v1/billing/${billingKey}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(tossSecretKey + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerKey,
        amount: 3900,
        orderId,
        orderName: 'Black Magician Pro 월간 구독',
      }),
    })

    const chargeData = await chargeRes.json()
    if (!chargeRes.ok) {
      return new Response(JSON.stringify({ error: chargeData.message || 'Charge failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. DB 업데이트
    const expiresAt = new Date(now)
    expiresAt.setMonth(expiresAt.getMonth() + 1)

    await supabase
      .from('user_profiles')
      .update({
        plan: 'pro',
        toss_customer_key: customerKey,
        toss_billing_key: billingKey,
        plan_expires_at: expiresAt.toISOString(),
      })
      .eq('id', profile.id)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error(err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
