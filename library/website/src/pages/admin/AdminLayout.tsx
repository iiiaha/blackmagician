import { useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { LogOut, Users, UserCircle, LayoutDashboard, FolderTree } from 'lucide-react'

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (sessionStorage.getItem('bm-admin') !== 'true') {
      navigate('/admin/login')
    }
  }, [navigate])

  const handleLogout = () => {
    sessionStorage.removeItem('bm-admin')
    navigate('/admin/login')
  }

  const navItems = [
    { to: '/admin', label: '대시보드', icon: LayoutDashboard, exact: true },
    { to: '/admin/vendors', label: '벤더 관리', icon: Users },
    { to: '/admin/users', label: '사용자 관리', icon: UserCircle },
    { to: '/admin/folders', label: '폴더 관리', icon: FolderTree },
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

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
