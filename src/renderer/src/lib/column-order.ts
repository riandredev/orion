import type { OrderFolderInfo } from '../env'

const STORAGE_KEY = 'orion-kanban-column-order'

export function loadColumnOrder(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

export function saveColumnOrder(names: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(names))
  } catch {
    /* ignore quota / private mode */
  }
}

export function applyFolderOrder(
  folders: OrderFolderInfo[],
  savedOrder: string[]
): OrderFolderInfo[] {
  if (savedOrder.length === 0) return folders
  const byName = new Map(folders.map((f) => [f.name, f]))
  const ordered: OrderFolderInfo[] = []
  for (const name of savedOrder) {
    const folder = byName.get(name)
    if (folder) {
      ordered.push(folder)
      byName.delete(name)
    }
  }
  for (const folder of byName.values()) {
    ordered.push(folder)
  }
  return ordered
}

export function reorderFolderList(
  folders: OrderFolderInfo[],
  fromName: string,
  toName: string
): OrderFolderInfo[] {
  if (fromName === toName) return folders
  const fromIdx = folders.findIndex((f) => f.name === fromName)
  const toIdx = folders.findIndex((f) => f.name === toName)
  if (fromIdx < 0 || toIdx < 0) return folders
  const next = [...folders]
  const [moved] = next.splice(fromIdx, 1)
  next.splice(toIdx, 0, moved)
  return next
}

export type ColumnDropPosition = 'before' | 'after'

export function reorderFolderRelative(
  folders: OrderFolderInfo[],
  fromName: string,
  targetName: string,
  position: ColumnDropPosition
): OrderFolderInfo[] {
  if (fromName === targetName) return folders
  const fromIdx = folders.findIndex((f) => f.name === fromName)
  let targetIdx = folders.findIndex((f) => f.name === targetName)
  if (fromIdx < 0 || targetIdx < 0) return folders

  let insertIdx = position === 'before' ? targetIdx : targetIdx + 1
  const next = [...folders]
  const [moved] = next.splice(fromIdx, 1)
  if (fromIdx < insertIdx) insertIdx -= 1
  insertIdx = Math.max(0, Math.min(insertIdx, next.length))
  next.splice(insertIdx, 0, moved)
  return next
}

export function folderOrderSignature(folders: OrderFolderInfo[]): string {
  return folders.map((f) => f.name).join('\0')
}

