import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ChevronRight,
  ChevronDown,
  FolderPlus,
  Trash2,
  ArrowLeft,
  Folder,
  FolderOpen,
  Leaf,
} from 'lucide-react'
import type { Vendor, FolderNode } from '@/types/database'

interface TreeNode extends FolderNode {
  children: TreeNode[]
  expanded: boolean
}

function buildTree(nodes: FolderNode[], parentId: string | null): TreeNode[] {
  return nodes
    .filter(n => n.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map(n => ({
      ...n,
      children: buildTree(nodes, n.id),
      expanded: true,
    }))
}

export default function AdminFolders() {
  const { vendorId } = useParams<{ vendorId: string }>()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [nodes, setNodes] = useState<FolderNode[]>([])
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [newFolderName, setNewFolderName] = useState('')
  const [addingTo, setAddingTo] = useState<string | null>(null) // parent_id for new folder, null = root
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!vendorId) return
    const [vendorRes, foldersRes] = await Promise.all([
      supabase.from('vendors').select('*').eq('id', vendorId).single(),
      supabase.from('folder_nodes').select('*').eq('vendor_id', vendorId).order('sort_order'),
    ])
    setVendor(vendorRes.data as Vendor | null)
    const folderData = (foldersRes.data as FolderNode[]) || []
    setNodes(folderData)
    // Auto-expand all
    setExpandedIds(new Set(folderData.map(n => n.id)))
    setLoading(false)
  }, [vendorId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setTree(buildTree(nodes, null))
  }, [nodes])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getDepth = (parentId: string | null): number => {
    if (!parentId) return 0
    const parent = nodes.find(n => n.id === parentId)
    if (!parent) return 0
    return parent.depth + 1
  }

  const handleAddFolder = async (parentId: string | null) => {
    if (!newFolderName.trim() || !vendorId) return

    const depth = getDepth(parentId)
    const siblingCount = nodes.filter(n => n.parent_id === parentId).length

    const { error } = await supabase.from('folder_nodes').insert({
      vendor_id: vendorId,
      parent_id: parentId,
      name: newFolderName.trim(),
      depth,
      is_leaf: false,
      sort_order: siblingCount,
    })

    if (!error) {
      setNewFolderName('')
      setAddingTo(null)
      fetchData()
    }
  }

  const handleToggleLeaf = async (node: FolderNode) => {
    await supabase
      .from('folder_nodes')
      .update({ is_leaf: !node.is_leaf })
      .eq('id', node.id)
    fetchData()
  }

  const handleDelete = async (nodeId: string) => {
    const hasChildren = nodes.some(n => n.parent_id === nodeId)
    if (hasChildren) {
      alert('하위 폴더가 있어 삭제할 수 없습니다. 하위 폴더를 먼저 삭제해주세요.')
      return
    }
    if (!confirm('이 폴더를 삭제하시겠습니까?')) return

    await supabase.from('folder_nodes').delete().eq('id', nodeId)
    fetchData()
  }

  const renderNode = (node: TreeNode, level: number) => {
    const isExpanded = expandedIds.has(node.id)
    const hasChildren = node.children.length > 0

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1 py-1.5 px-2 hover:bg-secondary/50 rounded group"
          style={{ paddingLeft: `${level * 24 + 8}px` }}
        >
          {/* Expand/collapse */}
          <button
            onClick={() => toggleExpand(node.id)}
            className="w-5 h-5 flex items-center justify-center text-muted-foreground cursor-pointer"
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            ) : (
              <span className="w-4" />
            )}
          </button>

          {/* Folder icon */}
          {node.is_leaf ? (
            <FolderOpen className="w-4 h-4 text-amber-600 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
          )}

          {/* Name */}
          <span className="text-sm flex-1">{node.name}</span>

          {/* Leaf badge */}
          {node.is_leaf && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
              <Leaf className="w-3 h-3" />
              제품 폴더
            </Badge>
          )}

          {/* Actions (visible on hover) */}
          <div className="hidden group-hover:flex items-center gap-0.5">
            {!node.is_leaf && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => {
                  setAddingTo(node.id)
                  setNewFolderName('')
                  setExpandedIds(prev => new Set(prev).add(node.id))
                }}
                title="하위 폴더 추가"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => handleToggleLeaf(node)}
              title={node.is_leaf ? '일반 폴더로 변경' : '제품 폴더로 지정'}
            >
              <Leaf className={`w-3.5 h-3.5 ${node.is_leaf ? 'text-amber-600' : ''}`} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => handleDelete(node.id)}
              title="삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* New folder input (when adding to this node) */}
        {addingTo === node.id && (
          <div
            className="flex items-center gap-2 py-1 px-2"
            style={{ paddingLeft: `${(level + 1) * 24 + 8}px` }}
          >
            <FolderPlus className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="폴더명 입력"
              className="h-7 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddFolder(node.id)
                if (e.key === 'Escape') setAddingTo(null)
              }}
            />
            <Button size="sm" className="h-7 text-xs" onClick={() => handleAddFolder(node.id)}>
              추가
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingTo(null)}>
              취소
            </Button>
          </div>
        )}

        {/* Children */}
        {isExpanded && node.children.map(child => renderNode(child, level + 1))}
      </div>
    )
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">로딩 중...</div>
  }

  if (!vendor) {
    return <div className="text-center py-12 text-muted-foreground">벤더를 찾을 수 없습니다.</div>
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/vendors">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">{vendor.company_name} — 폴더 구조</h1>
          <p className="text-sm text-muted-foreground">
            벤더에게 제공할 폴더 구조를 설정하세요. "제품 폴더"로 지정된 폴더 아래에 벤더가 제품을 등록합니다.
          </p>
        </div>
      </div>

      <div className="border rounded-lg p-3">
        {/* Root add button */}
        <div className="flex items-center gap-2 mb-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAddingTo('__root__')
              setNewFolderName('')
            }}
          >
            <FolderPlus className="w-4 h-4 mr-1" />
            루트 폴더 추가
          </Button>
        </div>

        {/* Root add input */}
        {addingTo === '__root__' && (
          <div className="flex items-center gap-2 py-1 px-2 mb-2">
            <FolderPlus className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="카테고리명 입력 (예: 타일, 무늬목)"
              className="h-7 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddFolder(null)
                if (e.key === 'Escape') setAddingTo(null)
              }}
            />
            <Button size="sm" className="h-7 text-xs" onClick={() => handleAddFolder(null)}>
              추가
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingTo(null)}>
              취소
            </Button>
          </div>
        )}

        {/* Tree */}
        {tree.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">
            아직 폴더가 없습니다. "루트 폴더 추가"를 눌러 카테고리를 만드세요.
          </p>
        ) : (
          <div>{tree.map(node => renderNode(node, 0))}</div>
        )}
      </div>

      <div className="mt-4 p-3 bg-secondary/50 rounded-lg text-xs text-muted-foreground space-y-1">
        <p><strong>사용법:</strong></p>
        <p>1. 루트 폴더 = 카테고리 (타일, 무늬목, 벽지 등)</p>
        <p>2. 하위 폴더를 원하는 깊이까지 생성 (예: 타일 &gt; 600x600)</p>
        <p>3. 벤더가 제품을 등록할 수 있는 마지막 레벨 폴더를 <strong>"제품 폴더"</strong>로 지정</p>
        <p>4. 벤더는 제품 폴더 안에서만 제품을 추가하고 이미지를 업로드할 수 있습니다</p>
      </div>
    </div>
  )
}
