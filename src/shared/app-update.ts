export type AppUpdatePhase = 'available' | 'downloading' | 'ready' | 'error'

export type AppUpdateStatus =
  | { phase: 'available'; version: string; notes: string }
  | { phase: 'downloading'; version: string; percent: number }
  | { phase: 'ready'; version: string }
  | { phase: 'error'; message: string }

export type ReleaseAsset = {
  name: string
  browser_download_url: string
  /** API asset URL. Used when the public download does not start. */
  url?: string
  size: number
  digest?: string | null
  id?: number
  updated_at?: string
}

export type UpdateChannel = 'stable' | 'experimental'

export type ReleaseInfo = {
  tag_name: string
  body?: string | null
  draft?: boolean
  prerelease?: boolean
  assets?: ReleaseAsset[]
}

export type SelectedUpdate = {
  version: string
  notes: string
  asset: ReleaseAsset
}

const TAG = /^v(\d+\.\d+\.\d+)$/

export function parseVersion(value: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim())
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (!a || !b) return 0
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

export function versionFromTag(tag: string): string | null {
  const match = TAG.exec(tag.trim())
  return match ? match[1] : null
}

export function installerAssetName(version: string, platform: NodeJS.Platform): string | null {
  if (platform === 'win32') return `Orion-${version}-windows-setup.exe`
  if (platform === 'linux') return `Orion-${version}-linux.AppImage`
  if (platform === 'darwin') return `Orion-${version}-mac.dmg`
  return null
}

export function installerRequestUrls(asset: ReleaseAsset): string[] {
  const urls = [asset.browser_download_url, asset.url].filter((url): url is string => Boolean(url))
  return [...new Set(urls)]
}

export function selectUpdate(
  releases: ReleaseInfo[],
  platform: NodeJS.Platform,
  currentVersion: string,
  options?: { latest?: boolean }
): SelectedUpdate | null {
  let best: SelectedUpdate | null = null
  for (const release of releases) {
    if (release.draft || release.prerelease) continue
    const version = versionFromTag(release.tag_name)
    if (!version) continue
    if (!options?.latest && compareVersions(version, currentVersion) <= 0) continue
    const name = installerAssetName(version, platform)
    const asset = name ? release.assets?.find((item) => item.name === name) : undefined
    if (!asset?.browser_download_url) continue
    if (!best || compareVersions(version, best.version) > 0) {
      best = {
        version,
        notes: summarizeNotes(release.body),
        asset
      }
    }
  }
  return best
}

const EXPERIMENTAL_TAG = 'experimental'

/** The rolling experimental installer. `force` is used when the user switches to that line. */
export function selectExperimentalUpdate(
  releases: ReleaseInfo[],
  platform: NodeJS.Platform,
  currentVersion: string,
  installed: { assetId?: number; assetUpdatedAt?: string } | null,
  force: boolean
): SelectedUpdate | null {
  if (platform !== 'win32') return null
  const release = releases.find((item) => !item.draft && item.tag_name === EXPERIMENTAL_TAG)
  const asset = release?.assets?.find(
    (item) => /experimental-windows-setup\.exe$/i.test(item.name) && item.browser_download_url
  )
  if (!release || !asset) return null
  const sameBuild =
    installed?.assetUpdatedAt != null && asset.updated_at != null
      ? installed.assetUpdatedAt === asset.updated_at
      : installed?.assetId != null && asset.id != null && installed.assetId === asset.id
  const version = /^Orion-(.+)-windows-setup\.exe$/i.exec(asset.name)?.[1] ?? 'experimental'
  if (!force && (sameBuild || ((!installed?.assetId && !installed?.assetUpdatedAt) && version === currentVersion))) {
    return null
  }
  return {
    version,
    notes: summarizeNotes(release.body),
    asset
  }
}

export function summarizeNotes(body: string | null | undefined): string {
  const text = (body ?? '').replace(/\r/g, '').trim()
  if (!text) return ''
  return text.length > 500 ? `${text.slice(0, 500).trimEnd()}…` : text
}
