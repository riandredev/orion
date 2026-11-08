import { spawn } from 'child_process'
import { app, nativeImage, type NativeImage } from 'electron'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { readEdition } from './edition'
import { is } from './env'

const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512]

function iconPath(): string {
  return is.dev ? join(process.cwd(), 'build', 'icon.png') : join(process.resourcesPath, 'icon.png')
}

/** Window class shared by the desktop entry and the running Linux window. */
export function linuxWindowClass(): string {
  return readEdition().id === 'panorama' ? 'orion-panorama' : 'orion'
}

/**
 * Wayland (Zorin, GNOME) picks the taskbar icon by app id, not by the window bitmap.
 * The packaged product name is "Orion", which does not match orion.desktop.
 * Lock the user-data directory first so renaming the app id does not move settings.
 */
export function applyLinuxWindowIdentity(): void {
  if (process.platform !== 'linux') return
  const id = linuxWindowClass()
  const userData = app.getPath('userData')
  app.setPath('userData', userData)
  app.setName(id)
  const desktopName = `${id}.desktop`
  const setDesktopName = (app as { setDesktopName?: (name: string) => void }).setDesktopName
  setDesktopName?.call(app, desktopName)
}

/**
 * Square logomark used for the window and taskbar.
 * One 256px bitmap: stacking several images at scale factor 1 makes Windows
 * keep the first (16px) and enlarge it on the taskbar.
 */
export function appIcon(): NativeImage {
  const source = nativeImage.createFromPath(iconPath())
  if (source.isEmpty()) return source
  return source.resize({ width: 256, height: 256, quality: 'best' })
}

/** Register a desktop entry so Linux panels can match the window to the logomark. */
export async function installLinuxDesktopEntry(): Promise<void> {
  if (process.platform !== 'linux' || !app.isPackaged) return
  const edition = readEdition()
  const id = linuxWindowClass()
  const home = app.getPath('home')
  const exec = process.env.APPIMAGE || process.execPath
  const source = nativeImage.createFromPath(iconPath())
  if (source.isEmpty()) return
  const applications = join(home, '.local', 'share', 'applications')
  const iconFile = join(home, '.local', 'share', 'icons', `${id}.png`)
  await mkdir(applications, { recursive: true })
  await mkdir(join(iconFile, '..'), { recursive: true })
  await writeFile(iconFile, source.resize({ width: 512, height: 512, quality: 'best' }).toPNG())
  const desktop = [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${edition.name}`,
    `Exec="${exec.replace(/"/g, '\\"')}" %U`,
    `Icon=${iconFile}`,
    `StartupWMClass=${id}`,
    'Categories=Office;',
    'Terminal=false',
    'NoDisplay=false',
    ''
  ].join('\n')
  await writeFile(join(applications, `${id}.desktop`), desktop)
  const hicolor = join(home, '.local', 'share', 'icons', 'hicolor')
  for (const size of ICON_SIZES) {
    const dir = join(hicolor, `${size}x${size}`, 'apps')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, `${id}.png`), source.resize({ width: size, height: size, quality: 'best' }).toPNG())
  }
  try {
    const child = spawn('update-desktop-database', [applications], { stdio: 'ignore', detached: true })
    child.on('error', () => {
      /* optional; GNOME also watches the applications folder */
    })
    child.unref()
  } catch {
    /* ignore */
  }
}
