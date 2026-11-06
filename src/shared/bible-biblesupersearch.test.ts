import { describe, expect, it } from 'vitest'
import { parseBibleSuperSearchJson } from './bible-biblesupersearch'

describe('parseBibleSuperSearchJson', () => {
  it('maps verse rows into Orion module books', () => {
    const module = parseBibleSuperSearchJson({
      metadata: { name: 'Afrikaans 1953', shortname: 'Afrikaans', module: 'afri' },
      verses: [
        { book: 1, chapter: 1, verse: 1, text: 'In die begin…' },
        { book: 43, chapter: 3, verse: 16, text: 'Want so lief het God…' }
      ]
    })
    expect(module.label).toBe('Afrikaans 1953')
    expect(module.books.gen?.['1']?.['1']).toBe('In die begin…')
    expect(module.books.jhn?.['3']?.['16']).toBe('Want so lief het God…')
  })
})
