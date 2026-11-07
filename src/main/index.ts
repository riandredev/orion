import { app, BrowserWindow, dialog, ipcMain, screen, session, shell, webContents } from 'electron'
import { existsSync } from 'fs'
import { copyFile, mkdir, readdir, stat } from 'fs/promises'
import { basename, extname, join } from 'path'
import type { OrionProjectionPayload } from '../shared/projection'
import { WEB_BROWSER_USER_AGENT } from '../shared/web-browser'
import type { OrionProjectionCommand, OrionStackState } from '../shared/projection-stack'
import { displayInfoFromElectron, sortDisplays } from './displays'
import { appIcon } from './app-icon'
import { seedPackagedLibraries } from './content-seed'
import { readEdition } from './edition'
import { is } from './env'
import { biblesRoot, imagesRoot, orderImagesRoot } from './paths'
import {
  createMediaFolder,
  importMediaIntoFolder,
  listMediaFolders,
  listMediaInFolder,
  removeMediaFile
} from './media-library'
import { isPathUnderRoot } from './projection-paths'
import {
  downloadHelloAoTranslation,
  getBibleChapter,
  importBibleFromDialog,
  listInstalledBibles,
  listOnlineBibleTranslations,
  searchInstalledBible,
  removeInstalledBible
} from './bible-library'
import {
  ensureDictionaryReady,
  getDictionaryIndexProgress,
  getDictionaryLexiconEntry,
  getDictionaryScriptureOccurrences,
  searchDictionaryEntries,
  warmDictionaryLexiconIndex
} from './dictionary'
import {
  getHymnEntry,
  getHymnalIndex,
  importHymnalFolderFromDialog,
  importHymnalFromDialog,
  importBibsoftMdbFromDialog,
  listInstalledHymnals,
  upsertHymnEntry,
  deleteHymnEntry,
  ensurePersonalHymnal
} from './hymnals'
import { rasterizeMetafiles } from './metafile-raster'
import { applyProjection, closeAllProjectionWindows, getMainAppWindow, getPresentationUiState, getStackState, registerProjectionIpc, repositionProjectionWindows, runProjectionCommand, setMainAppWindow } from './projection'
import { exportProfileFileToDialog, importProfileFileFromDialog } from './profile-files'
import { exportSequenceFileToDialog, importSequenceFileFromDialog } from './sequence-files'
import {
  cancelPresentationImportDepsDownload,
  downloadPresentationImportDeps,
  getPresentationImportDepsStatus
} from './presentation-import-deps'
import {
  getPresentationDeck,
  importPresentationDeckFromDialog,
  listPresentationDecks,
  readPresentationDeckSource,
  removePresentationDeck
} from './presentation-decks'
import { closePresenterViewOnQuit, registerPresenterWindowIpc, syncPresenterSlideFromMain } from './presenter-window'

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp'])

async function listOrderFolders(): Promise<
  { name: string; imageCount: number }[]
> {
  const root = orderImagesRoot()
  let entries: string[]
  try {
    entries = await readdir(root)
  } catch {
    return []
  }

  const folders: { name: string; imageCount: number }[] = []
  for (const name of entries) {
    const folderPath = join(root, name)
    const info = await stat(folderPath)
    if (!info.isDirectory()) continue
    const files = await readdir(folderPath)
    const imageCount = files.filter((f) =>
      IMAGE_EXT.has(f.slice(f.lastIndexOf('.')).toLowerCase())
    ).length
    folders.push({ name, imageCount })
  }
  return folders.sort((a, b) => a.name.localeCompare(b.name))
}

async function listImagesInOrderFolder(
  folderName: string
): Promise<{ name: string; path: string }[]> {
  const folderPath = join(orderImagesRoot(), folderName)
  try {
    const info = await stat(folderPath)
    if (!info.isDirectory()) return []
  } catch {
    return []
  }

  const files = await readdir(folderPath)
  const images = files
    .filter((f) => IMAGE_EXT.has(f.slice(f.lastIndexOf('.')).toLowerCase()))
    .map((name) => ({ name, path: join(folderPath, name) }))
  return images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

function sanitizeOrderFolderName(raw: string): string | null {
  const name = raw.trim().replace(/[. ]+$/g, '')
  if (!name || name === '.' || name === '..') return null
  if (name.length > 80) return null
  if (/[<>:"/\\|?*\u0000-\u001F]/.test(name)) return null
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) return null
  return name
}

function resolveOrderFolder(rawName: string): string | null {
  const name = sanitizeOrderFolderName(rawName)
  if (!name) return null
  const root = orderImagesRoot()
  const folderPath = join(root, name)
  if (folderPath === root || !isPathUnderRoot(folderPath, root)) return null
  return folderPath
}

async function createOrderFolder(
  rawName: string
): Promise<{ ok: true; name: string } | { ok: false; message: string }> {
  const name = sanitizeOrderFolderName(rawName)
  if (!name) return { ok: false, message: 'Enter a folder name without special characters.' }
  const folderPath = resolveOrderFolder(name)
  if (!folderPath) return { ok: false, message: 'That folder name cannot be used.' }

  const root = orderImagesRoot()
  await mkdir(root, { recursive: true })
  const existing = await readdir(root).catch(() => [] as string[])
  if (existing.some((entry) => entry.toLowerCase() === name.toLowerCase())) {
    return { ok: false, message: 'A folder with that name already exists.' }
  }
  await mkdir(folderPath)
  return { ok: true, name }
}

async function importImagesIntoOrderFolder(
  rawName: string
): Promise<{ ok: true; added: number } | { ok: false; message: string }> {
  const folderPath = resolveOrderFolder(rawName)
  if (!folderPath || !existsSync(folderPath)) {
    return { ok: false, message: 'Choose a folder first.' }
  }

  const res = await dialog.showOpenDialog({
    title: 'Add images',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }]
  })
  if (res.canceled || res.filePaths.length === 0) return { ok: true, added: 0 }

  let added = 0
  for (const sourcePath of res.filePaths) {
    const ext = extname(sourcePath).toLowerCase()
    if (!IMAGE_EXT.has(ext)) continue
    const base = basename(sourcePath, extname(sourcePath)).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'image'
    let destName = `${base}${ext}`
    let n = 2
    while (existsSync(join(folderPath, destName)) && n < 500) {
      destName = `${base}-${n}${ext}`
      n += 1
    }
    await copyFile(sourcePath, join(folderPath, destName))
    added += 1
  }
  if (added === 0) return { ok: false, message: 'None of those files are images Orion can use.' }
  return { ok: true, added }
}

const EXCLUDED_BG_NAMES = new Set(['logo.png', 'icon.png', 'orion-logo.png'])

async function listBackgroundImages(): Promise<{ name: string; path: string }[]> {
  const root = imagesRoot()
  const results: { name: string; path: string }[] = []

  async function scanDir(dir: string, prefix = ''): Promise<void> {
    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      return
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      let info
      try {
        info = await stat(fullPath)
      } catch {
        continue
      }
      if (info.isDirectory()) {
        if (entry === 'backgrounds') {
          await scanDir(fullPath, '')
        }
        continue
      }
      const ext = extname(entry).toLowerCase()
      if (!IMAGE_EXT.has(ext)) continue
      if (EXCLUDED_BG_NAMES.has(entry.toLowerCase())) continue
      results.push({
        name: prefix ? `${prefix}/${entry}` : entry,
        path: fullPath
      })
    }
  }

  await scanDir(root)
  const seen = new Set<string>()
  return results
    .filter((item) => {
      if (seen.has(item.path)) return false
      seen.add(item.path)
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

async function importBackgroundImage(): Promise<{ name: string; path: string } | null> {
  const res = await dialog.showOpenDialog({
    title: 'Import background images',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }
    ]
  })
  if (res.canceled || res.filePaths.length === 0) return null

  const bgDir = join(imagesRoot(), 'backgrounds')
  await mkdir(bgDir, { recursive: true })

  let imported: { name: string; path: string } | null = null
  for (const [index, sourcePath] of res.filePaths.entries()) {
    const ext = extname(sourcePath).toLowerCase()
    if (!IMAGE_EXT.has(ext)) continue
    const safeBase = basename(sourcePath, ext).replace(/[^a-zA-Z0-9._-]/g, '-') || 'image'
    const destName = `${safeBase}-${Date.now().toString(36)}-${index}${ext}`
    const destPath = join(bgDir, destName)
    await copyFile(sourcePath, destPath)
    imported = { name: destName, path: destPath }
  }
  return imported
}

function listConnectedDisplays() {
  const primaryId = screen.getPrimaryDisplay().id
  return sortDisplays(
    screen.getAllDisplays().map((display) => displayInfoFromElectron(display, primaryId))
  )
}

function broadcastDisplaysChanged(): void {
  const payload = listConnectedDisplays()
  repositionProjectionWindows()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('orion:displays-changed', payload)
    }
  }
}

function registerDisplayListeners(): void {
  screen.on('display-added', broadcastDisplaysChanged)
  screen.on('display-removed', broadcastDisplaysChanged)
  screen.on('display-metrics-changed', broadcastDisplaysChanged)
}

function createWindow(): void {
  const edition = readEdition()
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#242424',
    icon: appIcon(),
    title: edition.name,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    const icon = appIcon()
    if (!icon.isEmpty()) mainWindow.setIcon(icon)
    mainWindow.maximize()
    mainWindow.show()
  })

  setMainAppWindow(mainWindow)
  mainWindow.on('closed', () => {
    setMainAppWindow(null)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('orion:presentation-ui-state', getPresentationUiState())
  })
}

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
}

app.whenReady().then(async () => {
  const edition = readEdition()
  if (process.platform === 'win32') {
    app.setAppUserModelId(edition.appUserModelId)
  }
  await seedPackagedLibraries()

  ipcMain.handle('orion:list-order-folders', () => listOrderFolders())
  ipcMain.handle('orion:list-order-folder-images', (_event, folderName: string) =>
    listImagesInOrderFolder(folderName)
  )
  ipcMain.handle('orion:create-order-folder', (_event, name: string) => createOrderFolder(String(name ?? '')))
  ipcMain.handle('orion:import-order-images', (_event, folderName: string) =>
    importImagesIntoOrderFolder(String(folderName ?? ''))
  )
  ipcMain.handle('orion:list-media-folders', () => listMediaFolders())
  ipcMain.handle('orion:list-media-folder', (_event, folderName: string) =>
    listMediaInFolder(String(folderName ?? ''))
  )
  ipcMain.handle('orion:create-media-folder', (_event, name: string) => createMediaFolder(String(name ?? '')))
  ipcMain.handle('orion:import-media', (_event, folderName: string) =>
    importMediaIntoFolder(String(folderName ?? ''))
  )
  ipcMain.handle('orion:remove-media', (_event, filePath: string) => removeMediaFile(String(filePath ?? '')))
  ipcMain.handle('orion:list-background-images', () => listBackgroundImages())
  ipcMain.handle('orion:import-background-image', () => importBackgroundImage())
  ipcMain.handle('orion:list-bibles', () => listInstalledBibles())
  ipcMain.handle('orion:import-bible', () => importBibleFromDialog())
  ipcMain.handle('orion:list-online-bible-translations', () => listOnlineBibleTranslations())
  ipcMain.handle('orion:download-bible', (_event, translationId: string) =>
    downloadHelloAoTranslation(translationId)
  )
  ipcMain.handle('orion:remove-bible', (_event, bibleId: string) => removeInstalledBible(bibleId))
  ipcMain.handle(
    'orion:get-bible-chapter',
    (_event, bibleId: string, bookId: string, chapter: number) =>
      getBibleChapter(bibleId, bookId, chapter)
  )
  ipcMain.handle(
    'orion:search-bible',
    (
      _event,
      bibleId: string,
      query: string,
      mode: import('../shared/bible-search').BibleSearchMode,
      scope: import('../shared/bible-search').BibleSearchScope,
      limit?: number
    ) => searchInstalledBible(bibleId, query, mode, scope, limit)
  )
  ipcMain.handle('orion:ensure-dictionary', () => ensureDictionaryReady())
  ipcMain.handle('orion:dictionary-index-progress', () => getDictionaryIndexProgress())
  ipcMain.handle(
    'orion:search-dictionary-entries',
    (
      _event,
      query: string,
      language: import('../shared/dictionary-lexicon').LexiconLanguageFilter,
      offset: number,
      limit: number
    ) => searchDictionaryEntries(query, language, offset, limit)
  )
  ipcMain.handle('orion:get-dictionary-entry', (_event, strongs: string) =>
    getDictionaryLexiconEntry(strongs)
  )
  ipcMain.handle('orion:list-hymnals', () => listInstalledHymnals())
  ipcMain.handle('orion:get-hymnal-index', (_event, hymnalId: string) => getHymnalIndex(hymnalId))
  ipcMain.handle('orion:get-hymn-entry', (_event, hymnalId: string, hymnId: string) =>
    getHymnEntry(hymnalId, hymnId)
  )
  ipcMain.handle('orion:import-hymnal', () => importHymnalFromDialog())
  ipcMain.handle('orion:import-hymnal-folder', () => importHymnalFolderFromDialog())
  ipcMain.handle('orion:import-bibsoft-mdb', () => importBibsoftMdbFromDialog())
  ipcMain.handle('orion:ensure-personal-hymnal', () => ensurePersonalHymnal())
  ipcMain.handle(
    'orion:upsert-hymn-entry',
    (
      _event,
      hymnalId: string,
      input: {
        id?: string
        number: number
        title: string
        stanzas: import('../shared/hymnal-types').HymnStanza[]
      }
    ) => upsertHymnEntry(hymnalId, input)
  )
  ipcMain.handle('orion:delete-hymn-entry', (_event, hymnalId: string, hymnId: string) =>
    deleteHymnEntry(hymnalId, hymnId)
  )
  ipcMain.handle(
    'orion:get-dictionary-scripture',
    (
      _event,
      strongs: string,
      options: {
        bibleId?: string
        bookId?: string | null
        chapter?: number | null
        offset?: number
        limit?: number
      }
    ) => getDictionaryScriptureOccurrences(strongs, options)
  )
  ipcMain.handle('orion:get-paths', () => ({
    orderImages: orderImagesRoot(),
    images: imagesRoot(),
    bibles: biblesRoot(),
    platform: process.platform
  }))
  ipcMain.handle(
    'orion:set-projection',
    async (_event, payload: OrionProjectionPayload, displayIds: number[]) => {
      await applyProjection(payload, displayIds)
    }
  )
  ipcMain.handle(
    'orion:projection-command',
    async (_event, command: OrionProjectionCommand, displayIds: number[]) => {
      return runProjectionCommand(command, displayIds)
    }
  )
  ipcMain.handle('orion:get-projection-stack', () => getStackState())
  ipcMain.handle('orion:get-presentation-ui-state', () => getPresentationUiState())
  ipcMain.handle('orion:list-displays', () => listConnectedDisplays())

  ipcMain.handle('orion:list-presentation-decks', () => listPresentationDecks())
  ipcMain.handle('orion:get-presentation-deck', (_event, deckId: string) =>
    getPresentationDeck(deckId)
  )
  ipcMain.handle('orion:import-presentation-deck', () => importPresentationDeckFromDialog())
  ipcMain.handle('orion:read-presentation-deck-source', (_event, deckId: string) =>
    readPresentationDeckSource(deckId)
  )
  ipcMain.handle('orion:rasterize-metafiles', async (_event, payloads: string[]) => {
    const buffers = (Array.isArray(payloads) ? payloads : [])
      .slice(0, 40)
      .filter((item) => typeof item === 'string' && item.length < 8_000_000)
      .map((item) => Buffer.from(item, 'base64'))
    const pngs = await rasterizeMetafiles(buffers)
    return pngs.map((png) => (png ? png.toString('base64') : null))
  })
  ipcMain.handle('orion:remove-presentation-deck', (_event, deckId: string) =>
    removePresentationDeck(deckId)
  )

  ipcMain.handle('orion:get-presentation-import-deps-status', () =>
    getPresentationImportDepsStatus()
  )
  ipcMain.handle('orion:download-presentation-import-deps', () =>
    downloadPresentationImportDeps()
  )
  ipcMain.handle('orion:cancel-presentation-import-deps-download', () => {
    cancelPresentationImportDepsDownload()
  })

  ipcMain.handle('orion:set-main-window-maximized', (_event, maximized: boolean) => {
    const win = getMainAppWindow()
    if (!win || win.isDestroyed()) return
    if (maximized) {
      if (!win.isMaximized()) win.maximize()
    } else if (win.isMaximized()) {
      win.unmaximize()
    }
  })
  ipcMain.handle(
    'orion:export-profile-file',
    async (_event, json: string, suggestedName: string) =>
      exportProfileFileToDialog(json, suggestedName)
  )
  ipcMain.handle('orion:import-profile-file', async () => importProfileFileFromDialog())
  ipcMain.handle(
    'orion:export-sequence-file',
    async (_event, json: string, suggestedName: string, bundleContent?: boolean) =>
      exportSequenceFileToDialog(json, suggestedName, bundleContent !== false)
  )
  ipcMain.handle('orion:import-sequence-file', async () => importSequenceFileFromDialog())

  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(
      permission === 'media' ||
        permission === 'pointerLock' ||
        (permission === 'fullscreen' && contents.getType() !== 'webview')
    )
  })
  ipcMain.on('orion:set-guest-audio-muted', (_event, raw: unknown) => {
    if (!raw || typeof raw !== 'object') return
    const body = raw as { webContentsId?: unknown; muted?: unknown }
    const webContentsId = body.webContentsId
    if (typeof webContentsId !== 'number' || !Number.isInteger(webContentsId)) return
    const guest = webContents.fromId(webContentsId)
    if (!guest || guest.isDestroyed() || guest.getType() !== 'webview') return
    guest.setAudioMuted(body.muted === true)
  })
  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() !== 'webview') return
    contents.setUserAgent(WEB_BROWSER_USER_AGENT)
    contents.session.setPermissionRequestHandler((guest, permission, callback) => {
      callback(
        permission === 'media' ||
          permission === 'pointerLock' ||
          (permission === 'fullscreen' && guest.getType() !== 'webview')
      )
    })
    contents.on('enter-html-full-screen', () => {
      const host = contents.hostWebContents
      const win = host ? BrowserWindow.fromWebContents(host) : null
      if (win && !win.isDestroyed() && win.isFullScreen()) win.setFullScreen(false)
      void contents
        .executeJavaScript(
          'window.__orionNativeExitFullscreen ? window.__orionNativeExitFullscreen() : (document.exitFullscreen && document.exitFullscreen())'
        )
        .catch(() => {
          /* page already left fullscreen */
        })
    })
  })

  registerProjectionIpc()
  registerPresenterWindowIpc()
  ipcMain.handle(
    'orion:sync-presenter-slide-from-main',
    async (_event, deckId: string | null, slideIndex: number) => {
      await syncPresenterSlideFromMain(deckId, slideIndex)
    }
  )
  registerDisplayListeners()
  warmDictionaryLexiconIndex()
  createWindow()

  if (process.env.ORION_E2E_TEST === '1' || process.argv.includes('--e2e-verify')) {
    import('./e2e-verify').catch(console.error)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeAllProjectionWindows()
  closePresenterViewOnQuit()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
