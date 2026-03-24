import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  ChevronRight, ChevronDown, Folder, FolderOpen,
  Plus, Trash2, Package, ImagePlus, X, Save,
} from 'lucide-react'
import type { FolderNode, Product, ProductImage } from '@/types/database'

interface TreeNode extends FolderNode { children: TreeNode[] }

function buildTree(nodes: FolderNode[], parentId: string | null): TreeNode[] {
  return nodes
    .filter(n => n.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map(n => ({ ...n, children: buildTree(nodes, n.id) }))
}

export default function VendorProducts() {
  const { vendor } = useAuth()
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedFolder, setSelectedFolder] = useState<FolderNode | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [productImages, setProductImages] = useState<Record<string, ProductImage[]>>({})
  const [newProductName, setNewProductName] = useState('')
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editForm, setEditForm] = useState({ stock: '', unit_price: '', lead_time: '', moq: '', notes: '' })
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null)

  const fetchFolders = useCallback(async () => {
    if (!vendor) return
    const { data } = await supabase.from('folder_nodes').select('*').eq('vendor_id', vendor.id).order('sort_order')
    const f = (data as FolderNode[]) || []
    setFolders(f)
    setExpandedIds(new Set(f.map(n => n.id)))
  }, [vendor])

  useEffect(() => { if (vendor?.approved) fetchFolders() }, [vendor, fetchFolders])
  useEffect(() => { setTree(buildTree(folders, null)) }, [folders])

  const fetchProducts = useCallback(async (folderId: string) => {
    if (!vendor) return
    const { data } = await supabase.from('products').select('*').eq('folder_id', folderId).eq('vendor_id', vendor.id).order('created_at')
    const prods = (data as Product[]) || []
    setProducts(prods)
    if (prods.length > 0) {
      const { data: imgData } = await supabase.from('product_images').select('*')
        .in('product_id', prods.map(p => p.id)).order('sort_order')
      const grouped: Record<string, ProductImage[]> = {}
      for (const img of (imgData as ProductImage[]) || []) {
        if (!grouped[img.product_id]) grouped[img.product_id] = []
        grouped[img.product_id].push(img)
      }
      setProductImages(grouped)
    } else { setProductImages({}) }
  }, [vendor])

  const handleSelectFolder = (node: FolderNode) => {
    if (node.is_leaf) { setSelectedFolder(node); setEditingProduct(null); fetchProducts(node.id) }
    toggleExpand(node.id)
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const handleAddProduct = async () => {
    if (!newProductName.trim() || !selectedFolder || !vendor) return
    await supabase.from('products').insert({ vendor_id: vendor.id, folder_id: selectedFolder.id, name: newProductName.trim() })
    setNewProductName('')
    fetchProducts(selectedFolder.id)
  }

  const handleDeleteProduct = async (productId: string) => {
    const imgs = productImages[productId] || []
    if (imgs.length > 0) await supabase.storage.from('product-images').remove(imgs.map(img => img.storage_path))
    await supabase.from('products').delete().eq('id', productId)
    if (selectedFolder) fetchProducts(selectedFolder.id)
  }

  const startEdit = (product: Product) => {
    setEditingProduct(product)
    setEditForm({
      stock: product.stock?.toString() || '', unit_price: product.unit_price?.toString() || '',
      lead_time: product.lead_time || '', moq: product.moq?.toString() || '', notes: product.notes || '',
    })
  }

  const handleSaveProduct = async () => {
    if (!editingProduct) return
    await supabase.from('products').update({
      stock: editForm.stock ? parseInt(editForm.stock) : null,
      unit_price: editForm.unit_price ? parseFloat(editForm.unit_price) : null,
      lead_time: editForm.lead_time || null, moq: editForm.moq ? parseInt(editForm.moq) : null,
      notes: editForm.notes || null,
    }).eq('id', editingProduct.id)
    setEditingProduct(null)
    if (selectedFolder) fetchProducts(selectedFolder.id)
  }

  const resizeImage = (file: File, maxSize: number): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      img.onload = () => {
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = (height / width) * maxSize; width = maxSize }
          else { width = (width / height) * maxSize; height = maxSize }
        }
        canvas.width = width; canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(blob => resolve(blob!), file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85)
      }
      img.src = URL.createObjectURL(file)
    })
  }

  const handleImageUpload = async (productId: string, files: FileList) => {
    if (!vendor) return
    setUploadingProductId(productId)
    const existingCount = (productImages[productId] || []).length
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!['image/jpeg', 'image/png'].includes(file.type)) continue
      const resized = await resizeImage(file, 2048)
      const ext = file.type === 'image/png' ? 'png' : 'jpg'
      const sortOrder = existingCount + i
      const fileName = `${String(sortOrder + 1).padStart(3, '0')}.${ext}`
      const storagePath = `${vendor.id}/${productId}/${fileName}`
      const { error } = await supabase.storage.from('product-images').upload(storagePath, resized, { contentType: file.type, upsert: true })
      if (error) continue
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(storagePath)
      await supabase.from('product_images').insert({ product_id: productId, file_name: fileName, storage_path: storagePath, url: urlData.publicUrl, sort_order: sortOrder })
      if (sortOrder === 0) await supabase.from('products').update({ thumbnail_url: urlData.publicUrl }).eq('id', productId)
    }
    setUploadingProductId(null)
    if (selectedFolder) fetchProducts(selectedFolder.id)
  }

  const handleDeleteImage = async (image: ProductImage) => {
    await supabase.storage.from('product-images').remove([image.storage_path])
    await supabase.from('product_images').delete().eq('id', image.id)
    if (selectedFolder) fetchProducts(selectedFolder.id)
  }

  const renderNode = (node: TreeNode, level: number) => {
    const isExpanded = expandedIds.has(node.id)
    const isSelected = selectedFolder?.id === node.id
    return (
      <div key={node.id}>
        <button onClick={() => handleSelectFolder(node)}
          className={`flex items-center gap-1.5 py-[5px] w-full text-left text-[11px] cursor-pointer rounded-[3px] ${
            isSelected ? 'bg-[rgba(0,0,0,0.05)] font-semibold text-[#1a1a1a]' : 'text-[#888] hover:text-[#1a1a1a]'
          }`} style={{ paddingLeft: `${level * 16 + 8}px`, paddingRight: '8px' }}>
          {node.children.length > 0 || !node.is_leaf
            ? isExpanded ? <ChevronDown className="w-3 h-3 shrink-0 opacity-30" /> : <ChevronRight className="w-3 h-3 shrink-0 opacity-30" />
            : <span className="w-3 shrink-0" />}
          {node.is_leaf ? <FolderOpen className="w-3.5 h-3.5 shrink-0 opacity-50" /> : <Folder className="w-3.5 h-3.5 shrink-0 opacity-50" />}
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children.map(child => renderNode(child, level + 1))}
      </div>
    )
  }

  if (!vendor) return null

  return (
    <div className="flex gap-5 h-full" style={{ minHeight: 'calc(100vh - 48px - 48px)' }}>
      {/* Folder tree */}
      <div className="w-[200px] shrink-0 bg-white border border-[rgba(0,0,0,0.06)] rounded-[6px] p-3 overflow-y-auto">
        <p className="text-[9px] font-semibold text-[#999] uppercase tracking-[0.5px] mb-2 px-1">폴더 구조</p>
        {tree.length === 0
          ? <p className="text-[10px] text-[#aaa] text-center py-6">관리자가 폴더를 아직 설정하지 않았습니다.</p>
          : tree.map(n => renderNode(n, 0))}
      </div>

      {/* Products */}
      <div className="flex-1 min-w-0">
        {!selectedFolder ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Package className="w-8 h-8 text-[#ddd] mx-auto mb-2" />
              <p className="text-[11px] text-[#aaa]">좌측에서 제품 폴더를 선택하세요</p>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-bold">{selectedFolder.name}</h2>
              <span className="text-[10px] text-[#999]">{products.length}개 제품</span>
            </div>

            {/* Add product */}
            <div className="flex gap-2 mb-4">
              <input value={newProductName} onChange={e => setNewProductName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddProduct()}
                placeholder="새 제품명"
                className="flex-1 h-[32px] text-[11px] px-3 bg-white border border-[rgba(0,0,0,0.08)] rounded-[4px] outline-none focus:border-[#1a1a1a]" />
              <button onClick={handleAddProduct} disabled={!newProductName.trim()}
                className="h-[32px] px-4 bg-[#1a1a1a] text-white text-[10px] font-semibold rounded-[4px] cursor-pointer disabled:opacity-30 flex items-center gap-1.5">
                <Plus className="w-3 h-3" /> 추가
              </button>
            </div>

            {/* Product list */}
            <div className="space-y-3">
              {products.map(product => {
                const images = productImages[product.id] || []
                const isEditing = editingProduct?.id === product.id
                return (
                  <div key={product.id} className="bg-white border border-[rgba(0,0,0,0.06)] rounded-[6px] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[12px] font-bold">{product.name}</h3>
                      <div className="flex items-center gap-2">
                        {!isEditing && (
                          <button onClick={() => startEdit(product)} className="text-[10px] text-[#999] hover:text-[#333] cursor-pointer">편집</button>
                        )}
                        <button onClick={() => handleDeleteProduct(product.id)} className="text-[10px] text-[#ccc] hover:text-[#e53e3e] cursor-pointer">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Edit form */}
                    {isEditing && (
                      <div className="grid grid-cols-2 gap-2 mb-3 p-3 bg-[#fafafa] rounded-[4px]">
                        {[
                          { label: '재고', key: 'stock', type: 'number', placeholder: '수량' },
                          { label: '단가 (원)', key: 'unit_price', type: 'number', placeholder: '가격' },
                          { label: '리드타임', key: 'lead_time', type: 'text', placeholder: '예: 2주' },
                          { label: 'MOQ', key: 'moq', type: 'number', placeholder: '최소주문수량' },
                        ].map(f => (
                          <div key={f.key}>
                            <label className="text-[9px] text-[#999] font-semibold mb-1 block">{f.label}</label>
                            <input type={f.type} value={editForm[f.key as keyof typeof editForm]}
                              onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                              placeholder={f.placeholder}
                              className="w-full h-[28px] text-[10px] px-2 bg-white border border-[rgba(0,0,0,0.08)] rounded-[3px] outline-none" />
                          </div>
                        ))}
                        <div className="col-span-2">
                          <label className="text-[9px] text-[#999] font-semibold mb-1 block">비고</label>
                          <input value={editForm.notes} onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="참고 사항"
                            className="w-full h-[28px] text-[10px] px-2 bg-white border border-[rgba(0,0,0,0.08)] rounded-[3px] outline-none" />
                        </div>
                        <div className="col-span-2 flex justify-end gap-2 mt-1">
                          <button onClick={handleSaveProduct} className="h-[26px] px-3 bg-[#1a1a1a] text-white text-[10px] font-semibold rounded-[3px] cursor-pointer flex items-center gap-1">
                            <Save className="w-3 h-3" /> 저장
                          </button>
                          <button onClick={() => setEditingProduct(null)} className="h-[26px] px-3 text-[10px] text-[#999] hover:text-[#333] cursor-pointer">취소</button>
                        </div>
                      </div>
                    )}

                    {/* Product info */}
                    {!isEditing && (product.stock !== null || product.unit_price !== null || product.lead_time || product.moq !== null) && (
                      <div className="flex gap-4 mb-3 text-[10px] text-[#999]">
                        {product.stock !== null && <span>재고: {product.stock}</span>}
                        {product.unit_price !== null && <span>단가: {Number(product.unit_price).toLocaleString()}원</span>}
                        {product.lead_time && <span>LT: {product.lead_time}</span>}
                        {product.moq !== null && <span>MOQ: {product.moq}</span>}
                      </div>
                    )}

                    {/* Images */}
                    <div className="flex flex-wrap gap-2">
                      {images.map(img => (
                        <div key={img.id} className="relative group w-[64px] h-[64px] rounded-[3px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
                          <img src={img.url} alt={img.file_name} className="w-full h-full object-cover" />
                          <button onClick={() => handleDeleteImage(img)}
                            className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center w-4 h-4 bg-black/60 rounded-full cursor-pointer">
                            <X className="w-2.5 h-2.5 text-white" />
                          </button>
                        </div>
                      ))}
                      <label className="w-[64px] h-[64px] rounded-[3px] border-2 border-dashed border-[rgba(0,0,0,0.1)] flex flex-col items-center justify-center cursor-pointer hover:bg-[rgba(0,0,0,0.02)]">
                        {uploadingProductId === product.id
                          ? <span className="text-[8px] text-[#aaa]">업로드중</span>
                          : <><ImagePlus className="w-4 h-4 text-[#ccc] mb-0.5" /><span className="text-[8px] text-[#aaa]">추가</span></>}
                        <input type="file" accept="image/jpeg,image/png" multiple className="hidden"
                          onChange={e => { if (e.target.files?.length) { handleImageUpload(product.id, e.target.files); e.target.value = '' } }}
                          disabled={uploadingProductId === product.id} />
                      </label>
                    </div>
                  </div>
                )
              })}
              {products.length === 0 && (
                <p className="text-center py-8 text-[11px] text-[#aaa]">이 폴더에 제품이 없습니다.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
