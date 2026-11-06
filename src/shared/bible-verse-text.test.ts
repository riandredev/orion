import { describe, expect, it } from 'vitest'
import { chapterFromModule } from './bible-import'
import { normalizeVerseDisplayText } from './bible-verse-text'

describe('normalizeVerseDisplayText', () => {
  it('removes leading KJV pilcrow paragraph marks', () => {
    expect(normalizeVerseDisplayText('¶ While the king sat')).toBe('While the king sat')
  })
})

describe('chapterFromModule', () => {
  it('strips pilcrows when returning verses', () => {
    const verses = chapterFromModule(
      {
        label: 'KJV',
        abbr: 'KJV',
        books: { sng: { '1': { '12': '¶ While the king sitteth' } } }
      },
      'sng',
      1
    )
    expect(verses[0]?.text.startsWith('¶')).toBe(false)
  })
})
