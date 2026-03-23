import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut, LogIn } from 'lucide-react'

export default function LibraryLayout() {
  const { user, userProfile, signOut } = useAuth()

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-[48px] bg-white border-b flex items-center px-8 justify-between shrink-0">
        <Link to="/" className="flex items-center gap-3 hover:opacity-70 transition-opacity">
          <span className="text-[14px] font-bold tracking-[0.5px]">BLACK MAGICIAN</span>
          <span className="text-[10px] text-text-tertiary font-medium tracking-[0.3px]">LIBRARY</span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-[11px] text-text-secondary">
                {userProfile?.display_name || user.email}
              </span>
              <button
                onClick={signOut}
                className="text-text-tertiary hover:text-foreground cursor-pointer"
                title="로그아웃"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <Link to="/library/login">
              <Button variant="ghost" size="sm" className="h-7 text-[11px] font-semibold gap-1.5 text-text-secondary hover:text-foreground px-3">
                <LogIn className="w-3.5 h-3.5" />
                LOGIN
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
