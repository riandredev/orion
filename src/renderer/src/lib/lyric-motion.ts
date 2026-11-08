export const lyricSlideAnimations = ['fade', 'push', 'cut'] as const

export type LyricSlideAnimation = (typeof lyricSlideAnimations)[number]

export const lyricAnimationOptions: { value: LyricSlideAnimation; label: string }[] = [
  { value: 'fade', label: 'Fade' },
  { value: 'push', label: 'Push' },
  { value: 'cut', label: 'Cut' }
]

/** Maps older hymn choices onto fade, push, or cut. */
export function coerceLyricAnimation(value: string | undefined): LyricSlideAnimation {
  if (value === 'push') return 'push'
  if (value === 'cut' || value === 'none') return 'cut'
  if (value === 'fade' || value === 'crossfade') return 'fade'
  return 'fade'
}
