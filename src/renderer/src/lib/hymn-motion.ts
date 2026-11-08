import { useSyncExternalStore } from 'react'
import { touchProfileSettings } from './profile-autosave'
import { coerceLyricAnimation, lyricAnimationOptions, type LyricSlideAnimation } from './lyric-motion'

export const HYMN_MOTION_KEY = 'orion-hymn-motion-v1'

export type HymnSlideAnimation = LyricSlideAnimation

export type HymnMotionSettings = {
  animation: HymnSlideAnimation
  transitionMs: number
}

export const hymnAnimationOptions = lyricAnimationOptions

const fallback: HymnMotionSettings = {
  animation: 'cut',
  transitionMs: 0
}

function sanitize(raw: Partial<HymnMotionSettings> | null | undefined): HymnMotionSettings {
  const animation = coerceLyricAnimation(typeof raw?.animation === 'string' ? raw.animation : 'cut')
  const transitionMs =
    typeof raw?.transitionMs === 'number' && Number.isFinite(raw.transitionMs)
      ? Math.min(5000, Math.max(0, Math.round(raw.transitionMs)))
      : fallback.transitionMs
  return { animation, transitionMs }
}

function load(): HymnMotionSettings {
  try {
    const raw = localStorage.getItem(HYMN_MOTION_KEY)
    if (!raw) return fallback
    return sanitize(JSON.parse(raw) as Partial<HymnMotionSettings>)
  } catch {
    return fallback
  }
}

let cached: HymnMotionSettings | null = null
const listeners = new Set<() => void>()

export function getHymnMotion(): HymnMotionSettings {
  if (!cached) cached = load()
  return cached
}

export function reloadHymnMotionFromStorage(): void {
  cached = load()
  listeners.forEach((listener) => listener())
}

export function updateHymnMotion(patch: Partial<HymnMotionSettings>): HymnMotionSettings {
  const next = sanitize({ ...getHymnMotion(), ...patch })
  cached = next
  try {
    localStorage.setItem(HYMN_MOTION_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  touchProfileSettings()
  listeners.forEach((listener) => listener())
  return next
}

export function useHymnMotion(): HymnMotionSettings {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => listeners.delete(onStoreChange)
    },
    () => getHymnMotion(),
    () => fallback
  )
}

export function hymnMotionForProjection(settings: HymnMotionSettings = getHymnMotion()): {
  animation: HymnSlideAnimation
  durationMs: number
} {
  if (settings.animation === 'cut') {
    return { animation: 'cut', durationMs: 0 }
  }
  return { animation: settings.animation, durationMs: settings.transitionMs }
}
