import { describe, expect, it } from 'vitest'
import { hymnProjectionCornerLabel } from './hymn-projection-display'

describe('hymnProjectionCornerLabel', () => {
  it('uses verse number only for verses', () => {
    expect(hymnProjectionCornerLabel('verse', 3)).toBe('3')
  })

  it('numbers each slide when a verse is split', () => {
    expect(hymnProjectionCornerLabel('verse', 1, 1, 2)).toBe('1 - 1')
    expect(hymnProjectionCornerLabel('verse', 1, 2, 2)).toBe('1 - 2')
  })

  it('uses Refrain for refrain', () => {
    expect(hymnProjectionCornerLabel('refrain')).toBe('Refrain')
  })

  it('numbers each slide when a refrain is split', () => {
    expect(hymnProjectionCornerLabel('refrain', undefined, 1, 2)).toBe('Refrain 1 - 1')
    expect(hymnProjectionCornerLabel('refrain', undefined, 2, 2)).toBe('Refrain 1 - 2')
  })
})
