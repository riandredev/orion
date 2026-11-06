import { describe, expect, it } from 'vitest'
import { parseHelloAoSimpleComplete } from './bible-helloao'

describe('parseHelloAoSimpleComplete', () => {
  it('maps helloao books to orion module', () => {
    const module = parseHelloAoSimpleComplete({
      translation: { shortName: 'BSB', englishName: 'Berean Standard Bible' },
      books: [
        {
          id: 'JHN',
          chapters: [
            {
              chapter: {
                number: 3,
                content: [
                  { type: 'verse', number: 16, text: 'For God so loved the world.' }
                ]
              }
            }
          ]
        }
      ]
    })
    expect(module.abbr).toBe('BSB')
    expect(module.books.jhn?.['3']?.['16']).toContain('God so loved')
  })

  it('uses KJV for King James Version despite helloao shortName', () => {
    const module = parseHelloAoSimpleComplete({
      translation: { shortName: 'KJAV', englishName: 'King James Version' },
      books: [
        {
          id: 'GEN',
          chapters: [
            {
              chapter: {
                number: 1,
                content: [{ type: 'verse', number: 1, text: 'In the beginning…' }]
              }
            }
          ]
        }
      ]
    })
    expect(module.abbr).toBe('KJV')
  })
})
