export const lyricSlideAnimations = ['fade', 'push', 'cut', 'random'] as const

export type LyricSlideAnimation = (typeof lyricSlideAnimations)[number]

export type PlayableLyricAnimation = Exclude<LyricSlideAnimation, 'random'>

const playableLyricAnimations: readonly PlayableLyricAnimation[] = ['fade', 'push', 'cut']

export const lyricAnimationOptions: { value: LyricSlideAnimation; label: string }[] = [
  { value: 'fade', label: 'Fade' },
  { value: 'push', label: 'Push' },
  { value: 'cut', label: 'Cut' },
  { value: 'random', label: 'Random' }
]

/** Maps older hymn choices onto fade, push, or cut. */
export function coerceLyricAnimation(value: string | undefined): LyricSlideAnimation {
  if (value === 'push') return 'push'
  if (value === 'cut' || value === 'none') return 'cut'
  if (value === 'fade' || value === 'crossfade') return 'fade'
  if (value === 'random') return 'random'
  return 'fade'
}

const lastLyricAnimation = new Map<string, PlayableLyricAnimation>()

/** Picks a different slide animation each time Random is the saved choice. */
export function resolveLyricAnimation(
  value: LyricSlideAnimation,
  bucket = 'lyric'
): PlayableLyricAnimation {
  if (value !== 'random') return value
  const previous = lastLyricAnimation.get(bucket)
  const pool = previous
    ? playableLyricAnimations.filter((name) => name !== previous)
    : playableLyricAnimations
  const next = pool[Math.floor(Math.random() * pool.length)] ?? 'fade'
  lastLyricAnimation.set(bucket, next)
  return next
}
