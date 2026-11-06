import { app } from 'electron'
import { existsSync } from 'fs'
import { cp, mkdir, readdir } from 'fs/promises'
import { join } from 'path'
import { is } from './env'

const LIBRARY_DIRS = ['order-images', 'bibles', 'media', 'images'] as const

/** Copy bundled church libraries into user data the first time a packaged app runs. */
export async function seedPackagedLibraries(): Promise<void> {
  if (is.dev) return

  const userData = app.getPath('userData')
  const content = join(process.resourcesPath, 'content')

  for (const name of LIBRARY_DIRS) {
    const dest = join(userData, name)
    await mkdir(dest, { recursive: true })
    const source = join(content, name)
    if (!existsSync(source)) continue
    const existing = await readdir(dest)
    if (existing.length > 0) continue
    await cp(source, dest, { recursive: true })
  }

  await mkdir(join(userData, 'hymnals'), { recursive: true })
}
