import type { OrderImageAnimation } from '../../../shared/projection-stack'

export type SlideAnimation = OrderImageAnimation

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
  { value: 'pixels', label: 'Pixels' }
]
