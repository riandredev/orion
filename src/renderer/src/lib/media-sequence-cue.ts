export type MediaSequenceCue = {
  folder: string
  path: string
}

let cue: MediaSequenceCue | null = null
const listeners = new Set<(next: MediaSequenceCue) => void>()

export function requestMediaSequenceCue(next: MediaSequenceCue): void {
  cue = next
  for (const listener of listeners) listener(next)
}

export function subscribeMediaSequenceCue(listener: (next: MediaSequenceCue) => void): () => void {
  listeners.add(listener)
  if (cue) listener(cue)
  return () => {
    listeners.delete(listener)
  }
}
