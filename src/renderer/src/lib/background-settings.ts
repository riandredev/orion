import { useSyncExternalStore } from 'react'
import { touchProfileSettings } from './profile-autosave'

export type BackgroundCategoryId = 'defaults' | 'bible' | 'hymns' | 'dictionary'

export type BackgroundMode = 'inherit' | 'solid' | 'image'

export type BackgroundFit = 'cover' | 'contain'

export type CategoryBackgroundConfig = {
  mode: BackgroundMode
  solidColor: string
  imagePath: string | null
  dimOpacity: number
  fit: BackgroundFit
}

export type AllBackgroundSettings = Record<BackgroundCategoryId, CategoryBackgroundConfig>

export type ResolvedBackgroundStyle = {
  solidColor: string
  imagePath: string | null
  dimOpacity: number
  fit: BackgroundFit
}

export const DEFAULT_HYMN_BACKGROUND_IMAGE = 'hymn-image.jpg'
export const DEFAULT_BIBLE_BACKGROUND_IMAGE = 'bible-image.png'

let cachedImagesRoot: string | null = null

/** Call once from the renderer after `orion:get-paths` so relative image names resolve. */
export function setBackgroundImagesRoot(rootPath: string): void {
  cachedImagesRoot = rootPath.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function resolveStoredBackgroundImagePath(imagePath: string | null): string | null {
  if (!imagePath?.trim()) return null
  const trimmed = imagePath.trim()
  if (/^[a-zA-Z]:[/\\]/.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed
  }
  if (cachedImagesRoot) {
    return `${cachedImagesRoot}/${trimmed.replace(/^[/\\]+/, '')}`
  }
  return trimmed
}

function migrateBibleImagePath(imagePath: string | null | undefined): string | null | undefined {
  if (!imagePath) return imagePath
  if (!/bible-image\.jpg$/i.test(imagePath)) return imagePath
  return imagePath.replace(/bible-image\.jpg$/i, 'bible-image.png')
}

function migrateStoredBibleCategory(
  raw: Partial<CategoryBackgroundConfig> | undefined
): Partial<CategoryBackgroundConfig> | undefined {
  if (!raw) return raw
  const wasBundledJpg =
    typeof raw.imagePath === 'string' && /bible-image\.jpg$/i.test(raw.imagePath)
  const imagePath = migrateBibleImagePath(raw.imagePath)
  const dimOpacity = wasBundledJpg && raw.dimOpacity === 60 ? 28 : raw.dimOpacity
  if (raw.mode === 'inherit') {
    return {
      ...raw,
      mode: 'image',
      imagePath: imagePath ?? DEFAULT_BIBLE_BACKGROUND_IMAGE,
      dimOpacity
    }
  }
  return { ...raw, imagePath: imagePath ?? raw.imagePath, dimOpacity }
}

function migrateStoredHymnsCategory(
  raw: Partial<CategoryBackgroundConfig> | undefined
): Partial<CategoryBackgroundConfig> | undefined {
  if (!raw || raw.mode !== 'inherit') return raw
  return {
    ...raw,
    mode: 'image',
    imagePath: raw.imagePath ?? DEFAULT_HYMN_BACKGROUND_IMAGE
  }
}

const STORAGE_KEY = 'orion-background-settings-v1'

export const defaultBackgroundSettings: AllBackgroundSettings = {
  defaults: {
    mode: 'solid',
    solidColor: '#000000',
    imagePath: null,
    dimOpacity: 55,
    fit: 'cover'
  },
  bible: {
    mode: 'image',
    solidColor: '#000000',
    imagePath: DEFAULT_BIBLE_BACKGROUND_IMAGE,
    dimOpacity: 28,
    fit: 'cover'
  },
  hymns: {
    mode: 'image',
    solidColor: '#000000',
    imagePath: DEFAULT_HYMN_BACKGROUND_IMAGE,
    dimOpacity: 55,
    fit: 'cover'
  },
  dictionary: {
    mode: 'inherit',
    solidColor: '#000000',
    imagePath: null,
    dimOpacity: 65,
    fit: 'cover'
  }
}

function sanitizeCategory(
  raw: Partial<CategoryBackgroundConfig> | undefined,
  fallback: CategoryBackgroundConfig,
  allowInherit: boolean
): CategoryBackgroundConfig {
  const mode: BackgroundMode =
    raw?.mode === 'solid' || raw?.mode === 'image' || (allowInherit && raw?.mode === 'inherit')
      ? raw.mode
      : fallback.mode
  const solidColor =
    typeof raw?.solidColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.solidColor)
      ? raw.solidColor
      : fallback.solidColor
  const imagePath =
    typeof raw?.imagePath === 'string' && raw.imagePath.trim().length > 0
      ? raw.imagePath
      : null
  const dimOpacity =
    typeof raw?.dimOpacity === 'number' && Number.isFinite(raw.dimOpacity)
      ? Math.min(95, Math.max(0, Math.round(raw.dimOpacity)))
      : fallback.dimOpacity
  const fit: BackgroundFit =
    raw?.fit === 'contain' || raw?.fit === 'cover' ? raw.fit : fallback.fit

  return { mode, solidColor, imagePath, dimOpacity, fit }
}

export function loadBackgroundSettings(): AllBackgroundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultBackgroundSettings
    const parsed = JSON.parse(raw) as Partial<AllBackgroundSettings>
    return {
      defaults: sanitizeCategory(parsed.defaults, defaultBackgroundSettings.defaults, false),
      bible: sanitizeCategory(
        migrateStoredBibleCategory(parsed.bible),
        defaultBackgroundSettings.bible,
        true
      ),
      hymns: sanitizeCategory(
        migrateStoredHymnsCategory(parsed.hymns),
        defaultBackgroundSettings.hymns,
        true
      ),
      dictionary: sanitizeCategory(parsed.dictionary, defaultBackgroundSettings.dictionary, true)
    }
  } catch {
    return defaultBackgroundSettings
  }
}

let cachedSettings: AllBackgroundSettings | null = null
const listeners = new Set<() => void>()

export function getBackgroundSettings(): AllBackgroundSettings {
  if (!cachedSettings) {
    cachedSettings = loadBackgroundSettings()
  }
  return cachedSettings
}

export function reloadBackgroundSettingsFromStorage(): void {
  cachedSettings = loadBackgroundSettings()
  listeners.forEach((l) => l())
}

export function saveBackgroundSettings(next: AllBackgroundSettings): AllBackgroundSettings {
  cachedSettings = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  touchProfileSettings()
  listeners.forEach((l) => l())
  return next
}

export function updateCategoryBackground(
  category: BackgroundCategoryId,
  patch: Partial<CategoryBackgroundConfig>
): AllBackgroundSettings {
  const current = getBackgroundSettings()
  const nextCategory = sanitizeCategory(
    { ...current[category], ...patch },
    defaultBackgroundSettings[category],
    category !== 'defaults'
  )
  return saveBackgroundSettings({
    ...current,
    [category]: nextCategory
  })
}

export function useBackgroundSettings(): AllBackgroundSettings {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    },
    () => getBackgroundSettings(),
    () => defaultBackgroundSettings
  )
}

export function resolveCategoryBackground(
  category: Exclude<BackgroundCategoryId, 'defaults'> | 'defaults',
  settings: AllBackgroundSettings = getBackgroundSettings()
): ResolvedBackgroundStyle {
  const cfg =
    category !== 'defaults' && settings[category].mode === 'inherit'
      ? settings.defaults
      : settings[category]

  if (cfg.mode === 'image' && cfg.imagePath) {
    return {
      solidColor: cfg.solidColor,
      imagePath: resolveStoredBackgroundImagePath(cfg.imagePath),
      dimOpacity: cfg.dimOpacity,
      fit: cfg.fit
    }
  }

  return {
    solidColor: cfg.solidColor,
    imagePath: null,
    dimOpacity: 0,
    fit: cfg.fit
  }
}
