import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'
import { dialog, net } from 'electron'
import {
  HELLOAO_TRANSLATIONS_URL,
  bibleSuperSearchDownloadUrl,
  bibleSuperSearchModuleId,
  helloAoDownloadUrl,
  mergeOnlineTranslationCatalog
} from '../shared/bible-online'
import type { OnlineBibleTranslation } from '../shared/bible-online'
import { parseBibleSuperSearchJson } from '../shared/bible-biblesupersearch'
import { chapterFromModule, parseBibleSource } from '../shared/bible-import'
import { searchModuleText, type BibleSearchHit, type BibleSearchMode, type BibleSearchScope } from '../shared/bible-search'
import { parseHelloAoSimpleComplete } from '../shared/bible-helloao'
import type {
  BibleChapterDto,
  BibleSourceFormat,
  InstalledBibleInfo,
  OrionBibleModule
} from '../shared/bible-types'
import { biblesRoot } from './paths'

type BibleMeta = InstalledBibleInfo

const moduleCache = new Map<string, OrionBibleModule>()
let onlineCatalogCache: { at: number; items: OnlineBibleTranslation[] } | null = null
const ONLINE_CATALOG_TTL_MS = 15 * 60 * 1000

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

async function readMeta(dir: string): Promise<BibleMeta | null> {
  try {
    const raw = await readFile(join(dir, 'meta.json'), 'utf8')
    const parsed = JSON.parse(raw) as BibleMeta
    if (!parsed?.id || !parsed.label || !parsed.abbr) return null
    return parsed
  } catch {
    return null
  }
}

async function loadModule(bibleId: string): Promise<OrionBibleModule | null> {
  const cached = moduleCache.get(bibleId)
  if (cached) return cached
  const path = join(biblesRoot(), bibleId, 'module.json')
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as OrionBibleModule
    moduleCache.set(bibleId, parsed)
    return parsed
  } catch {
    return null
  }
}

export async function listInstalledBibles(): Promise<InstalledBibleInfo[]> {
  const root = biblesRoot()
  await mkdir(root, { recursive: true })
  let entries: string[]
  try {
    entries = await readdir(root)
  } catch {
    return []
  }

  const items: InstalledBibleInfo[] = []
  for (const entry of entries) {
    const dir = join(root, entry)
    const info = await stat(dir).catch(() => null)
    if (!info?.isDirectory()) continue
    const meta = await readMeta(dir)
    if (meta) items.push(meta)
  }
  return items.sort((a, b) => a.label.localeCompare(b.label))
}

export async function getBibleChapter(
  bibleId: string,
  bookId: string,
  chapter: number
): Promise<BibleChapterDto> {
  const module = await loadModule(bibleId)
  if (!module) return { verses: [] }
  const verses = chapterFromModule(module, bookId, chapter)
  return { verses }
}

export async function searchInstalledBible(
  bibleId: string,
  query: string,
  mode: BibleSearchMode,
  scope: BibleSearchScope,
  limit = 24
): Promise<BibleSearchHit[]> {
  if (!bibleId || bibleId.includes('..') || bibleId.includes('/') || bibleId.includes('\\')) {
    return []
  }
  const module = await loadModule(bibleId)
  if (!module) return []
  return searchModuleText(module, query, mode, scope, limit)
}

export async function importBibleFromDialog(): Promise<InstalledBibleInfo | null> {
  const res = await dialog.showOpenDialog({
    title: 'Import Bible',
    properties: ['openFile'],
    filters: [
      { name: 'Bible modules', extensions: ['json', 'usfm', 'sfm', 'xml'] },
      { name: 'All files', extensions: ['*'] }
    ]
  })
  if (res.canceled || res.filePaths.length === 0) return null

  const sourcePath = res.filePaths[0]!
  const fileName = basename(sourcePath)
  const text = await readFile(sourcePath, 'utf8')
  const { format, module } = parseBibleSource(fileName, text)

  const baseId = slugify(module.abbr || module.label) || 'bible'
  let id = baseId
  let n = 2
  while (await stat(join(biblesRoot(), id)).catch(() => null)) {
    id = `${baseId}-${n}`
    n += 1
  }

  const dir = join(biblesRoot(), id)
  await mkdir(dir, { recursive: true })

  const ext = extname(fileName) || '.txt'
  const sourceName = `source${ext}`
  await copyFile(sourcePath, join(dir, sourceName))
  await writeFile(join(dir, 'module.json'), JSON.stringify(module), 'utf8')

  const meta: BibleMeta = {
    id,
    label: module.label,
    abbr: module.abbr,
    format,
    sourceName,
    importedAt: new Date().toISOString()
  }
  await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8')
  moduleCache.set(id, module)
  return meta
}

export async function listOnlineBibleTranslations(): Promise<OnlineBibleTranslation[]> {
  if (!net.isOnline()) {
    throw new Error('Connect to the internet to browse downloadable translations.')
  }
  if (
    onlineCatalogCache &&
    Date.now() - onlineCatalogCache.at < ONLINE_CATALOG_TTL_MS
  ) {
    return onlineCatalogCache.items
  }

  const response = await fetch(HELLOAO_TRANSLATIONS_URL)
  if (!response.ok) {
    throw new Error(`Could not load translation catalog (${response.status}).`)
  }
  const data = (await response.json()) as {
    translations?: Array<Record<string, unknown>>
  }
  const items = (data.translations ?? [])
    .filter((row) => {
      const formats = row.availableFormats
      return Array.isArray(formats) && formats.includes('json')
    })
    .map((row) => ({
      id: String(row.id ?? ''),
      name: String(row.name ?? row.englishName ?? 'Translation'),
      englishName: String(row.englishName ?? row.name ?? 'Translation'),
      shortName: String(row.shortName ?? row.id ?? 'Bible'),
      language: String(row.language ?? 'und'),
      languageName: typeof row.languageName === 'string' ? row.languageName : null,
      languageEnglishName:
        typeof row.languageEnglishName === 'string' ? row.languageEnglishName : null,
      licenseUrl: String(row.licenseUrl ?? ''),
      numberOfBooks: Number(row.numberOfBooks ?? 0)
    }))
    .filter((t) => t.id.length > 0)

  const merged = mergeOnlineTranslationCatalog(items)
  onlineCatalogCache = { at: Date.now(), items: merged }
  return merged
}

async function downloadBibleSuperSearchTranslation(
  catalogId: string,
  moduleId: string
): Promise<InstalledBibleInfo> {
  const installed = await listInstalledBibles()
  const existing = installed.find((b) => b.catalogSourceId === catalogId)
  if (existing) return existing

  const url = bibleSuperSearchDownloadUrl(moduleId)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}). Try again later.`)
  }
  const raw: unknown = await response.json()
  const module = parseBibleSuperSearchJson(raw)

  let folderId = slugify(`bss-${moduleId}`)
  let n = 2
  while (await stat(join(biblesRoot(), folderId)).catch(() => null)) {
    folderId = `${slugify(`bss-${moduleId}`)}-${n}`
    n += 1
  }

  const dir = join(biblesRoot(), folderId)
  await mkdir(dir, { recursive: true })
  const sourceName = `${moduleId}.biblesupersearch.json`
  await writeFile(join(dir, 'module.json'), JSON.stringify(module), 'utf8')

  const meta: BibleMeta = {
    id: folderId,
    label: module.label,
    abbr: module.abbr,
    format: 'orion-json',
    sourceName,
    importedAt: new Date().toISOString(),
    catalogSourceId: catalogId
  }
  await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8')
  moduleCache.set(folderId, module)
  return meta
}

export async function downloadHelloAoTranslation(
  translationId: string
): Promise<InstalledBibleInfo> {
  const id = translationId.trim()
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\')) {
    throw new Error('Invalid translation id.')
  }
  if (!net.isOnline()) {
    throw new Error('You appear to be offline. Connect to the internet to download translations.')
  }

  const bssModule = bibleSuperSearchModuleId(id)
  if (bssModule) {
    return downloadBibleSuperSearchTranslation(id, bssModule)
  }

  const installed = await listInstalledBibles()
  const existing = installed.find((b) => b.catalogSourceId === id)
  if (existing) return existing

  const url = helloAoDownloadUrl(id)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}). Try again later.`)
  }
  const raw: unknown = await response.json()
  const module = parseHelloAoSimpleComplete(raw)

  let folderId = slugify(id)
  let n = 2
  while (await stat(join(biblesRoot(), folderId)).catch(() => null)) {
    folderId = `${slugify(id)}-${n}`
    n += 1
  }

  const dir = join(biblesRoot(), folderId)
  await mkdir(dir, { recursive: true })
  const sourceName = `${id}.helloao.json`
  await writeFile(join(dir, 'module.json'), JSON.stringify(module), 'utf8')

  const meta: BibleMeta = {
    id: folderId,
    label: module.label,
    abbr: module.abbr,
    format: 'orion-json',
    sourceName,
    importedAt: new Date().toISOString(),
    catalogSourceId: id
  }
  await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8')
  moduleCache.set(folderId, module)
  return meta
}

export async function removeInstalledBible(bibleId: string): Promise<boolean> {
  if (!bibleId || bibleId.includes('..') || bibleId.includes('/') || bibleId.includes('\\')) {
    return false
  }
  const dir = join(biblesRoot(), bibleId)
  try {
    const info = await stat(dir)
    if (!info.isDirectory()) return false
  } catch {
    return false
  }
  await rm(dir, { recursive: true, force: true })
  moduleCache.delete(bibleId)
  return true
}

export function formatLabelForSource(format: BibleSourceFormat): string {
  switch (format) {
    case 'orion-json':
      return 'Orion JSON'
    case 'usfm':
      return 'USFM'
    case 'zefania-xml':
      return 'Zefania XML'
  }
}
