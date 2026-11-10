import { touchProfileSettings } from './profile-autosave'

const KEY = 'orion-library-settings-v1'

export type LibrarySettings = {
  /** Download library updates when Orion opens. */
  autoUpdate: boolean
}

const DEFAULTS: LibrarySettings = {
  autoUpdate: true
}

export function loadLibrarySettings(): LibrarySettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<LibrarySettings>
    return {
      autoUpdate: parsed.autoUpdate !== false
    }
  } catch {
    return DEFAULTS
  }
}

export function saveLibrarySettings(next: LibrarySettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable */
  }
  touchProfileSettings()
  window.dispatchEvent(new Event('orion-library-settings'))
}
