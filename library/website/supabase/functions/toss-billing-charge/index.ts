import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 매일 cron으로 호출 — 만료된 Pro 사용자를 자동 결제
const tossSecretKey = Deno.env.get('TOSS_SECRET_KEY')!
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  // 간단한 시크릿 체크 (cron에서만 호출)
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${supabaseServiceKey}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // plan_expires_at이 지났고, toss_billing_key가 있는 사용자 = 갱신 대상
  const { data: dueUsers } = await supabase
    .from('user_profiles')
    .select('id, toss_customer_key, toss_billing_key, plan_expires_at')
    .eq('plan', 'pro')
    .not('toss_billing_key', 'is', null)
    .lte('plan_expires_at', new Date().toISOString())

  const results: { id: string; success: boolean; error?: string }[] = []

  for (const user of dueUsers || []) {
    const orderId = `BM-PRO-${user.id.slice(0, 8)}-${Date.now()}`

    try {
      const res = await fetch(`https://api.tosspayments.com/v1/billing/${user.toss_billing_key}`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(tossSecretKey + ':')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerKey: user.toss_customer_key,
          amount: 3900,
          orderId,
          orderName: 'Black Magician Pro 월간 구독',
        }),
      })

      if (res.ok) {
        const newExpiry = new Date(user.plan_expires_at!)
        newExpiry.setMonth(newExpiry.getMonth() + 1)

        await supabase
          .from('user_profiles')
          .update({ plan_expires_at: newExpiry.toISOString() })
          .eq('id', user.id)

        results.push({ id: user.id, success: true })
      } else {
        const err = await res.json()
        // 결제 실패 → Free 전환
        await supabase
          .from('user_profiles')
          .update({ plan: 'free', toss_billing_key: null, plan_expires_at: null })
          .eq('id', user.id)

        results.push({ id: user.id, success: false, error: err.message })
      }
    } catch (err) {
      await supabase
        .from('user_profiles')
        .update({ plan: 'free', toss_billing_key: null, plan_expires_at: null })
        .eq('id', user.id)

      results.push({ id: user.id, success: false, error: (err as Error).message })
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
