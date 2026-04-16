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
  isPro: boolean
  todayApplyCount: number
  maxFreeApplies: number
  canApply: boolean
  refreshApplyCount: () => Promise<void>
  logApply: (productId: string) => Promise<boolean>
  vendorMode: string | null
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
    if (data) {
      const profile = data as UserProfile
      // Soft-deleted account: check rejoin ban
      if (profile.deleted_at) {
        if (profile.rejoin_available_at && new Date(profile.rejoin_available_at) > new Date()) {
          // Still banned — sign out and return null
          await supabase.auth.signOut()
          const daysLeft = Math.ceil((new Date(profile.rejoin_available_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          alert(`탈퇴 후 재가입 제한 기간입니다.\n${daysLeft}일 후에 다시 가입할 수 있습니다.`)
          return null
        }
        // Ban expired — reactivate account
        await supabase.from('user_profiles').update({
          deleted_at: null,
          rejoin_available_at: null,
        }).eq('id', profile.id)
        profile.deleted_at = null
        profile.rejoin_available_at = null
      }
      return profile
    }

    // Auto-create profile with 3-day Pro trial
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 3)

    const { data: newProfile } = await supabase
      .from('user_profiles')
      .insert({
        auth_user_id: userId,
        display_name: email?.split('@')[0] || null,
        trial_used: true,
        trial_expires_at: trialEnd.toISOString(),
      })
      .select()
      .single()
    return newProfile as UserProfile | null
  } catch {
    return null
  }
}

const FREE_DAILY_LIMIT = 3

export function AuthProvider({ children }: { children: ReactNode }) {
  const [vendorMode] = useState(() => new URLSearchParams(window.location.search).get('vendor'))

  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    vendor: null,
    userProfile: null,
    isAdmin: false,
    loading: !vendorMode,
  })
  const [todayApplyCount, setTodayApplyCount] = useState(0)

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
    if (vendorMode) return // Skip auth in vendor mode
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

  const refreshApplyCount = async () => {
    if (!state.userProfile) { setTodayApplyCount(0); return }
    const { data } = await supabase.rpc('get_today_apply_count', { p_user_id: state.userProfile.id })
    setTodayApplyCount(typeof data === 'number' ? data : 0)
  }

  // Check if user is on pro plan (active subscription or active trial)
  const profile = state.userProfile
  const now = new Date()
  const isPro = vendorMode ? true : !!profile && (
    (profile.plan === 'pro' && (!profile.plan_expires_at || new Date(profile.plan_expires_at) > now)) ||
    (!!profile.trial_expires_at && new Date(profile.trial_expires_at) > now)
  )
  const canApply = vendorMode ? true : !!profile

  const logApply = async (productId: string): Promise<boolean> => {
    if (vendorMode) return true // No logging in vendor mode
    if (!state.userProfile) return false

    await supabase.from('apply_logs').insert({
      user_id: state.userProfile.id,
      product_id: productId,
    })
    setTodayApplyCount(prev => prev + 1)
    return true
  }

  // Fetch apply count when profile loads
  useEffect(() => {
    if (state.userProfile) refreshApplyCount()
  }, [state.userProfile?.id])

  return (
    <AuthContext.Provider value={{
      ...state, signOut, refreshVendor, refreshUserProfile,
      isPro, todayApplyCount, maxFreeApplies: FREE_DAILY_LIMIT, canApply,
      refreshApplyCount, logApply, vendorMode,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
