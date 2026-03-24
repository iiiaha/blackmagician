import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Save, Check } from 'lucide-react'

export default function VendorProfile() {
  const { vendor, refreshVendor } = useAuth()
  const [form, setForm] = useState({
    contact_name: '',
    contact_phone: '',
    description: '',
    address: '',
    website_url: '',
    instagram: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!vendor) return
    setForm({
      contact_name: vendor.contact_name || '',
      contact_phone: vendor.contact_phone || '',
      description: vendor.description || '',
      address: vendor.address || '',
      website_url: vendor.website_url || '',
      instagram: vendor.instagram || '',
    })
  }, [vendor])

  const handleSave = async () => {
    if (!vendor) return
    setSaving(true)
    await supabase.from('vendors').update({
      contact_name: form.contact_name,
      contact_phone: form.contact_phone,
      description: form.description || null,
      address: form.address || null,
      website_url: form.website_url || null,
      instagram: form.instagram || null,
    }).eq('id', vendor.id)
    await refreshVendor()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!vendor) return null

  return (
    <div className="max-w-[480px]">
      <h1 className="text-[16px] font-bold mb-1">프로필 설정</h1>
      <p className="text-[11px] text-[#999] mb-6">Library에 표시되는 업체 정보를 관리합니다.</p>

      <div className="space-y-4">
        {/* Company name — read only */}
        <FormField label="업체명" readOnly>
          <input value={vendor.company_name} readOnly
            className="w-full h-[34px] text-[11px] px-3 bg-[#f5f5f5] border border-[rgba(0,0,0,0.06)] rounded-[4px] text-[#999] cursor-not-allowed" />
          <p className="text-[9px] text-[#aaa] mt-1">업체명 변경은 관리자에게 문의하세요.</p>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="담당자명">
            <input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))}
              className="w-full h-[34px] text-[11px] px-3 bg-white border border-[rgba(0,0,0,0.08)] rounded-[4px] outline-none focus:border-[#1a1a1a]" />
          </FormField>
          <FormField label="연락처">
            <input value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))}
              placeholder="010-0000-0000"
              className="w-full h-[34px] text-[11px] px-3 bg-white border border-[rgba(0,0,0,0.08)] rounded-[4px] outline-none focus:border-[#1a1a1a]" />
          </FormField>
        </div>

        <FormField label="소개글">
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            rows={3} placeholder="업체를 소개하는 2~3줄 문구"
            className="w-full text-[11px] px-3 py-2 bg-white border border-[rgba(0,0,0,0.08)] rounded-[4px] outline-none resize-none focus:border-[#1a1a1a] leading-relaxed" />
        </FormField>

        <FormField label="주소">
          <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
            placeholder="서울특별시 강남구 ..."
            className="w-full h-[34px] text-[11px] px-3 bg-white border border-[rgba(0,0,0,0.08)] rounded-[4px] outline-none focus:border-[#1a1a1a]" />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="홈페이지">
            <input value={form.website_url} onChange={e => setForm(p => ({ ...p, website_url: e.target.value }))}
              placeholder="https://"
              className="w-full h-[34px] text-[11px] px-3 bg-white border border-[rgba(0,0,0,0.08)] rounded-[4px] outline-none focus:border-[#1a1a1a]" />
          </FormField>
          <FormField label="인스타그램">
            <input value={form.instagram} onChange={e => setForm(p => ({ ...p, instagram: e.target.value }))}
              placeholder="@username"
              className="w-full h-[34px] text-[11px] px-3 bg-white border border-[rgba(0,0,0,0.08)] rounded-[4px] outline-none focus:border-[#1a1a1a]" />
          </FormField>
        </div>

        <div className="pt-2">
          <button onClick={handleSave} disabled={saving}
            className="h-[36px] px-5 bg-[#1a1a1a] text-white text-[11px] font-semibold rounded-[4px] cursor-pointer disabled:opacity-50 flex items-center gap-2">
            {saved ? <><Check className="w-3.5 h-3.5" /> 저장됨</> : saving ? '저장 중...' : <><Save className="w-3.5 h-3.5" /> 저장</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, readOnly, children }: { label: string; readOnly?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className={`text-[10px] font-semibold mb-1.5 block ${readOnly ? 'text-[#aaa]' : 'text-[#666]'}`}>
        {label}
      </label>
      {children}
    </div>
  )
}
