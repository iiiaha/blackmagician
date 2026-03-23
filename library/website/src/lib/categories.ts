// Category definitions: tab label → possible folder names (Korean)
export const CATEGORIES = [
  { id: 'tile', label: 'TILE', folderNames: ['타일'] },
  { id: 'stone', label: 'STONE', folderNames: ['스톤', '석재'] },
  { id: 'flooring', label: 'FLOORING', folderNames: ['원목마루', '바닥재', '마루'] },
  { id: 'wood', label: 'WOOD', folderNames: ['무늬목', '목재'] },
  { id: 'wallpaper', label: 'WALLPAPER', folderNames: ['벽지'] },
  { id: 'wallpanel', label: 'WALLPANEL', folderNames: ['월패널', '벽판넬'] },
] as const

export type CategoryId = typeof CATEGORIES[number]['id']
