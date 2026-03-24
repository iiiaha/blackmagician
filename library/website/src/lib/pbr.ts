/**
 * PBR Map Generator — generates Normal, Roughness, AO maps from a diffuse image
 */

interface PBRMaps {
  normal: string   // base64 data URL
  roughness: string
  ao: string
}

function toGrayscale(src: ImageData): Float32Array {
  const gray = new Float32Array(src.width * src.height)
  const d = src.data
  for (let i = 0; i < gray.length; i++) {
    gray[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255
  }
  return gray
}

function generateNormalMap(w: number, h: number, gray: Float32Array, strength: number): ImageData {
  const out = new ImageData(w, h)
  const d = out.data

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = gray[((y - 1 + h) % h) * w + ((x - 1 + w) % w)]
      const t  = gray[((y - 1 + h) % h) * w + x]
      const tr = gray[((y - 1 + h) % h) * w + ((x + 1) % w)]
      const l  = gray[y * w + ((x - 1 + w) % w)]
      const r  = gray[y * w + ((x + 1) % w)]
      const bl = gray[((y + 1) % h) * w + ((x - 1 + w) % w)]
      const b  = gray[((y + 1) % h) * w + x]
      const br = gray[((y + 1) % h) * w + ((x + 1) % w)]

      const dX = (tr + 2 * r + br) - (tl + 2 * l + bl)
      const dY = (bl + 2 * b + br) - (tl + 2 * t + tr)

      const nx = -dX * strength
      const ny = -dY * strength
      const nz = 1.0
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)

      const pi = (y * w + x) * 4
      d[pi]     = Math.round((nx / len * 0.5 + 0.5) * 255)
      d[pi + 1] = Math.round((ny / len * 0.5 + 0.5) * 255)
      d[pi + 2] = Math.round((nz / len * 0.5 + 0.5) * 255)
      d[pi + 3] = 255
    }
  }
  return out
}

function generateRoughnessMap(w: number, h: number, gray: Float32Array, base: number): ImageData {
  const out = new ImageData(w, h)
  const d = out.data
  for (let i = 0; i < gray.length; i++) {
    const rough = base + (1 - gray[i]) * (1 - base) * 0.5
    const v = Math.round(Math.min(1, Math.max(0, rough)) * 255)
    const pi = i * 4
    d[pi] = v; d[pi + 1] = v; d[pi + 2] = v; d[pi + 3] = 255
  }
  return out
}

function generateAOMap(w: number, h: number, gray: Float32Array, strength: number): ImageData {
  const out = new ImageData(w, h)
  const d = out.data
  const radius = Math.max(2, Math.round(Math.min(w, h) * 0.01))

  const blurred = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, count = 0
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const sy = Math.min(h - 1, Math.max(0, y + dy))
          const sx = Math.min(w - 1, Math.max(0, x + dx))
          sum += gray[sy * w + sx]
          count++
        }
      }
      blurred[y * w + x] = sum / count
    }
  }

  for (let i = 0; i < gray.length; i++) {
    const ao = 1.0 - (1.0 - blurred[i]) * strength
    const v = Math.round(Math.min(1, Math.max(0, ao)) * 255)
    const pi = i * 4
    d[pi] = v; d[pi + 1] = v; d[pi + 2] = v; d[pi + 3] = 255
  }
  return out
}

/**
 * Generate PBR maps from a canvas element containing the diffuse/albedo image
 */
export function generatePBRMaps(
  sourceCanvas: HTMLCanvasElement,
  normalStrength = 2.0,
  roughnessBase = 0.5,
  aoStrength = 1.0
): PBRMaps {
  const w = sourceCanvas.width
  const h = sourceCanvas.height
  const ctx = sourceCanvas.getContext('2d')!
  const srcData = ctx.getImageData(0, 0, w, h)
  const gray = toGrayscale(srcData)

  // Generate maps on offscreen canvases
  const normalData = generateNormalMap(w, h, gray, normalStrength)
  const roughData = generateRoughnessMap(w, h, gray, roughnessBase)
  const aoData = generateAOMap(w, h, gray, aoStrength)

  const toDataUrl = (imgData: ImageData): string => {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    c.getContext('2d')!.putImageData(imgData, 0, 0)
    return c.toDataURL('image/png')
  }

  return {
    normal: toDataUrl(normalData),
    roughness: toDataUrl(roughData),
    ao: toDataUrl(aoData),
  }
}
