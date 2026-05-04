import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'admin1234'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Already authenticated
  useEffect(() => {
    if (sessionStorage.getItem('bm-admin') === 'true') {
      navigate('/admin')
    }
  }, [navigate])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('bm-admin', 'true')
      navigate('/admin')
    } else {
      setError('비밀번호가 올바르지 않습니다.')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#fafafa]">
      <div className="w-[280px] bg-white border border-[rgba(0,0,0,0.06)] rounded-[8px] p-6">
        <h2 className="text-[14px] font-bold text-center mb-4">Admin</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="Password"
            autoFocus
            className="w-full h-[36px] text-[11px] px-3 bg-[#fafafa] border border-[rgba(0,0,0,0.08)] rounded-[5px] outline-none focus:border-[#1a1a1a] mb-3"
          />
          {error && <p className="text-[10px] text-[#e53e3e] mb-3">{error}</p>}
          <button type="submit"
            className="w-full h-[36px] bg-[#1a1a1a] text-white text-[11px] font-semibold rounded-[5px] cursor-pointer hover:opacity-90">
            Enter
          </button>
        </form>
      </div>
    </div>
  )
}
