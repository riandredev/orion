import { contextBridge, ipcRenderer } from 'electron'
import type { OrionDisplayInfo } from '../shared/displays'
import type { OrionProjectionPayload } from '../shared/projection'
import type { OrionProjectionCommand } from '../shared/projection-stack'
import type { PresentationUiState } from '../shared/presentation-ui-state'

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

const api = {
  listOrderFolders: (): Promise<OrderFolderInfo[]> =>
    ipcRenderer.invoke('orion:list-order-folders'),
  listOrderFolderImages: (folderName: string): Promise<OrderFolderImage[]> =>
    ipcRenderer.invoke('orion:list-order-folder-images', folderName),
  createOrderFolder: (
    name: string
  ): Promise<{ ok: true; name: string } | { ok: false; message: string }> =>
    ipcRenderer.invoke('orion:create-order-folder', name),
  importOrderImages: (
    folderName: string
  ): Promise<{ ok: true; added: number } | { ok: false; message: string }> =>
    ipcRenderer.invoke('orion:import-order-images', folderName),
  listMediaFolders: (): Promise<{ name: string; itemCount: number }[]> =>
    ipcRenderer.invoke('orion:list-media-folders'),
  listMediaFolder: (
    folderName: string
  ): Promise<{ name: string; path: string; kind: 'video' | 'audio'; size: number; modifiedMs: number }[]> =>
    ipcRenderer.invoke('orion:list-media-folder', folderName),
  createMediaFolder: (
    name: string
  ): Promise<{ ok: true; name: string } | { ok: false; message: string }> =>
    ipcRenderer.invoke('orion:create-media-folder', name),
  importMedia: (
    folderName: string
  ): Promise<
    | { name: string; path: string; kind: 'video' | 'audio'; size: number; modifiedMs: number }[]
    | { ok: false; message: string }
  > =>
    ipcRenderer.invoke('orion:import-media', folderName),
  removeMedia: (filePath: string): Promise<boolean> => ipcRenderer.invoke('orion:remove-media', filePath),
  listBackgroundImages: (): Promise<OrderFolderImage[]> =>
    ipcRenderer.invoke('orion:list-background-images'),
  importBackgroundImage: (): Promise<OrderFolderImage | null> =>
    ipcRenderer.invoke('orion:import-background-image'),
  listBibles: (): Promise<import('../shared/bible-types').InstalledBibleInfo[]> =>
    ipcRenderer.invoke('orion:list-bibles'),
  listOnlineBibleTranslations: (): Promise<
    import('../shared/bible-online').OnlineBibleTranslation[]
  > => ipcRenderer.invoke('orion:list-online-bible-translations'),
  importBible: (): Promise<import('../shared/bible-types').InstalledBibleInfo | null> =>
    ipcRenderer.invoke('orion:import-bible'),
  downloadBible: (
    translationId: string
  ): Promise<import('../shared/bible-types').InstalledBibleInfo> =>
    ipcRenderer.invoke('orion:download-bible', translationId),
  removeBible: (bibleId: string): Promise<boolean> =>
    ipcRenderer.invoke('orion:remove-bible', bibleId),
  getBibleChapter: (
    bibleId: string,
    bookId: string,
    chapter: number
  ): Promise<import('../shared/bible-types').BibleChapterDto> =>
    ipcRenderer.invoke('orion:get-bible-chapter', bibleId, bookId, chapter),
  searchBible: (
    bibleId: string,
    query: string,
    mode: import('../shared/bible-search').BibleSearchMode,
    scope: import('../shared/bible-search').BibleSearchScope,
    limit?: number
  ): Promise<import('../shared/bible-search').BibleSearchHit[]> =>
    ipcRenderer.invoke('orion:search-bible', bibleId, query, mode, scope, limit),
  ensureDictionary: (): Promise<{
    entries: import('../shared/dictionary-types').LexiconEntrySummary[]
    progress: import('../shared/dictionary-types').DictionaryIndexProgress
  }> => ipcRenderer.invoke('orion:ensure-dictionary'),
  getDictionaryIndexProgress: (): Promise<
    import('../shared/dictionary-types').DictionaryIndexProgress
  > => ipcRenderer.invoke('orion:dictionary-index-progress'),
  searchDictionaryEntries: (
    query: string,
    language: import('../shared/dictionary-lexicon').LexiconLanguageFilter,
    offset: number,
    limit: number
  ): Promise<{ total: number; items: import('../shared/dictionary-types').LexiconEntrySummary[] }> =>
    ipcRenderer.invoke('orion:search-dictionary-entries', query, language, offset, limit),
  getDictionaryEntry: (
    strongs: string
  ): Promise<import('../shared/dictionary-types').LexiconEntry | null> =>
    ipcRenderer.invoke('orion:get-dictionary-entry', strongs),
  getDictionaryScriptureOccurrences: (
    strongs: string,
    options: {
      bibleId?: string
      bookId?: string | null
      chapter?: number | null
      offset?: number
      limit?: number
    }
  ): Promise<{
    total: number
    items: import('../shared/dictionary-types').DictionaryScriptureOccurrence[]
  }> => ipcRenderer.invoke('orion:get-dictionary-scripture', strongs, options),
  listHymnals: (): Promise<import('../shared/hymnal-types').HymnalMeta[]> =>
    ipcRenderer.invoke('orion:list-hymnals'),
  getHymnalIndex: (hymnalId: string): Promise<import('../shared/hymnal-types').HymnSummary[]> =>
    ipcRenderer.invoke('orion:get-hymnal-index', hymnalId),
  getHymnEntry: (
    hymnalId: string,
    hymnId: string
  ): Promise<import('../shared/hymnal-types').HymnEntry | null> =>
    ipcRenderer.invoke('orion:get-hymn-entry', hymnalId, hymnId),
  importHymnal: (): Promise<import('../shared/hymnal-types').HymnalMeta | null> =>
    ipcRenderer.invoke('orion:import-hymnal'),
  importHymnalFolder: (): Promise<import('../shared/hymnal-types').HymnalMeta | null> =>
    ipcRenderer.invoke('orion:import-hymnal-folder'),
  importBibsoftMdb: (): Promise<import('../shared/hymnal-types').HymnalMeta[]> =>
    ipcRenderer.invoke('orion:import-bibsoft-mdb'),
  ensurePersonalHymnal: (): Promise<import('../shared/hymnal-types').HymnalMeta> =>
    ipcRenderer.invoke('orion:ensure-personal-hymnal'),
  upsertHymnEntry: (
    hymnalId: string,
    input: {
      id?: string
      number: number
      title: string
      stanzas: import('../shared/hymnal-types').HymnStanza[]
    }
  ): Promise<import('../shared/hymnal-types').HymnEntry> =>
    ipcRenderer.invoke('orion:upsert-hymn-entry', hymnalId, input),
  deleteHymnEntry: (hymnalId: string, hymnId: string): Promise<boolean> =>
    ipcRenderer.invoke('orion:delete-hymn-entry', hymnalId, hymnId),
  getProjectionContentInsets: (): Promise<import('../shared/projection-content-insets').ProjectionContentInsetsByCategory> =>
    ipcRenderer.invoke('orion:get-projection-content-insets'),
  setProjectionContentInsets: (
    insets: import('../shared/projection-content-insets').ProjectionContentInsetsByCategory
  ): Promise<import('../shared/projection-content-insets').ProjectionContentInsetsByCategory> =>
    ipcRenderer.invoke('orion:set-projection-content-insets', insets),
  setHymnTypography: (
    value: import('../shared/projection-typography').ProjectionTypography
  ): Promise<import('../shared/projection-typography').ProjectionTypography> =>
    ipcRenderer.invoke('orion:set-hymn-typography', value),
  getPaths: (): Promise<OrionPaths> => ipcRenderer.invoke('orion:get-paths'),
  setProjection: (payload: OrionProjectionPayload, displayIds: number[]): Promise<void> =>
    ipcRenderer.invoke('orion:set-projection', payload, displayIds),
  runProjectionCommand: (
    command: OrionProjectionCommand,
    displayIds: number[]
  ): Promise<PresentationUiState> =>
    ipcRenderer.invoke('orion:projection-command', command, displayIds),
  getPresentationUiState: (): Promise<PresentationUiState> =>
    ipcRenderer.invoke('orion:get-presentation-ui-state'),
  listDisplays: (): Promise<OrionDisplayInfo[]> => ipcRenderer.invoke('orion:list-displays'),
  onDisplaysChanged: (callback: (displays: OrionDisplayInfo[]) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, displays: OrionDisplayInfo[]): void => {
      callback(displays)
    }
    ipcRenderer.on('orion:displays-changed', listener)
    return () => {
      ipcRenderer.removeListener('orion:displays-changed', listener)
    }
  },
  onProjectionSessionEnded: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback()
    }
    ipcRenderer.on('orion:projection-session-ended', listener)
    return () => {
      ipcRenderer.removeListener('orion:projection-session-ended', listener)
    }
  },
  onPresentationUiStateChanged: (
    callback: (state: PresentationUiState) => void
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: PresentationUiState): void => {
      callback(state)
    }
    ipcRenderer.on('orion:presentation-ui-state', listener)
    return () => {
      ipcRenderer.removeListener('orion:presentation-ui-state', listener)
    }
  },
  onOutputPreviewFrame: (
    callback: (frame: { displayId: number; dataUrl: string }) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      frame: { displayId: number; dataUrl: string }
    ): void => {
      callback(frame)
    }
    ipcRenderer.on('orion:output-preview-frame', listener)
    return () => {
      ipcRenderer.removeListener('orion:output-preview-frame', listener)
    }
  },
  onOutputPreviewClear: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback()
    }
    ipcRenderer.on('orion:output-preview-clear', listener)
    return () => {
      ipcRenderer.removeListener('orion:output-preview-clear', listener)
    }
  },
  setMainWindowMaximized: (maximized: boolean): Promise<void> =>
    ipcRenderer.invoke('orion:set-main-window-maximized', maximized),
  exportProfileFile: (json: string, suggestedName: string): Promise<string | null> =>
    ipcRenderer.invoke('orion:export-profile-file', json, suggestedName),
  importProfileFile: (): Promise<string | null> => ipcRenderer.invoke('orion:import-profile-file'),
  exportSequenceFile: (json: string, suggestedName: string, bundleContent?: boolean): Promise<string | null> =>
    ipcRenderer.invoke('orion:export-sequence-file', json, suggestedName, bundleContent),
  importSequenceFile: (): Promise<string | null> => ipcRenderer.invoke('orion:import-sequence-file'),
  listPresentationDecks: (): Promise<
    import('../shared/presentation-deck-types').PresentationDeckSummary[]
  > => ipcRenderer.invoke('orion:list-presentation-decks'),
  getPresentationDeck: (
    deckId: string
  ): Promise<import('../shared/presentation-deck-types').PresentationDeckDetail | null> =>
    ipcRenderer.invoke('orion:get-presentation-deck', deckId),
  importPresentationDeck: (): Promise<
    import('../shared/presentation-deck-types').PresentationImportResult
  > => ipcRenderer.invoke('orion:import-presentation-deck'),
  readPresentationDeckSource: (
    deckId: string
  ): Promise<{ bytes: Uint8Array; mediaDir: string; mediaFiles: string[] } | null> =>
    ipcRenderer.invoke('orion:read-presentation-deck-source', deckId),
  rasterizeMetafiles: (payloads: string[]): Promise<(string | null)[]> =>
    ipcRenderer.invoke('orion:rasterize-metafiles', payloads),
  removePresentationDeck: (deckId: string): Promise<boolean> =>
    ipcRenderer.invoke('orion:remove-presentation-deck', deckId),
  getPresentationImportDepsStatus: (): Promise<
    import('../shared/presentation-import-deps').PresentationImportDepsStatus
  > => ipcRenderer.invoke('orion:get-presentation-import-deps-status'),
  downloadPresentationImportDeps: (): Promise<{ ok: true } | { ok: false; message: string }> =>
    ipcRenderer.invoke('orion:download-presentation-import-deps'),
  cancelPresentationImportDepsDownload: (): Promise<void> =>
    ipcRenderer.invoke('orion:cancel-presentation-import-deps-download'),
  onPresentationImportDepsProgress: (
    callback: (progress: import('../shared/presentation-import-deps').PresentationImportDepsProgress) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      progress: import('../shared/presentation-import-deps').PresentationImportDepsProgress
    ): void => {
      callback(progress)
    }
    ipcRenderer.on('orion:presentation-import-deps-progress', listener)
    return () => {
      ipcRenderer.removeListener('orion:presentation-import-deps-progress', listener)
    }
  },
  onPresentationImportProgress: (
    callback: (progress: import('../shared/presentation-deck-types').PresentationImportProgress) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      progress: import('../shared/presentation-deck-types').PresentationImportProgress
    ): void => {
      callback(progress)
    }
    ipcRenderer.on('orion:presentation-import-progress', listener)
    return () => {
      ipcRenderer.removeListener('orion:presentation-import-progress', listener)
    }
  },
  openPresenterView: (deckId: string, slideIndex: number): Promise<void> =>
    ipcRenderer.invoke('orion:open-presenter-view', deckId, slideIndex),
  closePresenterView: (): Promise<void> => ipcRenderer.invoke('orion:close-presenter-view'),
  isPresenterViewOpen: (): Promise<boolean> => ipcRenderer.invoke('orion:is-presenter-view-open'),
  syncPresenterSlideFromMain: (deckId: string | null, slideIndex: number): Promise<void> =>
    ipcRenderer.invoke('orion:sync-presenter-slide-from-main', deckId, slideIndex),
  syncDeckMedia: (command: {
    action: 'play' | 'pause' | 'seek'
    index: number
    time: number
    epoch: number
  }): void => {
    ipcRenderer.send('orion:deck-media-transport', command)
  },
  syncLibraryMedia: (command: { action: 'play' | 'pause' | 'seek'; time: number; epoch: number }): void => {
    ipcRenderer.send('orion:library-media-transport', command)
  },
  syncWebMedia: (command: {
    time: number
    paused: boolean
    rate: number
    fullscreen: boolean
    captions: boolean
    epoch: number
  }): void => {
    ipcRenderer.send('orion:web-media-transport', command)
  },
  setGuestAudioMuted: (webContentsId: number, muted: boolean): void => {
    ipcRenderer.send('orion:set-guest-audio-muted', { webContentsId, muted })
  },
  onPresenterSlideFromWindow: (
    callback: (payload: { deckId: string | null; slideIndex: number }) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { deckId: string | null; slideIndex: number }
    ): void => {
      callback(payload)
    }
    ipcRenderer.on('orion:presenter-slide-from-window', listener)
    return () => {
      ipcRenderer.removeListener('orion:presenter-slide-from-window', listener)
    }
  }
}

contextBridge.exposeInMainWorld('orion', api)

export type OrionApi = typeof api
