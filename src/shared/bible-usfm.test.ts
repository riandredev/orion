import { describe, expect, it } from 'vitest'
import { chapterFromModule } from './bible-import'
import { parseUsfm } from './bible-usfm'

describe('parseUsfm', () => {
  it('parses book, chapter, and verses', () => {
    const sample = String.raw`\id SNG - Song of Solomon
\c 1
\v 1 The Song of songs, which is Solomon's.
\v 12 While the king sat at his table, my perfume spread its fragrance.
`
    const module = parseUsfm(sample)
    const verses = chapterFromModule(module, 'sng', 1)
    expect(verses).toHaveLength(2)
    expect(verses[0]?.number).toBe(1)
    expect(verses[1]?.text).toContain('my perfume')
  })
})
