export type WebMediaCommand = {
  time: number
  paused: boolean
  rate: number
  fullscreen: boolean
  captions: boolean
  epoch: number
}

const listeners = new Set<(command: WebMediaCommand) => void>()

export function subscribeWebMedia(listener: (command: WebMediaCommand) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Operator webview clock. Output windows and the output preview follow it. */
export function publishWebMedia(
  time: number,
  paused: boolean,
  rate: number,
  fullscreen: boolean,
  captions: boolean,
  epoch: number
): void {
  const command: WebMediaCommand = {
    time: Number.isFinite(time) && time > 0 ? time : 0,
    paused,
    rate: Number.isFinite(rate) && rate > 0 ? rate : 1,
    fullscreen,
    captions,
    epoch
  }
  for (const listener of listeners) listener(command)
  window.orion.syncWebMedia(command)
}
