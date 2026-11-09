export type AppEditionId = 'standard' | 'panorama'

export type AppUpdatePhase = 'available' | 'downloading' | 'ready' | 'error'

export type AppUpdateStatus =
  | { phase: 'available'; version: string; notes: string }
  | { phase: 'downloading'; version: string; percent: number }
  | { phase: 'ready'; version: string }
  | { phase: 'error'; message: string }

export type ReleaseAsset = {
  name: string
  browser_download_url: string
  /** API asset URL. The public download link can time out before the file starts. */
  url?: string
  size: number
  digest?: string | null
}

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

const TAG = /^v(\d+\.\d+\.\d+)(?:-panorama)?$/

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

export function versionFromTag(tag: string, edition: AppEditionId): string | null {
  const match = TAG.exec(tag.trim())
  if (!match) return null
  const panorama = tag.trim().endsWith('-panorama')
  if (edition === 'panorama' ? !panorama : panorama) return null
  return match[1]
}

export function installerAssetName(
  edition: AppEditionId,
  version: string,
  platform: NodeJS.Platform
): string | null {
  if (platform === 'win32') {
    return edition === 'panorama'
      ? `Orion-Panorama-${version}-windows-setup.exe`
      : `Orion-${version}-windows-setup.exe`
  }
  if (platform === 'linux') {
    return edition === 'panorama'
      ? `Orion-Panorama-${version}-linux.AppImage`
      : `Orion-${version}-linux.AppImage`
  }
  return null
}

export function installerRequestUrls(asset: ReleaseAsset): string[] {
  const urls = [asset.url, asset.browser_download_url].filter((url): url is string => Boolean(url))
  return [...new Set(urls)]
}

export function selectUpdate(
  releases: ReleaseInfo[],
  edition: AppEditionId,
  platform: NodeJS.Platform,
  currentVersion: string
): SelectedUpdate | null {
  let best: SelectedUpdate | null = null
  for (const release of releases) {
    if (release.draft || release.prerelease) continue
    const version = versionFromTag(release.tag_name, edition)
    if (!version || compareVersions(version, currentVersion) <= 0) continue
    const name = installerAssetName(edition, version, platform)
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

export function summarizeNotes(body: string | null | undefined): string {
  const text = (body ?? '').replace(/\r/g, '').trim()
  if (!text) return ''
  return text.length > 500 ? `${text.slice(0, 500).trimEnd()}…` : text
}
