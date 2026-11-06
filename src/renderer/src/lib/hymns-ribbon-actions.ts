export type HymnsRibbonActions = {
  prevSlide: () => void
  nextSlide: () => void
  projectStanza: () => void
  goLive: () => void
  addToSequence: () => void
}

let actions: Partial<HymnsRibbonActions> = {}

export function setHymnsRibbonActions(next: Partial<HymnsRibbonActions>): void {
  actions = next
}

export function clearHymnsRibbonActions(): void {
  actions = {}
}

export function getHymnsRibbonActions(): Partial<HymnsRibbonActions> {
  return actions
}
