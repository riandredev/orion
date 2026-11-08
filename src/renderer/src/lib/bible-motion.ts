import { useSyncExternalStore } from 'react'
import { touchProfileSettings } from './profile-autosave'
import { coerceLyricAnimation, type LyricSlideAnimation } from './lyric-motion'

export const BIBLE_MOTION_KEY = 'orion-bible-motion-v1'

export type BibleMotionSettings = {
  animation: LyricSlideAnimation
  transitionMs: number
}

const fallback: BibleMotionSettings = {
  animation: 'fade',
  transitionMs: 500
}

function sanitize(raw: Partial<BibleMotionSettings> | null | undefined): BibleMotionSettings {
  const animation = coerceLyricAnimation(typeof raw?.animation === 'string' ? raw.animation : 'fade')
  const transitionMs =
    typeof raw?.transitionMs === 'number' && Number.isFinite(raw.transitionMs)
      ? Math.min(5000, Math.max(0, Math.round(raw.transitionMs)))
      : fallback.transitionMs
  return { animation, transitionMs }
}

function load(): BibleMotionSettings {
  try {
    const raw = localStorage.getItem(BIBLE_MOTION_KEY)
    if (!raw) return fallback
    return sanitize(JSON.parse(raw) as Partial<BibleMotionSettings>)
  } catch {
    return fallback
  }
}

let cached: BibleMotionSettings | null = null
const listeners = new Set<() => void>()

export function getBibleMotion(): BibleMotionSettings {
  if (!cached) cached = load()
  return cached
}

export function reloadBibleMotionFromStorage(): void {
  cached = load()
  listeners.forEach((listener) => listener())
}

export function updateBibleMotion(patch: Partial<BibleMotionSettings>): BibleMotionSettings {
  const next = sanitize({ ...getBibleMotion(), ...patch })
  cached = next
  try {
    localStorage.setItem(BIBLE_MOTION_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  touchProfileSettings()
  listeners.forEach((listener) => listener())
  return next
}

export function useBibleMotion(): BibleMotionSettings {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    },
    () => getBibleMotion(),
    () => fallback
  )
}

export function bibleMotionForProjection(settings: BibleMotionSettings = getBibleMotion()): {
  animation: LyricSlideAnimation
  durationMs: number
} {
  if (settings.animation === 'cut') return { animation: 'cut', durationMs: 0 }
  return { animation: settings.animation, durationMs: settings.transitionMs }
}
