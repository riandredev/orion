import { describe, expect, it } from 'vitest'
import { clampHymnTypography, DEFAULT_HYMN_TYPOGRAPHY } from './projection-typography'

describe('hymn typography', () => {
  it('uses a slightly larger default for the verse lyrics than the hymn number', () => {
    expect(DEFAULT_HYMN_TYPOGRAPHY.lyrics.sizePx).toBeGreaterThan(DEFAULT_HYMN_TYPOGRAPHY.number.sizePx)
  })

  it('clamps a partial update without dropping the other elements', () => {
    const next = clampHymnTypography({ lyrics: { fontId: 'georgia', sizePx: 400 } })
    expect(next.lyrics).toEqual({ fontId: 'georgia', sizePx: 160, color: '#ffffff' })
    expect(next.number).toEqual(DEFAULT_HYMN_TYPOGRAPHY.number)
  })
})
