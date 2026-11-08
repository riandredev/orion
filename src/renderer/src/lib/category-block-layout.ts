import { useSyncExternalStore } from 'react'
import {
  clampPlacedBlocks,
  defaultPlacedBlocks,
  DICTIONARY_BLOCK_IDS,
  HYMN_BLOCK_IDS,
  type PlacedBlock,
  type PlacedBlockMap
} from '../../../shared/placed-blocks'
import type { BibleBlockMargin } from '../../../shared/bible-block-layout'
import type { FlowAnchor } from '../../../shared/placed-blocks'
import { touchProfileSettings } from './profile-autosave'

export type HymnBlockId = (typeof HYMN_BLOCK_IDS)[number]
export type DictionaryBlockId = (typeof DICTIONARY_BLOCK_IDS)[number]

function createStore<T extends string>(storageKey: string, ids: readonly T[]) {
  let cached: PlacedBlockMap<T> | null = null
  const listeners = new Set<() => void>()

  function read(): PlacedBlockMap<T> {
    if (cached) return cached
    try {
      const raw = localStorage.getItem(storageKey)
      cached = raw ? clampPlacedBlocks(JSON.parse(raw), ids) : defaultPlacedBlocks(ids)
    } catch {
      cached = defaultPlacedBlocks(ids)
    }
    return cached
  }

  function save(next: PlacedBlockMap<T>): PlacedBlockMap<T> {
    cached = clampPlacedBlocks(next, ids)
    try {
      localStorage.setItem(storageKey, JSON.stringify(cached))
    } catch {
      /* ignore */
    }
    touchProfileSettings()
    listeners.forEach((listener) => listener())
    return cached
  }

  function update(id: T, patch: Partial<PlacedBlock>): PlacedBlockMap<T> {
    const current = read()
    return save({ ...current, [id]: { ...current[id], ...patch } })
  }

  return {
    reload: () => {
      cached = null
      const next = read()
      listeners.forEach((listener) => listener())
      return next
    },
    get: read,
    reset: () => save(defaultPlacedBlocks(ids)),
    setAnchor: (id: T, anchor: FlowAnchor) => update(id, { anchor }),
    setMargin: (id: T, side: keyof BibleBlockMargin, value: number) => {
      const current = read()[id]
      return update(id, { margin: { ...current.margin, [side]: value } })
    },
    setMarginSides: (id: T, sides: readonly (keyof BibleBlockMargin)[], value: number) => {
      const current = read()[id]
      const margin = { ...current.margin }
      for (const side of sides) margin[side] = value
      return update(id, { margin })
    },
    setWidth: (id: T, width: number) => update(id, { width }),
    use: (): PlacedBlockMap<T> =>
      useSyncExternalStore(
        (onStoreChange) => {
          listeners.add(onStoreChange)
          return () => listeners.delete(onStoreChange)
        },
        () => read(),
        () => defaultPlacedBlocks(ids)
      )
  }
}

const hymns = createStore('orion-hymn-block-layout-v1', HYMN_BLOCK_IDS)
const dictionary = createStore('orion-dictionary-block-layout-v1', DICTIONARY_BLOCK_IDS)

export const reloadHymnBlockLayoutFromStorage = hymns.reload
export const getHymnBlockLayout = hymns.get
export const resetHymnBlockLayout = hymns.reset
export const updateHymnBlockAnchor = hymns.setAnchor
export const updateHymnBlockMargin = hymns.setMargin
export const updateHymnBlockMarginSides = hymns.setMarginSides
export const updateHymnBlockWidth = hymns.setWidth
export const useHymnBlockLayout = hymns.use

export const reloadDictionaryBlockLayoutFromStorage = dictionary.reload
export const getDictionaryBlockLayout = dictionary.get
export const resetDictionaryBlockLayout = dictionary.reset
export const updateDictionaryBlockAnchor = dictionary.setAnchor
export const updateDictionaryBlockMargin = dictionary.setMargin
export const updateDictionaryBlockMarginSides = dictionary.setMarginSides
export const updateDictionaryBlockWidth = dictionary.setWidth
export const useDictionaryBlockLayout = dictionary.use
