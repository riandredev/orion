import { describe, expect, it } from 'vitest'
import {
  buildHymnProjectionSteps,
  projectionStepAt,
  stanzaIndexAtProjectionStep
} from './hymnal-projection-sequence'
import { expandStanzasForSlides } from './hymnal-line-split'
import type { HymnStanza } from './hymnal-types'

function lyricIndices(steps: ReturnType<typeof buildHymnProjectionSteps>): number[] {
  return steps.filter((s) => s.kind === 'lyrics').map((s) => s.stanzaIndex)
}

describe('hymnal-projection-sequence', () => {
  it('bookends title and end slides around lyric steps', () => {
    const stanzas: HymnStanza[] = [
      { kind: 'verse', verse: 1, lines: ['a'] },
      { kind: 'verse', verse: 2, lines: ['b'] }
    ]
    const steps = buildHymnProjectionSteps(stanzas)
    expect(steps[0]?.kind).toBe('title')
    expect(steps[steps.length - 1]?.kind).toBe('end')
    expect(lyricIndices(steps)).toEqual([0, 1])
  })

  it('walks stanzas in order when there is no refrain', () => {
    const stanzas: HymnStanza[] = [
      { kind: 'verse', verse: 1, lines: ['a'] },
      { kind: 'verse', verse: 2, lines: ['b'] }
    ]
    expect(lyricIndices(buildHymnProjectionSteps(stanzas))).toEqual([0, 1])
  })

  it('alternates verse then refrain', () => {
    const stanzas: HymnStanza[] = [
      { kind: 'refrain', lines: ['r'] },
      { kind: 'verse', verse: 1, lines: ['v1'] },
      { kind: 'verse', verse: 2, lines: ['v2'] }
    ]
    expect(lyricIndices(buildHymnProjectionSteps(stanzas))).toEqual([1, 0, 2, 0])
  })

  it('skips disabled verses but keeps refrain between sung verses', () => {
    const stanzas: HymnStanza[] = [
      { kind: 'refrain', lines: ['r'] },
      { kind: 'verse', verse: 1, lines: ['v1'] },
      { kind: 'verse', verse: 2, lines: ['v2'] },
      { kind: 'verse', verse: 3, lines: ['v3'] }
    ]
    const steps = buildHymnProjectionSteps(stanzas, { disabledVerseNumbers: [2] })
    expect(lyricIndices(steps)).toEqual([1, 0, 3, 0])
  })

  it('includes split verse as multiple steps before refrain', () => {
    const raw: HymnStanza[] = [
      { kind: 'refrain', lines: ['r'] },
      {
        kind: 'verse',
        verse: 1,
        lines: ['a', '-----', 'b']
      }
    ]
    const stanzas = expandStanzasForSlides(raw)
    const steps = buildHymnProjectionSteps(stanzas)
    const lyricLines = steps.filter((s) => s.kind === 'lyrics').map((s) => s.lines.join('|'))
    expect(lyricLines).toEqual(['a', 'b', 'r'])
    const bStepIdx = steps.findIndex((s) => s.kind === 'lyrics' && s.lines[0] === 'b')
    expect(stanzaIndexAtProjectionStep(steps, bStepIdx)).toBe(
      stanzas.findIndex((s) => s.lines[0] === 'b')
    )
  })

  it('walks every part of a split refrain before the next verse', () => {
    const raw: HymnStanza[] = [
      { kind: 'verse', verse: 1, lines: ['v1'] },
      { kind: 'refrain', lines: ['r1', '-----', 'r2'] },
      { kind: 'verse', verse: 2, lines: ['v2'] }
    ]
    const stanzas = expandStanzasForSlides(raw)
    const lines = buildHymnProjectionSteps(stanzas)
      .filter((step) => step.kind === 'lyrics')
      .map((step) => step.lines.join('|'))
    expect(lines).toEqual(['v1', 'r1', 'r2', 'v2', 'r1', 'r2'])
  })

  it('can omit the title and end slides', () => {
    const stanzas: HymnStanza[] = [
      { kind: 'verse', verse: 1, lines: ['a'] },
      { kind: 'verse', verse: 2, lines: ['b'] }
    ]
    const steps = buildHymnProjectionSteps(stanzas, { includeTitle: false, includeEnd: false })
    expect(steps.map((step) => step.kind)).toEqual(['lyrics', 'lyrics'])
  })

  it('projection step carries line payload', () => {
    const stanzas: HymnStanza[] = [{ kind: 'verse', verse: 1, lines: ['hello'] }]
    const steps = buildHymnProjectionSteps(stanzas)
    const firstLyric = steps.find((s) => s.kind === 'lyrics')
    expect(firstLyric?.lines).toEqual(['hello'])
    expect(projectionStepAt(steps, 0)?.kind).toBe('title')
  })
})
