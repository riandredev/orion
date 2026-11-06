import { app } from 'electron'
import { join } from 'path'
import { is } from './env'

function libraryRoot(): string {
  if (is.dev) return process.cwd()
  return app.getPath('userData')
}

export function orderImagesRoot(): string {
  return join(libraryRoot(), 'order-images')
}

export function mediaRoot(): string {
  return join(libraryRoot(), 'media')
}

export function imagesRoot(): string {
  return join(libraryRoot(), 'images')
}

export function biblesRoot(): string {
  return join(libraryRoot(), 'bibles')
}

/** Built-in hymnals. Dev reads the repo. Installers read the bundled content folder. */
export function hymnalsRoot(): string {
  if (is.dev) return join(process.cwd(), 'hymnals')
  return join(process.resourcesPath, 'content', 'hymnals')
}

/** Imported slide decks (PNG renders) live under user data. */
export function presentationsRoot(): string {
  return join(app.getPath('userData'), 'presentations')
}
