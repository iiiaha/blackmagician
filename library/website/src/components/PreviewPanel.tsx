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

  useEffect(() => {
    setEdit({ ...defaultEditState })
    setActivePanel(null)
    if (images.length === 0) return
    loadImage(images[0].url).then(img => setMainImg(img))
    Promise.all(images.map(i => loadImage(i.url))).then(imgs => setAllImgs(imgs))
  }, [images])

  const redraw = useCallback(() => {
    if (!canvasRef.current || !mainImg) return
    drawCanvas(canvasRef.current, sizeStr, edit, mainImg)
  }, [sizeStr, edit, mainImg])

  useEffect(() => { redraw() }, [redraw])

  const updateEdit = (partial: Partial<EditState>) => {
    setEdit(prev => ({ ...prev, ...partial }))
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
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Eye className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground/20" />
          <p className="text-[11px] text-muted-foreground/40 leading-relaxed">
            제품을 선택하면<br />프리뷰가 표시됩니다
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-3 gap-2 overflow-y-auto">
      {/* Canvas */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-[#f0f0f0] rounded-sm overflow-hidden">
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
      </div>

      {/* Info */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-0.5">
        <span className="font-medium truncate">{tileName}</span>
        {finalMM && <span>{Math.round(finalMM.w)} × {Math.round(finalMM.h)} mm</span>}
      </div>

      {/* Toolbar */}
      <div className="flex gap-1">
        <ToolBtn icon={RotateCw} active={edit.rotation > 0}
          onClick={() => updateEdit({ rotation: (edit.rotation + 90) % 360 })} title="회전" />
        <ToolBtn icon={Palette} active={activePanel === 'color'}
          onClick={() => togglePanel('color')} title="색상" />
        <ToolBtn icon={Grid3X3} active={activePanel === 'grout'}
          onClick={() => togglePanel('grout')} title="줄눈" />
        {hasMix && (
          <>
            <div className="w-px bg-border mx-0.5" />
            <ToolBtn icon={Grid3X3} active={edit.mixMode === 'grid'}
              onClick={() => handleMix('grid')} title="Mix" label="M" />
            <ToolBtn icon={Columns2} active={edit.mixMode === 'half'}
              onClick={() => handleMix('half')} title="1/2" />
            <ToolBtn icon={Columns3} active={edit.mixMode === 'third'}
              onClick={() => handleMix('third')} title="1/3" />
          </>
        )}
      </div>

      {/* Color Panel */}
      {activePanel === 'color' && (
        <div className="space-y-1.5 px-1 py-2 bg-secondary rounded-sm">
          <Slider label="Hue" value={edit.hue} min={-180} max={180} unit="°"
            onChange={v => updateEdit({ hue: v })} />
          <Slider label="채도" value={edit.saturation} min={0} max={200} unit="%"
            onChange={v => updateEdit({ saturation: v })} />
          <Slider label="밝기" value={edit.brightness} min={0} max={200} unit="%"
            onChange={v => updateEdit({ brightness: v })} />
        </div>
      )}

      {/* Grout Panel */}
      {activePanel === 'grout' && (
        <div className="space-y-1.5 px-1 py-2 bg-secondary rounded-sm">
          <Slider label="두께" value={edit.groutThickness} min={0.5} max={10} step={0.5} unit="mm"
            onChange={v => updateEdit({ groutThickness: v })} fixed={1} />
          <div className="flex items-center gap-2 text-[10px]">
            <span className="w-10 text-muted-foreground">색상</span>
            <input type="color" value={edit.groutColor}
              onChange={e => updateEdit({ groutColor: e.target.value })}
              className="w-5 h-5 border-0 rounded-sm cursor-pointer p-0" />
          </div>
        </div>
      )}

      {/* Insert */}
      <Button className="w-full h-8 text-xs font-bold rounded-sm" onClick={handleInsert}
        disabled={inserting || !mainImg}>
        {inserting ? 'Inserting...' : 'INSERT MATERIAL'}
      </Button>
    </div>
  )
}

function ToolBtn({ icon: Icon, active, onClick, title, label }: {
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  onClick: () => void
  title: string
  label?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex-1 h-7 flex items-center justify-center gap-0.5 rounded-sm text-[10px] font-medium transition-all cursor-pointer ${
        active
          ? 'bg-foreground text-background'
          : 'bg-secondary text-foreground/60 hover:text-foreground hover:bg-secondary/80'
      }`}
    >
      {label ? <span>{label}</span> : <Icon className="w-3 h-3" />}
    </button>
  )
}

function Slider({ label, value, min, max, step, unit, onChange, fixed }: {
  label: string; value: number; min: number; max: number; step?: number; unit: string
  onChange: (v: number) => void; fixed?: number
}) {
  return (
    <label className="flex items-center gap-2 text-[10px]">
      <span className="w-10 text-muted-foreground shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step || 1} value={value}
        onChange={e => onChange(+e.target.value)}
        className="flex-1 h-1 accent-foreground" />
      <span className="w-10 text-right tabular-nums">
        {fixed !== undefined ? value.toFixed(fixed) : value}{unit}
      </span>
    </label>
  )
}
