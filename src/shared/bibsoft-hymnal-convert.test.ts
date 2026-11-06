import { describe, expect, it } from 'vitest'
import {
  convertBibsoftHymnal,
  splitBibsoftVerseText,
  inferBibsoftHymnalLanguage
} from './bibsoft-hymnal-convert'

describe('bibsoft-hymnal-convert', () => {
  it('joins soft wraps and keeps real lyric lines', () => {
    expect(splitBibsoftVerseText('Prys die Heer met blye \rgalme,\r\n o my siel daar’s \rryke stof;')).toEqual([
      'Prys die Heer met blye galme,',
      'o my siel daar’s ryke stof;'
    ])
  })

  it('keeps a slide marker on its own line', () => {
    expect(splitBibsoftVerseText('First line\r\n\r-----\r\r\nSecond \rline')).toEqual([
      'First line',
      '-----',
      'Second line'
    ])
  })

  it('maps verse 0 to refrain and numbers to verses', () => {
    const bundle = convertBibsoftHymnal('test-af', 1, 'Afrikaans', [
      {
        Hymnal: 1,
        HymnNumber: 100,
        HymnName: 'Dierb’re Naam',
        VerseNumber: 0,
        VerseText: 'Refrain line one\r\nRefrain line two'
      },
      {
        Hymnal: 1,
        HymnNumber: 100,
        HymnName: 'Dierb’re Naam',
        VerseNumber: 1,
        VerseText: 'Verse one'
      },
      {
        Hymnal: 1,
        HymnNumber: 100,
        HymnName: 'Dierb’re Naam',
        VerseNumber: 2,
        VerseText: 'Verse two'
      }
    ])
    expect(bundle.hymns).toHaveLength(1)
    expect(bundle.hymns[0].stanzas).toEqual([
      { kind: 'refrain', lines: ['Refrain line one', 'Refrain line two'] },
      { kind: 'verse', verse: 1, lines: ['Verse one'] },
      { kind: 'verse', verse: 2, lines: ['Verse two'] }
    ])
    expect(inferBibsoftHymnalLanguage('Afrikaans')).toBe('af')
  })
})
