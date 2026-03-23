import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { user, isAdmin, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      navigate('/admin')
    }
  }, [user, isAdmin, authLoading, navigate])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map((e: string) => e.trim())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!adminEmails.includes(email)) {
      setError('관리자 권한이 없는 이메일입니다.')
      setLoading(false)
      return
    }

    try {
      if (isSignUp) {
        const { error: authError } = await supabase.auth.signUp({ email, password })
        if (authError) {
          setError('가입 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
          return
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.')
          return
        }
      }
      navigate('/admin')
    } catch {
      setError('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Admin</CardTitle>
          <CardDescription>관리자 로그인</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '처리 중...' : isSignUp ? '관리자 계정 생성' : '로그인'}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {isSignUp ? '이미 계정이 있습니다 → 로그인' : '최초 접속 → 계정 생성'}
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
