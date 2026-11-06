import type { HymnStanzaKind } from './hymnal-types'
import { splitVerseSlideLabel } from './hymnal-stanza-format'

/** Top-left projector label: verse number, or kind label (e.g. Refrain). */
export function hymnProjectionCornerLabel(
  kind: HymnStanzaKind | string,
  verse?: number | null,
  part?: number | null,
  partCount?: number | null
): string {
  if (kind === 'refrain') return 'Refrain'
  if (kind === 'chorus') return 'chorus'
  if (kind === 'bridge') return 'bridge'
  if (kind === 'intro') return 'intro'
  if (kind === 'verse' && verse != null && verse > 0) {
    return splitVerseSlideLabel(verse, part ?? 1, partCount ?? 1)
  }
  return ''
}
