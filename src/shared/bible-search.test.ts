import { describe, expect, it } from 'vitest'
import {
  buildBibleSearchSuggestions,
  inferBibleSearchMode,
  parseBibleReference,
  searchModuleText
} from './bible-search'

describe('parseBibleReference', () => {
  it('parses common references', () => {
    expect(parseBibleReference('John 3:16')).toEqual({
      bookId: 'jhn',
      chapter: 3,
      verse: 16
    })
    expect(parseBibleReference('mat 1')).toEqual({ bookId: 'mat', chapter: 1, verse: 1 })
    expect(parseBibleReference('Song of Solomon 1:12')).toEqual({
      bookId: 'sng',
      chapter: 1,
      verse: 12
    })
    expect(parseBibleReference('Johannes 3:16')).toEqual({
      bookId: 'jhn',
      chapter: 3,
      verse: 16
    })
    expect(parseBibleReference('Hooglied 1:2')).toEqual({
      bookId: 'sng',
      chapter: 1,
      verse: 2
    })
    expect(parseBibleReference('openbaring:1:1')).toEqual({
      bookId: 'rev',
      chapter: 1,
      verse: 1
    })
    expect(parseBibleReference('jhn:3:16')).toEqual({
      bookId: 'jhn',
      chapter: 3,
      verse: 16
    })
  })
})

describe('inferBibleSearchMode', () => {
  it('detects reference vs text', () => {
    expect(inferBibleSearchMode('John 3:16')).toBe('reference')
    expect(inferBibleSearchMode('psalms')).toBe('reference')
    expect(inferBibleSearchMode('love')).toBe('word')
    expect(inferBibleSearchMode('God so loved')).toBe('phrase')
  })
})

describe('buildBibleSearchSuggestions', () => {
  it('suggests books by prefix', () => {
    const items = buildBibleSearchSuggestions('joh', 'entire')
    expect(items.some((s) => s.bookId === 'jhn')).toBe(true)
  })

  it('suggests Psalms for book name query', () => {
    const items = buildBibleSearchSuggestions('psalms', 'entire', true)
    expect(items[0]?.kind).toBe('book')
    expect(items[0]?.bookId).toBe('psa')
    expect(items[0]?.label).toBe('Psalms')
  })
})

describe('searchModuleText', () => {
  it('finds phrase in module', () => {
    const hits = searchModuleText(
      {
        books: {
          jhn: {
            '3': { '16': 'For God so loved the world.' }
          }
        }
      },
      'God so loved',
      'phrase',
      'entire',
      10
    )
    expect(hits).toHaveLength(1)
    expect(hits[0]?.verse).toBe(16)
  })
})
