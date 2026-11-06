import { bookIdFromZefaniaNumber } from './bible-usfm-codes'
import type { OrionBibleModule } from './bible-types'

type BibleSuperSearchVerseRow = {
  book?: number
  chapter?: number
  verse?: number
  text?: string
}

type BibleSuperSearchExport = {
  metadata?: {
    name?: string
    shortname?: string
    module?: string
    year?: string
  }
  verses?: BibleSuperSearchVerseRow[]
}

export function parseBibleSuperSearchJson(raw: unknown): OrionBibleModule {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid Bible SuperSearch JSON.')
  }
  const data = raw as BibleSuperSearchExport
  const verses = data.verses
  if (!Array.isArray(verses) || verses.length === 0) {
    throw new Error('Bible SuperSearch JSON contains no verses.')
  }

  const meta = data.metadata ?? {}
  const label =
    typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : 'Imported Bible'
  const abbr =
    typeof meta.shortname === 'string' && meta.shortname.trim()
      ? meta.shortname.trim().slice(0, 12)
      : typeof meta.module === 'string' && meta.module.trim()
        ? meta.module.trim().slice(0, 12).toUpperCase()
        : label.slice(0, 8).toUpperCase()

  const books: OrionBibleModule['books'] = {}
  for (const row of verses) {
    const bookNum = Number(row.book)
    const chapter = Number(row.chapter)
    const verse = Number(row.verse)
    const text = typeof row.text === 'string' ? row.text.trim() : ''
    if (!text || !Number.isFinite(chapter) || !Number.isFinite(verse)) continue
    const bookId = bookIdFromZefaniaNumber(bookNum)
    if (!bookId) continue
    books[bookId] ??= {}
    const chapterKey = String(chapter)
    books[bookId][chapterKey] ??= {}
    books[bookId][chapterKey][String(verse)] = text
  }

  if (Object.keys(books).length === 0) {
    throw new Error('Could not map Bible SuperSearch verses to books.')
  }

  return { label, abbr, books }
}
