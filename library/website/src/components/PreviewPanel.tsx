import { useRef, useEffect, useCallback, useState } from 'react'
import { RotateCw, Palette } from 'lucide-react'
import {
  type EditState, defaultEditState, drawCanvas, calcFinalSizeMM,
  loadImage, getMixTileCount, parseSizeMM,
} from '@/lib/canvas'
import type { ProductImage, Product } from '@/types/database'

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
  loggedIn: boolean
  canApply: boolean
  onInsertRequest?: (dataUrl: string, vendor: string, tileName: string, sizeStr: string) => void
  onLoginRequest?: () => void
  onApplyLog?: (productId: string) => Promise<boolean>
}

export default function PreviewPanel({ images, sizeStr, vendorName, tileName, product, loggedIn, canApply, onInsertRequest, onLoginRequest, onApplyLog }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [edit, setEdit] = useState<EditState>({ ...defaultEditState })
  const [mainImg, setMainImg] = useState<HTMLImageElement | null>(null)
  const [allImgs, setAllImgs] = useState<HTMLImageElement[]>([])
  const allImgsRef = useRef<HTMLImageElement[]>([])
  const [showColor, setShowColor] = useState(false)
  const [inserting, setInserting] = useState(false)
  const [imgsLoading, setImgsLoading] = useState(false)

  const hasMix = allImgs.length > 1
  const willHaveMix = images.length > 1

  // Sync size orientation with image orientation
  // If image is landscape but size says portrait (or vice versa), swap w/h
  const effectiveSizeStr = (() => {
    if (!mainImg || !sizeStr) return sizeStr
    const parsed = parseSizeMM(sizeStr)
    if (!parsed) return sizeStr
    const { w, h } = parsed
    if (w === h) return sizeStr // square, no swap needed
    const imgLandscape = mainImg.naturalWidth > mainImg.naturalHeight
    const sizeLandscape = w > h
    if (imgLandscape !== sizeLandscape) {
      // Swap w and h, keep thickness if present
      const parts = sizeStr.split(/[x×*]/)
      if (parts.length >= 3) return `${parts[1]}×${parts[0]}×${parts[2]}`
      return `${parts[1]}×${parts[0]}`
    }
    return sizeStr
  })()

  useEffect(() => {
    setEdit({ ...defaultEditState })
    setShowColor(false)
    setMainImg(null)
    setAllImgs([])
    allImgsRef.current = []
    if (images.length === 0) { setImgsLoading(false); return }
    setImgsLoading(images.length > 1)
    let cancelled = false
    loadImage(images[0].url).then(img => { if (!cancelled) setMainImg(img) })
    Promise.all(images.map(i => loadImage(i.url))).then(imgs => {
      if (!cancelled) {
        setAllImgs(imgs)
        allImgsRef.current = imgs
        setImgsLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [images])

  const redraw = useCallback(() => {
    if (!canvasRef.current || !mainImg) return
    drawCanvas(canvasRef.current, effectiveSizeStr, edit, mainImg)
  }, [effectiveSizeStr, edit, mainImg])

  useEffect(() => { redraw() }, [redraw])

  const updateEdit = (partial: Partial<EditState>) => {
    setEdit(prev => ({ ...prev, ...partial }))
  }

  const handleMix = (mode: 'grid' | 'half' | 'third') => {
    if (edit.mixMode === mode) { updateEdit({ mixMode: 'none', mixSelections: [], mixRotations: [] }); return }
    const currentImgs = allImgsRef.current
    if (currentImgs.length === 0) return
    const count = getMixTileCount(mode, effectiveSizeStr)

    // Pick images: unique when pool >= count, otherwise repeat shuffled pool
    // to distribute duplicates as evenly as possible.
    const shuffle = <T,>(arr: T[]): T[] => {
      const a = arr.slice()
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    }
    const picks: HTMLImageElement[] = []
    while (picks.length < count) {
      const chunk = shuffle(currentImgs)
      for (const img of chunk) {
        if (picks.length >= count) break
        picks.push(img)
      }
    }

    // Per-tile rotation: squares get 0/90/180/270, rectangles get 0/180.
    const base = parseSizeMM(effectiveSizeStr)
    const isSquare = base ? base.w === base.h : false
    const rotChoices = isSquare ? [0, 90, 180, 270] : [0, 180]
    const rotations: number[] = []
    for (let i = 0; i < count; i++) {
      rotations.push(rotChoices[Math.floor(Math.random() * rotChoices.length)])
    }

    updateEdit({ mixMode: mode, mixSelections: picks, mixRotations: rotations })
  }

  const handleInsert = async () => {
    if (!canvasRef.current || !onInsertRequest || !mainImg) return
    if (!canApply) return

    // Log the apply (checks limit server-side)
    if (onApplyLog && product) {
      const ok = await onApplyLog(product.id)
      if (!ok) return
    }

    setInserting(true)
    // Re-draw at actual grout size for export
    drawCanvas(canvasRef.current, effectiveSizeStr, edit, mainImg, true)
    const dataUrl = canvasRef.current.toDataURL('image/png')
    // Re-draw preview version
    drawCanvas(canvasRef.current, effectiveSizeStr, edit, mainImg, false)
    const finalMM = calcFinalSizeMM(effectiveSizeStr, edit)
    const finalSizeStr = finalMM ? `${Math.round(finalMM.w)}x${Math.round(finalMM.h)}` : effectiveSizeStr
    onInsertRequest(dataUrl, vendorName, tileName, finalSizeStr)
    setTimeout(() => setInserting(false), 1500)
  }

  const finalMM = calcFinalSizeMM(effectiveSizeStr, edit)

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
          onClick={() => {
            if (showColor) {
              updateEdit({ hue: 0, saturation: 100, brightness: 100 })
            }
            setShowColor(!showColor)
          }} title="Color" />
        <ToolBtn icon={<GroutIcon className="w-3.5 h-3.5" />} active={edit.groutEnabled}
          onClick={() => updateEdit({ groutEnabled: !edit.groutEnabled })} title="Grout" />
        <div className="w-px bg-border mx-[1px]" />
        <ToolBtn icon={<MixIcon className="w-3.5 h-3.5" />} active={edit.mixMode === 'grid'}
          onClick={() => handleMix('grid')} title="Mix 3×3" disabled={!hasMix} loading={imgsLoading && willHaveMix} />
        <ToolBtn icon={<HalfStaggerIcon className="w-3.5 h-3.5" />} active={edit.mixMode === 'half'}
          onClick={() => handleMix('half')} title="1/2 Stagger" disabled={!hasMix} loading={imgsLoading && willHaveMix} />
        <ToolBtn icon={<ThirdStaggerIcon className="w-3.5 h-3.5" />} active={edit.mixMode === 'third'}
          onClick={() => handleMix('third')} title="1/3 Stagger" disabled={!hasMix} loading={imgsLoading && willHaveMix} />
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
            <td className="px-2 py-[3px] text-text-secondary font-semibold bg-muted w-[48px]">원장크기</td>
            <td className="px-2 py-[3px]">{product?.size ? `${product.size} mm` : '-'}</td>
          </tr>
          <tr className="border-b border-border">
            <td className="px-2 py-[3px] text-text-secondary font-semibold bg-muted">단가</td>
            <td className="px-2 py-[3px]">{product?.unit_price ? `${Number(product.unit_price).toLocaleString()}원/㎡` : '별도문의'}</td>
          </tr>
          <tr className="border-b border-border">
            <td className="px-2 py-[3px] text-text-secondary font-semibold bg-muted">원산지</td>
            <td className="px-2 py-[3px]">{product?.origin || '-'}</td>
          </tr>
          <tr className="border-b border-border">
            <td className="px-2 py-[3px] text-text-secondary font-semibold bg-muted">브랜드</td>
            <td className="px-2 py-[3px]">{product?.brand || '-'}</td>
          </tr>
          <tr className="border-b border-border">
            <td className="px-2 py-[3px] text-text-secondary font-semibold bg-muted">재고</td>
            <td className="px-2 py-[3px]">{product?.stock ? `${product.stock}㎡` : '별도문의'}</td>
          </tr>
          <tr>
            <td className="px-2 py-[3px] text-text-secondary font-semibold bg-muted">URL</td>
            <td className="px-2 py-[3px]">
              {product?.url ? (
                <a href={product.url} target="_blank" rel="noopener noreferrer"
                  className="text-brand hover:underline inline-flex items-center gap-0.5">
                  바로가기 <span className="text-[8px]">↗</span>
                </a>
              ) : '-'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Apply */}
      <button
        className="w-full h-[30px] bg-[#34d399] hover:opacity-85 text-white text-[10px] font-semibold tracking-[0.3px] rounded-[4px] cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        onClick={loggedIn ? handleInsert : onLoginRequest}
        disabled={loggedIn && (inserting || !mainImg || isEmpty)}
      >
        <span className="leading-none">{inserting ? 'Applying...' : 'Apply to Bucket'}</span>
      </button>
    </div>
  )
}

function ToolBtn({ icon, active, onClick, title, disabled, loading }: {
  icon: React.ReactNode; active: boolean; onClick: () => void; title: string; disabled?: boolean; loading?: boolean
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled || loading}
      className={`flex-1 h-[26px] flex items-center justify-center rounded-[3px] cursor-pointer disabled:cursor-not-allowed ${
        loading ? 'bg-muted text-text-tertiary' :
        disabled ? 'opacity-20' :
        active ? 'bg-brand text-white' : 'bg-muted text-text-secondary hover:bg-brand-light/30'
      }`}>
      {loading ? (
        <span className="w-3 h-3 border-[1.5px] border-text-tertiary/30 border-t-text-tertiary rounded-full animate-spin" />
      ) : icon}
    </button>
  )
}

function SliderRow({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const commit = () => {
    setEditing(false)
    const n = parseInt(draft, 10)
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-semibold text-text-secondary w-[24px] shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step || 1} value={value} onChange={e => onChange(+e.target.value)} className="flex-1 min-w-0" />
      {editing ? (
        <input type="text" autoFocus value={draft}
          onChange={e => setDraft(e.target.value.replace(/[^0-9-]/g, ''))}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          className="w-[36px] h-[16px] text-[9px] text-right tabular-nums bg-surface border border-input rounded-[2px] px-1 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      ) : (
        <span className="text-[9px] text-text-tertiary w-[36px] text-right tabular-nums cursor-text"
          onClick={() => { setDraft(String(value)); setEditing(true) }}>{value}{unit}</span>
      )}
    </div>
  )
}
