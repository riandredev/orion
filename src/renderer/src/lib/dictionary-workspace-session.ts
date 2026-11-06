import { normalizeStrongsId } from '../../../shared/dictionary-lexicon'
import type { LexiconLanguageFilter } from '../../../shared/dictionary-lexicon'
import { getDictionaryLiveContent } from './dictionary-ribbon-sync'

export type DictionaryWorkspaceSession = {
  selectedId: string | null
  query: string
  language: LexiconLanguageFilter
  listScrollTop: number
  scriptureBook: string
  scriptureChapter: string
}

function resolveInitialSelectedId(): string | null {
  const live = getDictionaryLiveContent()
  if (live?.strongs) {
    return normalizeStrongsId(live.strongs) ?? live.strongs.trim().toUpperCase()
  }
  return 'H0001'
}

let session: DictionaryWorkspaceSession = {
  selectedId: resolveInitialSelectedId(),
  query: '',
  language: 'all',
  listScrollTop: 0,
  scriptureBook: 'all',
  scriptureChapter: 'all'
}

export function getDictionaryWorkspaceSession(): DictionaryWorkspaceSession {
  return session
}

export function patchDictionaryWorkspaceSession(patch: Partial<DictionaryWorkspaceSession>): void {
  session = { ...session, ...patch }
}
