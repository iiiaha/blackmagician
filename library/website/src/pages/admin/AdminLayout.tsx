import { useEffect, useState } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { LogOut, Users, UserCircle, LayoutDashboard, FolderTree, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { CATEGORIES } from '@/lib/categories'
import type { Vendor } from '@/types/database'

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [vendors, setVendors] = useState<Vendor[]>([])

  useEffect(() => {
    if (sessionStorage.getItem('bm-admin') !== 'true') {
      navigate('/admin/login')
    }
  }, [navigate])

  // Vendor list lives in the sidebar so the products page doesn't need a
  // dedicated selector panel — clicking a vendor jumps straight to that
  // vendor's product manager. Fetched once for the whole admin session.
  useEffect(() => {
    supabase.from('vendors').select('*').then(({ data }) => {
      const list = ((data as Vendor[]) || []).slice().sort((a, b) =>
        ((a.sort_order ?? 0) - (b.sort_order ?? 0))
        || a.company_name.localeCompare(b.company_name)
      )
      setVendors(list)
    })
  }, [])

  const handleLogout = () => {
    sessionStorage.removeItem('bm-admin')
    navigate('/admin/login')
  }

  const navItems = [
    { to: '/admin', label: '대시보드', icon: LayoutDashboard, exact: true },
    { to: '/admin/vendors', label: '벤더 관리', icon: Users },
    { to: '/admin/users', label: '사용자 관리', icon: UserCircle },
    { to: '/admin/folders', label: '폴더 관리', icon: FolderTree },
    { to: '/admin/products', label: '제품 관리', icon: Package },
  ]

  // Group vendors by category for the sub-list under "제품 관리".
  const vendorsByCategory: Record<string, Vendor[]> = {}
  for (const v of vendors) {
    const cat = v.category || 'uncategorized'
    if (!vendorsByCategory[cat]) vendorsByCategory[cat] = []
    vendorsByCategory[cat].push(v)
  }
  const orderedCategoryIds = [
    ...CATEGORIES.map(c => c.id).filter(id => vendorsByCategory[id]),
    ...(vendorsByCategory['uncategorized'] ? ['uncategorized'] : []),
  ]

  return (
    <div className="h-screen flex flex-col bg-[#fafafa]">
      <header className="h-[48px] bg-white border-b border-[rgba(0,0,0,0.06)] flex items-center px-5 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold tracking-[0.3px]">BLACK MAGICIAN</span>
          <span className="text-[10px] text-[#aaa] font-medium">Admin</span>
        </div>
        <button onClick={handleLogout}
          className="text-[#aaa] hover:text-[#333] cursor-pointer" title="로그아웃">
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-[180px] bg-white border-r border-[rgba(0,0,0,0.06)] py-3 px-2 shrink-0 overflow-y-auto">
          {navItems.map(item => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to)
            const isProducts = item.to === '/admin/products'
            return (
              <div key={item.to}>
                <Link to={item.to}
                  className={`flex items-center gap-2.5 px-3 py-[7px] rounded-[4px] text-[11px] mb-0.5 transition-colors ${
                    isActive
                      ? 'bg-[rgba(0,0,0,0.04)] text-[#1a1a1a] font-semibold'
                      : 'text-[#888] hover:text-[#1a1a1a] hover:bg-[rgba(0,0,0,0.02)]'
                  }`}>
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
                {isProducts && vendors.length > 0 && (
                  <div className="mt-1 mb-2">
                    {orderedCategoryIds.map(catId => {
                      const catLabel = CATEGORIES.find(c => c.id === catId)?.label || catId
                      const catVendors = vendorsByCategory[catId]
                      return (
                        <div key={catId} className="mb-1.5">
                          <p className="text-[8px] font-semibold text-[#bbb] uppercase tracking-[0.5px] px-3 py-1">{catLabel}</p>
                          {catVendors.map(v => {
                            const vendorPath = `/admin/products/${v.id}`
                            const isVendorActive = location.pathname === vendorPath
                            return (
                              <Link key={v.id} to={vendorPath}
                                className={`flex items-center gap-1.5 pl-7 pr-2 py-[4px] rounded-[3px] text-[10.5px] transition-colors ${
                                  isVendorActive
                                    ? 'bg-[rgba(0,0,0,0.05)] text-[#1a1a1a] font-semibold'
                                    : 'text-[#999] hover:text-[#1a1a1a] hover:bg-[rgba(0,0,0,0.02)]'
                                }`}>
                                <span className="truncate flex-1">{v.company_name}</span>
                                {!v.approved && <span className="text-[8px] text-[#e53e3e] shrink-0">미승인</span>}
                              </Link>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
