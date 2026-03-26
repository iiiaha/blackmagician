import { supabase } from './supabase'

const functionsUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

async function callEdgeFunction(name: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await fetch(`${functionsUrl}/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ origin: window.location.origin }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || 'Request failed')
  }

  const { url } = await res.json()
  return url
}

export async function createCheckoutSession(): Promise<string> {
  return callEdgeFunction('stripe-checkout')
}

export async function createPortalSession(): Promise<string> {
  return callEdgeFunction('stripe-portal')
}
