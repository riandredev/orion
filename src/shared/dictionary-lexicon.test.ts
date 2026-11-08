import { describe, expect, it } from 'vitest'
import {
  formatStrongsDisplay,
  normalizeStrongsId,
  parseStrongsQuery,
  queryLexiconSummaries,
  sortLexiconSummariesForBrowse,
  buildDictionaryProjectionInfoBar
} from './dictionary-lexicon'
import type { LexiconEntrySummary } from './dictionary-types'

const sample: LexiconEntrySummary[] = [
  { id: 'H0001', language: 'hebrew', name: 'אָב', transliterationHint: 'av' },
  { id: 'H0024', language: 'hebrew', name: 'אָבִיב', transliterationHint: 'a.viv', glossHint: 'Abib' },
  { id: 'G3056', language: 'greek', name: 'λόγος', transliterationHint: 'logos', glossHint: 'word' },
  { id: 'G2540', language: 'greek', name: 'καιρός', transliterationHint: 'kairos', glossHint: 'time/right time' }
]

describe('dictionary-lexicon', () => {
  it('normalizes Strong numbers for helloao', () => {
    expect(normalizeStrongsId('H1')).toBe('H0001')
    expect(normalizeStrongsId('h430')).toBe('H0430')
    expect(parseStrongsQuery('G 3056')).toBe('G3056')
  })

  it('formats display ids without leading zeros', () => {
    expect(formatStrongsDisplay('H0001')).toBe('H1')
    expect(formatStrongsDisplay('G3056')).toBe('G3056')
  })

  it('searches summaries by number, transliteration, or gloss', () => {
    expect(queryLexiconSummaries(sample, 'H1', 'all', 0, 10).items).toHaveLength(1)
    expect(queryLexiconSummaries(sample, 'logos', 'greek', 0, 10).items[0]?.id).toBe('G3056')
    expect(queryLexiconSummaries(sample, 'kairos', 'greek', 0, 10).items[0]?.id).toBe('G2540')
    expect(queryLexiconSummaries(sample, 'abib', 'hebrew', 0, 10).items[0]?.id).toBe('H0024')
  })

  it('sorts Hebrew before Greek for browse', () => {
    const sorted = sortLexiconSummariesForBrowse([
      { id: 'G0001', language: 'greek', name: 'α', transliterationHint: 'a' },
      { id: 'H0001', language: 'hebrew', name: 'אָב', transliterationHint: 'av' }
    ])
    expect(sorted[0]?.id).toBe('H0001')
  })

  it('uses distinct definition headlines for multi-sense bar', () => {
    const bar = buildDictionaryProjectionInfoBar('hebrew', [
      {
        gloss: 'Abinadab',
        partOfSpeech: 'N-M-P',
        transliteration: 'a.vi.na.dav',
        definition:
          'A man living at the time of United Monarchy, first mentioned at 1Sa.7.1;\n\nfather of: Eleazar'
      },
      {
        gloss: 'Abinadab',
        partOfSpeech: 'N-M-P',
        transliteration: 'a.vi.na.dav',
        definition:
          'A man of the tribe of Benjamin living at the time of United Monarchy, first mentioned at 1Sa.14.49;'
      }
    ])
    expect(bar.segments[0]).toContain('1Sa.7.1')
    expect(bar.segments[1]).toContain('Benjamin')
  })

  it('returns full total with paginated slices', () => {
    const many = Array.from({ length: 300 }, (_, i) => ({
      id: `H${String(i + 1).padStart(4, '0')}`,
      language: 'hebrew' as const,
      name: 'x',
      transliterationHint: 'x'
    }))
    const page = queryLexiconSummaries(many, '', 'hebrew', 0, 120)
    expect(page.total).toBe(300)
    expect(page.items).toHaveLength(120)
  })
})
