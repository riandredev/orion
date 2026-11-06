import type { OrionBibleModule } from './bible-types'

export function normalizeOrionBibleModule(raw: unknown): OrionBibleModule {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid Orion Bible JSON: expected an object.')
  }
  const obj = raw as Record<string, unknown>
  const label = typeof obj.label === 'string' && obj.label.trim() ? obj.label.trim() : 'Imported Bible'
  const abbr =
    typeof obj.abbr === 'string' && obj.abbr.trim()
      ? obj.abbr.trim().slice(0, 12)
      : label.slice(0, 8).toUpperCase()
  const booksRaw = obj.books
  if (!booksRaw || typeof booksRaw !== 'object') {
    throw new Error('Invalid Orion Bible JSON: missing "books".')
  }

  const books: OrionBibleModule['books'] = {}
  for (const [bookId, chaptersRaw] of Object.entries(booksRaw as Record<string, unknown>)) {
    if (!chaptersRaw || typeof chaptersRaw !== 'object') continue
    books[bookId] = {}
    for (const [chapterKey, versesRaw] of Object.entries(chaptersRaw as Record<string, unknown>)) {
      if (!versesRaw || typeof versesRaw !== 'object') continue
      books[bookId][chapterKey] = {}
      for (const [verseKey, textRaw] of Object.entries(versesRaw as Record<string, unknown>)) {
        if (typeof textRaw !== 'string') continue
        const text = textRaw.trim()
        if (!text) continue
        books[bookId][chapterKey][verseKey] = text
      }
    }
  }

  if (Object.keys(books).length === 0) {
    throw new Error('Orion Bible JSON contains no verse data.')
  }

  return { label, abbr, books }
}

export function parseOrionBibleJson(text: string): OrionBibleModule {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Could not parse JSON Bible file.')
  }
  return normalizeOrionBibleModule(parsed)
}
