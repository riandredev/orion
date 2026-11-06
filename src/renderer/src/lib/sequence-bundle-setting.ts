import { touchProfileSettings } from './profile-autosave'

const KEY = 'orion-sequence-bundle-content'

export function loadSequenceBundleContent(): boolean {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null) return true
    return raw === '1'
  } catch {
    return true
  }
}

export function saveSequenceBundleContent(enabled: boolean): void {
  try {
    localStorage.setItem(KEY, enabled ? '1' : '0')
  } catch {
    /* storage unavailable */
  }
  touchProfileSettings()
}
