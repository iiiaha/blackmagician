import Stripe from 'https://esm.sh/stripe@17?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function toISOString(value: unknown): string {
  if (!value) return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  if (typeof value === 'number') return new Date(value * 1000).toISOString()
  if (typeof value === 'string') return new Date(value).toISOString()
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')!

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const customerId = (session as Record<string, unknown>).customer as string
        const subscriptionId = (session as Record<string, unknown>).subscription as string

        // Fetch subscription to get period end
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const periodEnd = toISOString((subscription as Record<string, unknown>).current_period_end)

        await supabase
          .from('user_profiles')
          .update({
            plan: 'pro',
            stripe_subscription_id: subscriptionId,
            plan_expires_at: periodEnd,
          })
          .eq('stripe_customer_id', customerId)

        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object
        const customerId = (invoice as Record<string, unknown>).customer as string
        const subscriptionId = (invoice as Record<string, unknown>).subscription as string

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const periodEnd = toISOString((subscription as Record<string, unknown>).current_period_end)

          await supabase
            .from('user_profiles')
            .update({
              plan: 'pro',
              plan_expires_at: periodEnd,
            })
            .eq('stripe_customer_id', customerId)
        }

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const customerId = (subscription as Record<string, unknown>).customer as string

        await supabase
          .from('user_profiles')
          .update({
            plan: 'free',
            stripe_subscription_id: null,
            plan_expires_at: null,
          })
          .eq('stripe_customer_id', customerId)

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const customerId = (subscription as Record<string, unknown>).customer as string
        const status = (subscription as Record<string, unknown>).status as string

        if (status === 'active') {
          const periodEnd = toISOString((subscription as Record<string, unknown>).current_period_end)
          await supabase
            .from('user_profiles')
            .update({
              plan: 'pro',
              plan_expires_at: periodEnd,
            })
            .eq('stripe_customer_id', customerId)
        } else if (status === 'past_due' || status === 'canceled' || status === 'unpaid') {
          await supabase
            .from('user_profiles')
            .update({
              plan: 'free',
              stripe_subscription_id: null,
              plan_expires_at: null,
            })
            .eq('stripe_customer_id', customerId)
        }

        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
