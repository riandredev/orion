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
  await mkdir(applications, { recursive: true })
  const desktop = [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${edition.name}`,
    `Exec="${exec.replace(/"/g, '\\"')}" %U`,
    `Icon=${id}`,
    `StartupWMClass=${id}`,
    'Categories=Office;',
    'Terminal=false',
    ''
  ].join('\n')
  await writeFile(join(applications, `${id}.desktop`), desktop)
  for (const size of ICON_SIZES) {
    const dir = join(home, '.local', 'share', 'icons', 'hicolor', `${size}x${size}`, 'apps')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, `${id}.png`), source.resize({ width: size, height: size, quality: 'best' }).toPNG())
  }
}
