import { useSyncExternalStore } from 'react'

let activePassage = 'Select a passage'

export type BibleLiveContent = {
  reference: string
  locationLabel: string
  translationLabel: string
  highlightVerse: number
  bookId?: string
  verses: { number: number; text: string }[]
}

let liveContent: BibleLiveContent | null = null

const listeners = new Set<() => void>()
const contentListeners = new Set<() => void>()

export function setBibleActivePassage(ref: string): void {
  if (ref === activePassage) return
  activePassage = ref
  listeners.forEach((l) => l())
}

export function setBibleLiveContent(content: BibleLiveContent | null): void {
  liveContent = content
  contentListeners.forEach((l) => l())
}

export function useBibleLiveContent(): BibleLiveContent | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      contentListeners.add(onStoreChange)
      return () => contentListeners.delete(onStoreChange)
    },
    () => liveContent,
    () => liveContent
  )
}

export function getBibleLiveContent(): BibleLiveContent | null {
  return liveContent
}

export function useBibleActivePassage(): string {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    },
    () => activePassage,
    () => activePassage
  )
}
