import type { HymnStanza, HymnStanzaKind, HymnalStanzaTagStyle } from './hymnal-types'

const HEADER_NUMBER = /^@number\s+(\d+)\s*$/i
const HEADER_TITLE = /^@title\s+(.+)\s*$/i

/** Bracket/brace headers in `.hymn` text imports and authoring. */
const STANZA_HEADER =
  /^\[(V|Verse)\s*(\d+)\]|^\{(R|Refrain|C|Chorus|B|Bridge|Intro)\}\s*$|^\[([^\]]+)\]\s*$/i

export function stanzaDisplayTag(stanza: HymnStanza, style: HymnalStanzaTagStyle = 'short'): string {
  switch (stanza.kind) {
    case 'verse': {
      const n = stanza.verse ?? 1
      return style === 'long' ? `[Verse ${n}]` : `[V${n}]`
    }
    case 'refrain':
      return '{Refrain}'
    case 'chorus':
      return '{Chorus}'
    case 'bridge':
      return '{Bridge}'
    case 'intro':
      return '{Intro}'
    default:
      return '{Stanza}'
  }
}

/** Slide index when one verse was split across more than one slide. */
export function verseSlidePart(
  stanzas: HymnStanza[],
  stanzaIndex: number
): { verse: number; part: number; count: number } | null {
  const stanza = stanzas[stanzaIndex]
  if (!stanza || stanza.kind !== 'verse' || stanza.verse == null || stanza.verse <= 0) return null
  const count = stanzas.filter((s) => s.kind === 'verse' && s.verse === stanza.verse).length
  const part = stanzas
    .slice(0, stanzaIndex + 1)
    .filter((s) => s.kind === 'verse' && s.verse === stanza.verse).length
  return { verse: stanza.verse, part, count }
}

/** `1` for a single slide, `1 - 2` when the verse continues on another slide. */
export function splitVerseSlideLabel(verse: number, part: number, count: number): string {
  if (count <= 1 || part <= 0) return String(verse)
  return `${verse} - ${part}`
}

/** When a verse was split for slides, show `1 - 1`, `1 - 2`. */
export function stanzaDisplayTagWithPart(
  stanzas: HymnStanza[],
  stanzaIndex: number,
  style: HymnalStanzaTagStyle = 'short'
): string {
  const stanza = stanzas[stanzaIndex]
  if (!stanza) return ''
  const base = stanzaDisplayTag(stanza, style)
  const info = verseSlidePart(stanzas, stanzaIndex)
  if (!info || info.count <= 1) return base
  return splitVerseSlideLabel(info.verse, info.part, info.count)
}

export function parseStanzaHeaderLine(line: string): Omit<HymnStanza, 'lines'> | null {
  const t = line.trim()
  const m = STANZA_HEADER.exec(t)
  if (!m) return null
  if (m[1] || m[2]) {
    const num = Number(m[2])
    if (!Number.isFinite(num) || num <= 0) return null
    return { kind: 'verse', verse: num }
  }
  const token = (m[3] ?? m[4] ?? '').toLowerCase()
  if (token === 'r' || token === 'refrain') return { kind: 'refrain' }
  if (token === 'c' || token === 'chorus') return { kind: 'chorus' }
  if (token === 'b' || token === 'bridge') return { kind: 'bridge' }
  if (token === 'intro') return { kind: 'intro' }
  if (m[4]) return { kind: 'other' }
  return null
}

/** Parse a `.hymn` text document into one entry (single hymn). */
export function parseHymnTextDocument(text: string): {
  number: number
  title: string
  stanzas: HymnStanza[]
} {
  let number = 0
  let title = ''
  const stanzas: HymnStanza[] = []
  let current: HymnStanza | null = null

  const flush = (): void => {
    if (!current) return
    const lines = current.lines.map((l) => l.trimEnd()).filter((l) => l.length > 0)
    if (lines.length > 0) stanzas.push({ ...current, lines })
    current = null
  }

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      flush()
      continue
    }
    const numM = HEADER_NUMBER.exec(line.trim())
    if (numM) {
      number = Number(numM[1])
      continue
    }
    const titleM = HEADER_TITLE.exec(line.trim())
    if (titleM) {
      title = titleM[1].trim()
      continue
    }
    const header = parseStanzaHeaderLine(line.trim())
    if (header) {
      flush()
      current = { ...header, lines: [] }
      continue
    }
    if (!current) {
      current = { kind: 'verse', verse: stanzas.filter((s) => s.kind === 'verse').length + 1, lines: [] }
    }
    current.lines.push(line)
  }
  flush()

  if (!title && number > 0) title = `Hymn ${number}`
  return { number, title, stanzas }
}

/** Parse a multi-hymn `.hymn` file separated by `---` lines. */
export function parseHymnalTextDocument(text: string): { number: number; title: string; stanzas: HymnStanza[] }[] {
  return text
    .split(/\n---+\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => parseHymnTextDocument(block))
    .filter((h) => h.title || h.number > 0)
}

export function normalizeStanza(raw: {
  kind?: HymnStanzaKind
  verse?: number
  label?: string
  lines: string[]
}): HymnStanza {
  if (raw.kind) {
    return {
      kind: raw.kind,
      verse: raw.kind === 'verse' ? raw.verse ?? 1 : undefined,
      lines: raw.lines
    }
  }
  if (raw.label) {
    const parsed = parseStanzaHeaderLine(
      raw.label.startsWith('[') || raw.label.startsWith('{') ? raw.label : `[${raw.label}]`
    )
    if (parsed) return { ...parsed, lines: raw.lines }
  }
  return { kind: 'verse', verse: raw.verse ?? 1, lines: raw.lines }
}

/** Canonical authoring header (short tags) for the text editor. */
export function stanzaAuthoringHeader(stanza: HymnStanza): string {
  switch (stanza.kind) {
    case 'verse':
      return `[V${stanza.verse ?? 1}]`
    case 'refrain':
      return '{Refrain}'
    case 'chorus':
      return '{Chorus}'
    case 'bridge':
      return '{Bridge}'
    case 'intro':
      return '{Intro}'
    default:
      return '{Stanza}'
  }
}

export const HYMN_EDITOR_BODY_DEFAULT = `[V1]

{Refrain}

[V2]
`

export function hymnStanzasToEditorBody(stanzas: HymnStanza[]): string {
  return stanzas
    .map((s) => `${stanzaAuthoringHeader(s)}\n${s.lines.join('\n')}`)
    .join('\n\n')
}

export function composeHymnEditorDocument(number: number, title: string, body: string): string {
  return `@number ${number}\n@title ${title.trim()}\n\n${body.trim()}`
}

export function parseHymnEditorFields(
  number: number,
  title: string,
  body: string
): { number: number; title: string; stanzas: HymnStanza[] } {
  const doc = composeHymnEditorDocument(number, title, body)
  const parsed = parseHymnTextDocument(doc)
  if (parsed.stanzas.length === 0) {
    throw new Error('Add at least one stanza header like [V1] or {Refrain}')
  }
  if (!parsed.title.trim()) {
    throw new Error('Title is required')
  }
  return {
    number: number > 0 ? number : parsed.number,
    title: parsed.title.trim(),
    stanzas: parsed.stanzas
  }
}

export function hymnEntryToEditorBody(entry: { stanzas: HymnStanza[] }): string {
  return hymnStanzasToEditorBody(entry.stanzas)
}
