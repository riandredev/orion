import type { HymnalStanzaTagStyle } from '../../../shared/hymnal-types'
import { touchProfileSettings } from './profile-autosave'

const HYMNAL_KEY = 'orion-selected-hymnal'
const TAG_STYLE_KEY = 'orion-hymnal-stanza-tags'

export function loadSelectedHymnalId(): string {
  try {
    return localStorage.getItem(HYMNAL_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveSelectedHymnalId(id: string): void {
  try {
    localStorage.setItem(HYMNAL_KEY, id)
  } catch {
    /* ignore */
  }
  touchProfileSettings()
}

export function loadHymnalStanzaTagStyle(): HymnalStanzaTagStyle {
  try {
    const v = localStorage.getItem(TAG_STYLE_KEY)
    return v === 'long' ? 'long' : 'short'
  } catch {
    return 'short'
  }
}

export function saveHymnalStanzaTagStyle(style: HymnalStanzaTagStyle): void {
  try {
    localStorage.setItem(TAG_STYLE_KEY, style)
  } catch {
    /* ignore */
  }
  touchProfileSettings()
}
