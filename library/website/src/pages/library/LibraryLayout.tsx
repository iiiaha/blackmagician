import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut, LogIn } from 'lucide-react'

export default function LibraryLayout() {
  const { user, userProfile, signOut } = useAuth()

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-11 border-b flex items-center px-5 justify-between shrink-0">
        <Link to="/" className="text-sm font-bold tracking-tight hover:opacity-70 transition-opacity">
          BLACK MAGICIAN
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-xs text-muted-foreground font-medium">
                {userProfile?.display_name || user.email}
              </span>
              <button
                onClick={signOut}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="로그아웃"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <Link to="/library/login">
              <Button variant="ghost" size="sm" className="h-7 text-xs font-medium gap-1.5 text-muted-foreground hover:text-foreground">
                <LogIn className="w-3.5 h-3.5" />
                로그인
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
