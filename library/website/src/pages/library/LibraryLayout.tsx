import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut, LogIn } from 'lucide-react'
import { CATEGORIES, type CategoryId } from '@/lib/categories'
import { useState } from 'react'

export default function LibraryLayout() {
  const { user, userProfile, signOut } = useAuth()
  const [activeCategory, setActiveCategory] = useState<CategoryId>('tile')

  const maxDownloads = 5
  const usedDownloads = 0
  const remaining = maxDownloads - usedDownloads

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-[42px] bg-white border-b flex items-center px-5 justify-between shrink-0">
        <div className="flex items-center gap-6">
          <Link to="/" className="hover:opacity-70 transition-opacity shrink-0">
            <span className="text-[13px] font-bold tracking-[0.3px]">BLACK MAGICIAN</span>
          </Link>

          {/* Category Tabs */}
          <nav className="flex items-center gap-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1 text-[10px] tracking-[0.5px] font-semibold rounded-sm cursor-pointer transition-colors ${
                  activeCategory === cat.id
                    ? 'text-foreground bg-[rgba(0,0,0,0.05)]'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="flex items-center gap-1.5 text-[9px] text-text-tertiary">
                <span className="uppercase tracking-[0.3px] font-medium">Remaining</span>
                <div className="w-[40px] h-[3px] bg-[rgba(0,0,0,0.06)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all duration-300"
                    style={{ width: `${(remaining / maxDownloads) * 100}%` }}
                  />
                </div>
                <span className="tabular-nums font-semibold">{remaining}/{maxDownloads}</span>
              </div>

              <span className="text-[10px] text-text-secondary">
                {userProfile?.display_name || user.email}
              </span>
              <button onClick={signOut} className="text-text-tertiary hover:text-foreground cursor-pointer" title="로그아웃">
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
        <Outlet context={{ activeCategory }} />
      </main>
    </div>
  )
}
