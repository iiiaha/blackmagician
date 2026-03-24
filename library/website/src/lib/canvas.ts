// ── Canvas drawing logic (ported from deck.js) ──

export interface EditState {
  rotation: number
  hue: number
  saturation: number
  brightness: number
  groutEnabled: boolean
  groutColor: string
  groutThickness: number
  mixMode: 'none' | 'grid' | 'half' | 'third'
  mixSelections: HTMLImageElement[]
}

export const defaultEditState: EditState = {
  rotation: 0,
  hue: 0,
  saturation: 100,
  brightness: 100,
  groutEnabled: false,
  groutColor: '#808080',
  groutThickness: 2.0,
  mixMode: 'none',
  mixSelections: [],
}

const BASE_PX_PER_MM = 4
const MAX_CANVAS_PX = 4096

export function parseSizeMM(sizeStr: string) {
  const parts = sizeStr.split(/[x×*]/).map(Number)
  if (parts.length < 2) return null
  return { w: parts[0], h: parts[1] }
}

function calcPxPerMM(totalW: number, totalH: number) {
  const maxDim = Math.max(totalW, totalH)
  if (maxDim * BASE_PX_PER_MM > MAX_CANVAS_PX) return MAX_CANVAS_PX / maxDim
  return BASE_PX_PER_MM
}

function buildFilter(edit: EditState) {
  return `hue-rotate(${edit.hue}deg) saturate(${edit.saturation}%) brightness(${edit.brightness / 100})`
}

const MAX_ASPECT_RATIO = 1.2

function getMixGrid(mixMode: string, sizeStr?: string) {
  if (mixMode === 'grid') return { cols: 3, rows: 3 }
  if (mixMode !== 'half' && mixMode !== 'third') return null

  const cols = 4
  const step = mixMode === 'half' ? 2 : 3

  // Without size info, use defaults
  if (!sizeStr) return { cols, rows: mixMode === 'half' ? 4 : 6 }

  const base = parseSizeMM(sizeStr)
  if (!base) return { cols, rows: mixMode === 'half' ? 4 : 6 }

  // Calculate rows that keep aspect ratio within MAX_ASPECT_RATIO
  const vertical = base.h > base.w
  const tileW = vertical ? base.h : base.w
  const tileH = vertical ? base.w : base.h
  const effectiveCols = vertical ? cols : cols // after stagger transpose handled elsewhere

  let rows = step
  while (true) {
    const nextRows = rows + step
    const totalW = tileW * effectiveCols
    const totalH = tileH * nextRows
    const ratio = Math.max(totalW, totalH) / Math.min(totalW, totalH)
    if (ratio > MAX_ASPECT_RATIO) break
    rows = nextRows
  }

  return { cols, rows: Math.max(rows, step) }
}

function isVerticalStagger(sizeStr: string) {
  const base = parseSizeMM(sizeStr)
  return base ? base.h > base.w : false
}

function getStaggerGrid(mixMode: string, sizeStr: string) {
  const grid = getMixGrid(mixMode, sizeStr)
  if (!grid) return null
  if (isVerticalStagger(sizeStr)) return { cols: grid.rows, rows: grid.cols }
  return grid
}

export function getMixTileCount(mixMode: string, sizeStr: string) {
  const isStagger = mixMode === 'half' || mixMode === 'third'
  if (isStagger) {
    const sg = getStaggerGrid(mixMode, sizeStr)
    return sg ? sg.cols * sg.rows : 0
  }
  const g = getMixGrid(mixMode, sizeStr)
  return g ? g.cols * g.rows : 0
}

export function calcFinalSizeMM(sizeStr: string, edit: EditState) {
  const base = parseSizeMM(sizeStr)
  if (!base) return null

  const tw = base.w, th = base.h
  const gMM = edit.groutEnabled ? edit.groutThickness : 0
  const isStagger = edit.mixMode === 'half' || edit.mixMode === 'third'

  let w: number, h: number
  if (isStagger) {
    const sg = getStaggerGrid(edit.mixMode, sizeStr)!
    w = (tw + gMM) * sg.cols
    h = (th + gMM) * sg.rows
  } else {
    const grid = getMixGrid(edit.mixMode, sizeStr)
    if (grid) {
      w = (tw + gMM) * grid.cols
      h = (th + gMM) * grid.rows
    } else {
      w = tw + gMM
      h = th + gMM
    }
  }

  const rotated = edit.rotation === 90 || edit.rotation === 270
  if (rotated) { const tmp = w; w = h; h = tmp }
  return { w, h }
}

// Preview grout: 2% of total image's longer dimension (in mm)
const PREVIEW_GROUT_RATIO = 0.01

function calcPreviewGroutMM(sizeStr: string, edit: EditState): number {
  const base = parseSizeMM(sizeStr)
  if (!base) return 10
  const tileW = base.w, tileH = base.h
  const grid = getMixGrid(edit.mixMode, sizeStr)
  const isStagger = edit.mixMode === 'half' || edit.mixMode === 'third'
  let totalW: number, totalH: number
  if (isStagger) {
    const sg = getStaggerGrid(edit.mixMode, sizeStr)
    if (sg) { totalW = tileW * sg.cols; totalH = tileH * sg.rows }
    else { totalW = tileW; totalH = tileH }
  } else if (grid) {
    totalW = tileW * grid.cols; totalH = tileH * grid.rows
  } else {
    totalW = tileW; totalH = tileH
  }
  const longerSide = Math.max(totalW, totalH)
  return longerSide * PREVIEW_GROUT_RATIO
}

export function drawCanvas(
  canvas: HTMLCanvasElement,
  sizeStr: string,
  edit: EditState,
  mainImage: HTMLImageElement,
  forExport = false,
) {
  const ctx = canvas.getContext('2d')!
  const grid = getMixGrid(edit.mixMode, sizeStr)

  if (grid && edit.mixSelections.length >= getMixTileCount(edit.mixMode, sizeStr)) {
    if (edit.mixMode === 'grid') {
      drawMixGrid(canvas, ctx, sizeStr, edit, forExport)
    } else {
      drawMixStagger(canvas, ctx, sizeStr, edit, forExport)
    }
  } else {
    drawSingle(canvas, ctx, sizeStr, edit, mainImage, forExport)
  }
}

function drawSingle(
  canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D,
  sizeStr: string, edit: EditState, img: HTMLImageElement, forExport: boolean
) {
  const base = parseSizeMM(sizeStr)
  if (!base) return

  const tileW = base.w, tileH = base.h
  const gMM = edit.groutEnabled ? edit.groutThickness : 0
  const totalW_mm = tileW + gMM, totalH_mm = tileH + gMM

  const ppm = calcPxPerMM(totalW_mm, totalH_mm)
  const tileW_px = Math.round(tileW * ppm)
  const tileH_px = Math.round(tileH * ppm)
  const gPx = gMM > 0 ? Math.round((forExport ? gMM : Math.max(gMM, calcPreviewGroutMM(sizeStr, edit))) * ppm) : 0
  const totalW = tileW_px + gPx
  const totalH = tileH_px + gPx

  const rotated = edit.rotation === 90 || edit.rotation === 270
  canvas.width = rotated ? totalH : totalW
  canvas.height = rotated ? totalW : totalH

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(edit.rotation * Math.PI / 180)

  if (gMM > 0) {
    ctx.fillStyle = edit.groutColor
    ctx.fillRect(-totalW / 2, -totalH / 2, totalW, totalH)
  }

  ctx.filter = buildFilter(edit)
  ctx.drawImage(img, -tileW_px / 2, -tileH_px / 2, tileW_px, tileH_px)
  ctx.restore()
}

function drawMixGrid(
  canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D,
  sizeStr: string, edit: EditState, forExport: boolean
) {
  const base = parseSizeMM(sizeStr)
  if (!base) return

  const imgs = edit.mixSelections
  const tileW = base.w, tileH = base.h
  const gMM = edit.groutEnabled ? edit.groutThickness : 0
  const { cols, rows } = getMixGrid(edit.mixMode, sizeStr)!

  const cellW_mm = tileW + gMM, cellH_mm = tileH + gMM
  const totalW_mm = cellW_mm * cols, totalH_mm = cellH_mm * rows

  const ppm = calcPxPerMM(totalW_mm, totalH_mm)
  const tileW_px = Math.round(tileW * ppm)
  const tileH_px = Math.round(tileH * ppm)
  const gPx = gMM > 0 ? Math.round((forExport ? gMM : Math.max(gMM, calcPreviewGroutMM(sizeStr, edit))) * ppm) : 0
  const cellW_px = tileW_px + gPx
  const cellH_px = tileH_px + gPx
  const totalW = cellW_px * cols
  const totalH = cellH_px * rows

  const rotated = edit.rotation === 90 || edit.rotation === 270
  canvas.width = rotated ? totalH : totalW
  canvas.height = rotated ? totalW : totalH

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(edit.rotation * Math.PI / 180)

  if (gPx > 0) {
    ctx.fillStyle = edit.groutColor
    ctx.fillRect(-totalW / 2, -totalH / 2, totalW, totalH)
  }

  ctx.filter = buildFilter(edit)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const img = imgs[r * cols + c]
      const x = -totalW / 2 + c * cellW_px + gPx / 2
      const y = -totalH / 2 + r * cellH_px + gPx / 2
      ctx.drawImage(img, x, y, tileW_px, tileH_px)
    }
  }
  ctx.restore()
}

function drawMixStagger(
  canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D,
  sizeStr: string, edit: EditState, forExport: boolean
) {
  const base = parseSizeMM(sizeStr)
  if (!base) return

  const imgs = edit.mixSelections
  const tileW = base.w, tileH = base.h
  const gMM = edit.groutEnabled ? edit.groutThickness : 0
  const vertical = isVerticalStagger(sizeStr)
  const sg = getStaggerGrid(edit.mixMode, sizeStr)!
  const { cols, rows } = sg

  const cellW_mm = tileW + gMM, cellH_mm = tileH + gMM
  const totalW_mm = cellW_mm * cols, totalH_mm = cellH_mm * rows

  const ppm = calcPxPerMM(totalW_mm, totalH_mm)
  const tileW_px = Math.round(tileW * ppm)
  const tileH_px = Math.round(tileH * ppm)
  const gPx = gMM > 0 ? Math.round((forExport ? gMM : Math.max(gMM, calcPreviewGroutMM(sizeStr, edit))) * ppm) : 0
  const cellW_px = tileW_px + gPx
  const cellH_px = tileH_px + gPx
  const totalW = cellW_px * cols
  const totalH = cellH_px * rows
  const offsetFraction = edit.mixMode === 'half' ? 0.5 : 1.0 / 3.0

  const rotated = edit.rotation === 90 || edit.rotation === 270
  canvas.width = rotated ? totalH : totalW
  canvas.height = rotated ? totalW : totalH

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(edit.rotation * Math.PI / 180)

  if (gPx > 0) {
    ctx.fillStyle = edit.groutColor
    ctx.fillRect(-totalW / 2, -totalH / 2, totalW, totalH)
  }

  ctx.filter = buildFilter(edit)
  ctx.beginPath()
  ctx.rect(-totalW / 2, -totalH / 2, totalW, totalH)
  ctx.clip()

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const img = imgs[r * cols + c]
      let x: number, y: number

      if (vertical) {
        const colShift = Math.round(c * offsetFraction * cellH_px)
        x = -totalW / 2 + c * cellW_px + gPx / 2
        y = -totalH / 2 + r * cellH_px + gPx / 2 + colShift
      } else {
        const rowShift = Math.round(r * offsetFraction * cellW_px)
        x = -totalW / 2 + c * cellW_px + gPx / 2 + rowShift
        y = -totalH / 2 + r * cellH_px + gPx / 2
      }

      ctx.drawImage(img, x, y, tileW_px, tileH_px)

      if (vertical) {
        if (y + cellH_px > totalH / 2) {
          if (gPx > 0) {
            ctx.filter = 'none'
            ctx.fillStyle = edit.groutColor
            ctx.fillRect(x - gPx / 2, y - totalH, cellW_px, cellH_px)
            ctx.filter = buildFilter(edit)
          }
          ctx.drawImage(img, x, y - totalH, tileW_px, tileH_px)
        }
      } else {
        if (x + cellW_px > totalW / 2) {
          if (gPx > 0) {
            ctx.filter = 'none'
            ctx.fillStyle = edit.groutColor
            ctx.fillRect(x - totalW, y - gPx / 2, cellW_px, cellH_px)
            ctx.filter = buildFilter(edit)
          }
          ctx.drawImage(img, x - totalW, y, tileW_px, tileH_px)
        }
      }
    }
  }
  ctx.restore()
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}
