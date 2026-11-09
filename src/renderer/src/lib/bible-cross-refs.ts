import crossRefUrl from '../../../shared/bible-cross-refs.json.gz?url'
import { bibleBookIdsInOrder } from '../../../shared/bible-books'
import { decodeCrossRefList, type BibleCrossRef } from '../../../shared/bible-cross-refs'

let table: Record<string, string> | null = null
let loading: Promise<void> | null = null

export function loadBibleCrossRefs(): Promise<void> {
  if (table) return Promise.resolve()
  loading ??= fetch(crossRefUrl)
    .then(async (response) => {
      if (!response.ok) throw new Error('Cross references did not load.')
      const bytes = new Uint8Array(await response.arrayBuffer())
      const gzip = bytes[0] === 0x1f && bytes[1] === 0x8b
      const text = gzip
        ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
        : new TextDecoder().decode(bytes)
      table = JSON.parse(text) as Record<string, string>
    })
  return loading
}

export function bibleCrossRefs(bookId: string, chapter: number, verse: number): BibleCrossRef[] {
  if (!table) return []
  const book = bibleBookIdsInOrder.indexOf(bookId) + 1
  if (book < 1) return []
  return decodeCrossRefList(table[`${book}.${chapter}.${verse}`] ?? '')
}
