import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Users, Clock } from 'lucide-react'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalVendors: 0, pendingVendors: 0 })

  useEffect(() => {
    const fetchStats = async () => {
      const [totalRes, pendingRes] = await Promise.all([
        supabase.from('vendors').select('id', { count: 'exact', head: true }),
        supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('approved', false).eq('rejected', false),
      ])
      setStats({
        totalVendors: totalRes.count || 0,
        pendingVendors: pendingRes.count || 0,
      })
    }
    fetchStats()
  }, [])

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">관리자 대시보드</h1>
      <div className="grid grid-cols-2 gap-4">
        <Link to="/admin/vendors">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">전체 벤더</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalVendors}</div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/admin/vendors">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">승인 대기</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingVendors}</div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
