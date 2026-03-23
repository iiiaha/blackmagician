import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut, LogIn } from 'lucide-react'

export default function LibraryLayout() {
  const { user, userProfile, signOut } = useAuth()

  return (
    <div className="h-screen flex flex-col">
      {/* Header - Marbello style */}
      <header className="h-[42px] bg-white border-b flex items-center px-4 justify-between shrink-0">
        <Link to="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
          <span className="text-[13px] font-bold tracking-[0.5px]">BLACK MAGICIAN</span>
          <span className="text-[9px] text-text-tertiary font-medium tracking-[0.3px]">LIBRARY</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-[10px] text-text-secondary">
                {userProfile?.display_name || user.email}
              </span>
              <button
                onClick={signOut}
                className="text-text-tertiary hover:text-foreground cursor-pointer"
                title="로그아웃"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </>
          ) : (
            <Link to="/library/login">
              <Button variant="ghost" size="sm" className="h-6 text-[10px] font-semibold gap-1 text-text-secondary hover:text-foreground px-2">
                <LogIn className="w-3 h-3" />
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
