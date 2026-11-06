import {
  bibleBooks,
  formatPassageRefForBook,
  getBookById,
  getBookDisplayName,
  type BibleBook
} from './bible-books'
import { normalizeVerseDisplayText } from './bible-verse-text'
import { AFRIKAANS_BOOK_ALIASES } from './bible-book-aliases-af'

export type BibleSearchScope = 'entire' | 'ot' | 'nt'
export type BibleSearchMode = 'phrase' | 'reference' | 'word'

export type ParsedBibleReference = {
  bookId: string
  chapter: number
  verse: number
}

export type BibleSearchSuggestion = {
  id: string
  kind: 'passage' | 'chapter' | 'book'
  bookId: string
  chapter?: number
  verse?: number
  label: string
  detail?: string
}

export type BibleSearchHit = {
  bookId: string
  chapter: number
  verse: number
  text: string
  reference: string
}

const BOOK_ALIASES: Record<string, string> = {
  gen: 'gen',
  genesis: 'gen',
  exo: 'exo',
  exod: 'exo',
  exodus: 'exo',
  lev: 'lev',
  leviticus: 'lev',
  num: 'num',
  numbers: 'num',
  deu: 'deu',
  deut: 'deu',
  deuteronomy: 'deu',
  jos: 'jos',
  josh: 'jos',
  joshua: 'jos',
  jdg: 'jdg',
  judg: 'jdg',
  judges: 'jdg',
  rut: 'rut',
  ruth: 'rut',
  '1sa': '1sa',
  '1sam': '1sa',
  '1samuel': '1sa',
  '2sa': '2sa',
  '2sam': '2sa',
  '2samuel': '2sa',
  '1ki': '1ki',
  '1kings': '1ki',
  '2ki': '2ki',
  '2kings': '2ki',
  '1ch': '1ch',
  '1chron': '1ch',
  '1chronicles': '1ch',
  '2ch': '2ch',
  '2chron': '2ch',
  '2chronicles': '2ch',
  ezr: 'ezr',
  ezra: 'ezr',
  neh: 'neh',
  nehemiah: 'neh',
  est: 'est',
  esther: 'est',
  job: 'job',
  ps: 'psa',
  psa: 'psa',
  psalm: 'psa',
  psalms: 'psa',
  pro: 'pro',
  prov: 'pro',
  proverbs: 'pro',
  ecc: 'ecc',
  eccl: 'ecc',
  ecclesiastes: 'ecc',
  sng: 'sng',
  song: 'sng',
  sos: 'sng',
  'song of solomon': 'sng',
  'song of songs': 'sng',
  isa: 'isa',
  isaiah: 'isa',
  jer: 'jer',
  jeremiah: 'jer',
  lam: 'lam',
  lamentations: 'lam',
  ezk: 'ezk',
  eze: 'ezk',
  ezek: 'ezk',
  ezekiel: 'ezk',
  dan: 'dan',
  daniel: 'dan',
  hos: 'hos',
  hosea: 'hos',
  jol: 'jol',
  joel: 'jol',
  amo: 'amo',
  amos: 'amo',
  oba: 'oba',
  obad: 'oba',
  obadiah: 'oba',
  jon: 'jon',
  jonah: 'jon',
  mic: 'mic',
  micah: 'mic',
  nam: 'nam',
  nahum: 'nam',
  hab: 'hab',
  habakkuk: 'hab',
  zep: 'zep',
  zephaniah: 'zep',
  hag: 'hag',
  haggai: 'hag',
  zec: 'zec',
  zech: 'zec',
  zechariah: 'zec',
  mal: 'mal',
  malachi: 'mal',
  mat: 'mat',
  matt: 'mat',
  matthew: 'mat',
  mrk: 'mrk',
  mark: 'mrk',
  luk: 'luk',
  luke: 'luk',
  jhn: 'jhn',
  joh: 'jhn',
  john: 'jhn',
  act: 'act',
  acts: 'act',
  rom: 'rom',
  romans: 'rom',
  '1co': '1co',
  '1cor': '1co',
  '1corinthians': '1co',
  '2co': '2co',
  '2cor': '2co',
  '2corinthians': '2co',
  gal: 'gal',
  galatians: 'gal',
  eph: 'eph',
  ephesians: 'eph',
  php: 'php',
  phil: 'php',
  philippians: 'php',
  col: 'col',
  colossians: 'col',
  '1th': '1th',
  '1thess': '1th',
  '1thessalonians': '1th',
  '2th': '2th',
  '2thess': '2th',
  '2thessalonians': '2th',
  '1ti': '1ti',
  '1tim': '1ti',
  '1timothy': '1ti',
  '2ti': '2ti',
  '2tim': '2ti',
  '2timothy': '2ti',
  tit: 'tit',
  titus: 'tit',
  phm: 'phm',
  philemon: 'phm',
  heb: 'heb',
  hebrews: 'heb',
  jas: 'jas',
  james: 'jas',
  '1pe': '1pe',
  '1pet': '1pe',
  '1peter': '1pe',
  '2pe': '2pe',
  '2pet': '2pe',
  '2peter': '2pe',
  '1jn': '1jn',
  '1john': '1jn',
  '2jn': '2jn',
  '2john': '2jn',
  '3jn': '3jn',
  '3john': '3jn',
  jud: 'jud',
  jude: 'jud',
  rev: 'rev',
  revelation: 'rev',
  revelations: 'rev',
  ...AFRIKAANS_BOOK_ALIASES
}

function normalizeBookKey(input: string): string {
  return foldDiacritics(input.trim()).replace(/\./g, '').replace(/\s+/g, ' ')
}

export function foldDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function booksInScope(scope: BibleSearchScope): BibleBook[] {
  if (scope === 'ot') return bibleBooks.filter((b) => b.testament === 'ot')
  if (scope === 'nt') return bibleBooks.filter((b) => b.testament === 'nt')
  return bibleBooks
}

function resolveBookId(bookPart: string): string | undefined {
  const key = normalizeBookKey(bookPart)
  if (!key) return undefined
  if (BOOK_ALIASES[key]) return BOOK_ALIASES[key]
  const numbered = key.match(/^(\d)\s+(.+)$/)
  if (numbered) {
    const combined = `${numbered[1]}${numbered[2].replace(/\s+/g, '')}`
    if (BOOK_ALIASES[combined]) return BOOK_ALIASES[combined]
    const withSpace = `${numbered[1]} ${numbered[2]}`
    if (BOOK_ALIASES[withSpace]) return BOOK_ALIASES[withSpace]
  }
  const exact = bibleBooks.find((b) => normalizeBookKey(b.name) === key)
  if (exact) return exact.id
  const prefixMatches = bibleBooks.filter((b) => normalizeBookKey(b.name).startsWith(key))
  if (prefixMatches.length === 1) return prefixMatches[0].id
  return undefined
}

function clampChapter(book: BibleBook, chapter: number): number {
  return Math.min(Math.max(1, chapter), book.chapters)
}

function clampVerse(verse: number): number {
  return Math.max(1, verse)
}

export function parseBibleReference(query: string): ParsedBibleReference | null {
  const trimmed = query.trim()
  if (!trimmed) return null

  const compactVerse = trimmed.match(/^(.+?):(\d+):(\d+)(?:\s*-\s*\d+)?\s*$/i)
  if (compactVerse) {
    const book = resolveBookId(compactVerse[1]!)
    const chapter = Number(compactVerse[2])
    const verse = Number(compactVerse[3])
    if (book && Number.isFinite(chapter) && Number.isFinite(verse)) {
      const meta = getBookById(book)!
      return { bookId: book, chapter: clampChapter(meta, chapter), verse: clampVerse(verse) }
    }
  }

  const compactChapter = trimmed.match(/^(.+?):(\d+)\s*$/i)
  if (compactChapter) {
    const book = resolveBookId(compactChapter[1]!)
    const chapter = Number(compactChapter[2])
    if (book && Number.isFinite(chapter)) {
      const meta = getBookById(book)!
      return { bookId: book, chapter: clampChapter(meta, chapter), verse: 1 }
    }
  }

  const colonMatch = trimmed.match(/^(.+?)\s+(\d+)\s*:\s*(\d+)(?:\s*-\s*\d+)?\s*$/i)
  if (colonMatch) {
    const book = resolveBookId(colonMatch[1]!)
    const chapter = Number(colonMatch[2])
    const verse = Number(colonMatch[3])
    if (!book || !Number.isFinite(chapter) || !Number.isFinite(verse)) return null
    const meta = getBookById(book)!
    return { bookId: book, chapter: clampChapter(meta, chapter), verse: clampVerse(verse) }
  }

  const spaceVerseMatch = trimmed.match(/^(.+?)\s+(\d+)\s+(\d+)\s*$/i)
  if (spaceVerseMatch) {
    const book = resolveBookId(spaceVerseMatch[1]!)
    const chapter = Number(spaceVerseMatch[2])
    const verse = Number(spaceVerseMatch[3])
    if (!book || !Number.isFinite(chapter) || !Number.isFinite(verse)) return null
    const meta = getBookById(book)!
    return { bookId: book, chapter: clampChapter(meta, chapter), verse: clampVerse(verse) }
  }

  const chapterMatch = trimmed.match(/^(.+?)\s+(\d+)\s*$/i)
  if (chapterMatch) {
    const book = resolveBookId(chapterMatch[1]!)
    const chapter = Number(chapterMatch[2])
    if (!book || !Number.isFinite(chapter)) return null
    const meta = getBookById(book)!
    return { bookId: book, chapter: clampChapter(meta, chapter), verse: 1 }
  }

  const bookOnly = resolveBookId(trimmed)
  if (bookOnly) {
    return { bookId: bookOnly, chapter: 1, verse: 1 }
  }

  return null
}

export function inferBibleSearchMode(query: string): BibleSearchMode {
  const q = query.trim()
  if (!q) return 'reference'
  if (parseBibleReference(q)) return 'reference'
  if (resolveBookId(q)) return 'reference'
  if (/^[^:\s]+:\d+(:\d+)?$/i.test(q)) return 'reference'
  if (/:\d/.test(q) || /^\d+\s/.test(q)) return 'reference'
  if (/\s+\d+\s*$/.test(q) && resolveBookId(q.replace(/\s+\d+\s*$/, ''))) return 'reference'
  const words = q.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return 'phrase'
  return 'word'
}

export function buildBibleSearchSuggestions(
  query: string,
  scope: BibleSearchScope,
  afrikaansBookNames = false
): BibleSearchSuggestion[] {
  const q = query.trim()
  if (!q) return []

  const parsed = parseBibleReference(q)
  if (parsed) {
    const bookOnly =
      !/\d/.test(q) && !q.includes(':') && resolveBookId(q) === parsed.bookId
    const book = getBookById(parsed.bookId)!
    if (bookOnly) {
      return [
        {
          id: `book-${parsed.bookId}`,
          kind: 'book',
          bookId: parsed.bookId,
          label: getBookDisplayName(parsed.bookId, afrikaansBookNames),
          detail: `${book.chapters} chapters`
        }
      ]
    }
    return [
      {
        id: `passage-${parsed.bookId}-${parsed.chapter}-${parsed.verse}`,
        kind: 'passage',
        bookId: parsed.bookId,
        chapter: parsed.chapter,
        verse: parsed.verse,
        label: formatPassageRefForBook(
          parsed.bookId,
          parsed.chapter,
          parsed.verse,
          afrikaansBookNames
        ),
        detail: 'Go to reference'
      }
    ]
  }

  const partialCompact = q.match(/^(.+?):(\d+)\s*$/i)
  if (partialCompact) {
    const bookId = resolveBookId(partialCompact[1]!)
    const chapter = Number(partialCompact[2])
    if (bookId && Number.isFinite(chapter)) {
      const book = getBookById(bookId)!
      const ch = clampChapter(book, chapter)
      return [
        {
          id: `chapter-${bookId}-${ch}`,
          kind: 'chapter',
          bookId,
          chapter: ch,
          label: `${getBookDisplayName(bookId, afrikaansBookNames)} ${ch}`,
          detail: 'Open chapter'
        }
      ]
    }
  }

  const partialChapter = q.match(/^(.+?)\s+(\d+)\s*$/i)
  if (partialChapter) {
    const bookId = resolveBookId(partialChapter[1]!)
    const chapter = Number(partialChapter[2])
    if (bookId && Number.isFinite(chapter)) {
      const book = getBookById(bookId)!
      const ch = clampChapter(book, chapter)
      return [
        {
          id: `chapter-${bookId}-${ch}`,
          kind: 'chapter',
          bookId,
          chapter: ch,
          label: `${getBookDisplayName(bookId, afrikaansBookNames)} ${ch}`,
          detail: 'Open chapter'
        }
      ]
    }
  }

  const key = normalizeBookKey(q)
  const pool = booksInScope(scope)
  const suggestions: BibleSearchSuggestion[] = []

  for (const book of pool) {
    const nameKey = normalizeBookKey(book.name)
    const idKey = book.id
    if (
      nameKey.startsWith(key) ||
      idKey.startsWith(key.replace(/\s+/g, '')) ||
      normalizeBookKey(idKey).startsWith(key)
    ) {
      suggestions.push({
        id: `book-${book.id}`,
        kind: 'book',
        bookId: book.id,
        label: getBookDisplayName(book.id, afrikaansBookNames),
        detail: `${book.chapters} chapters`
      })
    }
  }

  for (const [alias, bookId] of Object.entries(BOOK_ALIASES)) {
    if (!alias.startsWith(key) || key.length < 2) continue
    const book = getBookById(bookId)
    if (!book || !pool.some((b) => b.id === bookId)) continue
    if (suggestions.some((s) => s.bookId === bookId && s.kind === 'book')) continue
    suggestions.push({
      id: `book-${bookId}-${alias}`,
      kind: 'book',
      bookId,
      label: getBookDisplayName(bookId, afrikaansBookNames),
      detail: alias
    })
  }

  return suggestions.slice(0, 8)
}

export function hitsToSuggestions(
  hits: BibleSearchHit[],
  afrikaansBookNames = false
): BibleSearchSuggestion[] {
  return hits.slice(0, 12).map((hit) => ({
    id: `hit-${hit.bookId}-${hit.chapter}-${hit.verse}`,
    kind: 'passage' as const,
    bookId: hit.bookId,
    chapter: hit.chapter,
    verse: hit.verse,
    label: formatPassageRefForBook(hit.bookId, hit.chapter, hit.verse, afrikaansBookNames),
    detail: hit.text.length > 64 ? `${hit.text.slice(0, 64)}…` : hit.text
  }))
}

export function searchModuleText(
  module: { books: Record<string, Record<string, Record<string, string>>> },
  query: string,
  mode: BibleSearchMode,
  scope: BibleSearchScope,
  limit: number,
  afrikaansBookNames = false
): BibleSearchHit[] {
  const q = query.trim()
  if (!q || mode === 'reference') return []

  const pool = new Set(booksInScope(scope).map((b) => b.id))
  const needle = foldDiacritics(q)
  const words =
    mode === 'word' ? [needle] : needle.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const hits: BibleSearchHit[] = []

  for (const book of bibleBooks) {
    if (!pool.has(book.id)) continue
    const chapters = module.books[book.id]
    if (!chapters) continue
    for (const [chapterKey, verses] of Object.entries(chapters)) {
      for (const [verseKey, text] of Object.entries(verses)) {
        const hay = foldDiacritics(text)
        const ok =
          mode === 'word'
            ? words.some((w) => hay.split(/\s+/).some((token) => token.startsWith(w)))
            : words.every((w) => hay.includes(w))
        if (!ok) continue
        const chapter = Number(chapterKey)
        const verse = Number(verseKey)
        hits.push({
          bookId: book.id,
          chapter,
          verse,
          text: normalizeVerseDisplayText(text),
          reference: formatPassageRefForBook(book.id, chapter, verse, afrikaansBookNames)
        })
        if (hits.length >= limit) return hits
      }
    }
  }

  return hits
}
