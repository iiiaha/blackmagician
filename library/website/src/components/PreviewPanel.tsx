import { useRef, useEffect, useCallback, useState } from 'react'
import { RotateCw, Palette, Eye } from 'lucide-react'
import {
  type EditState, defaultEditState, drawCanvas, calcFinalSizeMM,
  loadImage, getMixTileCount,
} from '@/lib/canvas'
import type { ProductImage, Product } from '@/types/database'

// Custom SVG icons
function GroutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="6" rx="0.5" />
      <rect x="9" y="1" width="6" height="6" rx="0.5" />
      <rect x="1" y="9" width="6" height="6" rx="0.5" />
      <rect x="9" y="9" width="6" height="6" rx="0.5" />
    </svg>
  )
}

function MixIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="1" y="1" width="4" height="4" rx="0.3" />
      <rect x="6" y="1" width="4" height="4" rx="0.3" />
      <rect x="11" y="1" width="4" height="4" rx="0.3" />
      <rect x="1" y="6" width="4" height="4" rx="0.3" />
      <rect x="6" y="6" width="4" height="4" rx="0.3" />
      <rect x="11" y="6" width="4" height="4" rx="0.3" />
      <rect x="1" y="11" width="4" height="4" rx="0.3" />
      <rect x="6" y="11" width="4" height="4" rx="0.3" />
      <rect x="11" y="11" width="4" height="4" rx="0.3" />
    </svg>
  )
}

function HalfStaggerIcon({ className }: { className?: string }) {
  // Two planks stacked, bottom shifted right by 1/2
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1" y="3" width="14" height="4" rx="0.5" />
      <rect x="8" y="9" width="14" height="4" rx="0.5" strokeDasharray="0" />
      <rect x="-6" y="9" width="14" height="4" rx="0.5" />
    </svg>
  )
}

function ThirdStaggerIcon({ className }: { className?: string }) {
  // Three planks stacked like stairs, each shifted by 1/3
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1" y="1" width="14" height="3.5" rx="0.5" />
      <rect x="5.5" y="6" width="14" height="3.5" rx="0.5" />
      <rect x="10" y="11" width="14" height="3.5" rx="0.5" />
    </svg>
  )
}

interface Props {
  images: ProductImage[]
  sizeStr: string
  vendorName: string
  tileName: string
  product?: Product | null
  onInsertRequest?: (dataUrl: string, vendor: string, tileName: string, sizeStr: string) => void
}

export default function PreviewPanel({ images, sizeStr, vendorName, tileName, product, onInsertRequest }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [edit, setEdit] = useState<EditState>({ ...defaultEditState })
  const [mainImg, setMainImg] = useState<HTMLImageElement | null>(null)
  const [allImgs, setAllImgs] = useState<HTMLImageElement[]>([])
  const [showColor, setShowColor] = useState(false)
  const [inserting, setInserting] = useState(false)

  const hasMix = allImgs.length > 1

  useEffect(() => {
    setEdit({ ...defaultEditState })
    setShowColor(false)
    if (images.length === 0) { setMainImg(null); setAllImgs([]); return }
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
    <div className="h-full flex flex-col p-3 gap-2 overflow-y-auto">
      {/* Canvas */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-[rgba(0,0,0,0.025)] border border-border rounded-[4px] overflow-hidden">
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
      </div>

      {/* Info */}
      <div className="flex items-center justify-between text-[9px] text-text-secondary">
        <span className="font-semibold truncate max-w-[60%]">{tileName}</span>
        {finalMM && <span className="text-text-tertiary">{Math.round(finalMM.w)}×{Math.round(finalMM.h)}mm</span>}
      </div>

      {/* Toolbar */}
      <div className="flex gap-[3px]">
        <ToolBtn icon={<RotateCw className="w-3.5 h-3.5" />} active={edit.rotation > 0}
          onClick={() => updateEdit({ rotation: (edit.rotation + 90) % 360 })} title="Rotate" />
        <ToolBtn icon={<Palette className="w-3.5 h-3.5" />} active={showColor}
          onClick={() => setShowColor(!showColor)} title="Color" />
        <ToolBtn icon={<GroutIcon className="w-3.5 h-3.5" />} active={edit.groutEnabled}
          onClick={() => updateEdit({ groutEnabled: !edit.groutEnabled })} title="Grout" />
        <div className="w-px bg-border mx-[1px]" />
        <ToolBtn icon={<MixIcon className="w-3.5 h-3.5" />} active={edit.mixMode === 'grid'}
          onClick={() => handleMix('grid')} title="Mix 3×3" disabled={!hasMix} />
        <ToolBtn icon={<HalfStaggerIcon className="w-3.5 h-3.5" />} active={edit.mixMode === 'half'}
          onClick={() => handleMix('half')} title="1/2 Stagger" disabled={!hasMix} />
        <ToolBtn icon={<ThirdStaggerIcon className="w-3.5 h-3.5" />} active={edit.mixMode === 'third'}
          onClick={() => handleMix('third')} title="1/3 Stagger" disabled={!hasMix} />
      </div>

      {/* Color Panel */}
      {showColor && (
        <div className="space-y-1 p-2 bg-[rgba(0,0,0,0.02)] border border-border rounded-[4px]">
          <SliderRow label="Hue" value={edit.hue} min={-180} max={180} unit="°"
            onChange={v => updateEdit({ hue: v })} />
          <SliderRow label="Sat" value={edit.saturation} min={0} max={200} unit="%"
            onChange={v => updateEdit({ saturation: v })} />
          <SliderRow label="Bri" value={edit.brightness} min={0} max={200} unit="%"
            onChange={v => updateEdit({ brightness: v })} />
        </div>
      )}

      {/* Grout Panel — always visible, enabled/disabled */}
      <div className={`p-2 bg-[rgba(0,0,0,0.02)] border border-border rounded-[4px] ${
        edit.groutEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-semibold text-text-secondary w-[36px] shrink-0">Thick</span>
          <input type="number" value={edit.groutThickness} min={0.5} max={10} step={0.5}
            onChange={e => updateEdit({ groutThickness: +e.target.value })}
            className="flex-1 h-[24px] text-center text-[11px] font-semibold bg-white border border-border rounded-[3px] outline-none focus:border-foreground" />
          <span className="text-[9px] text-text-tertiary">mm</span>
          <input type="color" value={edit.groutColor}
            onChange={e => updateEdit({ groutColor: e.target.value })}
            className="w-[24px] h-[24px] border border-border rounded-[3px] cursor-pointer p-0" />
        </div>
      </div>

      {/* Product Info Table — always present */}
      <table className="w-full text-[9px] border border-border rounded-[3px] overflow-hidden">
        <tbody>
          <tr className="border-b border-border">
            <td className="px-2 py-[3px] text-text-secondary font-semibold bg-[rgba(0,0,0,0.02)] w-[44px]">단가</td>
            <td className="px-2 py-[3px]">{product?.unit_price !== null && product?.unit_price !== undefined ? `${Number(product.unit_price).toLocaleString()}원` : '-'}</td>
          </tr>
          <tr className="border-b border-border">
            <td className="px-2 py-[3px] text-text-secondary font-semibold bg-[rgba(0,0,0,0.02)]">재고</td>
            <td className="px-2 py-[3px]">{product?.stock !== null && product?.stock !== undefined ? `${product.stock}개` : '-'}</td>
          </tr>
          <tr className="border-b border-border">
            <td className="px-2 py-[3px] text-text-secondary font-semibold bg-[rgba(0,0,0,0.02)]">MOQ</td>
            <td className="px-2 py-[3px]">{product?.moq !== null && product?.moq !== undefined ? `${product.moq}개` : '-'}</td>
          </tr>
          <tr className="border-b border-border">
            <td className="px-2 py-[3px] text-text-secondary font-semibold bg-[rgba(0,0,0,0.02)]">LT</td>
            <td className="px-2 py-[3px]">{product?.lead_time || '-'}</td>
          </tr>
          <tr>
            <td className="px-2 py-[3px] text-text-secondary font-semibold bg-[rgba(0,0,0,0.02)]">비고</td>
            <td className="px-2 py-[3px]">{product?.notes || '-'}</td>
          </tr>
        </tbody>
      </table>

      {/* Apply */}
      <button
        className="w-full h-[30px] bg-[#5a5a5a] hover:bg-[#4a4a4a] text-white text-[10px] font-semibold uppercase tracking-[0.5px] rounded-[4px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={handleInsert}
        disabled={inserting || !mainImg}
      >
        {inserting ? 'Applying...' : 'Apply to Bucket'}
      </button>
    </div>
  )
}

function ToolBtn({ icon, active, onClick, title, disabled }: {
  icon: React.ReactNode
  active: boolean
  onClick: () => void
  title: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`flex-1 h-[28px] flex items-center justify-center rounded-[3px] cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed ${
        active
          ? 'bg-foreground text-white'
          : 'bg-[rgba(0,0,0,0.04)] text-text-secondary hover:bg-[rgba(0,0,0,0.07)]'
      }`}
    >
      {icon}
    </button>
  )
}

function SliderRow({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-semibold text-text-secondary w-[24px] shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step || 1} value={value}
        onChange={e => onChange(+e.target.value)}
        className="flex-1" />
      <span className="text-[9px] text-text-tertiary w-[30px] text-right tabular-nums">
        {value}{unit}
      </span>
    </div>
  )
}
