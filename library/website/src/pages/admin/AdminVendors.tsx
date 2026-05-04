import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/categories'
import { Plus, Trash2, KeyRound, ChevronDown, ChevronRight, Pencil, Save, ArrowUp, ArrowDown, Upload, X } from 'lucide-react'
import type { Vendor } from '@/types/database'

type EditableFields = {
  contact_name: string
  contact_phone: string
  address: string
  website_url: string
  instagram: string
  slug: string
  description: string
}

function pickEditable(v: Vendor): EditableFields {
  return {
    contact_name: v.contact_name || '',
    contact_phone: v.contact_phone || '',
    address: v.address || '',
    website_url: v.website_url || '',
    instagram: v.instagram || '',
    slug: v.slug || '',
    description: v.description || '',
  }
}

export default function AdminVendors() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({ login_id: '', password: '', company_name: '', category: 'tile' })
  const [creating, setCreating] = useState(false)
  const [resetPwVendorId, setResetPwVendorId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null)
  const [bannerDeleteTarget, setBannerDeleteTarget] = useState<Vendor | null>(null)
  const [bannerUploadingId, setBannerUploadingId] = useState<string | null>(null)

  // Edit mode & state per vendor
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<Record<string, EditableFields>>({})
  const [saving, setSaving] = useState(false)

  const fetchVendors = async () => {
    // Client-side sort by (category, sort_order, company_name) so the page works
    // even before the sort_order migration runs — a server-side .order on a
    // missing column would fail the whole query and look like "no vendors".
    const { data } = await supabase.from('vendors').select('*')
    const list = ((data as Vendor[]) || []).slice().sort((a, b) =>
      (a.category || '').localeCompare(b.category || '')
      || ((a.sort_order ?? 0) - (b.sort_order ?? 0))
      || a.company_name.localeCompare(b.company_name)
    )
    setVendors(list)
    setLoading(false)
  }

  const handleMove = async (vendor: Vendor, direction: 'up' | 'down') => {
    const siblings = vendors
      .filter(v => v.category === vendor.category)
      .sort((a, b) => a.sort_order - b.sort_order || a.company_name.localeCompare(b.company_name))
    const idx = siblings.findIndex(s => s.id === vendor.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= siblings.length) return

    const current = siblings[idx]
    const swap = siblings[swapIdx]
    await Promise.all([
      supabase.from('vendors').update({ sort_order: swap.sort_order }).eq('id', current.id),
      supabase.from('vendors').update({ sort_order: current.sort_order }).eq('id', swap.id),
    ])
    fetchVendors()
  }

  useEffect(() => { fetchVendors() }, [])

  const handleExpand = (vendor: Vendor) => {
    if (expandedId === vendor.id) {
      setExpandedId(null)
      setEditingId(null)
      return
    }
    setExpandedId(vendor.id)
    setEditingId(null)
  }

  const startEditing = (vendor: Vendor) => {
    setEditState(prev => ({ ...prev, [vendor.id]: pickEditable(vendor) }))
    setEditingId(vendor.id)
  }

  const cancelEditing = () => {
    setEditingId(null)
  }

  const updateField = (vendorId: string, field: keyof EditableFields, value: string) => {
    setEditState(prev => ({
      ...prev,
      [vendorId]: { ...prev[vendorId], [field]: value },
    }))
  }

  const handleSave = async (vendor: Vendor) => {
    const edit = editState[vendor.id]
    if (!edit) return
    setSaving(true)
    const updates: Record<string, string | null> = {}
    const orig = pickEditable(vendor)
    for (const k of Object.keys(orig) as (keyof EditableFields)[]) {
      if (edit[k] !== orig[k]) {
        updates[k] = edit[k] || null
      }
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from('vendors').update(updates).eq('id', vendor.id)
      await fetchVendors()
    }
    setEditingId(null)
    setSaving(false)
  }

  const handleCreate = async () => {
    if (!createForm.login_id || !createForm.password || !createForm.company_name) return
    setCreating(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)('admin_create_vendor', {
      p_login_id: createForm.login_id,
      p_password: createForm.password,
      p_company_name: createForm.company_name,
      p_category: createForm.category,
    })
    if (error) { alert('생성 실패: ' + error.message); setCreating(false); return }
    setCreateForm({ login_id: '', password: '', company_name: '', category: 'tile' })
    setShowCreate(false)
    setCreating(false)
    fetchVendors()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)('admin_delete_vendor', { p_vendor_id: deleteTarget.id })
    setDeleteTarget(null)
    fetchVendors()
  }

  const handleBannerUpload = async (vendor: Vendor, file: File) => {
    setBannerUploadingId(vendor.id)
    try {
      const storagePath = `banners/${vendor.id}/banner.${file.type === 'image/png' ? 'png' : 'jpg'}`
      const { error: uploadErr } = await supabase.storage.from('product-images')
        .upload(storagePath, file, { contentType: file.type, upsert: true })
      if (uploadErr) { alert('이미지 업로드 실패: ' + uploadErr.message); return }
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(storagePath)
      const { error: updateErr } = await supabase.from('vendors').update({ logo_url: urlData.publicUrl }).eq('id', vendor.id)
      if (updateErr) { alert('프로필 업데이트 실패: ' + updateErr.message); return }
      await fetchVendors()
    } finally {
      setBannerUploadingId(null)
    }
  }

  const handleBannerDelete = async (vendor: Vendor) => {
    await supabase.from('vendors').update({ logo_url: null }).eq('id', vendor.id)
    setBannerDeleteTarget(null)
    fetchVendors()
  }

  const handleResetPw = async () => {
    if (!resetPwVendorId || !newPassword) return
    await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)('admin_reset_vendor_password', { p_vendor_id: resetPwVendorId, p_new_password: newPassword })
    setResetPwVendorId(null)
    setNewPassword('')
    alert('비밀번호가 변경되었습니다.')
  }

  if (loading) return <div className="text-[11px] text-[#999] py-8 text-center">로딩 중...</div>

  // Group by category
  const grouped: Record<string, Vendor[]> = {}
  for (const v of vendors) {
    const cat = v.category || 'uncategorized'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(v)
  }

  return (
    <div className="max-w-[700px]">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[16px] font-bold">벤더 관리</h1>
        <button onClick={() => setShowCreate(!showCreate)}
          className="h-[30px] px-4 bg-[#1a1a1a] text-white text-[10px] font-semibold rounded-[4px] cursor-pointer flex items-center gap-1.5">
          <Plus className="w-3 h-3" /> 벤더 추가
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-[6px] p-4 mb-5">
          <h3 className="text-[12px] font-bold mb-3">새 벤더 생성</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[9px] text-[#999] font-semibold mb-1 block">카테고리</label>
              <select value={createForm.category} onChange={e => setCreateForm(p => ({ ...p, category: e.target.value }))}
                className="w-full h-[32px] text-[11px] px-2 bg-white border border-[rgba(0,0,0,0.08)] rounded-[4px] outline-none">
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-[#999] font-semibold mb-1 block">업체명</label>
              <input value={createForm.company_name} onChange={e => setCreateForm(p => ({ ...p, company_name: e.target.value }))}
                placeholder="(주)마벨로"
                className="w-full h-[32px] text-[11px] px-3 bg-white border border-[rgba(0,0,0,0.08)] rounded-[4px] outline-none" />
            </div>
            <div>
              <label className="text-[9px] text-[#999] font-semibold mb-1 block">로그인 ID</label>
              <input value={createForm.login_id} onChange={e => setCreateForm(p => ({ ...p, login_id: e.target.value }))}
                placeholder="marbello_tile"
                className="w-full h-[32px] text-[11px] px-3 bg-white border border-[rgba(0,0,0,0.08)] rounded-[4px] outline-none" />
            </div>
            <div>
              <label className="text-[9px] text-[#999] font-semibold mb-1 block">비밀번호</label>
              <input value={createForm.password} onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))}
                placeholder="6자 이상"
                className="w-full h-[32px] text-[11px] px-3 bg-white border border-[rgba(0,0,0,0.08)] rounded-[4px] outline-none" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="h-[30px] px-3 text-[10px] text-[#999] cursor-pointer">취소</button>
            <button onClick={handleCreate} disabled={creating || !createForm.login_id || !createForm.password || !createForm.company_name}
              className="h-[30px] px-4 bg-[#1a1a1a] text-white text-[10px] font-semibold rounded-[4px] cursor-pointer disabled:opacity-30">
              {creating ? '생성 중...' : '생성'}
            </button>
          </div>
        </div>
      )}

      {/* Vendor list grouped by category */}
      {Object.entries(grouped).map(([catId, catVendors]) => {
        const catLabel = CATEGORIES.find(c => c.id === catId)?.label || catId
        return (
          <div key={catId} className="mb-4">
            <p className="text-[9px] font-semibold text-[#999] uppercase tracking-[0.5px] mb-2">{catLabel}</p>
            <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-[6px] overflow-hidden">
              {catVendors.map((vendor, idx) => {
                const isExpanded = expandedId === vendor.id
                const isEditing = editingId === vendor.id
                const edit = editState[vendor.id]
                const isFirst = idx === 0
                const isLast = idx === catVendors.length - 1
                return (
                  <div key={vendor.id} className="border-b border-[rgba(0,0,0,0.04)] last:border-0">
                    {/* Header row */}
                    <button onClick={() => handleExpand(vendor)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-[rgba(0,0,0,0.01)]">
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="w-3 h-3 text-[#aaa]" /> : <ChevronRight className="w-3 h-3 text-[#aaa]" />}
                        <span className="text-[12px] font-semibold">{vendor.company_name}</span>
                        <span className="text-[9px] text-[#aaa]">{vendor.login_id}</span>
                        {vendor.slug && (
                          <span className="text-[8px] font-semibold text-[#1a7f64] bg-[#e6f7f2] px-1.5 py-[1px] rounded-[3px]">독자</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isExpanded && !isEditing && (
                          <button onClick={(e) => { e.stopPropagation(); startEditing(vendor) }}
                            className="flex items-center gap-1 h-[24px] px-2.5 border border-[rgba(0,0,0,0.08)] text-[9px] font-semibold rounded-[3px] cursor-pointer hover:bg-[#f5f5f5]"
                            title="편집">
                            <Pencil className="w-3 h-3" /> 편집
                          </button>
                        )}
                        {isExpanded && isEditing && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); cancelEditing() }}
                              className="h-[24px] px-2.5 border border-[rgba(0,0,0,0.08)] text-[9px] font-semibold text-[#999] rounded-[3px] cursor-pointer hover:bg-[#f5f5f5]">
                              취소
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleSave(vendor) }}
                              disabled={saving}
                              className="flex items-center gap-1 h-[24px] px-2.5 bg-[#1a1a1a] text-white text-[9px] font-semibold rounded-[3px] cursor-pointer disabled:opacity-50"
                              title="저장">
                              <Save className="w-3 h-3" />
                              {saving ? '저장 중...' : '저장'}
                            </button>
                          </>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); handleMove(vendor, 'up') }}
                          disabled={isFirst}
                          className="text-[#bbb] hover:text-[#333] cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                          title="위로">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleMove(vendor, 'down') }}
                          disabled={isLast}
                          className="text-[#bbb] hover:text-[#333] cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                          title="아래로">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setResetPwVendorId(vendor.id); setNewPassword('') }}
                          className="text-[#bbb] hover:text-[#333] cursor-pointer" title="비밀번호 변경">
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(vendor) }}
                          className="text-[#bbb] hover:text-[#e53e3e] cursor-pointer" title="삭제">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1">
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="담당자" value={isEditing ? edit.contact_name : (vendor.contact_name || '')} editing={isEditing} onChange={v => updateField(vendor.id, 'contact_name', v)} />
                          <Field label="연락처" value={isEditing ? edit.contact_phone : (vendor.contact_phone || '')} editing={isEditing} onChange={v => updateField(vendor.id, 'contact_phone', v)} />
                          <Field label="주소" value={isEditing ? edit.address : (vendor.address || '')} editing={isEditing} onChange={v => updateField(vendor.id, 'address', v)} />
                          <Field label="홈페이지" value={isEditing ? edit.website_url : (vendor.website_url || '')} editing={isEditing} onChange={v => updateField(vendor.id, 'website_url', v)} />
                          <Field label="인스타그램" value={isEditing ? edit.instagram : (vendor.instagram || '')} editing={isEditing} onChange={v => updateField(vendor.id, 'instagram', v)} />
                          <Field label="독자 슬러그" value={isEditing ? edit.slug : (vendor.slug || '')} editing={isEditing} onChange={v => updateField(vendor.id, 'slug', v)} placeholder="예: younhyun" />
                        </div>
                        <div className="mt-3">
                          <label className="text-[9px] text-[#999] font-semibold mb-1 block">배너 이미지</label>
                          {vendor.logo_url ? (
                            <div className="relative rounded-[4px] overflow-hidden h-[64px] bg-[#f5f5f5]">
                              <img src={vendor.logo_url} alt="배너" className="w-full h-full object-cover" />
                              <button
                                onClick={(e) => { e.stopPropagation(); setBannerDeleteTarget(vendor) }}
                                className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center cursor-pointer hover:bg-black/70"
                              >
                                <X className="w-3 h-3 text-white" />
                              </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center h-[64px] border-2 border-dashed border-[rgba(0,0,0,0.1)] rounded-[4px] cursor-pointer hover:bg-[rgba(0,0,0,0.01)]">
                              {bannerUploadingId === vendor.id ? (
                                <span className="text-[10px] text-[#aaa]">업로드 중...</span>
                              ) : (
                                <>
                                  <Upload className="w-3.5 h-3.5 text-[#ccc] mb-0.5" />
                                  <span className="text-[9px] text-[#aaa]">배너 이미지 업로드 (권장: 1200×300)</span>
                                </>
                              )}
                              <input type="file" accept="image/jpeg,image/png" className="hidden"
                                disabled={bannerUploadingId === vendor.id}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleBannerUpload(vendor, file)
                                  e.target.value = ''
                                }} />
                            </label>
                          )}
                        </div>
                        <div className="mt-3">
                          <Field label="소개글" value={isEditing ? edit.description : (vendor.description || '')} editing={isEditing} onChange={v => updateField(vendor.id, 'description', v)} multiline />
                        </div>
                        <p className="text-[9px] text-[#aaa] mt-3">등록일: {new Date(vendor.created_at).toLocaleDateString('ko-KR')}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {vendors.length === 0 && !showCreate && (
        <p className="text-[11px] text-[#aaa] text-center py-12">등록된 벤더가 없습니다.</p>
      )}

      {/* Reset password popup */}
      {resetPwVendorId && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setResetPwVendorId(null)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] bg-white border border-[rgba(0,0,0,0.08)] rounded-[8px] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h3 className="text-[13px] font-bold mb-3">비밀번호 변경</h3>
            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="새 비밀번호 (6자 이상)"
              className="w-full h-[32px] text-[11px] px-3 border border-[rgba(0,0,0,0.08)] rounded-[4px] outline-none mb-3" />
            <div className="flex gap-2">
              <button onClick={() => setResetPwVendorId(null)}
                className="flex-1 h-[32px] text-[11px] font-semibold border border-[rgba(0,0,0,0.08)] rounded-[4px] cursor-pointer hover:bg-[#f5f5f5]">취소</button>
              <button onClick={handleResetPw} disabled={newPassword.length < 6}
                className="flex-1 h-[32px] text-[11px] font-semibold bg-[#1a1a1a] text-white rounded-[4px] cursor-pointer disabled:opacity-30">변경</button>
            </div>
          </div>
        </>
      )}

      {/* Banner delete popup */}
      {bannerDeleteTarget && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setBannerDeleteTarget(null)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] bg-white border border-[rgba(0,0,0,0.08)] rounded-[8px] p-5 text-center shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h3 className="text-[13px] font-bold mb-2">배너 이미지 삭제</h3>
            <p className="text-[10px] text-[#aaa] mb-5">{bannerDeleteTarget.company_name}의 배너 이미지를 삭제하시겠습니까?</p>
            <div className="flex gap-2">
              <button onClick={() => setBannerDeleteTarget(null)}
                className="flex-1 h-[34px] text-[11px] font-semibold border border-[rgba(0,0,0,0.08)] rounded-[5px] cursor-pointer hover:bg-[#f5f5f5]">
                취소
              </button>
              <button onClick={() => handleBannerDelete(bannerDeleteTarget)}
                className="flex-1 h-[34px] text-[11px] font-semibold border border-[rgba(0,0,0,0.08)] rounded-[5px] cursor-pointer hover:bg-[#f5f5f5]">
                삭제하기
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete popup */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setDeleteTarget(null)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] bg-white border border-[rgba(0,0,0,0.08)] rounded-[8px] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h3 className="text-[13px] font-bold mb-2">벤더 삭제</h3>
            <p className="text-[11px] text-[#888] mb-4"><span className="font-semibold text-[#333]">{deleteTarget.company_name}</span>을(를) 삭제합니다. 모든 제품과 이미지도 삭제됩니다.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 h-[32px] text-[11px] font-semibold border border-[rgba(0,0,0,0.08)] rounded-[4px] cursor-pointer hover:bg-[#f5f5f5]">취소</button>
              <button onClick={handleDelete}
                className="flex-1 h-[32px] text-[11px] font-semibold border border-[rgba(0,0,0,0.08)] rounded-[4px] cursor-pointer hover:bg-[#f5f5f5]">삭제</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Field({ label, value, editing, onChange, multiline, placeholder }: {
  label: string; value: string; editing: boolean; onChange: (v: string) => void; multiline?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="text-[9px] text-[#999] font-semibold mb-1 block">{label}</label>
      {editing ? (
        multiline ? (
          <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} placeholder={placeholder}
            className="w-full text-[11px] px-2 py-1.5 border border-[rgba(0,0,0,0.1)] rounded-[3px] outline-none resize-none focus:border-[#1a1a1a] bg-white placeholder:text-[#ccc]" />
        ) : (
          <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full h-[28px] text-[11px] px-2 border border-[rgba(0,0,0,0.1)] rounded-[3px] outline-none focus:border-[#1a1a1a] bg-white placeholder:text-[#ccc]" />
        )
      ) : (
        <div className="min-h-[28px] flex items-center text-[11px] px-2 bg-[#fafafa] rounded-[3px]">
          {value || <span className="text-[#ccc]">-</span>}
        </div>
      )}
    </div>
  )
}
