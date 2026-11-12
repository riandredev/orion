import { orderImageAnimations, type OrderImageAnimation } from '../../../shared/projection-stack'

export type SlideAnimation = OrderImageAnimation | 'random'

export type FolderPlaybackSettings = {
  autoScrollSec: number
  transitionMs: number
  animation: SlideAnimation
  loop: boolean
}

export const defaultFolderPlayback = (): FolderPlaybackSettings => ({
  autoScrollSec: 30,
  transitionMs: 500,
  animation: 'crossfade',
  loop: true
})

export const slideAnimationOptions: { value: SlideAnimation; label: string }[] = [
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'fade', label: 'Fade' },
  { value: 'cut', label: 'Cut' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'push', label: 'Push' },
  { value: 'cover', label: 'Cover' },
  { value: 'uncover', label: 'Uncover' },
  { value: 'split', label: 'Split' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'iris', label: 'Iris' },
  { value: 'bars', label: 'Bars' },
  { value: 'pixels', label: 'Pixels' },
  { value: 'random', label: 'Random' }
]

let lastOrderAnimation: OrderImageAnimation | null = null

/** Picks a different service-order animation each time Random is the saved choice. */
export function resolveOrderAnimation(value: SlideAnimation): OrderImageAnimation {
  if (value !== 'random') return value
  const pool = lastOrderAnimation
    ? orderImageAnimations.filter((name) => name !== lastOrderAnimation)
    : orderImageAnimations
  const next = pool[Math.floor(Math.random() * pool.length)] ?? 'crossfade'
  lastOrderAnimation = next
  return next
}
