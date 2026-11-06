import { bookIdFromUsfmCode } from './bible-usfm-codes'
import type { OrionBibleModule } from './bible-types'
import { normalizeVerseDisplayText } from './bible-verse-text'

type HelloAoVersePiece = {
  type: string
  number?: number
  text?: string
}

type HelloAoSimpleComplete = {
  translation?: {
    shortName?: string
    englishName?: string
    name?: string
  }
  books?: Array<{
    id?: string
    commonName?: string
    chapters?: Array<{
      chapter?: {
        number?: number
        content?: HelloAoVersePiece[]
      }
    }>
  }>
}

export function parseHelloAoSimpleComplete(raw: unknown): OrionBibleModule {
  const data = raw as HelloAoSimpleComplete
  const t = data.translation
  const label = t?.englishName?.trim() || t?.name?.trim() || 'Downloaded Bible'
  let abbr = t?.shortName?.trim() || label.slice(0, 8).toUpperCase()
  if (/^king james version$/i.test(label)) {
    abbr = 'KJV'
  }
  const books: OrionBibleModule['books'] = {}

  for (const book of data.books ?? []) {
    const usfmId = book.id?.trim().toUpperCase()
    if (!usfmId) continue
    const bookId = bookIdFromUsfmCode(usfmId)
    if (!bookId) continue
    books[bookId] = books[bookId] ?? {}

    for (const chWrap of book.chapters ?? []) {
      const chapterNum = chWrap.chapter?.number
      if (!chapterNum || !Number.isFinite(chapterNum)) continue
      const chKey = String(chapterNum)
      books[bookId][chKey] = books[bookId][chKey] ?? {}

      for (const piece of chWrap.chapter?.content ?? []) {
        if (piece.type !== 'verse' || !piece.number || !piece.text?.trim()) continue
        books[bookId][chKey][String(piece.number)] = normalizeVerseDisplayText(piece.text.trim())
      }
    }
  }

  if (Object.keys(books).length === 0) {
    throw new Error('Downloaded Bible JSON contained no verses.')
  }

  return { label, abbr, books }
}
