import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'fs/promises'
import { dirname, join, relative, resolve, sep } from 'path'
import { pipeline } from 'stream/promises'
import { app } from 'electron'
import JSZip from 'jszip'
import {
  libraryInstallAction,
  libraryRows,
  libraryUninstallRemoves,
  mergeLibraryPreview,
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

type LibraryFileState = { seen: Set<string>; removed: Set<string> }

function libraryFilesPath(id: string): string {
  return join(bundlesDir(), `${id}.files.json`)
}

async function readFileState(id: string): Promise<LibraryFileState> {
  try {
    const parsed = await readJson(libraryFilesPath(id))
    const raw = parsed as { seen?: unknown; removed?: unknown }
    const seen = new Set((Array.isArray(raw.seen) ? raw.seen : []).filter((item) => typeof item === 'string'))
    const removed = new Set(
      (Array.isArray(raw.removed) ? raw.removed : []).filter((item) => typeof item === 'string')
    )
    return { seen, removed }
  } catch {
    return { seen: new Set(), removed: new Set() }
  }
}

async function writeFileState(id: string, state: LibraryFileState): Promise<void> {
  await mkdir(bundlesDir(), { recursive: true })
  await writeFile(
    libraryFilesPath(id),
    JSON.stringify({ seen: [...state.seen], removed: [...state.removed] }),
    'utf8'
  )
}

function libraryRel(absPath: string): string | null {
  for (const kind of KINDS) {
    const root = kindRoot(kind)
    if (!isPathUnderRoot(absPath, root)) continue
    const within = relative(root, absPath).split(sep).join('/')
    if (!within || within.startsWith('..')) continue
    return `${kind}/${within}`
  }
  return null
}

function destinationFor(rel: string): { dest: string; root: string } | null {
  const kind = KINDS.find((item) => rel === item || rel.startsWith(`${item}/`))
  if (!kind) return null
  const within = rel.slice(kind.length + 1)
  if (!within) return null
  const root = kindRoot(kind)
  const dest = join(root, ...within.split('/'))
  if (!isPathUnderRoot(dest, root)) return null
  return { dest, root }
}

async function fileIsPresent(rel: string): Promise<boolean> {
  const target = destinationFor(rel)
  if (!target) return false
  try {
    return (await stat(target.dest)).isFile()
  } catch {
    return false
  }
}

async function removeEmptyParents(filePath: string, root: string): Promise<void> {
  let dir = dirname(filePath)
  const rootResolved = resolve(root)
  while (resolve(dir) !== rootResolved && isPathUnderRoot(dir, root)) {
    const names = await readdir(dir).catch(() => null)
    if (!names || names.length > 0) break
    await rm(dir, { recursive: false }).catch(() => undefined)
    dir = dirname(dir)
  }
}

/** A pack file that never landed still needs an update. A file that was present and then removed stays gone. */
async function libraryNeedsFiles(id: string): Promise<boolean> {
  const index = await readIndex(id)
  const state = await readFileState(id)
  let changed = false
  let missing = false
  for (const rel of Object.keys(index)) {
    if (state.removed.has(rel)) continue
    if (await fileIsPresent(rel)) {
      if (!state.seen.has(rel)) {
        state.seen.add(rel)
        changed = true
      }
      continue
    }
    if (state.seen.has(rel)) {
      state.seen.delete(rel)
      state.removed.add(rel)
      changed = true
      continue
    }
    missing = true
  }
  if (changed) await writeFileState(id, state)
  return missing
}

/** Remember a library file the user removed so a later update does not put it back. */
export async function forgetLibraryFile(absPath: string): Promise<void> {
  const rel = libraryRel(absPath)
  if (!rel) return
  const installed = await readInstalled()
  for (const item of installed) {
    const index = await readIndex(item.id)
    const matches = Object.keys(index).filter((key) => key === rel || key.startsWith(`${rel}/`))
    if (matches.length === 0) continue
    const state = await readFileState(item.id)
    for (const key of matches) {
      state.seen.delete(key)
      state.removed.add(key)
    }
    await writeFileState(item.id, state)
  }
}

async function toLibraryList(
  entries: LibraryCatalogEntry[],
  installed: InstalledRecord[],
  error: string | null
): Promise<LibraryList> {
  const libraries = libraryRows(entries, installed)
  for (const row of libraries) {
    if (row.status === 'installed' && (await libraryNeedsFiles(row.id))) row.status = 'update'
  }
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
  const shipped = (await readCatalogFile(shippedCatalogPath())) ?? []
  const cached = await readCatalogFile(join(bundlesDir(), 'catalog.json'))
  const entries = cached && cached.length > 0 ? cached : shipped
  return mergeLibraryPreview(entries, shipped)
}

function catalogSignature(entries: LibraryCatalogEntry[]): string {
  return JSON.stringify(entries)
}

function catalogIdentity(entries: LibraryCatalogEntry[]): string {
  return JSON.stringify(entries.map(({ preview: _preview, ...entry }) => entry))
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
    if (!remote) return
    const shipped = (await readCatalogFile(shippedCatalogPath())) ?? []
    const merged = mergeLibraryPreview(remote, shipped)
    if (catalogIdentity(remote) !== catalogIdentity(current)) {
      await mkdir(bundlesDir(), { recursive: true })
      await writeFile(join(bundlesDir(), 'catalog.json'), JSON.stringify({ bundles: remote }), 'utf8')
    }
    if (catalogSignature(merged) === catalogSignature(current)) return
    emitLibraryList(await toLibraryList(merged, await readInstalled(), null))
  } catch {
    /* the shipped catalog stays on screen when the network catalog is unreachable */
  }
}

export async function listLibraries(): Promise<LibraryList> {
  const [entries, installed] = await Promise.all([localCatalog(), readInstalled()])
  scheduleCatalogRefresh(entries)
  return await toLibraryList(entries, installed, null)
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
  const state = await readFileState(manifest.id)
  const files = (await listFiles(root)).filter((file) => file.rel !== 'manifest.json')
  const next: InstallIndex = {}
  let done = 0
  for (const file of files) {
    const kind = KINDS.find((item) => file.rel === item || file.rel.startsWith(`${item}/`))
    done += 1
    onProgress(done, files.length)
    if (!kind) continue
    if (state.removed.has(file.rel)) continue
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
    const action = libraryInstallAction(previous[file.rel], liveSha, bundleSha)
    if (action === 'leave') continue
    if (action === 'copy') {
      await mkdir(dirname(dest), { recursive: true })
      await copyFile(file.abs, dest)
    }
    if (await fileIsPresent(file.rel)) state.seen.add(file.rel)
    next[file.rel] = bundleSha
  }
  await writeFileState(manifest.id, state)
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

export async function uninstallLibrary(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (installing) return { ok: false, message: 'A library is already being installed.' }
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(id)) return { ok: false, message: 'That library is not available.' }
  const installed = await readInstalled()
  if (!installed.some((item) => item.id === id)) return { ok: false, message: 'That library is not installed.' }
  installing = true
  try {
    const index = await readIndex(id)
    const state = await readFileState(id)
    const others = installed.filter((item) => item.id !== id)
    const otherIndexes = await Promise.all(others.map(async (item) => readIndex(item.id)))
    for (const [rel, sha] of Object.entries(index)) {
      const target = destinationFor(rel)
      if (!target) continue
      try {
        let liveSha: string | null = null
        if ((await stat(target.dest)).isFile()) liveSha = await sha256File(target.dest)
        const claimedByAnotherLibrary = otherIndexes.some((other) => other[rel] === sha)
        if (!libraryUninstallRemoves(sha, liveSha, state.removed.has(rel), claimedByAnotherLibrary)) continue
        await rm(target.dest)
        await removeEmptyParents(target.dest, target.root)
      } catch {
        /* a missing or locked file stays as it is */
      }
    }
    await rm(indexPath(id), { force: true }).catch(() => undefined)
    await rm(libraryFilesPath(id), { force: true }).catch(() => undefined)
    await writeFile(
      installedPath(),
      JSON.stringify(installed.filter((item) => item.id !== id), null, 2),
      'utf8'
    )
    invalidateHymnalCache()
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The library could not be removed.'
    return { ok: false, message }
  } finally {
    installing = false
  }
}
