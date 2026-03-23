import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

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

function NaverIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="4" fill="#03C75A"/>
      <path d="M13.5 12.6L10.2 7.5H7.5v9h3.3v-5.1l3.3 5.1h2.4v-9h-3v5.1z" fill="white"/>
    </svg>
  )
}

function KakaoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="4" fill="#FEE500"/>
      <path d="M12 6C8.13 6 5 8.46 5 11.5c0 1.97 1.3 3.69 3.27 4.65l-.84 3.1c-.05.2.17.36.34.25l3.65-2.42c.19.02.38.02.58.02 3.87 0 7-2.46 7-5.5S15.87 6 12 6z" fill="#3C1E1E"/>
    </svg>
  )
}

export default function LibraryLogin() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
        if (authError) {
          if (authError.message.includes('already registered')) {
            setError('이미 등록된 이메일입니다.')
          } else if (authError.message.includes('rate limit') || authError.message.includes('after')) {
            setError('잠시 후 다시 시도해주세요.')
          } else {
            setError('가입 중 오류가 발생했습니다.')
          }
          return
        }
        if (authData.user) {
          await supabase.from('user_profiles').insert({
            auth_user_id: authData.user.id,
            display_name: displayName || email.split('@')[0],
          })
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.')
          return
        }
      }
      navigate('/')
    } catch {
      setError('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin + '/',
      },
    })
    if (error) setError('소셜 로그인 중 오류가 발생했습니다.')
  }

  const handleNaverLogin = async () => {
    setError('')
    // Naver uses custom OIDC in Supabase
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao', // placeholder — Naver needs custom OIDC setup
      options: {
        redirectTo: window.location.origin + '/',
      },
    })
    if (error) setError('소셜 로그인 중 오류가 발생했습니다.')
  }

  return (
    <div className="flex items-center justify-center bg-background" style={{ height: 'calc(100vh - 60px - 24px)' }}>
      <Card className="w-full max-w-[340px] bg-surface border-border">
        <CardHeader className="text-center relative">
          <button
            onClick={() => navigate('/')}
            className="absolute left-4 top-4 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <CardTitle className="text-[15px] font-bold">{mode === 'login' ? '로그인' : '회원가입'}</CardTitle>
          <CardDescription className="text-[11px]">
            {mode === 'login' ? '마감재 라이브러리에 로그인하세요' : '계정을 만들어 마감재를 이용하세요'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Social Login Buttons */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => handleSocialLogin('google')}
              className="flex-1 h-[36px] flex items-center justify-center gap-2 border border-border rounded-[5px] bg-surface hover:bg-muted cursor-pointer transition-colors"
            >
              <GoogleIcon className="w-4 h-4" />
              <span className="text-[10px] font-semibold text-foreground">Google</span>
            </button>
            <button
              onClick={handleNaverLogin}
              className="flex-1 h-[36px] flex items-center justify-center gap-2 border border-border rounded-[5px] bg-surface hover:bg-muted cursor-pointer transition-colors"
            >
              <NaverIcon className="w-4 h-4 rounded-[2px]" />
              <span className="text-[10px] font-semibold text-foreground">Naver</span>
            </button>
            <button
              onClick={() => handleSocialLogin('kakao')}
              className="flex-1 h-[36px] flex items-center justify-center gap-2 border border-border rounded-[5px] bg-surface hover:bg-muted cursor-pointer transition-colors"
            >
              <KakaoIcon className="w-4 h-4 rounded-[2px]" />
              <span className="text-[10px] font-semibold text-foreground">Kakao</span>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[9px] text-text-tertiary uppercase tracking-[0.5px]">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="space-y-2.5">
            {mode === 'signup' && (
              <div className="space-y-1">
                <Label htmlFor="displayName" className="text-[10px] font-semibold text-muted-foreground">닉네임</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="표시될 이름"
                  className="h-[32px] text-[11px] bg-muted border-border rounded-[4px]"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="email" className="text-[10px] font-semibold text-muted-foreground">이메일</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="h-[32px] text-[11px] bg-muted border-border rounded-[4px]"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-[10px] font-semibold text-muted-foreground">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
                className="h-[32px] text-[11px] bg-muted border-border rounded-[4px]"
                required
              />
            </div>

            {error && <p className="text-[10px] text-destructive">{error}</p>}

            <Button type="submit" className="w-full h-[32px] text-[11px] font-semibold rounded-[4px]" disabled={loading}>
              {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
            className="mt-3 w-full text-center text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
