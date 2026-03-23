import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import PreviewPanel from '@/components/PreviewPanel'
import {
  Search, ChevronRight, ChevronDown, ChevronLeft,
  Download, Info, ImageIcon, Lock,
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

  // Folder tree node
  const renderNode = (node: TreeNode, level: number) => {
    const isExpanded = expandedIds.has(node.id)
    const isSelected = selectedFolder?.id === node.id
    return (
      <div key={node.id}>
        <button
          onClick={() => handleSelectFolder(node)}
          className={`flex items-center gap-1.5 py-[5px] w-full text-left text-[11px] cursor-pointer transition-all ${
            isSelected
              ? 'font-semibold text-foreground'
              : 'text-text-secondary hover:text-foreground'
          }`}
          style={{ paddingLeft: `${level * 14 + 12}px`, paddingRight: '12px' }}
        >
          {node.children.length > 0 || !node.is_leaf ? (
            isExpanded
              ? <ChevronDown className="w-3 h-3 shrink-0 opacity-30" />
              : <ChevronRight className="w-3 h-3 shrink-0 opacity-30" />
          ) : <span className="w-3 shrink-0" />}
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children.map(child => renderNode(child, level + 1))}
      </div>
    )
  }

  return (
    <div className="flex" style={{ height: 'calc(100vh - 42px)' }}>
      {/* ── Sidebar ── */}
      <div className="w-[240px] bg-white border-r flex flex-col shrink-0">
        {/* Search */}
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-[10px] top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search materials"
              className="w-full h-[28px] text-[11px] pl-7 pr-3 bg-[rgba(0,0,0,0.02)] border border-border rounded-[4px] outline-none placeholder:text-text-tertiary focus:border-foreground focus:shadow-[0_0_0_2px_rgba(26,26,26,0.08)]"
            />
          </div>
        </div>

        {/* Folder tree */}
        <div className="flex-1 overflow-y-auto">
          {selectedVendor ? (
            <div className="pb-3">
              <button onClick={() => { setSelectedVendor(null); setSelectedFolder(null); setProducts([]); setFolders([]) }}
                className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-foreground px-3 py-1 cursor-pointer">
                <ChevronLeft className="w-3 h-3" />
                Back
              </button>
              <div className="px-3 pt-1 pb-2">
                <span className="text-[12px] font-bold">{selectedVendor.company_name}</span>
              </div>
              {folderTree.length > 0 ? folderTree.map(n => renderNode(n, 0)) : (
                <p className="text-[10px] text-text-tertiary px-3 py-6 text-center">No folders</p>
              )}
            </div>
          ) : (
            <div className="pb-3">
              <div className="px-3 py-2">
                <span className="text-[9px] font-semibold text-text-secondary uppercase tracking-[0.5px]">Vendors</span>
              </div>
              {vendors.map(v => (
                <button key={v.id} onClick={() => handleSelectVendor(v)}
                  className="flex items-center w-full text-left px-3 py-[6px] text-[11px] text-foreground hover:bg-[rgba(0,0,0,0.02)] cursor-pointer">
                  {v.company_name}
                </button>
              ))}
              {vendors.length === 0 && (
                <p className="text-[10px] text-text-tertiary px-3 py-8 text-center">No vendors</p>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Preview Panel */}
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
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Breadcrumb */}
        {(selectedFolder || searchResults !== null) && (
          <div className="px-4 py-2 border-b bg-white flex items-center justify-between shrink-0">
            {searchResults !== null ? (
              <>
                <span className="text-[10px] text-text-secondary">
                  Results for "<span className="text-foreground font-semibold">{searchQuery}</span>" — {searchResults.length} items
                </span>
                <button onClick={() => setSearchResults(null)}
                  className="text-[10px] text-text-tertiary hover:text-foreground cursor-pointer uppercase tracking-[0.3px] font-semibold">
                  Clear
                </button>
              </>
            ) : selectedFolder && (
              <div className="flex items-center gap-1 text-[10px]">
                {selectedVendor && (
                  <>
                    <span className="text-text-tertiary">{selectedVendor.company_name}</span>
                    <ChevronRight className="w-3 h-3 text-text-tertiary opacity-40" />
                  </>
                )}
                {getBreadcrumb(folders, selectedFolder.id).map((f, i, arr) => (
                  <span key={f.id} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="w-3 h-3 text-text-tertiary opacity-40" />}
                    <span className={i === arr.length - 1 ? 'font-semibold text-foreground' : 'text-text-secondary'}>
                      {f.name}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {searchResults !== null ? (
            searchResults.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-1">
                {searchResults.map(p => (
                  <MaterialItem key={p.id} product={p} images={[]}
                    onDownload={() => handleDownload(p, p.vendor_name)}
                    onDetail={() => setDetailProduct(p)}
                    loggedIn={!!user}
                    selected={previewProduct?.id === p.id} />
                ))}
              </div>
            )
          ) : selectedFolder ? (
            products.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-1">
                {products.map((p, i) => (
                  <MaterialItem key={p.id} product={p} images={productImages[p.id] || []}
                    onDownload={() => handleDownload(p)}
                    onDetail={() => setDetailProduct(p)}
                    loggedIn={!!user}
                    selected={previewProduct?.id === p.id}
                    animationDelay={i * 0.03} />
                ))}
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[11px] text-text-tertiary">Select a folder to browse materials</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Sidebar ── */}
      {detailProduct && (
        <div className="w-[200px] bg-white border-l shrink-0 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2.5 border-b">
            <span className="text-[9px] font-semibold uppercase tracking-[0.5px] text-text-secondary">Details</span>
            <button onClick={() => setDetailProduct(null)}
              className="text-[10px] text-text-tertiary hover:text-foreground cursor-pointer">
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <h3 className="text-[12px] font-bold mb-4 leading-snug">{detailProduct.name}</h3>
            <div className="space-y-3">
              {detailProduct.unit_price !== null && (
                <DetailRow label="PRICE" value={`${Number(detailProduct.unit_price).toLocaleString()}원`} />
              )}
              {detailProduct.stock !== null && (
                <DetailRow label="STOCK" value={`${detailProduct.stock}`} />
              )}
              {detailProduct.moq !== null && (
                <DetailRow label="MOQ" value={`${detailProduct.moq}`} />
              )}
              {detailProduct.lead_time && (
                <DetailRow label="LEAD TIME" value={detailProduct.lead_time} />
              )}
              {detailProduct.notes && (
                <div>
                  <span className="text-[9px] font-semibold text-text-secondary uppercase tracking-[0.5px]">Notes</span>
                  <p className="mt-1 text-[11px] text-text-secondary leading-relaxed">{detailProduct.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[9px] font-semibold text-text-secondary uppercase tracking-[0.5px]">{label}</span>
      <p className="text-[12px] font-semibold mt-0.5">{value}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-[11px] text-text-tertiary">No materials found</p>
    </div>
  )
}

// ── Material Item (Marbello-style tile card) ──
function MaterialItem({ product, images, onDownload, onDetail, loggedIn, selected, animationDelay }: {
  product: Product
  images: ProductImage[]
  onDownload: () => void
  onDetail: () => void
  loggedIn: boolean
  selected: boolean
  animationDelay?: number
}) {
  return (
    <div
      className="group relative cursor-pointer"
      style={animationDelay !== undefined ? {
        animation: `fadeInUp 0.25s ease-out ${animationDelay}s both`,
      } : undefined}
      onClick={onDetail}
    >
      {/* Image */}
      <div className={`aspect-square overflow-hidden mb-[6px] relative ${
        selected ? 'ring-[3px] ring-foreground' : ''
      }`}>
        {product.thumbnail_url ? (
          <img src={product.thumbnail_url} alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:scale-105"
            loading="lazy" />
        ) : (
          <div className="w-full h-full bg-[rgba(0,0,0,0.02)] flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-text-tertiary opacity-30" />
          </div>
        )}

        {/* Hover actions */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-[6px] right-[6px] flex gap-1">
            {loggedIn ? (
              <button onClick={(e) => { e.stopPropagation(); onDownload() }}
                className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm cursor-pointer hover:scale-110 transition-transform"
                title="Load to preview">
                <Download className="w-3 h-3 text-foreground" />
              </button>
            ) : (
              <div className="w-6 h-6 bg-white/50 rounded-full flex items-center justify-center" title="Login required">
                <Lock className="w-3 h-3 text-text-tertiary" />
              </div>
            )}
            <button onClick={(e) => { e.stopPropagation(); onDetail() }}
              className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm cursor-pointer hover:scale-110 transition-transform"
              title="Details">
              <Info className="w-3 h-3 text-foreground" />
            </button>
          </div>
        </div>

        {/* Pattern count */}
        {images.length > 1 && (
          <span className="absolute top-[4px] right-[4px] text-[8px] font-semibold text-white bg-black/50 px-[5px] py-[1px] rounded-sm">
            {images.length}
          </span>
        )}
      </div>

      {/* Name */}
      <div className="text-center px-1">
        <p className="text-[10px] leading-[1.3] truncate" style={{ letterSpacing: '-0.01em' }}>
          {product.name}
        </p>
      </div>
    </div>
  )
}
