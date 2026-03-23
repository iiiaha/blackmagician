import { useEffect, useState, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CATEGORIES, type CategoryId } from '@/lib/categories'
import PreviewPanel from '@/components/PreviewPanel'
import {
  Search, ChevronRight, ChevronDown, ImageIcon, Heart,
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
  const [allFolderRoots, setAllFolderRoots] = useState<FolderNode[]>([])
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

  // Download count for button
  const maxDownloads = 5
  const remaining = maxDownloads // TODO: track actual usage

  // Fetch vendors + roots
  useEffect(() => {
    const fetchAll = async () => {
      const [vendorsRes, rootsRes] = await Promise.all([
        supabase.from('vendors').select('*').eq('approved', true).order('company_name'),
        supabase.from('folder_nodes').select('*').eq('depth', 0),
      ])
      setAllVendors((vendorsRes.data as Vendor[]) || [])
      setAllFolderRoots((rootsRes.data as FolderNode[]) || [])
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

  // Filter vendors by category
  useEffect(() => {
    const cat = CATEGORIES.find(c => c.id === activeCategory)
    if (!cat) { setFilteredVendors(allVendors); return }
    const matchingVendorIds = new Set(
      allFolderRoots
        .filter(f => cat.folderNames.some(name => f.name.toLowerCase().includes(name.toLowerCase())))
        .map(f => f.vendor_id)
    )
    setFilteredVendors(allVendors.filter(v => matchingVendorIds.has(v.id)))
    setExpandedVendorId(null)
    setSelectedFolder(null)
    setProducts([])
    setProductImages({})
    setSearchResults(null)
    setShowFavorites(false)
  }, [activeCategory, allVendors, allFolderRoots])

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
      const cat = CATEGORIES.find(c => c.id === activeCategory)
      let filtered = f
      if (cat) {
        const categoryRoot = f.find(node =>
          node.depth === 0 && cat.folderNames.some(name => node.name.toLowerCase().includes(name.toLowerCase()))
        )
        if (categoryRoot) {
          const getDescendants = (parentId: string): FolderNode[] => {
            const children = f.filter(n => n.parent_id === parentId)
            return children.flatMap(c => [c, ...getDescendants(c.id)])
          }
          filtered = getDescendants(categoryRoot.id)
        }
      }
      setVendorFolders(prev => ({ ...prev, [vendor.id]: f }))
      setVendorTrees(prev => ({
        ...prev,
        [vendor.id]: buildTree(filtered, filtered[0]?.parent_id ?? null)
      }))
      setExpandedIds(new Set(filtered.map(n => n.id)))
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
    if (node.is_leaf) {
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
    if (!user) { alert('로그인 후 이용 가능합니다.'); return }
    const imgs = productImages[product.id] || []
    if (imgs.length === 0) return
    const vName = vendorName || selectedVendor?.company_name || ''
    const breadcrumb = selectedFolder ? getBreadcrumb(allFoldersForBreadcrumb, selectedFolder.id) : []
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
      const { data: prods } = await supabase.from('products').select('*').in('id', ids)
      setFavoriteProducts((prods as Product[]) || [])
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
          {node.children.length > 0 || !node.is_leaf ? (
            isExpanded ? <ChevronDown className="w-2.5 h-2.5 shrink-0 opacity-30" />
              : <ChevronRight className="w-2.5 h-2.5 shrink-0 opacity-30" />
          ) : <span className="w-2.5 shrink-0" />}
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children.map(child => renderNode(child, level + 1, vendor))}
      </div>
    )
  }

  const displayProducts = showFavorites ? favoriteProducts : products

  return (
    <div className="flex" style={{ height: 'calc(100vh - 52px - 24px)' }}>
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

        <div className="flex-1 overflow-y-auto px-1 pb-2">
          {/* Favorites */}
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

          {/* Vendors (inline expand) */}
          {filteredVendors.map(v => (
            <div key={v.id}>
              <button onClick={() => handleToggleVendor(v)}
                className={`flex items-center gap-1 w-full text-left px-2.5 py-[5px] text-[10px] cursor-pointer rounded-sm ${
                  expandedVendorId === v.id ? 'font-semibold text-foreground' : 'text-text-secondary hover:text-foreground'
                }`}>
                {expandedVendorId === v.id
                  ? <ChevronDown className="w-2.5 h-2.5 shrink-0 opacity-40" />
                  : <ChevronRight className="w-2.5 h-2.5 shrink-0 opacity-40" />}
                <span className="truncate">{v.company_name}</span>
              </button>
              {expandedVendorId === v.id && vendorTrees[v.id] && (
                <div className="pb-1">
                  {vendorTrees[v.id].map(n => renderNode(n, 0, v))}
                </div>
              )}
            </div>
          ))}
          {filteredVendors.length === 0 && (
            <p className="text-[10px] text-text-tertiary px-2 py-4 text-center">No vendors</p>
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
            onInsertRequest={handleInsert}
          />
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
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
    </div>
  )
}

function MaterialItem({ product, onClick, selected, isFavorite, onToggleFavorite, loggedIn, animationDelay }: {
  product: Product
  onClick: () => void
  selected: boolean
  isFavorite: boolean
  onToggleFavorite: () => void
  loggedIn: boolean
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

      <div className="text-center mt-1.5">
        <p className={`text-[10px] leading-[1.3] truncate ${selected ? 'font-bold underline underline-offset-2' : 'font-medium'}`}>
          {product.name}
        </p>
      </div>
    </div>
  )
}
