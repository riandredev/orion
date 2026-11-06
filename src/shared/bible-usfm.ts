import { bookIdFromUsfmCode } from './bible-usfm-codes'
import type { OrionBibleModule } from './bible-types'

function stripUsfmInline(text: string): string {
  return text
    .replace(/\\[^\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseUsfm(text: string): OrionBibleModule {
  let label = 'USFM Bible'
  let abbr = 'USFM'
  let bookId: string | undefined
  let chapter = 0
  let verse = 0
  const books: OrionBibleModule['books'] = {}

  const lines = text.replace(/\r\n/g, '\n').split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const idMatch = trimmed.match(/^\\id\s+(\S+)/i)
    if (idMatch) {
      const code = idMatch[1]!
      bookId = bookIdFromUsfmCode(code)
      const rest = trimmed.slice(idMatch[0].length).trim()
      if (rest) label = rest.replace(/^[-–—]\s*/, '').trim() || label
      abbr = code.slice(0, 12).toUpperCase()
      continue
    }

    const hMatch = trimmed.match(/^\\h\s+(.+)/i)
    if (hMatch && label === 'USFM Bible') {
      label = stripUsfmInline(hMatch[1]!)
      continue
    }

    const tocMatch = trimmed.match(/^\\toc3\s+(.+)/i)
    if (tocMatch) {
      abbr = stripUsfmInline(tocMatch[1]!).slice(0, 12) || abbr
      continue
    }

    const cMatch = trimmed.match(/^\\c\s+(\d+)/i)
    if (cMatch) {
      chapter = Number(cMatch[1])
      verse = 0
      continue
    }

    const vMatch = trimmed.match(/^\\v\s+(\d+)\s*(.*)$/i)
    if (vMatch && bookId && chapter > 0) {
      verse = Number(vMatch[1])
      const chunk = stripUsfmInline(vMatch[2] ?? '')
      if (!books[bookId]) books[bookId] = {}
      const chKey = String(chapter)
      if (!books[bookId][chKey]) books[bookId][chKey] = {}
      books[bookId][chKey][String(verse)] = chunk
      continue
    }

    if (verse > 0 && bookId && chapter > 0 && !trimmed.startsWith('\\')) {
      const extra = stripUsfmInline(trimmed)
      if (!extra) continue
      const chKey = String(chapter)
      const vKey = String(verse)
      const prev = books[bookId]?.[chKey]?.[vKey] ?? ''
      books[bookId]![chKey]![vKey] = prev ? `${prev} ${extra}` : extra
    }
  }

  if (Object.keys(books).length === 0) {
    throw new Error('No USFM verse markers found in this file.')
  }

  return { label, abbr, books }
}
