import type { PresentationDeckDetail } from './presentation-deck-types'

export type PresenterViewState = {
  open: boolean
  showAllSlides: boolean
  deckId: string | null
  deckTitle: string
  sourceExt: string
  engine: 'live' | 'raster'
  slideIndex: number
  buildStep: number
  slideCount: number
  slides: PresentationDeckDetail['slides']
}

export const emptyPresenterViewState = (): PresenterViewState => ({
  open: false,
  showAllSlides: false,
  deckId: null,
  deckTitle: '',
  sourceExt: '',
  engine: 'raster',
  slideIndex: 0,
  buildStep: 0,
  slideCount: 0,
  slides: []
})
