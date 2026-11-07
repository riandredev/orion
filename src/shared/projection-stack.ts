import type { HymnSlideKind } from './hymnal-projection-sequence'

export type OrionStackSource = 'order' | 'bible' | 'presentation'

export const orderImageAnimations = [
  'crossfade',
  'fade',
  'cut',
  'wipe',
  'push',
  'cover',
  'uncover',
  'split'
] as const

export type OrderImageAnimation = (typeof orderImageAnimations)[number]

export type OrionStackState = {
  base: OrionStackSource | null
  overlay: OrionStackSource | null
}

export type OrionStackLayerContent =
  | {
      type: 'image'
      filePath: string
      animation?: OrderImageAnimation
      durationMs?: number
    }
  | {
      type: 'media'
      filePath: string
      name: string
      kind: 'video' | 'audio'
    }
  | {
      type: 'deck-slide'
      markup: string
      width: number
      height: number
      transition: string
      durationMs: number
      media: {
        filePath: string
        leftPct: number
        topPct: number
        widthPct: number
        heightPct: number
        kind: 'video' | 'audio'
      }[]
    }
  | {
      type: 'bible'
      reference: string
      locationLabel: string
      translationLabel: string
      verses: { number: number; text: string }[]
      highlightVerse?: number
      backgroundImagePath?: string | null
      backgroundColor?: string
      backgroundDimOpacity?: number
      backgroundFit?: 'cover' | 'contain'
    }
  | {
      type: 'dictionary'
      strongs: string
      lemma: string
      transliteration: string | null
      gloss: string | null
      partOfSpeech: string | null
      definition: string
      language: 'hebrew' | 'aramaic' | 'greek'
      infoBar: string[]
      infoBarActive: number
      backgroundImagePath?: string | null
      backgroundColor?: string
      backgroundDimOpacity?: number
      backgroundFit?: 'cover' | 'contain'
    }
  | {
      type: 'hymn'
      number: number
      title: string
      slideKind: HymnSlideKind
      stanzaKind: string
      verse?: number
      versePart?: number
      versePartCount?: number
      lines: string[]
      author?: string | null
      backgroundImagePath?: string | null
      backgroundColor?: string
      backgroundDimOpacity?: number
      backgroundFit?: 'cover' | 'contain'
      animation?: 'none' | OrderImageAnimation
      durationMs?: number
    }

/** Main-process projection mutations (ProPresenter-style per-layer control). */
export type OrionProjectionCommand =
  | { type: 'set-layer'; source: OrionStackSource; content: OrionStackLayerContent }
  | { type: 'clear-layer'; source: OrionStackSource }
  | { type: 'clear-all' }
