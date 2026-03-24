import { useEffect, useState, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { CategoryId } from '@/lib/categories'
import PreviewPanel from '@/components/PreviewPanel'
import {
  Search, ChevronRight, ChevronDown, ImageIcon, Heart, Folder, FolderOpen,
  X,
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
  const { user, userProfile } = useAuth()

  const { activeCategory } = useOutletContext<{ activeCategory: CategoryId }>()

  const [allVendors, setAllVendors] = useState<Vendor[]>([])
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([])

  // Vendor expand state (inline, no drill-down)
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null)
  const [vendorFolders, setVendorFolders] = useState<Record<string, FolderNode[]>>({})
  const [vendorTrees, setVendorTrees] = useState<Record<string, TreeNode[]>>({})

  const [selectedFolder, setSelectedFolder] = useState<FolderNode | null>(null)
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [allFoldersForBreadcrumb, setAllFoldersForBreadcrumb] = useState<FolderNode[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [products, setProducts] = useState<Product[]>([])
  const [productImages, setProductImages] = useState<Record<string, ProductImage[]>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<(Product & { vendor_name: string })[] | null>(null)

  const [previewProduct, setPreviewProduct] = useState<Product | null>(null)
  const [previewImages, setPreviewImages] = useState<ProductImage[]>([])
  const [previewVendor, setPreviewVendor] = useState('')
  const [previewSizeStr, setPreviewSizeStr] = useState('')

  // Favorites
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [showFavorites, setShowFavorites] = useState(false)
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([])

  // Filters
  const [filterMinPrice, setFilterMinPrice] = useState('')
  const [filterMaxPrice, setFilterMaxPrice] = useState('')
  const [filterMinStock, setFilterMinStock] = useState('')
  const [filterOrigins, setFilterOrigins] = useState<Set<string>>(new Set())

  // Login popup
  const [showLoginPopup, setShowLoginPopup] = useState(false)

  // Download count for button
  const maxDownloads = 5
  const remaining = maxDownloads // TODO: track actual usage

  // Fetch vendors + roots
  useEffect(() => {
    const fetchAll = async () => {
      const { data } = await supabase.from('vendors').select('*').eq('approved', true).order('company_name')
      setAllVendors((data as Vendor[]) || [])
    }
    fetchAll()
  }, [])

  // Fetch favorites
  useEffect(() => {
    if (!userProfile) return
    const fetchFavs = async () => {
      const { data } = await supabase.from('favorites')
        .select('product_id')
        .eq('user_id', userProfile.id)
        .eq('category', activeCategory)
      if (data) setFavoriteIds(new Set(data.map((f: { product_id: string }) => f.product_id)))
    }
    fetchFavs()
  }, [userProfile, activeCategory])

  // Filter vendors by category (direct match on vendor.category)
  useEffect(() => {
    setFilteredVendors(allVendors.filter(v => v.category === activeCategory))
    setExpandedVendorId(null)
    setSelectedVendor(null)
    setSelectedFolder(null)
    setProducts([])
    setProductImages({})
    setSearchResults(null)
    setShowFavorites(false)
  }, [activeCategory, allVendors])

  // Toggle vendor expand
  const handleToggleVendor = async (vendor: Vendor) => {
    if (expandedVendorId === vendor.id) {
      setExpandedVendorId(null)
      return
    }
    setExpandedVendorId(vendor.id)
    setSelectedVendor(vendor)

    if (!vendorFolders[vendor.id]) {
      const { data } = await supabase.from('folder_nodes').select('*').eq('vendor_id', vendor.id).order('sort_order')
      const f = (data as FolderNode[]) || []
      setVendorFolders(prev => ({ ...prev, [vendor.id]: f }))
      setVendorTrees(prev => ({
        ...prev,
        [vendor.id]: buildTree(f, null)
      }))
      setExpandedIds(new Set(f.map(n => n.id)))
    }
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

  const handleSelectFolder = (node: FolderNode, vendor: Vendor) => {
    const allFolders = vendorFolders[vendor.id] || []
    const isLeaf = !allFolders.some(f => f.parent_id === node.id)
    if (isLeaf) {
      setSelectedFolder(node)
      setSelectedVendor(vendor)
      setAllFoldersForBreadcrumb(vendorFolders[vendor.id] || [])
      setSearchResults(null)
      setShowFavorites(false)
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
      const results = data
        .filter((p: Record<string, unknown>) => (p.vendors as Record<string, unknown>)?.approved)
        .map((p: Record<string, unknown>) => ({
          ...(p as unknown as Product),
          vendor_name: ((p.vendors as Record<string, unknown>).company_name as string),
        }))
      setSearchResults(results)
    }
    setSelectedFolder(null)
    setShowFavorites(false)
  }

  const handleSelectProduct = (product: Product, vendorName?: string) => {
    const imgs = productImages[product.id] || []
    if (imgs.length === 0) return
    const vName = vendorName || selectedVendor?.company_name || ''
    setPreviewProduct(product)
    setPreviewImages(imgs)
    setPreviewVendor(vName)
    // Extract WxH from product size (e.g., "600x1200x9" → "600x1200")
    const rawSize = product.size || ''
    const sizeMatch = rawSize.match(/(\d+)\s*[x×*]\s*(\d+)/)
    setPreviewSizeStr(sizeMatch ? `${sizeMatch[1]}x${sizeMatch[2]}` : '600x600')
  }

  const handleInsert = (dataUrl: string, vendor: string, tileName: string, sizeStr: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sk = (window as any).sketchup as Record<string, (...args: string[]) => void> | undefined
    if (sk?.insert_material) {
      sk.insert_material(dataUrl, vendor, tileName, sizeStr)
    } else {
      alert('SketchUp 환경에서만 사용 가능합니다.')
    }
  }

  // Favorites
  const toggleFavorite = async (productId: string) => {
    if (!userProfile) return
    if (favoriteIds.has(productId)) {
      await supabase.from('favorites').delete()
        .eq('user_id', userProfile.id).eq('product_id', productId)
      setFavoriteIds(prev => { const n = new Set(prev); n.delete(productId); return n })
    } else {
      await supabase.from('favorites').insert({
        user_id: userProfile.id,
        product_id: productId,
        category: activeCategory,
      })
      setFavoriteIds(prev => new Set(prev).add(productId))
    }
  }

  const handleShowFavorites = async () => {
    if (!userProfile) return
    setShowFavorites(true)
    setSelectedFolder(null)
    setSearchResults(null)
    const { data: favs } = await supabase.from('favorites')
      .select('product_id').eq('user_id', userProfile.id).eq('category', activeCategory)
    if (favs && favs.length > 0) {
      const ids = favs.map((f: { product_id: string }) => f.product_id)
      const { data: prods } = await supabase.from('products').select('*, vendors(company_name)').in('id', ids)
      const prodsWithVendor = (prods || []).map((p: Record<string, unknown>) => ({
        ...(p as unknown as Product),
        _vendorName: ((p.vendors as Record<string, unknown>)?.company_name as string) || '',
      }))
      setFavoriteProducts(prodsWithVendor as Product[])
      // Fetch images
      const { data: imgData } = await supabase.from('product_images').select('*')
        .in('product_id', ids).order('sort_order')
      const images = (imgData as ProductImage[]) || []
      const grouped: Record<string, ProductImage[]> = {}
      for (const img of images) {
        if (!grouped[img.product_id]) grouped[img.product_id] = []
        grouped[img.product_id].push(img)
      }
      setProductImages(prev => ({ ...prev, ...grouped }))
      setProducts([] ) // clear regular products
    } else {
      setFavoriteProducts([])
    }
  }

  // Folder tree node
  const renderNode = (node: TreeNode, level: number, vendor: Vendor) => {
    const isExpanded = expandedIds.has(node.id)
    const isSelected = selectedFolder?.id === node.id
    return (
      <div key={node.id}>
        <button
          onClick={() => handleSelectFolder(node, vendor)}
          className={`flex items-center gap-1.5 py-[3px] w-full text-left text-[10px] cursor-pointer ${
            isSelected ? 'font-semibold text-foreground' : 'text-text-secondary hover:text-foreground'
          }`}
          style={{ paddingLeft: `${level * 12 + 24}px`, paddingRight: '8px' }}
        >
          {node.children.length > 0 ? (
            isExpanded ? <ChevronDown className="w-2.5 h-2.5 shrink-0 opacity-30" />
              : <ChevronRight className="w-2.5 h-2.5 shrink-0 opacity-30" />
          ) : <span className="w-2.5 shrink-0" />}
          {node.children.length === 0
            ? <FolderOpen className="w-3.5 h-3.5 shrink-0 opacity-50" />
            : <Folder className="w-3.5 h-3.5 shrink-0 opacity-50" />}
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children.map(child => renderNode(child, level + 1, vendor))}
      </div>
    )
  }

  // Collect unique origins from current product set
  const baseProducts = showFavorites ? favoriteProducts : products
  const availableOrigins = [...new Set(baseProducts.map(p => p.origin).filter((o): o is string => !!o))].sort()

  // Apply filters
  const displayProducts = baseProducts.filter(p => {
    if (filterMinPrice) {
      const min = Number(filterMinPrice)
      if (!isNaN(min) && (p.unit_price == null || p.unit_price < min)) return false
    }
    if (filterMaxPrice) {
      const max = Number(filterMaxPrice)
      if (!isNaN(max) && (p.unit_price == null || p.unit_price > max)) return false
    }
    if (filterMinStock) {
      const minS = Number(filterMinStock)
      if (!isNaN(minS) && (p.stock == null || p.stock < minS)) return false
    }
    if (filterOrigins.size > 0 && (!p.origin || !filterOrigins.has(p.origin))) return false
    return true
  })

  const hasActiveFilter = !!(filterMinPrice || filterMaxPrice || filterMinStock || filterOrigins.size > 0)

  const clearFilters = () => {
    setFilterMinPrice('')
    setFilterMaxPrice('')
    setFilterMinStock('')
    setFilterOrigins(new Set())
  }

  return (
    <div className="flex" style={{ height: 'calc(100vh - 60px - 24px)' }}>
      {/* ── Sidebar ── */}
      <div className="w-[190px] bg-surface border-r flex flex-col shrink-0">
        <div className="p-2.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search"
              className="w-full h-[26px] text-[10px] pl-6 pr-2 bg-muted border border-border rounded-[4px] outline-none placeholder:text-text-tertiary focus:border-foreground" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-1 pb-1 flex flex-col">
          {/* Favorites — always visible */}
          {user && (
            <button onClick={handleShowFavorites}
              className={`flex items-center gap-1.5 w-full text-left px-2.5 py-[5px] text-[10px] cursor-pointer rounded-sm mb-1 ${
                showFavorites ? 'font-semibold text-foreground bg-muted' : 'text-text-secondary hover:text-foreground'
              }`}>
              <Heart className={`w-3 h-3 ${showFavorites ? 'fill-current' : ''}`} />
              <span>Favorites</span>
              {favoriteIds.size > 0 && (
                <span className="text-[8px] text-text-tertiary ml-auto">{favoriteIds.size}</span>
              )}
            </button>
          )}

          {selectedVendor ? (
            /* Vendor drill-down */
            <>
              {/* Vendor name + back on same row */}
              <div className="flex items-center justify-between px-2.5 pt-1 pb-2">
                <span className="text-[11px] font-bold">{selectedVendor.company_name}</span>
                <button onClick={() => { setSelectedVendor(null); setExpandedVendorId(null); setSelectedFolder(null); setProducts([]); setShowFavorites(false) }}
                  className="text-[9px] text-text-tertiary hover:text-foreground cursor-pointer">
                  ← Back
                </button>
              </div>

              <div className="flex-1 overflow-y-auto" style={{ animation: 'slideDown 0.25s ease-out' }}>
                {vendorTrees[selectedVendor.id] && vendorTrees[selectedVendor.id].length > 0
                  ? vendorTrees[selectedVendor.id].map(n => renderNode(n, 0, selectedVendor!))
                  : <p className="text-[10px] text-text-tertiary px-2 py-4 text-center">No folders</p>
                }
              </div>
            </>
          ) : (
            /* Vendor list */
            <>
              {filteredVendors.map(v => (
                <button key={v.id} onClick={() => handleToggleVendor(v)}
                  className="flex items-center w-full text-left px-2.5 py-[7px] text-[11px] font-semibold text-text-secondary hover:text-foreground cursor-pointer rounded-sm">
                  <span className="truncate">{v.company_name}</span>
                </button>
              ))}
              {filteredVendors.length === 0 && (
                <p className="text-[10px] text-text-tertiary px-2 py-4 text-center">No vendors</p>
              )}
            </>
          )}
        </div>

        <div className="border-t" />

        <div className="h-[58%] shrink-0">
          <PreviewPanel
            images={previewImages}
            sizeStr={previewSizeStr}
            vendorName={previewVendor}
            tileName={previewProduct?.name || ''}
            product={previewProduct}
            vendor={selectedVendor}
            remaining={remaining}
            maxDownloads={maxDownloads}
            loggedIn={!!user}
            onInsertRequest={handleInsert}
            onLoginRequest={() => setShowLoginPopup(true)}
          />
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Vendor Banner — full width, outside scroll */}
        {selectedVendor && !searchResults && !showFavorites && (
          <VendorBanner vendor={selectedVendor} />
        )}

        {/* Filter bar — single row */}
        {selectedVendor && !searchResults && (
          <div className="px-5 py-1.5 border-b bg-surface shrink-0 flex items-center gap-3">
            {/* 단가 */}
            <span className="text-[9px] text-text-tertiary whitespace-nowrap">단가</span>
            <input
              type="number" placeholder="최소" value={filterMinPrice}
              onChange={e => setFilterMinPrice(e.target.value)}
              className="w-[60px] h-[20px] text-[10px] px-1.5 bg-muted border border-border rounded-[3px] outline-none focus:border-foreground"
            />
            <span className="text-[8px] text-text-tertiary">~</span>
            <input
              type="number" placeholder="최대" value={filterMaxPrice}
              onChange={e => setFilterMaxPrice(e.target.value)}
              className="w-[60px] h-[20px] text-[10px] px-1.5 bg-muted border border-border rounded-[3px] outline-none focus:border-foreground"
            />

            <div className="w-px h-3 bg-border" />

            {/* 재고 */}
            <span className="text-[9px] text-text-tertiary whitespace-nowrap">재고</span>
            <input
              type="number" placeholder="min" value={filterMinStock}
              onChange={e => setFilterMinStock(e.target.value)}
              className="w-[50px] h-[20px] text-[10px] px-1.5 bg-muted border border-border rounded-[3px] outline-none focus:border-foreground"
            />
            <span className="text-[8px] text-text-tertiary">이상</span>

            <div className="w-px h-3 bg-border" />

            {/* 원산지 */}
            <OriginDropdown
              origins={availableOrigins}
              selected={filterOrigins}
              onChange={setFilterOrigins}
            />

            {/* 토글 ON/OFF */}
            <button
              onClick={() => { if (hasActiveFilter) clearFilters() }}
              className={`ml-auto flex items-center gap-1 cursor-pointer transition-colors ${
                hasActiveFilter ? 'text-foreground' : 'text-text-tertiary'
              }`}
              title={hasActiveFilter ? '필터 초기화' : ''}
            >
              {hasActiveFilter && (
                <>
                  <span className="text-[9px]">{displayProducts.length}개</span>
                  <X className="w-3 h-3 hover:text-foreground" />
                </>
              )}
            </button>
          </div>
        )}

        {(selectedFolder || searchResults !== null || showFavorites) && (
          <div className="px-5 py-2 border-b bg-surface flex items-center justify-between shrink-0">
            {showFavorites ? (
              <span className="text-[10px] text-text-secondary flex items-center gap-1">
                <Heart className="w-3 h-3 fill-current" /> Favorites — {favoriteProducts.length} items
              </span>
            ) : searchResults !== null ? (
              <>
                <span className="text-[10px] text-text-secondary">
                  "<span className="text-foreground font-semibold">{searchQuery}</span>" — {searchResults.length} items
                </span>
                <button onClick={() => setSearchResults(null)}
                  className="text-[10px] text-text-tertiary hover:text-foreground cursor-pointer font-semibold">Clear</button>
              </>
            ) : selectedFolder && (
              <div className="flex items-center gap-1.5 text-[10px]">
                {selectedVendor && (
                  <>
                    <span className="text-text-tertiary">{selectedVendor.company_name}</span>
                    <ChevronRight className="w-3 h-3 text-text-tertiary opacity-40" />
                  </>
                )}
                {getBreadcrumb(allFoldersForBreadcrumb, selectedFolder.id).map((f, i, arr) => (
                  <span key={f.id} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRight className="w-3 h-3 text-text-tertiary opacity-40" />}
                    <span className={i === arr.length - 1 ? 'font-semibold text-foreground' : 'text-text-secondary'}>{f.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {(searchResults !== null || showFavorites || selectedFolder) ? (
            (searchResults || displayProducts).length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-[11px] text-text-tertiary">No materials found</p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-4">
                {(searchResults || displayProducts).map((p, i) => (
                  <MaterialItem key={p.id} product={p}
                    onClick={() => handleSelectProduct(p, 'vendor_name' in p ? (p as Product & { vendor_name: string }).vendor_name : undefined)}
                    selected={previewProduct?.id === p.id}
                    isFavorite={favoriteIds.has(p.id)}
                    onToggleFavorite={() => toggleFavorite(p.id)}
                    loggedIn={!!user}
                    vendorPrefix={showFavorites ? (selectedVendor?.company_name || '') : undefined}
                    animationDelay={i * 0.03} />
                ))}
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[11px] text-text-tertiary">Select a vendor and folder</p>
            </div>
          )}

        </div>
      </div>

      {/* Login Popup */}
      {showLoginPopup && (
        <LoginPopup
          onClose={() => setShowLoginPopup(false)}
        />
      )}
    </div>
  )
}

function LoginPopup({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState('')

  const handleGoogle = async () => {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/' },
    })
    if (error) setError('로그인 중 오류가 발생했습니다.')
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] bg-surface border border-border rounded-[8px] p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
        <h3 className="text-[13px] font-bold mb-1">로그인</h3>
        <p className="text-[10px] text-muted-foreground mb-5">마감재를 적용하려면 로그인이 필요합니다</p>
        <button
          onClick={handleGoogle}
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
        {error && <p className="text-[10px] text-destructive mt-2">{error}</p>}
      </div>
    </>
  )
}

function VendorBanner({ vendor }: { vendor: Vendor }) {
  const [showContactPopup, setShowContactPopup] = useState(false)
  const desc = vendor.description || `${vendor.company_name}은(는) 고품질 마감재를 공급하는 전문 업체입니다.`
  const website = vendor.website_url || 'https://example.com'
  const insta = vendor.instagram || 'blackmagician'

  return (
    <div className="shrink-0 text-white relative overflow-hidden" style={{ animation: 'fadeIn 0.3s ease-out',
      background: vendor.logo_url
        ? undefined
        : 'linear-gradient(135deg, #2a2a2a, #3a3a3a, #4a4a4a)',
    }}>
      {vendor.logo_url && (
        <>
          <img src={vendor.logo_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50" />
        </>
      )}
      <div className="relative flex items-center justify-between px-6 py-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-[20px] font-bold tracking-[0.3px] mb-2">{vendor.company_name}</h2>
          <p className="text-[11px] text-white/60 leading-[1.7] max-w-[400px]">{desc}</p>
        </div>
        <div className="shrink-0 flex flex-col gap-1.5">
          {website && (
            <a href={website} target="_blank" rel="noopener noreferrer"
              className="h-[24px] px-3 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-[4px] text-[9px] text-white/70 hover:text-white transition-colors cursor-pointer">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              Website
            </a>
          )}
          {insta && (
            <a href={`https://instagram.com/${insta.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
              className="h-[24px] px-3 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-[4px] text-[9px] text-white/70 hover:text-white transition-colors cursor-pointer">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/>
              </svg>
              Instagram
            </a>
          )}
          <button
            onClick={() => setShowContactPopup(true)}
            className="h-[24px] px-3 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-[4px] text-[9px] text-white/70 hover:text-white transition-colors cursor-pointer">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            Contact
          </button>
        </div>
      </div>

      {/* Contact popup */}
      {showContactPopup && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowContactPopup(false)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] bg-surface border border-border rounded-[8px] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h3 className="text-[12px] font-bold mb-3 text-foreground">{vendor.company_name}</h3>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#999]">담당자</span>
                <span className="font-medium text-foreground">{vendor.contact_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#999]">연락처</span>
                <span className="font-medium text-foreground">{vendor.contact_phone}</span>
              </div>
              {vendor.address && (
                <div className="flex justify-between">
                  <span className="text-[#999]">주소</span>
                  <span className="font-medium text-foreground text-right max-w-[140px]">{vendor.address}</span>
                </div>
              )}
            </div>
            <button onClick={() => setShowContactPopup(false)}
              className="w-full h-[28px] mt-4 border border-[rgba(0,0,0,0.1)] rounded-[4px] text-[10px] font-semibold text-foreground cursor-pointer hover:bg-[rgba(0,0,0,0.03)]">
              닫기
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function OriginDropdown({ origins, selected, onChange }: {
  origins: string[]
  selected: Set<string>
  onChange: (s: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)

  const toggle = (origin: string) => {
    const next = new Set(selected)
    if (next.has(origin)) next.delete(origin); else next.add(origin)
    onChange(next)
  }

  return (
    <div className="relative flex items-center gap-1.5">
      <span className="text-[9px] text-text-tertiary whitespace-nowrap">원산지</span>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="h-[22px] min-w-[80px] px-2 text-[10px] text-left bg-muted border border-border rounded-[3px] cursor-pointer flex items-center justify-between gap-1 hover:border-foreground"
      >
        <span className="truncate">
          {selected.size === 0 ? '전체' : `${selected.size}개 선택`}
        </span>
        <ChevronDown className="w-2.5 h-2.5 shrink-0 opacity-50" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-40 bg-surface border border-border rounded-[4px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] max-h-[200px] overflow-y-auto min-w-[120px]"
            style={{ animation: 'slideDown 0.15s ease-out' }}>
            {origins.length === 0 ? (
              <p className="text-[9px] text-text-tertiary px-3 py-2">데이터 없음</p>
            ) : (
              origins.map(o => (
                <label key={o} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted cursor-pointer text-[10px]">
                  <input
                    type="checkbox" checked={selected.has(o)}
                    onChange={() => toggle(o)}
                    className="w-3 h-3 accent-foreground cursor-pointer"
                  />
                  <span>{o}</span>
                </label>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

function MaterialItem({ product, onClick, selected, isFavorite, onToggleFavorite, loggedIn, vendorPrefix, animationDelay }: {
  product: Product
  onClick: () => void
  selected: boolean
  isFavorite: boolean
  onToggleFavorite: () => void
  loggedIn: boolean
  vendorPrefix?: string
  animationDelay?: number
}) {
  return (
    <div
      className="group cursor-pointer"
      onClick={onClick}
      style={animationDelay !== undefined ? { animation: `fadeInUp 0.25s ease-out ${animationDelay}s both` } : undefined}
    >
      <div className="aspect-square rounded-[3px] overflow-hidden relative hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-shadow duration-200">
        {product.thumbnail_url ? (
          <img src={product.thumbnail_url} alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            loading="lazy" />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-text-tertiary opacity-30" />
          </div>
        )}

        {/* Favorite heart */}
        {loggedIn && (
          <button
            onClick={e => { e.stopPropagation(); onToggleFavorite() }}
            className={`absolute top-1.5 left-1.5 cursor-pointer transition-all drop-shadow-sm ${
              isFavorite
                ? 'text-[#FF6B8A] opacity-100'
                : 'text-white opacity-0 group-hover:opacity-70 hover:!opacity-100'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        )}
      </div>

      <div className="mt-1.5 px-0.5">
        <p className={`text-[10px] leading-[1.3] truncate text-center ${selected ? 'font-bold underline underline-offset-2' : 'font-medium'}`}>
          {Boolean(vendorPrefix || (product as Record<string, unknown>)._vendorName) && (
            <span className="text-[8px] text-muted-foreground font-normal mr-1">
              {String(vendorPrefix || (product as Record<string, unknown>)._vendorName || '')}
            </span>
          )}
          {product.name}
        </p>
      </div>
    </div>
  )
}
