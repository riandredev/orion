import { app, BrowserWindow, dialog, globalShortcut, ipcMain, net, protocol, screen, session, shell, webContents } from 'electron'
import { createHash } from 'crypto'
import { pathToFileURL } from 'url'
import { createReadStream, existsSync } from 'fs'
import { Readable } from 'stream'
import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'fs/promises'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { basename, extname, join } from 'path'
import type { OrionProjectionPayload } from '../shared/projection'
import { WEB_BROWSER_USER_AGENT } from '../shared/web-browser'
import type { OrionProjectionCommand, OrionStackState } from '../shared/projection-stack'
import { displayInfoFromElectron, sortDisplays } from './displays'
import { appIcon, applyLinuxWindowIdentity, installLinuxDesktopEntry, linuxWindowClass } from './app-icon'
import { scheduleAppUpdateCheck } from './app-updates'
import { seedPackagedLibraries } from './content-seed'
import { readEdition } from './edition'
import {
  forgetLibraryFile,
  installLibrary,
  installedOrderFolderSort,
  listLibraries,
  uninstallLibrary
} from './content-bundles'
import { compareOrderFolderNames } from '../shared/order-folder-sort'
import { is } from './env'
import type { BackgroundImportProgress } from '../shared/background-import'
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
  searchDictionaryEntries
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
import { shutdownNativeOutput } from './native-output'
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
  const sort = await installedOrderFolderSort()
  return folders.sort((a, b) => compareOrderFolderNames(a.name, b.name, sort))
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
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  return Promise.all(
    images.map(async (image) => ({
      ...image,
      thumb: await orderThumb(image.path)
    }))
  )
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

async function removeLibraryImage(filePath: string): Promise<boolean> {
  const target = filePath.trim()
  if (!target) return false
  const ext = extname(target).toLowerCase()
  if (!IMAGE_EXT.has(ext)) return false
  const allowed =
    isPathUnderRoot(target, imagesRoot()) || isPathUnderRoot(target, orderImagesRoot())
  if (!allowed) return false
  try {
    const info = await stat(target)
    if (!info.isFile()) return false
    await rm(target)
    return true
  } catch {
    return false
  }
}

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
      if (entry.startsWith('.')) continue
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

let thumbJobs = 0
const thumbWaiters: (() => void)[] = []

function withThumbSlot<T>(job: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = (): void => {
      thumbJobs += 1
      job()
        .then(resolve, reject)
        .finally(() => {
          thumbJobs -= 1
          thumbWaiters.shift()?.()
        })
    }
    if (thumbJobs < 3) start()
    else thumbWaiters.push(start)
  })
}

async function orderThumb(filePath: string): Promise<string> {
  const target = filePath.trim()
  if (!target || !isPathUnderRoot(target, orderImagesRoot())) return target
  const thumb = await withThumbSlot(async () => {
    let info
    try {
      info = await stat(target)
    } catch {
      return null
    }
    if (!info.isFile()) return null
    const key = createHash('sha1').update(`order|${target}|${info.mtimeMs}|${info.size}`).digest('hex')
    const dir = join(app.getPath('userData'), 'order-thumbs')
    const dest = join(dir, `${key}.jpg`)
    if (existsSync(dest)) return dest
    try {
      await mkdir(dir, { recursive: true })
      const image = await loadImage(target)
      const scale = Math.min(1, 360 / Math.max(1, image.width))
      const width = Math.max(1, Math.round(image.width * scale))
      const height = Math.max(1, Math.round(image.height * scale))
      const canvas = createCanvas(width, height)
      canvas.getContext('2d').drawImage(image, 0, 0, width, height)
      await writeFile(dest, canvas.toBuffer('image/jpeg', 62))
      return dest
    } catch {
      return null
    }
  })
  return thumb || target
}

async function backgroundThumb(filePath: string): Promise<string | null> {
  const target = filePath.trim()
  if (!target || !isPathUnderRoot(target, imagesRoot())) return null
  return withThumbSlot(async () => {
    let info
    try {
      info = await stat(target)
    } catch {
      return null
    }
    if (!info.isFile()) return null
    const key = createHash('sha1').update(`${target}|${info.mtimeMs}|${info.size}`).digest('hex')
    const dir = join(imagesRoot(), 'backgrounds', '.thumbs')
    const dest = join(dir, `${key}.jpg`)
    if (existsSync(dest)) return dest
    try {
      await mkdir(dir, { recursive: true })
      const image = await loadImage(target)
      const scale = Math.min(1, 480 / Math.max(1, image.width))
      const width = Math.max(1, Math.round(image.width * scale))
      const height = Math.max(1, Math.round(image.height * scale))
      const canvas = createCanvas(width, height)
      canvas.getContext('2d').drawImage(image, 0, 0, width, height)
      await writeFile(dest, canvas.toBuffer('image/jpeg', 70))
      return dest
    } catch {
      return null
    }
  })
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

  const sources = res.filePaths.filter((sourcePath) => IMAGE_EXT.has(extname(sourcePath).toLowerCase()))
  if (sources.length === 0) return null

  const win = getMainAppWindow()
  const report = (progress: BackgroundImportProgress): void => {
    if (!win || win.isDestroyed()) return
    win.webContents.send('orion:background-import-progress', progress)
  }

  let imported: { name: string; path: string } | null = null
  for (const [index, sourcePath] of sources.entries()) {
    const ext = extname(sourcePath).toLowerCase()
    const safeBase = basename(sourcePath, ext).replace(/[^a-zA-Z0-9._-]/g, '-') || 'image'
    const destName = `${safeBase}-${Date.now().toString(36)}-${index}${ext}`
    const destPath = join(bgDir, destName)
    report({ current: index + 1, total: sources.length, name: basename(sourcePath) })
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

const disabledChromiumFeatures = [
  'SpareRendererForSitePerProcess',
  'BackForwardCache',
  'TranslateUI',
  'InterestFeedContentSuggestions'
]
if (process.platform === 'linux') {
  disabledChromiumFeatures.push('MediaRouter')
  app.commandLine.appendSwitch('disable-background-networking')
  app.commandLine.appendSwitch('disable-component-update')
  app.commandLine.appendSwitch('disable-domain-reliability')
  app.commandLine.appendSwitch('disable-renderer-backgrounding')
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
  applyLinuxWindowIdentity()
  app.commandLine.appendSwitch('class', linuxWindowClass())
}
app.commandLine.appendSwitch('disable-features', disabledChromiumFeatures.join(','))

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'orion-file',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true
    }
  }
])

function orionFileMime(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.mp4':
    case '.m4v':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.ogv':
      return 'video/ogg'
    case '.mov':
      return 'video/quicktime'
    case '.mkv':
      return 'video/x-matroska'
    case '.avi':
      return 'video/x-msvideo'
    case '.mp3':
      return 'audio/mpeg'
    case '.wav':
      return 'audio/wav'
    case '.ogg':
      return 'audio/ogg'
    case '.m4a':
      return 'audio/mp4'
    case '.flac':
      return 'audio/flac'
    default:
      return 'application/octet-stream'
  }
}

function orionFilePath(requestUrl: string): string {
  const pathname = decodeURIComponent(new URL(requestUrl).pathname)
  return process.platform === 'win32' ? pathname.replace(/^\//, '') : pathname
}

/** Video seeking needs 206 responses. A full 200 body marks the file as not seekable. */
async function orionFileResponse(request: Request): Promise<Response> {
  const filePath = orionFilePath(request.url)
  const range = request.headers.get('range')
  if (!range) return net.fetch(pathToFileURL(filePath).href)
  let size = 0
  try {
    size = (await stat(filePath)).size
  } catch {
    return new Response('Not found', { status: 404 })
  }
  const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim())
  if (!match || size <= 0) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }
  let start: number
  let end: number
  if (match[1] === '') {
    const suffix = Number(match[2])
    if (!Number.isFinite(suffix) || suffix <= 0) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    }
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] === '' ? size - 1 : Number(match[2])
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || end < start) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }
  end = Math.min(end, size - 1)
  const node = createReadStream(filePath, { start, end })
  node.on('error', () => node.destroy())
  const body = Readable.toWeb(node) as ReadableStream
  return new Response(body, {
    status: 206,
    headers: {
      'Accept-Ranges': 'bytes',
      'Content-Type': orionFileMime(filePath),
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`
    }
  })
}

app.whenReady().then(async () => {
  protocol.handle('orion-file', (request) => orionFileResponse(request))
  const edition = readEdition()
  if (process.platform === 'win32') {
    app.setAppUserModelId(edition.appUserModelId)
  }
  await seedPackagedLibraries()
  globalShortcut.register('Control+Alt+Escape', () => {
    void runProjectionCommand({ type: 'clear-all' }, [])
  })
  await installLinuxDesktopEntry()
  scheduleAppUpdateCheck()

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
  ipcMain.handle('orion:remove-media', async (_event, filePath: string) => {
    const target = String(filePath ?? '')
    const removed = await removeMediaFile(target)
    if (removed) await forgetLibraryFile(target)
    return removed
  })
  ipcMain.handle('orion:list-background-images', () => listBackgroundImages())
  ipcMain.handle('orion:background-thumb', (_event, filePath: string) => backgroundThumb(String(filePath ?? '')))
  ipcMain.handle('orion:remove-library-image', async (_event, filePath: string) => {
    const target = String(filePath ?? '')
    const removed = await removeLibraryImage(target)
    if (removed) await forgetLibraryFile(target)
    return removed
  })
  ipcMain.handle('orion:import-background-image', () => importBackgroundImage())
  ipcMain.handle('orion:list-bibles', () => listInstalledBibles())
  ipcMain.handle('orion:import-bible', () => importBibleFromDialog())
  ipcMain.handle('orion:list-online-bible-translations', () => listOnlineBibleTranslations())
  ipcMain.handle('orion:download-bible', (_event, translationId: string) =>
    downloadHelloAoTranslation(translationId)
  )
  ipcMain.handle('orion:remove-bible', async (_event, bibleId: string) => {
    const removed = await removeInstalledBible(bibleId)
    if (removed) await forgetLibraryFile(join(biblesRoot(), bibleId))
    return removed
  })
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
  ipcMain.handle('orion:list-libraries', () => listLibraries())
  ipcMain.handle('orion:install-library', (_event, id: string) => installLibrary(id))
  ipcMain.handle('orion:uninstall-library', (_event, id: string) => uninstallLibrary(id))
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
    async (_event, json: string, suggestedName: string, includeContent?: boolean) =>
      exportProfileFileToDialog(json, suggestedName, includeContent === true)
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
    async (_event, deckId: string | null, slideIndex: number, buildStep?: number) => {
      await syncPresenterSlideFromMain(deckId, slideIndex, buildStep ?? 0)
    }
  )
  registerDisplayListeners()
  applyLinuxWindowIdentity()
  createWindow()

  if (process.env.ORION_E2E_TEST === '1' || process.argv.includes('--e2e-verify')) {
    import('./e2e-verify').catch(console.error)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  globalShortcut.unregister('Control+Alt+Escape')
  closeAllProjectionWindows()
  shutdownNativeOutput()
  closePresenterViewOnQuit()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
