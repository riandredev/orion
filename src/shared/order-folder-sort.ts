import type { AppEditionId } from './app-update'

/** Panorama starts at Z–A. A saved column order still wins after the user rearranges folders. */
export function compareOrderFolderNames(a: string, b: string, edition: AppEditionId): number {
  const order = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  return edition === 'panorama' ? -order : order
}
