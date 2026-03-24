import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Vendor } from '@/types/database'
import { Package, Image, FolderOpen, ArrowRight } from 'lucide-react'

export default function VendorDashboard() {
  const { vendor } = useOutletContext<{ vendor: Vendor }>()
  const [stats, setStats] = useState({ products: 0, images: 0, folders: 0 })
  const [recentProducts, setRecentProducts] = useState<{ id: string; name: string; created_at: string }[]>([])

  useEffect(() => {
    if (!vendor) return
    const fetchStats = async () => {
      const [prodRes, imgRes, folderRes, recentRes] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('vendor_id', vendor.id),
        supabase.from('product_images').select('id', { count: 'exact', head: true })
          .in('product_id', (await supabase.from('products').select('id').eq('vendor_id', vendor.id)).data?.map((p: { id: string }) => p.id) || []),
        supabase.from('folder_nodes').select('id', { count: 'exact', head: true }).eq('vendor_id', vendor.id).eq('is_leaf', true),
        supabase.from('products').select('id, name, created_at').eq('vendor_id', vendor.id).order('created_at', { ascending: false }).limit(5),
      ])
      setStats({
        products: prodRes.count || 0,
        images: imgRes.count || 0,
        folders: folderRes.count || 0,
      })
      setRecentProducts((recentRes.data as { id: string; name: string; created_at: string }[]) || [])
    }
    fetchStats()
  }, [vendor])

  if (!vendor) return null

  return (
    <div className="max-w-[640px]">
      <h1 className="text-[16px] font-bold mb-1">{vendor.company_name}</h1>
      <p className="text-[11px] text-[#999] mb-6">벤더 대시보드</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard icon={Package} label="등록 제품" value={stats.products} />
        <StatCard icon={Image} label="전체 이미지" value={stats.images} />
        <StatCard icon={FolderOpen} label="제품 폴더" value={stats.folders} />
      </div>

      {/* Recent Products */}
      <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-[6px] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
          <span className="text-[11px] font-semibold">최근 등록 제품</span>
          <Link to="/vendor/products" className="text-[10px] text-[#999] hover:text-[#333] flex items-center gap-1 cursor-pointer">
            전체보기 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {recentProducts.length === 0 ? (
          <p className="text-[11px] text-[#aaa] text-center py-8">등록된 제품이 없습니다.</p>
        ) : (
          <div>
            {recentProducts.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(0,0,0,0.03)] last:border-0">
                <span className="text-[11px]">{p.name}</span>
                <span className="text-[9px] text-[#aaa]">{new Date(p.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-[6px] p-4">
      <Icon className="w-4 h-4 text-[#aaa] mb-2" />
      <p className="text-[18px] font-bold">{value}</p>
      <p className="text-[10px] text-[#999]">{label}</p>
    </div>
  )
}
