/** Full translation name for the projector (e.g. “AFR 33/53 Translation”). */
export function bibleProjectionTranslationLabel(
  meta: { label?: string | null; abbr?: string | null } | undefined,
  fallbackId = ''
): string {
  const label = meta?.label?.trim()
  if (label) return label
  const abbr = meta?.abbr?.trim()
  if (abbr) return abbr
  return fallbackId.trim() || 'Bible'
}

/** Projector top-left label: `BookName:chapter:verse` */
export function formatBibleProjectionLocation(
  bookName: string,
  chapter: number,
  verse: number
): string {
  const name = bookName.trim()
  return `${name}:${chapter}:${verse}`
}

/** Fallback when only legacy `reference` (`Book 3:16`) is available. */
export function bibleLocationFromReference(reference: string): string {
  const trimmed = reference.trim()
  const match = trimmed.match(/^(.+?)\s+(\d+:\d+(?:[–-]\d+)?|\d+:\d+|\d+)$/)
  if (match) {
    return `${match[1]}:${match[2]}`
  }
  return trimmed
}
