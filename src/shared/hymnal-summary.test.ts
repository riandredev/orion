import { describe, expect, it } from 'vitest'
import { formatHymnListMeta, hymnSummaryFromEntry } from './hymnal-summary'

describe('hymnal-summary', () => {
  it('builds list meta from counts and author', () => {
    const summary = hymnSummaryFromEntry({
      id: 'h001',
      hymnalId: 'test',
      number: 1,
      title: 'Amazing Grace',
      author: 'John Newton',
      stanzas: [
        { kind: 'verse', verse: 1, lines: ['a'] },
        { kind: 'verse', verse: 2, lines: ['b'] },
        { kind: 'refrain', lines: ['c'] }
      ]
    })
    expect(formatHymnListMeta(summary)).toBe('3 stanzas · 2 verses · refrain · John Newton')
  })
})
