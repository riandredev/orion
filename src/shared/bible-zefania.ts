import { bookIdFromZefaniaNumber } from './bible-usfm-codes'
import type { OrionBibleModule } from './bible-types'

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseZefaniaXml(text: string): OrionBibleModule {
  let label = 'Zefania Bible'
  let abbr = 'ZEF'
  const books: OrionBibleModule['books'] = {}

  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch?.[1]) {
    label = decodeXml(titleMatch[1].replace(/<[^>]+>/g, ''))
  }
  const abbrMatch = text.match(/<abbreviation[^>]*>([\s\S]*?)<\/abbreviation>/i)
  if (abbrMatch?.[1]) {
    abbr = decodeXml(abbrMatch[1].replace(/<[^>]+>/g, '')).slice(0, 12) || abbr
  }

  const bookRe =
    /<BIBLEBOOK\b[^>]*\bbnumber="(\d+)"[^>]*>([\s\S]*?)<\/BIBLEBOOK>/gi
  let bookMatch: RegExpExecArray | null
  while ((bookMatch = bookRe.exec(text)) !== null) {
    const bookNumber = Number(bookMatch[1])
    const bookId = bookIdFromZefaniaNumber(bookNumber)
    if (!bookId) continue
    const bookBody = bookMatch[2]!
    books[bookId] = books[bookId] ?? {}

    const chapterRe = /<CHAPTER\b[^>]*\bcnumber="(\d+)"[^>]*>([\s\S]*?)<\/CHAPTER>/gi
    let chapterMatch: RegExpExecArray | null
    while ((chapterMatch = chapterRe.exec(bookBody)) !== null) {
      const chapter = chapterMatch[1]!
      const chapterBody = chapterMatch[2]!
      books[bookId][chapter] = books[bookId][chapter] ?? {}

      const versRe = /<VERS\b[^>]*\bvnumber="(\d+)"[^>]*>([\s\S]*?)<\/VERS>/gi
      let versMatch: RegExpExecArray | null
      while ((versMatch = versRe.exec(chapterBody)) !== null) {
        const verse = versMatch[1]!
        const raw = versMatch[2]!.replace(/<[^>]+>/g, '')
        const verseText = decodeXml(raw)
        if (verseText) {
          books[bookId][chapter][verse] = verseText
        }
      }
    }
  }

  if (Object.keys(books).length === 0) {
    throw new Error('No Zefania XML verses found in this file.')
  }

  return { label, abbr, books }
}
