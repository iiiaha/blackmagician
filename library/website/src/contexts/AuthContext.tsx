import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Vendor, UserProfile } from '@/types/database'

interface AuthState {
  user: User | null
  session: Session | null
  vendor: Vendor | null
  userProfile: UserProfile | null
  isAdmin: boolean
  loading: boolean
}

interface AuthContextType extends AuthState {
  signOut: () => Promise<void>
  refreshVendor: () => Promise<void>
  refreshUserProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map((e: string) => e.trim())

function checkAdmin(user: User) {
  return adminEmails.includes(user.email || '')
}

async function fetchVendor(userId: string): Promise<Vendor | null> {
  try {
    const { data } = await supabase
      .from('vendors')
      .select('*')
      .eq('auth_user_id', userId)
      .maybeSingle()
    return data as Vendor | null
  } catch {
    return null
  }
}

async function fetchOrCreateUserProfile(userId: string, email?: string): Promise<UserProfile | null> {
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', userId)
      .maybeSingle()
    if (data) return data as UserProfile

    // Auto-create profile if it doesn't exist
    const { data: newProfile } = await supabase
      .from('user_profiles')
      .insert({
        auth_user_id: userId,
        display_name: email?.split('@')[0] || null,
      })
      .select()
      .single()
    return newProfile as UserProfile | null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    vendor: null,
    userProfile: null,
    isAdmin: false,
    loading: true,
  })

  const loadUserData = async (session: Session | null) => {
    if (session?.user) {
      const [vendor, userProfile] = await Promise.all([
        fetchVendor(session.user.id),
        fetchOrCreateUserProfile(session.user.id, session.user.email),
      ])
      setState({
        user: session.user,
        session,
        vendor,
        userProfile,
        isAdmin: checkAdmin(session.user),
        loading: false,
      })
    } else {
      setState({
        user: null,
        session: null,
        vendor: null,
        userProfile: null,
        isAdmin: false,
        loading: false,
      })
    }
  }

  useEffect(() => {
    // Initial session load
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUserData(session)
    }).catch(() => {
      setState(prev => ({ ...prev, loading: false }))
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUserData(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshVendor = async () => {
    if (state.user) {
      const vendor = await fetchVendor(state.user.id)
      setState(prev => ({ ...prev, vendor }))
    }
  }

  const refreshUserProfile = async () => {
    if (state.user) {
      const userProfile = await fetchOrCreateUserProfile(state.user.id, state.user.email ?? undefined)
      setState(prev => ({ ...prev, userProfile }))
    }
  }

  return (
    <AuthContext.Provider value={{ ...state, signOut, refreshVendor, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
