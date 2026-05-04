import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    // 빌링키 삭제 + 플랜 Free 전환 (남은 기간은 유지)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, plan_expires_at')
      .eq('auth_user_id', user.id)
      .single()

    if (!profile) return new Response('Profile not found', { status: 404, headers: corsHeaders })

    // 빌링키를 삭제하면 다음 자동결제가 안 됨
    // plan_expires_at까지는 Pro 유지, 만료 후 자동으로 Free
    await supabase
      .from('user_profiles')
      .update({
        toss_billing_key: null,
      })
      .eq('id', profile.id)

    return new Response(
      JSON.stringify({ success: true, expires_at: profile.plan_expires_at }),
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
