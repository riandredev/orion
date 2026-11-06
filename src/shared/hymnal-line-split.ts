import type { HymnEntry, HymnStanza } from './hymnal-types'

/** Bibsoft / legacy marker: split one verse across two projection slides. */
export function isSlideSplitMarker(line: string): boolean {
  const t = line.trim()
  return /^-{3,}$/.test(t)
}

/** Split lyric lines into slide-sized chunks (markers are removed). */
export function splitLinesOnSlideMarker(lines: string[]): string[][] {
  const chunks: string[][] = []
  let current: string[] = []
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim()
    if (!line) continue
    if (isSlideSplitMarker(line)) {
      if (current.length > 0) {
        chunks.push(current)
        current = []
      }
      continue
    }
    current.push(line)
  }
  if (current.length > 0) chunks.push(current)
  if (chunks.length === 0) {
    const cleaned = lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l && !isSlideSplitMarker(l))
    return cleaned.length > 0 ? [cleaned] : []
  }
  return chunks
}

/** Expand stanzas so each hyphen chunk becomes its own stanza (same verse/refrain kind). */
export function expandStanzasForSlides(stanzas: HymnStanza[]): HymnStanza[] {
  const out: HymnStanza[] = []
  for (const stanza of stanzas) {
    const chunks = splitLinesOnSlideMarker(stanza.lines)
    if (chunks.length <= 1) {
      const lines = chunks[0] ?? stanza.lines.filter((l) => !isSlideSplitMarker(l))
      if (lines.length > 0) out.push({ ...stanza, lines })
      continue
    }
    for (const lines of chunks) {
      if (lines.length > 0) out.push({ ...stanza, lines })
    }
  }
  return out
}

export function normalizeHymnEntry(entry: HymnEntry): HymnEntry {
  return { ...entry, stanzas: expandStanzasForSlides(entry.stanzas) }
}

export function listHymnVerseNumbers(stanzas: HymnStanza[]): number[] {
  const nums = new Set<number>()
  for (const s of stanzas) {
    if (s.kind === 'verse' && s.verse != null && s.verse > 0) nums.add(s.verse)
  }
  return [...nums].sort((a, b) => a - b)
}
