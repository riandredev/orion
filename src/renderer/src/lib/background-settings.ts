import { useSyncExternalStore } from 'react'
import { flushProfileSettings } from './profile-autosave'

export type BackgroundCategoryId = 'defaults' | 'bible' | 'hymns' | 'dictionary'

export type BackgroundMode = 'inherit' | 'solid' | 'image'

export type BackgroundFit = 'cover' | 'contain'

export type CategoryBackgroundConfig = {
  mode: BackgroundMode
  solidColor: string
  imagePath: string | null
  dimOpacity: number
  dimColor: string
  fit: BackgroundFit
}

export type AllBackgroundSettings = Record<BackgroundCategoryId, CategoryBackgroundConfig>

export type ResolvedBackgroundStyle = {
  solidColor: string
  imagePath: string | null
  dimOpacity: number
  dimColor: string
  fit: BackgroundFit
}

export const DEFAULT_HYMN_BACKGROUND_IMAGE = 'hymn-image.jpg'
export const DEFAULT_BIBLE_BACKGROUND_IMAGE = 'bible-image.png'

let cachedImagesRoot: string | null = null

/** Call once from the renderer after `orion:get-paths` so relative image names resolve. */
function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function setBackgroundImagesRoot(rootPath: string): void {
  cachedImagesRoot = normalizePath(rootPath)
  if (!cachedSettings) cachedSettings = loadBackgroundSettings()
  const stored = storeBackgroundPaths(cachedSettings)
  const changed = JSON.stringify(stored) !== JSON.stringify(cachedSettings)
  cachedSettings = stored
  if (changed) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    } catch {
      /* ignore */
    }
    flushProfileSettings()
  }
  listeners.forEach((l) => l())
}

export function storeImagePath(imagePath: string | null): string | null {
  if (!imagePath?.trim()) return null
  const trimmed = normalizePath(imagePath.trim())
  if (cachedImagesRoot) {
    const root = cachedImagesRoot.toLowerCase()
    const path = trimmed.toLowerCase()
    if (path === root) return null
    if (path.startsWith(`${root}/`)) return trimmed.slice(cachedImagesRoot.length + 1)
  }
  // A full path from another install (user data, an old folder) is not usable by
  // the projector. Keep the file name so it resolves inside the current library.
  if (/^[a-zA-Z]:\//.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed.split('/').pop() || null
  }
  return trimmed
}

function storeBackgroundPaths(settings: AllBackgroundSettings): AllBackgroundSettings {
  const next = { ...settings }
  for (const id of Object.keys(next) as BackgroundCategoryId[]) {
    next[id] = { ...next[id], imagePath: storeImagePath(next[id].imagePath) }
  }
  return next
}

export function backgroundImagesMatch(stored: string | null, candidate: string): boolean {
  if (!stored?.trim()) return false
  const norm = (value: string): string => normalizePath(value).toLowerCase()
  const resolved = resolveStoredBackgroundImagePath(stored)
  if (resolved && norm(resolved) === norm(candidate)) return true
  const storedKey = norm(stored)
  const candidateKey = norm(candidate)
  if (storedKey === candidateKey) return true
  if (cachedImagesRoot && candidateKey.startsWith(`${cachedImagesRoot.toLowerCase()}/`)) {
    const relative = candidateKey.slice(cachedImagesRoot.length + 1)
    if (storedKey === relative || storedKey.endsWith(`/${relative}`)) return true
  }
  const storedName = storedKey.split('/').pop()
  const candidateName = candidateKey.split('/').pop()
  return Boolean(storedName && storedName === candidateName && !storedKey.includes('/'))
}

export function resolveStoredBackgroundImagePath(imagePath: string | null): string | null {
  if (!imagePath?.trim()) return null
  const trimmed = normalizePath(imagePath.trim())
  const absolute = /^[a-zA-Z]:\//.test(trimmed) || trimmed.startsWith('/')
  if (absolute) {
    if (!cachedImagesRoot) return trimmed
    const root = cachedImagesRoot.toLowerCase()
    const path = trimmed.toLowerCase()
    if (path === root || path.startsWith(`${root}/`)) return trimmed
    const name = trimmed.split('/').pop()
    return name ? `${cachedImagesRoot}/${name}` : trimmed
  }
  if (cachedImagesRoot) {
    return `${cachedImagesRoot}/${trimmed.replace(/^\/+/, '')}`
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
    dimColor: '#000000',
    fit: 'cover'
  },
  bible: {
    mode: 'image',
    solidColor: '#000000',
    imagePath: DEFAULT_BIBLE_BACKGROUND_IMAGE,
    dimOpacity: 28,
    dimColor: '#000000',
    fit: 'cover'
  },
  hymns: {
    mode: 'image',
    solidColor: '#000000',
    imagePath: DEFAULT_HYMN_BACKGROUND_IMAGE,
    dimOpacity: 55,
    dimColor: '#000000',
    fit: 'cover'
  },
  dictionary: {
    mode: 'inherit',
    solidColor: '#000000',
    imagePath: null,
    dimOpacity: 65,
    dimColor: '#000000',
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
  const dimColor =
    typeof raw?.dimColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.dimColor)
      ? raw.dimColor.toLowerCase()
      : fallback.dimColor
  const fit: BackgroundFit =
    raw?.fit === 'contain' || raw?.fit === 'cover' ? raw.fit : fallback.fit

  return { mode, solidColor, imagePath, dimOpacity, dimColor, fit }
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
  const stored = storeBackgroundPaths(next)
  cachedSettings = stored
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    /* ignore */
  }
  flushProfileSettings()
  listeners.forEach((l) => l())
  return stored
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
      dimColor: cfg.dimColor,
      fit: cfg.fit
    }
  }

  return {
    solidColor: cfg.solidColor,
    imagePath: null,
    dimOpacity: 0,
    dimColor: cfg.dimColor,
    fit: cfg.fit
  }
}
