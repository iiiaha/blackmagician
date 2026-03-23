import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut, LogIn, Sun, Moon } from 'lucide-react'
import { CATEGORIES, type CategoryId } from '@/lib/categories'
import { useState, useEffect } from 'react'

export default function LibraryLayout() {
  const { user, userProfile, signOut } = useAuth()
  const [activeCategory, setActiveCategory] = useState<CategoryId>('tile')
  const [dark, setDark] = useState(() => localStorage.getItem('bm-theme') === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('bm-theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <header className="h-[60px] bg-surface border-b border-border flex items-center px-5 justify-between shrink-0">
        <div className="flex items-center gap-8">
          <Link to="/" className="hover:opacity-80 transition-opacity shrink-0 flex items-center gap-2">
            <img src="/logopic.png" alt="" className="h-[40px] w-auto" style={dark ? { filter: 'invert(1)' } : undefined} />
            <img src="/logotext.png" alt="Black Magician" className="h-[20px] w-auto" style={dark ? { filter: 'invert(1)' } : undefined} />
          </Link>

          <nav className="flex items-center gap-0.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1 text-[10px] tracking-[0.5px] font-semibold cursor-pointer transition-colors ${
                  activeCategory === cat.id
                    ? 'text-foreground underline underline-offset-[3px] decoration-[1.5px]'
                    : 'text-muted-foreground hover:text-foreground/70'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={() => setDark(!dark)}
            className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            title={dark ? 'Light mode' : 'Dark mode'}
          >
            {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {user ? (
            <>
              <span className="text-[10px] text-muted-foreground">
                {userProfile?.display_name || user.email}
              </span>
              <button onClick={signOut} className="text-muted-foreground hover:text-foreground cursor-pointer" title="로그아웃">
                <LogOut className="w-3 h-3" />
              </button>
            </>
          ) : (
            <Link to="/library/login">
              <Button variant="ghost" size="sm" className="h-6 text-[10px] font-semibold gap-1 text-muted-foreground hover:text-foreground px-2">
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

      <footer className="h-[24px] bg-surface border-t border-border flex items-center justify-between px-5 shrink-0 text-[9px] text-muted-foreground">
        <span>&copy; 2026 Black Magician. All rights reserved.</span>
        <div className="flex items-center gap-3">
          <a href="https://instagram.com/iiiaha.lab" target="_blank" rel="noopener noreferrer"
            className="hover:text-foreground transition-colors flex items-center gap-1">
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="5" /><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
            </svg>
            @iiiaha.lab
          </a>
        </div>
      </footer>
    </div>
  )
}
