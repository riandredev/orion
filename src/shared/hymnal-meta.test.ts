import { describe, expect, it } from 'vitest'
import { normalizeBundledHymnalMeta } from './hymnal-meta'
import type { HymnalMeta } from './hymnal-types'

describe('normalizeBundledHymnalMeta', () => {
  it('keeps a Panorama user copy marked as user so saves do not rematerialize stock', () => {
    const meta: HymnalMeta = {
      id: 'adventist-1-afrikaans',
      label: 'Custom',
      abbr: 'AF',
      language: 'xx',
      source: 'user',
      hymnCount: 10
    }
    expect(normalizeBundledHymnalMeta(meta)).toEqual({
      id: 'adventist-1-afrikaans',
      label: 'Afrikaans',
      abbr: 'Afrikaans',
      language: 'af',
      source: 'user',
      hymnCount: 10
    })
  })
})
