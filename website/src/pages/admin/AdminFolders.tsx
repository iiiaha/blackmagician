import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, ChevronRight, ChevronDown, Folder, Pencil, ArrowUp, ArrowDown } from 'lucide-react'
import type { Vendor, FolderNode } from '@/types/database'

interface TreeNode extends FolderNode { children: TreeNode[] }

function buildTree(nodes: FolderNode[], parentId: string | null): TreeNode[] {
  return nodes
    .filter(n => n.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map(n => ({ ...n, children: buildTree(nodes, n.id) }))
}

export default function AdminFolders() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [nodes, setNodes] = useState<FolderNode[]>([])
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('vendors').select('*').eq('approved', true)
      .then(({ data }) => {
        const list = ((data as Vendor[]) || []).slice().sort((a, b) =>
          ((a.sort_order ?? 0) - (b.sort_order ?? 0)) || a.company_name.localeCompare(b.company_name)
        )
        setVendors(list)
        setLoading(false)
      })
  }, [])

  const fetchFolders = useCallback(async (vendorId: string) => {
    const { data } = await supabase.from('folder_nodes').select('*').eq('vendor_id', vendorId).order('sort_order')
    const f = (data as FolderNode[]) || []
    setNodes(f)
    setExpandedIds(new Set(f.map(n => n.id)))
  }, [])

  useEffect(() => { setTree(buildTree(nodes, null)) }, [nodes])

  const handleSelectVendor = (v: Vendor) => {
    setSelectedVendor(v)
    fetchFolders(v.id)
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const handleAdd = async (parentId: string | null) => {
    if (!newName.trim() || !selectedVendor) return
    const depth = parentId ? (nodes.find(n => n.id === parentId)?.depth ?? -1) + 1 : 0
    const siblingCount = nodes.filter(n => n.parent_id === parentId).length
    await supabase.from('folder_nodes').insert({
      vendor_id: selectedVendor.id, parent_id: parentId, name: newName.trim(),
      depth, is_leaf: false, sort_order: siblingCount,
    })
    setNewName('')
    setAddingTo(null)
    fetchFolders(selectedVendor.id)
  }

  const [deleteFolderTarget, setDeleteFolderTarget] = useState<string | null>(null)

  const handleDeleteFolder = async (nodeId: string) => {
    await supabase.from('folder_nodes').delete().eq('id', nodeId)
    setDeleteFolderTarget(null)
    if (selectedVendor) fetchFolders(selectedVendor.id)
  }

  const confirmDeleteFolder = (nodeId: string) => {
    const hasChildren = nodes.some(n => n.parent_id === nodeId)
    if (hasChildren) { alert('하위 폴더를 먼저 삭제해주세요.'); return }
    setDeleteFolderTarget(nodeId)
  }

  const handleRename = async (nodeId: string) => {
    if (!renameValue.trim()) return
    await supabase.from('folder_nodes').update({ name: renameValue.trim() }).eq('id', nodeId)
    setRenamingId(null)
    setRenameValue('')
    if (selectedVendor) fetchFolders(selectedVendor.id)
  }

  const handleMove = async (nodeId: string, direction: 'up' | 'down') => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    const siblings = nodes.filter(n => n.parent_id === node.parent_id).sort((a, b) => a.sort_order - b.sort_order)
    const idx = siblings.findIndex(s => s.id === nodeId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= siblings.length) return

    const current = siblings[idx]
    const swap = siblings[swapIdx]
    await Promise.all([
      supabase.from('folder_nodes').update({ sort_order: swap.sort_order }).eq('id', current.id),
      supabase.from('folder_nodes').update({ sort_order: current.sort_order }).eq('id', swap.id),
    ])
    if (selectedVendor) fetchFolders(selectedVendor.id)
  }

  const renderNode = (node: TreeNode, level: number) => {
    const isExpanded = expandedIds.has(node.id)
    return (
      <div key={node.id}>
        <div className="flex items-center group py-[4px] hover:bg-[rgba(0,0,0,0.02)] rounded-[3px]"
          style={{ paddingLeft: `${level * 20 + 8}px` }}>
          <button onClick={() => toggleExpand(node.id)} className="w-4 h-4 flex items-center justify-center cursor-pointer shrink-0">
            {node.children.length > 0
              ? isExpanded ? <ChevronDown className="w-3 h-3 text-[#aaa]" /> : <ChevronRight className="w-3 h-3 text-[#aaa]" />
              : <span className="w-3" />}
          </button>
          <Folder className="w-3.5 h-3.5 text-[#bbb] mx-1.5 shrink-0" />
          {renamingId === node.id ? (
            <input value={renameValue} onChange={e => setRenameValue(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleRename(node.id); if (e.key === 'Escape') setRenamingId(null) }}
              onBlur={() => handleRename(node.id)}
              className="flex-1 h-[22px] text-[11px] px-1.5 border border-[rgba(0,0,0,0.15)] rounded-[2px] outline-none" />
          ) : (
            <span className="text-[11px] flex-1">{node.name}</span>
          )}
          <div className="hidden group-hover:flex items-center gap-0.5 mr-2">
            <button onClick={() => handleMove(node.id, 'up')}
              className="text-[#ccc] hover:text-[#333] cursor-pointer" title="위로">
              <ArrowUp className="w-3 h-3" />
            </button>
            <button onClick={() => handleMove(node.id, 'down')}
              className="text-[#ccc] hover:text-[#333] cursor-pointer" title="아래로">
              <ArrowDown className="w-3 h-3" />
            </button>
            <button onClick={() => { setRenamingId(node.id); setRenameValue(node.name) }}
              className="text-[#ccc] hover:text-[#333] cursor-pointer" title="이름 변경">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={() => { setAddingTo(node.id); setNewName(''); setExpandedIds(prev => new Set(prev).add(node.id)) }}
              className="text-[#ccc] hover:text-[#333] cursor-pointer" title="하위 폴더 추가">
              <Plus className="w-3 h-3" />
            </button>
            <button onClick={() => confirmDeleteFolder(node.id)}
              className="text-[#ccc] hover:text-[#e53e3e] cursor-pointer" title="삭제">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {addingTo === node.id && (
          <div className="flex items-center gap-2 py-1" style={{ paddingLeft: `${(level + 1) * 20 + 8}px` }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(node.id); if (e.key === 'Escape') setAddingTo(null) }}
              placeholder="폴더명"
              className="flex-1 h-[26px] text-[10px] px-2 border border-[rgba(0,0,0,0.1)] rounded-[3px] outline-none" />
            <button onClick={() => handleAdd(node.id)} className="text-[10px] text-[#1a1a1a] font-semibold cursor-pointer">추가</button>
            <button onClick={() => setAddingTo(null)} className="text-[10px] text-[#aaa] cursor-pointer">취소</button>
          </div>
        )}

        {isExpanded && node.children.map(child => renderNode(child, level + 1))}
      </div>
    )
  }

  if (loading) return <div className="text-[11px] text-[#999] py-8 text-center">로딩 중...</div>

  return (
    <div className="max-w-[600px]">
      <h1 className="text-[16px] font-bold mb-5">폴더 관리</h1>

      <div className="flex gap-5">
        {/* Vendor list */}
        <div className="w-[180px] shrink-0">
          <p className="text-[9px] font-semibold text-[#999] uppercase tracking-[0.5px] mb-2">벤더 선택</p>
          <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-[6px] overflow-hidden">
            {vendors.map(v => (
              <button key={v.id} onClick={() => handleSelectVendor(v)}
                className={`w-full text-left px-3 py-2 text-[11px] border-b border-[rgba(0,0,0,0.03)] last:border-0 cursor-pointer ${
                  selectedVendor?.id === v.id ? 'bg-[rgba(0,0,0,0.04)] font-semibold' : 'hover:bg-[rgba(0,0,0,0.02)]'
                }`}>
                <span>{v.company_name}</span>
                <span className="text-[8px] text-[#aaa] ml-1.5">{v.category}</span>
              </button>
            ))}
            {vendors.length === 0 && <p className="text-[10px] text-[#aaa] text-center py-4">벤더 없음</p>}
          </div>
        </div>

        {/* Folder tree */}
        <div className="flex-1">
          {!selectedVendor ? (
            <p className="text-[11px] text-[#aaa] text-center py-12">좌측에서 벤더를 선택하세요</p>
          ) : (
            <div className="bg-white border border-[rgba(0,0,0,0.06)] rounded-[6px] p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-bold">{selectedVendor.company_name}</span>
                <button onClick={() => { setAddingTo('__root__'); setNewName('') }}
                  className="h-[26px] px-3 text-[10px] font-semibold border border-[rgba(0,0,0,0.1)] rounded-[4px] cursor-pointer hover:bg-[rgba(0,0,0,0.02)] flex items-center gap-1">
                  <Plus className="w-3 h-3" /> 루트 폴더
                </button>
              </div>

              {addingTo === '__root__' && (
                <div className="flex items-center gap-2 mb-2">
                  <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(null); if (e.key === 'Escape') setAddingTo(null) }}
                    placeholder="폴더명"
                    className="flex-1 h-[26px] text-[10px] px-2 border border-[rgba(0,0,0,0.1)] rounded-[3px] outline-none" />
                  <button onClick={() => handleAdd(null)} className="text-[10px] text-[#1a1a1a] font-semibold cursor-pointer">추가</button>
                  <button onClick={() => setAddingTo(null)} className="text-[10px] text-[#aaa] cursor-pointer">취소</button>
                </div>
              )}

              {tree.length === 0 ? (
                <p className="text-[10px] text-[#aaa] text-center py-6">폴더가 없습니다. "루트 폴더"를 추가하세요.</p>
              ) : (
                tree.map(n => renderNode(n, 0))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete folder confirmation popup */}
      {deleteFolderTarget && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setDeleteFolderTarget(null)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] bg-white border border-[rgba(0,0,0,0.08)] rounded-[8px] p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h3 className="text-[13px] font-bold mb-2">폴더 삭제</h3>
            <p className="text-[11px] text-[#888] mb-1">
              <span className="font-semibold text-[#333]">{nodes.find(n => n.id === deleteFolderTarget)?.name}</span>
            </p>
            <p className="text-[10px] text-[#aaa] mb-5">이 폴더를 삭제하시겠습니까?</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteFolderTarget(null)}
                className="flex-1 h-[34px] text-[11px] font-semibold border border-[rgba(0,0,0,0.08)] rounded-[5px] cursor-pointer hover:bg-[#f5f5f5]">
                취소
              </button>
              <button onClick={() => handleDeleteFolder(deleteFolderTarget)}
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
