import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Package } from 'lucide-react'
import type { Vendor } from '@/types/database'
import VendorProducts from '@/pages/vendor/VendorProducts'

// Vendor selection lives in the AdminLayout sidebar (sub-list under
// "제품 관리"); this page only needs to fetch the vendor named in the URL
// and hand it off to VendorProducts.
export default function AdminProducts() {
  const { vendorId } = useParams<{ vendorId?: string }>()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!vendorId) { setVendor(null); return }
    setLoading(true)
    supabase.from('vendors').select('*').eq('id', vendorId).maybeSingle()
      .then(({ data }) => {
        setVendor((data as Vendor) || null)
        setLoading(false)
      })
  }, [vendorId])

  if (!vendorId) {
    return (
      <div className="flex items-center justify-center h-full" style={{ minHeight: 'calc(100vh - 48px - 48px)' }}>
        <div className="text-center">
          <Package className="w-8 h-8 text-[#ddd] mx-auto mb-2" />
          <p className="text-[11px] text-[#aaa]">좌측 메뉴에서 벤더를 선택하세요</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="text-[11px] text-[#999] py-8 text-center">로딩 중...</div>
  }

  if (!vendor) {
    return <div className="text-[11px] text-[#aaa] py-8 text-center">벤더를 찾을 수 없습니다.</div>
  }

  return (
    <div key={vendor.id} className="h-full flex flex-col" style={{ minHeight: 'calc(100vh - 48px - 48px)' }}>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[rgba(0,0,0,0.06)]">
        <h1 className="text-[13px] font-bold">{vendor.company_name}</h1>
        <span className="text-[9px] text-[#aaa]">{vendor.login_id}</span>
      </div>
      <div className="flex-1 min-h-0">
        <VendorProducts vendor={vendor} />
      </div>
    </div>
  )
}
