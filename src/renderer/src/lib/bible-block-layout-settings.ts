import { useSyncExternalStore } from 'react'
import {
  clampBibleBlockLayout,
  DEFAULT_BIBLE_BLOCK_LAYOUT,
  type BibleAnchor,
  type BibleBlockId,
  type BibleBlockLayout,
  type BibleBlockMargin
} from '../../../shared/bible-block-layout'
import { touchProfileSettings } from './profile-autosave'

const STORAGE_KEY = 'orion-bible-block-layout-v1'

let cached: BibleBlockLayout | null = null
const listeners = new Set<() => void>()

export function reloadBibleBlockLayoutFromStorage(): BibleBlockLayout {
  cached = null
  const next = getBibleBlockLayout()
  listeners.forEach((listener) => listener())
  return next
}

export function getBibleBlockLayout(): BibleBlockLayout {
  if (cached) return cached
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    cached = raw ? clampBibleBlockLayout(JSON.parse(raw)) : clampBibleBlockLayout(DEFAULT_BIBLE_BLOCK_LAYOUT)
  } catch {
    cached = { ...DEFAULT_BIBLE_BLOCK_LAYOUT }
  }
  return cached
}

function save(next: BibleBlockLayout): BibleBlockLayout {
  cached = clampBibleBlockLayout(next)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached))
  } catch {
    /* ignore */
  }
  touchProfileSettings()
  listeners.forEach((listener) => listener())
  return cached
}

export function updateBibleBlockAnchor(id: BibleBlockId, anchor: BibleAnchor): BibleBlockLayout {
  const current = getBibleBlockLayout()
  return save({ ...current, [id]: anchor })
}

export function updateBibleBlockMargin(
  id: BibleBlockId,
  side: keyof BibleBlockMargin,
  value: number,
  linked = false
): BibleBlockLayout {
  const current = getBibleBlockLayout()
  const next = linked
    ? { top: value, right: value, bottom: value, left: value }
    : { ...current.margin[id], [side]: value }
  return save({
    ...current,
    margin: { ...current.margin, [id]: next }
  })
}

export function updateBibleBlockMarginSides(
  id: BibleBlockId,
  sides: readonly (keyof BibleBlockMargin)[],
  value: number
): BibleBlockLayout {
  const current = getBibleBlockLayout()
  const next = { ...current.margin[id] }
  for (const side of sides) next[side] = value
  return save({
    ...current,
    margin: { ...current.margin, [id]: next }
  })
}

export function updateBibleBlockWidth(id: BibleBlockId, width: number): BibleBlockLayout {
  const current = getBibleBlockLayout()
  return save({
    ...current,
    width: { ...current.width, [id]: width }
  })
}

export function resetBibleBlockLayout(): BibleBlockLayout {
  return save({ ...DEFAULT_BIBLE_BLOCK_LAYOUT })
}

export function useBibleBlockLayout(): BibleBlockLayout {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    },
    () => getBibleBlockLayout(),
    () => DEFAULT_BIBLE_BLOCK_LAYOUT
  )
}
