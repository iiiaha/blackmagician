import { useRef, useEffect, useCallback, useState } from 'react'
import { Eye } from 'lucide-react'
import {
  type EditState, defaultEditState, drawCanvas, calcFinalSizeMM,
  loadImage, getMixTileCount,
} from '@/lib/canvas'
import type { ProductImage, Product } from '@/types/database'

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

  useEffect(() => {
    setEdit({ ...defaultEditState })
    setShowColor(false)
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
    <div className="h-full flex flex-col p-3 gap-2.5 overflow-y-auto">
      {/* Canvas */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-[rgba(0,0,0,0.025)] border border-border rounded-[4px] overflow-hidden">
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
      </div>

      {/* Info */}
      <div className="flex items-center justify-between text-[9px] text-text-secondary">
        <span className="font-medium truncate max-w-[60%]">{tileName}</span>
        {finalMM && <span className="text-text-tertiary">{Math.round(finalMM.w)}×{Math.round(finalMM.h)}mm</span>}
      </div>

      {/* Tools - with text labels */}
      <div className="flex gap-[3px]">
        <ToolBtn label="Rotate" active={edit.rotation > 0}
          onClick={() => updateEdit({ rotation: (edit.rotation + 90) % 360 })} />
        <ToolBtn label="Color" active={showColor}
          onClick={() => setShowColor(!showColor)} />
        <ToolBtn label="Grout" active={edit.groutEnabled}
          onClick={() => updateEdit({ groutEnabled: !edit.groutEnabled })} />
        {hasMix && (
          <>
            <ToolBtn label="Mix" active={edit.mixMode === 'grid'}
              onClick={() => handleMix('grid')} />
            <ToolBtn label="½" active={edit.mixMode === 'half'}
              onClick={() => handleMix('half')} />
            <ToolBtn label="⅓" active={edit.mixMode === 'third'}
              onClick={() => handleMix('third')} />
          </>
        )}
      </div>

      {/* Color Panel - toggled */}
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

      {/* Grout Panel - always visible, enabled/disabled by grout toggle */}
      <div className={`p-2 bg-[rgba(0,0,0,0.02)] border border-border rounded-[4px] ${
        edit.groutEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
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

      {/* Product Info Table */}
      {product && (product.unit_price !== null || product.stock !== null || product.moq !== null || product.lead_time || product.notes) && (
        <table className="w-full text-[9px] border border-border rounded-[3px] overflow-hidden">
          <tbody>
            {product.unit_price !== null && (
              <tr className="border-b border-border">
                <td className="px-2 py-[3px] text-text-secondary font-semibold bg-[rgba(0,0,0,0.02)] w-[50px]">단가</td>
                <td className="px-2 py-[3px]">{Number(product.unit_price).toLocaleString()}원</td>
              </tr>
            )}
            {product.stock !== null && (
              <tr className="border-b border-border">
                <td className="px-2 py-[3px] text-text-secondary font-semibold bg-[rgba(0,0,0,0.02)]">재고</td>
                <td className="px-2 py-[3px]">{product.stock}개</td>
              </tr>
            )}
            {product.moq !== null && (
              <tr className="border-b border-border">
                <td className="px-2 py-[3px] text-text-secondary font-semibold bg-[rgba(0,0,0,0.02)]">MOQ</td>
                <td className="px-2 py-[3px]">{product.moq}개</td>
              </tr>
            )}
            {product.lead_time && (
              <tr className="border-b border-border">
                <td className="px-2 py-[3px] text-text-secondary font-semibold bg-[rgba(0,0,0,0.02)]">LT</td>
                <td className="px-2 py-[3px]">{product.lead_time}</td>
              </tr>
            )}
            {product.notes && (
              <tr>
                <td className="px-2 py-[3px] text-text-secondary font-semibold bg-[rgba(0,0,0,0.02)]">비고</td>
                <td className="px-2 py-[3px]">{product.notes}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

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

function ToolBtn({ label, active, onClick }: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 h-[26px] flex items-center justify-center rounded-[3px] text-[9px] font-semibold cursor-pointer ${
        active
          ? 'bg-foreground text-white'
          : 'bg-[rgba(0,0,0,0.04)] text-text-secondary hover:bg-[rgba(0,0,0,0.07)]'
      }`}
    >
      {label}
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
