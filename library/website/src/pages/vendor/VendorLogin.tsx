import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Vendor } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default function VendorLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.')
        return
      }

      // Check if user is a vendor
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('인증 오류가 발생했습니다.')
        return
      }

      const { data } = await supabase
        .from('vendors')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()
      const vendor = data as Vendor | null

      if (!vendor) {
        setError('벤더 계정이 아닙니다. 벤더 등록을 먼저 진행해주세요.')
        await supabase.auth.signOut()
        return
      }

      if (!vendor.approved) {
        setError('관리자 승인 대기 중입니다. 승인 후 로그인이 가능합니다.')
        await supabase.auth.signOut()
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
    <div className="flex items-center justify-center min-h-[calc(100vh-48px)]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>벤더 로그인</CardTitle>
          <CardDescription>업체 계정으로 로그인하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vendor@company.com"
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
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '로그인 중...' : '로그인'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            계정이 없으신가요?{' '}
            <Link to="/vendor/register" className="text-foreground underline">
              벤더 등록
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
