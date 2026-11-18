import type { HymnalMeta } from './hymnal-types'

/** Display names for shipped Adventist books (stable folder ids). Keep `source` as loaded. */
export function normalizeBundledHymnalMeta(meta: HymnalMeta): HymnalMeta {
  if (meta.id === 'adventist-1-afrikaans') {
    return { ...meta, label: 'Afrikaans', abbr: 'Afrikaans', language: 'af' }
  }
  if (meta.id === 'adventist-2-english-new') {
    return { ...meta, label: 'English', abbr: 'English', language: 'en' }
  }
  return meta
}
