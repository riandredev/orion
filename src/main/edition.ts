import { readFileSync } from 'fs'
import { join } from 'path'
import { is } from './env'

export type OrionEdition = {
  id: 'standard' | 'panorama'
  name: string
  appUserModelId: string
}

const STANDARD: OrionEdition = {
  id: 'standard',
  name: 'Orion',
  appUserModelId: 'com.orion.presenter'
}

const PANORAMA: OrionEdition = {
  id: 'panorama',
  name: 'Orion Panorama',
  appUserModelId: 'com.orion.presenter.panorama'
}

export function readEdition(): OrionEdition {
  if (is.dev) return STANDARD
  try {
    const raw = readFileSync(join(process.resourcesPath, 'edition.json'), 'utf8')
    const parsed = JSON.parse(raw) as { id?: string }
    if (parsed.id === 'panorama') return PANORAMA
  } catch {
    /* packaged builds without an edition file stay the standard app */
  }
  return STANDARD
}
