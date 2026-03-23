import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut, User, LogIn } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function LibraryLayout() {
  const { user, userProfile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ maxHeight: '100vh' }}>
      <header className="h-10 border-b flex items-center px-4 justify-between shrink-0">
        <Link to="/" className="font-semibold text-sm hover:opacity-80">
          Black Magician Library
        </Link>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                <span>{userProfile?.display_name || user.email}</span>
                {userProfile?.plan === 'premium' ? (
                  <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">PRO</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Free</Badge>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={signOut} title="로그아웃">
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <Link to="/library/login">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                <LogIn className="w-3.5 h-3.5" />
                로그인
              </Button>
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
