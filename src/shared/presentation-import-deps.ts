/** LibreOffice version label for Orion-managed installs. */
export const PRESENTATION_IMPORT_DEPS_VERSION = '24.8.7'

export type PresentationImportDepsPhase =
  | 'idle'
  | 'downloading'
  | 'installing'
  | 'extracting'
  | 'pruning'
  | 'verifying'
  | 'ready'
  | 'error'

export type PresentationImportDepsProgress = {
  phase: PresentationImportDepsPhase
  /** 0–100 when known (download / extract parse). */
  percent?: number
  receivedBytes?: number
  totalBytes?: number
  message?: string
}

export type PresentationImportDepsStatus = {
  ready: boolean
  /** On-demand download is offered on this OS/arch. */
  onDemandAvailable: boolean
  /** Using Orion-downloaded LibreOffice (not only a system install). */
  bundled: boolean
  version?: string
  /** Human-readable size hint for the download button. */
  downloadSizeHint?: string
  /** Shown when not ready and on-demand is unavailable. */
  helpText?: string
  /** Short label for the bundled component row. */
  componentTitle?: string
  /** Explains download vs disk size and suite vs Impress-only. */
  componentSubtitle?: string
}

export function presentationImportDepsDownloadUrl(
  platform: NodeJS.Platform,
  arch: string
): string | null {
  const override =
    typeof process !== 'undefined' && process.env?.ORION_PRESENTATION_DEPS_URL?.trim()
      ? process.env.ORION_PRESENTATION_DEPS_URL.trim()
      : ''
  if (override) return override

  if (platform === 'win32' && (arch === 'x64' || arch === 'arm64')) {
    const v = PRESENTATION_IMPORT_DEPS_VERSION
    return `https://download.documentfoundation.org/libreoffice/portable/${v}/LibreOfficePortablePrevious_${v}_MultilingualStandard.paf.exe`
  }
  return null
}

/** Windows default path uses winget; custom ORION_PRESENTATION_DEPS_URL uses direct download. */
export function presentationImportUsesWingetInstall(
  platform: NodeJS.Platform,
  arch: string
): boolean {
  if (platform !== 'win32') return false
  if (arch !== 'x64' && arch !== 'arm64') return false
  const override =
    typeof process !== 'undefined' && process.env?.ORION_PRESENTATION_DEPS_URL?.trim()
  return !override
}

export function platformSupportsOnDemandPresentationDeps(
  platform: NodeJS.Platform,
  arch: string
): boolean {
  return presentationImportDepsDownloadUrl(platform, arch) !== null
}

export const PRESENTATION_IMPORT_DEPS_DOWNLOAD_SIZE_HINT = '~200 MB download'
export const PRESENTATION_IMPORT_DEPS_DISK_SIZE_HINT = '~400 MB on disk (LibreOffice user install)'

/** Shown in UI — Document Foundation only ships full portable suites. */
export const PRESENTATION_IMPORT_COMPONENT_TITLE = 'LibreOffice Impress engine'
export const PRESENTATION_IMPORT_COMPONENT_SUBTITLE =
  'On Windows, Orion installs LibreOffice via winget (used headless for PowerPoint and Keynote import). You may see a UAC prompt. Advanced: set ORION_PRESENTATION_DEPS_URL to a .7z archive.'
