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

function sameBibleLiveContent(a: BibleLiveContent | null, b: BibleLiveContent | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (
    a.reference !== b.reference ||
    a.locationLabel !== b.locationLabel ||
    a.translationLabel !== b.translationLabel ||
    a.highlightVerse !== b.highlightVerse ||
    a.bookId !== b.bookId ||
    a.verses.length !== b.verses.length
  ) {
    return false
  }
  return a.verses.every(
    (verse, index) => verse.number === b.verses[index]?.number && verse.text === b.verses[index]?.text
  )
}

export function setBibleLiveContent(content: BibleLiveContent | null): void {
  if (sameBibleLiveContent(liveContent, content)) return
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
