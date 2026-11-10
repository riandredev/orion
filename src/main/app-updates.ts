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
  if (percent == null) {
    win.setProgressBar(-1)
    return
  }
  if (percent < 0) {
    win.setProgressBar(2)
    return
  }
  win.setProgressBar(Math.min(1, Math.max(0, percent / 100)))
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
const START_TIMEOUT_MS = 20_000
const STALL_TIMEOUT_MS = 20_000

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

function linkAbort(parent: AbortSignal, controller: AbortController): () => void {
  if (parent.aborted) {
    controller.abort(parent.reason)
    return () => undefined
  }
  const onAbort = (): void => controller.abort(parent.reason)
  parent.addEventListener('abort', onAbort)
  return () => parent.removeEventListener('abort', onAbort)
}

async function writeInstaller(
  response: Response,
  dest: string,
  total: number,
  attempt: AbortController,
  parent: AbortSignal
): Promise<string> {
  const hash = createHash('sha256')
  let received = 0
  let lastByteAt = Date.now()
  let lastPercent = -1
  const stall = setInterval(() => {
    if (Date.now() - lastByteAt < STALL_TIMEOUT_MS) return
    attempt.abort(new Error('The download stalled.'))
  }, 2000)
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      lastByteAt = Date.now()
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
  try {
    await pipeline(
      Readable.fromWeb(response.body as import('stream/web').ReadableStream),
      counter,
      createWriteStream(dest)
    )
  } finally {
    clearInterval(stall)
  }
  if (parent.aborted || attempt.signal.aborted) {
    throw new Error(parent.aborted ? 'The download was canceled.' : 'The download stalled.')
  }
  if (total > 0 && received !== total) {
    throw new Error('The downloaded file is incomplete.')
  }
  return hash.digest('hex')
}

async function downloadInstaller(asset: ReleaseAsset, dest: string, parent: AbortSignal): Promise<void> {
  let lastError: Error | null = null
  for (const url of installerRequestUrls(asset)) {
    for (let attemptNo = 1; attemptNo <= 2; attemptNo += 1) {
      if (parent.aborted) throw new Error('The download was canceled.')
      const attempt = new AbortController()
      const unlink = linkAbort(parent, attempt)
      const started = setTimeout(() => attempt.abort(new Error('The download did not start.')), START_TIMEOUT_MS)
      setDownloadProgress(-1)
      try {
        const response = await fetch(url, {
          signal: attempt.signal,
          redirect: 'follow',
          headers: {
            'User-Agent': 'Orion',
            ...(url.includes('api.github.com') ? { Accept: 'application/octet-stream' } : {})
          }
        })
        clearTimeout(started)
        if (!response.ok || !response.body) {
          await response.body?.cancel().catch(() => undefined)
          throw new Error(response.status ? `GitHub returned ${response.status}.` : 'The download did not start.')
        }
        const headerLength = Number(response.headers.get('content-length'))
        const total = headerLength > 0 ? headerLength : asset.size
        const sha256 = await writeInstaller(response, dest, total, attempt, parent)
        const digest = asset.digest?.replace(/^sha256:/, '')
        if (digest && sha256 !== digest.toLowerCase()) {
          throw new Error('The downloaded file did not match the published checksum.')
        }
        return
      } catch (error) {
        await rm(dest, { force: true })
        if (parent.aborted) throw error instanceof Error ? error : new Error('The download was canceled.')
        lastError = error instanceof Error ? error : new Error('The download did not start.')
        const status = /GitHub returned (\d+)/.exec(lastError.message)
        const retryable =
          lastError.message.includes('stalled') ||
          lastError.message.includes('did not start') ||
          (status != null && RETRYABLE_STATUS.has(Number(status[1])))
        if (!retryable) break
        if (attemptNo < 2) await wait(400 * attemptNo, parent)
      } finally {
        clearTimeout(started)
        unlink()
      }
    }
  }
  throw lastError ?? new Error('The download did not start.')
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
  setDownloadProgress(-1)
  let retry = false
  try {
    await downloadInstaller(update.asset, dest, controller.signal)
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
  const mac = process.platform === 'darwin'
  const response = await ask({
    type: 'info',
    title: 'Orion',
    message: mac ? `Version ${version} is downloaded.` : `Restart to finish installing version ${version}.`,
    detail: mac
      ? 'Open the disk image and drag Orion to Applications, replacing the current app.'
      : undefined,
    buttons: mac ? ['Open disk image', 'Later'] : ['Restart', 'Later'],
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
  if (process.platform === 'darwin') {
    const { shell } = await import('electron')
    const openError = await shell.openPath(file)
    if (openError) throw new Error(openError)
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
