import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Crown, User, TrendingUp } from 'lucide-react'

interface UserRow {
  id: string
  auth_user_id: string
  display_name: string | null
  plan: 'free' | 'pro'
  plan_expires_at: string | null
  trial_used: boolean
  trial_expires_at: string | null
  deleted_at: string | null
  rejoin_available_at: string | null
  created_at: string
  email?: string
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pro' | 'free' | 'trial' | 'deleted'>('all')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers((data as UserRow[]) || [])
    setLoading(false)
  }

  const now = new Date()

  const isTrialActive = (u: UserRow) =>
    !!u.trial_expires_at && new Date(u.trial_expires_at) > now && u.plan !== 'pro'

  const isProActive = (u: UserRow) =>
    u.plan === 'pro' && (!u.plan_expires_at || new Date(u.plan_expires_at) > now)

  const isDeleted = (u: UserRow) => !!u.deleted_at

  // Stats
  const activeUsers = users.filter(u => !isDeleted(u))
  const proUsers = activeUsers.filter(u => isProActive(u))
  const trialUsers = activeUsers.filter(u => isTrialActive(u))
  const freeUsers = activeUsers.filter(u => !isProActive(u) && !isTrialActive(u))
  const deletedUsers = users.filter(u => isDeleted(u))

  const monthlyRevenue = proUsers.length * 3900

  // Filter
  const filtered = users.filter(u => {
    if (filter === 'pro') return isProActive(u)
    if (filter === 'free') return !isProActive(u) && !isTrialActive(u) && !isDeleted(u)
    if (filter === 'trial') return isTrialActive(u)
    if (filter === 'deleted') return isDeleted(u)
    return true
  })

  const togglePlan = async (u: UserRow) => {
    const newPlan = u.plan === 'pro' ? 'free' : 'pro'
    const update: Record<string, unknown> = { plan: newPlan }
    if (newPlan === 'pro') {
      const expires = new Date()
      expires.setMonth(expires.getMonth() + 1)
      update.plan_expires_at = expires.toISOString()
    } else {
      update.plan_expires_at = null
    }
    await supabase.from('user_profiles').update(update).eq('id', u.id)
    fetchUsers()
  }

  const formatDate = (d: string | null) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  const getStatus = (u: UserRow) => {
    if (isDeleted(u)) return { label: '탈퇴', cls: 'text-[#999] bg-[#f0f0f0]' }
    if (isProActive(u)) return { label: 'PRO', cls: 'text-white bg-[#1a1a1a]' }
    if (isTrialActive(u)) return { label: '체험중', cls: 'text-[#059669] bg-[#d1fae5]' }
    return { label: 'Free', cls: 'text-[#666] bg-[#f5f5f5]' }
  }

  if (loading) return <p className="text-[11px] text-[#999]">로딩중...</p>

  return (
    <div>
      <h1 className="text-[16px] font-bold mb-5">사용자 관리</h1>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <StatCard label="전체 사용자" value={activeUsers.length} icon={User} />
        <StatCard label="Pro 회원" value={proUsers.length} icon={Crown} accent />
        <StatCard label="체험중" value={trialUsers.length} icon={User} />
        <StatCard label="무료 회원" value={freeUsers.length} icon={User} />
        <StatCard label="이번달 예상 수익" value={`₩${monthlyRevenue.toLocaleString()}`} icon={TrendingUp} accent />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
        {([
          ['all', `전체 (${users.length})`],
          ['pro', `Pro (${proUsers.length})`],
          ['trial', `체험중 (${trialUsers.length})`],
          ['free', `Free (${freeUsers.length})`],
          ['deleted', `탈퇴 (${deletedUsers.length})`],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1 text-[10px] rounded-[4px] cursor-pointer transition-colors ${
              filter === key
                ? 'bg-[#1a1a1a] text-white font-semibold'
                : 'bg-[#f0f0f0] text-[#666] hover:bg-[#e5e5e5]'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* User table */}
      <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-[6px] overflow-hidden">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-[#fafafa] border-b border-[rgba(0,0,0,0.06)]">
              <th className="text-left px-3 py-2 font-semibold text-[#888]">이름</th>
              <th className="text-left px-3 py-2 font-semibold text-[#888]">상태</th>
              <th className="text-left px-3 py-2 font-semibold text-[#888]">가입일</th>
              <th className="text-left px-3 py-2 font-semibold text-[#888]">체험 만료</th>
              <th className="text-left px-3 py-2 font-semibold text-[#888]">결제 만료</th>
              <th className="text-center px-3 py-2 font-semibold text-[#888]">플랜 변경</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const status = getStatus(u)
              return (
                <tr key={u.id} className="border-b border-[rgba(0,0,0,0.04)] hover:bg-[#fafafa]">
                  <td className="px-3 py-2">
                    <span className="font-medium">{u.display_name || '-'}</span>
                    <span className="text-[9px] text-[#aaa] ml-1.5">{u.auth_user_id.slice(0, 8)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-1.5 py-[1px] rounded-[3px] text-[8px] font-bold ${status.cls}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[#666]">{formatDate(u.created_at)}</td>
                  <td className="px-3 py-2 text-[#666]">{formatDate(u.trial_expires_at)}</td>
                  <td className="px-3 py-2 text-[#666]">{formatDate(u.plan_expires_at)}</td>
                  <td className="px-3 py-2 text-center">
                    {!isDeleted(u) && (
                      <button onClick={() => togglePlan(u)}
                        className={`px-2 py-[2px] rounded-[3px] text-[9px] font-semibold cursor-pointer transition-colors ${
                          isProActive(u)
                            ? 'bg-[#fee2e2] text-[#dc2626] hover:bg-[#fecaca]'
                            : 'bg-[#d1fae5] text-[#059669] hover:bg-[#a7f3d0]'
                        }`}>
                        {isProActive(u) ? 'Free로 변경' : 'Pro로 변경'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-[#999]">해당 사용자 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, accent }: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; accent?: boolean
}) {
  return (
    <div className={`border rounded-[6px] p-4 ${accent ? 'bg-[#1a1a1a] border-[#1a1a1a]' : 'bg-white border-[rgba(0,0,0,0.06)]'}`}>
      <Icon className={`w-4 h-4 mb-2 ${accent ? 'text-white/50' : 'text-[#aaa]'}`} />
      <p className={`text-[18px] font-bold ${accent ? 'text-white' : ''}`}>{value}</p>
      <p className={`text-[10px] ${accent ? 'text-white/50' : 'text-[#999]'}`}>{label}</p>
    </div>
  )
}
