import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import PreviewPanel from '@/components/PreviewPanel'
import {
  Search, ChevronRight, ChevronDown, ChevronLeft,
  Folder, FolderOpen, Building2, Download, Info,
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

  // Preview state
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null)
  const [previewImages, setPreviewImages] = useState<ProductImage[]>([])
  const [previewVendor, setPreviewVendor] = useState('')
  const [previewSizeStr, setPreviewSizeStr] = useState('')

  // Detail panel
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)

  // Fetch vendors
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

  // Search
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
        return { ...(p as unknown as Product), vendor_name: vendor.company_name as string, folder_path: bc.map(f => f.name).join(' > ') }
      }))
      setSearchResults(results.filter(Boolean) as (Product & { vendor_name: string; folder_path: string })[])
    }
    setSelectedFolder(null)
    setSelectedVendor(null)
  }

  // Download → load into preview (no local file save)
  const handleDownload = (product: Product, vendorName?: string) => {
    if (!user) { alert('로그인 후 이용 가능합니다.'); return }

    const imgs = productImages[product.id] || []
    if (imgs.length === 0) { alert('이미지가 없습니다.'); return }

    const vName = vendorName || selectedVendor?.company_name || ''
    const breadcrumb = selectedFolder ? getBreadcrumb(folders, selectedFolder.id) : []

    // Set preview directly from Supabase URLs
    setPreviewProduct(product)
    setPreviewImages(imgs)
    setPreviewVendor(vName)
    const sizeNode = breadcrumb.find(f => /\d+x\d+/.test(f.name))
    setPreviewSizeStr(sizeNode?.name || '600x600')
  }

  // Insert via postMessage to parent
  const handleInsert = (dataUrl: string, vendor: string, tileName: string, sizeStr: string) => {
    window.parent.postMessage({
      type: 'bm-insert',
      payload: { dataUrl, vendor, tileName, sizeStr },
    }, '*')
  }

  // Listen for results from parent
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'bm-insert-result') {
        // Insert completed
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Render folder tree node
  const renderNode = (node: TreeNode, level: number) => {
    const isExpanded = expandedIds.has(node.id)
    const isSelected = selectedFolder?.id === node.id
    return (
      <div key={node.id}>
        <button
          onClick={() => handleSelectFolder(node)}
          className={`flex items-center gap-1 py-1 px-1 w-full text-left rounded text-[11px] transition-colors cursor-pointer ${
            isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary/50'
          }`}
          style={{ paddingLeft: `${level * 14 + 4}px` }}
        >
          {node.children.length > 0 || !node.is_leaf ? (
            isExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />
          ) : <span className="w-3 shrink-0" />}
          {node.is_leaf ? <FolderOpen className="w-3 h-3 shrink-0" /> : <Folder className="w-3 h-3 shrink-0" />}
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children.map(child => renderNode(child, level + 1))}
      </div>
    )
  }

  return (
    <div className="flex h-full" style={{ height: 'calc(100vh - 40px)' }}>
      {/* ── Left Column ── */}
      <div className="w-52 border-r flex flex-col shrink-0 overflow-hidden">
        {/* Top: Folder Browser */}
        <div className="flex-1 flex flex-col overflow-hidden border-b">
          <div className="p-1.5 border-b">
            <div className="relative">
              <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="제품 검색..." className="h-6 text-[11px] pl-6 pr-2" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5">
            {selectedVendor ? (
              <>
                <button onClick={() => { setSelectedVendor(null); setSelectedFolder(null); setProducts([]); setFolders([]) }}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mb-1.5 cursor-pointer">
                  <ChevronLeft className="w-3 h-3" /> 전체 업체
                </button>
                <div className="flex items-center gap-1 mb-2 px-0.5">
                  <Building2 className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs font-medium">{selectedVendor.company_name}</span>
                </div>
                {folderTree.length > 0 ? folderTree.map(n => renderNode(n, 0)) : (
                  <p className="text-[11px] text-muted-foreground px-1">폴더가 없습니다.</p>
                )}
              </>
            ) : (
              <>
                <p className="text-[10px] font-medium text-muted-foreground mb-1 px-0.5">업체 목록</p>
                {vendors.map(v => (
                  <button key={v.id} onClick={() => handleSelectVendor(v)}
                    className="flex items-center gap-1.5 w-full text-left px-1.5 py-1 rounded text-xs hover:bg-secondary/50 cursor-pointer">
                    <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{v.company_name}</span>
                  </button>
                ))}
                {vendors.length === 0 && <p className="text-[11px] text-muted-foreground">업체 없음</p>}
              </>
            )}
          </div>
        </div>

        {/* Bottom: Preview */}
        <div className="h-[45%] shrink-0">
          <PreviewPanel
            images={previewImages}
            sizeStr={previewSizeStr}
            vendorName={previewVendor}
            tileName={previewProduct?.name || ''}
            onInsertRequest={handleInsert}
          />
        </div>
      </div>

      {/* ── Right: Product Grid ── */}
      <div className="flex-1 overflow-y-auto p-3">
        {searchResults !== null ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold">검색: "{searchQuery}"</h2>
              <button onClick={() => setSearchResults(null)} className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer">취소</button>
            </div>
            {searchResults.length === 0 ? (
              <p className="text-center py-12 text-xs text-muted-foreground">결과 없음</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
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
          <div>
            <div className="flex items-center gap-1 mb-3 text-[11px] text-muted-foreground">
              {getBreadcrumb(folders, selectedFolder.id).map((f, i, arr) => (
                <span key={f.id} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="w-3 h-3" />}
                  <span className={i === arr.length - 1 ? 'text-foreground font-medium' : ''}>{f.name}</span>
                </span>
              ))}
              <Badge variant="outline" className="text-[10px] ml-auto">{products.length}개</Badge>
            </div>
            {products.length === 0 ? (
              <p className="text-center py-12 text-xs text-muted-foreground">제품이 없습니다.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
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
            <div className="text-center text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-2 opacity-15" />
              <p className="text-xs">업체를 선택하고 폴더를 탐색하세요</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Sidebar ── */}
      {detailProduct && (
        <div className="w-56 border-l p-3 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{detailProduct.name}</h3>
            <button onClick={() => setDetailProduct(null)} className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">닫기</button>
          </div>
          <div className="space-y-2 text-xs">
            {detailProduct.unit_price !== null && (
              <div><span className="text-muted-foreground">단가:</span> {Number(detailProduct.unit_price).toLocaleString()}원</div>
            )}
            {detailProduct.stock !== null && (
              <div><span className="text-muted-foreground">재고:</span> {detailProduct.stock}개</div>
            )}
            {detailProduct.moq !== null && (
              <div><span className="text-muted-foreground">MOQ:</span> {detailProduct.moq}개</div>
            )}
            {detailProduct.lead_time && (
              <div><span className="text-muted-foreground">LT:</span> {detailProduct.lead_time}</div>
            )}
            {detailProduct.notes && (
              <div><span className="text-muted-foreground">비고:</span> {detailProduct.notes}</div>
            )}
            {(productImages[detailProduct.id] || []).length > 0 && (
              <div>
                <span className="text-muted-foreground">이미지:</span> {(productImages[detailProduct.id] || []).length}장
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Product Card with hover actions ──
function ProductCard({ product, images, vendorName, onDownload, onDetail, loggedIn }: {
  product: Product
  images: ProductImage[]
  vendorName?: string
  onDownload: () => void
  onDetail: () => void
  loggedIn: boolean
}) {
  return (
    <div className="group relative border rounded-lg overflow-hidden">
      <div className="aspect-square bg-secondary flex items-center justify-center">
        {product.thumbnail_url ? (
          <img src={product.thumbnail_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-6 h-6 text-muted-foreground/20" />
        )}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
        {loggedIn ? (
          <button onClick={onDownload}
            className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 shadow cursor-pointer"
            title="다운로드">
            <Download className="w-4 h-4 text-gray-800" />
          </button>
        ) : (
          <button className="w-8 h-8 bg-white/50 rounded-full flex items-center justify-center cursor-not-allowed" title="로그인 필요">
            <Lock className="w-4 h-4 text-gray-500" />
          </button>
        )}
        <button onClick={onDetail}
          className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 shadow cursor-pointer"
          title="상세 정보">
          <Info className="w-4 h-4 text-gray-800" />
        </button>
      </div>

      {/* Label */}
      <div className="p-1.5">
        <p className="text-[11px] font-medium truncate">{product.name}</p>
        {vendorName && <p className="text-[10px] text-muted-foreground truncate">{vendorName}</p>}
        {images.length > 1 && (
          <span className="text-[9px] text-muted-foreground">{images.length} patterns</span>
        )}
      </div>
    </div>
  )
}
