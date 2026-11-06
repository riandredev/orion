import type { OrionDisplayInfo } from '../../../shared/displays'
import { touchProfileSettings } from './profile-autosave'

const STORAGE_KEY = 'orion-display-enabled'

export type DisplayEnabledMap = Record<number, boolean>

type DisplayEnabledStore = {
  byId: Record<string, boolean>
  bySignature: Record<string, boolean>
}

/** Stable across restarts when the OS display id changes. */
export function displayProjectionSignature(
  display: Pick<OrionDisplayInfo, 'label' | 'bounds' | 'scaleFactor' | 'internal'>
): string {
  return [
    display.label.trim().toLowerCase(),
    `${display.bounds.width}x${display.bounds.height}`,
    String(display.scaleFactor),
    display.internal ? 'internal' : 'external'
  ].join('|')
}

function emptyStore(): DisplayEnabledStore {
  return { byId: {}, bySignature: {} }
}

function loadStore(): DisplayEnabledStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return emptyStore()
    const body = parsed as { byId?: unknown; bySignature?: unknown }
    if (body.byId && typeof body.byId === 'object') {
      return {
        byId: boolRecord(body.byId),
        bySignature: boolRecord(body.bySignature)
      }
    }
    return { byId: boolRecord(parsed), bySignature: {} }
  } catch {
    return emptyStore()
  }
}

function boolRecord(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'boolean') out[key] = value
  }
  return out
}

function saveStore(store: DisplayEnabledStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
  touchProfileSettings()
}

export function loadDisplayEnabledMap(): DisplayEnabledMap {
  const out: DisplayEnabledMap = {}
  for (const [key, value] of Object.entries(loadStore().byId)) {
    const id = Number(key)
    if (!Number.isFinite(id)) continue
    out[id] = value
  }
  return out
}

/** Copy a saved choice onto a new OS id when the monitor signature matches. */
export function rememberDisplays(displays: OrionDisplayInfo[]): DisplayEnabledMap {
  const store = loadStore()
  let dirty = false
  for (const display of displays) {
    const idKey = String(display.id)
    const signature = displayProjectionSignature(display)
    if (!(idKey in store.byId) && signature in store.bySignature) {
      store.byId[idKey] = store.bySignature[signature]
      dirty = true
    }
  }
  if (dirty) saveStore(store)
  return loadDisplayEnabledMap()
}

/** Missing entries default to enabled. */
export function isDisplayProjectionEnabled(
  displayId: number,
  map = loadDisplayEnabledMap(),
  signature?: string
): boolean {
  if (Object.prototype.hasOwnProperty.call(map, displayId)) return map[displayId] !== false
  if (signature) {
    const saved = loadStore().bySignature[signature]
    if (typeof saved === 'boolean') return saved
  }
  return true
}

export function setDisplayProjectionEnabled(
  displayId: number,
  enabled: boolean,
  signature?: string
): DisplayEnabledMap {
  const store = loadStore()
  store.byId[String(displayId)] = enabled
  if (signature) store.bySignature[signature] = enabled
  saveStore(store)
  return loadDisplayEnabledMap()
}
