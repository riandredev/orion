export type HymnalLanguage = 'en' | 'af' | 'other'

export type HymnStanzaKind = 'verse' | 'refrain' | 'chorus' | 'bridge' | 'intro' | 'other'

/** How stanza tags appear in the UI and on projection slides. */
export type HymnalStanzaTagStyle = 'short' | 'long'

export type HymnStanza = {
  kind: HymnStanzaKind
  /** Verse number when kind is verse (1-based). */
  verse?: number
  lines: string[]
}

export type HymnalMeta = {
  id: string
  label: string
  abbr: string
  language: HymnalLanguage
  /** Shipped with the app vs imported under user data. */
  source: 'builtin' | 'user'
  hymnCount: number
}

export type HymnSummary = {
  id: string
  hymnalId: string
  number: number
  title: string
  /** Optional list / detail metadata (stored in index.json when available). */
  author?: string | null
  stanzaCount?: number
  verseCount?: number
  hasRefrain?: boolean
}

export type HymnEntry = HymnSummary & {
  stanzas: HymnStanza[]
}

/** Portable import bundle (one JSON file). */
export type HymnalImportBundle = {
  format: 'orion-hymnal'
  version: 1
  meta: {
    label: string
    abbr?: string
    language?: HymnalLanguage
  }
  hymns: {
    number: number
    title: string
    stanzas: HymnStanza[]
  }[]
}

export type HymnalIndexFile = {
  summaries: HymnSummary[]
}

export type HymnalHymnsFile = {
  hymns: HymnEntry[]
}
