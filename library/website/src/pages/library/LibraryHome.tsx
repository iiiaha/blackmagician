import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/input'
import PreviewPanel from '@/components/PreviewPanel'
import {
  Search, ChevronRight, ChevronDown, ChevronLeft,
  Folder, FolderOpen, Download, Info,
  ImageIcon, Lock,
} from 'lucide-react'
import type { Vendor, FolderNode, Product, ProductImage } from '@/types/database'

interface TreeNode extends FolderNode { children: TreeNode[] }

function buildTree(nodes: FolderNode[], parentId: string | null): TreeNode[] {
  return nodes
    .filter(n => n.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map(n => ({ ...n, children: buildTree(nodes, n.id) }))
}

function getBreadcrumb(nodes: FolderNode[], folderId: string): FolderNode[] {
  const path: FolderNode[] = []
  let current = nodes.find(n => n.id === folderId)
  while (current) {
    path.unshift(current)
    current = current.parent_id ? nodes.find(n => n.id === current!.parent_id) : undefined
  }
  return path
}

export default function LibraryHome() {
  const { user } = useAuth()

  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [folderTree, setFolderTree] = useState<TreeNode[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedFolder, setSelectedFolder] = useState<FolderNode | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [productImages, setProductImages] = useState<Record<string, ProductImage[]>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<(Product & { vendor_name: string; folder_path: string })[] | null>(null)

  // Preview
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null)
  const [previewImages, setPreviewImages] = useState<ProductImage[]>([])
  const [previewVendor, setPreviewVendor] = useState('')
  const [previewSizeStr, setPreviewSizeStr] = useState('')

  // Detail
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)

  useEffect(() => {
    supabase.from('vendors').select('*').eq('approved', true).order('company_name')
      .then(({ data }) => setVendors((data as Vendor[]) || []))
  }, [])

  const fetchFolders = useCallback(async (vendorId: string) => {
    const { data } = await supabase.from('folder_nodes').select('*').eq('vendor_id', vendorId).order('sort_order')
    const f = (data as FolderNode[]) || []
    setFolders(f)
    setExpandedIds(new Set(f.map(n => n.id)))
    setFolderTree(buildTree(f, null))
  }, [])

  const handleSelectVendor = (v: Vendor) => {
    setSelectedVendor(v)
    setSelectedFolder(null)
    setProducts([])
    setProductImages({})
    setSearchResults(null)
    fetchFolders(v.id)
  }

  const fetchProducts = useCallback(async (folderId: string) => {
    const { data } = await supabase.from('products').select('*').eq('folder_id', folderId).order('name')
    const prods = (data as Product[]) || []
    setProducts(prods)
    if (prods.length > 0) {
      const { data: imgData } = await supabase.from('product_images').select('*')
        .in('product_id', prods.map(p => p.id)).order('sort_order')
      const images = (imgData as ProductImage[]) || []
      const grouped: Record<string, ProductImage[]> = {}
      for (const img of images) {
        if (!grouped[img.product_id]) grouped[img.product_id] = []
        grouped[img.product_id].push(img)
      }
      setProductImages(grouped)
    } else {
      setProductImages({})
    }
  }, [])

  const handleSelectFolder = (node: FolderNode) => {
    if (node.is_leaf) {
      setSelectedFolder(node)
      setSearchResults(null)
      fetchProducts(node.id)
    }
    toggleExpand(node.id)
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return }
    const { data } = await supabase.from('products')
      .select('*, vendors!inner(company_name, approved)')
      .ilike('name', `%${searchQuery.trim()}%`).limit(50)
    if (data) {
      const results = await Promise.all(data.map(async (p: Record<string, unknown>) => {
        const vendor = p.vendors as Record<string, unknown>
        if (!vendor?.approved) return null
        const { data: fd } = await supabase.from('folder_nodes').select('*').eq('vendor_id', p.vendor_id as string)
        const allF = (fd as FolderNode[]) || []
        const bc = getBreadcrumb(allF, p.folder_id as string)
        return { ...(p as unknown as Product), vendor_name: vendor.company_name as string, folder_path: bc.map(f => f.name).join(' / ') }
      }))
      setSearchResults(results.filter(Boolean) as (Product & { vendor_name: string; folder_path: string })[])
    }
    setSelectedFolder(null)
    setSelectedVendor(null)
  }

  const handleDownload = (product: Product, vendorName?: string) => {
    if (!user) { alert('로그인 후 이용 가능합니다.'); return }
    const imgs = productImages[product.id] || []
    if (imgs.length === 0) { alert('이미지가 없습니다.'); return }
    const vName = vendorName || selectedVendor?.company_name || ''
    const breadcrumb = selectedFolder ? getBreadcrumb(folders, selectedFolder.id) : []
    setPreviewProduct(product)
    setPreviewImages(imgs)
    setPreviewVendor(vName)
    const sizeNode = breadcrumb.find(f => /\d+x\d+/.test(f.name))
    setPreviewSizeStr(sizeNode?.name || '600x600')
  }

  const handleInsert = (dataUrl: string, vendor: string, tileName: string, sizeStr: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sk = (window as any).sketchup as Record<string, (...args: string[]) => void> | undefined
    if (sk?.insert_material) {
      sk.insert_material(dataUrl, vendor, tileName, sizeStr)
    } else {
      alert('SketchUp 환경에서만 Insert 가능합니다.')
    }
  }

  const renderNode = (node: TreeNode, level: number) => {
    const isExpanded = expandedIds.has(node.id)
    const isSelected = selectedFolder?.id === node.id
    return (
      <div key={node.id}>
        <button
          onClick={() => handleSelectFolder(node)}
          className={`flex items-center gap-1.5 py-[5px] w-full text-left rounded-sm text-xs transition-all cursor-pointer ${
            isSelected
              ? 'bg-foreground text-background font-semibold'
              : 'text-foreground/70 hover:text-foreground hover:bg-secondary'
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px`, paddingRight: '8px' }}
        >
          {node.children.length > 0 || !node.is_leaf ? (
            isExpanded
              ? <ChevronDown className="w-3 h-3 shrink-0 opacity-40" />
              : <ChevronRight className="w-3 h-3 shrink-0 opacity-40" />
          ) : <span className="w-3 shrink-0" />}
          {node.is_leaf
            ? <FolderOpen className="w-3.5 h-3.5 shrink-0 opacity-50" />
            : <Folder className="w-3.5 h-3.5 shrink-0 opacity-50" />}
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children.map(child => renderNode(child, level + 1))}
      </div>
    )
  }

  return (
    <div className="flex" style={{ height: 'calc(100vh - 44px)' }}>
      {/* ── Left Column ── */}
      <div className="w-[220px] border-r flex flex-col shrink-0">
        {/* Folder Browser */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="제품명 검색"
                className="h-8 text-xs pl-8 pr-3 rounded-sm bg-secondary border-0 placeholder:text-muted-foreground/60 focus-visible:ring-1" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {selectedVendor ? (
              <>
                <button onClick={() => { setSelectedVendor(null); setSelectedFolder(null); setProducts([]); setFolders([]) }}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mb-2 px-1 cursor-pointer transition-colors">
                  <ChevronLeft className="w-3 h-3" />
                  <span>전체 업체</span>
                </button>
                <div className="px-2 mb-3">
                  <span className="text-xs font-bold text-foreground">{selectedVendor.company_name}</span>
                </div>
                {folderTree.length > 0 ? folderTree.map(n => renderNode(n, 0)) : (
                  <p className="text-xs text-muted-foreground px-2 py-4">등록된 폴더가 없습니다.</p>
                )}
              </>
            ) : (
              <>
                <div className="px-2 mb-2">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Vendors</span>
                </div>
                {vendors.map(v => (
                  <button key={v.id} onClick={() => handleSelectVendor(v)}
                    className="flex items-center w-full text-left px-2 py-[6px] rounded-sm text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-secondary cursor-pointer transition-all">
                    {v.company_name}
                  </button>
                ))}
                {vendors.length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-8 text-center">등록된 업체가 없습니다.</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Preview */}
        <div className="h-[46%] shrink-0">
          <PreviewPanel
            images={previewImages}
            sizeStr={previewSizeStr}
            vendorName={previewVendor}
            tileName={previewProduct?.name || ''}
            onInsertRequest={handleInsert}
          />
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Breadcrumb / Title Bar */}
        {(selectedFolder || searchResults !== null) && (
          <div className="px-5 py-2.5 border-b flex items-center justify-between shrink-0">
            {searchResults !== null ? (
              <>
                <span className="text-xs text-muted-foreground">
                  "<span className="text-foreground font-medium">{searchQuery}</span>" 검색 결과 {searchResults.length}건
                </span>
                <button onClick={() => setSearchResults(null)}
                  className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                  초기화
                </button>
              </>
            ) : selectedFolder && (
              <div className="flex items-center gap-1 text-xs">
                {getBreadcrumb(folders, selectedFolder.id).map((f, i, arr) => (
                  <span key={f.id} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
                    <span className={i === arr.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                      {f.name}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto">
          {searchResults !== null ? (
            <div className="p-5">
              {searchResults.length === 0 ? (
                <EmptyState message="검색 결과가 없습니다." />
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {searchResults.map(p => (
                    <ProductCard key={p.id} product={p} images={[]}
                      vendorName={p.vendor_name}
                      onDownload={() => handleDownload(p, p.vendor_name)}
                      onDetail={() => setDetailProduct(p)}
                      loggedIn={!!user} />
                  ))}
                </div>
              )}
            </div>
          ) : selectedFolder ? (
            <div className="p-5">
              {products.length === 0 ? (
                <EmptyState message="이 폴더에 등록된 제품이 없습니다." />
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {products.map(p => (
                    <ProductCard key={p.id} product={p} images={productImages[p.id] || []}
                      onDownload={() => handleDownload(p)}
                      onDetail={() => setDetailProduct(p)}
                      loggedIn={!!user} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-sm text-muted-foreground/50 font-medium">마감재를 탐색하려면</p>
                <p className="text-sm text-muted-foreground/50 font-medium">좌측에서 업체를 선택하세요.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Sidebar ── */}
      {detailProduct && (
        <div className="w-[200px] border-l shrink-0 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-xs font-bold">상세 정보</span>
            <button onClick={() => setDetailProduct(null)}
              className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              닫기
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <h3 className="text-sm font-bold mb-3 leading-snug">{detailProduct.name}</h3>
            <div className="space-y-2.5 text-xs leading-relaxed">
              {detailProduct.unit_price !== null && (
                <InfoRow label="단가" value={`${Number(detailProduct.unit_price).toLocaleString()}원`} />
              )}
              {detailProduct.stock !== null && (
                <InfoRow label="재고" value={`${detailProduct.stock}개`} />
              )}
              {detailProduct.moq !== null && (
                <InfoRow label="MOQ" value={`${detailProduct.moq}개`} />
              )}
              {detailProduct.lead_time && (
                <InfoRow label="리드타임" value={detailProduct.lead_time} />
              )}
              {detailProduct.notes && (
                <div>
                  <span className="text-muted-foreground text-[11px]">비고</span>
                  <p className="mt-0.5 text-foreground/80 leading-relaxed">{detailProduct.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-muted-foreground text-[11px]">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-sm text-muted-foreground/50">{message}</p>
    </div>
  )
}

function ProductCard({ product, images, vendorName, onDownload, onDetail, loggedIn }: {
  product: Product
  images: ProductImage[]
  vendorName?: string
  onDownload: () => void
  onDetail: () => void
  loggedIn: boolean
}) {
  return (
    <div className="group relative cursor-pointer" onClick={onDetail}>
      {/* Thumbnail */}
      <div className="aspect-square bg-[#f8f8f8] rounded-sm overflow-hidden mb-2 relative">
        {product.thumbnail_url ? (
          <img src={product.thumbnail_url} alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-muted-foreground/15" />
          </div>
        )}

        {/* Hover overlay - bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Action buttons */}
        <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {loggedIn ? (
            <button onClick={(e) => { e.stopPropagation(); onDownload() }}
              className="w-7 h-7 bg-white rounded-full flex items-center justify-center hover:bg-white/90 shadow-sm cursor-pointer transition-transform hover:scale-110"
              title="프리뷰에 로드">
              <Download className="w-3.5 h-3.5 text-foreground" />
            </button>
          ) : (
            <div className="w-7 h-7 bg-white/60 rounded-full flex items-center justify-center" title="로그인 필요">
              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDetail() }}
            className="w-7 h-7 bg-white rounded-full flex items-center justify-center hover:bg-white/90 shadow-sm cursor-pointer transition-transform hover:scale-110"
            title="상세 정보">
            <Info className="w-3.5 h-3.5 text-foreground" />
          </button>
        </div>

        {/* Pattern count badge */}
        {images.length > 1 && (
          <span className="absolute top-1.5 right-1.5 bg-foreground/70 text-background text-[9px] font-semibold px-1.5 py-0.5 rounded-sm">
            {images.length}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="px-0.5">
        <p className="text-xs font-semibold truncate leading-tight">{product.name}</p>
        {vendorName && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{vendorName}</p>
        )}
        {product.unit_price !== null && (
          <p className="text-[11px] font-bold mt-0.5">{Number(product.unit_price).toLocaleString()}원</p>
        )}
      </div>
    </div>
  )
}
