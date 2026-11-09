import type { HTMLAttributes } from 'react'

declare global {
  interface ImportMeta {
    glob: (pattern: string, options?: { eager?: boolean; import?: string }) => Record<string, unknown>
  }
}

export type { OrionDisplayInfo } from '../../shared/displays'

export type OrderFolderInfo = {
  name: string
  imageCount: number
}

export type OrderFolderImage = {
  name: string
  path: string
}

export type OrionPaths = {
  orderImages: string
  images: string
  bibles: string
  platform: NodeJS.Platform
}

export type InstalledBibleInfo = import('../../shared/bible-types').InstalledBibleInfo
export type BibleChapterDto = import('../../shared/bible-types').BibleChapterDto

export type OrionApi = {
  listOrderFolders: () => Promise<OrderFolderInfo[]>
  listOrderFolderImages: (folderName: string) => Promise<OrderFolderImage[]>
  createOrderFolder: (name: string) => Promise<{ ok: true; name: string } | { ok: false; message: string }>
  importOrderImages: (
    folderName: string
  ) => Promise<{ ok: true; added: number } | { ok: false; message: string }>
  listMediaFolders: () => Promise<{ name: string; itemCount: number }[]>
  listMediaFolder: (
    folderName: string
  ) => Promise<{ name: string; path: string; kind: 'video' | 'audio'; size: number; modifiedMs: number }[]>
  createMediaFolder: (name: string) => Promise<{ ok: true; name: string } | { ok: false; message: string }>
  importMedia: (
    folderName: string
  ) => Promise<
    | { name: string; path: string; kind: 'video' | 'audio'; size: number; modifiedMs: number }[]
    | { ok: false; message: string }
  >
  removeMedia: (filePath: string) => Promise<boolean>
  listBackgroundImages: () => Promise<OrderFolderImage[]>
  backgroundThumb: (filePath: string) => Promise<string | null>
  removeLibraryImage: (filePath: string) => Promise<boolean>
  importBackgroundImage: () => Promise<OrderFolderImage | null>
  onBackgroundImportProgress: (
    callback: (progress: import('../../shared/background-import').BackgroundImportProgress) => void
  ) => () => void
  listBibles: () => Promise<InstalledBibleInfo[]>
  listOnlineBibleTranslations: () => Promise<import('../../shared/bible-online').OnlineBibleTranslation[]>
  importBible: () => Promise<InstalledBibleInfo | null>
  downloadBible: (translationId: string) => Promise<InstalledBibleInfo>
  removeBible: (bibleId: string) => Promise<boolean>
  getBibleChapter: (bibleId: string, bookId: string, chapter: number) => Promise<BibleChapterDto>
  searchBible: (
    bibleId: string,
    query: string,
    mode: import('../../shared/bible-search').BibleSearchMode,
    scope: import('../../shared/bible-search').BibleSearchScope,
    limit?: number
  ) => Promise<import('../../shared/bible-search').BibleSearchHit[]>
  ensureDictionary: () => Promise<{
    entries: import('../../shared/dictionary-types').LexiconEntrySummary[]
    progress: import('../../shared/dictionary-types').DictionaryIndexProgress
  }>
  getDictionaryIndexProgress: () => Promise<
    import('../../shared/dictionary-types').DictionaryIndexProgress
  >
  searchDictionaryEntries: (
    query: string,
    language: import('../../shared/dictionary-lexicon').LexiconLanguageFilter,
    offset: number,
    limit: number
  ) => Promise<{ total: number; items: import('../../shared/dictionary-types').LexiconEntrySummary[] }>
  getDictionaryEntry: (strongs: string) => Promise<
    import('../../shared/dictionary-types').LexiconEntry | null
  >
  getDictionaryScriptureOccurrences: (
    strongs: string,
    options: {
      bibleId?: string
      bookId?: string | null
      chapter?: number | null
      offset?: number
      limit?: number
    }
  ) => Promise<{
    total: number
    items: import('../../shared/dictionary-types').DictionaryScriptureOccurrence[]
  }>
  listHymnals: () => Promise<import('../../shared/hymnal-types').HymnalMeta[]>
  listLibraries: () => Promise<import('../../shared/content-bundles').LibraryList>
  installLibrary: (id: string) => Promise<{ ok: true } | { ok: false; message: string }>
  onLibraryProgress: (
    callback: (progress: import('../../shared/content-bundles').LibraryProgress) => void
  ) => () => void
  onLibrariesList: (callback: (list: import('../../shared/content-bundles').LibraryList) => void) => () => void
  getHymnalIndex: (hymnalId: string) => Promise<import('../../shared/hymnal-types').HymnSummary[]>
  getHymnEntry: (
    hymnalId: string,
    hymnId: string
  ) => Promise<import('../../shared/hymnal-types').HymnEntry | null>
  importHymnal: () => Promise<import('../../shared/hymnal-types').HymnalMeta | null>
  importHymnalFolder: () => Promise<import('../../shared/hymnal-types').HymnalMeta | null>
  importBibsoftMdb: () => Promise<import('../../shared/hymnal-types').HymnalMeta[]>
  ensurePersonalHymnal: () => Promise<import('../../shared/hymnal-types').HymnalMeta>
  upsertHymnEntry: (
    hymnalId: string,
    input: {
      id?: string
      number: number
      title: string
      stanzas: import('../../shared/hymnal-types').HymnStanza[]
    }
  ) => Promise<import('../../shared/hymnal-types').HymnEntry>
  deleteHymnEntry: (hymnalId: string, hymnId: string) => Promise<boolean>
  getPaths: () => Promise<OrionPaths>
  getProjectionContentInsets: () => Promise<
    import('../../shared/projection-content-insets').ProjectionContentInsetsByCategory
  >
  setProjectionContentInsets: (
    insets: import('../../shared/projection-content-insets').ProjectionContentInsetsByCategory
  ) => Promise<import('../../shared/projection-content-insets').ProjectionContentInsetsByCategory>
  setHymnTypography: (
    value: import('../../shared/projection-typography').ProjectionTypography
  ) => Promise<import('../../shared/projection-typography').ProjectionTypography>
  setProjection: (
    payload: import('../../shared/projection').OrionProjectionPayload,
    displayIds: number[]
  ) => Promise<void>
  runProjectionCommand: (
    command: import('../../shared/projection-stack').OrionProjectionCommand,
    displayIds: number[]
  ) => Promise<import('../../shared/presentation-ui-state').PresentationUiState>
  getPresentationUiState: () => Promise<import('../../shared/presentation-ui-state').PresentationUiState>
  listDisplays: () => Promise<import('../../shared/displays').OrionDisplayInfo[]>
  onDisplaysChanged: (
    callback: (displays: import('../../shared/displays').OrionDisplayInfo[]) => void
  ) => () => void
  onProjectionSessionEnded: (callback: () => void) => () => void
  onPresentationUiStateChanged: (
    callback: (state: import('../../shared/presentation-ui-state').PresentationUiState) => void
  ) => () => void
  onOutputPreviewFrame: (
    callback: (frame: { displayId: number; dataUrl: string }) => void
  ) => () => void
  onOutputPreviewClear: (callback: () => void) => () => void
  setOutputPreviewOpen: (open: boolean) => void
  setMainWindowMaximized: (maximized: boolean) => Promise<void>
  exportProfileFile: (json: string, suggestedName: string, includeContent?: boolean) => Promise<string | null>
  importProfileFile: () => Promise<string | null>
  exportSequenceFile: (json: string, suggestedName: string, bundleContent?: boolean) => Promise<string | null>
  importSequenceFile: () => Promise<string | null>
  listPresentationDecks: () => Promise<
    import('../../shared/presentation-deck-types').PresentationDeckSummary[]
  >
  getPresentationDeck: (
    deckId: string
  ) => Promise<import('../../shared/presentation-deck-types').PresentationDeckDetail | null>
  importPresentationDeck: () => Promise<
    import('../../shared/presentation-deck-types').PresentationImportResult
  >
  readPresentationDeckSource: (
    deckId: string
  ) => Promise<{ bytes: Uint8Array; mediaDir: string; mediaFiles: string[] } | null>
  rasterizeMetafiles: (payloads: string[]) => Promise<(string | null)[]>
  removePresentationDeck: (deckId: string) => Promise<boolean>
  getPresentationImportDepsStatus: () => Promise<
    import('../../shared/presentation-import-deps').PresentationImportDepsStatus
  >
  downloadPresentationImportDeps: () => Promise<{ ok: true } | { ok: false; message: string }>
  cancelPresentationImportDepsDownload: () => Promise<void>
  onPresentationImportDepsProgress: (
    callback: (progress: import('../../shared/presentation-import-deps').PresentationImportDepsProgress) => void
  ) => () => void
  onPresentationImportProgress: (
    callback: (progress: import('../../shared/presentation-deck-types').PresentationImportProgress) => void
  ) => () => void
  openPresenterView: (deckId: string, slideIndex: number, buildStep?: number) => Promise<void>
  closePresenterView: () => Promise<void>
  isPresenterViewOpen: () => Promise<boolean>
  syncPresenterSlideFromMain: (deckId: string | null, slideIndex: number, buildStep?: number) => Promise<void>
  onPresentationStepFromPresenter: (callback: (delta: number) => void) => () => void
  syncDeckMedia: (command: {
    action: 'play' | 'pause' | 'seek'
    index: number
    time: number
    epoch: number
  }) => void
  syncLibraryMedia: (command: { action: 'play' | 'pause' | 'seek'; time: number; epoch: number }) => void
  syncWebMedia: (command: {
    time: number
    paused: boolean
    rate: number
    fullscreen: boolean
    captions: boolean
    epoch: number
  }) => void
  setGuestAudioMuted: (webContentsId: number, muted: boolean) => void
  onPresenterSlideFromWindow: (
    callback: (payload: { deckId: string | null; slideIndex: number }) => void
  ) => () => void
}

declare global {
  interface Window {
    orion: OrionApi
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: HTMLAttributes<HTMLElement> & {
        src?: string
        allowpopups?: string | boolean
        partition?: string
      }
    }
  }
}

export {}
