import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default function VendorRegister() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    companyName: '',
    contactName: '',
    contactPhone: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const updateForm = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    if (form.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setLoading(true)

    try {
      // Check if company already registered
      const { data: existing } = await supabase
        .from('vendors')
        .select('id')
        .eq('company_name', form.companyName)
        .single()

      if (existing) {
        setError('이미 등록된 업체입니다. 업체당 하나의 계정만 허용됩니다.')
        return
      }

      // Sign up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('이미 등록된 이메일입니다.')
        } else if (authError.message.includes('rate limit')) {
          setError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.')
        } else if (authError.message.includes('after')) {
          setError('보안을 위해 잠시 후 다시 시도해주세요.')
        } else {
          setError('회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
        }
        return
      }

      if (!authData.user) {
        setError('회원가입 오류가 발생했습니다.')
        return
      }

      // Create vendor record
      const { error: vendorError } = await supabase
        .from('vendors')
        .insert({
          auth_user_id: authData.user.id,
          company_name: form.companyName,
          contact_name: form.contactName,
          contact_phone: form.contactPhone,
        })

      if (vendorError) {
        // RLS 등 서버 오류 — 사용자에게는 간결하게
        console.error('Vendor insert error:', vendorError)
        setError('벤더 정보 저장 중 오류가 발생했습니다. 관리자에게 문의해주세요.')
        return
      }

      // Sign out — vendor needs admin approval first
      await supabase.auth.signOut()
      setSuccess(true)
    } catch {
      setError('등록 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-48px)]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>등록 완료</CardTitle>
            <CardDescription>
              벤더 등록이 완료되었습니다.<br />
              관리자 승인 후 로그인이 가능합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/vendor/login">
              <Button variant="outline">로그인 페이지로</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-48px)]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>벤더 등록</CardTitle>
          <CardDescription>마감재 업체 계정을 등록하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">업체명 *</Label>
              <Input
                id="companyName"
                value={form.companyName}
                onChange={(e) => updateForm('companyName', e.target.value)}
                placeholder="(주)마벨로"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">담당자명 *</Label>
              <Input
                id="contactName"
                value={form.contactName}
                onChange={(e) => updateForm('contactName', e.target.value)}
                placeholder="홍길동"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">담당자 연락처 *</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={form.contactPhone}
                onChange={(e) => updateForm('contactPhone', e.target.value)}
                placeholder="010-1234-5678"
                required
              />
            </div>

            <hr className="my-2" />

            <div className="space-y-2">
              <Label htmlFor="email">이메일 (로그인용) *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => updateForm('email', e.target.value)}
                placeholder="vendor@company.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호 *</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => updateForm('password', e.target.value)}
                placeholder="6자 이상"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">비밀번호 확인 *</Label>
              <Input
                id="passwordConfirm"
                type="password"
                value={form.passwordConfirm}
                onChange={(e) => updateForm('passwordConfirm', e.target.value)}
                placeholder="비밀번호 재입력"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '등록 중...' : '벤더 등록 신청'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            이미 계정이 있으신가요?{' '}
            <Link to="/vendor/login" className="text-foreground underline">
              로그인
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
