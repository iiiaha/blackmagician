import { useEffect, useState, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CATEGORIES, type CategoryId } from '@/lib/categories'
import PreviewPanel from '@/components/PreviewPanel'
import {
  Search, ChevronRight, ChevronDown, ChevronLeft, ImageIcon,
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
  const { activeCategory } = useOutletContext<{ activeCategory: CategoryId }>()

  const [allVendors, setAllVendors] = useState<Vendor[]>([])
  const [allFolderRoots, setAllFolderRoots] = useState<FolderNode[]>([])
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([])

  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [folderTree, setFolderTree] = useState<TreeNode[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedFolder, setSelectedFolder] = useState<FolderNode | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [productImages, setProductImages] = useState<Record<string, ProductImage[]>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<(Product & { vendor_name: string; folder_path: string })[] | null>(null)

  const [previewProduct, setPreviewProduct] = useState<Product | null>(null)
  const [previewImages, setPreviewImages] = useState<ProductImage[]>([])
  const [previewVendor, setPreviewVendor] = useState('')
  const [previewSizeStr, setPreviewSizeStr] = useState('')

  // Fetch all vendors + root folder nodes on mount
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

  // Filter vendors by active category
  useEffect(() => {
    const cat = CATEGORIES.find(c => c.id === activeCategory)
    if (!cat) { setFilteredVendors(allVendors); return }

    const matchingVendorIds = new Set(
      allFolderRoots
        .filter(f => cat.folderNames.some(name =>
          f.name.toLowerCase().includes(name.toLowerCase())
        ))
        .map(f => f.vendor_id)
    )
    setFilteredVendors(allVendors.filter(v => matchingVendorIds.has(v.id)))

    // Reset selection when category changes
    setSelectedVendor(null)
    setSelectedFolder(null)
    setProducts([])
    setProductImages({})
    setSearchResults(null)
  }, [activeCategory, allVendors, allFolderRoots])

  const fetchFolders = useCallback(async (vendorId: string) => {
    const { data } = await supabase.from('folder_nodes').select('*').eq('vendor_id', vendorId).order('sort_order')
    const f = (data as FolderNode[]) || []

    // Filter to show only folders under the matching category root
    const cat = CATEGORIES.find(c => c.id === activeCategory)
    let filtered = f
    if (cat) {
      const categoryRoot = f.find(node =>
        node.depth === 0 && cat.folderNames.some(name =>
          node.name.toLowerCase().includes(name.toLowerCase())
        )
      )
      if (categoryRoot) {
        // Show children of the category root (skip the category level)
        const getDescendants = (parentId: string): FolderNode[] => {
          const children = f.filter(n => n.parent_id === parentId)
          return children.flatMap(c => [c, ...getDescendants(c.id)])
        }
        filtered = getDescendants(categoryRoot.id)
      }
    }

    setFolders(f) // Keep all for breadcrumb
    setExpandedIds(new Set(filtered.map(n => n.id)))
    setFolderTree(buildTree(filtered, filtered.length > 0 ? filtered[0]?.parent_id ?? null : null))
  }, [activeCategory])

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

  const handleSelectProduct = (product: Product, vendorName?: string) => {
    if (!user) { alert('로그인 후 이용 가능합니다.'); return }
    const imgs = productImages[product.id] || []
    if (imgs.length === 0) return
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
      alert('SketchUp 환경에서만 사용 가능합니다.')
    }
  }

  const renderNode = (node: TreeNode, level: number) => {
    const isExpanded = expandedIds.has(node.id)
    const isSelected = selectedFolder?.id === node.id
    return (
      <div key={node.id}>
        <button
          onClick={() => handleSelectFolder(node)}
          className={`flex items-center gap-1.5 py-[4px] w-full text-left text-[11px] cursor-pointer ${
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
      <div className="w-[200px] bg-white border-r flex flex-col shrink-0">
        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search"
              className="w-full h-[28px] text-[10px] pl-7 pr-3 bg-[rgba(0,0,0,0.025)] border border-border rounded-[4px] outline-none placeholder:text-text-tertiary focus:border-foreground focus:shadow-[0_0_0_2px_rgba(26,26,26,0.06)]"
            />
          </div>
        </div>

        {/* Vendor / Folder tree */}
        <div className="flex-1 overflow-y-auto px-1">
          {selectedVendor ? (
            <div className="pb-2">
              <button onClick={() => { setSelectedVendor(null); setSelectedFolder(null); setProducts([]); setFolders([]) }}
                className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-foreground px-3 py-1 cursor-pointer">
                <ChevronLeft className="w-3 h-3" />
                Back
              </button>
              <div className="px-3 pt-1 pb-2">
                <span className="text-[11px] font-bold">{selectedVendor.company_name}</span>
              </div>
              {folderTree.length > 0 ? folderTree.map(n => renderNode(n, 0)) : (
                <p className="text-[10px] text-text-tertiary px-3 py-4 text-center">No folders</p>
              )}
            </div>
          ) : (
            <div className="pb-2">
              {filteredVendors.map(v => (
                <button key={v.id} onClick={() => handleSelectVendor(v)}
                  className="flex items-center w-full text-left px-3 py-[5px] text-[11px] text-foreground hover:bg-[rgba(0,0,0,0.02)] cursor-pointer rounded-sm">
                  {v.company_name}
                </button>
              ))}
              {filteredVendors.length === 0 && (
                <p className="text-[10px] text-text-tertiary px-3 py-6 text-center">No vendors</p>
              )}
            </div>
          )}
        </div>

        <div className="border-t" />

        {/* Preview Panel */}
        <div className="h-[58%] shrink-0">
          <PreviewPanel
            images={previewImages}
            sizeStr={previewSizeStr}
            vendorName={previewVendor}
            tileName={previewProduct?.name || ''}
            product={previewProduct}
            onInsertRequest={handleInsert}
          />
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Breadcrumb */}
        {(selectedFolder || searchResults !== null) && (
          <div className="px-5 py-2 border-b bg-white flex items-center justify-between shrink-0">
            {searchResults !== null ? (
              <>
                <span className="text-[10px] text-text-secondary">
                  "<span className="text-foreground font-semibold">{searchQuery}</span>" — {searchResults.length} items
                </span>
                <button onClick={() => setSearchResults(null)}
                  className="text-[10px] text-text-tertiary hover:text-foreground cursor-pointer font-semibold">
                  Clear
                </button>
              </>
            ) : selectedFolder && (
              <div className="flex items-center gap-1.5 text-[10px]">
                {selectedVendor && (
                  <>
                    <span className="text-text-tertiary">{selectedVendor.company_name}</span>
                    <ChevronRight className="w-3 h-3 text-text-tertiary opacity-40" />
                  </>
                )}
                {getBreadcrumb(folders, selectedFolder.id).map((f, i, arr) => (
                  <span key={f.id} className="flex items-center gap-1.5">
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
        <div className="flex-1 overflow-y-auto p-5">
          {searchResults !== null ? (
            searchResults.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-4">
                {searchResults.map(p => (
                  <MaterialItem key={p.id} product={p}
                    onClick={() => handleSelectProduct(p, p.vendor_name)}
                    selected={previewProduct?.id === p.id} />
                ))}
              </div>
            )
          ) : selectedFolder ? (
            products.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-4">
                {products.map((p, i) => (
                  <MaterialItem key={p.id} product={p}
                    onClick={() => handleSelectProduct(p)}
                    selected={previewProduct?.id === p.id}
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

function EmptyState() {
  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-[11px] text-text-tertiary">No materials found</p>
    </div>
  )
}

function MaterialItem({ product, onClick, selected, animationDelay }: {
  product: Product
  onClick: () => void
  selected: boolean
  animationDelay?: number
}) {
  return (
    <div
      className="group cursor-pointer"
      onClick={onClick}
      style={animationDelay !== undefined ? {
        animation: `fadeInUp 0.25s ease-out ${animationDelay}s both`,
      } : undefined}
    >
      <div className="aspect-square rounded-[3px] overflow-hidden relative hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-shadow duration-200">
        {product.thumbnail_url ? (
          <img src={product.thumbnail_url} alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            loading="lazy" />
        ) : (
          <div className="w-full h-full bg-[rgba(0,0,0,0.03)] flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-text-tertiary opacity-30" />
          </div>
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
