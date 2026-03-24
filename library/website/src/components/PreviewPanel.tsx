import { useRef, useEffect, useCallback, useState } from 'react'
import { RotateCw, Palette } from 'lucide-react'
import {
  type EditState, defaultEditState, drawCanvas, calcFinalSizeMM,
  loadImage, getMixTileCount,
} from '@/lib/canvas'
import type { ProductImage, Product, Vendor } from '@/types/database'

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
      <rect x="1" y="1" width="4" height="4" rx="0.3" /><rect x="6" y="1" width="4" height="4" rx="0.3" /><rect x="11" y="1" width="4" height="4" rx="0.3" />
      <rect x="1" y="6" width="4" height="4" rx="0.3" /><rect x="6" y="6" width="4" height="4" rx="0.3" /><rect x="11" y="6" width="4" height="4" rx="0.3" />
      <rect x="1" y="11" width="4" height="4" rx="0.3" /><rect x="6" y="11" width="4" height="4" rx="0.3" /><rect x="11" y="11" width="4" height="4" rx="0.3" />
    </svg>
  )
}

function HalfStaggerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1" y="2.5" width="12" height="5" rx="0.5" />
      <rect x="7" y="8.5" width="12" height="5" rx="0.5" />
    </svg>
  )
}

function ThirdStaggerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1" y="1" width="11" height="4" rx="0.5" />
      <rect x="5" y="6" width="11" height="4" rx="0.5" />
      <rect x="9" y="11" width="11" height="4" rx="0.5" />
    </svg>
  )
}

interface Props {
  images: ProductImage[]
  sizeStr: string
  vendorName: string
  tileName: string
  product?: Product | null
  vendor?: Vendor | null
  remaining: number
  maxDownloads: number
  loggedIn: boolean
  onInsertRequest?: (dataUrl: string, vendor: string, tileName: string, sizeStr: string) => void
  onLoginRequest?: () => void
}

export default function PreviewPanel({ images, sizeStr, vendorName, tileName, product, vendor, remaining, maxDownloads, loggedIn, onInsertRequest, onLoginRequest }: Props) {
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
    if (edit.mixMode === mode) { updateEdit({ mixMode: 'none', mixSelections: [] }); return }
    const count = getMixTileCount(mode, sizeStr)
    const picks: HTMLImageElement[] = []
    for (let i = 0; i < count; i++) picks.push(allImgs[Math.floor(Math.random() * allImgs.length)])
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

  const isEmpty = images.length === 0

  return (
    <div className="h-full flex flex-col p-3 gap-2 overflow-y-auto">
      {/* Canvas */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-muted border border-border rounded-[4px] overflow-hidden">
        {isEmpty ? (
          <p className="text-[10px] text-text-tertiary">Select a material</p>
        ) : (
          <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
        )}
      </div>

      {/* Info */}
      <div className={`flex items-center justify-between text-[9px] text-text-secondary ${isEmpty ? 'opacity-30' : ''}`}>
        <span className="font-semibold truncate max-w-[60%]">{tileName || '-'}</span>
        <span className="text-text-tertiary">{finalMM ? `${Math.round(finalMM.w)}×${Math.round(finalMM.h)}mm` : '-'}</span>
      </div>

      {/* Toolbar */}
      <div className={`flex gap-[3px] ${isEmpty ? 'opacity-30 pointer-events-none' : ''}`}>
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

      {/* Color */}
      {showColor && !isEmpty && (
        <div className="space-y-1 p-2 bg-muted border border-border rounded-[4px]">
          <SliderRow label="Hue" value={edit.hue} min={-180} max={180} unit="°" onChange={v => updateEdit({ hue: v })} />
          <SliderRow label="Sat" value={edit.saturation} min={0} max={200} unit="%" onChange={v => updateEdit({ saturation: v })} />
          <SliderRow label="Bri" value={edit.brightness} min={0} max={200} unit="%" onChange={v => updateEdit({ brightness: v })} />
        </div>
      )}

      {/* Grout — always visible */}
      <div className={`px-2 py-1.5 bg-muted border border-border rounded-[4px] ${(isEmpty || !edit.groutEnabled) ? 'opacity-30 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-semibold text-text-secondary shrink-0">Thick</span>
          <button onClick={() => updateEdit({ groutThickness: Math.max(0.5, edit.groutThickness - 0.5) })}
            className="w-[20px] h-[20px] flex items-center justify-center bg-surface border border-border rounded-[3px] text-[11px] font-bold text-muted-foreground hover:text-foreground cursor-pointer leading-none">−</button>
          <span className="text-[10px] font-semibold w-[32px] text-center tabular-nums">{edit.groutThickness.toFixed(1)}</span>
          <button onClick={() => updateEdit({ groutThickness: Math.min(10, edit.groutThickness + 0.5) })}
            className="w-[20px] h-[20px] flex items-center justify-center bg-surface border border-border rounded-[3px] text-[11px] font-bold text-muted-foreground hover:text-foreground cursor-pointer leading-none">+</button>
          <span className="text-[9px] text-text-tertiary">mm</span>
          <input type="color" value={edit.groutColor} onChange={e => updateEdit({ groutColor: e.target.value })}
            className="w-[28px] h-[20px] border border-border rounded-[3px] cursor-pointer p-[2px] ml-auto" />
        </div>
      </div>

      {/* Product Info */}
      <table className={`w-full text-[9px] border border-border rounded-[3px] overflow-hidden ${isEmpty ? 'opacity-30' : ''}`}>
        <tbody>
          <tr className="border-b border-border">
            <td className="px-2 py-[3px] text-text-secondary font-semibold bg-muted w-[40px]">크기</td>
            <td className="px-2 py-[3px]">{product?.size || '-'}</td>
          </tr>
          <tr className="border-b border-border">
            <td className="px-2 py-[3px] text-text-secondary font-semibold bg-muted">단가</td>
            <td className="px-2 py-[3px]">{product?.unit_price != null ? `${Number(product.unit_price).toLocaleString()}원` : '-'}</td>
          </tr>
          <tr className="border-b border-border">
            <td className="px-2 py-[3px] text-text-secondary font-semibold bg-muted">원산지</td>
            <td className="px-2 py-[3px]">{product?.origin || '-'}</td>
          </tr>
          <tr className="border-b border-border">
            <td className="px-2 py-[3px] text-text-secondary font-semibold bg-muted">브랜드</td>
            <td className="px-2 py-[3px]">{product?.brand || '-'}</td>
          </tr>
          <tr>
            <td className="px-2 py-[3px] text-text-secondary font-semibold bg-muted">재고</td>
            <td className="px-2 py-[3px]">{product?.stock != null ? `${product.stock}` : '-'}</td>
          </tr>
        </tbody>
      </table>

      {/* Apply */}
      <button
        className="w-full h-[30px] bg-foreground hover:bg-foreground/85 text-primary-foreground text-[10px] font-semibold tracking-[0.3px] rounded-[4px] cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed transition-colors relative flex items-center justify-center"
        onClick={loggedIn ? handleInsert : onLoginRequest}
        disabled={loggedIn && (inserting || !mainImg || isEmpty)}
      >
        <span className="leading-none">{inserting ? 'Applying...' : 'Apply to Bucket'}</span>
        {loggedIn && <span className="absolute right-3 text-[9px] font-normal opacity-50 leading-none">{remaining}/{maxDownloads}</span>}
      </button>
    </div>
  )
}

function ToolBtn({ icon, active, onClick, title, disabled }: {
  icon: React.ReactNode; active: boolean; onClick: () => void; title: string; disabled?: boolean
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={`flex-1 h-[26px] flex items-center justify-center rounded-[3px] cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed ${
        active ? 'bg-foreground text-primary-foreground' : 'bg-muted text-text-secondary hover:bg-accent'
      }`}>
      {icon}
    </button>
  )
}

function SliderRow({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-semibold text-text-secondary w-[24px] shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step || 1} value={value} onChange={e => onChange(+e.target.value)} className="flex-1" />
      <span className="text-[9px] text-text-tertiary w-[30px] text-right tabular-nums">{value}{unit}</span>
    </div>
  )
}
