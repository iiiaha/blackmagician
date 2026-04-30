import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/categories'
import { Package } from 'lucide-react'
import type { Vendor } from '@/types/database'
import VendorProducts from '@/pages/vendor/VendorProducts'

export default function AdminProducts() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('vendors').select('*').order('category').order('company_name')
      .then(({ data }) => { setVendors((data as Vendor[]) || []); setLoading(false) })
  }, [])

  if (loading) return <div className="text-[11px] text-[#999] py-8 text-center">로딩 중...</div>

  // Group by category
  const grouped: Record<string, Vendor[]> = {}
  for (const v of vendors) {
    const cat = v.category || 'uncategorized'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(v)
  }

  return (
    <div className="flex gap-5 h-full" style={{ minHeight: 'calc(100vh - 48px - 48px)' }}>
      {/* Vendor selector */}
      <div className="w-[200px] shrink-0 bg-white border border-[rgba(0,0,0,0.06)] rounded-[6px] p-3 overflow-y-auto">
        <p className="text-[9px] font-semibold text-[#999] uppercase tracking-[0.5px] mb-2 px-1">벤더 선택</p>
        {vendors.length === 0 ? (
          <p className="text-[10px] text-[#aaa] text-center py-6">등록된 벤더가 없습니다.</p>
        ) : (
          Object.entries(grouped).map(([catId, catVendors]) => {
            const catLabel = CATEGORIES.find(c => c.id === catId)?.label || catId
            return (
              <div key={catId} className="mb-3">
                <p className="text-[8px] font-semibold text-[#bbb] uppercase tracking-[0.5px] px-1 mb-1">{catLabel}</p>
                {catVendors.map(v => {
                  const isSelected = selectedVendor?.id === v.id
                  return (
                    <button key={v.id} onClick={() => setSelectedVendor(v)}
                      className={`flex items-center gap-1.5 py-[5px] px-2 w-full text-left text-[11px] cursor-pointer rounded-[3px] ${
                        isSelected
                          ? 'bg-[rgba(0,0,0,0.05)] font-semibold text-[#1a1a1a]'
                          : 'text-[#888] hover:text-[#1a1a1a]'
                      }`}>
                      <span className="truncate flex-1">{v.company_name}</span>
                      {!v.approved && <span className="text-[8px] text-[#e53e3e] shrink-0">미승인</span>}
                    </button>
                  )
                })}
              </div>
            )
          })
        )}
      </div>

      {/* Product management area — reuses VendorProducts with selected vendor */}
      <div className="flex-1 min-w-0">
        {!selectedVendor ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Package className="w-8 h-8 text-[#ddd] mx-auto mb-2" />
              <p className="text-[11px] text-[#aaa]">좌측에서 벤더를 선택하세요</p>
            </div>
          </div>
        ) : (
          <div key={selectedVendor.id} className="h-full flex flex-col">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[rgba(0,0,0,0.06)]">
              <h1 className="text-[13px] font-bold">{selectedVendor.company_name}</h1>
              <span className="text-[9px] text-[#aaa]">{selectedVendor.login_id}</span>
            </div>
            <div className="flex-1 min-h-0">
              <VendorProducts vendor={selectedVendor} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
