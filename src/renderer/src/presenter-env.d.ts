import type { PresenterViewState } from '../../shared/presenter-view-state'

export type OrionPresenterApi = {
  getState: () => Promise<PresenterViewState>
  setSlideIndex: (slideIndex: number) => Promise<void>
  setShowAllSlides: (show: boolean) => Promise<void>
  stepSlide: (delta: number) => Promise<void>
  close: () => Promise<void>
  readDeckSource: (
    deckId: string
  ) => Promise<{ bytes: Uint8Array; mediaDir: string; mediaFiles: string[] } | null>
  rasterizeMetafiles: (payloads: string[]) => Promise<(string | null)[]>
  currentDeckMedia: () => Promise<{
    action: 'play' | 'pause' | 'seek'
    index: number
    time: number
    epoch: number
  } | null>
  syncDeckMedia: (command: {
    action: 'play' | 'pause' | 'seek'
    index: number
    time: number
    epoch: number
  }) => void
  onDeckMedia: (
    handler: (command: {
      action: 'play' | 'pause' | 'seek'
      index: number
      time: number
      epoch: number
    }) => void
  ) => () => void
  onState: (handler: (state: PresenterViewState) => void) => () => void
}

declare global {
  interface Window {
    orionPresenter: OrionPresenterApi
  }
}

export {}
