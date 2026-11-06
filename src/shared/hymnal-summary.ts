import type { HymnEntry, HymnStanza, HymnSummary } from './hymnal-types'

export type HymnStanzaCounts = {
  stanzaCount: number
  verseCount: number
  hasRefrain: boolean
  hasChorus: boolean
}

export function countHymnStanzas(stanzas: HymnStanza[]): HymnStanzaCounts {
  let verseCount = 0
  let hasRefrain = false
  let hasChorus = false
  for (const s of stanzas) {
    if (s.kind === 'verse') verseCount += 1
    if (s.kind === 'refrain') hasRefrain = true
    if (s.kind === 'chorus') hasChorus = true
  }
  return {
    stanzaCount: stanzas.length,
    verseCount,
    hasRefrain,
    hasChorus
  }
}

export function hymnSummaryFromEntry(entry: Pick<HymnEntry, 'id' | 'hymnalId' | 'number' | 'title' | 'stanzas' | 'author'>): HymnSummary {
  const counts = countHymnStanzas(entry.stanzas)
  return {
    id: entry.id,
    hymnalId: entry.hymnalId,
    number: entry.number,
    title: entry.title,
    author: entry.author ?? null,
    stanzaCount: counts.stanzaCount,
    verseCount: counts.verseCount,
    hasRefrain: counts.hasRefrain || counts.hasChorus ? true : undefined
  }
}

/** Secondary line under hymn title in the sidebar list. */
export function formatHymnListMeta(summary: HymnSummary): string {
  const parts: string[] = []
  const stanzas = summary.stanzaCount
  const verses = summary.verseCount
  if (stanzas != null && stanzas > 0) {
    parts.push(`${stanzas} stanza${stanzas === 1 ? '' : 's'}`)
  }
  if (verses != null && verses > 0) {
    parts.push(`${verses} verse${verses === 1 ? '' : 's'}`)
  }
  if (summary.hasRefrain) parts.push('refrain')
  const author = summary.author?.trim()
  if (author) parts.push(author)
  return parts.join(' · ')
}

export function enrichHymnSummaries(summaries: HymnSummary[], hymns: HymnEntry[]): HymnSummary[] {
  const byId = new Map(hymns.map((h) => [h.id, h]))
  return summaries.map((s) => {
    if (s.stanzaCount != null) return s
    const entry = byId.get(s.id)
    return entry ? hymnSummaryFromEntry(entry) : s
  })
}
