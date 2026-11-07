import { nativeImage, type NativeImage } from 'electron'
import { join } from 'path'
import { is } from './env'

/** Square logomark used for the window, taskbar, and installer. */
export function appIcon(): NativeImage {
  const path = is.dev
    ? join(process.cwd(), 'build', 'icon.png')
    : join(process.resourcesPath, 'icon.png')
  return nativeImage.createFromPath(path)
}
