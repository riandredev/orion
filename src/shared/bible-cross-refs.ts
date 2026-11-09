import { bibleBookIdsInOrder } from './bible-books'

export type BibleCrossRef = {
  bookId: string
  chapter: number
  verse: number
  endVerse?: number
}

/** Packed lists come from the public-domain Treasury of Scripture Knowledge. */
export function decodeCrossRefList(packed: string): BibleCrossRef[] {
  if (!packed) return []
  const refs: BibleCrossRef[] = []
  for (const token of packed.split(' ')) {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-(\d+))?$/.exec(token)
    if (!match) continue
    const bookId = bibleBookIdsInOrder[Number(match[1]) - 1]
    const chapter = Number(match[2])
    const verse = Number(match[3])
    const endVerse = match[4] ? Number(match[4]) : undefined
    if (!bookId || !chapter || !verse) continue
    if (endVerse && endVerse > verse) refs.push({ bookId, chapter, verse, endVerse })
    else refs.push({ bookId, chapter, verse })
  }
  return refs
}
