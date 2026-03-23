import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { LogIn, Sun, Moon, ChevronDown } from 'lucide-react'
import { CATEGORIES, type CategoryId } from '@/lib/categories'
import { useState, useEffect, useRef } from 'react'

export default function LibraryLayout() {
  const { user, userProfile, signOut } = useAuth()
  const [activeCategory, setActiveCategory] = useState<CategoryId>('tile')
  const [showLoginPopup, setShowLoginPopup] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
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
            <img src="/logopic.png" alt="" className="h-[35px] w-auto" style={dark ? { filter: 'invert(1)' } : undefined} />
            <img src="/logotext.png" alt="Black Magician" className="h-[25px] w-auto" style={dark ? { filter: 'invert(1)' } : undefined} />
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
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <span>{userProfile?.display_name || user.email}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 w-[110px] bg-surface border border-border rounded-[5px] shadow-[0_4px_16px_rgba(0,0,0,0.1)] overflow-hidden z-50 py-1">
                  <button
                    onClick={() => { signOut(); setShowUserMenu(false) }}
                    className="w-full text-center py-1.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                  >
                    로그아웃
                  </button>
                  <div className="border-t border-border mx-2" />
                  <button
                    onClick={() => {
                      setShowUserMenu(false)
                      setShowDeleteConfirm(true)
                    }}
                    className="w-full text-center py-1.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                  >
                    회원탈퇴
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setShowLoginPopup(true)}
              className="h-6 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer px-2">
              <LogIn className="w-3 h-3" />
              LOGIN
            </button>
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

      {/* Delete Account Confirm */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] bg-surface border border-border rounded-[8px] p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h3 className="text-[13px] font-bold mb-2">회원탈퇴</h3>
            <p className="text-[10px] text-muted-foreground mb-5 leading-relaxed">
              정말 탈퇴하시겠습니까?<br />모든 데이터가 삭제됩니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-[34px] text-[11px] font-semibold border border-border rounded-[5px] bg-surface hover:bg-muted cursor-pointer transition-colors"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  await supabase.rpc('delete_own_account')
                  await supabase.auth.signOut({ scope: 'global' })
                  window.location.href = '/'
                }}
                className="flex-1 h-[34px] text-[11px] font-semibold border border-border rounded-[5px] bg-surface hover:bg-muted cursor-pointer transition-colors"
              >
                탈퇴하기
              </button>
            </div>
          </div>
        </>
      )}

      {/* Login Popup */}
      {showLoginPopup && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowLoginPopup(false)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] bg-surface border border-border rounded-[8px] p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h3 className="text-[13px] font-bold mb-1">로그인</h3>
            <p className="text-[10px] text-muted-foreground mb-5">마감재를 적용하려면 로그인이 필요합니다</p>
            <button
              onClick={async () => {
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: { redirectTo: window.location.origin + '/' },
                })
                if (!error) setShowLoginPopup(false)
              }}
              className="w-full h-[38px] flex items-center justify-center gap-2.5 border border-border rounded-[5px] bg-surface hover:bg-muted cursor-pointer transition-colors"
            >
              <svg className="w-[16px] h-[16px]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-[11px] font-semibold">Google로 계속하기</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
