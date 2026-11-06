import { ORION_PROFILE_SETTINGS_KEYS } from './profile-settings-keys'

export const ORION_PROFILE_FORMAT = 'orion-profile' as const
export const ORION_PROFILE_FILE_VERSION = 1

export type OrionProfilePreferences = {
  openMaximized: boolean
}

export type OrionProfileMeta = {
  id: string
  name: string
  organizationName: string
  preferences: OrionProfilePreferences
  settings: Record<string, string>
  updatedAt: string
}

export type OrionProfileRegistry = {
  version: 1
  activeProfileId: string
  profiles: OrionProfileMeta[]
}

export type OrionProfileFile = {
  format: typeof ORION_PROFILE_FORMAT
  version: typeof ORION_PROFILE_FILE_VERSION
  exportedAt: string
  profile: {
    name: string
    organizationName: string
    preferences: OrionProfilePreferences
    settings: Record<string, string>
  }
}

export const DEFAULT_ORION_PROFILE_PREFERENCES: OrionProfilePreferences = {
  openMaximized: true
}

function isPreferences(raw: unknown): raw is OrionProfilePreferences {
  if (!raw || typeof raw !== 'object') return false
  const p = raw as OrionProfilePreferences
  return typeof p.openMaximized === 'boolean'
}

function sanitizeSettings(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const allowed = new Set<string>(ORION_PROFILE_SETTINGS_KEYS)
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.has(key)) continue
    if (typeof value !== 'string') continue
    out[key] = value
  }
  return out
}

export function createEmptyProfileMeta(id: string, name: string): OrionProfileMeta {
  const now = new Date().toISOString()
  return {
    id,
    name,
    organizationName: '',
    preferences: { ...DEFAULT_ORION_PROFILE_PREFERENCES },
    settings: {},
    updatedAt: now
  }
}

export function parseOrionProfileFile(raw: unknown): OrionProfileFile | null {
  if (!raw || typeof raw !== 'object') return null
  const doc = raw as Partial<OrionProfileFile>
  if (doc.format !== ORION_PROFILE_FORMAT) return null
  if (doc.version !== ORION_PROFILE_FILE_VERSION) return null
  if (!doc.profile || typeof doc.profile !== 'object') return null
  const name = typeof doc.profile.name === 'string' ? doc.profile.name.trim() : ''
  if (!name) return null
  return {
    format: ORION_PROFILE_FORMAT,
    version: ORION_PROFILE_FILE_VERSION,
    exportedAt:
      typeof doc.exportedAt === 'string' ? doc.exportedAt : new Date().toISOString(),
    profile: {
      name,
      organizationName:
        typeof doc.profile.organizationName === 'string'
          ? doc.profile.organizationName.trim()
          : '',
      preferences: isPreferences(doc.profile.preferences)
        ? doc.profile.preferences
        : { ...DEFAULT_ORION_PROFILE_PREFERENCES },
      settings: sanitizeSettings(doc.profile.settings)
    }
  }
}

export function buildOrionProfileFile(meta: OrionProfileMeta): OrionProfileFile {
  return {
    format: ORION_PROFILE_FORMAT,
    version: ORION_PROFILE_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    profile: {
      name: meta.name,
      organizationName: meta.organizationName,
      preferences: { ...meta.preferences },
      settings: { ...meta.settings }
    }
  }
}
