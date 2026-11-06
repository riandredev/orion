export type HymnsWorkspaceSession = {
  hymnalId: string
  selectedId: string | null
  query: string
  stanzaIndex: number
  projectionStepIndex: number
  /** Verse numbers excluded from projection for the current hymn. */
  disabledVerseNumbers: number[]
  includeRefrain: boolean
  listScrollTop: number
}

let session: HymnsWorkspaceSession = {
  hymnalId: '',
  selectedId: null,
  query: '',
  stanzaIndex: 0,
  projectionStepIndex: 0,
  disabledVerseNumbers: [],
  includeRefrain: true,
  listScrollTop: 0
}

export function getHymnsWorkspaceSession(): HymnsWorkspaceSession {
  return session
}

export function patchHymnsWorkspaceSession(patch: Partial<HymnsWorkspaceSession>): void {
  session = { ...session, ...patch }
}
