import { useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut, Users, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AdminLayout() {
  const { user, isAdmin, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/admin/login')
    }
  }, [user, isAdmin, loading, navigate])

  if (loading) {
    return <div className="text-center py-20 text-muted-foreground">로딩 중...</div>
  }

  if (!isAdmin) return null

  const handleSignOut = async () => {
    await signOut()
    navigate('/vendor/login')
  }

  const navItems = [
    { to: '/admin', label: '대시보드', icon: LayoutDashboard, exact: true },
    { to: '/admin/vendors', label: '벤더 관리', icon: Users },
  ]

  return (
    <div className="min-h-screen bg-background">
      <header className="h-12 border-b flex items-center px-4 justify-between">
        <Link to="/admin" className="font-semibold text-sm hover:opacity-80">
          Black Magician — Admin
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={handleSignOut} title="로그아웃">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex">
        <nav className="w-48 border-r min-h-[calc(100vh-48px)] p-3 space-y-1">
          {navItems.map(item => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-secondary text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-secondary/50'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
