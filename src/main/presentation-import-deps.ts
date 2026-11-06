import { app, BrowserWindow } from 'electron'
import { execFileSync, spawn } from 'child_process'
import { createWriteStream } from 'fs'
import { existsSync } from 'fs'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { path7za } from '7zip-bin'
import type {
  PresentationImportDepsProgress,
  PresentationImportDepsStatus
} from '../shared/presentation-import-deps'
import {
  PRESENTATION_IMPORT_COMPONENT_SUBTITLE,
  PRESENTATION_IMPORT_COMPONENT_TITLE,
  PRESENTATION_IMPORT_DEPS_DOWNLOAD_SIZE_HINT,
  PRESENTATION_IMPORT_DEPS_VERSION,
  platformSupportsOnDemandPresentationDeps,
  presentationImportDepsDownloadUrl,
  presentationImportUsesWingetInstall
} from '../shared/presentation-import-deps'

const SEVEN_Z_MAGIC = Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])

const MANIFEST_NAME = 'orion-deps-manifest.json'

type DepsManifest = {
  version: string
  sofficePath: string
  installedAt: string
  source: 'bundled' | 'winget'
}

let activeDownload: { abort: AbortController } | null = null

function depsRoot(): string {
  return join(app.getPath('userData'), 'presentation-import')
}

function installRoot(): string {
  return join(depsRoot(), 'libreoffice')
}

function manifestPath(): string {
  return join(installRoot(), MANIFEST_NAME)
}

function broadcastProgress(progress: PresentationImportDepsProgress): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.webContents.send('orion:presentation-import-deps-progress', progress)
  }
}

async function readManifest(): Promise<DepsManifest | null> {
  try {
    const raw = await readFile(manifestPath(), 'utf8')
    const parsed = JSON.parse(raw) as DepsManifest
    if (!parsed.sofficePath || !existsSync(parsed.sofficePath)) return null
    return parsed
  } catch {
    return null
  }
}

export function systemSofficePath(): string | null {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA ?? ''
    const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
    const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
    const candidates = [
      join(localAppData, 'Programs', 'LibreOffice', 'program', 'soffice.exe'),
      join(programFiles, 'LibreOffice', 'program', 'soffice.exe'),
      join(programFilesX86, 'LibreOffice', 'program', 'soffice.exe')
    ]
    for (const path of candidates) {
      if (existsSync(path)) return path
    }
    return null
  }
  if (process.platform === 'darwin') {
    const macPath = '/Applications/LibreOffice.app/Contents/MacOS/soffice'
    return existsSync(macPath) ? macPath : null
  }
  const linuxCandidates = [
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/usr/local/bin/soffice',
    '/usr/lib/libreoffice/program/soffice',
    '/usr/lib64/libreoffice/program/soffice',
    '/snap/bin/libreoffice'
  ]
  for (const path of linuxCandidates) {
    if (existsSync(path)) return path
  }
  return commandOnPath('soffice') ?? commandOnPath('libreoffice')
}

function commandOnPath(bin: string): string | null {
  if (process.platform === 'win32') return null
  try {
    const found = execFileSync('which', [bin], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    const first = found.split('\n')[0]?.trim()
    return first && existsSync(first) ? first : null
  } catch {
    return null
  }
}

async function findSofficeUnder(dir: string, depth = 0): Promise<string | null> {
  if (depth > 8) return null
  const programCandidate = join(dir, 'program', 'soffice.exe')
  if (existsSync(programCandidate)) return programCandidate
  const programCandidateBin = join(dir, 'program', 'soffice')
  if (existsSync(programCandidateBin)) return programCandidateBin

  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return null
  }
  for (const name of entries) {
    const full = join(dir, name)
    try {
      const info = await stat(full)
      if (info.isDirectory()) {
        const found = await findSofficeUnder(full, depth + 1)
        if (found) return found
      }
    } catch {
      /* skip */
    }
  }
  return null
}

async function pruneLibreOfficeForPresentationImport(sofficePath: string): Promise<void> {
  const programDir = dirname(sofficePath)
  const loRoot = dirname(programDir)

  const launchers = ['swriter.exe', 'scalc.exe', 'sdraw.exe', 'smath.exe', 'sbase.exe', 'simpress.exe']
  for (const name of launchers) {
    await rm(join(programDir, name), { force: true }).catch(() => undefined)
  }

  const relDirs = [
    'help',
    'readmes',
    join('share', 'gallery'),
    join('share', 'wizards'),
    join('share', 'template', 'wizard'),
    join('share', 'toolbarmode')
  ]
  for (const rel of relDirs) {
    await rm(join(loRoot, rel), { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function getPresentationImportDepsStatus(): Promise<PresentationImportDepsStatus> {
  const onDemandAvailable = platformSupportsOnDemandPresentationDeps(process.platform, process.arch)
  const manifest = await readManifest()
  if (manifest) {
    return {
      ready: true,
      onDemandAvailable,
      bundled: manifest.source === 'bundled',
      version: manifest.version
    }
  }

  const system = systemSofficePath()
  if (system) {
    return {
      ready: true,
      onDemandAvailable,
      bundled: false,
      version: 'system'
    }
  }

  if (onDemandAvailable) {
    return {
      ready: false,
      onDemandAvailable: true,
      bundled: false,
      downloadSizeHint: PRESENTATION_IMPORT_DEPS_DOWNLOAD_SIZE_HINT,
      componentTitle: PRESENTATION_IMPORT_COMPONENT_TITLE,
      componentSubtitle: PRESENTATION_IMPORT_COMPONENT_SUBTITLE,
      helpText:
        'Import PowerPoint and Keynote files requires a one-time install of LibreOffice (downloaded via winget, then installed with the Windows installer).'
    }
  }

  return {
    ready: false,
    onDemandAvailable: false,
    bundled: false,
    componentTitle: PRESENTATION_IMPORT_COMPONENT_TITLE,
    componentSubtitle: PRESENTATION_IMPORT_COMPONENT_SUBTITLE,
    helpText:
      'Install LibreOffice from libreoffice.org on this computer, or export PDF from PowerPoint until on-demand install is available on your platform.'
  }
}

export async function resolveSofficeForPresentationImport(): Promise<string | null> {
  const manifest = await readManifest()
  if (manifest?.sofficePath && existsSync(manifest.sofficePath)) {
    return manifest.sofficePath
  }
  return systemSofficePath()
}

function parse7zipPercent(line: string): number | undefined {
  const match = line.match(/(\d{1,3})%/)
  if (!match) return undefined
  const n = Number(match[1])
  if (!Number.isFinite(n)) return undefined
  return Math.min(100, Math.max(0, n))
}

function extract7z(archivePath: string, destDir: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(path7za, ['x', archivePath, `-o${destDir}`, '-y', '-bsp1'], {
      windowsHide: true
    })
    let stderr = ''
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.stdout?.on('data', (chunk: Buffer) => {
      const percent = parse7zipPercent(chunk.toString())
      if (percent !== undefined) {
        broadcastProgress({
          phase: 'extracting',
          percent,
          message: 'Extracting presentation import components…'
        })
      }
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(sanitizeExtractError(stderr.trim() || `Extract failed (code ${code ?? 'unknown'})`)))
    })
  })
}

function resolveMirrorRedirect(currentUrl: string, location: string | null): string {
  const current = new URL(currentUrl)
  if (!location) return currentUrl
  const loc = location.trim()
  if (loc.startsWith('http://') || loc.startsWith('https://')) {
    const target = new URL(loc)
    if (target.pathname === '/' || target.pathname === '') {
      return new URL(current.pathname + current.search, target.origin).href
    }
    return target.href
  }
  return new URL(loc, current).href
}

async function validateDownloadedArchive(filePath: string): Promise<'7z' | 'pe'> {
  const head = (await readFile(filePath)).subarray(0, 512)
  if (head.length < 64) {
    throw new Error('Download incomplete. Check your network connection and try again.')
  }
  if (head.subarray(0, 6).equals(SEVEN_Z_MAGIC)) return '7z'
  if (head[0] === 0x4d && head[1] === 0x5a) return 'pe'
  const asText = head.subarray(0, 32).toString('utf8').toLowerCase()
  if (asText.includes('<!doctype') || asText.includes('<html')) {
    throw new Error(
      'Download failed: the server returned a web page instead of an archive. Try again or set ORION_PRESENTATION_DEPS_URL.'
    )
  }
  throw new Error('Download failed: file is not a valid LibreOffice archive.')
}

function sanitizeExtractError(message: string): string {
  if (message.includes('Is not archive') || message.includes('Cannot open the file as [7z]')) {
    return 'Download failed: the file is not a valid archive. Delete partial downloads and try again.'
  }
  if (message.length > 240) return `${message.slice(0, 240)}…`
  return message
}

async function resolveLibreOfficeInstallerUrl(): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      'winget',
      ['show', '--id', 'TheDocumentFoundation.LibreOffice', '--disable-interactivity'],
      { windowsHide: true }
    )
    let output = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('Could not resolve LibreOffice download URL (winget).'))
        return
      }
      const match = output.match(/Installer Url:\s*(\S+)/i)
      if (!match?.[1]) {
        reject(new Error('Could not parse LibreOffice installer URL from winget.'))
        return
      }
      resolvePromise(match[1])
    })
  })
}

async function runLibreOfficeMsiInstaller(msiPath: string, signal: AbortSignal): Promise<void> {
  broadcastProgress({
    phase: 'installing',
    percent: 0,
    message: 'Installing LibreOffice…'
  })

  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(
      'msiexec',
      ['/i', msiPath, '/passive', '/norestart'],
      { windowsHide: false, signal }
    )
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0 || code === 3010) resolvePromise()
      else reject(new Error(`LibreOffice installer failed (exit ${code ?? 'unknown'}).`))
    })
  })
}

async function installLibreOfficeViaWinget(signal: AbortSignal): Promise<string> {
  // VC++ runtime is usually already present; skip winget here to avoid false failures.
  const installerUrl = await resolveLibreOfficeInstallerUrl()
  const downloadDir = join(depsRoot(), 'downloads')
  await mkdir(downloadDir, { recursive: true })
  const msiPath = join(downloadDir, 'LibreOffice.msi')

  await downloadToFile(installerUrl, msiPath, signal)
  await runLibreOfficeMsiInstaller(msiPath, signal)

  broadcastProgress({
    phase: 'installing',
    percent: 100,
    message: 'Installing LibreOffice…'
  })

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const found = systemSofficePath()
    if (found) return found
    await new Promise((r) => setTimeout(r, 2000))
  }

  throw new Error(
    'LibreOffice install finished but soffice.exe was not found. Restart Orion after installing LibreOffice manually.'
  )
}

async function downloadToFile(
  url: string,
  destPath: string,
  signal: AbortSignal
): Promise<void> {
  await rm(destPath, { force: true }).catch(() => undefined)
  await mkdir(dirname(destPath), { recursive: true })

  let fetchUrl = url
  for (let hop = 0; hop < 10; hop += 1) {
    const response = await fetch(fetchUrl, { signal, redirect: 'manual' })
    if (response.status >= 300 && response.status < 400) {
      fetchUrl = resolveMirrorRedirect(fetchUrl, response.headers.get('location'))
      continue
    }
    if (!response.ok) {
      throw new Error(
        response.status === 404
          ? 'Download link not found (404). Check your network or try again later.'
          : `Download failed (${response.status})`
      )
    }

    const totalBytes = Number(response.headers.get('content-length') ?? 0) || undefined
    const body = response.body
    if (!body) throw new Error('Download failed (empty body)')

    const file = createWriteStream(destPath)
    const reader = body.getReader()
    let receivedBytes = 0

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        receivedBytes += value.byteLength
        if (!file.write(Buffer.from(value))) {
          await new Promise<void>((resolvePromise) => file.once('drain', resolvePromise))
        }
        const percent =
          totalBytes && totalBytes > 0
            ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
            : undefined
        broadcastProgress({
          phase: 'downloading',
          percent,
          receivedBytes,
          totalBytes,
          message: 'Downloading LibreOffice…'
        })
      }
    } finally {
      file.end()
    }

    await new Promise<void>((resolvePromise, reject) => {
      file.on('finish', () => resolvePromise())
      file.on('error', reject)
    })
    return
  }

  throw new Error('Download failed: too many redirects.')
}

export async function downloadPresentationImportDeps(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  if (activeDownload) {
    return { ok: false, message: 'A download is already in progress.' }
  }

  const status = await getPresentationImportDepsStatus()
  if (status.ready) {
    broadcastProgress({ phase: 'ready', percent: 100, message: 'Presentation import is ready.' })
    return { ok: true }
  }

  if (!status.onDemandAvailable) {
    return {
      ok: false,
      message: status.helpText ?? 'On-demand install is not available on this platform.'
    }
  }

  const url = presentationImportDepsDownloadUrl(process.platform, process.arch)
  const useWinget = presentationImportUsesWingetInstall(process.platform, process.arch)

  if (!useWinget && !url) {
    return { ok: false, message: 'No download URL for this platform.' }
  }

  const abort = new AbortController()
  activeDownload = { abort }

  const root = depsRoot()
  const downloadDir = join(root, 'downloads')

  try {
    await mkdir(downloadDir, { recursive: true })
    await rm(installRoot(), { recursive: true, force: true }).catch(() => undefined)

    let sofficePath: string
    let manifestSource: DepsManifest['source'] = 'bundled'

    if (useWinget) {
      sofficePath = await installLibreOfficeViaWinget(abort.signal)
      manifestSource = 'winget'
    } else {
      const archivePath = join(
        downloadDir,
        `libreoffice-portable-${PRESENTATION_IMPORT_DEPS_VERSION}.7z`
      )
      await downloadToFile(url!, archivePath, abort.signal)
      const kind = await validateDownloadedArchive(archivePath)
      if (kind !== '7z') {
        throw new Error(
          'Custom dependency URL must point to a .7z portable archive (set ORION_PRESENTATION_DEPS_URL).'
        )
      }
      await mkdir(installRoot(), { recursive: true })
      broadcastProgress({
        phase: 'extracting',
        message: 'Extracting presentation import components…'
      })
      await extract7z(archivePath, installRoot())
      broadcastProgress({ phase: 'verifying', message: 'Locating converter…' })
      const found = await findSofficeUnder(installRoot())
      if (!found) {
        throw new Error('Could not find LibreOffice after extract.')
      }
      sofficePath = found
      broadcastProgress({
        phase: 'pruning',
        message: 'Removing unused suite components…'
      })
      await pruneLibreOfficeForPresentationImport(sofficePath)
    }

    broadcastProgress({ phase: 'verifying', message: 'Saving configuration…' })
    await mkdir(installRoot(), { recursive: true })
    const manifest: DepsManifest = {
      version: PRESENTATION_IMPORT_DEPS_VERSION,
      sofficePath: resolve(sofficePath),
      installedAt: new Date().toISOString(),
      source: manifestSource
    }
    await writeFile(manifestPath(), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

    broadcastProgress({
      phase: 'ready',
      percent: 100,
      message: 'Presentation import is ready.'
    })
    return { ok: true }
  } catch (err) {
    if (abort.signal.aborted) {
      broadcastProgress({ phase: 'idle', message: 'Download canceled.' })
      return { ok: false, message: 'Download canceled.' }
    }
    const message =
      err instanceof Error ? sanitizeExtractError(err.message) : 'Download failed.'
    broadcastProgress({ phase: 'error', message })
    return { ok: false, message }
  } finally {
    activeDownload = null
  }
}

export function cancelPresentationImportDepsDownload(): void {
  activeDownload?.abort.abort()
}
