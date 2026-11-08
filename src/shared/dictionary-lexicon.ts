import type { LexiconEntrySummary, LexiconLanguage } from './dictionary-types'

/** Display form: H0001 → H1, G3056 → G3056 */
export function formatStrongsDisplay(id: string): string {
  const m = /^([HG])(\d+)$/i.exec(id.trim().toUpperCase())
  if (!m) return id
  const num = String(Number(m[2]))
  return `${m[1].toUpperCase()}${num}`
}

/** Normalize user input (H1, h430, G3056) to helloao id (H0001, H0430, G3056). */
export function normalizeStrongsId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  const m = /^([HG])\s*0*(\d+)\s*([A-Z])?$/i.exec(raw.replace(/\s+/g, ''))
  if (!m) return null
  const prefix = m[1].toUpperCase()
  const num = Number(m[2])
  if (!Number.isFinite(num) || num <= 0) return null
  const padded = String(num).padStart(prefix === 'G' ? 4 : 4, '0')
  return `${prefix}${padded}`
}

export function parseStrongsQuery(query: string): string | null {
  const direct = normalizeStrongsId(query)
  if (direct) return direct
  const loose = query.trim().match(/\b([HG])\s*0*(\d+)\b/i)
  if (loose) return normalizeStrongsId(`${loose[1]}${loose[2]}`)
  return null
}

export type LexiconLanguageFilter = 'all' | LexiconLanguage

const LANGUAGE_BROWSE_ORDER: Record<LexiconLanguage, number> = {
  hebrew: 0,
  aramaic: 1,
  greek: 2
}

export function filterLexiconByLanguage<T extends { language: LexiconLanguage }>(
  items: T[],
  filter: LexiconLanguageFilter
): T[] {
  if (filter === 'all') return items
  if (filter === 'hebrew') {
    return items.filter((item) => item.language === 'hebrew' || item.language === 'aramaic')
  }
  return items.filter((item) => item.language === filter)
}

/** Browse order: Hebrew/Aramaic before Greek (API list is G-first). */
export function sortLexiconSummariesForBrowse(
  items: LexiconEntrySummary[]
): LexiconEntrySummary[] {
  return [...items].sort((a, b) => {
    const la = LANGUAGE_BROWSE_ORDER[a.language] ?? 9
    const lb = LANGUAGE_BROWSE_ORDER[b.language] ?? 9
    if (la !== lb) return la - lb
    return a.id.localeCompare(b.id, undefined, { numeric: true })
  })
}

export type LexiconQueryResult = {
  total: number
  items: LexiconEntrySummary[]
}

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

/** Searchable text for a lexicon list row (Strong's, lemma, transliteration, gloss). */
export function lexiconSummarySearchHaystack(entry: LexiconEntrySummary): string {
  const parts = [
    formatStrongsDisplay(entry.id),
    entry.id,
    entry.name,
    entry.transliterationHint,
    entry.glossHint ?? ''
  ]
  const tr = entry.transliterationHint.trim()
  if (tr.includes('.')) parts.push(tr.replace(/\./g, ''))
  return fold(parts.join(' '))
}

export function queryLexiconSummaries(
  items: LexiconEntrySummary[],
  query: string,
  language: LexiconLanguageFilter,
  offset: number,
  limit: number
): LexiconQueryResult {
  const pool = sortLexiconSummariesForBrowse(filterLexiconByLanguage(items, language))
  const q = query.trim()
  const safeOffset = Math.max(0, offset)
  const safeLimit = Math.max(1, Math.min(limit, 500))

  if (!q) {
    return {
      total: pool.length,
      items: pool.slice(safeOffset, safeOffset + safeLimit)
    }
  }

  const strongs = parseStrongsQuery(q)
  if (strongs) {
    const hit = pool.find((e) => e.id === strongs)
    return { total: hit ? 1 : 0, items: hit ? [hit] : [] }
  }

  const needle = fold(q)
  const matches: LexiconEntrySummary[] = []
  for (const entry of pool) {
    if (lexiconSummarySearchHaystack(entry).includes(needle)) matches.push(entry)
  }
  return {
    total: matches.length,
    items: matches.slice(safeOffset, safeOffset + safeLimit)
  }
}

export function primarySenseLabel(entry: {
  name: string
  transliterationHint: string
  glossHint?: string
}): string {
  if (entry.transliterationHint && /[a-z]/i.test(entry.transliterationHint)) {
    return entry.transliterationHint
  }
  return entry.glossHint || entry.name.split(',')[0]?.trim() || entry.name
}

export function languageLabelForLexicon(language: LexiconLanguage): string {
  if (language === 'greek') return 'Greek'
  if (language === 'aramaic') return 'Aramaic'
  return 'Hebrew'
}

type SenseBarInput = {
  partOfSpeech: string | null
  transliteration: string | null
  gloss: string | null
  definition?: string
}

const BAR_LABEL_MAX = 36

function shortenBarLabel(text: string, max = BAR_LABEL_MAX): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/** First sentence/paragraph of a STEPBible sense definition for bar labels. */
export function definitionHeadlineForBar(definition: string): string {
  const text = definition.trim()
  if (!text) return ''
  const para = text.split(/\n\n+/)[0]?.trim() ?? text
  const line = para.split('\n')[0]?.trim() ?? para
  const semi = line.indexOf(';')
  if (semi > 12) return line.slice(0, semi + 1).trim()
  return shortenBarLabel(line, 48)
}

function projectionSenseBarLabel(sense: SenseBarInput, index: number): string {
  const def = sense.definition?.trim() ?? ''
  const g = sense.gloss?.trim()
  const lead = g || `Sense ${index + 1}`

  const tribe = def.match(/\btribe of ([A-Za-z][A-Za-z-]*)/i)?.[1]?.trim()
  if (tribe) return shortenBarLabel(`${lead} · ${tribe}`, 44)

  const onlyAt = def.match(/\bonly mentioned at ([^;\n]+)/i)?.[1]?.trim()
  if (onlyAt) return shortenBarLabel(`${lead} · ${onlyAt}`, 44)

  const firstAt = def.match(/\bfirst mentioned at ([^;\n]+)/i)?.[1]?.trim()
  if (firstAt) return shortenBarLabel(`${lead} · ${firstAt}`, 44)

  const fromDef = def ? definitionHeadlineForBar(def) : ''
  if (fromDef) return shortenBarLabel(fromDef)
  const tr = sense.transliteration?.trim()
  if (tr) return shortenBarLabel(tr)
  const po = sense.partOfSpeech?.trim()
  if (po) return shortenBarLabel(`${po} · ${index + 1}`)
  return `Sense ${index + 1}`
}

function dedupeBarLabels(labels: string[]): string[] {
  const used = new Map<string, number>()
  return labels.map((label, index) => {
    const count = labels.filter((l) => l === label).length
    if (count <= 1) return label
    const n = (used.get(label) ?? 0) + 1
    used.set(label, n)
    if (n === 1) return label
    return shortenBarLabel(`${index + 1}. ${label}`, BAR_LABEL_MAX + 6)
  })
}

export function buildDictionaryProjectionInfoBar(
  language: LexiconLanguage,
  senses: SenseBarInput[]
): { segments: string[]; activeIndex: number } {
  const langLabel = languageLabelForLexicon(language)
  if (senses.length > 1) {
    const segments = dedupeBarLabels(
      senses.slice(0, 5).map((s, i) => projectionSenseBarLabel(s, i))
    )
    return { segments, activeIndex: 0 }
  }
  const primary = senses[0]
  if (!primary) return { segments: [langLabel], activeIndex: 0 }
  const segments: string[] = [langLabel]
  if (primary.partOfSpeech?.trim()) segments.push(primary.partOfSpeech.trim())
  if (primary.transliteration?.trim()) segments.push(primary.transliteration.trim())
  if (primary.gloss?.trim()) segments.push(primary.gloss.trim())
  return { segments: segments.slice(0, 5), activeIndex: Math.max(0, segments.length - 1) }
}
