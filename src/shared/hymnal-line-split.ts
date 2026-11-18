import type { HymnEntry, HymnStanza } from './hymnal-types'

/** Bibsoft / legacy marker: split one verse across two projection slides. */
export function isSlideSplitMarker(line: string): boolean {
  const t = line.trim()
  return /^-{3,}$/.test(t)
}

/**
 * Old Bibsoft exports often stored each soft-wrap half as its own line
 * (narrow column). Real lyric lines after a correct import are longer.
 */
const SOFT_WRAP_HALF_MAX = 25

export function isLikelySoftWrapHalf(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t || isSlideSplitMarker(t)) return false
  return t.length <= SOFT_WRAP_HALF_MAX
}

/**
 * Join consecutive soft-wrap halves into poetic lyric lines.
 * Only runs on taller stanzas (6+ lines): a normal 4-line verse with short
 * meter must stay as-is; Bibsoft soft wraps usually doubled the line count.
 */
export function joinLegacySoftWrapLines(lines: string[]): string[] {
  const cleaned = lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l.length > 0)
  if (cleaned.length < 6) return cleaned
  const out: string[] = []
  let i = 0
  while (i < cleaned.length) {
    const a = cleaned[i]!
    const b = cleaned[i + 1]
    if (b && isLikelySoftWrapHalf(a) && isLikelySoftWrapHalf(b)) {
      out.push(`${a} ${b}`.replace(/\s+/g, ' ').trim())
      i += 2
      continue
    }
    out.push(a)
    i += 1
  }
  return out
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
    const joined = joinLegacySoftWrapLines(stanza.lines)
    const chunks = splitLinesOnSlideMarker(joined)
    if (chunks.length <= 1) {
      const lines = chunks[0] ?? joined.filter((l) => !isSlideSplitMarker(l))
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
