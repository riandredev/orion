import type { HymnEntry, HymnSummary, HymnalStanzaTagStyle } from './hymnal-types'
import { stanzaDisplayTagWithPart } from './hymnal-stanza-format'

export function queryHymnSummaries(summaries: HymnSummary[], query: string): HymnSummary[] {
  const pool = [...summaries].sort((a, b) => a.number - b.number)
  const q = query.trim().toLowerCase()
  if (!q) return pool
  const num = /^\d+$/.test(q) ? Number(q) : null
  return pool.filter((h) => {
    if (num != null && h.number === num) return true
    if (String(h.number).startsWith(q)) return true
    return h.title.toLowerCase().includes(q)
  })
}

export function formatHymnListLabel(h: HymnSummary): string {
  return `${h.number} · ${h.title}`
}

export function formatHymnActiveLabel(
  entry: HymnEntry,
  stanzaIndex: number,
  tagStyle: HymnalStanzaTagStyle = 'short'
): string {
  const stanza = entry.stanzas[stanzaIndex]
  const part = stanza
    ? stanzaDisplayTagWithPart(entry.stanzas, stanzaIndex, tagStyle)
    : `[V${stanzaIndex + 1}]`
  return `${entry.number} · ${entry.title} · ${part}`
}
