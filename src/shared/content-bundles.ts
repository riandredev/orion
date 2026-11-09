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

export type LibraryCatalogEntry = {
  id: string
  name: string
  summary: string
  version: string
  downloadUrl: string
  size?: number
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
      size: typeof size === 'number' ? size : undefined
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
      size: entry.size
    }
  })
}
