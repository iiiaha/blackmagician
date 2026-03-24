import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Users, Package, UserCircle } from 'lucide-react'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalVendors: 0, totalUsers: 0, totalProducts: 0 })

  useEffect(() => {
    const fetchStats = async () => {
      const [vendorRes, userRes, productRes] = await Promise.all([
        supabase.from('vendors').select('id', { count: 'exact', head: true }),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
      ])
      setStats({
        totalVendors: vendorRes.count || 0,
        totalUsers: userRes.count || 0,
        totalProducts: productRes.count || 0,
      })
    }
    fetchStats()
  }, [])

  return (
    <div className="max-w-[600px]">
      <h1 className="text-[16px] font-bold mb-5">관리자 대시보드</h1>
      <div className="grid grid-cols-3 gap-3">
        <Link to="/admin/vendors">
          <StatCard icon={Users} label="벤더" value={stats.totalVendors} />
        </Link>
        <Link to="/admin/users">
          <StatCard icon={UserCircle} label="사용자" value={stats.totalUsers} />
        </Link>
        <StatCard icon={Package} label="전체 제품" value={stats.totalProducts} />
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-[6px] p-4 hover:shadow-sm transition-shadow">
      <Icon className="w-4 h-4 text-[#aaa] mb-2" />
      <p className="text-[18px] font-bold">{value}</p>
      <p className="text-[10px] text-[#999]">{label}</p>
    </div>
  )
}
