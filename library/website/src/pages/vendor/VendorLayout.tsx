import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export default function VendorLayout() {
  const { user, vendor, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/vendor/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-12 border-b flex items-center px-4 justify-between">
        <Link to="/vendor" className="font-semibold text-sm hover:opacity-80">
          Black Magician — Vendor Portal
        </Link>
        <div className="flex items-center gap-2">
          {user && vendor && (
            <>
              <span className="text-xs text-muted-foreground">{vendor.company_name}</span>
              <Button variant="ghost" size="icon" onClick={handleSignOut} title="로그아웃">
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </header>
      <main className="max-w-2xl mx-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
