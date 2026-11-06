import { app } from 'electron'
import { mkdir, readFile, writeFile, access } from 'fs/promises'
import { join } from 'path'
import { bibleBooks, formatPassageRefForBook } from '../shared/bible-books'
import { bookIdToUsfmCode } from '../shared/bible-usfm-codes'
import {
  filterLexiconByLanguage,
  normalizeStrongsId,
  queryLexiconSummaries,
  type LexiconLanguageFilter
} from '../shared/dictionary-lexicon'
import type {
  DictionaryIndexProgress,
  DictionaryInterlinearWord,
  DictionaryOccurrenceRef,
  DictionaryScriptureOccurrence,
  LexiconEntry,
  LexiconEntrySummary,
  LexiconLanguage
} from '../shared/dictionary-types'
import { getBibleChapter } from './bible-library'

const API = 'https://bible.helloao.org/api'
const LEXICON_DATASET = 'stepbible-lexicon'
const KJV_CATALOG = 'eng_kjv'
const DEFAULT_KJV_ID = 'eng-kjv'
const CONCORDANCE_VERSION = 1
const LEXICON_INDEX_VERSION = 2
const LEXICON_SEARCH_CONCURRENCY = 32

type LexiconIndexCache =
  | LexiconEntrySummary[]
  | { version: number; entries: LexiconEntrySummary[] }

type HelloAoLexiconList = {
  lexicon: { id: string; language: LexiconLanguage; name: string }[]
}

type HelloAoLexiconEntry = {
  entry: LexiconEntry
}

type HelloAoWordsChapter = {
  verses: Record<string, { strongs: string[] }[]>
}

type HelloAoInterlinearChapter = {
  chapter: {
    content: { verse: number; words: { text: string; transliteration?: string; gloss?: string; strongs?: string }[] }[]
  }
}

let lexiconIndex: LexiconEntrySummary[] | null = null
let lexiconLoadPromise: Promise<LexiconEntrySummary[]> | null = null
let lexiconEnrichPromise: Promise<void> | null = null
let concordance: Map<string, string[]> | null = null
let indexProgress: DictionaryIndexProgress = {
  phase: 'idle',
  completedChapters: 0,
  totalChapters: 0
}
let indexBuildPromise: Promise<void> | null = null

function dictionaryCacheRoot(): string {
  return join(app.getPath('userData'), 'dictionary')
}

function lexiconIndexPath(): string {
  return join(dictionaryCacheRoot(), 'lexicon-index.json')
}

function concordancePath(): string {
  return join(dictionaryCacheRoot(), `concordance-v${CONCORDANCE_VERSION}.json`)
}

function occurrenceKey(bookId: string, chapter: number, verse: number): string {
  return `${bookId}:${chapter}:${verse}`
}

function parseOccurrenceKey(key: string): DictionaryOccurrenceRef | null {
  const parts = key.split(':')
  if (parts.length !== 3) return null
  const chapter = Number(parts[1])
  const verse = Number(parts[2])
  if (!parts[0] || !Number.isFinite(chapter) || !Number.isFinite(verse)) return null
  return { bookId: parts[0], chapter, verse }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return res.json() as Promise<T>
}

function summaryFromListItem(item: {
  id: string
  language: LexiconLanguage
  name: string
}): LexiconEntrySummary {
  return {
    id: item.id,
    language: item.language,
    name: item.name,
    transliterationHint: ''
  }
}

function parseLexiconIndexCache(raw: unknown): LexiconEntrySummary[] | 'legacy' | null {
  if (Array.isArray(raw) && raw.length > 1000) {
    return 'legacy'
  }
  if (raw && typeof raw === 'object' && 'entries' in raw) {
    const wrapped = raw as { version?: number; entries: LexiconEntrySummary[] }
    if (
      wrapped.version === LEXICON_INDEX_VERSION &&
      Array.isArray(wrapped.entries) &&
      wrapped.entries.length > 1000
    ) {
      return wrapped.entries
    }
  }
  return null
}

function setLexiconSearchProgress(
  completed: number,
  total: number,
  phase: 'building' | 'ready' | 'error',
  message?: string
): void {
  indexProgress = {
    ...indexProgress,
    lexiconSearchPhase: phase,
    lexiconSearchCompleted: completed,
    lexiconSearchTotal: total,
    ...(message ? { message } : {})
  }
}

function lexiconSummariesNeedSearchEnrichment(entries: LexiconEntrySummary[]): boolean {
  if (entries.length === 0) return false
  const sample = entries.slice(0, 40)
  const withLatinHint = sample.filter(
    (e) => e.transliterationHint && /[a-z]/i.test(e.transliterationHint)
  ).length
  return withLatinHint < Math.min(8, sample.length)
}

async function lexiconCacheFilePresent(): Promise<boolean> {
  try {
    await access(lexiconIndexPath())
    return true
  } catch {
    return false
  }
}

function scheduleLexiconSearchEnrichment(entries: LexiconEntrySummary[]): void {
  if (lexiconEnrichPromise || !lexiconSummariesNeedSearchEnrichment(entries)) {
    if (!lexiconSummariesNeedSearchEnrichment(entries)) {
      setLexiconSearchProgress(entries.length, entries.length, 'ready')
    }
    return
  }
  const snapshot = entries.map((e) => ({ ...e }))
  lexiconEnrichPromise = enrichLexiconSummariesForSearch(snapshot)
    .then(async (enriched) => {
      lexiconIndex = enriched
      await writeLexiconIndexCache(enriched)
      setLexiconSearchProgress(enriched.length, enriched.length, 'ready')
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Lexicon search index failed'
      setLexiconSearchProgress(
        indexProgress.lexiconSearchCompleted ?? 0,
        indexProgress.lexiconSearchTotal ?? snapshot.length,
        'error',
        message
      )
    })
    .finally(() => {
      lexiconEnrichPromise = null
    })
}

async function loadDictionaryLexiconIndexFromDiskOrNetwork(): Promise<LexiconEntrySummary[]> {
  await mkdir(dictionaryCacheRoot(), { recursive: true })

  try {
    const raw = JSON.parse(await readFile(lexiconIndexPath(), 'utf8')) as unknown
    const parsed = parseLexiconIndexCache(raw)
    if (parsed === 'legacy') {
      const legacy = raw as LexiconEntrySummary[]
      const listRows = legacy.map((row) => ({
        id: row.id,
        language: row.language,
        name: row.name,
        transliterationHint: ''
      }))
      lexiconIndex = listRows
      scheduleLexiconSearchEnrichment(listRows)
      return listRows
    }
    if (parsed) {
      lexiconIndex = parsed
      setLexiconSearchProgress(parsed.length, parsed.length, 'ready')
      return parsed
    }
  } catch {
    /* fetch fresh */
  }

  setLexiconSearchProgress(0, 0, 'building')
  const data = await fetchJson<HelloAoLexiconList>(
    `${API}/d/${LEXICON_DATASET}/lexicon.json`
  )
  const listRows = data.lexicon.map(summaryFromListItem)
  lexiconIndex = listRows
  scheduleLexiconSearchEnrichment(listRows)
  return listRows
}

async function enrichLexiconSummariesForSearch(
  entries: LexiconEntrySummary[]
): Promise<LexiconEntrySummary[]> {
  const total = entries.length
  setLexiconSearchProgress(0, total, 'building')
  const out = entries.map((e) => ({ ...e }))
  let next = 0
  let completed = 0

  async function worker(): Promise<void> {
    for (;;) {
      const i = next
      next += 1
      if (i >= out.length) return
      const row = out[i]
      try {
        const data = await fetchJson<HelloAoLexiconEntry>(
          `${API}/d/${LEXICON_DATASET}/lexicon/${row.id}.json`
        )
        const sense = data.entry?.senses?.[0]
        if (sense) {
          out[i] = {
            ...row,
            transliterationHint: sense.transliteration?.trim() || row.transliterationHint,
            glossHint: sense.gloss?.trim() || undefined
          }
        }
      } catch {
        /* keep list row */
      }
      completed += 1
      if (lexiconIndex && completed % 250 === 0) {
        lexiconIndex = out.map((row) => ({ ...row }))
      }
      if (completed === total || completed % 250 === 0) {
        setLexiconSearchProgress(completed, total, 'building')
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(LEXICON_SEARCH_CONCURRENCY, total) }, () => worker())
  )
  setLexiconSearchProgress(total, total, 'ready')
  return out
}

async function writeLexiconIndexCache(entries: LexiconEntrySummary[]): Promise<void> {
  await mkdir(dictionaryCacheRoot(), { recursive: true })
  const payload: LexiconIndexCache = { version: LEXICON_INDEX_VERSION, entries }
  await writeFile(lexiconIndexPath(), JSON.stringify(payload), 'utf8')
}

export function getDictionaryIndexProgress(): DictionaryIndexProgress {
  return indexProgress
}

export async function loadDictionaryLexiconIndex(): Promise<LexiconEntrySummary[]> {
  const cachePresent = await lexiconCacheFilePresent()
  if (!cachePresent) {
    lexiconIndex = null
    lexiconLoadPromise = null
    lexiconEnrichPromise = null
  }

  if (lexiconIndex) return lexiconIndex
  if (!lexiconLoadPromise) {
    lexiconLoadPromise = loadDictionaryLexiconIndexFromDiskOrNetwork()
      .catch((err: unknown) => {
        lexiconLoadPromise = null
        const message = err instanceof Error ? err.message : 'Could not load lexicon'
        setLexiconSearchProgress(0, 0, 'error', message)
        throw err
      })
  }
  return lexiconLoadPromise
}

/** Start lexicon list + search-index work at app launch (safe to call multiple times). */
export function warmDictionaryLexiconIndex(): void {
  void loadDictionaryLexiconIndex().catch(() => {
    /* progress carries error state */
  })
}

export function searchDictionaryEntries(
  query: string,
  language: LexiconLanguageFilter,
  offset: number,
  limit: number
): { total: number; items: LexiconEntrySummary[] } {
  if (!lexiconIndex) return { total: 0, items: [] }
  return queryLexiconSummaries(lexiconIndex, query, language, offset, limit)
}

export async function getDictionaryLexiconEntry(strongsInput: string): Promise<LexiconEntry | null> {
  const strongs = normalizeStrongsId(strongsInput) ?? strongsInput.trim()
  if (!/^H\d{4}$|^G\d{4}$/i.test(strongs)) return null
  const data = await fetchJson<HelloAoLexiconEntry>(
    `${API}/d/${LEXICON_DATASET}/lexicon/${strongs.toUpperCase()}.json`
  )
  return data.entry ?? null
}

async function loadConcordanceFromDisk(): Promise<Map<string, string[]> | null> {
  try {
    const raw = await readFile(concordancePath(), 'utf8')
    const parsed = JSON.parse(raw) as Record<string, string[]>
    const map = new Map<string, string[]>()
    for (const [strongs, refs] of Object.entries(parsed)) {
      map.set(strongs, refs)
    }
    return map.size > 0 ? map : null
  } catch {
    return null
  }
}

async function saveConcordanceToDisk(map: Map<string, string[]>): Promise<void> {
  await mkdir(dictionaryCacheRoot(), { recursive: true })
  const obj: Record<string, string[]> = {}
  for (const [k, v] of map) obj[k] = v
  await writeFile(concordancePath(), JSON.stringify(obj), 'utf8')
}

function totalChapterCount(): number {
  return bibleBooks.reduce((n, b) => n + b.chapters, 0)
}

export function startDictionaryConcordanceBuild(): void {
  if (concordance || indexProgress.phase === 'building' || indexBuildPromise) return
  indexProgress = {
    phase: 'building',
    completedChapters: 0,
    totalChapters: totalChapterCount()
  }

  indexBuildPromise = (async () => {
    const existing = await loadConcordanceFromDisk()
    if (existing) {
      concordance = existing
      indexProgress = {
        phase: 'ready',
        completedChapters: indexProgress.totalChapters,
        totalChapters: indexProgress.totalChapters
      }
      return
    }

    const map = new Map<string, string[]>()
    let done = 0

    for (const book of bibleBooks) {
      const usfm = bookIdToUsfmCode(book.id)
      if (!usfm) continue
      for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
        try {
          const words = await fetchJson<HelloAoWordsChapter>(
            `${API}/${KJV_CATALOG}/${usfm}/${chapter}.words.json`
          )
          for (const [verseKey, annotations] of Object.entries(words.verses ?? {})) {
            const verse = Number(verseKey)
            if (!Number.isFinite(verse)) continue
            const ref = occurrenceKey(book.id, chapter, verse)
            const seen = new Set<string>()
            for (const ann of annotations) {
              for (const s of ann.strongs ?? []) {
                const id = s.toUpperCase()
                if (seen.has(id)) continue
                seen.add(id)
                const list = map.get(id)
                if (list) list.push(ref)
                else map.set(id, [ref])
              }
            }
          }
        } catch {
          /* skip chapter on failure */
        }
        done += 1
        indexProgress = {
          phase: 'building',
          completedChapters: done,
          totalChapters: indexProgress.totalChapters
        }
      }
    }

    concordance = map
    await saveConcordanceToDisk(map)
    indexProgress = {
      phase: 'ready',
      completedChapters: done,
      totalChapters: indexProgress.totalChapters
    }
  })().catch((err: unknown) => {
    indexProgress = {
      phase: 'error',
      completedChapters: indexProgress.completedChapters,
      totalChapters: indexProgress.totalChapters,
      message: err instanceof Error ? err.message : 'Index build failed'
    }
  })
}

function filterOccurrences(
  refs: string[],
  bookId: string | null,
  chapter: number | null
): DictionaryOccurrenceRef[] {
  const out: DictionaryOccurrenceRef[] = []
  for (const key of refs) {
    const ref = parseOccurrenceKey(key)
    if (!ref) continue
    if (bookId && ref.bookId !== bookId) continue
    if (chapter != null && ref.chapter !== chapter) continue
    out.push(ref)
  }
  return out
}

export async function getDictionaryOccurrenceCount(
  strongsInput: string,
  bookId: string | null,
  chapter: number | null
): Promise<number> {
  const strongs = normalizeStrongsId(strongsInput)?.toUpperCase()
  if (!strongs || !concordance) return 0
  const refs = concordance.get(strongs)
  if (!refs) return 0
  return filterOccurrences(refs, bookId, chapter).length
}

const interlinearChapterCache = new Map<string, HelloAoInterlinearChapter['chapter']>()

async function loadInterlinearChapter(usfm: string, chapter: number) {
  const key = `${usfm}:${chapter}`
  const cached = interlinearChapterCache.get(key)
  if (cached) return cached
  const data = await fetchJson<HelloAoInterlinearChapter>(
    `${API}/d/bsb-interlinear/${usfm}/${chapter}.json`
  )
  interlinearChapterCache.set(key, data.chapter)
  return data.chapter
}

export async function getDictionaryScriptureOccurrences(
  strongsInput: string,
  options: {
    bibleId?: string
    bookId?: string | null
    chapter?: number | null
    offset?: number
    limit?: number
  }
): Promise<{ total: number; items: DictionaryScriptureOccurrence[] }> {
  const strongs = normalizeStrongsId(strongsInput)?.toUpperCase()
  if (!strongs || !concordance) return { total: 0, items: [] }

  const refs = concordance.get(strongs)
  if (!refs) return { total: 0, items: [] }

  const bookId = options.bookId ?? null
  const chapter = options.chapter ?? null
  const filtered = filterOccurrences(refs, bookId, chapter)
  const offset = options.offset ?? 0
  const limit = options.limit ?? 12
  const slice = filtered.slice(offset, offset + limit)
  const bibleId = options.bibleId ?? DEFAULT_KJV_ID

  const items: DictionaryScriptureOccurrence[] = []
  for (const ref of slice) {
    const usfm = bookIdToUsfmCode(ref.bookId)
    const chapterDto = await getBibleChapter(bibleId, ref.bookId, ref.chapter)
    const verseRow = chapterDto.verses.find((v) => v.number === ref.verse)
    const verseText = verseRow?.text ?? ''

    let words: DictionaryInterlinearWord[] = []
    if (usfm) {
      try {
        const ilChapter = await loadInterlinearChapter(usfm, ref.chapter)
        const verseBlock = ilChapter.content.find((v) => v.verse === ref.verse)
        words =
          verseBlock?.words.map((w) => ({
            text: w.text,
            transliteration: w.transliteration ?? null,
            gloss: w.gloss ?? null,
            strongs: w.strongs ?? null,
            isMatch: (w.strongs ?? '').toUpperCase() === strongs
          })) ?? []
      } catch {
        words = []
      }
    }

    items.push({
      ...ref,
      reference: formatPassageRefForBook(ref.bookId, ref.chapter, ref.verse, false),
      verseText,
      words
    })
  }

  return { total: filtered.length, items }
}

export async function ensureDictionaryReady(): Promise<{
  entries: LexiconEntrySummary[]
  progress: DictionaryIndexProgress
}> {
  const entries = await loadDictionaryLexiconIndex()
  if (!concordance && indexProgress.phase === 'idle') {
    const disk = await loadConcordanceFromDisk()
    if (disk) {
      concordance = disk
      indexProgress = {
        phase: 'ready',
        completedChapters: totalChapterCount(),
        totalChapters: totalChapterCount()
      }
    } else {
      startDictionaryConcordanceBuild()
    }
  }
  return { entries, progress: getDictionaryIndexProgress() }
}

export function listDictionaryEntriesPage(
  language: LexiconLanguageFilter,
  offset: number,
  limit: number
): LexiconEntrySummary[] {
  if (!lexiconIndex) return []
  const pool = filterLexiconByLanguage(lexiconIndex, language)
  return pool.slice(offset, offset + limit)
}
