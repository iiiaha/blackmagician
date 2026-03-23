import { useRef, useEffect, useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  RotateCw, Palette, Grid3X3, Columns2, Columns3, Eye,
} from 'lucide-react'
import {
  type EditState, defaultEditState, drawCanvas, calcFinalSizeMM,
  loadImage, getMixTileCount,
} from '@/lib/canvas'
import type { ProductImage } from '@/types/database'

interface Props {
  images: ProductImage[]
  sizeStr: string
  vendorName: string
  tileName: string
  onInsertRequest?: (dataUrl: string, vendor: string, tileName: string, sizeStr: string) => void
}

export default function PreviewPanel({ images, sizeStr, vendorName, tileName, onInsertRequest }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [edit, setEdit] = useState<EditState>({ ...defaultEditState })
  const [mainImg, setMainImg] = useState<HTMLImageElement | null>(null)
  const [allImgs, setAllImgs] = useState<HTMLImageElement[]>([])
  const [activePanel, setActivePanel] = useState<string | null>(null)
  const [inserting, setInserting] = useState(false)

  // Load images
  useEffect(() => {
    setEdit({ ...defaultEditState })
    setActivePanel(null)
    if (images.length === 0) return

    loadImage(images[0].url).then(img => setMainImg(img))
    Promise.all(images.map(i => loadImage(i.url))).then(imgs => setAllImgs(imgs))
  }, [images])

  // Draw canvas
  const redraw = useCallback(() => {
    if (!canvasRef.current || !mainImg) return
    drawCanvas(canvasRef.current, sizeStr, edit, mainImg)
  }, [sizeStr, edit, mainImg])

  useEffect(() => { redraw() }, [redraw])

  const updateEdit = (partial: Partial<EditState>) => {
    setEdit(prev => ({ ...prev, ...partial }))
  }

  const handleRotate = () => {
    updateEdit({ rotation: (edit.rotation + 90) % 360 })
  }

  const togglePanel = (panel: string) => {
    if (activePanel === panel) {
      setActivePanel(null)
      if (panel === 'grout') updateEdit({ groutEnabled: false })
    } else {
      setActivePanel(panel)
      if (panel === 'grout') updateEdit({ groutEnabled: true })
    }
  }

  const handleMix = (mode: 'grid' | 'half' | 'third') => {
    if (edit.mixMode === mode) {
      updateEdit({ mixMode: 'none', mixSelections: [] })
      return
    }
    const count = getMixTileCount(mode, sizeStr)
    const picks: HTMLImageElement[] = []
    for (let i = 0; i < count; i++) {
      picks.push(allImgs[Math.floor(Math.random() * allImgs.length)])
    }
    updateEdit({ mixMode: mode, mixSelections: picks })
  }

  const handleInsert = () => {
    if (!canvasRef.current || !onInsertRequest) return
    setInserting(true)
    const dataUrl = canvasRef.current.toDataURL('image/png')
    const finalMM = calcFinalSizeMM(sizeStr, edit)
    const finalSizeStr = finalMM ? `${Math.round(finalMM.w)}x${Math.round(finalMM.h)}` : sizeStr
    onInsertRequest(dataUrl, vendorName, tileName, finalSizeStr)
    setTimeout(() => setInserting(false), 1500)
  }

  const finalMM = calcFinalSizeMM(sizeStr, edit)
  const hasMix = allImgs.length > 1

  if (images.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Eye className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-xs">마감재를 다운로드하면<br />프리뷰가 표시됩니다</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-2 gap-1.5 overflow-y-auto">
      {/* Canvas */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-secondary/30 rounded overflow-hidden">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain"
          style={{ imageRendering: 'auto' }}
        />
      </div>

      {/* Info */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
        <span>{tileName}</span>
        {finalMM && <span>{Math.round(finalMM.w)} × {Math.round(finalMM.h)} mm</span>}
      </div>

      {/* Tool Row 1 */}
      <div className="flex gap-1">
        <Button
          variant={edit.rotation > 0 ? 'secondary' : 'ghost'}
          size="sm" className="h-7 text-[10px] flex-1 gap-1"
          onClick={handleRotate}
        >
          <RotateCw className="w-3 h-3" />
          회전
        </Button>
        <Button
          variant={activePanel === 'color' ? 'secondary' : 'ghost'}
          size="sm" className="h-7 text-[10px] flex-1 gap-1"
          onClick={() => togglePanel('color')}
        >
          <Palette className="w-3 h-3" />
          색상
        </Button>
        <Button
          variant={activePanel === 'grout' ? 'secondary' : 'ghost'}
          size="sm" className="h-7 text-[10px] flex-1 gap-1"
          onClick={() => togglePanel('grout')}
        >
          <Grid3X3 className="w-3 h-3" />
          줄눈
        </Button>
      </div>

      {/* Color panel */}
      {activePanel === 'color' && (
        <div className="space-y-1 px-1 py-1.5 bg-secondary/30 rounded text-[10px]">
          <label className="flex items-center gap-2">
            <span className="w-12">Hue</span>
            <input type="range" min="-180" max="180" value={edit.hue}
              onChange={e => updateEdit({ hue: +e.target.value })}
              className="flex-1 h-1" />
            <span className="w-8 text-right">{edit.hue}°</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-12">채도</span>
            <input type="range" min="0" max="200" value={edit.saturation}
              onChange={e => updateEdit({ saturation: +e.target.value })}
              className="flex-1 h-1" />
            <span className="w-8 text-right">{edit.saturation}%</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-12">밝기</span>
            <input type="range" min="0" max="200" value={edit.brightness}
              onChange={e => updateEdit({ brightness: +e.target.value })}
              className="flex-1 h-1" />
            <span className="w-8 text-right">{edit.brightness}%</span>
          </label>
        </div>
      )}

      {/* Grout panel */}
      {activePanel === 'grout' && (
        <div className="space-y-1 px-1 py-1.5 bg-secondary/30 rounded text-[10px]">
          <label className="flex items-center gap-2">
            <span className="w-12">두께</span>
            <input type="range" min="0.5" max="10" step="0.5" value={edit.groutThickness}
              onChange={e => updateEdit({ groutThickness: +e.target.value })}
              className="flex-1 h-1" />
            <span className="w-8 text-right">{edit.groutThickness.toFixed(1)}mm</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-12">색상</span>
            <input type="color" value={edit.groutColor}
              onChange={e => updateEdit({ groutColor: e.target.value })}
              className="w-6 h-5 border rounded cursor-pointer" />
          </label>
        </div>
      )}

      {/* Mix Row */}
      {hasMix && (
        <div className="flex gap-1">
          <Button
            variant={edit.mixMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm" className="h-7 text-[10px] flex-1 gap-1"
            onClick={() => handleMix('grid')}
          >
            <Grid3X3 className="w-3 h-3" />
            Mix
          </Button>
          <Button
            variant={edit.mixMode === 'half' ? 'secondary' : 'ghost'}
            size="sm" className="h-7 text-[10px] flex-1 gap-1"
            onClick={() => handleMix('half')}
          >
            <Columns2 className="w-3 h-3" />
            1/2
          </Button>
          <Button
            variant={edit.mixMode === 'third' ? 'secondary' : 'ghost'}
            size="sm" className="h-7 text-[10px] flex-1 gap-1"
            onClick={() => handleMix('third')}
          >
            <Columns3 className="w-3 h-3" />
            1/3
          </Button>
        </div>
      )}

      {/* Insert */}
      <Button
        className="w-full h-8 text-xs"
        onClick={handleInsert}
        disabled={inserting || !mainImg}
      >
        {inserting ? 'Inserting...' : 'Insert Material'}
      </Button>
    </div>
  )
}
