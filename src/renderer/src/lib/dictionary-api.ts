import type {
  DictionaryIndexProgress,
  DictionaryScriptureOccurrence,
  LexiconEntry,
  LexiconEntrySummary
} from '../../../shared/dictionary-types'
import type { LexiconLanguageFilter } from '../../../shared/dictionary-lexicon'

export async function ensureDictionaryReady(): Promise<{
  entries: LexiconEntrySummary[]
  progress: DictionaryIndexProgress
}> {
  if (typeof window.orion?.ensureDictionary !== 'function') {
    return { entries: [], progress: { phase: 'error', completedChapters: 0, totalChapters: 0 } }
  }
  return window.orion.ensureDictionary()
}

export async function getDictionaryIndexProgress(): Promise<DictionaryIndexProgress> {
  if (typeof window.orion?.getDictionaryIndexProgress !== 'function') {
    return { phase: 'idle', completedChapters: 0, totalChapters: 0 }
  }
  return window.orion.getDictionaryIndexProgress()
}

export async function searchDictionaryEntries(
  query: string,
  language: LexiconLanguageFilter,
  offset: number,
  limit: number
): Promise<{ total: number; items: LexiconEntrySummary[] }> {
  if (typeof window.orion?.searchDictionaryEntries !== 'function') {
    return { total: 0, items: [] }
  }
  return window.orion.searchDictionaryEntries(query, language, offset, limit)
}

export async function getDictionaryLexiconEntry(strongs: string): Promise<LexiconEntry | null> {
  if (typeof window.orion?.getDictionaryEntry !== 'function') return null
  return window.orion.getDictionaryEntry(strongs)
}

export async function getDictionaryScriptureOccurrences(
  strongs: string,
  options: {
    bibleId?: string
    bookId?: string | null
    chapter?: number | null
    offset?: number
    limit?: number
  }
): Promise<{ total: number; items: DictionaryScriptureOccurrence[] }> {
  if (typeof window.orion?.getDictionaryScriptureOccurrences !== 'function') {
    return { total: 0, items: [] }
  }
  return window.orion.getDictionaryScriptureOccurrences(strongs, options)
}
