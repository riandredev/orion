export async function openPresenterView(deckId: string, slideIndex: number, buildStep = 0): Promise<void> {
  await window.orion.openPresenterView(deckId, slideIndex, buildStep)
}

export async function closePresenterView(): Promise<void> {
  await window.orion.closePresenterView()
}

export async function isPresenterViewOpen(): Promise<boolean> {
  return window.orion.isPresenterViewOpen()
}

export function subscribePresenterSlideFromWindow(
  callback: (payload: { deckId: string | null; slideIndex: number }) => void
): () => void {
  return window.orion.onPresenterSlideFromWindow(callback)
}

export function subscribePresentationStepFromPresenter(callback: (delta: number) => void): () => void {
  return window.orion.onPresentationStepFromPresenter(callback)
}

export function syncPresenterSlideFromMain(
  deckId: string | null,
  slideIndex: number,
  buildStep = 0
): void {
  void window.orion.syncPresenterSlideFromMain(deckId, slideIndex, buildStep)
}
