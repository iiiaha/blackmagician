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
          <Link to="/" className="hover:opacity-80 transition-opacity shrink-0 flex items-center gap-1.5">
            <img src="/logopic.png" alt="" className="h-[22px] w-auto" />
            <img src="/logotext.png" alt="Black Magician" className="h-[14px] w-auto" />
          </Link>

          <nav className="flex items-center">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1 text-[10px] tracking-[0.5px] font-semibold cursor-pointer transition-colors ${
                  activeCategory === cat.id
                    ? 'text-foreground underline underline-offset-[3px] decoration-[1.5px]'
                    : 'text-text-tertiary hover:text-text-secondary'
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

      <footer className="h-[24px] bg-white border-t flex items-center justify-between px-5 shrink-0 text-[9px] text-text-tertiary">
        <span>&copy; 2026 Black Magician. All rights reserved.</span>
        <div className="flex items-center gap-3">
          <a href="https://instagram.com/iiiaha.lab" target="_blank" rel="noopener noreferrer"
            className="hover:text-foreground transition-colors flex items-center gap-1">
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="5" /><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
            </svg>
            @iiiaha.lab
          </a>
          <a href="mailto:iiiaha@naver.com" className="hover:text-foreground transition-colors">Contact</a>
        </div>
      </footer>
    </div>
  )
}
