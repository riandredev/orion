import { expandStanzasForSlides } from './hymnal-line-split'
import type { HymnEntry, HymnStanza, HymnalLanguage } from './hymnal-types'

/** Row shape from Bibsoft / Adventist `AdventistHymnals.mdb` (`Hymnals` table). */
export type BibsoftHymnalRow = {
  ID: number
  Hymnal: string
}

/** Row shape from the `Hymns` table (one row per stanza). */
export type BibsoftHymnStanzaRow = {
  Hymnal: number
  HymnNumber: number
  HymnName: string | null
  VerseNumber: number
  VerseText: string | null
  Author?: string | null
}

export type BibsoftHymnalBundle = {
  bibsoftId: number
  label: string
  language: HymnalLanguage
  hymns: HymnEntry[]
}

/**
 * Bibsoft stores a poetic line with `\r` where the old narrow column wrapped,
 * and `\r\n` where the lyric line actually ends. Slide markers stay on their own line.
 */
export function splitBibsoftVerseText(text: string): string[] {
  const lines: string[] = []
  for (const raw of text.split(/\r\n|\n/g)) {
    const joined = raw.replace(/\r/g, ' ').replace(/\s+/g, ' ').trim()
    if (!joined) continue
    for (const part of joined.split(/(-{3,})/g)) {
      const line = part.trim()
      if (line) lines.push(line)
    }
  }
  return lines
}

export function inferBibsoftHymnalLanguage(label: string): HymnalLanguage {
  const lower = label.toLowerCase()
  if (lower.includes('afrikaans') || lower === 'af') return 'af'
  if (lower.includes('english') || lower === 'en') return 'en'
  return 'other'
}

function stanzaFromBibsoftRow(row: BibsoftHymnStanzaRow): HymnStanza | null {
  const lines = splitBibsoftVerseText(row.VerseText ?? '')
  if (lines.length === 0) return null
  if (row.VerseNumber === 0) {
    return { kind: 'refrain', lines }
  }
  if (row.VerseNumber > 0) {
    return { kind: 'verse', verse: row.VerseNumber, lines }
  }
  return { kind: 'other', lines }
}

function compareStanzaOrder(a: BibsoftHymnStanzaRow, b: BibsoftHymnStanzaRow): number {
  return a.VerseNumber - b.VerseNumber
}

/**
 * Converts Bibsoft MDB tables into Orion hymn entries.
 * `VerseNumber` 0 → refrain; 1…n → verses (Bibsoft convention).
 */
export function convertBibsoftHymnal(
  hymnalId: string,
  bibsoftHymnalId: number,
  label: string,
  stanzaRows: BibsoftHymnStanzaRow[]
): BibsoftHymnalBundle {
  const rows = stanzaRows
    .filter((r) => r.Hymnal === bibsoftHymnalId)
    .slice()
    .sort((a, b) => {
      if (a.HymnNumber !== b.HymnNumber) return a.HymnNumber - b.HymnNumber
      return compareStanzaOrder(a, b)
    })

  const byNumber = new Map<number, BibsoftHymnStanzaRow[]>()
  for (const row of rows) {
    const list = byNumber.get(row.HymnNumber) ?? []
    list.push(row)
    byNumber.set(row.HymnNumber, list)
  }

  const hymns: HymnEntry[] = []
  for (const number of [...byNumber.keys()].sort((a, b) => a - b)) {
    const group = byNumber.get(number)!
    group.sort(compareStanzaOrder)
    const title = (group.find((r) => r.HymnName?.trim())?.HymnName ?? `Hymn ${number}`).trim()
    const stanzas: HymnStanza[] = []
    for (const row of group) {
      const stanza = stanzaFromBibsoftRow(row)
      if (stanza) stanzas.push(stanza)
    }
    if (stanzas.length === 0) continue
    const author = group.map((r) => r.Author?.trim()).find((a) => a) ?? null
    const expanded = expandStanzasForSlides(stanzas)
    hymns.push({
      id: `h${String(number).padStart(3, '0')}`,
      hymnalId,
      number,
      title,
      author,
      stanzas: expanded
    })
  }

  return {
    bibsoftId: bibsoftHymnalId,
    label: label.trim(),
    language: inferBibsoftHymnalLanguage(label),
    hymns
  }
}

export function convertBibsoftDatabase(
  hymnalIdFor: (bibsoftHymnalId: number, label: string) => string,
  hymnalRows: BibsoftHymnalRow[],
  stanzaRows: BibsoftHymnStanzaRow[]
): BibsoftHymnalBundle[] {
  return hymnalRows
    .slice()
    .sort((a, b) => a.ID - b.ID)
    .map((h) => {
      const id = hymnalIdFor(h.ID, h.Hymnal)
      return convertBibsoftHymnal(id, h.ID, h.Hymnal, stanzaRows)
    })
    .filter((b) => b.hymns.length > 0)
}
