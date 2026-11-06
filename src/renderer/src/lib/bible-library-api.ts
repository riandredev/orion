import type { BibleChapterDto, InstalledBibleInfo } from '../../../shared/bible-types'

export async function listInstalledBibles(): Promise<InstalledBibleInfo[]> {
  if (typeof window.orion?.listBibles !== 'function') return []
  return window.orion.listBibles()
}

export async function importBible(): Promise<InstalledBibleInfo | null> {
  if (typeof window.orion?.importBible !== 'function') return null
  return window.orion.importBible()
}

export async function listOnlineBibleTranslations(): Promise<
  import('../../../shared/bible-online').OnlineBibleTranslation[]
> {
  if (typeof window.orion?.listOnlineBibleTranslations !== 'function') {
    throw new Error('Online catalog is unavailable in this environment.')
  }
  return window.orion.listOnlineBibleTranslations()
}

export async function downloadHelloAoTranslation(
  translationId: string
): Promise<InstalledBibleInfo> {
  if (typeof window.orion?.downloadBible !== 'function') {
    throw new Error('Download is unavailable in this environment.')
  }
  return window.orion.downloadBible(translationId)
}
export async function removeBible(bibleId: string): Promise<boolean> {
  if (typeof window.orion?.removeBible !== 'function') return false
  return window.orion.removeBible(bibleId)
}

export async function fetchBibleChapter(
  bibleId: string,
  bookId: string,
  chapter: number
): Promise<BibleChapterDto> {
  if (typeof window.orion?.getBibleChapter !== 'function') return { verses: [] }
  return window.orion.getBibleChapter(bibleId, bookId, chapter)
}

export async function searchBibleText(
  bibleId: string,
  query: string,
  mode: import('../../../shared/bible-search').BibleSearchMode,
  scope: import('../../../shared/bible-search').BibleSearchScope,
  limit = 24
): Promise<import('../../../shared/bible-search').BibleSearchHit[]> {
  if (typeof window.orion?.searchBible !== 'function') return []
  return window.orion.searchBible(bibleId, query, mode, scope, limit)
}
