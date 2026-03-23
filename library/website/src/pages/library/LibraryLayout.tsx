import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut, LogIn } from 'lucide-react'
import { CATEGORIES, type CategoryId } from '@/lib/categories'
import { useState } from 'react'

export default function LibraryLayout() {
  const { user, userProfile, signOut } = useAuth()
  const [activeCategory, setActiveCategory] = useState<CategoryId>('tile')

  return (
    <div className="h-screen flex flex-col">
      <header className="h-[42px] bg-white border-b flex items-center px-5 justify-between shrink-0">
        <div className="flex items-center gap-5">
          <Link to="/" className="hover:opacity-70 transition-opacity shrink-0">
            <span className="text-[13px] font-bold tracking-[0.3px]">BLACK MAGICIAN</span>
          </Link>

          <nav className="flex items-center">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-[11px] text-[10px] tracking-[0.5px] font-semibold cursor-pointer transition-colors border-b-[2px] ${
                  activeCategory === cat.id
                    ? 'text-foreground border-foreground'
                    : 'text-text-tertiary hover:text-text-secondary border-transparent'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
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
