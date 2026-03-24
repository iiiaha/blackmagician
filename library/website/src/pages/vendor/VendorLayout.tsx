import { useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LayoutDashboard, Package, UserCircle, LogOut } from 'lucide-react'

export default function VendorLayout() {
  const { user, vendor, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!loading && (!user || !vendor)) {
      navigate('/vendor/login')
    }
  }, [user, vendor, loading, navigate])

  if (loading) return <div className="flex items-center justify-center h-screen text-[12px] text-[#999]">로딩 중...</div>
  if (!vendor) return null

  if (!vendor.approved) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-12 h-12 bg-[#f5f5f5] rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-[20px]">⏳</span>
          </div>
          <p className="text-[13px] font-bold mb-1">승인 대기 중</p>
          <p className="text-[11px] text-[#999]">관리자 승인 후 이용 가능합니다.</p>
        </div>
      </div>
    )
  }

  const navItems = [
    { to: '/vendor', label: '대시보드', icon: LayoutDashboard, exact: true },
    { to: '/vendor/products', label: '제품 관리', icon: Package },
    { to: '/vendor/profile', label: '프로필', icon: UserCircle },
  ]

  return (
    <div className="h-screen flex flex-col bg-[#fafafa]">
      {/* Header */}
      <header className="h-[48px] bg-white border-b border-[rgba(0,0,0,0.06)] flex items-center px-5 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold tracking-[0.3px]">BLACK MAGICIAN</span>
          <span className="text-[10px] text-[#aaa] font-medium">Vendor</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#999]">{vendor.company_name}</span>
          <button onClick={async () => { await signOut(); navigate('/vendor/login') }}
            className="text-[#aaa] hover:text-[#333] cursor-pointer" title="로그아웃">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-[180px] bg-white border-r border-[rgba(0,0,0,0.06)] py-3 px-2 shrink-0">
          {navItems.map(item => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to)
            return (
              <Link key={item.to} to={item.to}
                className={`flex items-center gap-2.5 px-3 py-[7px] rounded-[4px] text-[11px] mb-0.5 transition-colors ${
                  isActive
                    ? 'bg-[rgba(0,0,0,0.04)] text-[#1a1a1a] font-semibold'
                    : 'text-[#888] hover:text-[#1a1a1a] hover:bg-[rgba(0,0,0,0.02)]'
                }`}>
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
