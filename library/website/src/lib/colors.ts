// Fixed palette for product color tagging. Python ingestion must map
// extracted dominant colors to one of these exact label strings; the
// vendor edit UI and the user-facing filter both read from this list.
// Add new buckets here only if both the ingestion script and the vendor
// have agreed on them.
export interface ColorOption {
  label: string
  hex: string
}

export const COLOR_PALETTE: ColorOption[] = [
  { label: '화이트', hex: '#f5f5f5' },
  { label: '아이보리', hex: '#ede4d3' },
  { label: '베이지', hex: '#c9a979' },
  { label: '그레이', hex: '#9b9b9b' },
  { label: '차콜', hex: '#4a4a4a' },
  { label: '블랙', hex: '#1a1a1a' },
  { label: '브라운', hex: '#7a4f2a' },
  { label: '우드', hex: '#b08456' },
  { label: '블루', hex: '#4a6fa5' },
  { label: '그린', hex: '#6b8a5a' },
]

export const COLOR_LABELS = new Set(COLOR_PALETTE.map(c => c.label))

export function colorHex(label: string): string {
  return COLOR_PALETTE.find(c => c.label === label)?.hex ?? '#cccccc'
}
