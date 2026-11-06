import type { PresentationDeckDetail, PresentationDeckSummary } from '../../../shared/presentation-deck-types'

export async function fetchPresentationDecks(): Promise<PresentationDeckSummary[]> {
  return window.orion.listPresentationDecks()
}

export async function fetchPresentationDeck(
  deckId: string
): Promise<PresentationDeckDetail | null> {
  return window.orion.getPresentationDeck(deckId)
}

export async function importPresentationDeck(): Promise<
  import('../../../shared/presentation-deck-types').PresentationImportResult
> {
  return window.orion.importPresentationDeck()
}

export async function removePresentationDeck(deckId: string): Promise<boolean> {
  return window.orion.removePresentationDeck(deckId)
}

export function subscribePresentationImportProgress(
  callback: (progress: import('../../../shared/presentation-deck-types').PresentationImportProgress) => void
): () => void {
  return window.orion.onPresentationImportProgress(callback)
}
