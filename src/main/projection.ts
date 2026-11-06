import { BrowserWindow, ipcMain, screen, type Display, type WebContents } from 'electron'
import { join } from 'path'
import type { OrionProjectionPayload } from '../shared/projection'
import type {
  OrionProjectionCommand,
  OrionStackLayerContent,
  OrionStackSource,
  OrionStackState
} from '../shared/projection-stack'
import { type PresentationUiState } from '../shared/presentation-ui-state'
import {
  createStackWire,
  ProjectionMixerEngine,
  type ProjectionStageState
} from '../shared/projection-mixer'
import { is } from './env'
import { rememberDeckMediaClock, type DeckMediaClock } from './deck-media-clock'
import { imagePathToMediaUrl, sanitizeProjectionPayload, sanitizeStackContent } from './projection-paths'
import { bibleLocationFromReference } from '../shared/bible-projection-display'
import {
  clampProjectionContentInsetsByCategory,
  DEFAULT_PROJECTION_CONTENT_INSETS_BY_CATEGORY,
  type ProjectionContentInsetsByCategory
} from '../shared/projection-content-insets'
import {
  clampProjectionTypography,
  DEFAULT_PROJECTION_TYPOGRAPHY,
  projectionTypographyCssVars,
  type ProjectionTypography
} from '../shared/projection-typography'
import {
  WEB_BROWSER_USER_AGENT,
  WEB_SYNC_INSTALL_SCRIPT,
  WEB_TRY_PLAY_SCRIPT
} from '../shared/web-browser'

const mixer = new ProjectionMixerEngine()
const projectionWindows = new Map<number, BrowserWindow>()
const windowModes = new Map<number, 'shell' | 'web'>()
const renderWaiters = new Map<number, () => void>()

let mainAppWindow: BrowserWindow | null = null
let suppressCloseHandler = false

let projectionContentInsets: ProjectionContentInsetsByCategory = {
  ...DEFAULT_PROJECTION_CONTENT_INSETS_BY_CATEGORY,
  bible: { ...DEFAULT_PROJECTION_CONTENT_INSETS_BY_CATEGORY.bible },
  hymns: { ...DEFAULT_PROJECTION_CONTENT_INSETS_BY_CATEGORY.hymns },
  dictionary: { ...DEFAULT_PROJECTION_CONTENT_INSETS_BY_CATEGORY.dictionary }
}

let projectionTypography: ProjectionTypography = clampProjectionTypography(DEFAULT_PROJECTION_TYPOGRAPHY)

export function getHymnTypography(): ProjectionTypography {
  return projectionTypography
}

export function setHymnTypography(raw: unknown): ProjectionTypography {
  projectionTypography = clampProjectionTypography(raw)
  pushHymnTypographyToAllShellWindows()
  return projectionTypography
}

function pushHymnTypographyToWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  const vars = projectionTypographyCssVars(projectionTypography)
  try {
    const serialized = JSON.stringify(vars)
    void win.webContents
      .executeJavaScript(
        `(function (vars) {
          if (typeof window.__orionApplyHymnTypography === 'function') {
            window.__orionApplyHymnTypography(vars)
          }
        })(${serialized})`
      )
      .catch(() => {
        /* ignore */
      })
  } catch {
    /* ignore */
  }
  win.webContents.send('orion:hymn-typography', vars)
}

function pushHymnTypographyToAllShellWindows(): void {
  syncProjectionWindowRegistry()
  for (const [displayId, win] of projectionWindows) {
    if (windowModes.get(displayId) !== 'shell') continue
    pushHymnTypographyToWindow(win)
  }
}

export function getProjectionContentInsets(): ProjectionContentInsetsByCategory {
  return projectionContentInsets
}

export function setProjectionContentInsets(
  raw: ProjectionContentInsetsByCategory
): ProjectionContentInsetsByCategory {
  projectionContentInsets = clampProjectionContentInsetsByCategory(raw)
  pushContentInsetsToAllShellWindows()
  return projectionContentInsets
}

function pushContentInsetsToWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  const insets = projectionContentInsets
  try {
    const serialized = JSON.stringify(insets)
    void win.webContents
      .executeJavaScript(
        `(function (insets) {
          if (typeof window.__orionApplyContentInsets === 'function') {
            window.__orionApplyContentInsets(insets)
          }
        })(${serialized})`
      )
      .catch(() => {
        /* ignore */
      })
  } catch {
    /* ignore */
  }
  win.webContents.send('orion:projection-content-insets', insets)
}

function pushContentInsetsToAllShellWindows(): void {
  syncProjectionWindowRegistry()
  for (const [displayId, win] of projectionWindows) {
    if (windowModes.get(displayId) !== 'shell') continue
    pushContentInsetsToWindow(win)
  }
}

const focusGuarded = new WeakSet<BrowserWindow>()

function isOutputWindow(win: BrowserWindow): boolean {
  if (win.isDestroyed() || win === mainAppWindow) return false
  for (const output of projectionWindows.values()) {
    if (output === win) return true
  }
  return isProjectionShellWindow(win)
}

/** Output windows must not take the keyboard. Arrow keys stay on the operator app. */
function keepMainAppFocused(): void {
  const main = mainAppWindow
  if (!main || main.isDestroyed()) return
  const pull = (): void => {
    if (main.isDestroyed() || main.isFocused()) return
    const focused = BrowserWindow.getFocusedWindow()
    if (focused && !isOutputWindow(focused)) return
    main.focus()
  }
  pull()
  for (const delay of [40, 160, 450]) {
    setTimeout(pull, delay)
  }
}

export function setMainAppWindow(win: BrowserWindow | null): void {
  mainAppWindow = win
  if (!win || win.isDestroyed() || focusGuarded.has(win)) return
  focusGuarded.add(win)
  win.on('blur', () => {
    setTimeout(() => {
      const focused = BrowserWindow.getFocusedWindow()
      if (focused && isOutputWindow(focused)) keepMainAppFocused()
    }, 0)
  })
}

export function getMainAppWindow(): BrowserWindow | null {
  return mainAppWindow
}

let applyGeneration = 0
let applyChain: Promise<void> = Promise.resolve()

function enqueueStackWork<T>(work: () => Promise<T>): Promise<T> {
  const next = applyChain.then(work, work)
  applyChain = next.then(
    () => undefined,
    () => undefined
  )
  return next
}

function isProjectionShellWindow(win: BrowserWindow): boolean {
  if (win.isDestroyed()) return false
  if (win === mainAppWindow) return false
  try {
    return win.webContents.getURL().includes('projection.html')
  } catch {
    return false
  }
}

function syncProjectionWindowRegistry(): void {
  const displayOwners = new Map<number, BrowserWindow>()

  for (const [id, win] of [...projectionWindows.entries()]) {
    if (win.isDestroyed()) {
      projectionWindows.delete(id)
      windowModes.delete(id)
    }
  }

  for (const win of BrowserWindow.getAllWindows()) {
    if (!isProjectionShellWindow(win)) continue

    let displayId = displayIdForWindow(win)
    if (displayId == null) {
      displayId = screen.getDisplayMatching(win.getBounds()).id
    }

    const existing = displayOwners.get(displayId)
    if (existing && existing !== win && !existing.isDestroyed()) {
      forceDestroyWindow(win)
      continue
    }

    displayOwners.set(displayId, win)
    projectionWindows.set(displayId, win)
    windowModes.set(displayId, 'shell')
  }
}

function projectionOutputsOpen(): boolean {
  syncProjectionWindowRegistry()
  for (const win of projectionWindows.values()) {
    if (!win.isDestroyed()) return true
  }
  return false
}

function resolveTargetDisplayIds(requestedIds: number[] = []): number[] {
  syncProjectionWindowRegistry()
  const ids = new Set<number>()
  for (const id of requestedIds) {
    if (Number.isFinite(id)) ids.add(id)
  }
  for (const [id, win] of projectionWindows.entries()) {
    if (!win.isDestroyed()) ids.add(id)
  }
  if (ids.size === 0) {
    const all = screen.getAllDisplays()
    const primary = screen.getPrimaryDisplay()
    const external = all.find((d) => d.id !== primary.id) ?? primary
    if (external) ids.add(external.id)
  }
  return [...ids]
}

export function getStackState(): OrionStackState {
  return mixer.getStackState()
}

export function getPresentationUiState(): PresentationUiState {
  const open = projectionOutputsOpen() || mixer.hasActiveLayers()
  return mixer.getUiState(open)
}

function wireFromStackContent(content: OrionStackLayerContent) {
  const safe = sanitizeStackContent(content)
  return createStackWire(safe, imagePathToMediaUrl)
}

async function commitStageToOutputs(displayIds: number[]): Promise<void> {
  if (!mixer.hasActiveLayers()) {
    closeAllProjectionWindows()
    return
  }

  const targetIds = resolveTargetDisplayIds(displayIds)
  for (const displayId of targetIds) {
    const win = await ensureShellWindow(displayId)
    if (!win || win.isDestroyed()) continue
    const renderWait = waitForRendered(displayId, 1200)
    pushStageState(win)
    await renderWait
    revealOutputWindow(displayId)
  }
  pushDeckAudioOwners()
}

export function runProjectionCommand(
  command: OrionProjectionCommand,
  displayIds: number[]
): Promise<PresentationUiState> {
  return enqueueStackWork(async (): Promise<PresentationUiState> => {
    try {
      switch (command.type) {
        case 'set-layer': {
          const wire = wireFromStackContent(command.content)
          mixer.setLayer(command.source, wire)
          broadcastPresentationUi()
          await commitStageToOutputs(displayIds)
          break
        }
        case 'clear-layer': {
          mixer.clearLayer(command.source)
          broadcastPresentationUi()
          await commitStageToOutputs([])
          break
        }
        case 'clear-all': {
          mixer.clearAll()
          closeAllProjectionWindows()
          break
        }
      }
    } catch {
      /* ensure truth is still broadcast */
    }
    broadcastPresentationUi()
    return getPresentationUiState()
  })
}

export function applyStackLayer(
  source: OrionStackSource,
  content: OrionStackLayerContent,
  displayIds: number[]
): Promise<PresentationUiState> {
  return runProjectionCommand({ type: 'set-layer', source, content }, displayIds)
}

export function clearStackSource(source: OrionStackSource): Promise<PresentationUiState> {
  return runProjectionCommand({ type: 'clear-layer', source }, [])
}

function projectionPreloadPath(): string {
  return join(__dirname, '../preload/projection.js')
}

function projectionHtmlPath(): string {
  if (is.dev) {
    return join(process.cwd(), 'src/main/projection.html')
  }
  return join(__dirname, 'projection.html')
}

function getElectronDisplay(displayId: number): Display | undefined {
  return screen.getAllDisplays().find((d) => d.id === displayId)
}

function displayIdForWindow(win: BrowserWindow): number | undefined {
  for (const [id, tracked] of projectionWindows) {
    if (tracked === win) return id
  }
  return undefined
}

function stageStateFor(): ProjectionStageState {
  return mixer.getStageState()
}

function deckAudioOwnerId(): number | null {
  const ids = [...projectionWindows.keys()].filter((id) => {
    const win = projectionWindows.get(id)
    return !!win && !win.isDestroyed()
  })
  const primaryId = screen.getPrimaryDisplay().id
  return ids.includes(primaryId) ? primaryId : null
}

function pushWebAudioMutes(): void {
  const owner = deckAudioOwnerId()
  for (const [id, win] of projectionWindows) {
    if (windowModes.get(id) !== 'web' || win.isDestroyed()) continue
    win.webContents.setAudioMuted(id !== owner)
  }
}

function pushDeckAudioOwners(): void {
  const owner = deckAudioOwnerId()
  for (const [id, win] of projectionWindows) {
    if (win.isDestroyed()) continue
    const enabled = id === owner
    void win.webContents
      .executeJavaScript(`window.__orionSetDeckAudio && window.__orionSetDeckAudio(${enabled})`)
      .catch(() => {
        /* window not ready */
      })
  }
}

function pushStageState(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  const state = stageStateFor()
  win.webContents.send('orion:projection-stage', state)
  try {
    const serialized = JSON.stringify(state)
    void win.webContents
      .executeJavaScript(
        `(function (state) {
          if (typeof window.__orionRenderStage === 'function') {
            window.__orionRenderStage(state)
          }
        })(${serialized})`
      )
      .catch(() => {
        /* ignore */
      })
  } catch {
    /* ignore */
  }
}

function placeOnDisplayFullscreen(win: BrowserWindow, display: Display): void {
  if (win.isDestroyed()) return
  const apply = (): void => {
    if (win.isDestroyed()) return
    win.setBounds(display.bounds)
    if (!win.isVisible()) win.showInactive()
    if (!win.isFullScreen()) win.setFullScreen(true)
    keepMainAppFocused()
  }
  apply()
  if (process.platform === 'linux') win.once('enter-full-screen', apply)
  // Replacing a fullscreen shell window drops the new window out of fullscreen
  // unless the fullscreen request is repeated after the old one has closed.
  for (const delay of [120, 400]) {
    setTimeout(() => {
      if (win.isDestroyed()) return
      if (!win.isFullScreen()) {
        win.setBounds(display.bounds)
        win.showInactive()
        win.setFullScreen(true)
      }
      keepMainAppFocused()
    }, delay)
  }
}

function broadcastToAppWindows(channel: string, payload?: unknown): void {
  const projectionSet = new Set(projectionWindows.values())
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    if (projectionSet.has(win) || isProjectionShellWindow(win)) continue
    if (payload !== undefined) {
      win.webContents.send(channel, payload)
    } else {
      win.webContents.send(channel)
    }
  }
}

function broadcastPresentationUi(): void {
  const ui = getPresentationUiState()
  if (mainAppWindow && !mainAppWindow.isDestroyed()) {
    mainAppWindow.webContents.send('orion:presentation-ui-state', ui)
  }
  broadcastToAppWindows('orion:presentation-ui-state', ui)
}

function broadcastOutputPreviewFrame(displayId: number, dataUrl: string): void {
  const payload = { displayId, dataUrl }
  if (mainAppWindow && !mainAppWindow.isDestroyed()) {
    mainAppWindow.webContents.send('orion:output-preview-frame', payload)
  }
  broadcastToAppWindows('orion:output-preview-frame', payload)
}

function broadcastOutputPreviewClear(): void {
  if (mainAppWindow && !mainAppWindow.isDestroyed()) {
    mainAppWindow.webContents.send('orion:output-preview-clear')
  }
  broadcastToAppWindows('orion:output-preview-clear')
}

const previewEpoch = new Map<number, number>()

async function captureOutputPreview(win: BrowserWindow, displayId: number): Promise<void> {
  if (win.isDestroyed()) return
  const epoch = (previewEpoch.get(displayId) ?? 0) + 1
  previewEpoch.set(displayId, epoch)
  try {
    const image = await win.webContents.capturePage()
    if (win.isDestroyed() || image.isEmpty()) return
    if (previewEpoch.get(displayId) !== epoch) return
    const jpeg = image.toJPEG(82)
    const dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`
    broadcastOutputPreviewFrame(displayId, dataUrl)
  } catch {
    /* ignore capture failures */
  }
}

function handleProjectionWindowClosed(displayId: number): void {
  projectionWindows.delete(displayId)
  windowModes.delete(displayId)
  finishRenderWait(displayId)

  if (suppressCloseHandler) return

  let anyOpen = false
  for (const w of projectionWindows.values()) {
    if (!w.isDestroyed()) {
      anyOpen = true
      break
    }
  }
  if (!anyOpen) {
    mixer.clearAll()
    broadcastPresentationUi()
    broadcastOutputPreviewClear()
    broadcastToAppWindows('orion:projection-session-ended')
    return
  }
  pushDeckAudioOwners()
}

function cancelAllRenderWaits(): void {
  for (const done of renderWaiters.values()) {
    done()
  }
  renderWaiters.clear()
}

function forceDestroyWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  try {
    if (win.isFullScreen()) {
      win.setFullScreen(false)
    }
  } catch {
    /* ignore */
  }
  if (!win.isDestroyed()) {
    try {
      win.hide()
    } catch {
      /* ignore */
    }
  }
  if (!win.isDestroyed()) {
    try {
      win.destroy()
    } catch {
      /* ignore */
    }
  }
}

function bumpApplyGeneration(): void {
  applyGeneration += 1
}

function isApplyStale(generation: number): boolean {
  return generation !== applyGeneration
}

function finishRenderWait(displayId: number): void {
  const done = renderWaiters.get(displayId)
  if (done) done()
}

function waitForRendered(displayId: number, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const finish = (): void => {
      clearTimeout(timeout)
      renderWaiters.delete(displayId)
      resolve()
    }
    renderWaiters.set(displayId, finish)
    const timeout = setTimeout(finish, ms)
  })
}

const pendingWebScripts = new Map<number, Map<string, string>>()

/** Runs after the page stops loading. Calling executeJavaScript while loading stacks did-stop-loading listeners. */
function runWebScript(contents: WebContents, code: string, key: string): void {
  if (contents.isDestroyed()) return
  if (!contents.isLoading()) {
    void contents.executeJavaScript(code).catch(() => {
      /* page navigated away */
    })
    return
  }
  const id = contents.id
  let queued = pendingWebScripts.get(id)
  if (!queued) {
    queued = new Map()
    pendingWebScripts.set(id, queued)
    contents.once('did-stop-loading', () => {
      const scripts = pendingWebScripts.get(id)
      pendingWebScripts.delete(id)
      if (!scripts || contents.isDestroyed()) return
      for (const script of scripts.values()) {
        void contents.executeJavaScript(script).catch(() => {
          /* page navigated away */
        })
      }
    })
  }
  queued.set(key, code)
}

function revealOutputWindow(displayId: number): void {
  const win = projectionWindows.get(displayId)
  const display = getElectronDisplay(displayId) ?? screen.getPrimaryDisplay()
  if (!win || win.isDestroyed() || !display) return
  placeOnDisplayFullscreen(win, display)
}

function closeTrackedWindow(displayId: number): void {
  const win = projectionWindows.get(displayId)
  projectionWindows.delete(displayId)
  windowModes.delete(displayId)
  if (win && !win.isDestroyed()) {
    forceDestroyWindow(win)
  }
}

function createBaseWindow(display: Display): BrowserWindow {
  return new BrowserWindow({
    show: false,
    frame: false,
    roundedCorners: false,
    thickFrame: false,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    fullscreenable: true,
    focusable: false,
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    webPreferences: {
      preload: projectionPreloadPath(),
      sandbox: true,
      contextIsolation: true,
      autoplayPolicy: 'no-user-gesture-required'
    }
  })
}

async function waitForShellLoad(win: BrowserWindow): Promise<void> {
  if (win.isDestroyed()) return
  await new Promise<void>((resolve) => {
    if (!win.webContents.isLoading()) {
      resolve()
      return
    }
    const timer = setTimeout(resolve, 600)
    win.webContents.once('did-finish-load', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

async function ensureShellWindow(displayId: number): Promise<BrowserWindow | null> {
  const display = getElectronDisplay(displayId) ?? screen.getPrimaryDisplay()
  if (!display) return null

  if (windowModes.get(displayId) === 'web') {
    closeTrackedWindow(displayId)
  }

  let win = projectionWindows.get(displayId)
  if (win && !win.isDestroyed()) {
    windowModes.set(displayId, 'shell')
    return win
  }

  win = createBaseWindow(display)
  win.setMenuBarVisibility(false)
  win.on('closed', () => {
    handleProjectionWindowClosed(displayId)
  })

  projectionWindows.set(displayId, win)
  windowModes.set(displayId, 'shell')

  const loadReady = waitForShellLoad(win)
  await win.loadFile(projectionHtmlPath())
  await loadReady
  if (win.isDestroyed()) return null

  pushContentInsetsToWindow(win)
  pushHymnTypographyToWindow(win)

  return win
}

async function ensureWebWindow(displayId: number): Promise<BrowserWindow | null> {
  const display = getElectronDisplay(displayId) ?? screen.getPrimaryDisplay()
  if (!display) return null

  if (windowModes.get(displayId) === 'shell') {
    closeTrackedWindow(displayId)
  }

  let win = projectionWindows.get(displayId)
  if (!win || win.isDestroyed()) {
    win = new BrowserWindow({
      show: false,
      frame: false,
      roundedCorners: false,
      thickFrame: false,
      backgroundColor: '#000000',
      autoHideMenuBar: true,
      fullscreenable: true,
      focusable: false,
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        autoplayPolicy: 'no-user-gesture-required'
      }
    })
    win.setMenuBarVisibility(false)
    win.on('closed', () => {
      handleProjectionWindowClosed(displayId)
    })
    projectionWindows.set(displayId, win)
    windowModes.set(displayId, 'web')
  }

  return win
}

export function registerProjectionIpc(): void {
  ipcMain.handle('orion:projection-pull', () => {
    return stageStateFor()
  })

  ipcMain.on('orion:deck-media-transport', (_event, raw: unknown) => {
    if (!raw || typeof raw !== 'object') return
    const body = raw as { action?: unknown; index?: unknown; time?: unknown; epoch?: unknown }
    const action = body.action
    if (action !== 'play' && action !== 'pause' && action !== 'seek') return
    const index =
      typeof body.index === 'number' && body.index >= 0 && body.index < 16
        ? Math.floor(body.index)
        : 0
    const time =
      typeof body.time === 'number' && Number.isFinite(body.time) && body.time >= 0 && body.time < 86_400
        ? body.time
        : 0
    const epoch =
      typeof body.epoch === 'number' && Number.isFinite(body.epoch) && body.epoch >= 0 && body.epoch < 1_000_000_000
        ? Math.floor(body.epoch)
        : 0
    const command: DeckMediaClock = { action, index, time, epoch }
    rememberDeckMediaClock(command)
    const payload = JSON.stringify(command)
    for (const win of projectionWindows.values()) {
      if (win.isDestroyed()) continue
      void win.webContents
        .executeJavaScript(`window.__orionDeckMedia && window.__orionDeckMedia(${payload})`)
        .catch(() => {
          /* window not ready */
        })
    }
  })

  ipcMain.on('orion:web-media-transport', (_event, raw: unknown) => {
    if (!raw || typeof raw !== 'object') return
    const body = raw as {
      time?: unknown
      paused?: unknown
      rate?: unknown
      fullscreen?: unknown
      captions?: unknown
      epoch?: unknown
    }
    const time =
      typeof body.time === 'number' && Number.isFinite(body.time) && body.time >= 0 && body.time < 86_400
        ? body.time
        : 0
    const rate =
      typeof body.rate === 'number' && Number.isFinite(body.rate) && body.rate > 0 && body.rate <= 4
        ? body.rate
        : 1
    const epoch =
      typeof body.epoch === 'number' && Number.isFinite(body.epoch) && body.epoch >= 0 && body.epoch < 1_000_000_000
        ? Math.floor(body.epoch)
        : 0
    const payload = JSON.stringify({
      time,
      paused: body.paused === true,
      rate,
      fullscreen: body.fullscreen === true,
      captions: body.captions === true,
      epoch
    })
    for (const [id, win] of projectionWindows) {
      if (windowModes.get(id) !== 'web' || win.isDestroyed()) continue
      runWebScript(win.webContents, `window.__orionWebMedia && window.__orionWebMedia(${payload})`, 'sync')
    }
  })

  ipcMain.on('orion:library-media-transport', (_event, raw: unknown) => {
    if (!raw || typeof raw !== 'object') return
    const body = raw as { action?: unknown; time?: unknown; epoch?: unknown }
    const action = body.action
    if (action !== 'play' && action !== 'pause' && action !== 'seek') return
    const time =
      typeof body.time === 'number' && Number.isFinite(body.time) && body.time >= 0 && body.time < 86_400
        ? body.time
        : 0
    const epoch =
      typeof body.epoch === 'number' && Number.isFinite(body.epoch) && body.epoch >= 0 && body.epoch < 1_000_000_000
        ? Math.floor(body.epoch)
        : 0
    const payload = JSON.stringify({ action, time, epoch })
    for (const win of projectionWindows.values()) {
      if (win.isDestroyed()) continue
      void win.webContents
        .executeJavaScript(`window.__orionLibraryMedia && window.__orionLibraryMedia(${payload})`)
        .catch(() => {
          /* window not ready */
        })
    }
  })

  ipcMain.handle('orion:projection-content-insets-pull', () => getProjectionContentInsets())

  ipcMain.handle(
    'orion:set-projection-content-insets',
    (_event, raw: ProjectionContentInsetsByCategory) => setProjectionContentInsets(raw)
  )

  ipcMain.handle('orion:get-projection-content-insets', () => getProjectionContentInsets())

  ipcMain.handle('orion:hymn-typography-pull', () => projectionTypographyCssVars(projectionTypography))

  ipcMain.handle('orion:get-hymn-typography', () => getHymnTypography())

  ipcMain.handle('orion:set-hymn-typography', (_event, raw: unknown) => setHymnTypography(raw))

  ipcMain.on('orion:projection-rendered', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    const displayId = displayIdForWindow(win)
    if (displayId == null) return
    finishRenderWait(displayId)
    revealOutputWindow(displayId)
  })

  ipcMain.on('orion:projection-settled', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    const displayId = displayIdForWindow(win)
    if (displayId == null) return
    void captureOutputPreview(win, displayId)
  })
}

async function applyProjectionInner(
  generation: number,
  payload: OrionProjectionPayload,
  displayIds: number[]
): Promise<void> {
  if (isApplyStale(generation)) return

  const safe = sanitizeProjectionPayload(payload)

  if (safe.type === 'clear') {
    mixer.clearAll()
    closeAllProjectionWindows()
    return
  }

  if (safe.type === 'clear-overlay') {
    mixer.clearLayer('bible')
    broadcastPresentationUi()
    await commitStageToOutputs([])
    return
  }

  if (safe.type === 'bible') {
    const wire = wireFromStackContent({
      type: 'bible',
      reference: safe.reference,
      locationLabel: bibleLocationFromReference(safe.reference),
      translationLabel: 'Bible',
      verses: safe.verses,
      highlightVerse: safe.highlightVerse
    })
    mixer.setLayer('bible', wire)
    broadcastPresentationUi()
    await commitStageToOutputs(displayIds)
    return
  }

  if (safe.type === 'image') {
    const wire = wireFromStackContent({
      type: 'image',
      filePath: safe.filePath
    })
    mixer.setLayer('order', wire)
    broadcastPresentationUi()
    await commitStageToOutputs(displayIds)
    return
  }

  if (safe.type === 'web') {
    mixer.clearAll()
    const uniqueIds = resolveTargetDisplayIds(displayIds)
    const activeIds = new Set<number>()
    for (const displayId of uniqueIds) {
      if (isApplyStale(generation)) return
      const win = await ensureWebWindow(displayId)
      if (isApplyStale(generation)) return
      if (!win || win.isDestroyed()) continue
      activeIds.add(displayId)
      win.webContents.setUserAgent(WEB_BROWSER_USER_AGENT)
      win.webContents.session.setPermissionRequestHandler((contents, permission, callback) => {
        callback(
          permission === 'media' ||
            permission === 'pointerLock' ||
            (permission === 'fullscreen' && contents.getType() !== 'webview')
        )
      })
      win.webContents.setAudioMuted(displayId !== deckAudioOwnerId())
      const armOutput = (): void => {
        if (win.isDestroyed()) return
        runWebScript(win.webContents, WEB_SYNC_INSTALL_SCRIPT, 'install')
        runWebScript(win.webContents, WEB_TRY_PLAY_SCRIPT, 'play')
      }
      await win.loadURL(safe.url)
      armOutput()
      setTimeout(armOutput, 1200)
      if (isApplyStale(generation)) return
      revealOutputWindow(displayId)
      void captureOutputPreview(win, displayId)
    }
    if (isApplyStale(generation)) return
    for (const [id, win] of [...projectionWindows.entries()]) {
      if (!activeIds.has(id) && !win.isDestroyed()) {
        forceDestroyWindow(win)
        projectionWindows.delete(id)
        windowModes.delete(id)
      }
    }
    pushWebAudioMutes()
  }
}

export function applyProjection(
  payload: OrionProjectionPayload,
  displayIds: number[]
): Promise<void> {
  if (payload.type === 'clear') {
    bumpApplyGeneration()
    cancelAllRenderWaits()
    mixer.clearAll()
    closeAllProjectionWindows()
    applyChain = Promise.resolve()
    return Promise.resolve()
  }

  const generation = applyGeneration
  const run = async (): Promise<void> => {
    if (isApplyStale(generation)) return
    await applyProjectionInner(generation, payload, displayIds)
    broadcastPresentationUi()
  }
  const done = applyChain.then(run, run)
  applyChain = done.catch(() => {})
  return done
}

export function closeAllProjectionWindows(): void {
  suppressCloseHandler = true
  try {
    cancelAllRenderWaits()
    mixer.clearAll()

    const toDestroy = new Set<BrowserWindow>(projectionWindows.values())
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      if (win === mainAppWindow) continue
      if (isProjectionShellWindow(win)) {
        toDestroy.add(win)
      }
    }

    projectionWindows.clear()
    windowModes.clear()

    for (const win of toDestroy) {
      forceDestroyWindow(win)
    }
  } finally {
    suppressCloseHandler = false
  }
  broadcastPresentationUi()
  broadcastOutputPreviewClear()
  broadcastToAppWindows('orion:projection-session-ended')
}

export function repositionProjectionWindows(): void {
  for (const [displayId, win] of [...projectionWindows.entries()]) {
    if (win.isDestroyed()) {
      projectionWindows.delete(displayId)
      windowModes.delete(displayId)
      continue
    }
    const display = getElectronDisplay(displayId)
    if (!display) {
      forceDestroyWindow(win)
      projectionWindows.delete(displayId)
      windowModes.delete(displayId)
      continue
    }
    placeOnDisplayFullscreen(win, display)
  }
}
