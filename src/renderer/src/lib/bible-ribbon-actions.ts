export type BibleRibbonActions = {
  prevVerse: () => void
  nextVerse: () => void
  prevBook: () => void
  nextBook: () => void
}

let actions: Partial<BibleRibbonActions> = {}

export function setBibleRibbonActions(next: Partial<BibleRibbonActions>): void {
  actions = next
}

export function clearBibleRibbonActions(): void {
  actions = {}
}

export function getBibleRibbonActions(): Partial<BibleRibbonActions> {
  return actions
}
