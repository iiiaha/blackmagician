import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function VendorLogin() {
  const navigate = useNavigate()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Append domain suffix for Supabase Auth (requires email format)
      const email = loginId.includes('@') ? loginId : `${loginId}@vendor.blackmagician`
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError('ID 또는 비밀번호가 올바르지 않습니다.')
        return
      }

      navigate('/vendor')
    } catch {
      setError('로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#fafafa]">
      <div className="w-[300px] bg-white border border-[rgba(0,0,0,0.06)] rounded-[8px] p-6">
        <div className="text-center mb-5">
          <h2 className="text-[14px] font-bold">Vendor Portal</h2>
          <p className="text-[10px] text-[#999] mt-1">관리자로부터 발급받은 계정으로 로그인하세요</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-[#666] mb-1 block">ID</label>
            <input value={loginId} onChange={e => setLoginId(e.target.value)}
              placeholder="발급받은 아이디"
              className="w-full h-[34px] text-[11px] px-3 bg-[#fafafa] border border-[rgba(0,0,0,0.08)] rounded-[4px] outline-none focus:border-[#1a1a1a]"
              required />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-[#666] mb-1 block">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호"
              className="w-full h-[34px] text-[11px] px-3 bg-[#fafafa] border border-[rgba(0,0,0,0.08)] rounded-[4px] outline-none focus:border-[#1a1a1a]"
              required />
          </div>

          {error && <p className="text-[10px] text-[#e53e3e]">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full h-[36px] bg-[#1a1a1a] text-white text-[11px] font-semibold rounded-[5px] cursor-pointer hover:opacity-90 disabled:opacity-50">
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
