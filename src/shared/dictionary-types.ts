export type LexiconLanguage = 'hebrew' | 'aramaic' | 'greek'

export type LexiconEntrySummary = {
  id: string
  language: LexiconLanguage
  name: string
  /** Primary transliteration (from lexicon entry when indexed for search). */
  transliterationHint: string
  /** Primary gloss for text search (e.g. Abib, time/right time). */
  glossHint?: string
}

export type LexiconSense = {
  id: string
  language: LexiconLanguage
  lemma: string
  transliteration: string | null
  partOfSpeech: string | null
  gloss: string | null
  definition: string
}

export type LexiconEntry = {
  id: string
  language: LexiconLanguage
  senses: LexiconSense[]
}

export type DictionaryOccurrenceRef = {
  bookId: string
  chapter: number
  verse: number
}

export type DictionaryInterlinearWord = {
  text: string
  transliteration: string | null
  gloss: string | null
  strongs: string | null
  isMatch: boolean
}

export type DictionaryScriptureOccurrence = DictionaryOccurrenceRef & {
  reference: string
  verseText: string
  words: DictionaryInterlinearWord[]
}

export type DictionaryIndexProgress = {
  phase: 'idle' | 'building' | 'ready' | 'error'
  completedChapters: number
  totalChapters: number
  message?: string
  lexiconSearchPhase?: 'idle' | 'building' | 'ready' | 'error'
  lexiconSearchCompleted?: number
  lexiconSearchTotal?: number
}
