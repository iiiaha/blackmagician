import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Eye, EyeOff, Mail, Lock, User, CheckCircle } from 'lucide-react'

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
  const [mode, setMode] = useState<'login' | 'signup' | 'done'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordValid = password.length >= 6
  const passwordMatch = password === passwordConfirm
  const signupReady = mode === 'signup' && email && passwordValid && passwordMatch

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (mode === 'signup') {
      if (!passwordValid) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
      if (!passwordMatch) { setError('비밀번호가 일치하지 않습니다.'); return }
    }

    setLoading(true)

    try {
      if (mode === 'signup') {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || email.split('@')[0] } },
        })
        if (authError) {
          if (authError.message.includes('already registered')) setError('이미 등록된 이메일입니다.')
          else if (authError.message.includes('rate limit') || authError.message.includes('after')) setError('잠시 후 다시 시도해주세요.')
          else setError('가입 중 오류가 발생했습니다.')
          return
        }
        // Supabase returns user with empty identities if email already exists (security measure)
        if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
          setError('이미 등록된 이메일입니다.')
          return
        }
        setMode('done')
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.')
          return
        }
        navigate('/')
      }
    } catch {
      setError('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialLogin = async (provider: 'google') => {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + '/' },
    })
    if (error) setError('소셜 로그인 중 오류가 발생했습니다.')
  }

  // Signup complete screen
  if (mode === 'done') {
    return (
      <div className="flex items-center justify-center bg-background" style={{ height: 'calc(100vh - 60px - 24px)' }}>
        <div className="w-full max-w-[340px] bg-surface border border-border rounded-[8px] p-8 text-center">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-6 h-6 text-foreground" />
          </div>
          <h2 className="text-[15px] font-bold mb-2">인증 메일을 확인하세요</h2>
          <p className="text-[11px] text-muted-foreground leading-relaxed mb-1">
            <span className="font-semibold text-foreground">{email}</span>
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mb-6">
            위 주소로 인증 링크가 발송되었습니다.<br />
            메일함을 확인하고 링크를 클릭해주세요.
          </p>
          <button
            onClick={() => { setMode('login'); setPassword(''); setPasswordConfirm('') }}
            className="w-full h-[34px] bg-foreground text-primary-foreground text-[11px] font-semibold rounded-[5px] cursor-pointer hover:opacity-90 transition-opacity"
          >
            로그인으로 돌아가기
          </button>
          <p className="text-[9px] text-text-tertiary mt-4">
            메일이 오지 않나요? 스팸함을 확인해보세요.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center bg-background" style={{ height: 'calc(100vh - 60px - 24px)' }}>
      <div className="w-full max-w-[340px] bg-surface border border-border rounded-[8px] overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 text-center">
          <button
            onClick={() => navigate('/')}
            className="absolute left-5 top-5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-[15px] font-bold">{mode === 'login' ? '로그인' : '회원가입'}</h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            {mode === 'login' ? 'Black Magician Library에 로그인' : '계정을 만들어 마감재 라이브러리를 이용하세요'}
          </p>
        </div>

        <div className="px-6 pb-6">
          {/* Google */}
          <button
            onClick={() => handleSocialLogin('google')}
            className="w-full h-[38px] flex items-center justify-center gap-2.5 border border-border rounded-[5px] bg-surface hover:bg-muted cursor-pointer transition-colors mb-5"
          >
            <GoogleIcon className="w-[18px] h-[18px]" />
            <span className="text-[11px] font-semibold text-foreground">
              Google로 {mode === 'login' ? '로그인' : '가입하기'}
            </span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[9px] text-text-tertiary uppercase tracking-[1px] font-medium">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">닉네임</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
                  <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="표시될 이름 (선택)"
                    className="w-full h-[34px] text-[11px] pl-9 pr-3 bg-muted border border-border rounded-[5px] outline-none placeholder:text-text-tertiary focus:border-foreground"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">이메일</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full h-[34px] text-[11px] pl-9 pr-3 bg-muted border border-border rounded-[5px] outline-none placeholder:text-text-tertiary focus:border-foreground"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="6자 이상"
                  className="w-full h-[34px] text-[11px] pl-9 pr-9 bg-muted border border-border rounded-[5px] outline-none placeholder:text-text-tertiary focus:border-foreground"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-foreground cursor-pointer">
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {mode === 'signup' && password.length > 0 && (
                <p className={`text-[9px] mt-1 ${passwordValid ? 'text-[#16a34a]' : 'text-text-tertiary'}`}>
                  {passwordValid ? '✓ 사용 가능한 비밀번호' : `${6 - password.length}자 더 입력하세요`}
                </p>
              )}
            </div>

            {mode === 'signup' && (
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">비밀번호 확인</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
                  <input
                    type={showPasswordConfirm ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={e => setPasswordConfirm(e.target.value)}
                    placeholder="비밀번호 재입력"
                    className="w-full h-[34px] text-[11px] pl-9 pr-9 bg-muted border border-border rounded-[5px] outline-none placeholder:text-text-tertiary focus:border-foreground"
                    required
                  />
                  <button type="button" onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-foreground cursor-pointer">
                    {showPasswordConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {passwordConfirm.length > 0 && (
                  <p className={`text-[9px] mt-1 ${passwordMatch ? 'text-[#16a34a]' : 'text-destructive'}`}>
                    {passwordMatch ? '✓ 비밀번호 일치' : '✗ 비밀번호가 일치하지 않습니다'}
                  </p>
                )}
              </div>
            )}

            {error && <p className="text-[10px] text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={loading || (mode === 'signup' && !signupReady)}
              className="w-full h-[36px] bg-foreground text-primary-foreground text-[11px] font-semibold rounded-[5px] cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
            </button>
          </form>

          {/* Toggle */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setPasswordConfirm('') }}
              className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
