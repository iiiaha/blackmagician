// Fixed palette for product color classification. Python ingestion
// must store one of these exact label strings into products.color;
// the vendor edit UI and the user-facing filter both read from this list.
// Order within each group matters: filter UI renders chips in this order.
export type ColorGroup = 'neutral' | 'warm' | 'green' | 'cool'

export interface ColorOption {
  label: string
  hex: string
  group: ColorGroup
}

export const COLOR_PALETTE: ColorOption[] = [
  // neutral (화이트 → 블랙)
  { label: '화이트',     hex: '#F5F0EB', group: 'neutral' },
  { label: '아이보리',   hex: '#EBDCC3', group: 'neutral' },
  { label: '라이트그레이', hex: '#C8C8C8', group: 'neutral' },
  { label: '그레이',     hex: '#8C8C8C', group: 'neutral' },
  { label: '다크그레이', hex: '#5A5856', group: 'neutral' },
  { label: '차콜',       hex: '#373737', group: 'neutral' },
  { label: '블랙',       hex: '#161616', group: 'neutral' },
  // warm (베이지 → 옐로우)
  { label: '베이지',     hex: '#D2BEA0', group: 'warm' },
  { label: '브라운',     hex: '#825F41', group: 'warm' },
  { label: '다크브라운', hex: '#3C2819', group: 'warm' },
  { label: '테라코타',   hex: '#AF644B', group: 'warm' },
  { label: '살몬',       hex: '#D7AA96', group: 'warm' },
  { label: '골드',       hex: '#C8A564', group: 'warm' },
  { label: '옐로우',     hex: '#EBD769', group: 'warm' },
  // green
  { label: '세이지',     hex: '#AAB99B', group: 'green' },
  { label: '그린',       hex: '#6EA05F', group: 'green' },
  { label: '다크그린',   hex: '#325037', group: 'green' },
  // cool
  { label: '라이트블루', hex: '#AAC3D7', group: 'cool' },
  { label: '블루',       hex: '#5A82B4', group: 'cool' },
  { label: '네이비',     hex: '#23375F', group: 'cool' },
  { label: '틸',         hex: '#2D6469', group: 'cool' },
]

export const COLOR_GROUP_LABELS: Record<ColorGroup, string> = {
  neutral: '뉴트럴',
  warm: '웜',
  green: '그린',
  cool: '쿨',
}

export const COLOR_LABELS = new Set(COLOR_PALETTE.map(c => c.label))

export function colorHex(label: string | null | undefined): string {
  if (!label) return '#cccccc'
  return COLOR_PALETTE.find(c => c.label === label)?.hex ?? '#cccccc'
}
