export type PresentationDeckSummary = {
  id: string
  title: string
  slideCount: number
  importedAt: string
  sourceExt: string
  /** First slide PNG for deck list thumbnail. */
  coverPath?: string
}

export type PresentationSlideInfo = {
  index: number
  name: string
  path: string
}

export type PresentationDeckDetail = PresentationDeckSummary & {
  slides: PresentationSlideInfo[]
  /** Original .pptx or .key copied into the deck folder. */
  sourcePath?: string
  /** Live package playback, or the older rendered PNG deck. */
  engine: 'live' | 'raster'
  cues?: import('./pptx-cues').PptxSlideCue[]
}

export type PresentationImportProgress = {
  phase: 'waiting' | 'converting' | 'rendering'
  /** 0–100 when known (slide rendering). */
  percent?: number
  message?: string
  slideIndex?: number
  slideCount?: number
}

export type PresentationImportResult =
  | { ok: true; deck: PresentationDeckDetail }
  | { ok: false; message: string }
