import type {
  OrderImageAnimation,
  OrionStackLayerContent,
  OrionStackSource,
  OrionStackState
} from './projection-stack'
import { buildPresentationUiState, type PresentationUiState } from './presentation-ui-state'

export type ProjectionWireImage = {
  type: 'image'
  filePath: string
  mediaUrl: string
  animation: OrderImageAnimation
  durationMs: number
}

export type ProjectionWireBible = {
  type: 'bible'
  reference: string
  locationLabel: string
  translationLabel: string
  verses: { number: number; text: string }[]
  highlightVerse?: number
  backgroundMediaUrl?: string
  backgroundColor?: string
  backgroundDimOpacity?: number
  backgroundFit?: 'cover' | 'contain'
  animation?: 'fade' | 'push' | 'cut'
  durationMs?: number
}

export type ProjectionWireDictionary = {
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
  backgroundMediaUrl?: string
  backgroundColor?: string
  backgroundDimOpacity?: number
  backgroundFit?: 'cover' | 'contain'
}

export type ProjectionWireHymn = {
  type: 'hymn'
  number: number
  title: string
  slideKind: string
  stanzaKind: string
  verse?: number
  versePart?: number
  versePartCount?: number
  lines: string[]
  author?: string
  animation?: string
  durationMs?: number
  backgroundMediaUrl?: string
  backgroundColor?: string
  backgroundDimOpacity?: number
  backgroundFit?: 'cover' | 'contain'
}

export type ProjectionWireMedia = {
  type: 'media'
  filePath: string
  mediaUrl: string
  name: string
  kind: 'video' | 'audio'
  autoplay?: boolean
}

export type ProjectionWireDeckSlide = {
  type: 'deck-slide'
  markup: string
  width: number
  height: number
  transition: string
  durationMs: number
  autoplayMedia?: boolean
  media: {
    mediaUrl: string
    leftPct: number
    topPct: number
    widthPct: number
    heightPct: number
    kind: 'video' | 'audio'
  }[]
}

export type ProjectionWirePayload =
  | ProjectionWireImage
  | ProjectionWireBible
  | ProjectionWireDictionary
  | ProjectionWireHymn
  | ProjectionWireDeckSlide
  | ProjectionWireMedia

export type ProjectionStageState = {
  base: ProjectionWirePayload | null
  overlay: ProjectionWirePayload | null
}

/**
 * Industry-grade Broadcast Compositor Engine (ProPresenter / Resolume z-ordered layer architecture):
 *
 * Each source owns a compositor bus: service order, scripture (bible / hymns / dictionary),
 * and presentation. The stage has two slots. Presentation sits on top of whichever other
 * bus is showing. Order and scripture share the lower slot when a presentation is up,
 * with the order image preferred. Stopping one bus leaves the others on screen.
 */
export class ProjectionMixerEngine {
  private orderWire: ProjectionWireImage | null = null
  private bibleWire: ProjectionWireBible | ProjectionWireDictionary | ProjectionWireHymn | null = null
  private presentationWire: ProjectionWireImage | ProjectionWireDeckSlide | ProjectionWireMedia | null = null

  getStackState(): OrionStackState {
    const stage = this.getStageState()
    const sourceOf = (wire: ProjectionWirePayload | null): OrionStackSource | null => {
      if (!wire) return null
      if (wire === this.presentationWire) return 'presentation'
      if (wire === this.orderWire) return 'order'
      return 'bible'
    }
    return { base: sourceOf(stage.base), overlay: sourceOf(stage.overlay) }
  }

  getWireForSource(source: OrionStackSource | null): ProjectionWirePayload | null {
    if (source === 'order') return this.orderWire
    if (source === 'bible') return this.bibleWire
    if (source === 'presentation') return this.presentationWire
    return null
  }

  getStageState(): ProjectionStageState {
    const underlay = this.orderWire ?? this.bibleWire
    if (this.presentationWire && underlay) {
      return { base: underlay, overlay: this.presentationWire }
    }
    if (this.presentationWire) {
      return { base: this.presentationWire, overlay: null }
    }
    if (this.orderWire && this.bibleWire) {
      return { base: this.orderWire, overlay: this.bibleWire }
    }
    if (this.orderWire) return { base: this.orderWire, overlay: null }
    if (this.bibleWire) return { base: this.bibleWire, overlay: null }
    return { base: null, overlay: null }
  }

  hasActiveLayers(): boolean {
    return this.orderWire !== null || this.bibleWire !== null || this.presentationWire !== null
  }

  setLayer(source: OrionStackSource, wire: ProjectionWirePayload): ProjectionStageState {
    if (source === 'order' && wire.type === 'image') {
      this.orderWire = wire
    } else if (
      source === 'presentation' &&
      (wire.type === 'deck-slide' || wire.type === 'image' || wire.type === 'media')
    ) {
      this.presentationWire = wire
    } else if (
      source === 'bible' &&
      (wire.type === 'bible' || wire.type === 'dictionary' || wire.type === 'hymn')
    ) {
      this.bibleWire = wire
    }
    return this.getStageState()
  }

  clearLayer(source: OrionStackSource): ProjectionStageState {
    if (source === 'order') this.orderWire = null
    else if (source === 'bible') this.bibleWire = null
    else if (source === 'presentation') this.presentationWire = null
    return this.getStageState()
  }

  clearAll(): ProjectionStageState {
    this.orderWire = null
    this.bibleWire = null
    this.presentationWire = null
    return this.getStageState()
  }

  getUiState(outputsOpen: boolean): PresentationUiState {
    const anyLive = this.hasActiveLayers()
    return buildPresentationUiState({
      stack: this.getStackState(),
      orderPending: this.orderWire !== null,
      biblePending: this.bibleWire !== null,
      presentationPending: this.presentationWire !== null,
      outputsOpen: outputsOpen && anyLive,
      stage: this.getStageState()
    })
  }
}

export function createStackWire(
  content: OrionStackLayerContent,
  toMediaUrl: (filePath: string) => string
): ProjectionWirePayload {
  if (content.type === 'image') {
    const animation: OrderImageAnimation =
      content.animation === 'crossfade' ||
      content.animation === 'fade' ||
      content.animation === 'cut' ||
      content.animation === 'wipe' ||
      content.animation === 'push' ||
      content.animation === 'cover' ||
      content.animation === 'uncover' ||
      content.animation === 'split'
        ? content.animation
        : 'cut'
    const durationMs =
      typeof content.durationMs === 'number' && Number.isFinite(content.durationMs)
        ? Math.min(5000, Math.max(0, Math.round(content.durationMs)))
        : 0
    return {
      type: 'image',
      filePath: content.filePath,
      mediaUrl: toMediaUrl(content.filePath),
      animation,
      durationMs
    }
  }

  if (content.type === 'media') {
    return {
      type: 'media',
      filePath: content.filePath,
      mediaUrl: toMediaUrl(content.filePath),
      name: content.name,
      kind: content.kind === 'audio' ? 'audio' : 'video',
      autoplay: content.autoplay === true
    }
  }

  if (content.type === 'deck-slide') {
    return {
      type: 'deck-slide',
      markup: content.markup,
      width: content.width,
      height: content.height,
      transition: content.transition,
      durationMs: content.durationMs,
      autoplayMedia: content.autoplayMedia !== false,
      media: content.media.map((item) => ({
        mediaUrl: toMediaUrl(item.filePath),
        leftPct: item.leftPct,
        topPct: item.topPct,
        widthPct: item.widthPct,
        heightPct: item.heightPct,
        kind: item.kind
      }))
    }
  }

  let backgroundMediaUrl: string | undefined
  if (content.backgroundImagePath) {
    try {
      backgroundMediaUrl = toMediaUrl(content.backgroundImagePath)
    } catch {
      backgroundMediaUrl = undefined
    }
  }
  const bgFields = {
    ...(backgroundMediaUrl ? { backgroundMediaUrl } : {}),
    ...(content.backgroundColor ? { backgroundColor: content.backgroundColor } : {}),
    ...(typeof content.backgroundDimOpacity === 'number'
      ? { backgroundDimOpacity: content.backgroundDimOpacity }
      : {}),
    ...(content.backgroundDimColor ? { backgroundDimColor: content.backgroundDimColor } : {}),
    ...(content.backgroundFit ? { backgroundFit: content.backgroundFit } : {})
  }

  if (content.type === 'dictionary') {
    return {
      type: 'dictionary',
      strongs: content.strongs,
      lemma: content.lemma,
      transliteration: content.transliteration,
      gloss: content.gloss,
      partOfSpeech: content.partOfSpeech,
      definition: content.definition,
      language: content.language,
      infoBar: content.infoBar,
      infoBarActive: content.infoBarActive,
      ...(content.blockLayout ? { blockLayout: content.blockLayout } : {}),
      ...bgFields
    }
  }

  if (content.type === 'hymn') {
    return {
      type: 'hymn',
      number: content.number,
      title: content.title,
      slideKind: content.slideKind,
      stanzaKind: content.stanzaKind,
      verse: content.verse,
      ...(content.versePart != null && content.versePart > 0 ? { versePart: content.versePart } : {}),
      ...(content.versePartCount != null && content.versePartCount > 1
        ? { versePartCount: content.versePartCount }
        : {}),
      lines: content.lines,
      ...(content.author?.trim() ? { author: content.author.trim() } : {}),
      ...(content.blockLayout ? { blockLayout: content.blockLayout } : {}),
      ...(content.animation ? { animation: content.animation } : {}),
      ...(typeof content.durationMs === 'number' ? { durationMs: content.durationMs } : {}),
      ...bgFields
    }
  }

  return {
    type: 'bible',
    reference: content.reference,
    locationLabel: content.locationLabel,
    translationLabel: content.translationLabel,
    verses: content.verses,
    highlightVerse: content.highlightVerse,
    ...(content.animation === 'fade' || content.animation === 'push' || content.animation === 'cut'
      ? { animation: content.animation }
      : {}),
    ...(typeof content.durationMs === 'number' ? { durationMs: content.durationMs } : {}),
    ...(content.type === 'bible' && content.blockLayout ? { blockLayout: content.blockLayout } : {}),
    ...bgFields
  }
}
