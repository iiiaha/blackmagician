import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut, LogIn } from 'lucide-react'

export default function LibraryLayout() {
  const { user, userProfile, signOut } = useAuth()

  // TODO: 구독 서비스 시 실제 제한 적용
  const maxDownloads = 5
  const usedDownloads = 0 // 무제한 상태
  const remaining = maxDownloads - usedDownloads

  return (
    <div className="h-screen flex flex-col">
      <header className="h-[48px] bg-white border-b flex items-center px-6 justify-between shrink-0">
        <Link to="/" className="hover:opacity-70 transition-opacity">
          <span className="text-[14px] font-bold tracking-[0.5px]">BLACK MAGICIAN</span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              {/* Download gauge */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-[60px] h-[4px] bg-[rgba(0,0,0,0.06)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all duration-300"
                      style={{ width: `${(remaining / maxDownloads) * 100}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-text-tertiary tabular-nums">{remaining}/{maxDownloads}</span>
                </div>
              </div>

              <span className="text-[10px] text-text-secondary">
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
