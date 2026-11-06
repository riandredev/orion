import { useSyncExternalStore } from 'react'
import type { HymnSlideKind } from '../../../shared/hymnal-projection-sequence'
import type { HymnalStanzaTagStyle } from '../../../shared/hymnal-types'

let activeHymn = 'Select a hymn'

export type HymnLiveContent = {
  hymnalId: string
  hymnId: string
  number: number
  title: string
  slideKind: HymnSlideKind
  stanzaIndex: number
  stanzaTag: string
  stanzaKind: string
  verse?: number
  versePart?: number
  versePartCount?: number
  lines: string[]
  author?: string | null
  tagStyle: HymnalStanzaTagStyle
}

let liveContent: HymnLiveContent | null = null

const listeners = new Set<() => void>()
const contentListeners = new Set<() => void>()

export function setHymnActiveLabel(label: string): void {
  const next = label.trim() || 'Select a hymn'
  if (next === activeHymn) return
  activeHymn = next
  listeners.forEach((l) => l())
}

export function setHymnLiveContent(content: HymnLiveContent | null): void {
  liveContent = content
  contentListeners.forEach((l) => l())
}

export function getHymnLiveContent(): HymnLiveContent | null {
  return liveContent
}

export function useHymnActiveLabel(): string {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    },
    () => activeHymn,
    () => activeHymn
  )
}

export function useHymnLiveContent(): HymnLiveContent | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      contentListeners.add(onStoreChange)
      return () => contentListeners.delete(onStoreChange)
    },
    () => liveContent,
    () => liveContent
  )
}
