import { useSyncExternalStore } from 'react'
import { orderImageAnimations, type OrderImageAnimation } from '../../../shared/projection-stack'
import { touchProfileSettings } from './profile-autosave'

export const HYMN_MOTION_KEY = 'orion-hymn-motion-v1'

export const hymnSlideAnimations = ['none', ...orderImageAnimations] as const

export type HymnSlideAnimation = (typeof hymnSlideAnimations)[number]

export type HymnMotionSettings = {
  animation: HymnSlideAnimation
  transitionMs: number
}

export const hymnAnimationOptions: { value: HymnSlideAnimation; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'fade', label: 'Fade' },
  { value: 'cut', label: 'Cut' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'push', label: 'Push' },
  { value: 'cover', label: 'Cover' },
  { value: 'uncover', label: 'Uncover' },
  { value: 'split', label: 'Split' }
]

const fallback: HymnMotionSettings = {
  animation: 'none',
  transitionMs: 500
}

function isAnimation(value: string): value is HymnSlideAnimation {
  return (hymnSlideAnimations as readonly string[]).includes(value)
}

function sanitize(raw: Partial<HymnMotionSettings> | null | undefined): HymnMotionSettings {
  const animation = typeof raw?.animation === 'string' && isAnimation(raw.animation) ? raw.animation : 'none'
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
  if (settings.animation === 'none' || settings.animation === 'cut') {
    return { animation: settings.animation, durationMs: 0 }
  }
  return { animation: settings.animation, durationMs: settings.transitionMs }
}

export type { OrderImageAnimation }
