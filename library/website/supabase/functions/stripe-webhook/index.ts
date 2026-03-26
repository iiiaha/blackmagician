import Stripe from 'https://esm.sh/stripe@17?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2025-04-30.basil' })
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
        const session = event.data.object as Stripe.Checkout.Session
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        // Fetch subscription to get period end
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const periodEnd = new Date(subscription.current_period_end * 1000).toISOString()

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
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const periodEnd = new Date(subscription.current_period_end * 1000).toISOString()

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
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

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
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        if (subscription.status === 'active') {
          const periodEnd = new Date(subscription.current_period_end * 1000).toISOString()
          await supabase
            .from('user_profiles')
            .update({
              plan: 'pro',
              plan_expires_at: periodEnd,
            })
            .eq('stripe_customer_id', customerId)
        } else if (subscription.status === 'past_due' || subscription.status === 'canceled' || subscription.status === 'unpaid') {
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
