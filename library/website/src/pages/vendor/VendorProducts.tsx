import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, type ColDef, type CellValueChangedEvent } from 'ag-grid-community'
import {
  ChevronRight, ChevronDown, Folder, FolderOpen,
  Plus, Package, ImagePlus, X,
} from 'lucide-react'
import type { FolderNode, Product, ProductImage } from '@/types/database'

ModuleRegistry.registerModules([AllCommunityModule])

interface TreeNode extends FolderNode { children: TreeNode[] }

function buildTree(nodes: FolderNode[], parentId: string | null): TreeNode[] {
  return nodes
    .filter(n => n.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map(n => ({ ...n, children: buildTree(nodes, n.id) }))
}

export default function VendorProducts() {
  const { vendor } = useAuth()
  const gridRef = useRef<AgGridReact>(null)
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedFolder, setSelectedFolder] = useState<FolderNode | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [productImages, setProductImages] = useState<Record<string, ProductImage[]>>({})
  const [newProductName, setNewProductName] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState<Product[]>([])
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  // Bulk import states
  const [showImportPopup, setShowImportPopup] = useState(false)
  const [importPhase, setImportPhase] = useState<'scanning' | 'confirm' | 'uploading' | 'done'>('scanning')
  const [importItems, setImportItems] = useState<{ name: string; files: File[] }[]>([])
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, name: '' })
  const folderInputRef = useRef<HTMLInputElement>(null)

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
    if (node.is_leaf) { setSelectedFolder(node); setSelectedProductId(null); fetchProducts(node.id) }
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

  const confirmDelete = (product: Product) => {
    setDeleteTarget(product)
  }

  const handleDeleteProduct = async (productId: string) => {
    const imgs = productImages[productId] || []
    if (imgs.length > 0) await supabase.storage.from('product-images').remove(imgs.map(img => img.storage_path))
    await supabase.from('products').delete().eq('id', productId)
    setSelectedProductId(null)
    if (selectedFolder) fetchProducts(selectedFolder.id)
  }

  // AG Grid cell edit → save to DB
  const onCellValueChanged = useCallback(async (event: CellValueChangedEvent) => {
    const { data, colDef } = event
    const field = colDef.field
    if (!field) return
    const update: Record<string, unknown> = {}
    if (field === 'unit_price' || field === 'stock') {
      update[field] = data[field] !== null && data[field] !== '' ? Number(data[field]) : null
    } else {
      update[field] = data[field] || null
    }
    await supabase.from('products').update(update).eq('id', data.id)
  }, [])

  // Editable fields in column order (for paste mapping)
  const editableFields = ['name', 'unit_price', 'stock', 'origin', 'brand', 'size'] as const

  // Custom clipboard: Ctrl+C copies focused cell value, Ctrl+V pastes into cells
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!gridRef.current?.api) return
      const api = gridRef.current.api

      // Ctrl+C: copy focused cell value
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const focusedCell = api.getFocusedCell()
        if (!focusedCell) return
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return

        e.preventDefault()
        const rowNode = api.getDisplayedRowAtIndex(focusedCell.rowIndex)
        if (!rowNode?.data) return

        const colId = focusedCell.column.getColId()
        const value = rowNode.data[colId]
        await navigator.clipboard.writeText(value != null ? String(value) : '')
      }

      // Ctrl+V: paste tab-separated text starting from focused cell
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const focusedCell = api.getFocusedCell()
        if (!focusedCell) return
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return

        e.preventDefault()
        const text = await navigator.clipboard.readText()
        if (!text.trim()) return

        const pasteRows = text.trim().split('\n').map(line => line.split('\t'))
        const startColId = focusedCell.column.getColId()
        const startColIndex = editableFields.indexOf(startColId as typeof editableFields[number])
        if (startColIndex === -1) return

        const startRowIndex = focusedCell.rowIndex
        const updates: { id: string; data: Record<string, unknown> }[] = []

        for (let r = 0; r < pasteRows.length; r++) {
          const rowNode = api.getDisplayedRowAtIndex(startRowIndex + r)
          if (!rowNode?.data) continue

          const rowUpdate: Record<string, unknown> = {}
          for (let c = 0; c < pasteRows[r].length; c++) {
            const fieldIndex = startColIndex + c
            if (fieldIndex >= editableFields.length) break
            const field = editableFields[fieldIndex]
            let value: unknown = pasteRows[r][c]

            if (field === 'unit_price' || field === 'stock') {
              const n = Number(String(value).replace(/[^0-9.-]/g, ''))
              value = isNaN(n) ? null : n
            }
            if (value === '') value = null

            rowUpdate[field] = value
            rowNode.setDataValue(field, value)
          }

          updates.push({ id: rowNode.data.id, data: rowUpdate })
        }

        // Save all to DB
        await Promise.all(updates.map(u =>
          supabase.from('products').update(u.data).eq('id', u.id)
        ))
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [products])

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const toggleCheckAll = () => {
    if (checkedIds.size === products.length) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(products.map(p => p.id)))
    }
  }

  const handleBulkDelete = async () => {
    for (const id of bulkDeleteTarget.map(p => p.id)) {
      await handleDeleteProduct(id)
    }
    setCheckedIds(new Set())
    setBulkDeleteTarget([])
  }

  // AG Grid column definitions
  const columnDefs: ColDef[] = [
    {
      headerName: '', width: 40, minWidth: 40, maxWidth: 40, sortable: false, filter: false, editable: false, resizable: false,
      headerComponent: () => (
        <div className="flex items-center justify-center w-full">
          <input type="checkbox" checked={products.length > 0 && checkedIds.size === products.length}
            onChange={toggleCheckAll}
            className="cursor-pointer w-[14px] h-[14px]" />
        </div>
      ),
      cellRenderer: (p: { data: Product }) => (
        <div className="flex items-center justify-center w-full h-full">
          <input type="checkbox" checked={checkedIds.has(p.data.id)}
            onChange={() => toggleCheck(p.data.id)}
            onClick={(e) => e.stopPropagation()}
            className="cursor-pointer w-[14px] h-[14px]" />
        </div>
      ),
    },
    {
      headerName: '제품명', field: 'name', editable: true, flex: 2, minWidth: 120,
      cellStyle: { fontWeight: 600 },
    },
    {
      headerName: '단가', field: 'unit_price', editable: true, flex: 1, minWidth: 80,
      valueFormatter: (p) => p.value ? `${Number(p.value).toLocaleString()}원` : '',
      valueParser: (p) => { const n = Number(String(p.newValue).replace(/[^0-9.-]/g, '')); return isNaN(n) ? null : n },
    },
    {
      headerName: '재고', field: 'stock', editable: true, flex: 0.7, minWidth: 60,
      valueParser: (p) => { const n = Number(p.newValue); return isNaN(n) ? null : n },
    },
    { headerName: '원산지', field: 'origin', editable: true, flex: 1, minWidth: 70 },
    { headerName: '브랜드', field: 'brand', editable: true, flex: 1, minWidth: 70 },
    { headerName: '크기', field: 'size', editable: true, flex: 1, minWidth: 70 },
    {
      headerName: '이미지', editable: false, flex: 0.5, minWidth: 50,
      valueGetter: (p) => (productImages[p.data.id] || []).length,
      valueFormatter: (p) => p.value > 0 ? `${p.value}장` : '-',
      sortable: false, filter: false,
    },
    {
      headerName: '', editable: false, width: 50, sortable: false, filter: false,
      cellRenderer: (p: { data: Product }) => {
        return (
          <button
            onClick={(e) => { e.stopPropagation(); confirmDelete(p.data) }}
            className="w-full h-full flex items-center justify-center text-[9px] text-[#bbb] hover:text-[#e53e3e] cursor-pointer"
          >
            삭제
          </button>
        )
      },
    },
  ]

  const defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
  }

  // Image handling
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

    const uploadPromises = Array.from(files).map(async (file, i) => {
      if (!['image/jpeg', 'image/png'].includes(file.type)) return
      const resized = await resizeImage(file, 2048)
      const ext = file.type === 'image/png' ? 'png' : 'jpg'
      const sortOrder = existingCount + i
      const fileName = `${String(sortOrder + 1).padStart(3, '0')}.${ext}`
      const storagePath = `${vendor.id}/${productId}/${fileName}`
      const { error } = await supabase.storage.from('product-images').upload(storagePath, resized, { contentType: file.type, upsert: true })
      if (error) return
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(storagePath)
      await supabase.from('product_images').insert({ product_id: productId, file_name: fileName, storage_path: storagePath, url: urlData.publicUrl, sort_order: sortOrder })
      if (sortOrder === 0) await supabase.from('products').update({ thumbnail_url: urlData.publicUrl }).eq('id', productId)
    })

    await Promise.all(uploadPromises)
    setUploadingProductId(null)
    if (selectedFolder) fetchProducts(selectedFolder.id)
  }

  // Bulk import: folder picker → scan → confirm → upload
  const handleFolderSelect = (files: FileList) => {
    // Group files by their parent folder name
    const folderMap: Record<string, File[]> = {}
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!['image/jpeg', 'image/png'].includes(file.type)) continue
      // webkitRelativePath: "folderName/image.jpg"
      const path = file.webkitRelativePath
      const parts = path.split('/')
      if (parts.length < 2) continue
      const folderName = parts[parts.length - 2] // immediate parent folder
      // Skip root folder (the selected directory itself)
      if (parts.length === 2) {
        // file is directly in root selected folder — skip (we want subfolders)
        // Actually, treat the root folder name as a single product
        if (!folderMap[parts[0]]) folderMap[parts[0]] = []
        folderMap[parts[0]].push(file)
      } else {
        // file is in a subfolder — subfolder name = product name
        if (!folderMap[folderName]) folderMap[folderName] = []
        folderMap[folderName].push(file)
      }
    }

    const items = Object.entries(folderMap).map(([name, files]) => ({
      name,
      files: files.sort((a, b) => a.name.localeCompare(b.name)),
    }))

    if (items.length === 0) return

    setImportItems(items)
    setImportPhase('confirm')
    setShowImportPopup(true)
  }

  const executeImport = async () => {
    if (!vendor || !selectedFolder) return
    setImportPhase('uploading')
    setImportProgress({ current: 0, total: importItems.length, name: '' })

    for (let fi = 0; fi < importItems.length; fi++) {
      const item = importItems[fi]
      setImportProgress({ current: fi + 1, total: importItems.length, name: item.name })

      const { data: newProduct } = await supabase.from('products')
        .insert({ vendor_id: vendor.id, folder_id: selectedFolder.id, name: item.name })
        .select().single()

      if (!newProduct) continue
      const productId = (newProduct as Product).id

      for (let i = 0; i < item.files.length; i++) {
        const file = item.files[i]
        const resized = await resizeImage(file, 2048)
        const ext = file.type === 'image/png' ? 'png' : 'jpg'
        const fileName = `${String(i + 1).padStart(3, '0')}.${ext}`
        const storagePath = `${vendor.id}/${productId}/${fileName}`

        const { error } = await supabase.storage.from('product-images')
          .upload(storagePath, resized, { contentType: file.type, upsert: true })
        if (error) continue

        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(storagePath)
        await supabase.from('product_images').insert({
          product_id: productId, file_name: fileName,
          storage_path: storagePath, url: urlData.publicUrl, sort_order: i,
        })
        if (i === 0) {
          await supabase.from('products').update({ thumbnail_url: urlData.publicUrl }).eq('id', productId)
        }
      }
    }

    setImportPhase('done')
    fetchProducts(selectedFolder.id)
  }

  const handleDeleteImage = async (image: ProductImage) => {
    await supabase.storage.from('product-images').remove([image.storage_path])
    await supabase.from('product_images').delete().eq('id', image.id)
    if (selectedFolder) fetchProducts(selectedFolder.id)
  }

  const selectedProduct = products.find(p => p.id === selectedProductId)
  const selectedImages = selectedProductId ? (productImages[selectedProductId] || []) : []

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

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedFolder ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Package className="w-8 h-8 text-[#ddd] mx-auto mb-2" />
              <p className="text-[11px] text-[#aaa]">좌측에서 제품 폴더를 선택하세요</p>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar — fixed height, no layout shift */}
            <div className="flex items-center gap-2 mb-3 h-[32px]">
              <h2 className="text-[13px] font-bold shrink-0">{selectedFolder.name}</h2>
              <span className="text-[10px] text-[#999] shrink-0">{products.length}개</span>

              <div className="flex-1" />

              {/* Bulk delete — always takes space, visible when checked */}
              <button
                onClick={() => checkedIds.size > 0 && setBulkDeleteTarget(products.filter(p => checkedIds.has(p.id)))}
                className={`h-[28px] px-3 text-[10px] font-semibold rounded-[4px] shrink-0 transition-opacity ${
                  checkedIds.size > 0
                    ? 'text-[#e53e3e] border border-[rgba(229,62,62,0.3)] cursor-pointer hover:bg-[rgba(229,62,62,0.05)] opacity-100'
                    : 'text-transparent border border-transparent pointer-events-none opacity-0'
                }`}>
                선택 삭제 ({checkedIds.size})
              </button>

              <button onClick={() => folderInputRef.current?.click()}
                className="h-[28px] px-3 border border-[rgba(0,0,0,0.1)] text-[10px] font-semibold rounded-[4px] cursor-pointer hover:bg-[rgba(0,0,0,0.02)] flex items-center gap-1.5 shrink-0">
                <FolderOpen className="w-3 h-3" /> 폴더 등록
              </button>
              {/* @ts-expect-error webkitdirectory is not in React types */}
              <input ref={folderInputRef} type="file" webkitdirectory="" multiple className="hidden"
                onChange={(e) => { if (e.target.files?.length) { handleFolderSelect(e.target.files); e.target.value = '' } }} />
            </div>

            {/* Add single product */}
            <div className="flex gap-2 mb-3">
              <input value={newProductName} onChange={e => setNewProductName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddProduct()}
                placeholder="새 제품명 입력 후 Enter"
                className="w-[200px] h-[28px] text-[10px] px-3 bg-white border border-[rgba(0,0,0,0.08)] rounded-[4px] outline-none focus:border-[#1a1a1a]" />
              <button onClick={handleAddProduct} disabled={!newProductName.trim()}
                className="h-[28px] px-3 bg-[#1a1a1a] text-white text-[10px] font-semibold rounded-[4px] cursor-pointer disabled:opacity-30 flex items-center gap-1">
                <Plus className="w-3 h-3" /> 추가
              </button>
            </div>

            {/* AG Grid Table */}
            <div className="flex-1 bg-white border border-[rgba(0,0,0,0.06)] rounded-[6px] overflow-hidden" style={{ minHeight: '200px' }}>
              <AgGridReact
                ref={gridRef}
                rowData={products}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                onCellValueChanged={onCellValueChanged}
                onRowClicked={(e) => setSelectedProductId(e.data.id)}
                rowSelection="single"
                getRowId={(p) => p.data.id}
                headerHeight={32}
                rowHeight={32}
                enableCellTextSelection={true}
                ensureDomOrder={true}
              />
            </div>

            {/* Image panel for selected product */}
            {selectedProduct && (
              <div className="mt-3 bg-white border border-[rgba(0,0,0,0.06)] rounded-[6px] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[12px] font-bold">{selectedProduct.name} — 이미지</h3>
                  <button onClick={() => setSelectedProductId(null)} className="text-[10px] text-[#aaa] hover:text-[#333] cursor-pointer">닫기</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedImages.map(img => (
                    <div key={img.id} className="relative group w-[72px] h-[72px] rounded-[3px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
                      <img src={img.url} alt={img.file_name} className="w-full h-full object-cover" />
                      <button onClick={() => handleDeleteImage(img)}
                        className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center w-4 h-4 bg-black/60 rounded-full cursor-pointer">
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                      <span className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[8px] text-center py-[1px]">{img.file_name}</span>
                    </div>
                  ))}
                  <label className="w-[72px] h-[72px] rounded-[3px] border-2 border-dashed border-[rgba(0,0,0,0.1)] flex flex-col items-center justify-center cursor-pointer hover:bg-[rgba(0,0,0,0.02)]">
                    {uploadingProductId === selectedProduct.id
                      ? <span className="text-[8px] text-[#aaa]">업로드중</span>
                      : <><ImagePlus className="w-4 h-4 text-[#ccc] mb-0.5" /><span className="text-[8px] text-[#aaa]">추가</span></>}
                    <input type="file" accept="image/jpeg,image/png" multiple className="hidden"
                      onChange={e => { if (e.target.files?.length) { handleImageUpload(selectedProduct.id, e.target.files); e.target.value = '' } }}
                      disabled={uploadingProductId === selectedProduct.id} />
                  </label>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Import popup */}
      {showImportPopup && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={importPhase === 'uploading' ? undefined : () => { setShowImportPopup(false); setImportItems([]) }} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] bg-white border border-[rgba(0,0,0,0.08)] rounded-[8px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.06)]">
              <h3 className="text-[13px] font-bold">
                {importPhase === 'confirm' && '폴더 등록 확인'}
                {importPhase === 'uploading' && '등록 중...'}
                {importPhase === 'done' && '등록 완료'}
              </h3>
            </div>

            <div className="px-5 py-4">
              {/* Confirm phase */}
              {importPhase === 'confirm' && (
                <>
                  <p className="text-[11px] text-[#666] mb-3">
                    <span className="font-semibold text-[#333]">{importItems.length}개 제품</span>이 등록됩니다.
                  </p>
                  <div className="max-h-[200px] overflow-y-auto border border-[rgba(0,0,0,0.06)] rounded-[4px] mb-4">
                    <table className="w-full text-[10px]">
                      <thead className="bg-[#f8f8f8] sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-1.5 font-semibold text-[#888]">제품명</th>
                          <th className="text-right px-3 py-1.5 font-semibold text-[#888]">이미지</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importItems.map((item, i) => (
                          <tr key={i} className="border-t border-[rgba(0,0,0,0.04)]">
                            <td className="px-3 py-1.5">{item.name}</td>
                            <td className="px-3 py-1.5 text-right text-[#999]">{item.files.length}장</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowImportPopup(false); setImportItems([]) }}
                      className="flex-1 h-[34px] text-[11px] font-semibold border border-[rgba(0,0,0,0.08)] rounded-[5px] cursor-pointer hover:bg-[#f5f5f5]">
                      취소
                    </button>
                    <button onClick={executeImport}
                      className="flex-1 h-[34px] text-[11px] font-semibold bg-[#1a1a1a] text-white rounded-[5px] cursor-pointer hover:opacity-90">
                      등록하기
                    </button>
                  </div>
                </>
              )}

              {/* Uploading phase */}
              {importPhase === 'uploading' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold">{importProgress.name}</span>
                    <span className="text-[10px] text-[#999]">{importProgress.current}/{importProgress.total}</span>
                  </div>
                  <div className="w-full h-[6px] bg-[#f0f0f0] rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-[#1a1a1a] rounded-full transition-all duration-300"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#aaa] text-center">이미지를 업로드하고 있습니다. 잠시 기다려주세요...</p>
                </div>
              )}

              {/* Done phase */}
              {importPhase === 'done' && (
                <>
                  <div className="text-center mb-4">
                    <div className="w-10 h-10 bg-[#f0f0f0] rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-[16px]">✓</span>
                    </div>
                    <p className="text-[12px] font-semibold">{importItems.length}개 제품 등록 완료</p>
                  </div>
                  <div className="max-h-[150px] overflow-y-auto border border-[rgba(0,0,0,0.06)] rounded-[4px] mb-4">
                    <table className="w-full text-[10px]">
                      <thead className="bg-[#f8f8f8] sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-1.5 font-semibold text-[#888]">제품명</th>
                          <th className="text-right px-3 py-1.5 font-semibold text-[#888]">이미지</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importItems.map((item, i) => (
                          <tr key={i} className="border-t border-[rgba(0,0,0,0.04)]">
                            <td className="px-3 py-1.5">{item.name}</td>
                            <td className="px-3 py-1.5 text-right text-[#999]">{item.files.length}장</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={() => { setShowImportPopup(false); setImportItems([]) }}
                    className="w-full h-[34px] text-[11px] font-semibold bg-[#1a1a1a] text-white rounded-[5px] cursor-pointer hover:opacity-90">
                    확인
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Bulk delete confirmation popup */}
      {bulkDeleteTarget.length > 0 && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setBulkDeleteTarget([])} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] bg-white border border-[rgba(0,0,0,0.08)] rounded-[8px] p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h3 className="text-[13px] font-bold mb-2">선택 삭제</h3>
            <p className="text-[11px] text-[#888] mb-1">
              <span className="font-semibold text-[#333]">{bulkDeleteTarget.length}개 제품</span>을 삭제합니다.
            </p>
            <div className="max-h-[100px] overflow-y-auto text-left my-3 px-2">
              {bulkDeleteTarget.map(p => (
                <p key={p.id} className="text-[10px] text-[#666] py-0.5">· {p.name}</p>
              ))}
            </div>
            <p className="text-[10px] text-[#aaa] mb-4">모든 이미지가 함께 삭제됩니다.</p>
            <div className="flex gap-2">
              <button onClick={() => setBulkDeleteTarget([])}
                className="flex-1 h-[34px] text-[11px] font-semibold border border-[rgba(0,0,0,0.08)] rounded-[5px] cursor-pointer hover:bg-[#f5f5f5]">
                취소
              </button>
              <button onClick={handleBulkDelete}
                className="flex-1 h-[34px] text-[11px] font-semibold border border-[rgba(0,0,0,0.08)] rounded-[5px] cursor-pointer hover:bg-[#f5f5f5]">
                삭제하기
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation popup */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setDeleteTarget(null)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] bg-white border border-[rgba(0,0,0,0.08)] rounded-[8px] p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h3 className="text-[13px] font-bold mb-2">제품 삭제</h3>
            <p className="text-[11px] text-[#888] mb-1">
              <span className="font-semibold text-[#333]">{deleteTarget.name}</span>
            </p>
            <p className="text-[10px] text-[#aaa] mb-5">이 제품과 모든 이미지가 삭제됩니다.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 h-[34px] text-[11px] font-semibold border border-[rgba(0,0,0,0.08)] rounded-[5px] cursor-pointer hover:bg-[#f5f5f5]">
                취소
              </button>
              <button onClick={async () => {
                await handleDeleteProduct(deleteTarget.id)
                setDeleteTarget(null)
              }}
                className="flex-1 h-[34px] text-[11px] font-semibold border border-[rgba(0,0,0,0.08)] rounded-[5px] cursor-pointer hover:bg-[#f5f5f5]">
                삭제하기
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
