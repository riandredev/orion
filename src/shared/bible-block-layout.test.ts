import { describe, expect, it } from 'vitest'
import {
  bibleLayoutIsStacked,
  bibleProjPartClasses,
  clampBibleBlockLayout,
  DEFAULT_BIBLE_BLOCK_LAYOUT
} from './bible-block-layout'

describe('bible block layout', () => {
  it('keeps the stacked slide until a block is moved', () => {
    expect(bibleLayoutIsStacked(DEFAULT_BIBLE_BLOCK_LAYOUT)).toBe(true)
    expect(bibleProjPartClasses(DEFAULT_BIBLE_BLOCK_LAYOUT).wrap).toBe('bible-proj')
  })

  it('starts each block with no extra margin', () => {
    expect(clampBibleBlockLayout({ reference: 'top-left' }).margin.reference).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    })
  })

  it('places the heading, version, and passage on separate anchors', () => {
    const layout = clampBibleBlockLayout({
      reference: 'top-left',
      translation: 'bottom',
      verse: 'bottom-left'
    })
    const parts = bibleProjPartClasses(layout)
    expect(parts.wrap).toContain('bible-proj--split-heading')
    expect(parts.location).toContain('bible-anchor-top-left')
    expect(parts.translation).toContain('bible-anchor-bottom')
    expect(parts.body).toContain('bible-anchor-bottom-left')
  })
})
