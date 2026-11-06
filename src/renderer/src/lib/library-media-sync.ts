export type LibraryMediaCommand = {
  action: 'play' | 'pause' | 'seek'
  time: number
  epoch: number
}

const listeners = new Set<(command: LibraryMediaCommand) => void>()

export function subscribeLibraryMedia(listener: (command: LibraryMediaCommand) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Preview clock for a projected library file. Outputs and output cards follow it. */
export function publishLibraryMedia(action: LibraryMediaCommand['action'], time: number, epoch: number): void {
  const command: LibraryMediaCommand = {
    action,
    time: Number.isFinite(time) && time > 0 ? time : 0,
    epoch
  }
  for (const listener of listeners) listener(command)
  window.orion?.syncLibraryMedia?.(command)
}
