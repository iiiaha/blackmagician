import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { requestBillingAuth, issueBillingKey, cancelSubscription } from '@/lib/toss'
import { LogIn, Sun, Moon, ChevronDown, Globe, Instagram, Phone } from 'lucide-react'
import { CATEGORIES, type CategoryId } from '@/lib/categories'
import { useState, useEffect, useRef } from 'react'
import type { Vendor } from '@/types/database'

const isSketchUp = typeof window !== 'undefined' && 'sketchup' in window

export default function UserLayout() {
  const { user, userProfile, signOut, isPro, todayApplyCount, maxFreeApplies, refreshUserProfile, vendorMode } = useAuth()
  const [activeCategory, setActiveCategory] = useState<CategoryId>('tile')
  const [showLoginPopup, setShowLoginPopup] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPlanInfo, setShowPlanInfo] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 })

  // Fetch vendor info for vendor mode header links
  const [vendorInfo, setVendorInfo] = useState<Vendor | null>(null)
  useEffect(() => {
    if (!vendorMode) return
    supabase.from('vendors').select('*').eq('slug', vendorMode).eq('approved', true).maybeSingle()
      .then(({ data }) => { if (data) setVendorInfo(data as Vendor) })
  }, [vendorMode])

  // Update sliding indicator position
  useEffect(() => {
    if (!navRef.current) return
    const activeBtn = navRef.current.querySelector('[data-active="true"]') as HTMLElement | null
    if (activeBtn) {
      setIndicatorStyle({
        left: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth,
      })
    }
  }, [activeCategory])

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

  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)

  // Handle billing auth success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('billing') === 'success') {
      const authKey = params.get('authKey')
      const customerKey = params.get('customerKey')
      window.history.replaceState({}, '', '/')
      if (authKey && customerKey) {
        issueBillingKey(authKey, customerKey)
          .then(() => refreshUserProfile())
          .catch(() => alert('결제 처리 중 오류가 발생했습니다.'))
      }
    }
    if (params.get('billing') === 'fail') {
      window.history.replaceState({}, '', '/')
      alert('결제가 취소되었습니다.')
    }
  }, [])

  const handleSubscribe = async () => {
    if (!userProfile) return
    setCheckoutLoading(true)
    try {
      await requestBillingAuth(userProfile.id)
    } catch {
      alert('결제 페이지를 열 수 없습니다. 잠시 후 다시 시도해주세요.')
      setCheckoutLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    setCancelLoading(true)
    try {
      await cancelSubscription()
      await refreshUserProfile()
      setShowCancelConfirm(false)
      setShowPlanInfo(false)
    } catch {
      alert('구독 취소 중 오류가 발생했습니다.')
    } finally {
      setCancelLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <header className="h-[70px] bg-surface border-b border-border flex items-center px-5 justify-between shrink-0">
        <div className="flex items-center gap-8">
          {vendorMode ? (
            <div className="w-[190px] flex items-center justify-center shrink-0 -ml-5">
              <img src="/younhyun_logo.png" alt="Younhyun Trading" className="h-[45px] w-auto" style={dark ? { filter: 'invert(1)' } : undefined} />
            </div>
          ) : (
            <Link to="/" className="hover:opacity-80 transition-opacity shrink-0 flex items-center gap-2">
              <img src="/logopic.png" alt="" className="h-[45px] w-auto" />
              <img src="/logotext.png" alt="Black Magician" className="h-[25px] w-auto" style={dark ? { filter: 'invert(1)' } : undefined} />
            </Link>
          )}

          {!vendorMode && (
            <nav ref={navRef} className="relative flex items-center gap-1 bg-muted rounded-full p-[3px] ml-[30px]">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  data-active={activeCategory === cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`relative z-10 px-3 py-[5px] text-[10px] tracking-[0.3px] font-semibold cursor-pointer transition-all duration-200 rounded-full ${
                    activeCategory === cat.id
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground/70'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
              {/* Sliding pill indicator */}
              <span
                className="absolute top-[3px] h-[calc(100%-6px)] bg-surface rounded-full shadow-sm transition-all duration-300 ease-in-out"
                style={{ left: indicatorStyle.left + 3, width: indicatorStyle.width }}
              />
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={() => setDark(!dark)}
            className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            title={dark ? 'Light mode' : 'Dark mode'}
          >
            {dark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>

          {vendorMode && vendorInfo ? (
            <div className="flex items-center gap-1">
              {vendorInfo.website_url && (
                <a href={vendorInfo.website_url} target="_blank" rel="noopener noreferrer"
                  className="h-[26px] flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2.5 rounded-[4px] hover:bg-muted">
                  <Globe className="w-3 h-3" /> Website
                </a>
              )}
              {vendorInfo.instagram && (
                <a href={`https://instagram.com/${vendorInfo.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                  className="h-[26px] flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2.5 rounded-[4px] hover:bg-muted">
                  <Instagram className="w-3 h-3" /> Instagram
                </a>
              )}
              {vendorInfo.contact_phone && (
                <VendorContact vendor={vendorInfo} />
              )}
            </div>
          ) : !vendorMode && (user ? (
            <>
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
            </>
          ) : (
            <button onClick={() => setShowLoginPopup(true)}
              className="h-6 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer px-2">
              <LogIn className="w-3 h-3" />
              LOGIN
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <Outlet context={{ activeCategory }} />
      </main>

      <footer className="bg-surface border-t border-border flex items-center justify-center px-5 shrink-0 text-[10px] text-muted-foreground"
        style={{ height: isSketchUp ? '24px' : '36px' }}>
        {vendorMode ? (
          <div className="flex items-center gap-2">
            <span>이 익스텐션은 윤현상재와 iiiaha.lab의 협업으로 제작되었습니다.</span>
            <span className="text-border">|</span>
            <span>"디자이너의 생산성을 책임집니다."</span>
            <a href="https://instagram.com/iiiaha.lab" target="_blank" rel="noopener noreferrer"
              className="hover:text-foreground transition-colors flex items-center gap-1 font-semibold">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="5" /><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
              </svg>
              iiiaha.lab
            </a>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span>&copy; 2026 Black Magician. All rights reserved.</span>
              {!isSketchUp && (
                <>
                  <span className="text-border">|</span>
                  <span>이아하랩</span>
                  <span className="text-border">|</span>
                  <span>대표 이상훈</span>
                  <span className="text-border">|</span>
                  <span>사업자등록번호 367-02-03753</span>
                  <span className="text-border">|</span>
                  <span>서울특별시 강남구 논현동 77-20</span>
                  <span className="text-border">|</span>
                  <span>010-4005-7606</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <Link to="/terms" className="hover:text-foreground transition-colors">이용약관</Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors">개인정보처리방침</Link>
              <a href="https://instagram.com/iiiaha.lab" target="_blank" rel="noopener noreferrer"
                className="hover:text-foreground transition-colors flex items-center gap-1">
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="5" /><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
                </svg>
                @iiiaha.lab
              </a>
            </div>
          </>
        )}
      </footer>

      {/* Plan Info Popup */}
      {showPlanInfo && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowPlanInfo(false)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] bg-surface border border-border rounded-[8px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h3 className="text-[13px] font-bold mb-4 text-center">구독 정보</h3>
            <div className="space-y-3 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">현재 플랜</span>
                <span className="font-semibold">
                  {isPro ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-[8px] font-bold bg-[#34d399] text-white px-1.5 py-[2px] rounded-[3px]">PRO</span>
                      무제한
                    </span>
                  ) : 'Free'}
                </span>
              </div>
              {!isPro && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">잔여 횟수</span>
                    <span className="font-semibold">{Math.max(0, maxFreeApplies - todayApplyCount)} / {maxFreeApplies}회</span>
                  </div>
                  {todayApplyCount >= maxFreeApplies && (
                    <p className="text-[9px] text-text-tertiary text-right">
                      <TimeUntilMidnightKST /> 후 갱신
                    </p>
                  )}
                </>
              )}
              {userProfile?.trial_expires_at && new Date(userProfile.trial_expires_at) > new Date() && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">체험 만료</span>
                  <span className="font-semibold">{new Date(userProfile.trial_expires_at).toLocaleDateString('ko-KR')}</span>
                </div>
              )}
              {isPro && userProfile?.plan_expires_at && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">다음 결제일</span>
                  <span className="font-semibold">{new Date(userProfile.plan_expires_at).toLocaleDateString('ko-KR')}</span>
                </div>
              )}
              {isPro && userProfile?.toss_billing_key && (
                <div className="mt-4 pt-3 border-t border-border text-center">
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="w-full h-[32px] border border-border rounded-[5px] text-[10px] font-semibold cursor-pointer hover:bg-muted transition-colors text-muted-foreground"
                  >
                    구독 취소
                  </button>
                </div>
              )}
              {isPro && !userProfile?.toss_billing_key && (
                <p className="mt-3 text-[9px] text-text-tertiary text-center">
                  구독 취소됨 — {userProfile?.plan_expires_at ? new Date(userProfile.plan_expires_at).toLocaleDateString('ko-KR') : ''} 까지 이용 가능
                </p>
              )}
              {!isPro && (
                <div className="mt-4 pt-3 border-t border-border text-center">
                  <p className="text-[10px] text-muted-foreground mb-2">Pro 구독 시 Apply to Bucket 무제한</p>
                  <p className="text-[14px] font-bold">월 3,900원</p>
                  <button
                    onClick={handleSubscribe}
                    disabled={checkoutLoading}
                    className="w-full h-[32px] mt-3 bg-[#34d399] text-white text-[10px] font-semibold rounded-[5px] cursor-pointer hover:opacity-85 transition-colors disabled:opacity-50"
                  >
                    {checkoutLoading ? '이동 중...' : 'Pro 구독하기'}
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => setShowPlanInfo(false)}
              className="w-full h-[28px] mt-4 border border-border rounded-[4px] text-[10px] font-semibold cursor-pointer hover:bg-muted transition-colors">
              닫기
            </button>
          </div>
        </>
      )}

      {/* Delete Account Confirm */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] bg-surface border border-border rounded-[8px] p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h3 className="text-[13px] font-bold mb-2">회원탈퇴</h3>
            <p className="text-[10px] text-muted-foreground mb-5 leading-relaxed">
              정말 탈퇴하시겠습니까?<br />
              탈퇴 후 <strong>30일간 재가입이 불가</strong>합니다.
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
                  if (userProfile?.toss_billing_key) {
                    try { await cancelSubscription() } catch { /* proceed anyway */ }
                  }
                  await supabase.rpc('soft_delete_account')
                  await supabase.auth.signOut({ scope: 'global' })
                  window.location.href = '/'
                }}
                className="flex-1 h-[34px] text-[11px] font-semibold border border-border rounded-[5px] bg-destructive/10 text-destructive hover:bg-destructive/20 cursor-pointer transition-colors"
              >
                탈퇴하기
              </button>
            </div>
          </div>
        </>
      )}

      {/* Cancel Subscription Confirm */}
      {showCancelConfirm && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowCancelConfirm(false)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] bg-surface border border-border rounded-[8px] p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h3 className="text-[13px] font-bold mb-2">구독 취소</h3>
            <p className="text-[10px] text-muted-foreground mb-5 leading-relaxed">
              구독을 취소하시겠습니까?<br />
              {userProfile?.plan_expires_at && (
                <><strong>{new Date(userProfile.plan_expires_at).toLocaleDateString('ko-KR')}</strong>까지는 Pro를 이용할 수 있습니다.</>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 h-[34px] text-[11px] font-semibold border border-border rounded-[5px] bg-surface hover:bg-muted cursor-pointer transition-colors"
              >
                유지하기
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelLoading}
                className="flex-1 h-[34px] text-[11px] font-semibold border border-border rounded-[5px] bg-destructive/10 text-destructive hover:bg-destructive/20 cursor-pointer transition-colors disabled:opacity-50"
              >
                {cancelLoading ? '처리 중...' : '구독 취소'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Login Popup */}
      {showLoginPopup && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowLoginPopup(false)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] rounded-[12px] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
            {/* Hero section */}
            <div className="relative px-6 pt-8 pb-6 text-center overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #49637a 0%, #3a5269 50%, #2d4155 100%)' }}>
              <div className="absolute inset-0 opacity-[0.06]"
                style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #add7eb 1px, transparent 1px), radial-gradient(circle at 80% 20%, #add7eb 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
              <div className="relative">
                <div className="w-10 h-10 mx-auto mb-4 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
                  <img src="/logopic.png" alt="" className="w-6 h-6" />
                </div>
                <h3 className="text-[15px] font-bold text-white mb-2 leading-snug">
                  선택하신 마감재,<br />바로 입혀보세요
                </h3>
                <p className="text-[11px] text-white/60 mb-3">
                  Google 계정으로 3초 만에 시작하세요.
                </p>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#34d399] bg-[#34d399]/10 px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
                  완전 무료, 횟수 제한 없음
                </span>
              </div>
            </div>
            {/* Bottom section */}
            <div className="bg-surface px-6 pt-5 pb-4">
              <button
                onClick={async () => {
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: window.location.origin + '/' },
                  })
                  if (!error) setShowLoginPopup(false)
                }}
                className="w-full h-[42px] flex items-center justify-center gap-2.5 border border-border rounded-[6px] bg-surface hover:bg-muted cursor-pointer transition-colors"
              >
                <svg className="w-[16px] h-[16px]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-[11px] font-semibold">Google로 시작하기</span>
              </button>
              <button onClick={() => setShowLoginPopup(false)}
                className="w-full mt-3 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer py-1">
                취소
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function VendorContact({ vendor }: { vendor: Vendor }) {
  const [show, setShow] = useState(false)
  return (
    <>
      <button onClick={() => setShow(true)}
        className="h-[26px] flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2.5 rounded-[4px] hover:bg-muted cursor-pointer">
        <Phone className="w-3 h-3" /> Contact
      </button>
      {show && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShow(false)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] bg-surface border border-border rounded-[8px] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h3 className="text-[12px] font-bold mb-3 text-foreground">{vendor.company_name}</h3>
            <div className="space-y-2 text-[11px]">
              {vendor.contact_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">담당자</span>
                  <span className="font-medium text-foreground">{vendor.contact_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">연락처</span>
                <span className="font-medium text-foreground">{vendor.contact_phone}</span>
              </div>
              {vendor.address && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">주소</span>
                  <span className="font-medium text-foreground text-right max-w-[140px]">{vendor.address}</span>
                </div>
              )}
            </div>
            <button onClick={() => setShow(false)}
              className="w-full h-[28px] mt-4 border border-border rounded-[4px] text-[10px] font-semibold cursor-pointer hover:bg-muted transition-colors">
              닫기
            </button>
          </div>
        </>
      )}
    </>
  )
}

function TimeUntilMidnightKST() {
  const [text, setText] = useState('')

  useEffect(() => {
    const calc = () => {
      const now = new Date()
      // KST = UTC+9
      const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
      const kstMidnight = new Date(kstNow)
      kstMidnight.setUTCHours(24, 0, 0, 0) // next KST midnight in UTC terms
      const diff = kstMidnight.getTime() - kstNow.getTime()
      const h = Math.floor(diff / (1000 * 60 * 60))
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const s = Math.floor((diff % (1000 * 60)) / 1000)
      setText(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [])

  return <>{text}</>
}
