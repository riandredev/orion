import { describe, expect, it } from 'vitest'
import {
  expandStanzasForSlides,
  isSlideSplitMarker,
  joinLegacySoftWrapLines,
  splitLinesOnSlideMarker
} from './hymnal-line-split'

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

  it('joins legacy Bibsoft soft-wrap halves into lyric lines', () => {
    expect(
      joinLegacySoftWrapLines([
        'Gee my die Bybel,',
        'ster vol lig en luister,',
        'vir eensaam’ swerwers',
        'op hul pelgrimsreis;',
        'geen storm kan daardie',
        'ster se lig verduister,',
        'want Jesus self het',
        'uit die graf verrys.'
      ])
    ).toEqual([
      'Gee my die Bybel, ster vol lig en luister,',
      'vir eensaam’ swerwers op hul pelgrimsreis;',
      'geen storm kan daardie ster se lig verduister,',
      'want Jesus self het uit die graf verrys.'
    ])
  })

  it('leaves already-correct longer lyric lines alone', () => {
    const lines = [
      'Gee my die Bybel, evangelie heilig,',
      'my gids en leidster op die noue pad;',
      'Voorskrif belofte, rig ons skrede veilig',
      'deur donker nag tot in die hemelstad.'
    ]
    expect(joinLegacySoftWrapLines(lines)).toEqual(lines)
  })

  it('does not join a normal 4-line short-meter verse', () => {
    const lines = [
      'Ek gee my hart aan U,',
      'o Jesus, dierb’re Heer;',
      'Hoe trek U liefde my,',
      'tot ek U ook bemin;'
    ]
    expect(joinLegacySoftWrapLines(lines)).toEqual(lines)
  })

  it('joins only short halves inside a mixed stanza', () => {
    expect(
      joinLegacySoftWrapLines([
        'Net soos ‘n vader neem Hy ons aan',
        'vol medelye, as ons tot Hom gaan;',
        'en wyl ons fluister,',
        'weet ons Hy luister,',
        'wat al ons diepste',
        'begeertes verstaan.'
      ])
    ).toEqual([
      'Net soos ‘n vader neem Hy ons aan',
      'vol medelye, as ons tot Hom gaan;',
      'en wyl ons fluister, weet ons Hy luister,',
      'wat al ons diepste begeertes verstaan.'
    ])
  })
})