import { useSyncExternalStore } from 'react'
import type { OrderLibraryView, OrderThumbSize } from '../components/OrderBlockRibbon'

export type MediaSortKey = 'name' | 'kind' | 'duration' | 'size' | 'modified'
export type MediaSortDir = 'asc' | 'desc'

export type MediaRibbonState = {
  name: string
  folderName: string | null
  previewing: boolean
  playing: boolean
  live: boolean
  soundOnThisPc: boolean
  canProject: boolean
  view: OrderLibraryView
  thumbSize: OrderThumbSize
  sortKey: MediaSortKey
  sortDir: MediaSortDir
  importMedia: () => void
  removeMedia: () => void
  togglePlay: () => void
  goLive: () => void
  newFolder: () => void
  back: () => void
  setView: (view: OrderLibraryView) => void
  setThumbSize: (size: OrderThumbSize) => void
  setSortKey: (key: MediaSortKey) => void
  setSortDir: (dir: MediaSortDir) => void
}

const empty: MediaRibbonState = {
  name: 'No media selected',
  folderName: null,
  previewing: false,
  playing: false,
  live: false,
  soundOnThisPc: true,
  canProject: false,
  view: 'list',
  thumbSize: 'm',
  sortKey: 'name',
  sortDir: 'asc',
  importMedia: () => {},
  removeMedia: () => {},
  togglePlay: () => {},
  goLive: () => {},
  newFolder: () => {},
  back: () => {},
  setView: () => {},
  setThumbSize: () => {},
  setSortKey: () => {},
  setSortDir: () => {}
}

let current = empty
const listeners = new Set<() => void>()

export function setMediaRibbon(next: MediaRibbonState): void {
  current = next
  listeners.forEach((listener) => listener())
}

export function useMediaRibbon(): MediaRibbonState {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    },
    () => current,
    () => current
  )
}
