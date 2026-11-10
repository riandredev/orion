import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'fs/promises'
import { dirname, join, relative, sep } from 'path'
import { pipeline } from 'stream/promises'
import { app } from 'electron'
import JSZip from 'jszip'
import {
  libraryRows,
  parseLibraryCatalog,
  parseLibraryManifest,
  type LibraryCatalogEntry,
  type LibraryFolderSort,
  type LibraryList,
  type LibraryManifest,
  type LibraryProgress
} from '../shared/content-bundles'
import { is } from './env'
import { biblesRoot, imagesRoot, mediaRoot, orderImagesRoot } from './paths'
import { isPathUnderRoot } from './projection-paths'
import { getMainAppWindow } from './projection'
import { invalidateHymnalCache } from './hymnals'

const CATALOG_URL = 'https://raw.githubusercontent.com/riandredev/orion/main/bundles/catalog.json'
const KINDS = ['order-images', 'hymnals', 'bibles', 'images', 'media'] as const
type LibraryKind = (typeof KINDS)[number]

type InstalledRecord = {
  id: string
  version: string
  name: string
  orderFolderSort?: LibraryFolderSort
}

type InstallIndex = Record<string, string>

let installing = false

function bundlesDir(): string {
  return join(app.getPath('userData'), 'bundles')
}

function installedPath(): string {
  return join(bundlesDir(), 'installed.json')
}

function indexPath(id: string): string {
  return join(bundlesDir(), `${id}.index.json`)
}

function shippedCatalogPath(): string {
  if (is.dev) return join(process.cwd(), 'bundles', 'catalog.json')
  return join(process.resourcesPath, 'content', 'bundles-catalog.json')
}

function kindRoot(kind: LibraryKind): string {
  if (kind === 'order-images') return orderImagesRoot()
  if (kind === 'hymnals') return join(app.getPath('userData'), 'hymnals')
  if (kind === 'bibles') return biblesRoot()
  if (kind === 'images') return imagesRoot()
  return mediaRoot()
}

function emit(progress: LibraryProgress): void {
  const win = getMainAppWindow()
  if (!win || win.isDestroyed()) return
  win.webContents.send('orion:library-progress', progress)
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown
}

async function readInstalled(): Promise<InstalledRecord[]> {
  try {
    const parsed = await readJson(installedPath())
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is InstalledRecord => {
      if (!item || typeof item !== 'object') return false
      const raw = item as InstalledRecord
      return typeof raw.id === 'string' && typeof raw.version === 'string' && typeof raw.name === 'string'
    })
  } catch {
    return []
  }
}

async function readIndex(id: string): Promise<InstallIndex> {
  try {
    const parsed = await readJson(indexPath(id))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const index: InstallIndex = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') index[key] = value
    }
    return index
  } catch {
    return {}
  }
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}

function toLibraryList(entries: LibraryCatalogEntry[], installed: InstalledRecord[], error: string | null): LibraryList {
  const libraries = libraryRows(entries, installed)
  return {
    libraries,
    updates: libraries.filter((item) => item.status === 'update').length,
    catalogError: error
  }
}

async function readCatalogFile(path: string): Promise<LibraryCatalogEntry[] | null> {
  try {
    return parseLibraryCatalog(await readJson(path))
  } catch {
    return null
  }
}

async function localCatalog(): Promise<LibraryCatalogEntry[]> {
  const cached = await readCatalogFile(join(bundlesDir(), 'catalog.json'))
  if (cached && cached.length > 0) return cached
  return (await readCatalogFile(shippedCatalogPath())) ?? []
}

function catalogSignature(entries: LibraryCatalogEntry[]): string {
  return JSON.stringify(entries)
}

let catalogRefresh: Promise<void> | null = null

function emitLibraryList(list: LibraryList): void {
  const win = getMainAppWindow()
  if (!win || win.isDestroyed()) return
  win.webContents.send('orion:libraries-list', list)
}

function scheduleCatalogRefresh(current: LibraryCatalogEntry[]): void {
  if (catalogRefresh) return
  catalogRefresh = refreshRemoteCatalog(current).finally(() => {
    catalogRefresh = null
  })
}

async function refreshRemoteCatalog(current: LibraryCatalogEntry[]): Promise<void> {
  try {
    const response = await fetch(CATALOG_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'Orion' }
    })
    if (!response.ok) return
    const remote = parseLibraryCatalog(await response.json())
    if (!remote || catalogSignature(remote) === catalogSignature(current)) return
    await mkdir(bundlesDir(), { recursive: true })
    await writeFile(join(bundlesDir(), 'catalog.json'), JSON.stringify({ bundles: remote }), 'utf8')
    emitLibraryList(toLibraryList(remote, await readInstalled(), null))
  } catch {
    /* the shipped catalog stays on screen when the network catalog is unreachable */
  }
}

export async function listLibraries(): Promise<LibraryList> {
  const [entries, installed] = await Promise.all([localCatalog(), readInstalled()])
  scheduleCatalogRefresh(entries)
  return toLibraryList(entries, installed, null)
}

export async function installedOrderFolderSort(): Promise<LibraryFolderSort> {
  const installed = await readInstalled()
  return installed.some((item) => item.orderFolderSort === 'za') ? 'za' : 'az'
}

async function listFiles(root: string): Promise<{ rel: string; abs: string }[]> {
  const out: { rel: string; abs: string }[] = []
  async function walk(dir: string): Promise<void> {
    const names = await readdir(dir)
    for (const name of names) {
      const abs = join(dir, name)
      const info = await stat(abs)
      if (info.isDirectory()) {
        await walk(abs)
        continue
      }
      if (!info.isFile()) continue
      const rel = relative(root, abs).split(sep).join('/')
      if (rel.startsWith('..') || rel.includes('/../')) continue
      out.push({ rel, abs })
    }
  }
  await walk(root)
  return out
}

async function applyTree(root: string, manifest: LibraryManifest, onProgress: (done: number, total: number) => void): Promise<void> {
  const previous = await readIndex(manifest.id)
  const files = (await listFiles(root)).filter((file) => file.rel !== 'manifest.json')
  const next: InstallIndex = {}
  let done = 0
  for (const file of files) {
    const kind = KINDS.find((item) => file.rel === item || file.rel.startsWith(`${item}/`))
    done += 1
    onProgress(done, files.length)
    if (!kind) continue
    const within = file.rel.slice(kind.length + 1)
    if (!within) continue
    const destRoot = kindRoot(kind)
    const dest = join(destRoot, ...within.split('/'))
    if (!isPathUnderRoot(dest, destRoot)) continue
    const bundleSha = await sha256File(file.abs)
    let liveSha: string | null = null
    try {
      if ((await stat(dest)).isFile()) liveSha = await sha256File(dest)
    } catch {
      liveSha = null
    }
    const owned = previous[file.rel] != null && liveSha === previous[file.rel]
    if (liveSha == null || (owned && liveSha !== bundleSha)) {
      await mkdir(dirname(dest), { recursive: true })
      await copyFile(file.abs, dest)
    }
    next[file.rel] = bundleSha
  }
  await mkdir(bundlesDir(), { recursive: true })
  await writeFile(indexPath(manifest.id), JSON.stringify(next), 'utf8')
  const installed = (await readInstalled()).filter((item) => item.id !== manifest.id)
  installed.push({
    id: manifest.id,
    version: manifest.version,
    name: manifest.name,
    orderFolderSort: manifest.orderFolderSort
  })
  await writeFile(installedPath(), JSON.stringify(installed, null, 2), 'utf8')
  invalidateHymnalCache()
}

/** GNU tar on Linux cannot unpack a zip. macOS and Windows tar can, which is why only Linux failed. */
async function extractZip(zipPath: string, dest: string): Promise<void> {
  const zip = await JSZip.loadAsync(await readFile(zipPath))
  for (const entry of Object.values(zip.files)) {
    const rel = entry.name.replace(/\\/g, '/').replace(/^\/+/, '')
    if (!rel || rel.split('/').includes('..')) continue
    const target = join(dest, ...rel.split('/').filter(Boolean))
    if (!isPathUnderRoot(target, dest)) continue
    if (entry.dir) {
      await mkdir(target, { recursive: true })
      continue
    }
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, await entry.async('nodebuffer'))
  }
}

async function downloadZip(url: string, dest: string, id: string): Promise<void> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Orion', Accept: 'application/octet-stream' },
    redirect: 'follow'
  })
  if (!response.ok || !response.body) {
    throw new Error(response.status ? `The download returned ${response.status}.` : 'The download did not start.')
  }
  const total = Number(response.headers.get('content-length') ?? 0)
  const { createWriteStream } = await import('fs')
  const { Readable, Transform } = await import('stream')
  let received = 0
  let last = -1
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length
      if (total > 0) {
        const percent = Math.min(100, Math.round((received / total) * 100))
        if (percent !== last) {
          last = percent
          emit({ id, phase: 'downloading', percent, message: 'Downloading…' })
        }
      }
      callback(null, chunk)
    }
  })
  await pipeline(Readable.fromWeb(response.body as import('stream/web').ReadableStream), counter, createWriteStream(dest))
}

export async function installLibrary(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (installing) return { ok: false, message: 'A library is already being installed.' }
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(id)) return { ok: false, message: 'That library is not available.' }
  installing = true
  const temp = join(bundlesDir(), `tmp-${id}`)
  const zipPath = join(bundlesDir(), `${id}.zip`)
  try {
    const entries = await localCatalog()
    const entry = entries.find((item) => item.id === id)
    if (!entry) return { ok: false, message: 'That library is not in the catalog.' }
    await rm(temp, { recursive: true, force: true })
    await mkdir(temp, { recursive: true })
    await rm(zipPath, { force: true })
    emit({ id, phase: 'downloading', percent: 0, message: 'Downloading…' })
    await downloadZip(entry.downloadUrl, zipPath, id)
    emit({ id, phase: 'installing', percent: 0, message: 'Unpacking…' })
    await extractZip(zipPath, temp)
    const manifest = parseLibraryManifest(await readJson(join(temp, 'manifest.json')))
    if (!manifest || manifest.id !== id) {
      return { ok: false, message: 'This download is not an Orion library.' }
    }
    if (manifest.version !== entry.version) {
      return { ok: false, message: 'The downloaded library does not match the catalog.' }
    }
    await applyTree(temp, manifest, (done, total) => {
      const percent = total === 0 ? 100 : Math.round((done / total) * 100)
      emit({ id, phase: 'installing', percent, message: 'Adding new library files…' })
    })
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The library could not be installed.'
    return { ok: false, message }
  } finally {
    installing = false
    await rm(temp, { recursive: true, force: true }).catch(() => undefined)
    await rm(zipPath, { force: true }).catch(() => undefined)
  }
}
