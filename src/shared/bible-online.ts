export type OnlineBibleCatalogSource = 'helloao' | 'biblesupersearch'

export type OnlineBibleTranslation = {
  id: string
  name: string
  englishName: string
  shortName: string
  language: string
  languageName?: string | null
  languageEnglishName?: string | null
  licenseUrl: string
  numberOfBooks: number
  catalogSource: OnlineBibleCatalogSource
}

export const BIBLE_SUPERSEARCH_CATALOG_PREFIX = 'bss:'

/** Extra translations not in the Free Use Bible API (helloao has no Afrikaans). */
export const BIBLE_SUPERSEARCH_CATALOG: OnlineBibleTranslation[] = [
  {
    id: `${BIBLE_SUPERSEARCH_CATALOG_PREFIX}afri`,
    name: 'Afrikaans 1953',
    englishName: 'Afrikaans 1953',
    shortName: 'AFR53',
    language: 'afr',
    languageName: 'Afrikaans',
    languageEnglishName: 'Afrikaans',
    licenseUrl: 'https://api.biblesupersearch.com/',
    numberOfBooks: 66,
    catalogSource: 'biblesupersearch'
  }
]

export function bibleSuperSearchModuleId(catalogId: string): string | null {
  if (!catalogId.startsWith(BIBLE_SUPERSEARCH_CATALOG_PREFIX)) return null
  const moduleId = catalogId.slice(BIBLE_SUPERSEARCH_CATALOG_PREFIX.length).trim()
  if (!moduleId || moduleId.includes('..') || /[/\\]/.test(moduleId)) return null
  return moduleId
}

export function bibleSuperSearchDownloadUrl(moduleId: string): string {
  const params = new URLSearchParams({ bible: moduleId, format: 'json' })
  return `https://api.biblesupersearch.com/api/download?${params.toString()}`
}

export const HELLOAO_TRANSLATIONS_URL =
  'https://bible.helloao.org/api/available_translations.json'

export function helloAoDownloadUrl(translationId: string): string {
  return `https://bible.helloao.org/api/${encodeURIComponent(translationId)}/complete.simple.json`
}

export function mergeOnlineTranslationCatalog(
  helloAoItems: Omit<OnlineBibleTranslation, 'catalogSource'>[]
): OnlineBibleTranslation[] {
  const helloAoWithSource = helloAoItems.map((t) => ({
    ...t,
    catalogSource: 'helloao' as const
  }))
  const seen = new Set(helloAoWithSource.map((t) => t.id))
  const extras = BIBLE_SUPERSEARCH_CATALOG.filter((t) => !seen.has(t.id))
  return [...helloAoWithSource, ...extras]
}

export function onlineTranslationLanguageLabel(t: OnlineBibleTranslation): string {
  return (t.languageEnglishName || t.languageName || t.language || 'Unknown').trim()
}

export function groupOnlineTranslationsByLanguage(
  items: OnlineBibleTranslation[]
): { language: string; translations: OnlineBibleTranslation[] }[] {
  const map = new Map<string, OnlineBibleTranslation[]>()
  for (const t of items) {
    const key = onlineTranslationLanguageLabel(t)
    const list = map.get(key) ?? []
    list.push(t)
    map.set(key, list)
  }
  return [...map.entries()]
    .map(([language, translations]) => ({
      language,
      translations: translations.sort((a, b) =>
        a.englishName.localeCompare(b.englishName, undefined, { sensitivity: 'base' })
      )
    }))
    .sort((a, b) => {
      if (a.language === 'English') return -1
      if (b.language === 'English') return 1
      return a.language.localeCompare(b.language, undefined, { sensitivity: 'base' })
    })
}
