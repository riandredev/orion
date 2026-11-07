export type ColumnDropTarget = {
  targetName: string
  position: 'before' | 'after'
}

export type DropMarkerRect = {
  left: number
  top: number
  height: number
}

export function hitTestColumnDrop(
  clientX: number,
  folderNames: string[],
  getRect: (name: string) => DOMRect | undefined
): ColumnDropTarget | null {
  if (folderNames.length === 0) return null

  for (const name of folderNames) {
    const rect = getRect(name)
    if (!rect) continue
    const pad = 10
    if (clientX < rect.left - pad || clientX > rect.right + pad) continue
    const position = clientX < rect.left + rect.width / 2 ? 'before' : 'after'
    return { targetName: name, position }
  }

  const first = folderNames[0]
  const firstRect = getRect(first)
  if (firstRect && clientX < firstRect.left) {
    return { targetName: first, position: 'before' }
  }

  const last = folderNames[folderNames.length - 1]
  const lastRect = getRect(last)
  if (lastRect && clientX > lastRect.right) {
    return { targetName: last, position: 'after' }
  }

  return null
}

export function hitTestListDrop(
  clientY: number,
  folderNames: string[],
  getRect: (name: string) => DOMRect | undefined
): ColumnDropTarget | null {
  if (folderNames.length === 0) return null

  for (const name of folderNames) {
    const rect = getRect(name)
    if (!rect) continue
    const pad = 6
    if (clientY < rect.top - pad || clientY > rect.bottom + pad) continue
    const position = clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    return { targetName: name, position }
  }

  const first = folderNames[0]
  const firstRect = getRect(first)
  if (firstRect && clientY < firstRect.top) {
    return { targetName: first, position: 'before' }
  }

  const last = folderNames[folderNames.length - 1]
  const lastRect = getRect(last)
  if (lastRect && clientY > lastRect.bottom) {
    return { targetName: last, position: 'after' }
  }

  return null
}

export function rowDropMarkerRect(
  drop: ColumnDropTarget,
  getRect: (name: string) => DOMRect | undefined
): { left: number; top: number; width: number } | null {
  const rect = getRect(drop.targetName)
  if (!rect) return null
  const inset = 8
  return {
    left: rect.left + inset,
    top: drop.position === 'before' ? rect.top - 2 : rect.bottom - 1,
    width: Math.max(48, rect.width - inset * 2)
  }
}

export function dropMarkerRect(
  drop: ColumnDropTarget,
  getRect: (name: string) => DOMRect | undefined
): DropMarkerRect | null {
  const rect = getRect(drop.targetName)
  if (!rect) return null
  const inset = 8
  return {
    left: drop.position === 'before' ? rect.left - 2 : rect.right - 1,
    top: rect.top + inset,
    height: Math.max(48, rect.height - inset * 2)
  }
}
