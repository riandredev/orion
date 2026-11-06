/** Normalized Bible module stored under each `bibles/{id}/module.json`. */
export type OrionBibleModule = {
  label: string
  abbr: string
  books: Record<string, Record<string, Record<string, string>>>
}

export type InstalledBibleInfo = {
  id: string
  label: string
  abbr: string
  format: BibleSourceFormat
  sourceName: string
  importedAt: string
  /** helloao.org translation id when installed from online catalog */
  catalogSourceId?: string | null
}

export type BibleSourceFormat = 'orion-json' | 'usfm' | 'zefania-xml'

export type BibleVerseDto = {
  number: number
  text: string
}

export type BibleChapterDto = {
  verses: BibleVerseDto[]
}
