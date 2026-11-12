export type LibraryFolderSort = 'az' | 'za'

export type LibraryManifest = {
  format: 'orion-bundle'
  formatVersion: 1
  id: string
  name: string
  summary: string
  version: string
  orderFolderSort?: LibraryFolderSort
}

export type LibraryPreviewImage = {
  src: string
  alt: string
  folder?: string
}

export type LibraryPreviewGroup = {
  label: string
  items: string[]
  images?: LibraryPreviewImage[]
}

export type LibraryCatalogEntry = {
  id: string
  name: string
  summary: string
  version: string
  downloadUrl: string
  size?: number
  preview?: LibraryPreviewGroup[]
}

export type LibraryStatus = 'available' | 'installed' | 'update'

export type LibraryRow = {
  id: string
  name: string
  summary: string
  availableVersion: string
  installedVersion: string | null
  status: LibraryStatus
  size?: number
  preview?: LibraryPreviewGroup[]
}

export type LibraryList = {
  libraries: LibraryRow[]
  updates: number
  catalogError: string | null
}

export type LibraryProgress = {
  id: string
  phase: 'downloading' | 'installing'
  percent: number
  message: string
}

const ID = /^[a-z0-9][a-z0-9-]{0,40}$/

function parsePreviewImages(value: unknown): LibraryPreviewImage[] | undefined {
  if (!Array.isArray(value)) return undefined
  const images: LibraryPreviewImage[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    const src = typeof raw.src === 'string' ? raw.src.trim() : ''
    if (!src || src.includes('..') || src.startsWith('/') || src.includes('\\') || /^https?:/i.test(src)) continue
    const alt = typeof raw.alt === 'string' ? raw.alt.trim() : ''
    const folder = typeof raw.folder === 'string' ? raw.folder.trim() : ''
    images.push(folder ? { src, alt, folder } : { src, alt })
  }
  return images.length > 0 ? images.slice(0, 400) : undefined
}

function parsePreview(value: unknown): LibraryPreviewGroup[] | undefined {
  if (!Array.isArray(value)) return undefined
  const groups: LibraryPreviewGroup[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    const label = typeof raw.label === 'string' ? raw.label.trim() : ''
    const items = Array.isArray(raw.items)
      ? raw.items
          .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          .map((entry) => entry.trim())
          .slice(0, 400)
      : []
    const images = parsePreviewImages(raw.images)
    if (!label || (items.length === 0 && !images)) continue
    groups.push(images ? { label, items, images } : { label, items })
  }
  return groups.length > 0 ? groups.slice(0, 8) : undefined
}

function previewHasImages(groups: LibraryPreviewGroup[] | undefined): boolean {
  return groups?.some((group) => group.images && group.images.length > 0) ?? false
}

/** Keep a contents preview when a newer catalog download does not include one. */
export function mergeLibraryPreview(
  entries: LibraryCatalogEntry[],
  fallback: LibraryCatalogEntry[]
): LibraryCatalogEntry[] {
  return entries.map((entry) => {
    const local = fallback.find((item) => item.id === entry.id)?.preview
    const remote = entry.preview
    const preview =
      remote && remote.length > 0 && (previewHasImages(remote) || !previewHasImages(local)) ? remote : local
    return preview && preview.length > 0 ? { ...entry, preview } : entry
  })
}

/**
 * Install never replaces a file this library did not write.
 * `copy` writes a missing file, or replaces one this library still owns.
 * `keep` leaves an owned file whose bytes already match the pack.
 * `leave` does not touch a file that was already there from somewhere else.
 */
export function libraryInstallAction(
  previousSha: string | undefined,
  liveSha: string | null,
  bundleSha: string
): 'copy' | 'keep' | 'leave' {
  if (liveSha == null) return 'copy'
  const owned = previousSha != null && liveSha === previousSha
  if (!owned) return 'leave'
  return liveSha === bundleSha ? 'keep' : 'copy'
}

/** Uninstall deletes a file only when it is still the untouched copy this library wrote. */
export function libraryUninstallRemoves(
  indexedSha: string | undefined,
  liveSha: string | null,
  userRemoved: boolean,
  claimedByAnotherLibrary: boolean
): boolean {
  if (userRemoved || claimedByAnotherLibrary) return false
  if (!indexedSha || liveSha == null) return false
  return liveSha === indexedSha
}

export function compareContentVersions(left: string, right: string): number {
  const a = left.trim().split('.')
  const b = right.trim().split('.')
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i += 1) {
    const av = a[i] ?? '0'
    const bv = b[i] ?? '0'
    if (!/^\d+$/.test(av) || !/^\d+$/.test(bv)) return left.localeCompare(right)
    const diff = Number(av) - Number(bv)
    if (diff !== 0) return diff
  }
  return 0
}

export function parseLibraryManifest(value: unknown): LibraryManifest | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (raw.format !== 'orion-bundle' || raw.formatVersion !== 1) return null
  if (typeof raw.id !== 'string' || !ID.test(raw.id)) return null
  if (typeof raw.name !== 'string' || !raw.name.trim()) return null
  if (typeof raw.summary !== 'string') return null
  if (typeof raw.version !== 'string' || !raw.version.trim()) return null
  const sort = raw.orderFolderSort
  if (sort != null && sort !== 'az' && sort !== 'za') return null
  return {
    format: 'orion-bundle',
    formatVersion: 1,
    id: raw.id,
    name: raw.name.trim(),
    summary: raw.summary.trim(),
    version: raw.version.trim(),
    orderFolderSort: sort === 'za' || sort === 'az' ? sort : undefined
  }
}

export function parseLibraryCatalog(value: unknown): LibraryCatalogEntry[] | null {
  if (!value || typeof value !== 'object') return null
  const bundles = (value as { bundles?: unknown }).bundles
  if (!Array.isArray(bundles)) return null
  const entries: LibraryCatalogEntry[] = []
  for (const item of bundles) {
    if (!item || typeof item !== 'object') return null
    const raw = item as Record<string, unknown>
    if (typeof raw.id !== 'string' || !ID.test(raw.id)) return null
    if (typeof raw.name !== 'string' || !raw.name.trim()) return null
    if (typeof raw.summary !== 'string') return null
    if (typeof raw.version !== 'string' || !raw.version.trim()) return null
    if (typeof raw.downloadUrl !== 'string' || !/^https:\/\//.test(raw.downloadUrl)) return null
    const size = raw.size
    if (size != null && (typeof size !== 'number' || !Number.isFinite(size) || size < 0)) return null
    entries.push({
      id: raw.id,
      name: raw.name.trim(),
      summary: raw.summary.trim(),
      version: raw.version.trim(),
      downloadUrl: raw.downloadUrl,
      size: typeof size === 'number' ? size : undefined,
      preview: parsePreview(raw.preview)
    })
  }
  return entries
}

export function libraryRows(
  catalog: LibraryCatalogEntry[],
  installed: { id: string; version: string }[]
): LibraryRow[] {
  const have = new Map(installed.map((item) => [item.id, item.version]))
  return catalog.map((entry) => {
    const current = have.get(entry.id) ?? null
    const status: LibraryStatus =
      current == null
        ? 'available'
        : compareContentVersions(entry.version, current) > 0
          ? 'update'
          : 'installed'
    return {
      id: entry.id,
      name: entry.name,
      summary: entry.summary,
      availableVersion: entry.version,
      installedVersion: current,
      status,
      size: entry.size,
      preview: entry.preview
    }
  })
}
