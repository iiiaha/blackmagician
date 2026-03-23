import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, FolderTree } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Vendor } from '@/types/database'

export default function AdminVendors() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)

  const fetchVendors = async () => {
    const { data } = await supabase
      .from('vendors')
      .select('*')
      .order('created_at', { ascending: false })
    setVendors((data as Vendor[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchVendors()
  }, [])

  const handleApprove = async (vendorId: string) => {
    await supabase
      .from('vendors')
      .update({ approved: true, rejected: false })
      .eq('id', vendorId)
    fetchVendors()
  }

  const handleReject = async (vendorId: string) => {
    await supabase
      .from('vendors')
      .update({ approved: false, rejected: true })
      .eq('id', vendorId)
    fetchVendors()
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">로딩 중...</div>
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">벤더 관리</h1>

      {vendors.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">등록된 벤더가 없습니다.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left px-4 py-3 font-medium">업체명</th>
                <th className="text-left px-4 py-3 font-medium">담당자</th>
                <th className="text-left px-4 py-3 font-medium">연락처</th>
                <th className="text-left px-4 py-3 font-medium">상태</th>
                <th className="text-left px-4 py-3 font-medium">등록일</th>
                <th className="text-right px-4 py-3 font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map(vendor => (
                <tr key={vendor.id} className="border-t hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium">{vendor.company_name}</td>
                  <td className="px-4 py-3">{vendor.contact_name}</td>
                  <td className="px-4 py-3">{vendor.contact_phone}</td>
                  <td className="px-4 py-3">
                    {vendor.approved ? (
                      <Badge variant="success">승인</Badge>
                    ) : vendor.rejected ? (
                      <Badge variant="destructive">거절</Badge>
                    ) : (
                      <Badge variant="warning">대기</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(vendor.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {vendor.approved && (
                        <Link to={`/admin/folders/${vendor.id}`}>
                          <Button size="sm" variant="outline" title="폴더 관리">
                            <FolderTree className="w-3 h-3 mr-1" />
                            폴더 관리
                          </Button>
                        </Link>
                      )}
                      {!vendor.approved && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(vendor.id)}
                            title="승인"
                          >
                            <Check className="w-3 h-3 mr-1" />
                            승인
                          </Button>
                          {!vendor.rejected && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReject(vendor.id)}
                              title="거절"
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="w-3 h-3 mr-1" />
                              거절
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
