import { describe, expect, it } from 'vitest'
import { hymnMusicFileMatches, pickHymnMusicPath } from './hymn-music'

describe('hymnMusicFileMatches', () => {
  it('matches plain and zero-padded hymn numbers', () => {
    expect(hymnMusicFileMatches('1.mp3', 1)).toBe(true)
    expect(hymnMusicFileMatches('001.mp3', 1)).toBe(true)
    expect(hymnMusicFileMatches('134.MP3', 134)).toBe(true)
  })

  it('rejects other names', () => {
    expect(hymnMusicFileMatches('1.m4a', 1)).toBe(false)
    expect(hymnMusicFileMatches('1a.mp3', 1)).toBe(false)
    expect(hymnMusicFileMatches('hymn-1.mp3', 1)).toBe(false)
    expect(hymnMusicFileMatches('2.mp3', 1)).toBe(false)
  })
})

describe('pickHymnMusicPath', () => {
  it('returns the first Music-folder match', () => {
    expect(
      pickHymnMusicPath(
        [
          { name: 'intro.mp3', path: '/Music/intro.mp3' },
          { name: '001.mp3', path: '/Music/001.mp3' }
        ],
        1
      )
    ).toBe('/Music/001.mp3')
  })
})
