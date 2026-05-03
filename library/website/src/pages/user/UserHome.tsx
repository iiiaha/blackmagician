import { useEffect, useState, useCallback, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { CategoryId } from '@/lib/categories'
import { COLOR_PALETTE, COLOR_GROUP_LABELS, type ColorGroup } from '@/lib/colors'
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

export default function UserHome() {
  const { user, userProfile, canApply, logApply, vendorMode } = useAuth()

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
  const [sidebarView, setSidebarView] = useState<'vendors' | 'folders'>('vendors')
  const sidebarContentRef = useRef<HTMLDivElement>(null)
  const [mainFade, setMainFade] = useState<'in' | 'out' | 'idle'>('idle')
  const [prevVendors, setPrevVendors] = useState<Vendor[]>([])
  const [catSliding, setCatSliding] = useState(false)
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
  const [filterColors, setFilterColors] = useState<Set<string>>(new Set())

  // Login popup
  const [showLoginPopup, setShowLoginPopup] = useState(false)


  // Fetch vendors + roots
  useEffect(() => {
    const fetchAll = async () => {
      const { data: rawData } = await supabase.from('vendors').select('*').eq('approved', true)
      const data = ((rawData as Vendor[]) || []).slice().sort((a, b) =>
        ((a.sort_order ?? 0) - (b.sort_order ?? 0)) || a.company_name.localeCompare(b.company_name)
      )
      setAllVendors((data as Vendor[]) || [])
    }
    fetchAll()
  }, [])

  // Vendor mode: auto-select the vendor and load folders
  useEffect(() => {
    if (!vendorMode) return

    const autoSelect = async () => {
      const { data } = await supabase.from('vendors').select('*')
        .eq('slug', vendorMode).eq('approved', true).maybeSingle()
      if (!data) return
      const vendor = data as Vendor
      setSelectedVendor(vendor)
      setSidebarView('folders')
      setExpandedVendorId(vendor.id)

      const { data: folderData } = await supabase.from('folder_nodes').select('*')
        .eq('vendor_id', vendor.id).order('sort_order')
      const f = (folderData as FolderNode[]) || []
      setVendorFolders(prev => ({ ...prev, [vendor.id]: f }))
      setVendorTrees(prev => ({ ...prev, [vendor.id]: buildTree(f, null) }))
      setExpandedIds(new Set(f.map(n => n.id)))
    }
    autoSelect()
  }, [vendorMode])

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

  // Filter vendors by category (direct match on vendor.category) — skip in vendor mode
  useEffect(() => {
    if (vendorMode) return
    setPrevVendors(filteredVendors)
    setCatSliding(true)
    setFilteredVendors(allVendors.filter(v => v.category === activeCategory && !v.slug))
    setExpandedVendorId(null)
    setSelectedVendor(null)
    setSelectedFolder(null)
    setProducts([])
    setProductImages({})
    setSearchResults(null)
    setShowFavorites(false)
    setSidebarView('vendors')
    setTimeout(() => { setCatSliding(false); setPrevVendors([]) }, 200)
  }, [activeCategory, allVendors])


  // Toggle vendor expand
  const handleToggleVendor = async (vendor: Vendor) => {
    if (expandedVendorId === vendor.id) {
      setExpandedVendorId(null)
      return
    }
    setExpandedVendorId(vendor.id)
    setSelectedVendor(vendor)
    setSidebarView('folders')

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
    const { data } = await supabase.from('products').select('*').eq('folder_id', folderId)
    const prods = ((data as Product[]) || []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
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
    // Mapping size: source_size if set, else fall back to size (display 원장크기).
    // Extract WxH from "600x1200x9" → "600x1200".
    const rawSize = product.source_size || product.size || ''
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
  // Show only palette colors that some product in this folder actually has,
  // preserving palette order so the dropdown stays consistent.
  const presentColors = new Set(baseProducts.map(p => p.color).filter((c): c is string => !!c))
  const availableColors = COLOR_PALETTE.filter(c => presentColors.has(c.label))

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
    // Multi-select is OR: pass if product's single color is among picks.
    if (filterColors.size > 0 && (!p.color || !filterColors.has(p.color))) return false
    return true
  })

  const hasActiveFilter = !!(filterMinPrice || filterMaxPrice || filterMinStock || filterOrigins.size > 0 || filterColors.size > 0)

  const clearFilters = () => {
    setFilterMinPrice('')
    setFilterMaxPrice('')
    setFilterMinStock('')
    setFilterOrigins(new Set())
    setFilterColors(new Set())
  }

  return (
    <div className="flex" style={{ height: 'calc(100vh - 70px - 24px)' }}>
      {/* ── Sidebar ── */}
      <div className="w-[190px] bg-surface border-r flex flex-col shrink-0">
        <div className="p-2.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search"
              className="w-full h-[26px] text-[10px] pl-6 pr-2 bg-muted border border-border rounded-[4px] outline-none placeholder:text-text-tertiary focus:border-brand" />
          </div>
        </div>

        <div className="flex-1 overflow-hidden px-1 pb-1 flex flex-col">
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

          <div ref={sidebarContentRef} className="flex-1 relative overflow-hidden">
            {/* Previous vendor list (sliding out) */}
            {catSliding && prevVendors.length > 0 && (
              <div
                className="absolute inset-0 overflow-y-auto"
                style={{ animation: 'slideOutToRight 200ms ease-in forwards' }}
              >
                <div className="flex flex-col items-center gap-1.5 px-2 pt-1">
                  {prevVendors.map(v => (
                    <div key={v.id}
                      className="w-full h-[36px] text-[12px] font-medium tracking-normal text-center rounded-[5px] overflow-hidden relative uppercase flex items-center justify-center">
                      {v.logo_url ? (
                        <>
                          <img src={v.logo_url} alt="" className="absolute inset-0 w-full h-full object-cover blur-[2px] scale-[1.05]" />
                          <div className="absolute inset-0 vendor-overlay" />
                          <span className="relative vendor-text">{v.company_name}</span>
                        </>
                      ) : (
                        <span className="text-text-secondary border border-border rounded-[5px] w-full h-full flex items-center justify-center bg-muted">
                          {v.company_name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vendor list — hidden in vendor mode */}
            {!vendorMode && (
              <div
                className="absolute inset-0 overflow-y-auto transition-transform duration-250 ease-in-out"
                style={{
                  transform: sidebarView === 'vendors' ? 'translateX(0)' : 'translateX(-100%)',
                  animation: catSliding ? 'slideInFromLeft 200ms ease-out' : undefined,
                }}
              >
                <div className="flex flex-col items-center gap-1.5 px-2 pt-1">
                  {filteredVendors.map((v) => (
                    <button key={v.id} onClick={() => handleToggleVendor(v)}
                      className="w-full h-[36px] text-[12px] font-medium tracking-normal text-center cursor-pointer rounded-[5px] overflow-hidden relative transition-all duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.12)] group uppercase"
  >
                      {v.logo_url ? (
                        <>
                          <img src={v.logo_url} alt="" className="absolute inset-0 w-full h-full object-cover blur-[2px] scale-[1.05]" />
                          <div className="absolute inset-0 vendor-overlay transition-[background] duration-500 ease-in-out" />
                          <span className="relative vendor-text">{v.company_name}</span>
                        </>
                      ) : (
                        <span className="text-text-secondary border border-border rounded-[5px] w-full h-full flex items-center justify-center bg-muted hover:bg-accent">
                          {v.company_name}
                        </span>
                      )}
                    </button>
                  ))}
                  {filteredVendors.length === 0 && (
                    <p className="text-[10px] text-text-tertiary py-4 text-center">No vendors</p>
                  )}
                </div>
              </div>
            )}

            {/* Vendor folders */}
            <div
              className="absolute inset-0 overflow-y-auto transition-transform duration-250 ease-in-out"
              style={{ transform: (vendorMode || sidebarView === 'folders') ? 'translateX(0)' : 'translateX(100%)' }}
            >
              {selectedVendor && (
                <>
                  {!vendorMode && (
                    <div className="flex items-center justify-between px-2.5 pt-1 pb-2">
                      <span className="text-[11px] font-bold">{selectedVendor.company_name}</span>
                      <button onClick={() => {
                          setMainFade('out')
                          setSidebarView('vendors')
                          setTimeout(() => { setSelectedVendor(null); setExpandedVendorId(null); setSelectedFolder(null); setProducts([]); setShowFavorites(false); setMainFade('idle') }, 250)
                        }}
                        className="text-[9px] text-text-tertiary hover:text-foreground cursor-pointer">
                        ← Back
                      </button>
                    </div>
                  )}
                  <div>
                    {vendorTrees[selectedVendor.id] && vendorTrees[selectedVendor.id].length > 0
                      ? vendorTrees[selectedVendor.id].map(n => renderNode(n, 0, selectedVendor!))
                      : <p className="text-[10px] text-text-tertiary px-2 py-4 text-center">No folders</p>
                    }
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="border-t" />

        <div className="h-[58%] shrink-0">
          <PreviewPanel
            images={previewImages}
            sizeStr={previewSizeStr}
            vendorName={previewVendor}
            tileName={previewProduct?.name || ''}
            product={previewProduct}
            loggedIn={!!user || !!vendorMode}
            canApply={canApply}
            onInsertRequest={handleInsert}
            onLoginRequest={() => setShowLoginPopup(true)}
            onApplyLog={logApply}
          />
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Vendor content area — banner + filter + grid fade together */}
        <div
          className="flex-1 flex flex-col overflow-hidden"
          style={{
            animation: mainFade === 'out' ? 'fadeOut 150ms ease-in forwards' : undefined
          }}
        >
        {/* Vendor Banner — full width, outside scroll */}
        {selectedVendor && !vendorMode && (
          <VendorBanner vendor={selectedVendor} />
        )}

        {/* Filter bar — single row */}
        {selectedVendor && !searchResults && (
          <div className="px-5 py-1.5 border-b bg-surface shrink-0 flex items-center gap-3">
            {/* Filter indicator — always visible, lights up when active */}
            <span className={`inline-flex items-center gap-1.5 text-[8px] font-bold px-2 py-[3px] rounded-full whitespace-nowrap transition-all duration-300 ${
              hasActiveFilter
                ? 'text-[#1a1a1a] bg-[#e8e8e8] dark:text-[#e0e0e0] dark:bg-[#3a3a3a]'
                : 'text-text-secondary bg-muted'
            }`}>
              <span className={`inline-block w-[6px] h-[6px] rounded-full transition-all duration-300 ${
                hasActiveFilter
                  ? 'bg-brand-accent shadow-[0_0_5px_rgba(234,0,3,0.35)]'
                  : 'bg-text-tertiary/30 dark:bg-text-tertiary/50'
              }`} />
              FILTER
            </span>

            {/* 단가 */}
            <span className="text-[9px] text-text-tertiary whitespace-nowrap">단가</span>
            <input
              placeholder="최소" value={filterMinPrice}
              onChange={e => { const v = e.target.value; if (v === '' || /^\d*$/.test(v)) setFilterMinPrice(v) }}
              className="w-[60px] h-[20px] text-[10px] px-1.5 bg-muted border border-border rounded-[3px] outline-none focus:border-brand text-foreground placeholder:text-text-tertiary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[8px] text-text-tertiary">~</span>
            <input
              placeholder="최대" value={filterMaxPrice}
              onChange={e => { const v = e.target.value; if (v === '' || /^\d*$/.test(v)) setFilterMaxPrice(v) }}
              className="w-[60px] h-[20px] text-[10px] px-1.5 bg-muted border border-border rounded-[3px] outline-none focus:border-brand text-foreground placeholder:text-text-tertiary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />

            <div className="w-px h-3 bg-border" />

            {/* 재고 */}
            <span className="text-[9px] text-text-tertiary whitespace-nowrap">재고</span>
            <input
              placeholder="최소" value={filterMinStock}
              onChange={e => { const v = e.target.value; if (v === '' || /^\d*$/.test(v)) setFilterMinStock(v) }}
              className="w-[50px] h-[20px] text-[10px] px-1.5 bg-muted border border-border rounded-[3px] outline-none focus:border-brand text-foreground placeholder:text-text-tertiary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[8px] text-text-tertiary">㎡ 이상</span>

            <div className="w-px h-3 bg-border" />

            {/* 원산지 */}
            <OriginDropdown
              origins={availableOrigins}
              selected={filterOrigins}
              onChange={setFilterOrigins}
            />

            {availableColors.length > 0 && <div className="w-px h-3 bg-border" />}

            {/* 컬러 — grouped dropdown; 21 buckets won't fit inline */}
            {availableColors.length > 0 && (
              <ColorDropdown
                options={availableColors}
                selected={filterColors}
                onChange={setFilterColors}
              />
            )}

            {/* 초기화 + 결과 수 */}
            {hasActiveFilter && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[9px] text-text-tertiary">{displayProducts.length}개</span>
                <button onClick={clearFilters}
                  className="text-[9px] text-text-tertiary hover:text-foreground cursor-pointer flex items-center gap-0.5 px-1.5 py-0.5 rounded-[3px] border border-border hover:bg-muted">
                  <X className="w-2.5 h-2.5" /> 초기화
                </button>
              </div>
            )}
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
                {(searchResults || displayProducts).map((p) => (
                  <MaterialItem key={p.id} product={p}
                    onClick={() => handleSelectProduct(p, 'vendor_name' in p ? (p as Product & { vendor_name: string }).vendor_name : undefined)}
                    selected={previewProduct?.id === p.id}
                    isFavorite={favoriteIds.has(p.id)}
                    onToggleFavorite={() => toggleFavorite(p.id)}
                    loggedIn={!!user || !!vendorMode}
                    vendorPrefix={showFavorites ? (selectedVendor?.company_name || '') : undefined}
                    animationDelay={0} />
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
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] rounded-[12px] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
        {/* Hero section */}
        <div className="relative px-6 pt-8 pb-6 text-center overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #49637a 0%, #3a5269 50%, #2d4155 100%)' }}>
          {/* Subtle pattern overlay */}
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
            onClick={handleGoogle}
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
          {error && <p className="text-[10px] text-destructive mt-2">{error}</p>}
          <button onClick={onClose}
            className="w-full mt-3 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer py-1">
            취소
          </button>
        </div>
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
    <div className="shrink-0 text-white relative overflow-hidden" style={{
      background: vendor.logo_url
        ? undefined
        : 'linear-gradient(135deg, #2a2a2a, #3a3a3a, #4a4a4a)',
    }}>
      {vendor.logo_url && (
        <>
          <img src={vendor.logo_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/[0.05] dark:bg-black/[0.35]" />
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
            style={{ animation: 'fadeIn 0.15s ease-out' }}>
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

function ColorDropdown({ options, selected, onChange }: {
  options: { label: string; hex: string; group: ColorGroup }[]
  selected: Set<string>
  onChange: (s: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)

  const toggle = (label: string) => {
    const next = new Set(selected)
    if (next.has(label)) next.delete(label); else next.add(label)
    onChange(next)
  }

  // Group options preserving palette order within each group.
  const grouped = (['neutral', 'warm', 'green', 'cool'] as ColorGroup[])
    .map(g => ({ group: g, items: options.filter(o => o.group === g) }))
    .filter(g => g.items.length > 0)

  // Selected swatches preview (max 4) — gives a hint of what's picked
  // without expanding the dropdown.
  const previewSwatches = options.filter(o => selected.has(o.label)).slice(0, 4)

  return (
    <div className="relative flex items-center gap-1.5">
      <span className="text-[9px] text-text-tertiary whitespace-nowrap">컬러</span>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="h-[22px] min-w-[80px] px-2 text-[10px] text-left bg-muted border border-border rounded-[3px] cursor-pointer flex items-center justify-between gap-1.5 hover:border-foreground"
      >
        {selected.size === 0 ? (
          <span className="truncate">전체</span>
        ) : (
          <span className="flex items-center gap-1 truncate">
            <span className="flex items-center gap-[2px]">
              {previewSwatches.map(s => (
                <span key={s.label} className="w-[10px] h-[10px] rounded-full border border-[rgba(0,0,0,0.1)]"
                  style={{ background: s.hex }} />
              ))}
            </span>
            <span>{selected.size}개</span>
          </span>
        )}
        <ChevronDown className="w-2.5 h-2.5 shrink-0 opacity-50" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-40 bg-surface border border-border rounded-[4px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] max-h-[320px] overflow-y-auto min-w-[160px]"
            style={{ animation: 'fadeIn 0.15s ease-out' }}>
            {grouped.map(({ group, items }) => (
              <div key={group}>
                <div className="px-3 pt-2 pb-1 text-[8px] font-bold tracking-[0.5px] uppercase text-text-tertiary">
                  {COLOR_GROUP_LABELS[group]}
                </div>
                {items.map(o => (
                  <label key={o.label} className="flex items-center gap-2 px-3 py-1 hover:bg-muted cursor-pointer text-[10px]">
                    <input
                      type="checkbox" checked={selected.has(o.label)}
                      onChange={() => toggle(o.label)}
                      className="w-3 h-3 accent-foreground cursor-pointer"
                    />
                    <span className="w-3 h-3 rounded-full border border-border shrink-0" style={{ background: o.hex }} />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            ))}
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
      style={animationDelay !== undefined ? { animation: `fadeIn 0.2s ease-out ${animationDelay}s both` } : undefined}
    >
      <div className="aspect-square rounded-[3px] overflow-hidden relative hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-shadow duration-200">
        {product.thumbnail_url ? (
          product.thumbnail_zoom
            ? <ZoomedThumb url={product.thumbnail_url} alt={product.name} />
            : <RetryImg url={product.thumbnail_url} alt={product.name}
                className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]" />
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
                ? 'text-[#34d399] opacity-100'
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

// Lazy <img> with auto-retry on failure. Browsers leave the broken icon
// stuck once a request fails — adding a cache-busting param forces a
// fresh fetch instead of replaying the cached failure.
function RetryImg({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const [retry, setRetry] = useState(0)
  const src = retry > 0 ? `${url}${url.includes('?') ? '&' : '?'}_r=${retry}` : url
  return (
    <img src={src} alt={alt} loading="lazy" className={className}
      onError={() => { if (retry < 3) setTimeout(() => setRetry(r => r + 1), 500 * (retry + 1)) }} />
  )
}

// Crops the center 100×100 natural pixels of the source image and scales to fill container.
// Used when product.thumbnail_zoom is true — small mapping textures shown at usable size.
// Reads natural dims from the rendered <img> itself so loading="lazy" can throttle
// off-screen requests; pre-loading via `new Image()` would bypass that and flood
// the browser with parallel fetches when a folder has hundreds of products.
function ZoomedThumb({ url, alt }: { url: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [scale, setScale] = useState(1)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!ref.current) return
    const compute = () => {
      const w = ref.current?.clientWidth || 0
      // 100 natural px should span the container width.
      setScale(w / 100)
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const src = retry > 0 ? `${url}${url.includes('?') ? '&' : '?'}_r=${retry}` : url

  return (
    <div ref={ref} className="w-full h-full overflow-hidden relative bg-muted">
      <img ref={imgRef} src={src} alt={alt} loading="lazy"
        onLoad={() => {
          const img = imgRef.current
          if (img) setNatural({ w: img.naturalWidth, h: img.naturalHeight })
        }}
        onError={() => { if (retry < 3) setTimeout(() => setRetry(r => r + 1), 500 * (retry + 1)) }}
        style={natural ? {
          position: 'absolute',
          top: '50%', left: '50%',
          width: natural.w, height: natural.h,
          maxWidth: 'none', maxHeight: 'none',
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center',
          imageRendering: 'auto',
        } : { width: '100%', height: '100%', objectFit: 'cover', opacity: 0 }}
        className="transition-transform duration-300 ease-out"
      />
    </div>
  )
}
