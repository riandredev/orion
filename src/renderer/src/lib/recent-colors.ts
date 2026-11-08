import { useSyncExternalStore } from 'react'
import { pushRecentColor, recentColorGroup } from '../../../shared/recent-colors'
import { touchProfileSettings } from './profile-autosave'

const STORAGE_KEY = 'orion-recent-colors-v1'
const EMPTY: readonly string[] = []

let cache: Record<string, string[]> | null = null
const listeners = new Set<() => void>()

function readStore(): Record<string, string[]> {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      cache = {}
      return cache
    }
    const next: Record<string, string[]> = {}
    for (const [group, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue
      next[group] = value.filter((entry): entry is string => typeof entry === 'string')
    }
    cache = next
  } catch {
    cache = {}
  }
  return cache
}

function emit(): void {
  for (const listener of listeners) listener()
}

export function rememberRecentColor(group: string, hex: string, limit: number): void {
  if (!group) return
  const store = readStore()
  const current = store[group] ?? EMPTY
  const next = pushRecentColor(current, hex, limit)
  if (next === current) return
  cache = { ...store, [group]: [...next] }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    /* the swatches still update for this session */
  }
  emit()
  touchProfileSettings()
}

export function reloadRecentColorsFromStorage(): void {
  cache = null
  readStore()
  emit()
}

function snapshot(group: string): readonly string[] {
  if (!group) return EMPTY
  return readStore()[group] ?? EMPTY
}

export function useRecentColors(swatches: readonly { color: string }[]): readonly string[] {
  const group = recentColorGroup(swatches)
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => snapshot(group),
    () => EMPTY
  )
}

export function recentGroupFor(swatches: readonly { color: string }[]): string {
  return recentColorGroup(swatches)
}
