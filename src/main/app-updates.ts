import { app, ipcMain } from 'electron'
import { spawn } from 'child_process'
import { createHash } from 'crypto'
import { createWriteStream } from 'fs'
import { chmod, copyFile, mkdir, rename, rm, stat } from 'fs/promises'
import { join } from 'path'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import {
  selectUpdate,
  type AppUpdateStatus,
  type ReleaseInfo,
  type SelectedUpdate
} from '../shared/app-update'
import { readEdition } from './edition'
import { getMainAppWindow } from './projection'

const RELEASES_URL = 'https://api.github.com/repos/riandredev/orion/releases?per_page=20'

let pending: SelectedUpdate | null = null
let downloadedPath: string | null = null
let abort: AbortController | null = null
let dismissed = false

function send(status: AppUpdateStatus): void {
  const win = getMainAppWindow()
  if (!win || win.isDestroyed()) return
  win.webContents.send('orion:app-update', status)
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
    const edition = readEdition()
    const selected = selectUpdate(
      await fetchReleases(),
      edition.id,
      process.platform,
      app.getVersion()
    )
    if (!selected) return
    pending = selected
    downloadedPath = null
    send({ phase: 'available', version: selected.version, notes: selected.notes })
  } catch {
    /* Offline or rate-limited. The next launch checks again. */
  }
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
  send({ phase: 'downloading', version: update.version, percent: 0 })
  try {
    const response = await fetch(update.asset.browser_download_url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Orion' },
      redirect: 'follow'
    })
    if (!response.ok || !response.body) throw new Error('The download did not start.')
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
            send({ phase: 'downloading', version: update.version, percent })
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
    send({ phase: 'ready', version: update.version })
  } catch (error) {
    await rm(dest, { force: true })
    if (controller.signal.aborted) return
    send({
      phase: 'error',
      message: error instanceof Error ? error.message : 'The update could not be downloaded.'
    })
  } finally {
    abort = null
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

export function registerAppUpdates(): void {
  ipcMain.handle('orion:app-update-download', () => downloadUpdate())
  ipcMain.handle('orion:app-update-install', async () => {
    try {
      await installUpdate()
    } catch (error) {
      send({
        phase: 'error',
        message: error instanceof Error ? error.message : 'The update could not be installed.'
      })
    }
  })
  ipcMain.handle('orion:app-update-dismiss', () => {
    dismissUpdate()
  })
}

export function scheduleAppUpdateCheck(): void {
  if (!app.isPackaged) return
  setTimeout(() => {
    void checkForAppUpdate()
  }, 4000)
}
