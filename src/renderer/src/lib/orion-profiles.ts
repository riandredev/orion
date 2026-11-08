import { useSyncExternalStore } from 'react'
import {
  buildOrionProfileFile,
  createEmptyProfileMeta,
  DEFAULT_ORION_PROFILE_PREFERENCES,
  parseOrionProfileFile,
  type OrionProfileMeta,
  type OrionProfilePreferences,
  type OrionProfileRegistry
} from '../../../shared/orion-profile'
import { ORION_PROFILE_SETTINGS_KEYS } from '../../../shared/profile-settings-keys'
import { reloadBackgroundSettingsFromStorage } from './background-settings'
import { reloadBibleBlockLayoutFromStorage } from './bible-block-layout-settings'
import { reloadBibleBookBackgroundsFromStorage } from './bible-book-backgrounds'
import {
  reloadDictionaryBlockLayoutFromStorage,
  reloadHymnBlockLayoutFromStorage
} from './category-block-layout'
import { reloadRecentColorsFromStorage } from './recent-colors'
import { reloadBibleMotionFromStorage } from './bible-motion'
import { reloadHymnMotionFromStorage } from './hymn-motion'
import {
  getProjectionContentInsetsByCategory,
  pushProjectionContentInsetsToMain,
  reloadProjectionContentInsetsFromStorage
} from './projection-content-insets-settings'
import { pushHymnTypographyToMain, reloadHymnTypographyFromStorage } from './projection-typography-settings'
import { registerProfileAutosave } from './profile-autosave'

const REGISTRY_KEY = 'orion-profiles-registry-v1'

let cachedRegistry: OrionProfileRegistry | null = null
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((l) => l())
}

function newProfileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function collectCurrentSettingsSnapshot(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of ORION_PROFILE_SETTINGS_KEYS) {
    try {
      const val = localStorage.getItem(key)
      if (val != null) out[key] = val
    } catch {
      /* ignore */
    }
  }
  return out
}

function applyWindowPreference(): void {
  const openMaximized = getActiveProfile().preferences.openMaximized
  if (typeof window.orion?.setMainWindowMaximized === 'function') {
    void window.orion.setMainWindowMaximized(openMaximized)
  }
}

export function applySettingsSnapshot(
  snapshot: Record<string, string>,
  mode: 'replace' | 'fill' = 'replace'
): void {
  for (const key of ORION_PROFILE_SETTINGS_KEYS) {
    try {
      const val = snapshot[key]
      if (val == null) {
        if (mode === 'replace') localStorage.removeItem(key)
      } else {
        localStorage.setItem(key, val)
      }
    } catch {
      /* ignore */
    }
  }
  reloadAllProfileBoundSettings()
  applyWindowPreference()
  window.dispatchEvent(new CustomEvent('orion-profile-applied'))
}

export function reloadAllProfileBoundSettings(): void {
  reloadBackgroundSettingsFromStorage()
  reloadHymnMotionFromStorage()
  reloadBibleMotionFromStorage()
  reloadProjectionContentInsetsFromStorage()
  reloadHymnTypographyFromStorage()
  reloadBibleBlockLayoutFromStorage()
  reloadHymnBlockLayoutFromStorage()
  reloadDictionaryBlockLayoutFromStorage()
  reloadBibleBookBackgroundsFromStorage()
  reloadRecentColorsFromStorage()
  void pushProjectionContentInsetsToMain(getProjectionContentInsetsByCategory())
  void pushHymnTypographyToMain()
}

function saveRegistry(registry: OrionProfileRegistry): OrionProfileRegistry {
  cachedRegistry = registry
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry))
  } catch {
    /* ignore */
  }
  notify()
  return registry
}

function loadRegistryFromStorage(): OrionProfileRegistry | null {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OrionProfileRegistry
    if (parsed.version !== 1 || !Array.isArray(parsed.profiles)) return null
    if (!parsed.profiles.length || typeof parsed.activeProfileId !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export function getProfileRegistry(): OrionProfileRegistry {
  if (cachedRegistry) return cachedRegistry
  const stored = loadRegistryFromStorage()
  if (stored) {
    cachedRegistry = stored
    return stored
  }
  return initializeProfileRegistry()
}

export function initializeProfileRegistry(): OrionProfileRegistry {
  const id = newProfileId()
  const profile = createEmptyProfileMeta(id, 'Default')
  profile.settings = collectCurrentSettingsSnapshot()
  const registry: OrionProfileRegistry = {
    version: 1,
    activeProfileId: id,
    profiles: [profile]
  }
  return saveRegistry(registry)
}

export function getActiveProfile(): OrionProfileMeta {
  const registry = getProfileRegistry()
  const active =
    registry.profiles.find((p) => p.id === registry.activeProfileId) ?? registry.profiles[0]
  if (!active) {
    return initializeProfileRegistry().profiles[0]
  }
  return active
}

export function persistActiveProfileSnapshot(): OrionProfileMeta {
  const registry = getProfileRegistry()
  const snapshot = collectCurrentSettingsSnapshot()
  const now = new Date().toISOString()
  const profiles = registry.profiles.map((p) =>
    p.id === registry.activeProfileId
      ? { ...p, settings: snapshot, updatedAt: now }
      : p
  )
  return saveRegistry({ ...registry, profiles }).profiles.find(
    (p) => p.id === registry.activeProfileId
  )!
}

export function updateActiveProfile(
  patch: Partial<Pick<OrionProfileMeta, 'name' | 'organizationName' | 'preferences'>>
): OrionProfileMeta {
  persistActiveProfileSnapshot()
  const registry = getProfileRegistry()
  const now = new Date().toISOString()
  const profiles = registry.profiles.map((p) => {
    if (p.id !== registry.activeProfileId) return p
    return {
      ...p,
      ...patch,
      preferences: patch.preferences ? { ...p.preferences, ...patch.preferences } : p.preferences,
      updatedAt: now
    }
  })
  saveRegistry({ ...registry, profiles })
  applyWindowPreference()
  return getActiveProfile()
}

export function updateActiveProfilePreferences(
  patch: Partial<OrionProfilePreferences>
): OrionProfileMeta {
  return updateActiveProfile({
    preferences: { ...getActiveProfile().preferences, ...patch }
  })
}

export function createProfile(name: string, options?: { blank?: boolean }): OrionProfileMeta {
  persistActiveProfileSnapshot()
  const registry = getProfileRegistry()
  const profile = createEmptyProfileMeta(newProfileId(), name.trim() || 'New profile')
  if (!options?.blank) profile.settings = collectCurrentSettingsSnapshot()
  saveRegistry({
    ...registry,
    activeProfileId: profile.id,
    profiles: [...registry.profiles, profile]
  })
  applySettingsSnapshot(profile.settings, 'replace')
  return profile
}

export function duplicateActiveProfile(): OrionProfileMeta {
  const active = persistActiveProfileSnapshot()
  const names = new Set(getProfileRegistry().profiles.map((profile) => profile.name))
  let name = `${active.name} copy`
  let n = 2
  while (names.has(name)) {
    name = `${active.name} copy ${n}`
    n += 1
  }
  return createProfile(name)
}

export function deleteProfile(profileId: string): OrionProfileRegistry {
  const registry = getProfileRegistry()
  if (registry.profiles.length <= 1) {
    return registry
  }
  const profiles = registry.profiles.filter((p) => p.id !== profileId)
  let activeProfileId = registry.activeProfileId
  const deletedActive = activeProfileId === profileId
  if (deletedActive) activeProfileId = profiles[0]?.id ?? activeProfileId
  const next = saveRegistry({ ...registry, profiles, activeProfileId })
  if (deletedActive) applySettingsSnapshot(profiles[0]?.settings ?? {}, 'replace')
  return next
}

export function switchActiveProfile(profileId: string): OrionProfileMeta {
  persistActiveProfileSnapshot()
  const registry = getProfileRegistry()
  const target = registry.profiles.find((p) => p.id === profileId)
  if (!target) return getActiveProfile()
  saveRegistry({ ...registry, activeProfileId: profileId })
  applySettingsSnapshot(target.settings)
  return getActiveProfile()
}

export function applyActiveProfileOnLaunch(): void {
  const stored = loadRegistryFromStorage()
  if (!stored) {
    initializeProfileRegistry()
    applyWindowPreference()
    return
  }
  cachedRegistry = stored
  applySettingsSnapshot(getActiveProfile().settings, 'fill')
  persistActiveProfileSnapshot()
}

registerProfileAutosave(() => {
  persistActiveProfileSnapshot()
})

export function buildActiveProfileExportJson(): string {
  const meta = persistActiveProfileSnapshot()
  return JSON.stringify(buildOrionProfileFile(meta), null, 2)
}

export function importProfileFromFileJson(json: string, activate: boolean): OrionProfileMeta | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  const doc = parseOrionProfileFile(parsed)
  if (!doc) return null

  persistActiveProfileSnapshot()
  const registry = getProfileRegistry()
  const id = newProfileId()
  const profile: OrionProfileMeta = {
    id,
    name: doc.profile.name,
    organizationName: doc.profile.organizationName,
    preferences: { ...DEFAULT_ORION_PROFILE_PREFERENCES, ...doc.profile.preferences },
    settings: { ...doc.profile.settings },
    updatedAt: new Date().toISOString()
  }

  saveRegistry({
    ...registry,
    activeProfileId: activate ? id : registry.activeProfileId,
    profiles: [...registry.profiles, profile]
  })

  if (activate) {
    applySettingsSnapshot(profile.settings)
  }

  return profile
}

export function useProfileRegistry(): OrionProfileRegistry {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    },
    () => getProfileRegistry(),
    () => ({
      version: 1 as const,
      activeProfileId: '',
      profiles: []
    })
  )
}

export function useActiveProfile(): OrionProfileMeta {
  const registry = useProfileRegistry()
  return (
    registry.profiles.find((p) => p.id === registry.activeProfileId) ??
    registry.profiles[0] ??
    createEmptyProfileMeta('fallback', 'Default')
  )
}

export async function exportActiveProfileToFile(includeContent = false): Promise<string | null> {
  if (typeof window.orion?.exportProfileFile !== 'function') return null
  const json = buildActiveProfileExportJson()
  const name = getActiveProfile().name.replace(/[^\w\s-]/g, '').trim() || 'orion-profile'
  return window.orion.exportProfileFile(json, name, includeContent)
}

export async function importProfileFromFileDialog(activate = true): Promise<OrionProfileMeta | null> {
  if (typeof window.orion?.importProfileFile !== 'function') return null
  const json = await window.orion.importProfileFile()
  if (!json) return null
  return importProfileFromFileJson(json, activate)
}
