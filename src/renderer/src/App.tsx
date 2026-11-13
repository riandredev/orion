import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { OrderFolderImage, OrderFolderInfo } from './env'
import type { OrionDisplayInfo } from '../../shared/displays'
import { type SettingsSection, type WorkspaceTab } from './navigation'
import type { FolderPlaybackSettings } from './types/image-block'
import { BibleWorkspace } from './components/BibleWorkspace'
import { DictionaryWorkspace } from './components/DictionaryWorkspace'
import { HymnsWorkspace } from './components/HymnsWorkspace'
import type { BibleTabRibbonProps } from './components/BibleTabRibbon'
import type { DictionaryTabRibbonProps } from './components/DictionaryTabRibbon'
import type { HymnsTabRibbonProps } from './components/HymnsTabRibbon'
import { type PresentationTabRibbonProps } from './components/PresentationTabRibbon'
import { PresentationWorkspace } from './components/PresentationWorkspace'
import { MediaWorkspace } from './components/MediaWorkspace'
import { projectedFrame } from './components/PresentationStage'
import { blurShortcutTarget, clearRestoredDialogFocus } from './lib/focus'
import {
  forgetLiveSession,
  loadDeckBytes,
  loadLiveSession,
  presentationStepCount,
  rememberSession,
  warmLiveDeck
} from './lib/live-deck'
import { OrderKanbanBoard } from './components/OrderKanbanBoard'
import { WebWorkspace, type WebViewControls } from './components/WebWorkspace'
import type { WebTabRibbonProps } from './components/WebTabRibbon'
import {
  getBibleLiveContent,
  setBibleActivePassage,
  setBibleLiveContent,
  useBibleLiveContent,
  type BibleLiveContent
} from './lib/bible-ribbon-sync'
import {
  getDictionaryLiveContent,
  setDictionaryLiveContent,
  useDictionaryLiveContent,
  type DictionaryLiveContent
} from './lib/dictionary-ribbon-sync'
import { patchDictionaryWorkspaceSession } from './lib/dictionary-workspace-session'
import { getBibleRibbonActions } from './lib/bible-ribbon-actions'
import { getDictionaryRibbonActions, setDictionaryOutputActions } from './lib/dictionary-ribbon-actions'
import { getHymnsRibbonActions } from './lib/hymns-ribbon-actions'
import { requestMediaSequenceCue } from './lib/media-sequence-cue'
import { loadPlaybackSettings } from './lib/playback-settings'
import {
  getHymnLiveContent,
  setHymnActiveLabel,
  setHymnLiveContent,
  useHymnLiveContent,
  type HymnLiveContent
} from './lib/hymns-ribbon-sync'
import { formatStrongsDisplay, buildDictionaryProjectionInfoBar } from '../../shared/dictionary-lexicon'
import { hymnProjectionCornerLabel } from '../../shared/hymn-projection-display'
import { bibleMotionForProjection, getBibleMotion } from './lib/bible-motion'
import { loadOrderFolderPlayback, saveOrderFolderPlayback } from './lib/order-folder-playback'
import { getHymnMotion, hymnMotionForProjection } from './lib/hymn-motion'
import {
  resolveCategoryBackground,
  setBackgroundImagesRoot,
  useBackgroundSettings,
  type ResolvedBackgroundStyle
} from './lib/background-settings'
import { resolveBibleBackground, useBibleBookBackgrounds } from './lib/bible-book-backgrounds'
import { getBibleBlockLayout, useBibleBlockLayout } from './lib/bible-block-layout-settings'
import { getDictionaryBlockLayout, getHymnBlockLayout, useDictionaryBlockLayout, useHymnBlockLayout } from './lib/category-block-layout'
import {
  getProjectionContentInsetsByCategory,
  pushProjectionContentInsetsToMain
} from './lib/projection-content-insets-settings'
import { pushHymnTypographyToMain } from './lib/projection-typography-settings'
import { applyActiveProfileOnLaunch, persistActiveProfileSnapshot } from './lib/orion-profiles'
import { touchProfileSettings } from './lib/profile-autosave'
import {
  fetchPresentationDeck,
  fetchPresentationDecks,
  importPresentationDeck,
  removePresentationDeck,
  subscribePresentationImportProgress
} from './lib/presentation-deck-api'
import {
  cancelPresentationImportDepsDownload,
  downloadPresentationImportDeps,
  fetchPresentationImportDepsStatus,
  subscribePresentationImportDepsProgress
} from './lib/presentation-import-deps-api'
import {
  closePresenterView,
  openPresenterView,
  subscribePresentationStepFromPresenter,
  subscribePresenterSlideFromWindow,
  syncPresenterSlideFromMain
} from './lib/presenter-view-api'
import { setPresentationRibbonState } from './lib/presentation-ribbon-sync'
import type {
  PresentationDeckDetail,
  PresentationDeckSummary,
  PresentationImportProgress
} from '../../shared/presentation-deck-types'
import type {
  PresentationImportDepsProgress,
  PresentationImportDepsStatus
} from '../../shared/presentation-import-deps'
import { projectionDisplayIds, projectionTargetsFromDisplays } from './lib/display-projection'
import {
  clearPresentationLayer,
  clearProjection,
  emptyPresentationUiState,
  fetchPresentationUiState,
  operatorLiveFlags,
  optimisticProgramPatch,
  presentBibleLayer,
  presentDictionaryLayer,
  presentHymnLayer,
  presentDeckSlide,
  presentMediaFile,
  presentOrderLayer,
  presentPresentationImage,
  sendToProjection
} from './lib/projection'
import type { PresentationUiState } from '../../shared/presentation-ui-state'
import { orderImageAnimations, type OrionStackLayerContent } from '../../shared/projection-stack'
import {
  loadLastWebUrl,
  normalizeWebUrl,
  saveLastWebUrl,
  webUrlLabel
} from './lib/web-url'
import {
  applyFolderOrder,
  loadColumnOrder,
  reorderFolderRelative,
  saveColumnOrder,
  folderOrderSignature
} from './lib/column-order'
import {
  settingsForFolder,
  type OrderBlockRibbonProps,
  type OrderLibraryView,
  type OrderThumbSize
} from './components/OrderBlockRibbon'
import {
  ProjectorPanel,
  type OutputPreview,
  type OutputPreviewMotion
} from './components/ProjectorPanel'
import { ShortcutSheet } from './components/ShortcutSheet'
import { TopBar } from './components/TopBar'
import { LibraryUpdateToast } from './components/LibraryUpdateToast'
import { loadLibrarySettings } from './lib/library-settings'
import { SettingsDialog } from './components/SettingsDialog'
import { SequencePanel } from './components/SequencePanel'
import {
  moveSequenceCursor,
  parseServiceSequence,
  serializeServiceSequence,
  type SequenceCursor,
  type ServiceSequenceItem
} from '../../shared/service-sequence'
import { materializeSequenceDraft, withSequenceId } from './lib/sequence-materialize'
import {
  requestBibleSequenceCue,
  requestHymnSequenceCue,
  sequenceFollowsKeys,
  setSequenceFollowKeys
} from './lib/sequence-cues'
import type { SequenceDropBody } from './lib/sequence-drag'
import { setSequenceInbox } from './lib/sequence-inbox'
import { loadSequenceBundleContent } from './lib/sequence-bundle-setting'
import { currentBibleSequenceDraft } from './lib/sequence-sources'

function filePathToUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
  return `file:///${normalized.replace(/^\//, '')}`
}

function sequenceCursorForOutput(
  wire: {
    type?: string
    filePath?: string
    number?: number
    title?: string
    lines?: string[]
    reference?: string
    strongs?: string
  } | null
  | undefined,
  items: ServiceSequenceItem[],
  fromIndex: number
): SequenceCursor | null {
  if (!wire?.type) return null
  const at = (index: number): SequenceCursor | null => {
    const item = items[index]
    if (!item) return null
    if (wire.type === 'image' && item.kind === 'order-image' && item.path === wire.filePath) {
      return { itemIndex: index, stepIndex: 0 }
    }
    if (wire.type === 'hymn' && item.kind === 'hymn' && item.number === wire.number && item.title === wire.title) {
      const lines = (wire.lines ?? []).join('\n')
      const stepIndex = item.steps.findIndex((step) => step.lines.join('\n') === lines)
      return { itemIndex: index, stepIndex: stepIndex >= 0 ? stepIndex : 0 }
    }
    if (wire.type === 'bible' && item.kind === 'bible' && item.reference === wire.reference) {
      return { itemIndex: index, stepIndex: 0 }
    }
    if (wire.type === 'dictionary' && item.kind === 'dictionary' && item.strongs === wire.strongs) {
      return { itemIndex: index, stepIndex: 0 }
    }
    if (wire.type === 'media' && item.kind === 'media' && item.path === wire.filePath) {
      return { itemIndex: index, stepIndex: 0 }
    }
    return null
  }
  const start = Math.min(Math.max(fromIndex, 0), Math.max(0, items.length - 1))
  for (let index = start; index >= 0; index -= 1) {
    const cursor = at(index)
    if (cursor) return cursor
  }
  for (let index = start + 1; index < items.length; index += 1) {
    const cursor = at(index)
    if (cursor) return cursor
  }
  return null
}

function trimDefinitionForProjection(text: string, maxLen = 520): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLen) return trimmed
  const cut = trimmed.slice(0, maxLen)
  const para = cut.lastIndexOf('\n\n')
  const sentence = cut.lastIndexOf('. ')
  const breakAt = Math.max(para, sentence)
  if (breakAt > maxLen * 0.4) {
    return cut.slice(0, breakAt + (sentence === breakAt ? 2 : 0)).trim()
  }
  return `${cut.trim()}…`
}

function stackDictionaryFromContent(
  content: DictionaryLiveContent,
  bg: ResolvedBackgroundStyle = resolveCategoryBackground('dictionary')
): OrionStackLayerContent {
  const definition = trimDefinitionForProjection(content.definition.trim())
  const { segments, activeIndex } = buildDictionaryProjectionInfoBar(content.language, [
    {
      partOfSpeech: content.partOfSpeech,
      transliteration: content.transliteration,
      gloss: content.gloss
    }
  ])
  return {
    type: 'dictionary',
    strongs: formatStrongsDisplay(content.strongs),
    lemma: content.lemma,
    transliteration: content.transliteration,
    gloss: content.gloss,
    partOfSpeech: content.partOfSpeech,
    definition,
    language: content.language,
    infoBar: content.infoBar.length > 0 ? content.infoBar : segments,
    infoBarActive: content.infoBar.length > 0 ? content.infoBarActive : activeIndex,
    backgroundImagePath: bg.imagePath,
    backgroundColor: bg.solidColor,
    backgroundDimOpacity: bg.dimOpacity,
    backgroundDimColor: bg.dimColor,
    backgroundFit: bg.fit,
    blockLayout: getDictionaryBlockLayout()
  }
}

function stackBibleFromContent(
  content: BibleLiveContent,
  bg: ResolvedBackgroundStyle = resolveBibleBackground(content.bookId)
): OrionStackLayerContent {
  const verse =
    content.verses.find((v) => v.number === content.highlightVerse) ?? content.verses[0]
  return {
    type: 'bible',
    reference: content.reference,
    locationLabel: content.locationLabel,
    translationLabel: content.translationLabel,
    verses: verse ? [verse] : [],
    highlightVerse: verse?.number,
    backgroundImagePath: bg.imagePath,
    backgroundColor: bg.solidColor,
    backgroundDimOpacity: bg.dimOpacity,
    backgroundDimColor: bg.dimColor,
    backgroundFit: bg.fit,
    blockLayout: getBibleBlockLayout(),
    ...bibleMotionForProjection()
  }
}

function outputPreviewMotion(
  animation: string | undefined,
  durationMs: number | undefined
): OutputPreviewMotion {
  const named = orderImageAnimations.find((name) => name === animation) ?? 'cut'
  const ms =
    typeof durationMs === 'number' && Number.isFinite(durationMs)
      ? Math.min(5000, Math.max(0, Math.round(durationMs)))
      : 0
  if (named === 'cut' || ms <= 0) return { animation: 'cut', durationMs: 0 }
  return { animation: named, durationMs: ms }
}

function isHymnSlideProjectable(content: HymnLiveContent | null): content is HymnLiveContent {
  if (!content) return false
  return content.slideKind === 'title' || content.slideKind === 'end' || content.lines.length > 0
}

function stackHymnFromContent(
  content: HymnLiveContent,
  bg: ResolvedBackgroundStyle = resolveCategoryBackground('hymns')
): OrionStackLayerContent {
  return {
    type: 'hymn',
    number: content.number,
    title: content.title,
    slideKind: content.slideKind,
    stanzaKind: content.stanzaKind,
    verse: content.verse,
    versePart: content.versePart,
    versePartCount: content.versePartCount,
    lines: content.lines,
    author: content.author?.trim() || undefined,
    backgroundImagePath: bg.imagePath,
    backgroundColor: bg.solidColor,
    backgroundDimOpacity: bg.dimOpacity,
    backgroundDimColor: bg.dimColor,
    backgroundFit: bg.fit,
    blockLayout: getHymnBlockLayout(),
    ...hymnMotionForProjection()
  }
}

const PRESENTATION_DECK_KEY = 'orion-presentation-active-deck'
const SEQUENCE_KEY = 'orion-service-sequence'

function loadStoredSequence(): ServiceSequenceItem[] {
  try {
    return parseServiceSequence(localStorage.getItem(SEQUENCE_KEY))?.items ?? []
  } catch {
    return []
  }
}

function loadStoredPresentationDeckId(): string | null {
  try {
    return localStorage.getItem(PRESENTATION_DECK_KEY)
  } catch {
    return null
  }
}

const ORDER_VIEW_KEY = 'orion-order-view'

const ORDER_THUMB_KEY = 'orion-order-thumb-size'
const ORDER_NAMES_KEY = 'orion-order-show-names'

function loadOrderShowNames(): boolean {
  try {
    return localStorage.getItem(ORDER_NAMES_KEY) !== '0'
  } catch {
    return true
  }
}

function loadOrderThumbSize(): OrderThumbSize {
  try {
    const raw = localStorage.getItem(ORDER_THUMB_KEY)
    if (raw === 's' || raw === 'm' || raw === 'l') return raw
  } catch {
    /* ignore */
  }
  return 'm'
}

const ORDER_VIEW_GRID_DEFAULT = 'orion-order-view-grid-default'

function loadOrderView(): OrderLibraryView {
  try {
    const raw = localStorage.getItem(ORDER_VIEW_KEY)
    if (raw === 'grid' || raw === 'list' || raw === 'columns') {
      if (!localStorage.getItem(ORDER_VIEW_GRID_DEFAULT)) {
        localStorage.setItem(ORDER_VIEW_GRID_DEFAULT, '1')
      }
      return raw
    }
    if (!localStorage.getItem(ORDER_VIEW_GRID_DEFAULT)) {
      localStorage.setItem(ORDER_VIEW_GRID_DEFAULT, '1')
      localStorage.setItem(ORDER_VIEW_KEY, 'grid')
      return 'grid'
    }
  } catch {
    /* ignore */
  }
  return 'grid'
}

function saveStoredPresentationDeckId(id: string | null): void {
  try {
    if (!id) localStorage.removeItem(PRESENTATION_DECK_KEY)
    else localStorage.setItem(PRESENTATION_DECK_KEY, id)
  } catch {
    /* ignore */
  }
  touchProfileSettings()
}

function TabWorkspace({
  tab,
  folders,
  orderImagesPath,
  activeFolderName,
  activeImagePath,
  onSelectFolder,
  onSelectImage,
  onReorderFolders,
  view,
  thumbSize,
  showImageNames,
  onNewFolder,
  onProjectToOutputs,
  onHymnsProjectStanza,
  onHymnsGoLive,
  mediaDisplays,
  mediaLivePath,
  onMediaProjected,
  presentationDecks,
  presentationDeck,
  presentationLoadingDeck,
  presentationDeckId,
  presentationSlideIndex,
  presentationBuildStep,
  onSelectPresentationDeck,
  onSelectPresentationSlide,
  onImportPresentationDeck,
  onRemovePresentationDeck,
  onOpenPresenterView,
  presentationImportBusy,
  presentationImportProgress,
  presentationImportError,
  presentationDepsStatus,
  presentationDepsProgress,
  presentationDepsDownloading,
  onDownloadPresentationDeps,
  onCancelPresentationDepsDownload,
  presentationImportEnabled
}: {
  tab: WorkspaceTab
  folders: OrderFolderInfo[]
  orderImagesPath: string
  activeFolderName: string | null
  activeImagePath: string | null
  onSelectFolder: (name: string) => void
  onSelectImage: (folderName: string, path: string) => void
  onReorderFolders: (fromName: string, targetName: string, position: 'before' | 'after') => void
  view: OrderLibraryView
  thumbSize: OrderThumbSize
  showImageNames: boolean
  onNewFolder: () => void
  onProjectToOutputs: () => void
  onHymnsProjectStanza: () => void
  onHymnsGoLive: () => void
  mediaDisplays: OrionDisplayInfo[]
  mediaLivePath: string | null
  onMediaProjected: (ui: PresentationUiState) => void
  presentationDecks: PresentationDeckSummary[]
  presentationDeck: PresentationDeckDetail | null
  presentationLoadingDeck: boolean
  presentationDeckId: string | null
  presentationSlideIndex: number
  presentationBuildStep: number
  onSelectPresentationDeck: (deckId: string) => void
  onSelectPresentationSlide: (index: number) => void
  onImportPresentationDeck: () => void
  onRemovePresentationDeck: (deckId: string) => void
  onOpenPresenterView: () => void
  presentationImportBusy: boolean
  presentationImportProgress: PresentationImportProgress | null
  presentationImportError: string | null
  presentationDepsStatus: PresentationImportDepsStatus
  presentationDepsProgress: PresentationImportDepsProgress | null
  presentationDepsDownloading: boolean
  onDownloadPresentationDeps: () => void
  onCancelPresentationDepsDownload: () => void
  presentationImportEnabled: boolean
}): ReactElement {
  const [visited, setVisited] = useState<WorkspaceTab[]>(['order'])
  useEffect(() => {
    setVisited((prev) => (prev.includes(tab) ? prev : [...prev, tab]))
  }, [tab])

  const presentationNode = (
    <PresentationWorkspace
      decks={presentationDecks}
      deck={presentationDeck}
      loadingDeck={presentationLoadingDeck}
      activeDeckId={presentationDeckId}
      activeSlideIndex={presentationSlideIndex}
      buildStep={presentationBuildStep}
      onSelectDeck={onSelectPresentationDeck}
      onSelectSlide={onSelectPresentationSlide}
      onRemoveDeck={onRemovePresentationDeck}
      onOpenPresenterView={onOpenPresenterView}
      onImportDeck={onImportPresentationDeck}
      importBusy={presentationImportBusy}
      importProgress={presentationImportProgress}
      importError={presentationImportError}
      depsStatus={presentationDepsStatus}
      depsProgress={presentationDepsProgress}
      depsDownloading={presentationDepsDownloading}
      onDownloadDeps={onDownloadPresentationDeps}
      onCancelDepsDownload={onCancelPresentationDepsDownload}
      importEnabled={presentationImportEnabled}
    />
  )

  const keep = (id: WorkspaceTab, node: ReactElement): ReactElement | null => {
    if (tab !== id && !visited.includes(id)) return null
    const shown = tab === id
    return (
      <div
        key={id}
        className={shown ? 'tab-keep' : 'tab-keep tab-keep--hidden'}
        aria-hidden={shown ? undefined : true}
      >
        {node}
      </div>
    )
  }

  return (
    <>
      {keep(
        'order',
        <OrderKanbanBoard
          folders={folders}
          orderImagesPath={orderImagesPath}
          activeFolderName={activeFolderName}
          activeImagePath={activeImagePath}
          onSelectFolder={onSelectFolder}
          onSelectImage={onSelectImage}
          onReorderFolders={onReorderFolders}
          view={view}
          thumbSize={thumbSize}
          showImageNames={showImageNames}
          onNewFolder={onNewFolder}
          onImportImages={async (folderName) => {
            const result = await window.orion.importOrderImages(folderName)
            if (result.ok && result.added > 0) await reloadOrderLibrary(folderName)
          }}
        />
      )}
      {keep('bible', <BibleWorkspace onProjectToOutputs={onProjectToOutputs} />)}
      {keep('dictionary', <DictionaryWorkspace />)}
      {keep(
        'hymns',
        <HymnsWorkspace onProjectStanza={onHymnsProjectStanza} onGoLive={onHymnsGoLive} />
      )}
      {keep('presentation', presentationNode)}
      {keep(
        'media',
        <MediaWorkspace displays={mediaDisplays} livePath={mediaLivePath} onProjected={onMediaProjected} />
      )}
    </>
  )
}

export default function App(): ReactElement {
  const [tab, setTab] = useState<WorkspaceTab>('order')
  const [webSeen, setWebSeen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [libraryUpdates, setLibraryUpdates] = useState(0)
  const [libraryAutoProgress, setLibraryAutoProgress] = useState<number | null>(null)
  const [libraryAutoFailed, setLibraryAutoFailed] = useState(false)
  const [libraryAutoUpdate, setLibraryAutoUpdate] = useState(() => loadLibrarySettings().autoUpdate)
  const libraryAutoStarted = useRef(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('displays')
  const [sequenceOpen, setSequenceOpen] = useState(true)
  const [projectorOpen, setProjectorOpen] = useState(true)
  const [folders, setFolders] = useState<OrderFolderInfo[]>([])
  const [orderImagesPath, setOrderImagesPath] = useState('')
  const [folderImagesMap, setFolderImagesMap] = useState<Record<string, OrderFolderImage[]>>({})
  const [activeFolderName, setActiveFolderName] = useState<string | null>(null)
  const [browseFolderName, setBrowseFolderName] = useState<string | null>(null)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [orderView, setOrderView] = useState<OrderLibraryView>(loadOrderView)
  const [orderThumbSize, setOrderThumbSize] = useState<OrderThumbSize>(loadOrderThumbSize)
  const [orderShowNames, setOrderShowNames] = useState(loadOrderShowNames)
  const [newFolderSignal, setNewFolderSignal] = useState(0)
  const [program, setProgram] = useState<PresentationUiState>(() => emptyPresentationUiState())
  const liveFlags = operatorLiveFlags(program)
  const outputLive = liveFlags.order
  const mediaOnStage = program.stage?.base?.type === 'media' || program.stage?.overlay?.type === 'media'
  const presentationOutputLive = liveFlags.presentation && !mediaOnStage
  const mediaOutputPath =
    program.stage?.overlay?.type === 'media'
      ? program.stage.overlay.filePath
      : program.stage?.base?.type === 'media'
        ? program.stage.base.filePath
        : null
  const bibleLive = liveFlags.bible
  const dictionaryLive = liveFlags.dictionary
  const hymnsLive = liveFlags.hymns
  const [connectedDisplays, setConnectedDisplays] = useState<OrionDisplayInfo[]>([])
  const [folderSettings, setFolderSettings] = useState<Record<string, FolderPlaybackSettings>>(
    loadOrderFolderPlayback
  )
  const [sequenceItems, setSequenceItems] = useState<ServiceSequenceItem[]>(loadStoredSequence)
  const [sequenceCursor, setSequenceCursor] = useState<SequenceCursor>({ itemIndex: 0, stepIndex: 0 })
  const [sequenceFollow, setSequenceFollow] = useState(false)
  const toggleOrderOutputRef = useRef<() => void>(() => {})
  const goOrderLiveRef = useRef<() => void>(() => {})
  const sequenceCursorRef = useRef(sequenceCursor)
  sequenceCursorRef.current = sequenceCursor
  const sequenceDriveRef = useRef(false)
  const followOutputRef = useRef<(wire: Parameters<typeof sequenceCursorForOutput>[0]) => void>(() => {})
  const skipSequenceWrite = useRef(false)
  const [outputCaptureFrames, setOutputCaptureFrames] = useState<Record<string, string>>({})

  useEffect(() => {
    const onDialogClose = (event: Event): void => {
      if (!(event.target instanceof HTMLDialogElement)) return
      clearRestoredDialogFocus()
    }
    document.addEventListener('close', onDialogClose, true)
    return () => document.removeEventListener('close', onDialogClose, true)
  }, [])

  const [webUrlInput, setWebUrlInput] = useState(loadLastWebUrl)
  const [webPageUrl, setWebPageUrl] = useState<string | null>(null)
  const [webPageTitle, setWebPageTitle] = useState('')
  const [webCanGoBack, setWebCanGoBack] = useState(false)
  const [webCanGoForward, setWebCanGoForward] = useState(false)
  const [webLive, setWebLive] = useState(false)
  const [webLiveUrl, setWebLiveUrl] = useState<string | null>(null)
  const webControlsRef = useRef<WebViewControls | null>(null)
  const [presentationDecks, setPresentationDecks] = useState<PresentationDeckSummary[]>([])
  const [presentationDeckId, setPresentationDeckId] = useState<string | null>(() =>
    loadStoredPresentationDeckId()
  )
  const [presentationDeck, setPresentationDeck] = useState<PresentationDeckDetail | null>(null)
  const [presentationSlideIndex, setPresentationSlideIndex] = useState(0)
  const [presentationBuildStep, setPresentationBuildStep] = useState(0)
  const [presentationLoadingDeck, setPresentationLoadingDeck] = useState(false)
  const [presentationImportBusy, setPresentationImportBusy] = useState(false)
  const [presentationImportProgress, setPresentationImportProgress] =
    useState<PresentationImportProgress | null>(null)
  const [presentationImportError, setPresentationImportError] = useState<string | null>(null)
  const [presentationDepsStatus, setPresentationDepsStatus] = useState<PresentationImportDepsStatus>(
    {
      ready: false,
      onDemandAvailable: false,
      bundled: false
    }
  )
  const [presentationDepsProgress, setPresentationDepsProgress] =
    useState<PresentationImportDepsProgress | null>(null)
  const [presentationDepsDownloading, setPresentationDepsDownloading] = useState(false)
  const bibleLiveContent = useBibleLiveContent()
  const bibleLayout = useBibleBlockLayout()
  const hymnLayout = useHymnBlockLayout()
  const dictionaryLayout = useDictionaryBlockLayout()
  const bibleBookBackgrounds = useBibleBookBackgrounds()
  const dictionaryLiveContent = useDictionaryLiveContent()
  const hymnLiveContent = useHymnLiveContent()
  const backgroundSettings = useBackgroundSettings()
  const bibleBgStyle = useMemo(
    () => resolveBibleBackground(bibleLiveContent?.bookId, backgroundSettings),
    [backgroundSettings, bibleLiveContent?.bookId, bibleBookBackgrounds]
  )
  const dictionaryBgStyle = useMemo(
    () => resolveCategoryBackground('dictionary', backgroundSettings),
    [backgroundSettings]
  )
  const hymnsBgStyle = useMemo(
    () => resolveCategoryBackground('hymns', backgroundSettings),
    [backgroundSettings]
  )

  const applyProgram = useCallback((ui: PresentationUiState) => {
    setProgram(ui)
  }, [])

  const refreshProgram = useCallback(async () => {
    const ui = await fetchPresentationUiState()
    setProgram(ui)
  }, [])

  const onWebControlsReady = useCallback((controls: WebViewControls | null) => {
    webControlsRef.current = controls
  }, [])

  const onWebPageUrlChange = useCallback((url: string) => {
    setWebPageUrl(url)
    setWebUrlInput(url)
  }, [])

  const onWebTitleChange = useCallback((title: string) => {
    setWebPageTitle(title)
  }, [])

  const onWebNavigationStateChange = useCallback((back: boolean, forward: boolean) => {
    setWebCanGoBack(back)
    setWebCanGoForward(forward)
  }, [])

  const loadWebPage = useCallback(() => {
    const normalized = normalizeWebUrl(webUrlInput)
    if (!normalized) return
    saveLastWebUrl(normalized)
    setWebUrlInput(normalized)
    setWebPageUrl(normalized)
  }, [webUrlInput])

  const reloadWebPage = useCallback(() => {
    webControlsRef.current?.reload()
  }, [])

  const webGoBack = useCallback(() => {
    webControlsRef.current?.goBack()
  }, [])

  const webGoForward = useCallback(() => {
    webControlsRef.current?.goForward()
  }, [])

  const clearWebPage = useCallback(() => {
    setWebPageUrl(null)
    setWebPageTitle('')
    setWebCanGoBack(false)
    setWebCanGoForward(false)
    setWebLive(false)
    setWebLiveUrl(null)
    void clearProjection()
  }, [])

  const goWebLive = useCallback(async () => {
    if (!webPageUrl) return
    setWebLive(true)
    setWebLiveUrl(webPageUrl)
    const ok = await sendToProjection({ type: 'web', url: webPageUrl }, connectedDisplays)
    if (!ok) {
      setWebLive(false)
      setWebLiveUrl(null)
      return
    }
    setProgram(emptyPresentationUiState())
  }, [webPageUrl, connectedDisplays])

  useEffect(() => {
    void window.orion.listDisplays().then(setConnectedDisplays)
    return window.orion.onDisplaysChanged(setConnectedDisplays)
  }, [])

  useEffect(() => {
    applyActiveProfileOnLaunch()
    void pushProjectionContentInsetsToMain(getProjectionContentInsetsByCategory())
    void pushHymnTypographyToMain()
  }, [])

  useEffect(() => {
    const onUnload = (): void => {
      persistActiveProfileSnapshot()
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  useEffect(() => {
    void refreshProgram()
    if (typeof window.orion?.onPresentationUiStateChanged !== 'function') {
      return
    }
    return window.orion.onPresentationUiStateChanged((ui) => {
      applyProgram(ui)
    })
  }, [applyProgram, refreshProgram])

  useEffect(() => {
    if (typeof window.orion?.onProjectionSessionEnded !== 'function') {
      return
    }
    return window.orion.onProjectionSessionEnded(() => {
      void refreshProgram()
      setWebLive(false)
      setWebLiveUrl(null)
      setOutputCaptureFrames({})
    })
  }, [refreshProgram])

  useEffect(() => {
    window.orion?.setOutputPreviewOpen?.(projectorOpen)
  }, [projectorOpen])

  useEffect(() => {
    const offFrame =
      typeof window.orion?.onOutputPreviewFrame === 'function'
        ? window.orion.onOutputPreviewFrame(({ displayId, dataUrl }) => {
            setOutputCaptureFrames((prev) => ({ ...prev, [String(displayId)]: dataUrl }))
          })
        : undefined
    const offClear =
      typeof window.orion?.onOutputPreviewClear === 'function'
        ? window.orion.onOutputPreviewClear(() => {
            setOutputCaptureFrames({})
          })
        : undefined
    return () => {
      offFrame?.()
      offClear?.()
    }
  }, [])

  const browsingFolder = browseFolderName ?? activeFolderName
  const activeImages = activeFolderName ? (folderImagesMap[activeFolderName] ?? []) : []
  const activeImage = activeImages[activeImageIndex] ?? null
  const activeSettings = settingsForFolder(folderSettings, activeFolderName)
  const presentationSlide =
    presentationDeck?.slides[presentationSlideIndex] ?? null
  const presentationSlidePath = presentationSlide?.path ?? null

  const reloadOrderLibrary = useCallback(async (selectFolder?: string) => {
    const list = await window.orion.listOrderFolders()
    const ordered = applyFolderOrder(list, loadColumnOrder())
    setFolders(ordered)
    const map: Record<string, OrderFolderImage[]> = {}
    for (const folder of ordered) {
      map[folder.name] = await window.orion.listOrderFolderImages(folder.name)
    }
    setFolderImagesMap(map)
    if (selectFolder && ordered.some((folder) => folder.name === selectFolder)) {
      setBrowseFolderName(selectFolder)
      setActiveFolderName(selectFolder)
      setActiveImageIndex(0)
      setPlaying(false)
      return
    }
    setActiveFolderName((current) => {
      if (current && ordered.some((folder) => folder.name === current)) return current
      return ordered[0]?.name ?? null
    })
    setBrowseFolderName((current) => {
      if (current && ordered.some((folder) => folder.name === current)) return current
      return null
    })
  }, [])

  useEffect(() => {
    void (async () => {
      const p = await window.orion.getPaths()
      setBackgroundImagesRoot(p.images)
      setOrderImagesPath(p.orderImages)
      await reloadOrderLibrary()
    })()
  }, [reloadOrderLibrary])

  useEffect(() => {
    const onProfile = (): void => {
      skipSequenceWrite.current = true
      setSequenceItems(loadStoredSequence())
      setOrderView(loadOrderView())
      setOrderThumbSize(loadOrderThumbSize())
      setOrderShowNames(loadOrderShowNames())
      setPresentationDeckId(loadStoredPresentationDeckId())
      setWebUrlInput(loadLastWebUrl())
      setFolderSettings(loadOrderFolderPlayback())
      void reloadOrderLibrary()
    }
    window.addEventListener('orion-profile-applied', onProfile)
    return () => window.removeEventListener('orion-profile-applied', onProfile)
  }, [reloadOrderLibrary])

  useEffect(() => {
    const apply = (list: { updates: number }): void => setLibraryUpdates(list.updates)
    const load = (): void => {
      void window.orion.listLibraries().then(apply).catch(() => undefined)
    }
    const onLibraries = (): void => {
      load()
      void reloadOrderLibrary()
    }
    const onLibrarySettings = (): void => setLibraryAutoUpdate(loadLibrarySettings().autoUpdate)
    const stopList = window.orion.onLibrariesList(apply)
    load()
    window.addEventListener('orion-libraries-changed', onLibraries)
    window.addEventListener('orion-library-settings', onLibrarySettings)
    window.addEventListener('orion-profile-applied', onLibrarySettings)
    return () => {
      stopList()
      window.removeEventListener('orion-libraries-changed', onLibraries)
      window.removeEventListener('orion-library-settings', onLibrarySettings)
      window.removeEventListener('orion-profile-applied', onLibrarySettings)
    }
  }, [reloadOrderLibrary])

  useEffect(() => {
    if (!libraryAutoUpdate || libraryUpdates <= 0 || libraryAutoStarted.current) return
    libraryAutoStarted.current = true
    let stopped = false
    const stopProgress = window.orion.onLibraryProgress((progress) => {
      if (!stopped) setLibraryAutoProgress(progress.percent)
    })
    void (async () => {
      try {
        const list = await window.orion.listLibraries()
        const pending = list.libraries.filter((row) => row.status === 'update')
        for (const row of pending) {
          setLibraryAutoProgress(0)
          const result = await window.orion.installLibrary(row.id)
          if (!result.ok) {
            setLibraryAutoFailed(true)
            break
          }
        }
      } finally {
        stopped = true
        stopProgress()
        setLibraryAutoProgress(null)
        window.dispatchEvent(new CustomEvent('orion-libraries-changed'))
      }
    })()
  }, [libraryAutoUpdate, libraryUpdates])

  useEffect(() => {
    void fetchPresentationDecks().then((list) => {
      setPresentationDecks(list)
      setPresentationDeckId((current) => {
        if (current && list.some((d) => d.id === current)) return current
        return list[0]?.id ?? null
      })
    })
  }, [])

  useEffect(() => {
    if (!presentationDeckId) {
      setPresentationDeck(null)
      setPresentationRibbonState({ deckTitle: 'No deck open', slideIndex: 0, slideTotal: 0 })
      return
    }
    let cancelled = false
    setPresentationLoadingDeck(true)
    void fetchPresentationDeck(presentationDeckId).then((detail) => {
      if (cancelled) return
      setPresentationDeck(detail)
      setPresentationLoadingDeck(false)
      if (detail?.engine === 'live' && detail.sourcePath) {
        void loadDeckBytes(detail.id, () => window.orion.readPresentationDeckSource(detail.id)).then(
          (source) => {
            if (cancelled || !source) return
            warmLiveDeck(
              detail.id,
              { ...source, ext: detail.sourceExt, cues: detail.cues },
              presentationSlideIndex
            )
          }
        )
      }
      if (detail) {
        saveStoredPresentationDeckId(detail.id)
        setPresentationSlideIndex((idx) =>
          Math.min(Math.max(0, idx), Math.max(0, detail.slides.length - 1))
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [presentationDeckId])

  useEffect(() => {
    if (!presentationDeck) return
    setPresentationRibbonState({
      deckTitle: presentationDeck.title,
      slideIndex: presentationSlideIndex,
      slideTotal: presentationDeck.slides.length
    })
  }, [presentationDeck, presentationSlideIndex])

  const refreshPresentationDepsStatus = useCallback(async () => {
    const status = await fetchPresentationImportDepsStatus()
    setPresentationDepsStatus(status)
  }, [])

  useEffect(() => {
    void refreshPresentationDepsStatus()
    const off = subscribePresentationImportDepsProgress((progress) => {
      setPresentationDepsProgress(progress)
      if (
        progress.phase === 'downloading' ||
        progress.phase === 'installing' ||
        progress.phase === 'extracting' ||
        progress.phase === 'pruning' ||
        progress.phase === 'verifying'
      ) {
        setPresentationDepsDownloading(true)
      }
      if (progress.phase === 'ready' || progress.phase === 'idle' || progress.phase === 'error') {
        setPresentationDepsDownloading(false)
      }
      if (progress.phase === 'ready') {
        void refreshPresentationDepsStatus()
      }
    })
    return off
  }, [refreshPresentationDepsStatus])

  useEffect(() => {
    const off = subscribePresentationImportProgress((progress) => {
      setPresentationImportProgress(progress)
    })
    return off
  }, [])

  useEffect(() => {
    const off = subscribePresenterSlideFromWindow(({ deckId, slideIndex }) => {
      if (deckId && deckId === presentationDeckId) {
        setPresentationBuildStep(0)
        setPresentationSlideIndex(slideIndex)
      }
    })
    return off
  }, [presentationDeckId])

  useEffect(() => {
    syncPresenterSlideFromMain(presentationDeckId, presentationSlideIndex, presentationBuildStep)
  }, [presentationBuildStep, presentationDeckId, presentationSlideIndex])

  useEffect(() => {
    if (tab === 'web') setWebSeen(true)
  }, [tab])

  useEffect(() => {
    if (tab === 'presentation') {
      void refreshPresentationDepsStatus()
    }
  }, [tab, refreshPresentationDepsStatus])

  const presentationImportEnabled = true

  useEffect(() => {
    if (!outputLive) setPlaying(false)
  }, [outputLive])

  useEffect(() => {
    if (!playing || !outputLive || !activeFolderName || activeImages.length === 0) return
    const intervalMs = Math.max(1, activeSettings.autoScrollSec) * 1000
    const id = window.setInterval(() => {
      setActiveImageIndex((index) => {
        const last = activeImages.length - 1
        if (index >= last) {
          if (!activeSettings.loop) {
            queueMicrotask(() => setPlaying(false))
            return index
          }
          return 0
        }
        return index + 1
      })
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [playing, outputLive, activeFolderName, activeImages.length, activeSettings.autoScrollSec, activeSettings.loop])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (tab !== 'order' || sequenceFollowsKeys()) return
      if (document.querySelector('dialog[open]')) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
        return
      }

      const images = browsingFolder ? (folderImagesMap[browsingFolder] ?? []) : []
      const imageIndex = browsingFolder === activeFolderName ? activeImageIndex : -1

      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        blurShortcutTarget(e.target)
        if (!browsingFolder || images.length === 0) return
        const next =
          e.key === 'ArrowRight'
            ? imageIndex < 0 || imageIndex >= images.length - 1
              ? 0
              : imageIndex + 1
            : imageIndex <= 0
              ? images.length - 1
              : imageIndex - 1
        setBrowseFolderName(browsingFolder)
        setActiveFolderName(browsingFolder)
        setActiveImageIndex(next)
        setPlaying(false)
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        blurShortcutTarget(e.target)
        if (folders.length === 0) return
        const folderCursor = browsingFolder ?? activeFolderName
        const currentIdx = folderCursor
          ? folders.findIndex((f) => f.name === folderCursor)
          : -1
        let nextIdx = currentIdx + (e.key === 'ArrowDown' ? 1 : -1)
        if (nextIdx < 0) nextIdx = folders.length - 1
        if (nextIdx >= folders.length) nextIdx = 0
        const next = folders[nextIdx]
        if (next) {
          setBrowseFolderName(next.name)
          if (!outputLive) {
            setActiveFolderName(next.name)
            setActiveImageIndex(0)
            setPlaying(false)
          }
        }
      } else if (e.key === ' ') {
        e.preventDefault()
        blurShortcutTarget(e.target)
        if (!outputLive) return
        setPlaying((p) => !p)
      } else if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault()
        blurShortcutTarget(e.target)
        toggleOrderOutputRef.current()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        blurShortcutTarget(e.target)
        goOrderLiveRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tab, folders, activeFolderName, browsingFolder, activeImageIndex, folderImagesMap, outputLive])

  function selectFolder(name: string): void {
    setBrowseFolderName(name)
    if (outputLive) return
    setActiveFolderName(name)
    setActiveImageIndex(0)
    setPlaying(false)
  }

  function selectImage(folderName: string, path: string): void {
    setBrowseFolderName(folderName)
    setActiveFolderName(folderName)
    const images = folderImagesMap[folderName] ?? []
    const idx = images.findIndex((img) => img.path === path)
    setActiveImageIndex(idx >= 0 ? idx : 0)
  }

  const reorderFolders = useCallback(
    (fromName: string, targetName: string, position: 'before' | 'after'): void => {
      setFolders((prev) => {
        const next = reorderFolderRelative(prev, fromName, targetName, position)
        if (folderOrderSignature(next) === folderOrderSignature(prev)) return prev
        saveColumnOrder(next.map((f) => f.name))
        return next
      })
    },
    []
  )

  function goPrevImage(): void {
    if (activeImages.length === 0) return
    setActiveImageIndex((i) => (i <= 0 ? activeImages.length - 1 : i - 1))
  }

  function goNextImage(): void {
    if (activeImages.length === 0) return
    setActiveImageIndex((i) => (i >= activeImages.length - 1 ? 0 : i + 1))
  }

  function patchSettings(patch: Partial<FolderPlaybackSettings>): void {
    if (!activeFolderName) return
    setFolderSettings((prev) => {
      const next = {
        ...prev,
        [activeFolderName]: {
          ...settingsForFolder(prev, activeFolderName),
          ...patch
        }
      }
      saveOrderFolderPlayback(next)
      return next
    })
  }

  const goOrderLive = useCallback(async () => {
    if (!activeImage) return
    setWebLive(false)
    setWebLiveUrl(null)
    setProgram((prev) =>
      optimisticProgramPatch(prev, { orderActive: true, outputsOpen: true })
    )
    const ui = await presentOrderLayer(activeImage.path, connectedDisplays, {
      animation: activeSettings.animation,
      durationMs: activeSettings.transitionMs
    })
    applyProgram(ui)
  }, [activeImage, activeSettings.animation, activeSettings.transitionMs, connectedDisplays, applyProgram])

  const stopOrderProjection = useCallback(async () => {
    setProgram((prev) => optimisticProgramPatch(prev, { orderActive: false }))
    const ui = await clearPresentationLayer('order')
    applyProgram(ui)
  }, [applyProgram])

  const stopBibleProjection = useCallback(async () => {
    setProgram((prev) => optimisticProgramPatch(prev, { bibleActive: false }))
    const ui = await clearPresentationLayer('bible')
    applyProgram(ui)
  }, [applyProgram])

  const stopAllProjection = useCallback(async () => {
    setWebLive(false)
    setWebLiveUrl(null)
    setProgram(emptyPresentationUiState())
    try {
      const ui = await clearProjection()
      applyProgram(ui)
    } catch {
      applyProgram(emptyPresentationUiState())
    }
  }, [applyProgram])

  const releaseFrontOutput = useCallback(async () => {
    const stage = program.stage
    const overlay = stage?.overlay
    const base = stage?.base
    if (!overlay || !base) {
      await stopAllProjection()
      return
    }
    const source =
      overlay.type === 'bible' || overlay.type === 'dictionary' || overlay.type === 'hymn'
        ? 'bible'
        : 'presentation'
    const ui = await clearPresentationLayer(source)
    applyProgram(ui)
    followOutputRef.current(ui.stage?.base ?? null)
  }, [applyProgram, program.stage, stopAllProjection])

  const outputOpenRef = useRef(false)
  outputOpenRef.current =
    program.outputsOpen ||
    webLive ||
    outputLive ||
    bibleLive ||
    hymnsLive ||
    dictionaryLive ||
    presentationOutputLive ||
    mediaOnStage

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.repeat || event.defaultPrevented) return
      if (
        document.querySelector(
          'dialog[open], .adw-select__menu, .adw-context-menu, .adw-color-picker__popover, .bible-xref-menu'
        )
      ) {
        return
      }
      if (!outputOpenRef.current) return
      event.preventDefault()
      void releaseFrontOutput()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [releaseFrontOutput])

  const toggleOrderOutput = useCallback(async () => {
    if (outputLive) {
      await stopOrderProjection()
      return
    }
    await goOrderLive()
  }, [outputLive, stopOrderProjection, goOrderLive])
  toggleOrderOutputRef.current = () => {
    void toggleOrderOutput()
  }
  goOrderLiveRef.current = () => {
    void goOrderLive()
  }

  const goBibleLive = useCallback(async () => {
    const content = getBibleLiveContent()
    if (!content || content.verses.length === 0) return
    const layer = stackBibleFromContent(content)
    if (layer.type !== 'bible' || layer.verses.length === 0) return
    setProgram((prev) => optimisticProgramPatch(prev, { bibleActive: true, outputsOpen: true }))
    const ui = await presentBibleLayer(layer, connectedDisplays)
    applyProgram(ui)
  }, [connectedDisplays, applyProgram])

  const toggleBibleOutput = useCallback(async () => {
    if (bibleLive) {
      await stopBibleProjection()
      return
    }
    await goBibleLive()
  }, [bibleLive, stopBibleProjection, goBibleLive])

  const goDictionaryLive = useCallback(async () => {
    const content = getDictionaryLiveContent()
    if (!content?.lemma) return
    const layer = stackDictionaryFromContent(content, dictionaryBgStyle)
    if (layer.type !== 'dictionary') return
    setProgram((prev) => optimisticProgramPatch(prev, { bibleActive: true, outputsOpen: true }))
    const ui = await presentDictionaryLayer(layer, connectedDisplays)
    applyProgram(ui)
  }, [connectedDisplays, applyProgram, dictionaryBgStyle])

  const toggleDictionaryOutput = useCallback(async () => {
    if (dictionaryLive) {
      await stopBibleProjection()
      return
    }
    await goDictionaryLive()
  }, [dictionaryLive, stopBibleProjection, goDictionaryLive])

  useEffect(() => {
    setDictionaryOutputActions({
      project: () => {
        void goDictionaryLive()
      },
      toggle: () => {
        void toggleDictionaryOutput()
      }
    })
  }, [goDictionaryLive, toggleDictionaryOutput])

  const goHymnsLive = useCallback(async () => {
    const content = getHymnLiveContent()
    if (!content || !isHymnSlideProjectable(content)) return
    const layer = stackHymnFromContent(content, hymnsBgStyle)
    if (layer.type !== 'hymn') return
    setProgram((prev) => optimisticProgramPatch(prev, { bibleActive: true, outputsOpen: true }))
    const ui = await presentHymnLayer(layer, connectedDisplays)
    applyProgram(ui)
  }, [connectedDisplays, applyProgram, hymnsBgStyle])

  const stopHymnsProjection = useCallback(async () => {
    setProgram((prev) => optimisticProgramPatch(prev, { bibleActive: false }))
    const ui = await clearPresentationLayer('bible')
    applyProgram(ui)
  }, [applyProgram])

  const toggleHymnsOutput = useCallback(async () => {
    if (hymnsLive) {
      await stopHymnsProjection()
      return
    }
    await goHymnsLive()
  }, [hymnsLive, stopHymnsProjection, goHymnsLive])

  const onHymnsProjectStanza = useCallback(() => {
    void goHymnsLive()
  }, [goHymnsLive])

  const onHymnsGoLive = useCallback(() => {
    void toggleHymnsOutput()
  }, [toggleHymnsOutput])

  const selectPresentationDeck = useCallback((deckId: string) => {
    setPresentationBuildStep(0)
    setPresentationSlideIndex(0)
    setPresentationDeckId(deckId)
    saveStoredPresentationDeckId(deckId)
  }, [])

  const choosePresentationSlide = useCallback((index: number) => {
    setPresentationBuildStep(0)
    setPresentationSlideIndex(index)
  }, [])

  const goPresentationPrev = useCallback(() => {
    if (!presentationDeck || presentationDeck.slides.length === 0) return
    if (presentationDeck.engine === 'live' && presentationDeckId && presentationBuildStep > 0) {
      setPresentationBuildStep((step) => step - 1)
      return
    }
    const count = presentationDeck.slides.length
    const prev = presentationSlideIndex <= 0 ? count - 1 : presentationSlideIndex - 1
    const last =
      presentationDeck.engine === 'live' && presentationDeckId
        ? Math.max(0, presentationStepCount(presentationDeckId, prev) - 1)
        : 0
    setPresentationBuildStep(last)
    setPresentationSlideIndex(prev)
  }, [presentationBuildStep, presentationDeck, presentationDeckId, presentationSlideIndex])

  const goPresentationNext = useCallback(() => {
    if (!presentationDeck || presentationDeck.slides.length === 0) return
    if (presentationDeck.engine === 'live' && presentationDeckId) {
      const count = presentationStepCount(presentationDeckId, presentationSlideIndex)
      if (presentationBuildStep + 1 < count) {
        setPresentationBuildStep((step) => step + 1)
        return
      }
    }
    setPresentationBuildStep(0)
    setPresentationSlideIndex((i) => (i >= presentationDeck.slides.length - 1 ? 0 : i + 1))
  }, [presentationBuildStep, presentationDeck, presentationDeckId, presentationSlideIndex])

  useEffect(() => {
    return subscribePresentationStepFromPresenter((delta) => {
      if (delta < 0) goPresentationPrev()
      else goPresentationNext()
    })
  }, [goPresentationNext, goPresentationPrev])

  const projectLiveOrRaster = useCallback(async () => {
    if (presentationDeck?.engine === 'live' && presentationDeckId) {
      const frame = projectedFrame(presentationDeckId, presentationSlideIndex, presentationBuildStep)
      if (!frame) return null
      return presentDeckSlide(frame, connectedDisplays)
    }
    if (!presentationSlidePath) return null
    return presentPresentationImage(presentationSlidePath, connectedDisplays)
  }, [
    presentationDeck,
    presentationDeckId,
    presentationBuildStep,
    presentationSlideIndex,
    presentationSlidePath,
    connectedDisplays
  ])

  const projectPresentationSlide = useCallback(async () => {
    setProgram((prev) => optimisticProgramPatch(prev, { presentationActive: true, outputsOpen: true }))
    const ui = await projectLiveOrRaster()
    if (ui) applyProgram(ui)
  }, [projectLiveOrRaster, applyProgram])

  const stopPresentationProjection = useCallback(async () => {
    setProgram((prev) => optimisticProgramPatch(prev, { presentationActive: false }))
    const ui = await clearPresentationLayer('presentation')
    applyProgram(ui)
  }, [applyProgram])

  const goPresentationLive = useCallback(async () => {
    setWebLive(false)
    setWebLiveUrl(null)
    setProgram((prev) => optimisticProgramPatch(prev, { presentationActive: true, outputsOpen: true }))
    const ui = await projectLiveOrRaster()
    if (ui) applyProgram(ui)
  }, [projectLiveOrRaster, applyProgram])

  const togglePresentationOutput = useCallback(async () => {
    if (presentationOutputLive) {
      await stopPresentationProjection()
      return
    }
    await goPresentationLive()
  }, [presentationOutputLive, stopPresentationProjection, goPresentationLive])

  const handleImportPresentationDeck = useCallback(async () => {
    if (!presentationImportEnabled) {
      setPresentationImportError(
        'Download dependencies on the Presentation tab before importing decks.'
      )
      return
    }
    setPresentationImportBusy(true)
    setPresentationImportError(null)
    setPresentationImportProgress({ phase: 'waiting', message: 'Waiting for a file…' })
    const result = await importPresentationDeck()
    setPresentationImportBusy(false)
    setPresentationImportProgress(null)
    if (!result.ok) {
      if (result.message !== 'Import canceled.') setPresentationImportError(result.message)
      return
    }
    const list = await fetchPresentationDecks()
    setPresentationDecks(list)
    setPresentationDeckId(result.deck.id)
    setPresentationDeck(result.deck)
    setPresentationBuildStep(0)
    setPresentationSlideIndex(0)
    saveStoredPresentationDeckId(result.deck.id)
  }, [presentationImportEnabled])

  const handleOpenPresenterView = useCallback(async () => {
    if (!presentationDeckId || !presentationDeck?.slides.length) return
    await openPresenterView(presentationDeckId, presentationSlideIndex, presentationBuildStep)
  }, [presentationBuildStep, presentationDeckId, presentationDeck, presentationSlideIndex])

  const handleDownloadPresentationDeps = useCallback(async () => {
    setPresentationDepsDownloading(true)
    setPresentationDepsProgress({
      phase: 'downloading',
      percent: 0,
      message: 'Downloading presentation import components…'
    })
    const result = await downloadPresentationImportDeps()
    if (!result.ok) {
      setPresentationDepsProgress({ phase: 'error', message: result.message })
      setPresentationDepsDownloading(false)
    }
  }, [])

  const handleCancelPresentationDepsDownload = useCallback(() => {
    cancelPresentationImportDepsDownload()
    setPresentationDepsDownloading(false)
  }, [])

  const handleRemovePresentationDeck = useCallback(
    async (deckId: string) => {
      setPresentationDecks((prev) => prev.filter((deck) => deck.id !== deckId))
      const removingCurrent = presentationDeckId === deckId
      if (removingCurrent) {
        setPresentationDeck(null)
        setPresentationSlideIndex(0)
      }
      forgetLiveSession(deckId)
      if (removingCurrent) {
        await closePresenterView()
        if (presentationOutputLive) await stopPresentationProjection()
      }
      let removed = false
      try {
        removed = await removePresentationDeck(deckId)
      } catch {
        removed = false
      }
      const list = await fetchPresentationDecks()
      setPresentationDecks(list)
      if (!removed && list.some((deck) => deck.id === deckId)) {
        setPresentationImportError('Could not delete that deck. Close any open preview and try again.')
        if (removingCurrent) setPresentationDeckId(deckId)
        return
      }
      const nextId = removingCurrent ? (list[0]?.id ?? null) : presentationDeckId
      setPresentationDeckId(nextId)
      if (removingCurrent) saveStoredPresentationDeckId(nextId)
    },
    [presentationDeckId, presentationOutputLive, stopPresentationProjection]
  )

  const toggleWebOutput = useCallback(async () => {
    if (webLive) {
      await stopAllProjection()
      return
    }
    await goWebLive()
  }, [webLive, stopAllProjection, goWebLive])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== '?' || event.ctrlKey || event.altKey || event.metaKey) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      if (document.querySelector('dialog[open]')) return
      event.preventDefault()
      setShortcutsOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (tab !== 'presentation') return

    const onKeyDown = (e: KeyboardEvent): void => {
      if (sequenceFollowsKeys()) return
      const target = e.target as HTMLElement
      const inField =
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA'

      if ((e.key === 'ArrowLeft' || e.key === 'ArrowUp') && !inField) {
        e.preventDefault()
        blurShortcutTarget(e.target)
        goPresentationPrev()
        return
      }
      if ((e.key === 'ArrowRight' || e.key === 'ArrowDown') && !inField) {
        e.preventDefault()
        blurShortcutTarget(e.target)
        goPresentationNext()
        return
      }
      if (e.key === 'Enter' && !e.ctrlKey && !inField) {
        e.preventDefault()
        void projectPresentationSlide()
        return
      }
      if (e.ctrlKey && e.key === 'Enter' && !inField) {
        e.preventDefault()
        void togglePresentationOutput()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    tab,
    goPresentationPrev,
    goPresentationNext,
    projectPresentationSlide,
    togglePresentationOutput
  ])

  useEffect(() => {
    if (tab !== 'web') return

    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      const inField =
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA'

      if (e.key === 'F5') {
        e.preventDefault()
        reloadWebPage()
        return
      }

      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        webGoBack()
        return
      }

      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault()
        webGoForward()
        return
      }

      if (e.ctrlKey && e.key === 'Enter' && !inField) {
        e.preventDefault()
        void toggleWebOutput()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tab, reloadWebPage, webGoBack, webGoForward, toggleWebOutput])

  const outputLiveRef = useRef(outputLive)
  outputLiveRef.current = outputLive
  const orderMotionRef = useRef({ animation: activeSettings.animation, durationMs: activeSettings.transitionMs })
  orderMotionRef.current = { animation: activeSettings.animation, durationMs: activeSettings.transitionMs }
  const presentationOutputLiveRef = useRef(presentationOutputLive)
  presentationOutputLiveRef.current = presentationOutputLive
  const bibleLiveRef = useRef(bibleLive)
  bibleLiveRef.current = bibleLive
  const dictionaryLiveRef = useRef(dictionaryLive)
  dictionaryLiveRef.current = dictionaryLive
  const hymnsLiveRef = useRef(hymnsLive)
  hymnsLiveRef.current = hymnsLive
  const connectedDisplaysRef = useRef(connectedDisplays)
  connectedDisplaysRef.current = connectedDisplays
  const lastPushedOrderPathRef = useRef<string | null>(null)
  const lastPushedBibleKeyRef = useRef<string | null>(null)

  const lastPushedPresentationPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (sequenceDriveRef.current) return
    if (!outputLive) {
      lastPushedOrderPathRef.current = null
      return
    }
    if (!activeImage?.path) return
    if (lastPushedOrderPathRef.current === null) {
      lastPushedOrderPathRef.current = activeImage.path
      return
    }
    if (lastPushedOrderPathRef.current === activeImage.path) return
    lastPushedOrderPathRef.current = activeImage.path
    void presentOrderLayer(activeImage.path, connectedDisplaysRef.current, orderMotionRef.current).then((ui) => {
      if (outputLiveRef.current) {
        applyProgram(ui)
      }
    })
  }, [outputLive, activeImage?.path, applyProgram])

  useEffect(() => {
    if (!presentationOutputLive) {
      lastPushedPresentationPathRef.current = null
      return
    }
    if (presentationDeck && presentationDeckId && presentationDeck.id !== presentationDeckId) return
    const token =
      presentationDeck?.engine === 'live' && presentationDeckId
        ? `${presentationDeckId}:${presentationSlideIndex}:${presentationBuildStep}`
        : presentationSlidePath
    if (!token) return
    if (sequenceDriveRef.current || lastPushedPresentationPathRef.current === null) {
      lastPushedPresentationPathRef.current = token
      return
    }
    if (lastPushedPresentationPathRef.current === token) return
    lastPushedPresentationPathRef.current = token
    void projectLiveOrRaster().then((ui) => {
      if (ui && presentationOutputLiveRef.current) applyProgram(ui)
    })
  }, [presentationBuildStep, presentationOutputLive, presentationSlidePath, presentationDeck, presentationDeckId, presentationSlideIndex, projectLiveOrRaster, applyProgram])

  const sequenceProjectPendingRef = useRef<{ deckId: string; slide: number } | null>(null)

  const programRef = useRef(program)
  programRef.current = program

  const clearLayerIfLive = useCallback(
    async (source: 'order' | 'bible' | 'presentation') => {
      const ui = programRef.current
      const onStack = ui.stack.base === source || ui.stack.overlay === source
      const flagged =
        source === 'order'
          ? ui.orderActive
          : source === 'bible'
            ? ui.bibleActive
            : ui.presentationActive
      if (!onStack && !flagged) return
      const next = await clearPresentationLayer(source)
      programRef.current = next
      applyProgram(next)
    },
    [applyProgram]
  )

  const peelScriptureAfterFront = useCallback(
    async (ui: PresentationUiState) => {
      const stage = ui.stage
      const front =
        stage?.overlay?.type === 'media' ||
        stage?.overlay?.type === 'deck-slide' ||
        stage?.overlay?.type === 'image' ||
        stage?.base?.type === 'media' ||
        stage?.base?.type === 'deck-slide'
      if (!front) return
      const orderUnder =
        stage?.base?.type === 'image' || ui.stack.base === 'order' || ui.stack.overlay === 'order'
      const scriptureUnder =
        stage?.base?.type === 'hymn' ||
        stage?.base?.type === 'bible' ||
        stage?.base?.type === 'dictionary' ||
        ui.stack.base === 'bible' ||
        ui.stack.overlay === 'bible'
      if (!orderUnder && !scriptureUnder) return
      await clearLayerIfLive('bible')
    },
    [clearLayerIfLive]
  )

  const showSequenceAt = useCallback(
    async (cursor: SequenceCursor, project: boolean) => {
      const item = sequenceItems[cursor.itemIndex]
      if (!item) return
      sequenceDriveRef.current = true
      try {
      const displays = connectedDisplaysRef.current
      if (project && item.kind !== 'web') {
        setWebLive(false)
        setWebLiveUrl(null)
      }
      if (item.kind === 'order-image') {
        setTab('order')
        setBrowseFolderName(item.folder)
        setActiveFolderName(item.folder)
        const images = folderImagesMap[item.folder] ?? []
        const named = images.find((image) => image.name === item.name)
        const path = images.some((image) => image.path === item.path)
          ? item.path
          : (named?.path ?? item.path)
        const index = images.findIndex((image) => image.path === path)
        setActiveImageIndex(index >= 0 ? index : 0)
        setPlaying(false)
        lastPushedOrderPathRef.current = path
        if (!project) return
        const stageNow = programRef.current.stage
        const scriptureUp =
          stageNow?.base?.type === 'hymn' ||
          stageNow?.base?.type === 'bible' ||
          stageNow?.base?.type === 'dictionary' ||
          stageNow?.overlay?.type === 'hymn' ||
          stageNow?.overlay?.type === 'bible' ||
          stageNow?.overlay?.type === 'dictionary'
        const motion = settingsForFolder(folderSettings, item.folder)
        const ui = await presentOrderLayer(
          path,
          displays,
          scriptureUp
            ? { animation: 'cut', durationMs: 0 }
            : { animation: motion.animation, durationMs: motion.transitionMs }
        )
        programRef.current = ui
        applyProgram(ui)
        const imageOnStage = ui.stage?.base?.type === 'image' || ui.stage?.overlay?.type === 'image'
        if (!imageOnStage) return
        await clearLayerIfLive('bible')
        await clearLayerIfLive('presentation')
        return
      }
      if (item.kind === 'hymn') {
        const step = item.steps[Math.min(cursor.stepIndex, Math.max(0, item.steps.length - 1))]
        requestHymnSequenceCue({
          hymnalId: item.hymnalId,
          hymnId: item.hymnId,
          stepIndex: cursor.stepIndex,
          disabledVerseNumbers: item.disabledVerseNumbers,
          includeRefrain: item.includeRefrain,
          includeTitle: item.includeTitle !== false,
          includeEnd: item.includeEnd !== false
        })
        const hymnContent = step
          ? {
              hymnalId: item.hymnalId,
              hymnId: item.hymnId,
              number: item.number,
              title: item.title,
              slideKind: step.kind,
              stanzaIndex: step.stanzaIndex,
              stanzaTag: step.label,
              stanzaKind: step.stanzaKind,
              verse: step.verse,
              versePart: step.versePart,
              versePartCount: step.versePartCount,
              lines: step.lines,
              tagStyle: 'short' as const
            }
          : null
        if (hymnContent) {
          setHymnActiveLabel(`${item.number} ${item.title} · ${step?.label ?? ''}`)
          setHymnLiveContent(hymnContent)
        }
        setTab('hymns')
        if (!project || !hymnContent) return
        const hymnLayer = stackHymnFromContent(hymnContent)
        await clearLayerIfLive('presentation')
        if (hymnLayer.type !== 'hymn') return
        const ui = await presentHymnLayer(hymnLayer, displays)
        programRef.current = ui
        applyProgram(ui)
        return
      }
      if (item.kind === 'bible') {
        const bibleContent = {
          reference: item.reference,
          locationLabel: item.locationLabel,
          translationLabel: item.translationLabel,
          highlightVerse: item.verse,
          bookId: item.bookId,
          verses: [{ number: item.verse, text: item.text }]
        }
        setBibleActivePassage(item.reference)
        setBibleLiveContent(bibleContent)
        requestBibleSequenceCue({ bookId: item.bookId, chapter: item.chapter, verse: item.verse })
        setTab('bible')
        if (!project) return
        const bibleLayer = stackBibleFromContent(bibleContent)
        await clearLayerIfLive('presentation')
        if (bibleLayer.type !== 'bible') return
        const ui = await presentBibleLayer(bibleLayer, displays)
        programRef.current = ui
        applyProgram(ui)
        return
      }
      if (item.kind === 'dictionary') {
        const { id: _id, kind: _kind, ...content } = item
        setDictionaryLiveContent(content)
        patchDictionaryWorkspaceSession({ selectedId: item.strongs })
        setTab('dictionary')
        if (!project) return
        const dictionaryLayer = stackDictionaryFromContent(content)
        await clearLayerIfLive('presentation')
        if (dictionaryLayer.type !== 'dictionary') return
        const ui = await presentDictionaryLayer(dictionaryLayer, displays)
        programRef.current = ui
        applyProgram(ui)
        return
      }
      if (item.kind === 'web') {
        setTab('web')
        setWebUrlInput(item.url)
        setWebPageUrl(item.url)
        setWebPageTitle(item.title)
        if (!project) return
        setWebLive(true)
        setWebLiveUrl(item.url)
        const ok = await sendToProjection({ type: 'web', url: item.url }, displays)
        if (!ok) {
          setWebLive(false)
          setWebLiveUrl(null)
          return
        }
        setProgram(emptyPresentationUiState())
        return
      }
      if (item.kind === 'media') {
        requestMediaSequenceCue({ folder: item.folder, path: item.path })
        setTab('media')
        if (!project) return
        const ui = await presentMediaFile(
          { path: item.path, name: item.name, kind: item.mediaKind },
          displays,
          loadPlaybackSettings().autoplayLibraryMedia
        )
        programRef.current = ui
        applyProgram(ui)
        await peelScriptureAfterFront(ui)
        return
      }
      const slide = Math.min(cursor.stepIndex, Math.max(0, item.slideCount - 1))
      setTab('presentation')
      setPresentationDeckId(item.deckId)
      setPresentationBuildStep(0)
      setPresentationSlideIndex(slide)
      if (!project) return
      sequenceProjectPendingRef.current = { deckId: item.deckId, slide }
      const stillCurrent = (): boolean => sequenceProjectPendingRef.current?.deckId === item.deckId
      const detail = await fetchPresentationDeck(item.deckId)
      if (!stillCurrent() || !detail) return
      if (detail.engine === 'live') {
        const source = await window.orion.readPresentationDeckSource(item.deckId)
        if (!stillCurrent() || !source) return
        const session = await loadLiveSession(item.deckId, {
          bytes: source.bytes,
          mediaDir: source.mediaDir,
          mediaFiles: source.mediaFiles,
          cues: detail.cues,
          ext: detail.sourceExt
        })
        if (!stillCurrent()) return
        rememberSession(item.deckId, session)
        const frame = projectedFrame(item.deckId, slide, 0)
        if (!stillCurrent() || !frame) return
        const ui = await presentDeckSlide(frame, connectedDisplaysRef.current)
        if (!stillCurrent()) return
        sequenceProjectPendingRef.current = null
        lastPushedPresentationPathRef.current = `${item.deckId}:${slide}:0`
        programRef.current = ui
        applyProgram(ui)
        await peelScriptureAfterFront(ui)
        return
      }
      const path = detail.slides[slide]?.path
      if (!path) return
      const ui = await presentPresentationImage(path, connectedDisplaysRef.current)
      if (!stillCurrent()) return
      sequenceProjectPendingRef.current = null
      lastPushedPresentationPathRef.current = path
      programRef.current = ui
      applyProgram(ui)
      await peelScriptureAfterFront(ui)
      } finally {
        sequenceDriveRef.current = false
      }
    },
    [sequenceItems, folderImagesMap, folderSettings, applyProgram, clearLayerIfLive, peelScriptureAfterFront]
  )

  followOutputRef.current = (wire) => {
    if (!sequenceFollow) return
    const cursor = sequenceCursorForOutput(wire, sequenceItems, sequenceCursor.itemIndex)
    if (!cursor) return
    const item = sequenceItems[cursor.itemIndex]
    if (!item) return
    sequenceCursorRef.current = cursor
    setSequenceCursor(cursor)
    if (item.kind === 'order-image') {
      setTab('order')
      setBrowseFolderName(item.folder)
      setActiveFolderName(item.folder)
      const images = folderImagesMap[item.folder] ?? []
      const index = images.findIndex((image) => image.path === item.path)
      setActiveImageIndex(index >= 0 ? index : 0)
      return
    }
    if (item.kind === 'hymn') {
      setTab('hymns')
      requestHymnSequenceCue({
        hymnalId: item.hymnalId,
        hymnId: item.hymnId,
        stepIndex: cursor.stepIndex,
        disabledVerseNumbers: item.disabledVerseNumbers,
        includeRefrain: item.includeRefrain,
        includeTitle: item.includeTitle !== false,
        includeEnd: item.includeEnd !== false
      })
      return
    }
    if (item.kind === 'bible') {
      setTab('bible')
      requestBibleSequenceCue({ bookId: item.bookId, chapter: item.chapter, verse: item.verse })
      return
    }
    if (item.kind === 'dictionary') {
      setTab('dictionary')
      patchDictionaryWorkspaceSession({ selectedId: item.strongs })
      return
    }
    if (item.kind === 'media') {
      setTab('media')
      requestMediaSequenceCue({ folder: item.folder, path: item.path })
      return
    }
    if (item.kind === 'web') {
      setTab('web')
      return
    }
    setTab('presentation')
    setPresentationDeckId(item.deckId)
    setPresentationSlideIndex(Math.min(cursor.stepIndex, Math.max(0, item.slideCount - 1)))
  }

  useEffect(() => {
    if (skipSequenceWrite.current) {
      skipSequenceWrite.current = false
      return
    }
    try {
      localStorage.setItem(SEQUENCE_KEY, serializeServiceSequence(sequenceItems))
    } catch {
      /* storage unavailable */
    }
    touchProfileSettings()
  }, [sequenceItems])

  useEffect(() => {
    setSequenceFollowKeys(sequenceFollow && sequenceItems.length > 0)
  }, [sequenceFollow, sequenceItems.length])

  useEffect(() => {
    setSequenceInbox((draft) => {
      void materializeSequenceDraft(draft).then((item) => {
        if (!item) return
        setSequenceItems((prev) => [...prev, withSequenceId(item)])
      })
    })
    return () => setSequenceInbox(null)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!sequenceFollow || sequenceItems.length === 0) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
      if (!delta) return
      event.preventDefault()
      event.stopPropagation()
      blurShortcutTarget(event.target)
      const next = moveSequenceCursor(sequenceItems, sequenceCursorRef.current, delta)
      sequenceCursorRef.current = next
      setSequenceCursor(next)
      void showSequenceAt(next, true)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [sequenceFollow, sequenceItems, showSequenceAt])

  const bibleContentKey = bibleLiveContent
    ? `${bibleLiveContent.reference}|${bibleLiveContent.highlightVerse}|${bibleLiveContent.verses[0]?.text ?? ''}|${bibleLiveContent.bookId ?? ''}|${bibleBgStyle.solidColor}|${bibleBgStyle.imagePath ?? ''}|${bibleBgStyle.dimOpacity}|${bibleBgStyle.dimColor}|${bibleBgStyle.fit}|${bibleLayout.reference}|${bibleLayout.translation}|${bibleLayout.verse}|${JSON.stringify(bibleLayout.margin)}|${bibleLayout.width.reference}|${bibleLayout.width.translation}|${bibleLayout.width.verse}`
    : null

  useEffect(() => {
    if (!bibleLive) {
      lastPushedBibleKeyRef.current = null
      return
    }
    if (!bibleLiveContent || bibleLiveContent.verses.length === 0 || !bibleContentKey) return
    if (sequenceDriveRef.current || lastPushedBibleKeyRef.current === null) {
      lastPushedBibleKeyRef.current = bibleContentKey
      return
    }
    if (lastPushedBibleKeyRef.current === bibleContentKey) return
    lastPushedBibleKeyRef.current = bibleContentKey
    const layer = stackBibleFromContent(bibleLiveContent, bibleBgStyle)
    if (layer.type !== 'bible' || layer.verses.length === 0) return
    void presentBibleLayer(layer, connectedDisplaysRef.current).then((ui) => {
      if (bibleLiveRef.current) {
        applyProgram(ui)
      }
    })
  }, [bibleLive, bibleContentKey, bibleLiveContent, bibleBgStyle, applyProgram])

  const dictionaryContentKey = dictionaryLiveContent
    ? `${dictionaryLiveContent.strongs}|${dictionaryLiveContent.lemma}|${dictionaryLiveContent.definition.slice(0, 80)}|${dictionaryBgStyle.solidColor}|${dictionaryBgStyle.imagePath ?? ''}|${dictionaryBgStyle.dimOpacity}|${dictionaryBgStyle.fit}|${JSON.stringify(dictionaryLayout)}`
    : null
  const lastPushedDictionaryKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!dictionaryLive) {
      lastPushedDictionaryKeyRef.current = null
      return
    }
    if (!dictionaryLiveContent || !dictionaryContentKey) return
    if (sequenceDriveRef.current || lastPushedDictionaryKeyRef.current === null) {
      lastPushedDictionaryKeyRef.current = dictionaryContentKey
      return
    }
    if (lastPushedDictionaryKeyRef.current === dictionaryContentKey) return
    lastPushedDictionaryKeyRef.current = dictionaryContentKey
    const layer = stackDictionaryFromContent(dictionaryLiveContent, dictionaryBgStyle)
    if (layer.type !== 'dictionary') return
    void presentDictionaryLayer(layer, connectedDisplaysRef.current).then((ui) => {
      if (dictionaryLiveRef.current) {
        applyProgram(ui)
      }
    })
  }, [dictionaryLive, dictionaryContentKey, dictionaryLiveContent, dictionaryBgStyle, applyProgram])

  const hymnContentKey = hymnLiveContent
    ? `${hymnLiveContent.hymnId}|${hymnLiveContent.slideKind}|${hymnLiveContent.stanzaIndex}|${hymnLiveContent.lines.join('\n')}|${hymnLiveContent.author ?? ''}|${hymnsBgStyle.solidColor}|${hymnsBgStyle.imagePath ?? ''}|${hymnsBgStyle.dimOpacity}|${hymnsBgStyle.fit}|${JSON.stringify(hymnLayout)}`
    : null
  const lastPushedHymnKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!hymnsLive) {
      lastPushedHymnKeyRef.current = null
      return
    }
    if (!isHymnSlideProjectable(hymnLiveContent) || !hymnContentKey) return
    const liveHymn = hymnLiveContent
    if (sequenceDriveRef.current || lastPushedHymnKeyRef.current === null) {
      lastPushedHymnKeyRef.current = hymnContentKey
      return
    }
    if (lastPushedHymnKeyRef.current === hymnContentKey) return
    lastPushedHymnKeyRef.current = hymnContentKey
    const layer = stackHymnFromContent(liveHymn, hymnsBgStyle)
    if (layer.type !== 'hymn') return
    void presentHymnLayer(layer, connectedDisplaysRef.current).then((ui) => {
      if (hymnsLiveRef.current) {
        applyProgram(ui)
      }
    })
  }, [hymnsLive, hymnContentKey, hymnLiveContent, hymnsBgStyle, applyProgram])

  const orderBlock: OrderBlockRibbonProps = {
    activeFolderName,
    images: activeImages,
    imageIndex: activeImageIndex,
    playing,
    settings: activeSettings,
    onPrev: goPrevImage,
    onNext: goNextImage,
    onTogglePlay: () => setPlaying((p) => !p),
    onToggleLoop: () => patchSettings({ loop: !activeSettings.loop }),
    onClearFolder: () => {
      setBrowseFolderName(null)
      setActiveFolderName(null)
      setActiveImageIndex(0)
      setPlaying(false)
      void stopAllProjection()
    },
    onUpdateSettings: patchSettings,
    outputLive,
    onGoLive: () => {
      void toggleOrderOutput()
    },
    view: orderView,
    thumbSize: orderThumbSize,
    showImageNames: orderShowNames,
    onShowImageNamesChange: (next) => {
      setOrderShowNames(next)
      try {
        localStorage.setItem(ORDER_NAMES_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      touchProfileSettings()
    },
    onThumbSizeChange: (next) => {
      setOrderThumbSize(next)
      try {
        localStorage.setItem(ORDER_THUMB_KEY, next)
      } catch {
        /* ignore */
      }
      touchProfileSettings()
    },
    onViewChange: (next) => {
      setOrderView(next)
      try {
        localStorage.setItem(ORDER_VIEW_KEY, next)
      } catch {
        /* ignore */
      }
      touchProfileSettings()
    },
    onLibraryChanged: (selectFolder) => {
      void reloadOrderLibrary(selectFolder)
    },
    newFolderSignal
  }

  const bibleBlock: BibleTabRibbonProps = {
    onGoLive: () => {
      void toggleBibleOutput()
    },
    onProjectLive: () => {
      void goBibleLive()
    },
    live: bibleLive,
    canProject: Boolean(bibleLiveContent?.verses.length),
    onAddToSequence: () => {
      const draft = currentBibleSequenceDraft()
      if (draft) setSequenceItems((prev) => [...prev, withSequenceId(draft)])
    },
    onPrevVerse: () => getBibleRibbonActions().prevVerse?.(),
    onNextVerse: () => getBibleRibbonActions().nextVerse?.(),
    onPrevBook: () => getBibleRibbonActions().prevBook?.(),
    onNextBook: () => getBibleRibbonActions().nextBook?.()
  }

  const dictionaryBlock: DictionaryTabRibbonProps = {
    onGoLive: () => {
      void toggleDictionaryOutput()
    },
    onProjectLive: () => {
      void goDictionaryLive()
    },
    live: dictionaryLive,
    canProject: Boolean(dictionaryLiveContent?.lemma),
    onAddToSequence: () => {
      const live = getDictionaryLiveContent()
      if (!live?.lemma) return
      setSequenceItems((prev) => [...prev, withSequenceId({ kind: 'dictionary', ...live })])
    },
    onPrevEntry: () => getDictionaryRibbonActions().prevEntry?.(),
    onNextEntry: () => getDictionaryRibbonActions().nextEntry?.()
  }

  const hymnsBlock: HymnsTabRibbonProps = {
    onGoLive: () => {
      void toggleHymnsOutput()
    },
    onProjectStanza: () => {
      void onHymnsProjectStanza()
    },
    onPrevSlide: () => getHymnsRibbonActions().prevSlide?.(),
    onNextSlide: () => getHymnsRibbonActions().nextSlide?.(),
    onAddToSequence: () => getHymnsRibbonActions().addToSequence?.(),
    live: hymnsLive,
    canProject: isHymnSlideProjectable(hymnLiveContent)
  }

  const presentationBlock: PresentationTabRibbonProps = {
    onImport: () => {
      void handleImportPresentationDeck()
    },
    importing: presentationImportBusy,
    importEnabled: presentationImportEnabled,
    onPrev: goPresentationPrev,
    onNext: goPresentationNext,
    onProjectSlide: () => {
      void projectPresentationSlide()
    },
    onRemoveDeck: () => {
      if (presentationDeckId) {
        void handleRemovePresentationDeck(presentationDeckId)
      }
    },
    onOpenPresenterView: () => {
      void handleOpenPresenterView()
    },
    outputLive: presentationOutputLive,
    onGoLive: () => {
      void togglePresentationOutput()
    },
    canProject: Boolean(
      presentationImportEnabled &&
        (presentationSlidePath || presentationDeck?.engine === 'live')
    ),
    onAddToSequence: () => {
      const deck = presentationDeck
      if (!deck) return
      setSequenceItems((prev) => [
        ...prev,
        withSequenceId({
          kind: 'presentation',
          deckId: deck.id,
          title: deck.title,
          slideCount: Math.max(1, deck.slides.length)
        })
      ])
    }
  }

  const webBlock: WebTabRibbonProps = {
    urlInput: webUrlInput,
    onUrlInputChange: setWebUrlInput,
    pageUrl: webPageUrl,
    pageTitle: webPageTitle,
    canGoBack: webCanGoBack,
    canGoForward: webCanGoForward,
    webLive,
    onLoad: loadWebPage,
    onReload: reloadWebPage,
    onBack: webGoBack,
    onForward: webGoForward,
    onClear: clearWebPage,
    onGoLive: () => {
      void toggleWebOutput()
    }
  }

  const outputs: OutputPreview[] = useMemo(() => {
    const targets = projectionTargetsFromDisplays(connectedDisplays)
    const stage = program.stage
    const stageOverlay = stage?.overlay
    const stageBase = stage?.base

    const bibleContent =
      stageOverlay?.type === 'bible'
        ? stageOverlay
        : stageBase?.type === 'bible' && !outputLive
          ? stageBase
          : bibleLiveContent ?? getBibleLiveContent()

    const selectedVerse =
      bibleContent?.verses.find((v) => v.number === bibleContent.highlightVerse) ??
      bibleContent?.verses[0]
    const bibleOverlay =
      bibleLive && bibleContent && !dictionaryLive && !hymnsLive
        ? {
            title: bibleContent.reference,
            body: selectedVerse
              ? `${selectedVerse.number} ${selectedVerse.text}`
              : '',
            backgroundUrl: bibleBgStyle.imagePath
              ? filePathToUrl(bibleBgStyle.imagePath)
              : undefined,
            backgroundColor: bibleBgStyle.solidColor,
            dimOpacity: bibleBgStyle.dimOpacity,
            dimColor: bibleBgStyle.dimColor,
            fit: bibleBgStyle.fit
          }
        : undefined

    const hymnWire =
      stageOverlay?.type === 'hymn'
        ? stageOverlay
        : stageBase?.type === 'hymn'
          ? stageBase
          : null
    const hymnLive = hymnLiveContent ?? getHymnLiveContent()
    const hymnCorner = (
      wire: { stanzaKind?: string; verse?: number; versePart?: number; versePartCount?: number } | null,
      live: HymnLiveContent | null
    ) =>
      hymnProjectionCornerLabel(
        wire?.stanzaKind ?? live?.stanzaKind ?? 'verse',
        wire?.verse ?? live?.verse,
        wire?.versePart ?? live?.versePart,
        wire?.versePartCount ?? live?.versePartCount
      )

    const hymnOverlay =
      hymnsLive && (hymnWire || hymnLive)
        ? {
            title: hymnWire
              ? `${hymnWire.number} · ${hymnWire.title}`
              : `${hymnLive!.number} · ${hymnLive!.title}`,
            body:
              hymnLive?.slideKind === 'end'
                ? 'End of hymn'
                : hymnLive?.slideKind === 'title'
                  ? hymnLive.title
                  : [
                      hymnCorner(hymnWire, hymnLive),
                      (hymnWire?.lines ?? hymnLive?.lines ?? [])[0]
                    ]
                      .filter(Boolean)
                      .join(' · '),
            backgroundUrl: hymnsBgStyle.imagePath
              ? filePathToUrl(hymnsBgStyle.imagePath)
              : undefined,
            backgroundColor: hymnsBgStyle.solidColor,
            dimOpacity: hymnsBgStyle.dimOpacity,
            dimColor: hymnsBgStyle.dimColor,
            fit: hymnsBgStyle.fit
          }
        : undefined

    const dictWire =
      stageOverlay?.type === 'dictionary'
        ? stageOverlay
        : stageBase?.type === 'dictionary'
          ? stageBase
          : null
    const dictLive = dictionaryLiveContent ?? getDictionaryLiveContent()
    const dictionaryOverlay =
      dictionaryLive && (dictWire || dictLive)
        ? {
            title: dictWire?.strongs ?? (dictLive ? formatStrongsDisplay(dictLive.strongs) : ''),
            body: [
              dictWire?.lemma ?? dictLive?.lemma,
              dictWire?.gloss ?? dictLive?.gloss,
              dictWire?.transliteration ?? dictLive?.transliteration
            ]
              .filter(Boolean)
              .join(' · '),
            backgroundUrl: dictionaryBgStyle.imagePath
              ? filePathToUrl(dictionaryBgStyle.imagePath)
              : undefined,
            backgroundColor: dictionaryBgStyle.solidColor,
            dimOpacity: dictionaryBgStyle.dimOpacity,
            dimColor: dictionaryBgStyle.dimColor,
            fit: dictionaryBgStyle.fit
          }
        : undefined

    const orderPreviewUrl =
      stageBase?.type === 'image'
        ? stageBase.mediaUrl
        : activeImage
          ? filePathToUrl(activeImage.path)
          : undefined

    const orderPreviewName =
      activeImage?.name ??
      (stageBase?.type === 'image' ? stageBase.filePath.split(/[\\/]/).pop() ?? 'Slide' : 'Slide')

    if (targets.length === 0) {
      return [
        {
          id: 'none',
          label: 'No projection displays',
          subtitle: 'Enable displays under Settings → Displays',
          isLive: false
        }
      ]
    }

    return targets.map((monitor) => {
      const display = monitor.display
      let isLive = false
      let previewUrl: string | undefined
      let previewWebUrl: string | undefined
      let subtitle = 'Nothing on screen'

      const presenting =
        webLive || outputLive || presentationOutputLive || bibleLive || dictionaryLive || hymnsLive

      if (webLive && webLiveUrl) {
        isLive = true
        previewWebUrl = webLiveUrl
        subtitle = webPageTitle || webUrlLabel(webLiveUrl)
      } else if (mediaOutputPath) {
        isLive = true
        subtitle = 'Media'
      } else if (presentationOutputLive) {
        isLive = true
        subtitle = presentationDeck?.title ?? 'Presentation'
      } else if (hymnsLive && stageOverlay?.type === 'hymn') {
        isLive = true
        if (stageBase?.type === 'image' && stageBase.mediaUrl) previewUrl = stageBase.mediaUrl
        subtitle = `${stageOverlay.number} · ${stageOverlay.title} · ${hymnProjectionCornerLabel(stageOverlay.stanzaKind, stageOverlay.verse, stageOverlay.versePart, stageOverlay.versePartCount)}`
      } else if (hymnsLive && stageBase?.type === 'hymn') {
        isLive = true
        subtitle = `${stageBase.number} · ${stageBase.title} · ${hymnProjectionCornerLabel(stageBase.stanzaKind, stageBase.verse, stageBase.versePart, stageBase.versePartCount)}`
      } else if (dictionaryLive && stageOverlay?.type === 'dictionary') {
        isLive = true
        subtitle = `${stageOverlay.strongs} · ${stageOverlay.lemma}`
      } else if (dictionaryLive && stageBase?.type === 'dictionary') {
        isLive = true
        subtitle = `${stageBase.strongs} · ${stageBase.lemma}`
      } else if (bibleLive && bibleContent && outputLive && orderPreviewUrl) {
        isLive = true
        previewUrl = orderPreviewUrl
        subtitle = `${bibleContent.reference} · Over ${orderPreviewName}`
      } else if (bibleLive && bibleContent) {
        isLive = true
        subtitle = bibleContent.reference
      } else if (outputLive && orderPreviewUrl) {
        isLive = true
        previewUrl = orderPreviewUrl
        subtitle = orderPreviewName
      }

      if (!isLive && presenting) {
        isLive = true
        if (bibleContent && !subtitle.includes(bibleContent.reference)) {
          subtitle = bibleContent.reference
        }
      }

      const libraryWire =
        stageOverlay?.type === 'media' ? stageOverlay : stageBase?.type === 'media' ? stageBase : null
      const imageWire = stageBase?.type === 'image' ? stageBase : null
      const hymnSettings = getHymnMotion()
      const bibleSettings = getBibleMotion()
      const bibleStage = stageOverlay?.type === 'bible' ? stageOverlay : stageBase?.type === 'bible' ? stageBase : null
      const deckWire =
        stageOverlay?.type === 'deck-slide' ? stageOverlay : stageBase?.type === 'deck-slide' ? stageBase : null
      const previewMotion = hymnsLive
        ? outputPreviewMotion(
            hymnWire?.animation ?? (hymnSettings.animation === 'random' ? undefined : hymnSettings.animation),
            hymnWire?.durationMs ?? hymnSettings.transitionMs
          )
        : bibleLive
          ? outputPreviewMotion(
              bibleStage?.animation ?? (bibleSettings.animation === 'random' ? undefined : bibleSettings.animation),
              bibleStage?.durationMs ?? bibleSettings.transitionMs
            )
          : dictionaryLive
            ? outputPreviewMotion('crossfade', 420)
            : presentationOutputLive && deckWire
              ? outputPreviewMotion(deckWire.transition, deckWire.durationMs)
              : outputLive && imageWire
                ? outputPreviewMotion(imageWire.animation, imageWire.durationMs)
                : undefined
      const previewSlideKey = hymnsLive
        ? `hymn:${hymnWire?.number ?? hymnLive?.number ?? ''}:${(hymnWire?.lines ?? hymnLive?.lines ?? []).join('\n')}`
        : bibleLive
          ? `bible:${bibleStage?.reference ?? bibleContent?.reference ?? ''}:${bibleStage?.highlightVerse ?? bibleContent?.highlightVerse ?? ''}:${bibleStage?.verses[0]?.text ?? ''}`
          : dictionaryLive
            ? `dict:${stageOverlay?.type === 'dictionary' ? stageOverlay.strongs : stageBase?.type === 'dictionary' ? stageBase.strongs : ''}`
            : presentationOutputLive
              ? `deck:${presentationDeckId}:${presentationSlideIndex}:${presentationBuildStep}:${deckWire?.markup.length ?? 0}`
              : imageWire
                ? `image:${imageWire.filePath}`
                : subtitle

      return {
        id: String(display.id),
        label: `Output ${monitor.order} · ${display.label}`,
        subtitle,
        isLive,
        previewUrl,
        previewWebUrl,
        captureDataUrl: outputCaptureFrames[String(display.id)],
        overlay: dictionaryOverlay ?? hymnOverlay ?? bibleOverlay,
        previewMotion,
        previewSlideKey,
        libraryMedia: libraryWire
          ? { url: filePathToUrl(libraryWire.filePath), kind: libraryWire.kind, name: libraryWire.name }
          : undefined
      }
    })
  }, [
    connectedDisplays,
    webLive,
    webLiveUrl,
    webPageTitle,
    bibleLive,
    dictionaryLive,
    hymnsLive,
    bibleLiveContent,
    dictionaryLiveContent,
    hymnLiveContent,
    bibleBgStyle,
    dictionaryBgStyle,
    hymnsBgStyle,
    outputCaptureFrames,
    outputLive,
    activeImage,
    program.stage,
    presentationDeck,
    presentationDeckId,
    presentationSlideIndex,
    presentationBuildStep,
    presentationOutputLive
  ])

  return (
    <div className="app-shell">
      <TopBar
        activeTab={tab}
        onTabChange={setTab}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        orderBlock={tab === 'order' ? orderBlock : undefined}
        webBlock={tab === 'web' ? webBlock : undefined}
        bibleBlock={tab === 'bible' ? bibleBlock : undefined}
        dictionaryBlock={tab === 'dictionary' ? dictionaryBlock : undefined}
        hymnsBlock={tab === 'hymns' ? hymnsBlock : undefined}
        presentationBlock={tab === 'presentation' ? presentationBlock : undefined}
      />
      <div className="app-body">
        <SequencePanel
          open={sequenceOpen}
          onToggle={() => setSequenceOpen((v) => !v)}
          items={sequenceItems}
          cursor={sequenceCursor}
          follow={sequenceFollow}
          onToggleFollow={() => {
            setSequenceFollow((on) => {
              const next = !on
              if (next && sequenceItems.length > 0) {
                const cursor =
                  sequenceCursor.itemIndex < sequenceItems.length
                    ? sequenceCursor
                    : { itemIndex: 0, stepIndex: 0 }
                void showSequenceAt(cursor, true)
              }
              return next
            })
          }}
          onImport={() => {
            void window.orion.importSequenceFile().then((raw) => {
              const file = parseServiceSequence(raw)
              if (!file) return
              setSequenceItems(file.items)
              setSequenceCursor({ itemIndex: 0, stepIndex: 0 })
              setSequenceFollow(false)
            })
          }}
          onExport={() => {
            void window.orion.exportSequenceFile(
              serializeServiceSequence(sequenceItems),
              'service-sequence',
              loadSequenceBundleContent()
            )
          }}
          onSelect={(index) => {
            const next = { itemIndex: index, stepIndex: sequenceCursor.itemIndex === index ? sequenceCursor.stepIndex : 0 }
            setSequenceCursor(next)
            void showSequenceAt(next, sequenceFollow)
          }}
          onRemove={(id) => {
            setSequenceItems((prev) => prev.filter((item) => item.id !== id))
          }}
          onClear={() => {
            setSequenceItems([])
            setSequenceCursor({ itemIndex: 0, stepIndex: 0 })
            setSequenceFollow(false)
          }}
          onDrop={(body: SequenceDropBody, index) => {
            if (body.op === 'move') {
              setSequenceItems((prev) => {
                const from = prev.findIndex((item) => item.id === body.id)
                if (from < 0 || from === index) return prev
                const next = prev.slice()
                const [moved] = next.splice(from, 1)
                if (!moved) return prev
                const target = from < index ? index - 1 : index
                next.splice(target, 0, moved)
                return next
              })
              return
            }
            void materializeSequenceDraft(body.draft).then((item) => {
              if (!item) return
              setSequenceItems((prev) => {
                const next = prev.slice()
                next.splice(index, 0, withSequenceId(item))
                return next
              })
            })
          }}
        />
        <main className="app-main">
          {webSeen ? (
            <div className={tab === 'web' ? 'tab-keep' : 'tab-keep tab-keep--hidden'} aria-hidden={tab === 'web' ? undefined : true}>
              <WebWorkspace
                pageUrl={webPageUrl}
                projecting={webLive}
                audible={
                  !webLive ||
                  !connectedDisplays.some(
                    (display) => display.primary && projectionDisplayIds(connectedDisplays).includes(display.id)
                  )
                }
                onPageUrlChange={onWebPageUrlChange}
                onTitleChange={onWebTitleChange}
                onNavigationStateChange={onWebNavigationStateChange}
                onControlsReady={onWebControlsReady}
              />
            </div>
          ) : null}
          <TabWorkspace
              tab={tab}
              folders={folders}
              orderImagesPath={orderImagesPath}
              activeFolderName={browsingFolder}
              activeImagePath={activeImage?.path ?? null}
              onSelectFolder={selectFolder}
              onSelectImage={selectImage}
              onReorderFolders={reorderFolders}
              view={orderView}
              thumbSize={orderThumbSize}
              showImageNames={orderShowNames}
              onNewFolder={() => setNewFolderSignal((n) => n + 1)}
              onProjectToOutputs={() => {
                void goBibleLive()
              }}
              onHymnsProjectStanza={onHymnsProjectStanza}
              onHymnsGoLive={onHymnsGoLive}
              mediaDisplays={connectedDisplays}
              mediaLivePath={mediaOutputPath}
              onMediaProjected={applyProgram}
              presentationDecks={presentationDecks}
              presentationDeck={presentationDeck}
              presentationLoadingDeck={presentationLoadingDeck}
              presentationDeckId={presentationDeckId}
              presentationSlideIndex={presentationSlideIndex}
              presentationBuildStep={presentationBuildStep}
              onSelectPresentationDeck={selectPresentationDeck}
              onSelectPresentationSlide={choosePresentationSlide}
              onImportPresentationDeck={() => {
                void handleImportPresentationDeck()
              }}
              onRemovePresentationDeck={(deckId) => {
                void handleRemovePresentationDeck(deckId)
              }}
              onOpenPresenterView={() => {
                void handleOpenPresenterView()
              }}
              presentationImportBusy={presentationImportBusy}
              presentationImportProgress={presentationImportProgress}
              presentationImportError={presentationImportError}
              presentationDepsStatus={presentationDepsStatus}
              presentationDepsProgress={presentationDepsProgress}
              presentationDepsDownloading={presentationDepsDownloading}
              onDownloadPresentationDeps={() => {
                void handleDownloadPresentationDeps()
              }}
              onCancelPresentationDepsDownload={handleCancelPresentationDepsDownload}
              presentationImportEnabled={presentationImportEnabled}
            />
        </main>
        <ProjectorPanel
          open={projectorOpen}
          onToggle={() => setProjectorOpen((v) => !v)}
          outputs={outputs}
          liveFrame={
            presentationDeckId &&
            (program.stage?.base?.type === 'deck-slide' || program.stage?.overlay?.type === 'deck-slide')
              ? projectedFrame(presentationDeckId, presentationSlideIndex, presentationBuildStep)
              : null
          }
        />
      </div>
      <LibraryUpdateToast
        count={settingsOpen || (libraryAutoUpdate && !libraryAutoFailed) ? 0 : libraryUpdates}
        progress={libraryAutoProgress == null ? null : { percent: libraryAutoProgress }}
        onOpen={() => {
          setSettingsSection('libraries')
          setSettingsOpen(true)
        }}
      />
      <ShortcutSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        section={settingsSection}
        onSectionChange={setSettingsSection}
      />
    </div>
  )
}
