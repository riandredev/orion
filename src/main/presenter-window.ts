import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import type { PresenterViewState } from '../shared/presenter-view-state'
import { emptyPresenterViewState } from '../shared/presenter-view-state'
import { getPresentationDeck } from './presentation-decks'
import { getMainAppWindow } from './projection'
import { currentDeckMediaClock } from './deck-media-clock'
import { appIcon } from './app-icon'
import { is } from './env'

let presenterWindow: BrowserWindow | null = null
let presenterState: PresenterViewState = emptyPresenterViewState()

function presenterWindowUrl(): string {
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/presenter.html`
  }
  return join(__dirname, '../renderer/presenter.html')
}

function mutePresenterWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  win.webContents.setAudioMuted(true)
}

function broadcastPresenterState(): void {
  const payload = presenterState
  presenterWindow?.webContents.send('orion:presenter-view-state', payload)
}

function broadcastSlideToMain(): void {
  getMainAppWindow()?.webContents.send('orion:presenter-slide-from-window', {
    deckId: presenterState.deckId,
    slideIndex: presenterState.slideIndex
  })
}

async function silencePresenterMedia(win: BrowserWindow): Promise<void> {
  if (win.isDestroyed()) return
  await win.webContents
    .executeJavaScript(
      `(() => {
        for (const el of document.querySelectorAll('video, audio')) {
          el.muted = true
          el.volume = 0
          el.pause()
          el.removeAttribute('src')
          el.src = ''
          try { el.load() } catch (e) {}
        }
      })()`
    )
    .catch(() => {
      /* window already gone */
    })
}

async function closePresenterWindowInternal(): Promise<void> {
  const win = presenterWindow
  presenterWindow = null
  if (win && !win.isDestroyed()) {
    await silencePresenterMedia(win)
    if (!win.isDestroyed()) win.close()
  }
  presenterState = emptyPresenterViewState()
  broadcastSlideToMain()
}

export function isPresenterViewOpen(): boolean {
  return presenterWindow != null && !presenterWindow.isDestroyed()
}

export function getPresenterViewState(): PresenterViewState {
  return presenterState
}

export async function syncPresenterSlideFromMain(
  deckId: string | null,
  slideIndex: number,
  buildStep = 0
): Promise<void> {
  if (!isPresenterViewOpen() || !deckId || presenterState.deckId !== deckId) return
  const clamped = Math.max(0, Math.min(slideIndex, Math.max(0, presenterState.slideCount - 1)))
  const step = Math.max(0, buildStep)
  if (clamped === presenterState.slideIndex && step === presenterState.buildStep) return
  presenterState = { ...presenterState, slideIndex: clamped, buildStep: step }
  broadcastPresenterState()
}

export async function openPresenterView(
  deckId: string,
  slideIndex: number,
  buildStep = 0
): Promise<void> {
  const deck = await getPresentationDeck(deckId)
  if (!deck || deck.slides.length === 0) {
    throw new Error('No deck loaded.')
  }

  const clamped = Math.max(0, Math.min(slideIndex, deck.slides.length - 1))
  presenterState = {
    open: true,
    showAllSlides: false,
    deckId: deck.id,
    deckTitle: deck.title,
    sourceExt: deck.sourceExt,
    engine: deck.engine,
    slideIndex: clamped,
    buildStep: Math.max(0, buildStep),
    slideCount: deck.slides.length,
    slides: deck.slides
  }

  if (presenterWindow && !presenterWindow.isDestroyed()) {
    mutePresenterWindow(presenterWindow)
    if (!presenterWindow.isMaximized()) presenterWindow.maximize()
    presenterWindow.focus()
    broadcastPresenterState()
    return
  }

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const area = display.workArea
  const width = Math.max(880, Math.min(1280, area.width - 80))
  const height = Math.max(620, Math.min(820, area.height - 80))

  presenterWindow = new BrowserWindow({
    x: area.x + Math.round((area.width - width) / 2),
    y: area.y + Math.round((area.height - height) / 2),
    width,
    height,
    minWidth: 880,
    minHeight: 620,
    show: false,
    fullscreen: false,
    fullscreenable: true,
    autoHideMenuBar: true,
    backgroundColor: '#1e1e1e',
    icon: appIcon(),
    title: `Presenter View — ${deck.title}`,
    webPreferences: {
      preload: join(__dirname, '../preload/presenter.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  presenterWindow.on('closed', () => {
    presenterWindow = null
    presenterState = emptyPresenterViewState()
  })

  mutePresenterWindow(presenterWindow)

  presenterWindow.on('ready-to-show', () => {
    const icon = appIcon()
    if (presenterWindow && !icon.isEmpty()) presenterWindow.setIcon(icon)
    if (presenterWindow) mutePresenterWindow(presenterWindow)
    presenterWindow?.maximize()
    presenterWindow?.show()
  })

  const sendOpenState = (): void => {
    broadcastPresenterState()
    const clock = currentDeckMediaClock()
    if (clock && presenterWindow && !presenterWindow.isDestroyed()) {
      presenterWindow.webContents.send('orion:deck-media-sync', clock)
    }
  }
  presenterWindow.webContents.on('did-finish-load', sendOpenState)

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    await presenterWindow.loadURL(presenterWindowUrl())
  } else {
    await presenterWindow.loadFile(join(__dirname, '../renderer/presenter.html'))
  }
  sendOpenState()
}

export function registerPresenterWindowIpc(): void {
  ipcMain.on('orion:deck-media-transport', (_event, raw: unknown) => {
    if (!presenterWindow || presenterWindow.isDestroyed()) return
    presenterWindow.webContents.send('orion:deck-media-sync', raw)
  })

  ipcMain.handle(
    'orion:open-presenter-view',
    async (_event, deckId: string, slideIndex: number, buildStep?: number) => {
      await openPresenterView(deckId, slideIndex, buildStep ?? 0)
    }
  )

  ipcMain.handle('orion:close-presenter-view', () => closePresenterWindowInternal())

  ipcMain.handle('orion:is-presenter-view-open', () => isPresenterViewOpen())

  ipcMain.handle('orion:get-presenter-view-state', () => getPresenterViewState())
  ipcMain.handle('orion:deck-media-current', () => currentDeckMediaClock())

  ipcMain.handle('orion:presenter-set-slide-index', (_event, slideIndex: number) => {
    if (!isPresenterViewOpen()) return
    const clamped = Math.max(
      0,
      Math.min(slideIndex, Math.max(0, presenterState.slideCount - 1))
    )
    presenterState = { ...presenterState, slideIndex: clamped, buildStep: 0, showAllSlides: false }
    broadcastPresenterState()
    broadcastSlideToMain()
  })

  ipcMain.handle('orion:presenter-set-show-all-slides', (_event, show: boolean) => {
    if (!isPresenterViewOpen()) return
    presenterState = { ...presenterState, showAllSlides: show }
    broadcastPresenterState()
  })

  ipcMain.handle('orion:presenter-step-slide', (_event, delta: number) => {
    if (!isPresenterViewOpen()) return
    const step = delta < 0 ? -1 : 1
    getMainAppWindow()?.webContents.send('orion:presentation-step-from-presenter', step)
  })
}

export function closePresenterViewOnQuit(): void {
  void closePresenterWindowInternal()
}
