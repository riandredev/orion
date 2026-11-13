import { describe, expect, it } from 'vitest'
import {
  moveSequenceCursor,
  parseServiceSequence,
  sequenceStepCount,
  type ServiceSequenceItem
} from './service-sequence'

const hymn: ServiceSequenceItem = {
  id: 'h',
  kind: 'hymn',
  hymnalId: 'hymnal',
  hymnId: '12',
  number: 12,
  title: 'Grace',
  disabledVerseNumbers: [3],
  includeRefrain: false,
  steps: [
    { kind: 'title', stanzaIndex: -1, lines: [], stanzaKind: 'title', label: 'Title' },
    { kind: 'lyrics', stanzaIndex: 0, lines: ['Line'], stanzaKind: 'verse', verse: 1, label: 'V1' },
    { kind: 'end', stanzaIndex: -1, lines: [], stanzaKind: 'end', label: 'End' }
  ]
}

const deck: ServiceSequenceItem = {
  id: 'd',
  kind: 'presentation',
  deckId: 'deck',
  title: 'Lesson',
  slideCount: 2
}

describe('service sequence cursor', () => {
  const items = [hymn, deck]

  it('walks hymn slides before the next item', () => {
    expect(moveSequenceCursor(items, { itemIndex: 0, stepIndex: 0 }, 1)).toEqual({
      itemIndex: 0,
      stepIndex: 1
    })
    expect(moveSequenceCursor(items, { itemIndex: 0, stepIndex: 2 }, 1)).toEqual({
      itemIndex: 1,
      stepIndex: 0
    })
    expect(sequenceStepCount(deck)).toBe(2)
  })

  it('steps back into the previous item at its last slide', () => {
    expect(moveSequenceCursor(items, { itemIndex: 1, stepIndex: 0 }, -1)).toEqual({
      itemIndex: 0,
      stepIndex: 2
    })
  })

  it('round-trips a saved file', () => {
    const file = parseServiceSequence(JSON.stringify({ version: 1, items }))
    expect(file?.items).toHaveLength(2)
    expect(file?.items[0]).toMatchObject({ kind: 'hymn', includeRefrain: false, disabledVerseNumbers: [3] })
  })

  it('keeps a web page and a media file', () => {
    const saved = [
      ...items,
      {
        id: 'web-1',
        kind: 'web' as const,
        url: 'https://www.youtube.com/watch?v=abc',
        title: 'Lesson'
      },
      {
        id: 'media-1',
        kind: 'media' as const,
        folder: 'Videos',
        path: 'C:/media/Videos/clip.mp4',
        name: 'clip.mp4',
        mediaKind: 'video' as const
      }
    ]
    const file = parseServiceSequence(JSON.stringify({ version: 1, items: saved }))
    expect(file?.items[2]).toMatchObject({ kind: 'web', title: 'Lesson' })
    expect(file?.items[3]).toMatchObject({ kind: 'media', mediaKind: 'video', name: 'clip.mp4' })
  })

  it('keeps hymn options, a verse, and a dictionary entry', () => {
    const saved: ServiceSequenceItem[] = [
      { ...hymn, includeTitle: false, includeEnd: true },
      {
        id: 'b',
        kind: 'bible',
        bookId: 'john',
        chapter: 1,
        verse: 1,
        text: 'In the beginning',
        reference: 'John 1:1',
        locationLabel: 'John 1:1',
        translationLabel: 'KJV'
      },
      {
        id: 'dict',
        kind: 'dictionary',
        strongs: 'G26',
        lemma: 'ἀγάπη',
        transliteration: 'agapē',
        gloss: 'love',
        partOfSpeech: 'noun',
        definition: 'Love.',
        language: 'greek',
        infoBar: ['noun', 'love'],
        infoBarActive: 0
      }
    ]
    const file = parseServiceSequence(JSON.stringify({ version: 1, items: saved }))
    expect(file?.items[0]).toMatchObject({ includeTitle: false, includeEnd: true, steps: hymn.steps })
    expect(file?.items[1]).toMatchObject({ kind: 'bible', bookId: 'john', translationLabel: 'KJV' })
    expect(file?.items[2]).toMatchObject({ kind: 'dictionary', strongs: 'G26', language: 'greek', infoBarActive: 0 })
  })
})
