import { BrowserWindow, ipcMain, screen, type Display, type NativeImage, type WebContents } from 'electron'
import { join } from 'path'
import type { OrionProjectionPayload } from '../shared/projection'
import type {
  OrionProjectionCommand,
  OrionStackLayerContent,
  OrionStackState
} from '../shared/projection-stack'
import { type PresentationUiState } from '../shared/presentation-ui-state'
import {
  createStackWire,
  ProjectionMixerEngine,
  type ProjectionStageState
} from '../shared/projection-mixer'
import { appIcon } from './app-icon'
import { is } from './env'
import { rememberDeckMediaClock, type DeckMediaClock } from './deck-media-clock'
import { imagePathToMediaUrl, sanitizeProjectionPayload, sanitizeStackContent } from './projection-paths'
import {
  hideNativeOutput,
  nativeOutputRequested,
  presentNativeStage,
  shutdownNativeOutput,
  stageUsesNativeOutput
} from './native-output'
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
let stillCaptureWindow: BrowserWindow | null = null
const stillCaptureContents = new Set<number>()
const fullscreenEpoch = new WeakMap<BrowserWindow, number>()
let outputEpoch = 0
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
  if (win === mainAppWindow || win === stillCaptureWindow) return false
  try {
    if (stillCaptureContents.has(win.webContents.id)) return false
    if (win.getTitle() === 'orion-preview-capture') return false
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

function outputAlreadyShowing(win: BrowserWindow, displayId: number): boolean {
  const display = getElectronDisplay(displayId)
  if (!display) return false
  return coversDisplay(win, display)
}

function releaseChromiumOutputs(): void {
  suppressCloseHandler = true
  try {
    cancelAllRenderWaits()
    const toDestroy = [...projectionWindows.values()]
    projectionWindows.clear()
    windowModes.clear()
    for (const win of toDestroy) {
      if (!win.isDestroyed()) forceDestroyWindow(win)
    }
  } finally {
    suppressCloseHandler = false
  }
}

async function commitStageToOutputs(displayIds: number[]): Promise<void> {
  if (!mixer.hasActiveLayers()) {
    closeAllProjectionWindows()
    return
  }

  const targetIds = resolveTargetDisplayIds(displayIds)
  if (nativeOutputRequested()) {
    const state = stageStateFor()
    if (stageUsesNativeOutput(state)) {
      const displays = targetIds.flatMap((id) => {
        const display = getElectronDisplay(id)
        if (!display) return []
        return [{
          id,
          x: display.bounds.x,
          y: display.bounds.y,
          width: display.bounds.width,
          height: display.bounds.height,
          topmost: !isOperatorDisplay(display)
        }]
      })
      if (await presentNativeStage(displays, state, projectionTypography)) {
        releaseChromiumOutputs()
        return
      }
    } else {
      hideNativeOutput()
    }
  }

  for (const displayId of targetIds) {
    const existing = projectionWindows.get(displayId)
    const keepPlacement =
      existing !== undefined && !existing.isDestroyed() && outputAlreadyShowing(existing, displayId)
    const win = keepPlacement ? existing : await ensureShellWindow(displayId)
    if (!win || win.isDestroyed()) continue
    const renderWait = waitForRendered(displayId, 1200)
    pushStageState(win)
    enqueueStillCapture(displayId)
    await renderWait
    if (!keepPlacement) revealOutputWindow(displayId)
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
  for (const [id, win] of projectionWindows) {
    if (win.isDestroyed()) continue
    if (windowModes.get(id) === 'shell') win.webContents.setAudioMuted(true)
    void win.webContents
      .executeJavaScript(`window.__orionSetDeckAudio && window.__orionSetDeckAudio(false)`)
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

function bumpFullscreenEpoch(win: BrowserWindow): number {
  const next = (fullscreenEpoch.get(win) ?? 0) + 1
  fullscreenEpoch.set(win, next)
  return next
}

function boundsMatchDisplay(win: BrowserWindow, display: Display): boolean {
  try {
    const bounds = win.getBounds()
    const target = display.bounds
    return (
      Math.abs(bounds.x - target.x) <= 4 &&
      Math.abs(bounds.y - target.y) <= 4 &&
      Math.abs(bounds.width - target.width) <= 4 &&
      Math.abs(bounds.height - target.height) <= 4
    )
  } catch {
    return false
  }
}

function operatorDisplay(): Display | null {
  const main = mainAppWindow
  if (!main || main.isDestroyed()) return null
  return screen.getDisplayMatching(main.getBounds())
}

function isOperatorDisplay(display: Display): boolean {
  return operatorDisplay()?.id === display.id
}

function isNativeFullscreen(win: BrowserWindow): boolean {
  try {
    return win.isFullScreen()
  } catch {
    return false
  }
}

function isMacSimpleFullscreen(win: BrowserWindow): boolean {
  if (process.platform !== 'darwin') return false
  try {
    return win.isSimpleFullScreen()
  } catch {
    return false
  }
}

function coversDisplay(win: BrowserWindow, display: Display): boolean {
  if (win.isDestroyed() || !win.isVisible()) return false
  if (isMacSimpleFullscreen(win) || isNativeFullscreen(win)) return true
  // Windows can report a covering output as not fullscreen. Calling setBounds
  // again then drops it out of fullscreen and leaves a blank window behind.
  // Linux and macOS must not use that shortcut: a window can already sit on
  // the display rectangle and still not be fullscreen.
  if (process.platform !== 'win32') return false
  return boundsMatchDisplay(win, display)
}

function showOutputOpaque(win: BrowserWindow): void {
  try {
    win.setOpacity(1)
  } catch {
    /* opacity is unavailable on this window */
  }
  if (!win.isVisible()) win.showInactive()
}

function placeOnDisplayFullscreen(win: BrowserWindow, display: Display): void {
  if (win.isDestroyed()) return
  const epoch = bumpFullscreenEpoch(win)
  const apply = (): void => {
    if (win.isDestroyed() || fullscreenEpoch.get(win) !== epoch) return
    if (coversDisplay(win, display)) {
      showOutputOpaque(win)
      if (!isOperatorDisplay(display)) keepMainAppFocused()
      return
    }
    if (isOperatorDisplay(display)) {
      try {
        win.setFullScreen(false)
      } catch {
        /* already leaving fullscreen */
      }
      win.setAlwaysOnTop(false)
      win.setBounds(display.bounds)
      showOutputOpaque(win)
      return
    }
    if (process.platform === 'darwin') {
      // Native fullscreen moves Orion into another Space. Simple fullscreen
      // covers the display the window is already on and leaves the operator
      // window where it is.
      if (!boundsMatchDisplay(win, display)) win.setBounds(display.bounds)
      showOutputOpaque(win)
      try {
        win.setSimpleFullScreen(true)
      } catch {
        if (!isNativeFullscreen(win)) win.setFullScreen(true)
      }
      keepMainAppFocused()
      return
    }
    if (process.platform === 'linux') {
      // setBounds while a fullscreen transition is running is what the
      // compositor uses to drop the window back out.
      if (!boundsMatchDisplay(win, display)) win.setBounds(display.bounds)
      showOutputOpaque(win)
      try {
        win.setFullScreen(true)
      } catch {
        /* the window manager rejected fullscreen */
      }
      keepMainAppFocused()
      return
    }
    win.setBounds(display.bounds)
    try {
      win.setOpacity(0)
    } catch {
      /* opacity is unavailable on this window */
    }
    if (!win.isVisible()) win.showInactive()
    if (!isNativeFullscreen(win)) win.setFullScreen(true)
    keepMainAppFocused()
    setTimeout(() => {
      if (win.isDestroyed() || fullscreenEpoch.get(win) !== epoch) return
      showOutputOpaque(win)
      keepMainAppFocused()
    }, 220)
  }
  apply()
  if (process.platform === 'linux' || process.platform === 'darwin') {
    win.once('enter-full-screen', () => {
      if (fullscreenEpoch.get(win) !== epoch) return
      apply()
    })
  }
  // Replacing a fullscreen shell window drops the new window out of fullscreen
  // unless the fullscreen request is repeated after the old one has closed.
  for (const delay of [120, 400]) {
    setTimeout(apply, delay)
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

let stillCaptureDisplayId: number | null = null
let stillSettledResolve: (() => void) | null = null
let stillPaintWaiter: ((image: NativeImage) => void) | null = null
let stillCaptureLayoutWidth = 0
let stillCaptureLayoutHeight = 0
let outputPreviewOpen = true
let stillQueue: Promise<void> = Promise.resolve()
let stillQueueDepth = 0

// A window parked off-screen is painted by the Windows compositor and ignored by
// Wayland, so Linux photographs an offscreen surface that is never shown.
const linuxOffscreenCapture = process.platform === 'linux'

function releaseStillCaptureWindow(): void {
  if (stillQueueDepth > 0) return
  stillCaptureDisplayId = null
  stillCaptureLayoutWidth = 0
  stillCaptureLayoutHeight = 0
  stillPaintWaiter = null
  if (stillCaptureWindow && !stillCaptureWindow.isDestroyed()) {
    forceDestroyWindow(stillCaptureWindow)
  }
  stillCaptureWindow = null
}

function wakeStillCapturePainting(win: BrowserWindow): void {
  if (!linuxOffscreenCapture || win.isDestroyed()) return
  try {
    win.webContents.setFrameRate(30)
    if (!win.webContents.isPainting()) win.webContents.startPainting()
  } catch {
    /* painting is best-effort until the page is ready */
  }
}

function waitForStillPaint(timeoutMs: number): Promise<NativeImage | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (stillPaintWaiter === finish) stillPaintWaiter = null
      resolve(null)
    }, timeoutMs)
    const finish = (image: NativeImage): void => {
      clearTimeout(timer)
      resolve(image)
    }
    stillPaintWaiter = finish
  })
}

async function placeStillCaptureWindow(win: BrowserWindow, width: number, height: number): Promise<void> {
  if (!linuxOffscreenCapture) {
    win.setOpacity(0)
    win.setBounds({ x: -32000, y: -32000, width, height })
    if (!win.isVisible()) win.showInactive()
    return
  }
  const bounds = win.getBounds()
  if (bounds.width !== width || bounds.height !== height) {
    win.setBounds({ x: 0, y: 0, width, height })
  }
  if (stillCaptureLayoutWidth === width && stillCaptureLayoutHeight === height) return
  const scale = width > 960 ? 960 / width : 1
  if (scale === 1) {
    stillCaptureLayoutWidth = width
    stillCaptureLayoutHeight = height
    return
  }
  try {
    const dbg = win.webContents.debugger
    if (!dbg.isAttached()) dbg.attach('1.3')
    // Layout stays at the projector size so line breaks match. The bitmap is the
    // preview width, which is all the card keeps after the JPEG encode.
    await dbg.sendCommand('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: scale,
      mobile: false,
      dontSetVisibleSize: true
    })
    stillCaptureLayoutWidth = width
    stillCaptureLayoutHeight = height
  } catch {
    stillCaptureLayoutWidth = 0
    stillCaptureLayoutHeight = 0
  }
}

function enqueueStillCapture(displayId: number): void {
  if (!outputPreviewOpen) return
  stillQueueDepth += 1
  stillQueue = stillQueue
    .then(() => {
      if (!outputPreviewOpen) return
      return captureStillPreview(displayId)
    })
    .catch(() => {
      /* one display's preview must not block the next */
    })
    .finally(() => {
      stillQueueDepth = Math.max(0, stillQueueDepth - 1)
    })
}

function refreshOutputPreviews(): void {
  if (!outputPreviewOpen) return
  for (const [displayId, win] of projectionWindows) {
    if (win.isDestroyed()) continue
    if (windowModes.get(displayId) === 'web') {
      void captureOutputPreview(win, displayId)
    } else {
      enqueueStillCapture(displayId)
    }
  }
}

function finishStillSettled(): void {
  const done = stillSettledResolve
  stillSettledResolve = null
  done?.()
}

function waitForStillSettled(timeoutMs: number): Promise<void> {
  finishStillSettled()
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (stillSettledResolve === finish) stillSettledResolve = null
      resolve()
    }, timeoutMs)
    const finish = (): void => {
      clearTimeout(timer)
      resolve()
    }
    stillSettledResolve = finish
  })
}

async function ensureStillCaptureWindow(
  width: number,
  height: number,
  epoch: number
): Promise<BrowserWindow | null> {
  const w = Math.max(640, Math.round(width))
  const h = Math.max(360, Math.round(height))
  if (!stillCaptureWindow || stillCaptureWindow.isDestroyed()) {
    stillCaptureLayoutWidth = 0
    stillCaptureLayoutHeight = 0
    stillCaptureWindow = new BrowserWindow({
      show: false,
      frame: false,
      roundedCorners: false,
      thickFrame: false,
      hasShadow: false,
      backgroundColor: '#000000',
      skipTaskbar: true,
      focusable: false,
      opacity: linuxOffscreenCapture ? 1 : 0,
      enableLargerThanScreen: true,
      title: 'orion-preview-capture',
      x: linuxOffscreenCapture ? 0 : -32000,
      y: linuxOffscreenCapture ? 0 : -32000,
      width: w,
      height: h,
      webPreferences: {
        preload: projectionPreloadPath(),
        sandbox: true,
        contextIsolation: true,
        backgroundThrottling: false,
        spellcheck: false,
        ...(linuxOffscreenCapture ? { offscreen: true, partition: 'orion-still' } : {})
      }
    })
    stillCaptureWindow.setIgnoreMouseEvents(true)
    stillCaptureContents.add(stillCaptureWindow.webContents.id)
    if (linuxOffscreenCapture) {
      stillCaptureWindow.webContents.on('paint', (_event, _dirty, image) => {
        if (image.isEmpty() || !stillPaintWaiter) return
        const resolve = stillPaintWaiter
        stillPaintWaiter = null
        resolve(image)
      })
    }
    stillCaptureWindow.on('closed', () => {
      stillCaptureWindow = null
      stillCaptureLayoutWidth = 0
      stillCaptureLayoutHeight = 0
    })
    const loadReady = waitForShellLoad(stillCaptureWindow)
    await stillCaptureWindow.loadFile(projectionHtmlPath())
    await loadReady
    if (!stillCaptureWindow || stillCaptureWindow.isDestroyed() || epoch !== outputEpoch) return null
    pushContentInsetsToWindow(stillCaptureWindow)
    pushHymnTypographyToWindow(stillCaptureWindow)
  }
  const win = stillCaptureWindow
  if (!win || epoch !== outputEpoch || win.isDestroyed()) return null
  await placeStillCaptureWindow(win, w, h)
  if (epoch !== outputEpoch || win.isDestroyed()) return null
  await win.webContents.executeJavaScript('window.__orionStillCapture = true')
  if (epoch !== outputEpoch || win.isDestroyed()) return null
  wakeStillCapturePainting(win)
  return win
}

async function captureStillPreview(displayId: number): Promise<void> {
  const epoch = outputEpoch
  const display = getElectronDisplay(displayId)
  if (!display) return
  try {
    const win = await ensureStillCaptureWindow(display.bounds.width, display.bounds.height, epoch)
    if (!win || epoch !== outputEpoch || win.isDestroyed()) return
    stillCaptureDisplayId = displayId
    const settled = waitForStillSettled(1800)
    if (epoch !== outputEpoch) return
    pushStageState(win)
    await settled
  } catch {
    finishStillSettled()
  }
}

const previewBusy = new Set<number>()
const previewAgain = new Set<number>()

async function captureOutputPreview(win: BrowserWindow, displayId: number): Promise<void> {
  if (win.isDestroyed()) return
  if (previewBusy.has(displayId)) {
    previewAgain.add(displayId)
    return
  }
  const epoch = (previewEpoch.get(displayId) ?? 0) + 1
  previewEpoch.set(displayId, epoch)
  previewBusy.add(displayId)
  const still = linuxOffscreenCapture && win === stillCaptureWindow
  try {
    let image: NativeImage | null = null
    if (still) {
      // capturePage reads the full compositor buffer and is the slow part on
      // Linux. The offscreen paint is already the preview-sized bitmap.
      wakeStillCapturePainting(win)
      const paintedPromise = waitForStillPaint(140)
      try {
        win.webContents.invalidate()
      } catch {
        /* the paint listener still runs if a frame is in flight */
      }
      const painted = await paintedPromise
      image = painted && !painted.isEmpty() ? painted : null
    }
    if (!image) image = await win.webContents.capturePage()
    if (win.isDestroyed() || image.isEmpty()) return
    if (previewEpoch.get(displayId) !== epoch) return
    const size = image.getSize()
    const framed = size.width > 960 ? image.resize({ width: 960 }) : image
    const jpeg = framed.toJPEG(74)
    const dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`
    broadcastOutputPreviewFrame(displayId, dataUrl)
  } catch {
    /* ignore capture failures */
  } finally {
    previewBusy.delete(displayId)
    const again = previewAgain.delete(displayId) && !win.isDestroyed()
    if (again) {
      void captureOutputPreview(win, displayId)
    }
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

const OUTPUT_FADE_MS = 420
const fadingOutputs = new WeakSet<BrowserWindow>()

function fadeOutputWindow(win: BrowserWindow): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now()
    const step = (): void => {
      if (win.isDestroyed()) {
        resolve()
        return
      }
      const t = Math.min(1, (Date.now() - started) / OUTPUT_FADE_MS)
      const opacity = (1 - t) * (1 - t)
      try {
        win.setOpacity(opacity)
      } catch {
        resolve()
        return
      }
      if (t >= 1) {
        resolve()
        return
      }
      setTimeout(step, 16)
    }
    step()
  })
}

function forceDestroyWindow(win: BrowserWindow): void {
  if (win.isDestroyed() || fadingOutputs.has(win)) return
  fadingOutputs.add(win)
  bumpFullscreenEpoch(win)
  const finish = (): void => {
    if (win.isDestroyed()) return
    try {
      win.hide()
    } catch {
      /* ignore */
    }
    try {
      win.destroy()
    } catch {
      /* ignore */
    }
    if (!win.isDestroyed()) {
      try {
        win.close()
      } catch {
        /* ignore */
      }
    }
  }
  const leaveFullscreenAndClose = (): void => {
    if (win.isDestroyed()) return
    let fullscreen = false
    try {
      fullscreen = win.isFullScreen()
    } catch {
      fullscreen = false
    }
    if (process.platform === 'darwin') {
      let simple = false
      try {
        simple = win.isSimpleFullScreen()
      } catch {
        simple = false
      }
      if (simple) {
        win.once('leave-full-screen', finish)
        try {
          win.setOpacity(0)
        } catch {
          /* ignore */
        }
        try {
          win.setSimpleFullScreen(false)
        } catch {
          finish()
          return
        }
        setTimeout(finish, 280)
        return
      }
    }
    if (!fullscreen) {
      finish()
      return
    }
    // Windows ignores destroy while a fullscreen transition is in progress, and a
    // pending fullscreen retry would show the presentation again.
    win.once('leave-full-screen', finish)
    try {
      win.setOpacity(0)
    } catch {
      /* ignore */
    }
    try {
      win.setFullScreen(false)
    } catch {
      finish()
      return
    }
    setTimeout(finish, 280)
  }
  let visible = false
  try {
    visible = win.isVisible()
  } catch {
    visible = false
  }
  if (!visible) {
    leaveFullscreenAndClose()
    return
  }
  void fadeOutputWindow(win).then(leaveFullscreenAndClose)
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
    hasShadow: false,
    autoHideMenuBar: true,
    fullscreenable: true,
    focusable: false,
    icon: appIcon(),
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    webPreferences: {
      preload: projectionPreloadPath(),
      sandbox: true,
      contextIsolation: true,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false,
      spellcheck: false
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
    hasShadow: false,
    autoHideMenuBar: true,
    fullscreenable: true,
    focusable: false,
    icon: appIcon(),
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false,
      spellcheck: false
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
  ipcMain.on('orion:output-preview-open', (_event, open: unknown) => {
    outputPreviewOpen = open === true
    if (!outputPreviewOpen) {
      if (stillQueueDepth === 0) releaseStillCaptureWindow()
      return
    }
    refreshOutputPreviews()
  })

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
    if (stillCaptureWindow && win === stillCaptureWindow) {
      const displayId = stillCaptureDisplayId
      if (displayId == null) return
      void captureOutputPreview(win, displayId).finally(() => finishStillSettled())
      return
    }
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
  hideNativeOutput()
  outputEpoch += 1
  finishStillSettled()
  suppressCloseHandler = true
  try {
    if (stillCaptureWindow && !stillCaptureWindow.isDestroyed()) {
      forceDestroyWindow(stillCaptureWindow)
    }
    stillCaptureWindow = null
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
