import { app, dialog, type BrowserWindow, type MessageBoxOptions } from 'electron'
import { spawn } from 'child_process'
import { createHash } from 'crypto'
import { createWriteStream } from 'fs'
import { chmod, copyFile, mkdir, rename, rm, stat } from 'fs/promises'
import { join } from 'path'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import { installerRequestUrls, selectUpdate, type ReleaseAsset, type ReleaseInfo, type SelectedUpdate } from '../shared/app-update'
import { getMainAppWindow } from './projection'

const RELEASES_URL = 'https://api.github.com/repos/riandredev/orion/releases?per_page=20'

let pending: SelectedUpdate | null = null
let downloadedPath: string | null = null
let abort: AbortController | null = null
let dismissed = false

function mainWindow(): BrowserWindow | null {
  const win = getMainAppWindow()
  if (!win || win.isDestroyed()) return null
  return win
}

function setDownloadProgress(percent: number | null): void {
  const win = mainWindow()
  if (!win) return
  win.setProgressBar(percent == null ? -1 : Math.min(1, Math.max(0, percent / 100)))
}

async function ask(options: MessageBoxOptions): Promise<number> {
  const win = mainWindow()
  const result = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options)
  return result.response
}

async function fetchReleases(): Promise<ReleaseInfo[]> {
  const response = await fetch(RELEASES_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Orion'
    }
  })
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
  const body = (await response.json()) as ReleaseInfo[]
  return Array.isArray(body) ? body : []
}

export async function checkForAppUpdate(): Promise<void> {
  if (!app.isPackaged || dismissed || pending) return
  try {
    const selected = selectUpdate(await fetchReleases(), process.platform, app.getVersion())
    if (!selected) return
    pending = selected
    downloadedPath = null
    void promptAvailable(selected)
  } catch {
    /* Offline or rate-limited. The next launch checks again. */
  }
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason instanceof Error ? signal.reason : new Error('The download was canceled.'))
      },
      { once: true }
    )
  })
}

async function openInstaller(asset: ReleaseAsset, signal: AbortSignal): Promise<Response> {
  let lastStatus = 0
  for (const url of installerRequestUrls(asset)) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (signal.aborted) throw new Error('The download was canceled.')
      let response: Response
      try {
        response = await fetch(url, {
          signal,
          redirect: 'follow',
          headers: {
            'User-Agent': 'Orion',
            Accept: 'application/octet-stream'
          }
        })
      } catch (error) {
        if (signal.aborted) throw error
        lastStatus = 0
        if (attempt < 3) await wait(400 * attempt, signal)
        continue
      }
      if (response.ok && response.body) return response
      lastStatus = response.status
      await response.body?.cancel().catch(() => undefined)
      if (!RETRYABLE_STATUS.has(response.status) || attempt === 3) break
      await wait(400 * attempt, signal)
    }
  }
  throw new Error(lastStatus ? `GitHub returned ${lastStatus}.` : 'The download did not start.')
}

async function downloadUpdate(): Promise<void> {
  if (!pending || abort) return
  const update = pending
  const controller = new AbortController()
  abort = controller
  const dir = join(app.getPath('userData'), 'updates')
  await mkdir(dir, { recursive: true })
  const dest = join(dir, update.asset.name)
  await rm(dest, { force: true })
  setDownloadProgress(0)
  let retry = false
  try {
    const response = await openInstaller(update.asset, controller.signal)
    const hash = createHash('sha256')
    let received = 0
    const total = update.asset.size
    let lastPercent = 0
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        hash.update(chunk)
        received += chunk.length
        if (total > 0) {
          const percent = Math.min(100, Math.round((received / total) * 100))
          if (percent !== lastPercent) {
            lastPercent = percent
            setDownloadProgress(percent)
          }
        }
        callback(null, chunk)
      }
    })
    await pipeline(Readable.fromWeb(response.body as import('stream/web').ReadableStream), counter, createWriteStream(dest))
    const digest = update.asset.digest?.replace(/^sha256:/, '')
    if (digest && hash.digest('hex') !== digest.toLowerCase()) {
      throw new Error('The downloaded file did not match the published checksum.')
    }
    if (total > 0 && received !== total) {
      throw new Error('The downloaded file is incomplete.')
    }
    downloadedPath = dest
    setDownloadProgress(null)
    await promptReady(update.version)
  } catch (error) {
    await rm(dest, { force: true })
    setDownloadProgress(null)
    if (controller.signal.aborted) return
    const message = error instanceof Error ? error.message : 'The update could not be downloaded.'
    const response = await ask({
      type: 'error',
      title: 'Orion',
      message: 'The update could not be downloaded.',
      detail: message,
      buttons: ['Try again', 'Close'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    })
    retry = response === 0
  } finally {
    abort = null
  }
  if (retry) await downloadUpdate()
}

async function promptAvailable(update: SelectedUpdate): Promise<void> {
  const response = await ask({
    type: 'info',
    title: 'Orion',
    message: `Version ${update.version} is available.`,
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  })
  if (response !== 0) {
    dismissUpdate()
    return
  }
  await downloadUpdate()
}

async function promptReady(version: string): Promise<void> {
  const response = await ask({
    type: 'info',
    title: 'Orion',
    message: `Restart to finish installing version ${version}.`,
    buttons: ['Restart', 'Later'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  })
  if (response === 0) {
    try {
      await installUpdate()
    } catch (error) {
      await ask({
        type: 'error',
        title: 'Orion',
        message: 'The update could not be installed.',
        detail: error instanceof Error ? error.message : 'The update could not be installed.',
        buttons: ['OK'],
        noLink: true
      })
    }
  }
}

async function installUpdate(): Promise<void> {
  if (!downloadedPath || !pending) return
  const file = downloadedPath
  if (process.platform === 'win32') {
    const child = spawn(file, ['/S', '--force-run'], { detached: true, stdio: 'ignore' })
    child.unref()
    app.quit()
    return
  }
  if (process.platform === 'linux') {
    await chmod(file, 0o755)
    const current = process.env.APPIMAGE
    if (current) {
      const staging = `${current}.orion-update`
      await copyFile(file, staging)
      await chmod(staging, 0o755)
      try {
        await rename(staging, current)
      } catch {
        await copyFile(staging, current)
        await chmod(current, 0o755)
        await rm(staging, { force: true })
      }
      const mode = await stat(current)
      if (!mode.isFile()) throw new Error('The updated AppImage was not written.')
      app.relaunch()
      app.quit()
      return
    }
  }
  const { shell } = await import('electron')
  await shell.openPath(file)
}

function dismissUpdate(): void {
  abort?.abort()
  abort = null
  dismissed = true
  pending = null
  downloadedPath = null
}

export function scheduleAppUpdateCheck(): void {
  if (!app.isPackaged) return
  setTimeout(() => {
    void checkForAppUpdate()
  }, 4000)
}
