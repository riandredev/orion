export type DeckMediaClock = {
  action: 'play' | 'pause' | 'seek'
  index: number
  time: number
  epoch: number
}

let clock: DeckMediaClock | null = null

export function rememberDeckMediaClock(next: DeckMediaClock): void {
  clock = next
}

export function currentDeckMediaClock(): DeckMediaClock | null {
  return clock
}
