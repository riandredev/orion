import { useSyncExternalStore } from 'react'
import type { LexiconLanguage } from '../../../shared/dictionary-types'

let activeEntry = 'Select a lexicon entry'

export type DictionaryLiveContent = {
  strongs: string
  lemma: string
  transliteration: string | null
  gloss: string | null
  partOfSpeech: string | null
  definition: string
  language: LexiconLanguage
  infoBar: string[]
  infoBarActive: number
}

let liveContent: DictionaryLiveContent | null = null

const listeners = new Set<() => void>()
const contentListeners = new Set<() => void>()

export function setDictionaryActiveEntry(label: string): void {
  const next = label.trim() || 'Select a lexicon entry'
  if (next === activeEntry) return
  activeEntry = next
  listeners.forEach((l) => l())
}

export function setDictionaryLiveContent(content: DictionaryLiveContent | null): void {
  liveContent = content
  contentListeners.forEach((l) => l())
}

export function getDictionaryLiveContent(): DictionaryLiveContent | null {
  return liveContent
}

export function useDictionaryLiveContent(): DictionaryLiveContent | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      contentListeners.add(onStoreChange)
      return () => contentListeners.delete(onStoreChange)
    },
    () => liveContent,
    () => liveContent
  )
}

export function useDictionaryActiveEntry(): string {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    },
    () => activeEntry,
    () => activeEntry
  )
}
