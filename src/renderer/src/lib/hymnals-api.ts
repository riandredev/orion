import type { HymnalMeta } from '../../../shared/hymnal-types'

export async function listInstalledHymnals(): Promise<HymnalMeta[]> {
  if (typeof window.orion?.listHymnals !== 'function') return []
  return window.orion.listHymnals()
}

export async function fetchHymnalIndex(hymnalId: string) {
  if (typeof window.orion?.getHymnalIndex !== 'function') return []
  return window.orion.getHymnalIndex(hymnalId)
}

export async function fetchHymnEntry(hymnalId: string, hymnId: string) {
  if (typeof window.orion?.getHymnEntry !== 'function') return null
  return window.orion.getHymnEntry(hymnalId, hymnId)
}

export async function importHymnalFile() {
  if (typeof window.orion?.importHymnal !== 'function') return null
  return window.orion.importHymnal()
}

export async function importHymnalFolder() {
  if (typeof window.orion?.importHymnalFolder !== 'function') return null
  return window.orion.importHymnalFolder()
}

export async function importBibsoftMdb() {
  if (typeof window.orion?.importBibsoftMdb !== 'function') return []
  return window.orion.importBibsoftMdb()
}

export async function ensurePersonalHymnal() {
  if (typeof window.orion?.ensurePersonalHymnal !== 'function') return null
  return window.orion.ensurePersonalHymnal()
}

export async function upsertHymnEntry(
  hymnalId: string,
  input: {
    id?: string
    number: number
    title: string
    stanzas: import('../../../shared/hymnal-types').HymnStanza[]
  }
) {
  if (typeof window.orion?.upsertHymnEntry !== 'function') {
    throw new Error('Save not available')
  }
  return window.orion.upsertHymnEntry(hymnalId, input)
}

export async function deleteHymnEntry(hymnalId: string, hymnId: string) {
  if (typeof window.orion?.deleteHymnEntry !== 'function') return false
  return window.orion.deleteHymnEntry(hymnalId, hymnId)
}
