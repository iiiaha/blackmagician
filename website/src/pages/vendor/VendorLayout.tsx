import { useEffect, useState } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { LayoutDashboard, Package, UserCircle, LogOut } from 'lucide-react'
import type { Vendor } from '@/types/database'

export default function VendorLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const vendorId = sessionStorage.getItem('bm-vendor-id')
    if (!vendorId) { navigate('/vendor/login'); return }

    supabase.from('vendors').select('*').eq('id', vendorId).single()
      .then(({ data }) => {
        if (data) setVendor(data as Vendor)
        else { sessionStorage.removeItem('bm-vendor-id'); navigate('/vendor/login') }
        setLoading(false)
      })
  }, [navigate])

  if (loading) return <div className="flex items-center justify-center h-screen text-[12px] text-[#999]">로딩 중...</div>
  if (!vendor) return null

  const handleLogout = () => {
    sessionStorage.removeItem('bm-vendor-id')
    navigate('/vendor/login')
  }

  const navItems = [
    { to: '/vendor', label: '대시보드', icon: LayoutDashboard, exact: true },
    { to: '/vendor/products', label: '제품 관리', icon: Package },
    { to: '/vendor/profile', label: '프로필', icon: UserCircle },
  ]

  return (
    <div className="h-screen flex flex-col bg-[#fafafa]">
      <header className="h-[48px] bg-white border-b border-[rgba(0,0,0,0.06)] flex items-center px-5 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold tracking-[0.3px]">BLACK MAGICIAN</span>
          <span className="text-[10px] text-[#aaa] font-medium">Vendor</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#999]">{vendor.company_name}</span>
          <button onClick={handleLogout} className="text-[#aaa] hover:text-[#333] cursor-pointer" title="로그아웃">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-[180px] bg-white border-r border-[rgba(0,0,0,0.06)] py-3 px-2 shrink-0">
          {navItems.map(item => {
            const isActive = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to)
            return (
              <Link key={item.to} to={item.to}
                className={`flex items-center gap-2.5 px-3 py-[7px] rounded-[4px] text-[11px] mb-0.5 transition-colors ${
                  isActive ? 'bg-[rgba(0,0,0,0.04)] text-[#1a1a1a] font-semibold' : 'text-[#888] hover:text-[#1a1a1a] hover:bg-[rgba(0,0,0,0.02)]'
                }`}>
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet context={{ vendor }} />
        </main>
      </div>
    </div>
  )
}
