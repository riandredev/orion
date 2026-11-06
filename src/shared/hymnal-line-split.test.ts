import { describe, expect, it } from 'vitest'
import { expandStanzasForSlides, isSlideSplitMarker, splitLinesOnSlideMarker } from './hymnal-line-split'

describe('hymnal-line-split', () => {
  it('detects five-hyphen slide marker', () => {
    expect(isSlideSplitMarker('-----')).toBe(true)
    expect(isSlideSplitMarker('  -----  ')).toBe(true)
  })

  it('splits lines into two slides', () => {
    const chunks = splitLinesOnSlideMarker(['Line A', '-----', 'Line B'])
    expect(chunks).toEqual([['Line A'], ['Line B']])
  })

  it('expands one verse stanza into two', () => {
    const expanded = expandStanzasForSlides([
      {
        kind: 'verse',
        verse: 1,
        lines: ['Part one', '-----', 'Part two']
      }
    ])
    expect(expanded).toHaveLength(2)
    expect(expanded[0].lines).toEqual(['Part one'])
    expect(expanded[1].lines).toEqual(['Part two'])
  })
})
