import { useSyncExternalStore } from 'react'
import {
  clampProjectionTypography,
  DEFAULT_BIBLE_PANELS,
  DEFAULT_BIBLE_TYPOGRAPHY,
  DEFAULT_DICTIONARY_PANELS,
  DEFAULT_DICTIONARY_TYPOGRAPHY,
  DEFAULT_HYMN_PANELS,
  DEFAULT_HYMN_TYPOGRAPHY,
  DEFAULT_LINE_HEIGHT,
  DEFAULT_PROJECTION_TYPOGRAPHY,
  DEFAULT_TEXT_SHADOW,
  type BiblePanelId,
  type BibleTextPanel,
  type BibleTypography,
  type DictionaryPanelId,
  type HymnPanelId,
  type BibleTypographyElementId,
  type DictionaryTypography,
  type DictionaryTypographyElementId,
  type HymnTextStyle,
  type HymnTypography,
  type HymnTypographyElementId,
  type ProjectionLineHeight,
  type ProjectionTextShadow,
  type TextShadowStyle,
  type ProjectionTextStyle,
  type ProjectionTypography
} from '../../../shared/projection-typography'
import { touchProfileSettings } from './profile-autosave'

const STORAGE_KEY = 'orion-projection-typography-v1'
const HYMN_KEY = 'orion-hymn-typography-v2'

let cached: ProjectionTypography | null = null
const listeners = new Set<() => void>()

export function loadProjectionTypography(): ProjectionTypography {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return clampProjectionTypography(JSON.parse(raw))
    const hymns = localStorage.getItem(HYMN_KEY)
    if (hymns) return clampProjectionTypography({ hymns: JSON.parse(hymns) })
  } catch {
    /* ignore */
  }
  return DEFAULT_PROJECTION_TYPOGRAPHY
}

export function getProjectionTypography(): ProjectionTypography {
  if (!cached) cached = loadProjectionTypography()
  return cached
}

function saveProjectionTypography(next: ProjectionTypography): ProjectionTypography {
  const clamped = clampProjectionTypography(next)
  cached = clamped
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped))
  } catch {
    /* ignore */
  }
  touchProfileSettings()
  listeners.forEach((listener) => listener())
  void pushProjectionTypographyToMain(clamped)
  return clamped
}

export function updateHymnTypographyElement(
  id: HymnTypographyElementId,
  patch: Partial<HymnTextStyle>
): ProjectionTypography {
  const current = getProjectionTypography()
  return saveProjectionTypography({
    ...current,
    hymns: { ...current.hymns, [id]: { ...current.hymns[id], ...patch } }
  })
}

export function resetHymnTypographyElement(id: HymnTypographyElementId): ProjectionTypography {
  const current = getProjectionTypography()
  return saveProjectionTypography({
    ...current,
    hymns: { ...current.hymns, [id]: { ...DEFAULT_HYMN_TYPOGRAPHY[id] } }
  })
}

export function updateBibleTypographyElement(
  id: BibleTypographyElementId,
  patch: Partial<ProjectionTextStyle>
): ProjectionTypography {
  const current = getProjectionTypography()
  return saveProjectionTypography({
    ...current,
    bible: { ...current.bible, [id]: { ...current.bible[id], ...patch } }
  })
}

export function resetBibleTypographyElement(id: BibleTypographyElementId): ProjectionTypography {
  const current = getProjectionTypography()
  return saveProjectionTypography({
    ...current,
    bible: { ...current.bible, [id]: { ...DEFAULT_BIBLE_TYPOGRAPHY[id] } }
  })
}

export function updateBiblePanel(id: BiblePanelId, patch: Partial<BibleTextPanel>): ProjectionTypography {
  const current = getProjectionTypography()
  return saveProjectionTypography({
    ...current,
    biblePanels: {
      ...current.biblePanels,
      [id]: { ...current.biblePanels[id], ...patch }
    }
  })
}

export function resetBiblePanel(id: BiblePanelId): ProjectionTypography {
  return updateBiblePanel(id, { ...DEFAULT_BIBLE_PANELS[id] })
}

export function updateHymnPanel(id: HymnPanelId, patch: Partial<BibleTextPanel>): ProjectionTypography {
  const current = getProjectionTypography()
  return saveProjectionTypography({
    ...current,
    hymnPanels: { ...current.hymnPanels, [id]: { ...current.hymnPanels[id], ...patch } }
  })
}

export function resetHymnPanel(id: HymnPanelId): ProjectionTypography {
  return updateHymnPanel(id, { ...DEFAULT_HYMN_PANELS[id] })
}

export function updateDictionaryPanel(id: DictionaryPanelId, patch: Partial<BibleTextPanel>): ProjectionTypography {
  const current = getProjectionTypography()
  return saveProjectionTypography({
    ...current,
    dictionaryPanels: {
      ...current.dictionaryPanels,
      [id]: { ...current.dictionaryPanels[id], ...patch }
    }
  })
}

export function resetDictionaryPanel(id: DictionaryPanelId): ProjectionTypography {
  return updateDictionaryPanel(id, { ...DEFAULT_DICTIONARY_PANELS[id] })
}

export function updateDictionaryTypographyElement(
  id: DictionaryTypographyElementId,
  patch: Partial<ProjectionTextStyle>
): ProjectionTypography {
  const current = getProjectionTypography()
  return saveProjectionTypography({
    ...current,
    dictionary: { ...current.dictionary, [id]: { ...current.dictionary[id], ...patch } }
  })
}

export function resetDictionaryTypographyElement(id: DictionaryTypographyElementId): ProjectionTypography {
  const current = getProjectionTypography()
  return saveProjectionTypography({
    ...current,
    dictionary: { ...current.dictionary, [id]: { ...DEFAULT_DICTIONARY_TYPOGRAPHY[id] } }
  })
}

export function updateProjectionLineHeight(
  category: keyof ProjectionLineHeight,
  lineHeight: number
): ProjectionTypography {
  const current = getProjectionTypography()
  return saveProjectionTypography({
    ...current,
    lineHeight: { ...current.lineHeight, [category]: lineHeight }
  })
}

export function resetProjectionLineHeight(category: keyof ProjectionLineHeight): ProjectionTypography {
  return updateProjectionLineHeight(category, DEFAULT_LINE_HEIGHT[category])
}

export function updateProjectionTextShadow(
  category: keyof ProjectionTextShadow,
  patch: Partial<TextShadowStyle>
): ProjectionTypography {
  const current = getProjectionTypography()
  return saveProjectionTypography({
    ...current,
    textShadow: {
      ...current.textShadow,
      [category]: { ...current.textShadow[category], ...patch }
    }
  })
}

export function resetProjectionTextShadow(category: keyof ProjectionTextShadow): ProjectionTypography {
  return updateProjectionTextShadow(category, DEFAULT_TEXT_SHADOW[category])
}

export function reloadHymnTypographyFromStorage(): void {
  cached = loadProjectionTypography()
  listeners.forEach((listener) => listener())
  void pushProjectionTypographyToMain(cached)
}

export function useProjectionTypography(): ProjectionTypography {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    },
    () => getProjectionTypography(),
    () => DEFAULT_PROJECTION_TYPOGRAPHY
  )
}

export function useHymnTypography(): HymnTypography {
  return useProjectionTypography().hymns
}

export function useBibleTypography(): BibleTypography {
  return useProjectionTypography().bible
}

export function useDictionaryTypography(): DictionaryTypography {
  return useProjectionTypography().dictionary
}

export async function pushProjectionTypographyToMain(
  value: ProjectionTypography = getProjectionTypography()
): Promise<void> {
  if (typeof window.orion?.setHymnTypography !== 'function') return
  await window.orion.setHymnTypography(value)
}

export async function pushHymnTypographyToMain(): Promise<void> {
  await pushProjectionTypographyToMain()
}
