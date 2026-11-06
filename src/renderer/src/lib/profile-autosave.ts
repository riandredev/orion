let persist: (() => void) | null = null
let timer = 0

export function registerProfileAutosave(fn: () => void): void {
  persist = fn
}

/** Writes the active profile shortly after a settings change. */
export function touchProfileSettings(): void {
  if (typeof window === 'undefined') return
  if (timer) window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    timer = 0
    persist?.()
  }, 200)
}
