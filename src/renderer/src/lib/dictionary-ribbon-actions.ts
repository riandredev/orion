export type DictionaryRibbonActions = {
  prevEntry: () => void
  nextEntry: () => void
}

let actions: Partial<DictionaryRibbonActions> = {}
let output = {
  project: () => {},
  toggle: () => {}
}

export function setDictionaryRibbonActions(next: Partial<DictionaryRibbonActions>): void {
  actions = next
}

export function setDictionaryOutputActions(next: { project: () => void; toggle: () => void }): void {
  output = next
}

export function projectDictionaryEntry(): void {
  output.project()
}

export function toggleDictionaryOutputShortcut(): void {
  output.toggle()
}

export function clearDictionaryRibbonActions(): void {
  actions = {}
}

export function getDictionaryRibbonActions(): Partial<DictionaryRibbonActions> {
  return actions
}
