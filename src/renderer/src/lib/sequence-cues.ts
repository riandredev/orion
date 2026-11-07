import { useSyncExternalStore } from 'react'

export type HymnSequenceCue = {
  token: number
  hymnalId: string
  hymnId: string
  stepIndex: number
  disabledVerseNumbers: number[]
  includeRefrain: boolean
  includeTitle: boolean
  includeEnd: boolean
}

export type BibleSequenceCue = {
  token: number
  bookId: string
  chapter: number
  verse: number
}

let hymnCue: HymnSequenceCue | null = null
let bibleCue: BibleSequenceCue | null = null
let token = 1
const hymnListeners = new Set<() => void>()
const bibleListeners = new Set<() => void>()

export function requestHymnSequenceCue(cue: Omit<HymnSequenceCue, 'token'>): void {
  token += 1
  hymnCue = { ...cue, token }
  hymnListeners.forEach((listener) => listener())
}

export function requestBibleSequenceCue(cue: Omit<BibleSequenceCue, 'token'>): void {
  token += 1
  bibleCue = { ...cue, token }
  bibleListeners.forEach((listener) => listener())
}

export function useHymnSequenceCue(): HymnSequenceCue | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      hymnListeners.add(onStoreChange)
      return () => hymnListeners.delete(onStoreChange)
    },
    () => hymnCue,
    () => hymnCue
  )
}

export function useBibleSequenceCue(): BibleSequenceCue | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      bibleListeners.add(onStoreChange)
      return () => bibleListeners.delete(onStoreChange)
    },
    () => bibleCue,
    () => bibleCue
  )
}

let followKeys = false

export function setSequenceFollowKeys(next: boolean): void {
  followKeys = next
}

export function sequenceFollowsKeys(): boolean {
  return followKeys
}
