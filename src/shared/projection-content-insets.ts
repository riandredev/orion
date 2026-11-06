/** Content safe-area padding on projection slides (vmin). */
export type ProjectionContentInsetsVmin = {
  top: number
  right: number
  bottom: number
  left: number
}

export type ProjectionContentInsetCategory = 'bible' | 'hymns' | 'dictionary'

export type ProjectionContentInsetsByCategory = Record<
  ProjectionContentInsetCategory,
  ProjectionContentInsetsVmin
>

export const PROJECTION_CONTENT_INSET_MIN = 0
export const PROJECTION_CONTENT_INSET_MAX = 18

export const DEFAULT_PROJECTION_CONTENT_INSETS: ProjectionContentInsetsVmin = {
  top: 3.5,
  right: 4.5,
  bottom: 4,
  left: 4.5
}

/** Dictionary slides previously used slightly larger margins. */
export const DEFAULT_DICTIONARY_CONTENT_INSETS: ProjectionContentInsetsVmin = {
  top: 6,
  right: 7,
  bottom: 6,
  left: 7
}

export const DEFAULT_PROJECTION_CONTENT_INSETS_BY_CATEGORY: ProjectionContentInsetsByCategory =
  {
    bible: { ...DEFAULT_PROJECTION_CONTENT_INSETS },
    hymns: { ...DEFAULT_PROJECTION_CONTENT_INSETS },
    dictionary: { ...DEFAULT_DICTIONARY_CONTENT_INSETS }
  }

function clampSide(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(
    PROJECTION_CONTENT_INSET_MAX,
    Math.max(PROJECTION_CONTENT_INSET_MIN, Math.round(value * 10) / 10)
  )
}

export function clampProjectionContentInsets(
  raw: Partial<ProjectionContentInsetsVmin> | undefined,
  fallback: ProjectionContentInsetsVmin = DEFAULT_PROJECTION_CONTENT_INSETS
): ProjectionContentInsetsVmin {
  return {
    top: clampSide(raw?.top, fallback.top),
    right: clampSide(raw?.right, fallback.right),
    bottom: clampSide(raw?.bottom, fallback.bottom),
    left: clampSide(raw?.left, fallback.left)
  }
}

export function clampProjectionContentInsetsByCategory(
  raw: Partial<ProjectionContentInsetsByCategory> | ProjectionContentInsetsVmin | undefined
): ProjectionContentInsetsByCategory {
  const defaults = DEFAULT_PROJECTION_CONTENT_INSETS_BY_CATEGORY
  if (raw && typeof raw === 'object' && ('bible' in raw || 'hymns' in raw || 'dictionary' in raw)) {
    const byCat = raw as Partial<ProjectionContentInsetsByCategory>
    return {
      bible: clampProjectionContentInsets(byCat.bible, defaults.bible),
      hymns: clampProjectionContentInsets(byCat.hymns, defaults.hymns),
      dictionary: clampProjectionContentInsets(byCat.dictionary, defaults.dictionary)
    }
  }
  const flat = clampProjectionContentInsets(raw as Partial<ProjectionContentInsetsVmin> | undefined)
  return {
    bible: flat,
    hymns: flat,
    dictionary: clampProjectionContentInsets(undefined, defaults.dictionary)
  }
}

export function projectionContentInsetsCssVars(
  insets: ProjectionContentInsetsVmin
): Record<string, string> {
  return {
    '--orion-content-inset-top': `${insets.top}vmin`,
    '--orion-content-inset-right': `${insets.right}vmin`,
    '--orion-content-inset-bottom': `${insets.bottom}vmin`,
    '--orion-content-inset-left': `${insets.left}vmin`
  }
}

/** Unitless inset values for settings previews (apply with cqh in CSS). */
export function projectionContentInsetsPreviewVars(
  insets: ProjectionContentInsetsVmin
): Record<string, string> {
  return {
    '--orion-inset-top': String(insets.top),
    '--orion-inset-right': String(insets.right),
    '--orion-inset-bottom': String(insets.bottom),
    '--orion-inset-left': String(insets.left)
  }
}
