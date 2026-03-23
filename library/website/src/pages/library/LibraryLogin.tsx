import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default function LibraryLogin() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const handleGoogleLogin = async () => {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/' },
    })
    if (error) setError('로그인 중 오류가 발생했습니다.')
  }

  return (
    <div className="flex items-center justify-center bg-background" style={{ height: 'calc(100vh - 60px - 24px)' }}>
      <div className="w-full max-w-[320px] bg-surface border border-border rounded-[8px] overflow-hidden">
        <div className="relative px-6 pt-8 pb-3 text-center">
          <button
            onClick={() => navigate('/')}
            className="absolute left-5 top-5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-[14px] font-bold">로그인</h2>
        </div>

        <div className="px-6 pb-8 pt-4">
          <button
            onClick={handleGoogleLogin}
            className="w-full h-[42px] flex items-center justify-center gap-3 border border-border rounded-[6px] bg-surface hover:bg-muted cursor-pointer transition-colors"
          >
            <GoogleIcon className="w-[18px] h-[18px]" />
            <span className="text-[12px] font-semibold text-foreground">Google로 계속하기</span>
          </button>

          {error && <p className="text-[10px] text-destructive text-center mt-3">{error}</p>}

        </div>
      </div>
    </div>
  )
}
