import { describe, expect, it } from 'vitest'
import {
  bibleLocationFromReference,
  bibleProjectionTranslationLabel,
  formatBibleProjectionLocation
} from './bible-projection-display'

describe('bible-projection-display', () => {
  it('prefers full translation label', () => {
    expect(
      bibleProjectionTranslationLabel({ label: 'AFR 33/53 Translation', abbr: 'AFR53' })
    ).toBe('AFR 33/53 Translation')
  })

  it('formats location with colons', () => {
    expect(formatBibleProjectionLocation('John', 3, 16)).toBe('John:3:16')
  })

  it('derives location from legacy reference', () => {
    expect(bibleLocationFromReference('Song of Solomon 1:12')).toBe('Song of Solomon:1:12')
  })
})
