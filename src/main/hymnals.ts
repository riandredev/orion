import { app, dialog } from 'electron'
import { cp, mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'
import { parseHymnalTextDocument } from '../shared/hymnal-stanza-format'
import { enrichHymnSummaries, hymnSummaryFromEntry } from '../shared/hymnal-summary'
import { normalizeHymnEntry } from '../shared/hymnal-line-split'
import type {
  HymnEntry,
  HymnalHymnsFile,
  HymnalImportBundle,
  HymnalIndexFile,
  HymnalMeta,
  HymnSummary
} from '../shared/hymnal-types'
import { defaultImportedHymnalId, readBibsoftMdbFile } from './bibsoft-mdb'
import { hymnalsRoot } from './paths'

type CachedHymnal = {
  meta: HymnalMeta
  summaries: HymnSummary[]
  hymnsById: Map<string, HymnEntry>
}

const cache = new Map<string, CachedHymnal>()

/** Legacy demo books — never list or load. */
const DEPRECATED_HYMNAL_IDS = new Set(['orion-sample-af', 'orion-sample-en'])

const PERSONAL_HYMNAL_ID = 'orion-personal'

function shouldExposeHymnal(meta: HymnalMeta): boolean {
  if (DEPRECATED_HYMNAL_IDS.has(meta.id)) return false
  if (meta.id === PERSONAL_HYMNAL_ID && meta.hymnCount === 0) return false
  return true
}

/** Display names for shipped Adventist books (stable folder ids). */
export function normalizeBundledHymnalMeta(meta: HymnalMeta): HymnalMeta {
  if (meta.id === 'adventist-1-afrikaans') {
    return { ...meta, label: 'Afrikaans', abbr: 'Afrikaans', language: 'af', source: 'builtin' }
  }
  if (meta.id === 'adventist-2-english-new') {
    return { ...meta, label: 'English', abbr: 'English', language: 'en', source: 'builtin' }
  }
  return meta
}

function userHymnalsRoot(): string {
  return join(app.getPath('userData'), 'hymnals')
}

function slugId(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return base || 'hymnal'
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

async function discoverHymnalDirs(): Promise<{ id: string; dir: string; source: 'builtin' | 'user' }[]> {
  const out: { id: string; dir: string; source: 'builtin' | 'user' }[] = []
  for (const root of [hymnalsRoot(), userHymnalsRoot()]) {
    let names: string[]
    try {
      names = await readdir(root)
    } catch {
      continue
    }
    const source = root === hymnalsRoot() ? 'builtin' : 'user'
    for (const name of names) {
      if (name === 'examples') continue
      if (DEPRECATED_HYMNAL_IDS.has(name)) continue
      out.push({ id: name, dir: join(root, name), source })
    }
  }
  return out
}

async function loadHymnalFromDir(
  id: string,
  dir: string,
  source: 'builtin' | 'user'
): Promise<CachedHymnal | null> {
  try {
    const metaRaw = await readJson<Omit<HymnalMeta, 'source' | 'hymnCount'> & { hymnCount?: number }>(
      join(dir, 'meta.json')
    )
    const index = await readJson<HymnalIndexFile>(join(dir, 'index.json'))
    const hymnsFile = await readJson<HymnalHymnsFile>(join(dir, 'hymns.json'))
    const hymnsById = new Map<string, HymnEntry>()
    for (const h of hymnsFile.hymns) hymnsById.set(h.id, h)
    const hymns = hymnsFile.hymns
    const summaries = enrichHymnSummaries(index.summaries, hymns)
    const meta: HymnalMeta = normalizeBundledHymnalMeta({
      id: metaRaw.id ?? id,
      label: metaRaw.label,
      abbr: metaRaw.abbr ?? metaRaw.label.slice(0, 12),
      language: metaRaw.language ?? 'other',
      source,
      hymnCount: metaRaw.hymnCount ?? summaries.length
    })
    return { meta, summaries, hymnsById }
  } catch {
    return null
  }
}

async function ensureCached(hymnalId: string): Promise<CachedHymnal | null> {
  const hit = cache.get(hymnalId)
  if (hit) return hit
  const dirs = await discoverHymnalDirs()
  const matches = dirs.filter((d) => d.id === hymnalId)
  const row = matches.find((d) => d.source === 'user') ?? matches[0]
  if (!row) return null
  const loaded = await loadHymnalFromDir(row.id, row.dir, row.source)
  if (loaded) cache.set(hymnalId, loaded)
  return loaded
}

/** Copy a built-in hymnal into userData so edits persist without changing hymnal id. */
async function materializeHymnalForEditing(hymnalId: string): Promise<CachedHymnal> {
  let loaded = await ensureCached(hymnalId)
  if (!loaded) throw new Error('Hymnal not found')
  if (loaded.meta.source === 'user') {
    const userRow = (await discoverHymnalDirs()).find((d) => d.id === hymnalId && d.source === 'user')
    if (userRow) return loaded
  }
  const builtin = (await discoverHymnalDirs()).find((d) => d.id === hymnalId && d.source === 'builtin')
  if (!builtin) return loaded
  const dest = join(userHymnalsRoot(), hymnalId)
  await mkdir(userHymnalsRoot(), { recursive: true })
  await cp(builtin.dir, dest, { recursive: true })
  const materialized = await loadHymnalFromDir(hymnalId, dest, 'user')
  if (!materialized) throw new Error('Could not prepare hymnal for editing')
  const meta: HymnalMeta = { ...materialized.meta, source: 'user' }
  await writeFile(join(dest, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8')
  materialized.meta = meta
  cache.set(hymnalId, materialized)
  return materialized
}

export async function listInstalledHymnals(): Promise<HymnalMeta[]> {
  const dirs = await discoverHymnalDirs()
  const byId = new Map<string, HymnalMeta>()
  for (const row of dirs) {
    const loaded = await loadHymnalFromDir(row.id, row.dir, row.source)
    if (!loaded) continue
    cache.set(row.id, loaded)
    const existing = byId.get(row.id)
    if (!existing || (existing.source === 'builtin' && loaded.meta.source === 'user')) {
      byId.set(row.id, loaded.meta)
    }
  }
  return [...byId.values()].filter(shouldExposeHymnal).sort((a, b) => {
    const aBuiltin = a.id.startsWith('adventist-')
    const bBuiltin = b.id.startsWith('adventist-')
    if (aBuiltin !== bBuiltin) return aBuiltin ? -1 : 1
    if (a.language !== b.language) {
      if (a.language === 'af') return -1
      if (b.language === 'af') return 1
      if (a.language === 'en') return -1
      if (b.language === 'en') return 1
    }
    return a.label.localeCompare(b.label)
  })
}

export async function getHymnalIndex(hymnalId: string): Promise<HymnSummary[]> {
  const loaded = await ensureCached(hymnalId)
  return loaded?.summaries ?? []
}

export async function getHymnEntry(hymnalId: string, hymnId: string): Promise<HymnEntry | null> {
  const loaded = await ensureCached(hymnalId)
  const entry = loaded?.hymnsById.get(hymnId) ?? null
  return entry ? normalizeHymnEntry(entry) : null
}

async function writeHymnalPackage(
  id: string,
  meta: Omit<HymnalMeta, 'source' | 'hymnCount'>,
  hymns: HymnEntry[]
): Promise<HymnalMeta> {
  const dir = join(userHymnalsRoot(), id)
  await mkdir(dir, { recursive: true })
  const summaries: HymnSummary[] = hymns.map((h) => hymnSummaryFromEntry({ ...h, hymnalId: id }))
  const fullMeta: HymnalMeta = {
    ...meta,
    id,
    source: 'user',
    hymnCount: hymns.length
  }
  await writeFile(join(dir, 'meta.json'), JSON.stringify(fullMeta, null, 2), 'utf8')
  await writeFile(join(dir, 'index.json'), JSON.stringify({ summaries } satisfies HymnalIndexFile), 'utf8')
  await writeFile(join(dir, 'hymns.json'), JSON.stringify({ hymns } satisfies HymnalHymnsFile), 'utf8')
  cache.set(id, {
    meta: fullMeta,
    summaries,
    hymnsById: new Map(hymns.map((h) => [h.id, h]))
  })
  return fullMeta
}

function entriesFromImportBundle(bundle: HymnalImportBundle, hymnalId: string): HymnEntry[] {
  return bundle.hymns.map((h, i) => ({
    id: `h${String(h.number).padStart(3, '0')}-${i}`,
    hymnalId,
    number: h.number,
    title: h.title,
    stanzas: h.stanzas
  }))
}

export async function importHymnalFromDialog(): Promise<HymnalMeta | null> {
  const res = await dialog.showOpenDialog({
    title: 'Import hymnal',
    properties: ['openFile'],
    filters: [
      { name: 'Hymnal', extensions: ['json', 'hymn', 'mdb'] },
      { name: 'All', extensions: ['*'] }
    ]
  })
  if (res.canceled || !res.filePaths[0]) return null
  const filePath = res.filePaths[0]
  const ext = extname(filePath).toLowerCase()

  if (ext === '.mdb') {
    const metas = await importBibsoftMdbPath(filePath)
    return metas[0] ?? null
  }

  const raw = await readFile(filePath, 'utf8')

  if (ext === '.json') {
    const parsed = JSON.parse(raw) as HymnalImportBundle
    if (parsed.format !== 'orion-hymnal' || !Array.isArray(parsed.hymns)) {
      throw new Error('Not a valid orion-hymnal JSON file')
    }
    const label = parsed.meta.label.trim()
    const id = `${slugId(label)}-${Date.now().toString(36)}`
    const hymns = entriesFromImportBundle(parsed, id)
    return writeHymnalPackage(
      id,
      {
        id,
        label,
        abbr: parsed.meta.abbr ?? label.slice(0, 12),
        language: parsed.meta.language ?? 'other'
      },
      hymns
    )
  }

  const blocks = parseHymnalTextDocument(raw)
  if (blocks.length === 0) throw new Error('No hymns found in file')
  const label = basename(filePath, ext)
  const id = `${slugId(label)}-${Date.now().toString(36)}`
  const hymns: HymnEntry[] = blocks.map((h, i) => ({
    id: `h${String(h.number || i + 1).padStart(3, '0')}`,
    hymnalId: id,
    number: h.number || i + 1,
    title: h.title,
    stanzas: h.stanzas
  }))
  return writeHymnalPackage(
    id,
    { id, label, abbr: label.slice(0, 12), language: 'other' },
    hymns
  )
}

async function importBibsoftMdbPath(filePath: string): Promise<HymnalMeta[]> {
  const bundles = await readBibsoftMdbFile(filePath)
  if (bundles.length === 0) throw new Error('No hymnals found in database')
  const metas: HymnalMeta[] = []
  for (const bundle of bundles) {
    const id = defaultImportedHymnalId(bundle.bibsoftId, bundle.label)
    const meta = await writeHymnalPackage(
      id,
      {
        id,
        label: bundle.label,
        abbr: bundle.label.slice(0, 12),
        language: bundle.language
      },
      bundle.hymns
    )
    metas.push(meta)
  }
  return metas
}

export async function importBibsoftMdbFromDialog(): Promise<HymnalMeta[]> {
  const res = await dialog.showOpenDialog({
    title: 'Import Bibsoft / Adventist hymnal database',
    properties: ['openFile'],
    filters: [
      { name: 'Access database', extensions: ['mdb'] },
      { name: 'All', extensions: ['*'] }
    ]
  })
  if (res.canceled || !res.filePaths[0]) return []
  return importBibsoftMdbPath(res.filePaths[0])
}

export async function importHymnalFolderFromDialog(): Promise<HymnalMeta | null> {
  const res = await dialog.showOpenDialog({
    title: 'Import hymnal folder',
    properties: ['openDirectory']
  })
  if (res.canceled || !res.filePaths[0]) return null
  const src = res.filePaths[0]
  const folderName = basename(src)
  const id = `${slugId(folderName)}-${Date.now().toString(36)}`
  const dest = join(userHymnalsRoot(), id)
  await mkdir(userHymnalsRoot(), { recursive: true })
  await cp(src, dest, { recursive: true })
  const loaded = await loadHymnalFromDir(id, dest, 'user')
  if (!loaded) throw new Error('Folder must contain meta.json, index.json, and hymns.json')
  const meta = { ...loaded.meta, id, source: 'user' as const }
  await writeFile(join(dest, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8')
  cache.set(id, { ...loaded, meta })
  return meta
}

export function invalidateHymnalCache(hymnalId?: string): void {
  if (hymnalId) cache.delete(hymnalId)
  else cache.clear()
}

async function persistCachedHymnal(loaded: CachedHymnal): Promise<void> {
  if (loaded.meta.source !== 'user') {
    throw new Error('Hymnal is not writable')
  }
  const hymns = [...loaded.hymnsById.values()].sort((a, b) => a.number - b.number)
  const dir = join(userHymnalsRoot(), loaded.meta.id)
  const summaries: HymnSummary[] = hymns.map((h) => hymnSummaryFromEntry(h))
  const meta: HymnalMeta = { ...loaded.meta, hymnCount: hymns.length }
  await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8')
  await writeFile(join(dir, 'index.json'), JSON.stringify({ summaries } satisfies HymnalIndexFile), 'utf8')
  await writeFile(join(dir, 'hymns.json'), JSON.stringify({ hymns } satisfies HymnalHymnsFile), 'utf8')
  loaded.meta = meta
  loaded.summaries = summaries
}

export async function ensurePersonalHymnal(): Promise<HymnalMeta> {
  const existing = await ensureCached(PERSONAL_HYMNAL_ID)
  if (existing) return existing.meta
  return writeHymnalPackage(
    PERSONAL_HYMNAL_ID,
    {
      id: PERSONAL_HYMNAL_ID,
      label: 'My hymns',
      abbr: 'Mine',
      language: 'other'
    },
    []
  )
}

export async function upsertHymnEntry(
  hymnalId: string,
  input: {
    id?: string
    number: number
    title: string
    stanzas: HymnEntry['stanzas']
  }
): Promise<HymnEntry> {
  let loaded = await ensureCached(hymnalId)
  if (!loaded) throw new Error('Hymnal not found')
  if (loaded.meta.source !== 'user') {
    loaded = await materializeHymnalForEditing(hymnalId)
  }

  const id =
    input.id ??
    `h${String(input.number).padStart(3, '0')}-${Date.now().toString(36).slice(-6)}`
  const entry: HymnEntry = {
    id,
    hymnalId,
    number: input.number,
    title: input.title.trim(),
    stanzas: input.stanzas
  }
  loaded.hymnsById.set(id, entry)
  await persistCachedHymnal(loaded)
  cache.set(hymnalId, loaded)
  return entry
}

export async function deleteHymnEntry(hymnalId: string, hymnId: string): Promise<boolean> {
  let loaded = await ensureCached(hymnalId)
  if (!loaded) return false
  if (loaded.meta.source !== 'user') {
    loaded = await materializeHymnalForEditing(hymnalId)
  }
  if (!loaded.hymnsById.delete(hymnId)) return false
  await persistCachedHymnal(loaded)
  cache.set(hymnalId, loaded)
  return true
}

export function canEditHymnal(meta: HymnalMeta | null | undefined): boolean {
  return Boolean(meta?.id)
}
