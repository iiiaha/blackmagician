import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { supabase } from './supabase'

const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY as string
const functionsUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

export async function requestBillingAuth(customerKey: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tossPayments: any = await loadTossPayments(clientKey)
  const billing = tossPayments.billing({ customerKey })

  await billing.requestBillingAuth({
    method: 'CARD',
    successUrl: `${window.location.origin}/?billing=success`,
    failUrl: `${window.location.origin}/?billing=fail`,
  })
}

export async function issueBillingKey(authKey: string, customerKey: string) {
  const headers = await getAuthHeaders()

  const res = await fetch(`${functionsUrl}/toss-billing-issue`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ authKey, customerKey }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || 'Billing issue failed')
  }

  return res.json()
}

export async function cancelSubscription() {
  const headers = await getAuthHeaders()

  const res = await fetch(`${functionsUrl}/toss-cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || 'Cancel failed')
  }

  return res.json()
}
