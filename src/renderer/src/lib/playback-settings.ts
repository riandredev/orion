import { touchProfileSettings } from './profile-autosave'

const KEY = 'orion-playback-v1'

export type PlaybackSettings = {
  /** Start a media-library file when it is presented. */
  autoplayLibraryMedia: boolean
  /** Start a slide video when Next presents that slide. */
  autoplayPresentationMedia: boolean
}

const DEFAULTS: PlaybackSettings = {
  autoplayLibraryMedia: false,
  autoplayPresentationMedia: true
}

export function loadPlaybackSettings(): PlaybackSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<PlaybackSettings>
    return {
      autoplayLibraryMedia: parsed.autoplayLibraryMedia === true,
      autoplayPresentationMedia: parsed.autoplayPresentationMedia !== false
    }
  } catch {
    return DEFAULTS
  }
}

export function savePlaybackSettings(next: PlaybackSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable */
  }
  touchProfileSettings()
  window.dispatchEvent(new Event('orion-playback-settings'))
}
