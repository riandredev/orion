import type { LibraryFolderSort } from './content-bundles'

/** A saved column order still wins after the user rearranges folders. */
export function compareOrderFolderNames(a: string, b: string, sort: LibraryFolderSort): number {
  const order = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  return sort === 'za' ? -order : order
}
