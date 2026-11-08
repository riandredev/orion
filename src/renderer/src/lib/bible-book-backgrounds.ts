import { useSyncExternalStore } from 'react'
import { touchProfileSettings } from './profile-autosave'
import {
  resolveCategoryBackground,
  resolveStoredBackgroundImagePath,
  storeImagePath,
  type AllBackgroundSettings,
  type ResolvedBackgroundStyle
} from './background-settings'

const STORAGE_KEY = 'orion-bible-book-backgrounds-v1'

let cached: Record<string, string> | null = null
const listeners = new Set<() => void>()

function read(): Record<string, string> {
  if (cached) return cached
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : {}
    const next: Record<string, string> = {}
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [id, value] of Object.entries(parsed)) {
        if (typeof value === 'string' && value.trim()) next[id] = value
      }
    }
    cached = next
  } catch {
    cached = {}
  }
  return cached
}

function save(next: Record<string, string>): Record<string, string> {
  cached = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  touchProfileSettings()
  listeners.forEach((listener) => listener())
  return next
}

export function reloadBibleBookBackgroundsFromStorage(): Record<string, string> {
  cached = null
  const next = read()
  listeners.forEach((listener) => listener())
  return next
}

export function getBibleBookBackgrounds(): Record<string, string> {
  return read()
}

export function bibleBookBackgroundPath(bookId: string): string | null {
  const stored = read()[bookId]
  if (!stored) return null
  return resolveStoredBackgroundImagePath(stored)
}

export function setBibleBookBackground(bookId: string, imagePath: string | null): void {
  const next = { ...read() }
  const stored = imagePath ? storeImagePath(imagePath) : null
  if (!stored) delete next[bookId]
  else next[bookId] = stored
  save(next)
}

export function resolveBibleBackground(
  bookId?: string | null,
  settings?: AllBackgroundSettings
): ResolvedBackgroundStyle {
  const base = resolveCategoryBackground('bible', settings)
  if (!bookId) return base
  const imagePath = bibleBookBackgroundPath(bookId)
  if (!imagePath) return base
  return { ...base, imagePath }
}

export function useBibleBookBackgrounds(): Record<string, string> {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    },
    () => getBibleBookBackgrounds(),
    () => ({})
  )
}
