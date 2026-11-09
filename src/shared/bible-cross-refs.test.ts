import { describe, expect, it } from 'vitest'
import { decodeCrossRefList } from './bible-cross-refs'

describe('decodeCrossRefList', () => {
  it('reads a verse and a same-chapter range', () => {
    expect(decodeCrossRefList('43.1.1-3 19.33.6')).toEqual([
      { bookId: 'jhn', chapter: 1, verse: 1, endVerse: 3 },
      { bookId: 'psa', chapter: 33, verse: 6 }
    ])
  })

  it('drops tokens that are not references', () => {
    expect(decodeCrossRefList('nope 43.1.1')).toEqual([{ bookId: 'jhn', chapter: 1, verse: 1 }])
  })
})