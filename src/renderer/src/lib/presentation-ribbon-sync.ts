import { useSyncExternalStore } from 'react'

export type PresentationRibbonState = {
  deckTitle: string
  slideIndex: number
  slideTotal: number
}

let ribbonState: PresentationRibbonState = {
  deckTitle: 'No deck open',
  slideIndex: 0,
  slideTotal: 0
}

const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function setPresentationRibbonState(patch: Partial<PresentationRibbonState>): void {
  ribbonState = { ...ribbonState, ...patch }
  emit()
}

export function getPresentationRibbonState(): PresentationRibbonState {
  return ribbonState
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePresentationRibbonState(): PresentationRibbonState {
  return useSyncExternalStore(subscribe, getPresentationRibbonState, getPresentationRibbonState)
}
