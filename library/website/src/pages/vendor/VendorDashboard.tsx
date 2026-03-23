import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  Package,
  ImagePlus,
  X,
  Save,
} from 'lucide-react'
import type { FolderNode, Product, ProductImage } from '@/types/database'

interface TreeNode extends FolderNode {
  children: TreeNode[]
}

function buildTree(nodes: FolderNode[], parentId: string | null): TreeNode[] {
  return nodes
    .filter(n => n.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map(n => ({
      ...n,
      children: buildTree(nodes, n.id),
    }))
}

export default function VendorDashboard() {
  const { user, vendor, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [folders, setFolders] = useState<FolderNode[]>([])
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [products, setProducts] = useState<Product[]>([])
  const [productImages, setProductImages] = useState<Record<string, ProductImage[]>>({})
  const [selectedFolder, setSelectedFolder] = useState<FolderNode | null>(null)
  const [newProductName, setNewProductName] = useState('')
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editForm, setEditForm] = useState({ stock: '', unit_price: '', lead_time: '', moq: '', notes: '' })
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && (!user || !vendor)) {
      navigate('/vendor/login')
    }
  }, [user, vendor, authLoading, navigate])

  const fetchFolders = useCallback(async () => {
    if (!vendor) return
    const { data } = await supabase
      .from('folder_nodes')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('sort_order')
    const folderData = (data as FolderNode[]) || []
    setFolders(folderData)
    setExpandedIds(new Set(folderData.map(n => n.id)))
    setLoading(false)
  }, [vendor])

  useEffect(() => {
    if (vendor?.approved) fetchFolders()
  }, [vendor, fetchFolders])

  useEffect(() => {
    setTree(buildTree(folders, null))
  }, [folders])

  const fetchProducts = useCallback(async (folderId: string) => {
    if (!vendor) return
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('folder_id', folderId)
      .eq('vendor_id', vendor.id)
      .order('created_at')
    const prods = (data as Product[]) || []
    setProducts(prods)

    // Fetch images for all products
    if (prods.length > 0) {
      const { data: imgData } = await supabase
        .from('product_images')
        .select('*')
        .in('product_id', prods.map(p => p.id))
        .order('sort_order')
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
  }, [vendor])

  const handleSelectFolder = (node: FolderNode) => {
    if (node.is_leaf) {
      setSelectedFolder(node)
      setEditingProduct(null)
      fetchProducts(node.id)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAddProduct = async () => {
    if (!newProductName.trim() || !selectedFolder || !vendor) return
    const { error } = await supabase.from('products').insert({
      vendor_id: vendor.id,
      folder_id: selectedFolder.id,
      name: newProductName.trim(),
    })
    if (!error) {
      setNewProductName('')
      fetchProducts(selectedFolder.id)
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('이 제품과 모든 이미지를 삭제하시겠습니까?')) return
    // Delete images from storage first
    const imgs = productImages[productId] || []
    if (imgs.length > 0) {
      await supabase.storage
        .from('product-images')
        .remove(imgs.map(img => img.storage_path))
    }
    await supabase.from('products').delete().eq('id', productId)
    if (selectedFolder) fetchProducts(selectedFolder.id)
  }

  const startEdit = (product: Product) => {
    setEditingProduct(product)
    setEditForm({
      stock: product.stock?.toString() || '',
      unit_price: product.unit_price?.toString() || '',
      lead_time: product.lead_time || '',
      moq: product.moq?.toString() || '',
      notes: product.notes || '',
    })
  }

  const handleSaveProduct = async () => {
    if (!editingProduct) return
    await supabase
      .from('products')
      .update({
        stock: editForm.stock ? parseInt(editForm.stock) : null,
        unit_price: editForm.unit_price ? parseFloat(editForm.unit_price) : null,
        lead_time: editForm.lead_time || null,
        moq: editForm.moq ? parseInt(editForm.moq) : null,
        notes: editForm.notes || null,
      })
      .eq('id', editingProduct.id)
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
          if (width > height) {
            height = (height / width) * maxSize
            width = maxSize
          } else {
            width = (width / height) * maxSize
            height = maxSize
          }
        }
        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => resolve(blob!),
          file.type === 'image/png' ? 'image/png' : 'image/jpeg',
          0.85
        )
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

      // Validate format
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        alert(`${file.name}: JPG 또는 PNG만 업로드 가능합니다.`)
        continue
      }

      // Resize if needed
      const resized = await resizeImage(file, 2048)
      const ext = file.type === 'image/png' ? 'png' : 'jpg'
      const sortOrder = existingCount + i
      const fileName = `${String(sortOrder + 1).padStart(3, '0')}.${ext}`
      const storagePath = `${vendor.id}/${productId}/${fileName}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(storagePath, resized, { contentType: file.type, upsert: true })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        continue
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(storagePath)

      // Insert image record
      await supabase.from('product_images').insert({
        product_id: productId,
        file_name: fileName,
        storage_path: storagePath,
        url: urlData.publicUrl,
        sort_order: sortOrder,
      })

      // Set first image as thumbnail
      if (sortOrder === 0) {
        await supabase
          .from('products')
          .update({ thumbnail_url: urlData.publicUrl })
          .eq('id', productId)
      }
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
    const hasChildren = node.children.length > 0

    return (
      <div key={node.id}>
        <button
          onClick={() => {
            toggleExpand(node.id)
            handleSelectFolder(node)
          }}
          className={`flex items-center gap-1 py-1.5 px-2 w-full text-left rounded text-sm transition-colors cursor-pointer ${
            isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary/50'
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
        >
          {hasChildren || !node.is_leaf ? (
            isExpanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />
          ) : (
            <span className="w-4 shrink-0" />
          )}
          {node.is_leaf ? (
            <FolderOpen className="w-4 h-4 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children.map(child => renderNode(child, level + 1))}
      </div>
    )
  }

  if (authLoading || loading) {
    return <div className="text-center py-20 text-muted-foreground">로딩 중...</div>
  }

  if (!vendor) return null

  if (!vendor.approved) {
    return (
      <div className="text-center py-20">
        <Badge variant="warning" className="mb-4">승인 대기</Badge>
        <p className="text-muted-foreground">관리자 승인을 기다리고 있습니다.</p>
      </div>
    )
  }

  return (
    <div className="flex gap-4 -mx-6 -mt-6" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Left: Folder Tree */}
      <div className="w-56 border-r p-3 overflow-y-auto shrink-0">
        <h2 className="text-sm font-semibold mb-3 px-2">폴더 구조</h2>
        {tree.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2">
            관리자가 폴더 구조를 아직 설정하지 않았습니다.
          </p>
        ) : (
          tree.map(node => renderNode(node, 0))
        )}
      </div>

      {/* Right: Product Area */}
      <div className="flex-1 p-4 overflow-y-auto">
        {!selectedFolder ? (
          <div className="text-center py-20 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>왼쪽에서 <strong>제품 폴더</strong>를 선택하세요.</p>
            <p className="text-xs mt-1">폴더 아이콘이 열린 폴더가 제품 등록 가능한 폴더입니다.</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{selectedFolder.name}</h2>
              <Badge variant="outline">{products.length}개 제품</Badge>
            </div>

            {/* Add product */}
            <div className="flex items-center gap-2 mb-4">
              <Input
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="새 제품명 입력"
                className="h-8 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleAddProduct()}
              />
              <Button size="sm" onClick={handleAddProduct} disabled={!newProductName.trim()}>
                <Plus className="w-4 h-4 mr-1" />
                추가
              </Button>
            </div>

            {/* Product list */}
            <div className="space-y-3">
              {products.map(product => {
                const images = productImages[product.id] || []
                const isEditing = editingProduct?.id === product.id

                return (
                  <div key={product.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-sm">{product.name}</h3>
                      <div className="flex items-center gap-1">
                        {!isEditing && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => startEdit(product)}>
                            정보 수정
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleDeleteProduct(product.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Edit form */}
                    {isEditing && (
                      <div className="grid grid-cols-2 gap-2 mb-3 p-2 bg-secondary/30 rounded">
                        <div>
                          <Label className="text-xs">재고</Label>
                          <Input
                            type="number"
                            value={editForm.stock}
                            onChange={(e) => setEditForm(p => ({ ...p, stock: e.target.value }))}
                            className="h-7 text-xs"
                            placeholder="수량"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">단가 (원)</Label>
                          <Input
                            type="number"
                            value={editForm.unit_price}
                            onChange={(e) => setEditForm(p => ({ ...p, unit_price: e.target.value }))}
                            className="h-7 text-xs"
                            placeholder="가격"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">리드타임</Label>
                          <Input
                            value={editForm.lead_time}
                            onChange={(e) => setEditForm(p => ({ ...p, lead_time: e.target.value }))}
                            className="h-7 text-xs"
                            placeholder="예: 2주"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">MOQ</Label>
                          <Input
                            type="number"
                            value={editForm.moq}
                            onChange={(e) => setEditForm(p => ({ ...p, moq: e.target.value }))}
                            className="h-7 text-xs"
                            placeholder="최소주문수량"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">비고</Label>
                          <Input
                            value={editForm.notes}
                            onChange={(e) => setEditForm(p => ({ ...p, notes: e.target.value }))}
                            className="h-7 text-xs"
                            placeholder="참고 사항"
                          />
                        </div>
                        <div className="col-span-2 flex justify-end gap-1">
                          <Button size="sm" className="h-7 text-xs" onClick={handleSaveProduct}>
                            <Save className="w-3 h-3 mr-1" />
                            저장
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingProduct(null)}>
                            취소
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Product info display */}
                    {!isEditing && (product.stock !== null || product.unit_price !== null || product.lead_time || product.moq !== null) && (
                      <div className="flex gap-3 mb-2 text-xs text-muted-foreground">
                        {product.stock !== null && <span>재고: {product.stock}</span>}
                        {product.unit_price !== null && <span>단가: {Number(product.unit_price).toLocaleString()}원</span>}
                        {product.lead_time && <span>LT: {product.lead_time}</span>}
                        {product.moq !== null && <span>MOQ: {product.moq}</span>}
                      </div>
                    )}
                    {!isEditing && product.notes && (
                      <p className="text-xs text-muted-foreground mb-2">비고: {product.notes}</p>
                    )}

                    {/* Images */}
                    <div className="flex flex-wrap gap-2">
                      {images.map(img => (
                        <div key={img.id} className="relative group w-20 h-20 rounded border overflow-hidden">
                          <img
                            src={img.url}
                            alt={img.file_name}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => handleDeleteImage(img)}
                            className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center w-5 h-5 bg-black/60 rounded-full cursor-pointer"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                          <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] text-center py-0.5">
                            {img.file_name}
                          </span>
                        </div>
                      ))}

                      {/* Upload button */}
                      <label className="w-20 h-20 rounded border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-secondary/30 cursor-pointer transition-colors">
                        {uploadingProductId === product.id ? (
                          <span className="text-[10px]">업로드 중...</span>
                        ) : (
                          <>
                            <ImagePlus className="w-5 h-5 mb-0.5" />
                            <span className="text-[10px]">이미지 추가</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.length) {
                              handleImageUpload(product.id, e.target.files)
                              e.target.value = ''
                            }
                          }}
                          disabled={uploadingProductId === product.id}
                        />
                      </label>
                    </div>
                  </div>
                )
              })}

              {products.length === 0 && (
                <p className="text-center py-8 text-sm text-muted-foreground">
                  이 폴더에 아직 제품이 없습니다. 위에서 제품을 추가하세요.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
