import { describe, expect, it } from 'vitest'
import {
  parseHymnEditorFields,
  parseHymnTextDocument,
  stanzaDisplayTag,
  stanzaDisplayTagWithPart
} from './hymnal-stanza-format'
import type { HymnStanza } from './hymnal-types'

describe('hymnal-stanza-format', () => {
  it('formats verse and refrain tags', () => {
    expect(stanzaDisplayTag({ kind: 'verse', verse: 1, lines: [] }, 'short')).toBe('[V1]')
    expect(stanzaDisplayTag({ kind: 'verse', verse: 1, lines: [] }, 'long')).toBe('[Verse 1]')
    expect(stanzaDisplayTag({ kind: 'refrain', lines: [] })).toBe('{Refrain}')
    expect(stanzaDisplayTag({ kind: 'chorus', lines: [] })).toBe('{Chorus}')
  })

  it('labels each part of a split refrain', () => {
    const stanzas: HymnStanza[] = [
      { kind: 'refrain', lines: ['a'] },
      { kind: 'refrain', lines: ['b'] }
    ]
    expect(stanzaDisplayTagWithPart(stanzas, 0)).toBe('Refrain 1 - 1')
    expect(stanzaDisplayTagWithPart(stanzas, 1)).toBe('Refrain 1 - 2')
  })

  it('parses .hymn text with headers', () => {
    const h = parseHymnTextDocument(`@number 42
@title Test Song

[V1]
Line A

{Refrain}
Line R

[V2]
Line B`)
    expect(h.number).toBe(42)
    expect(h.title).toBe('Test Song')
    expect(h.stanzas).toHaveLength(3)
    expect(h.stanzas[0]?.kind).toBe('verse')
    expect(h.stanzas[1]?.kind).toBe('refrain')
  })

  it('parses editor fields', () => {
    const parsed = parseHymnEditorFields(
      5,
      'Test',
      `[V1]
Hello

{Chorus}
Sing`
    )
    expect(parsed.stanzas).toHaveLength(2)
    expect(parsed.stanzas[1]?.kind).toBe('chorus')
  })
})
