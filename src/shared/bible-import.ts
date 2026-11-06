import { parseOrionBibleJson } from './bible-orion-json'
import { parseUsfm } from './bible-usfm'
import type { BibleSourceFormat, OrionBibleModule } from './bible-types'
import { normalizeVerseDisplayText } from './bible-verse-text'
import { parseZefaniaXml } from './bible-zefania'

export function detectBibleFormat(fileName: string, text: string): BibleSourceFormat {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
  if (ext === '.json') return 'orion-json'
  if (ext === '.usfm' || ext === '.sfm') return 'usfm'
  if (ext === '.xml') {
    if (/\<BIBLEBOOK\b/i.test(text) && /\<VERS\b/i.test(text)) return 'zefania-xml'
    if (/\\v\s+\d+/i.test(text)) return 'usfm'
    throw new Error('Unsupported XML Bible format. Use Zefania XML.')
  }
  if (/\\id\s+\S+/i.test(text) && /\\v\s+\d+/i.test(text)) return 'usfm'
  if (/\<BIBLEBOOK\b/i.test(text)) return 'zefania-xml'
  throw new Error('Unsupported Bible file. Use JSON, USFM (.usfm), or Zefania XML.')
}

export function parseBibleSource(
  fileName: string,
  text: string
): { format: BibleSourceFormat; module: OrionBibleModule } {
  const format = detectBibleFormat(fileName, text)
  const module =
    format === 'orion-json'
      ? parseOrionBibleJson(text)
      : format === 'usfm'
        ? parseUsfm(text)
        : parseZefaniaXml(text)
  return { format, module }
}

export function chapterFromModule(
  module: OrionBibleModule,
  bookId: string,
  chapter: number
): { number: number; text: string }[] {
  const ch = module.books[bookId]?.[String(chapter)]
  if (!ch) return []
  return Object.entries(ch)
    .map(([num, text]) => ({ number: Number(num), text: normalizeVerseDisplayText(text) }))
    .filter((v) => Number.isFinite(v.number) && v.text.length > 0)
    .sort((a, b) => a.number - b.number)
}
