import { useRef, useEffect, useCallback, useState } from 'react'
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
          <Eye className="w-4 h-4 mx-auto mb-1.5 text-text-tertiary opacity-30" />
          <p className="text-[10px] text-text-tertiary leading-relaxed">Select a material</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-4 gap-3 overflow-y-auto">
      {/* Canvas */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-[rgba(0,0,0,0.02)] border border-border rounded-[4px] overflow-hidden">
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
      </div>

      {/* Info */}
      <div className="flex items-center justify-between text-[9px] text-text-secondary px-0.5">
        <span className="font-medium truncate max-w-[60%]">{tileName}</span>
        {finalMM && <span className="text-text-tertiary">{Math.round(finalMM.w)}×{Math.round(finalMM.h)}mm</span>}
      </div>

      {/* Toolbar */}
      <div className="flex gap-[2px]">
        <ToolBtn icon={RotateCw} active={edit.rotation > 0}
          onClick={() => updateEdit({ rotation: (edit.rotation + 90) % 360 })} title="Rotate" />
        <ToolBtn icon={Palette} active={activePanel === 'color'}
          onClick={() => togglePanel('color')} title="Color" />
        <ToolBtn icon={Grid3X3} active={activePanel === 'grout'}
          onClick={() => togglePanel('grout')} title="Grout" />
        {hasMix && (
          <>
            <div className="w-px bg-border mx-[2px]" />
            <ToolBtn icon={Grid3X3} active={edit.mixMode === 'grid'}
              onClick={() => handleMix('grid')} title="Mix" />
            <ToolBtn icon={Columns2} active={edit.mixMode === 'half'}
              onClick={() => handleMix('half')} title="½" />
            <ToolBtn icon={Columns3} active={edit.mixMode === 'third'}
              onClick={() => handleMix('third')} title="⅓" />
          </>
        )}
      </div>

      {/* Color Panel */}
      {activePanel === 'color' && (
        <div className="space-y-1.5 p-2 bg-[rgba(0,0,0,0.02)] border border-border rounded-[4px]">
          <SliderRow label="HUE" value={edit.hue} min={-180} max={180} unit="°"
            onChange={v => updateEdit({ hue: v })} />
          <SliderRow label="SAT" value={edit.saturation} min={0} max={200} unit="%"
            onChange={v => updateEdit({ saturation: v })} />
          <SliderRow label="BRI" value={edit.brightness} min={0} max={200} unit="%"
            onChange={v => updateEdit({ brightness: v })} />
        </div>
      )}

      {/* Grout Panel */}
      {activePanel === 'grout' && (
        <div className="p-2 bg-[rgba(0,0,0,0.02)] border border-border rounded-[4px] space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-semibold text-text-secondary uppercase tracking-[0.3px] w-[42px]">Thick</span>
            <input type="number" value={edit.groutThickness} min={0.5} max={10} step={0.5}
              onChange={e => updateEdit({ groutThickness: +e.target.value })}
              className="flex-1 h-[26px] text-center text-[12px] font-semibold bg-[rgba(0,0,0,0.02)] border border-border rounded-[4px] outline-none focus:border-foreground" />
            <span className="text-[9px] text-text-tertiary">mm</span>
            <input type="color" value={edit.groutColor}
              onChange={e => updateEdit({ groutColor: e.target.value })}
              className="w-[26px] h-[26px] border border-border rounded-[4px] cursor-pointer p-0" />
          </div>
        </div>
      )}

      {/* Generate / Insert */}
      <button
        className="w-full h-[32px] bg-[#6a6a6a] hover:bg-[#5a5a5a] text-white text-[11px] font-semibold uppercase tracking-[0.5px] rounded-[4px] cursor-pointer transition-all hover:-translate-y-[1px] hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)] active:translate-y-0 active:shadow-[0_1px_3px_rgba(0,0,0,0.15)] disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
        onClick={handleInsert}
        disabled={inserting || !mainImg}
      >
        {inserting ? 'Inserting...' : 'Generate'}
      </button>
    </div>
  )
}

function ToolBtn({ icon: Icon, active, onClick, title }: {
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  onClick: () => void
  title: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex-1 h-[28px] flex items-center justify-center rounded-[4px] cursor-pointer transition-all ${
        active
          ? 'bg-[rgba(0,0,0,0.08)] border border-[rgba(0,0,0,0.12)]'
          : 'bg-[rgba(0,0,0,0.02)] border border-border hover:bg-[rgba(0,0,0,0.04)] hover:border-[rgba(0,0,0,0.12)]'
      }`}
    >
      <Icon className="w-3 h-3" />
    </button>
  )
}

function SliderRow({ label, value, min, max, step, unit, onChange, fixed }: {
  label: string; value: number; min: number; max: number; step?: number; unit: string
  onChange: (v: number) => void; fixed?: number
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-semibold text-text-secondary uppercase tracking-[0.3px] w-[28px] shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step || 1} value={value}
        onChange={e => onChange(+e.target.value)}
        className="flex-1" />
      <span className="text-[9px] text-text-tertiary w-[32px] text-right tabular-nums">
        {fixed !== undefined ? value.toFixed(fixed) : value}{unit}
      </span>
    </div>
  )
}
