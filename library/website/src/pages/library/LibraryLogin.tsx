import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

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

  return (
    <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 40px)' }}>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <button
            onClick={() => navigate('/')}
            className="absolute left-4 top-4 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <CardTitle className="text-lg">{mode === 'login' ? '로그인' : '회원가입'}</CardTitle>
          <CardDescription>
            {mode === 'login' ? '마감재 라이브러리에 로그인하세요' : '계정을 만들어 마감재를 다운로드하세요'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <Label htmlFor="displayName" className="text-xs">닉네임</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="표시될 이름"
                  className="h-8 text-sm"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">이메일</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="h-8 text-sm"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
                className="h-8 text-sm"
                required
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button type="submit" className="w-full h-8 text-sm" disabled={loading}>
              {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
            className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
