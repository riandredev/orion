import type { InstalledBibleInfo } from '../../../shared/bible-types'
import { touchProfileSettings } from '../lib/profile-autosave'

export type BibleTranslationId = string

const STORAGE_KEY = 'orion-bible-translation'

export function loadBibleTranslation(fallbackId?: string): BibleTranslationId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && raw.trim()) return raw.trim()
  } catch {
    /* ignore */
  }
  return fallbackId ?? ''
}

export function saveBibleTranslation(id: BibleTranslationId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
  touchProfileSettings()
}

export function bibleTranslationSelectOptions(bibles: InstalledBibleInfo[]): {
  value: string
  label: string
}[] {
  return bibles.map((b) => ({ value: b.id, label: b.abbr }))
}

export function findInstalledBible(
  bibles: InstalledBibleInfo[],
  id: string
): InstalledBibleInfo | undefined {
  return bibles.find((b) => b.id === id)
}
