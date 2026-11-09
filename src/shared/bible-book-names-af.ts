/** Display names for Afrikaans Bible (1933/1953 / 1983-style orthography). */
export const AFRIKAANS_BOOK_NAMES: Record<string, string> = {
  gen: 'Genesis',
  exo: 'Eksodus',
  lev: 'Levitikus',
  num: 'Numeri',
  deu: 'Deuteronomium',
  jos: 'Josua',
  jdg: 'Rigters',
  rut: 'Rut',
  '1sa': '1 Samuel',
  '2sa': '2 Samuel',
  '1ki': '1 Konings',
  '2ki': '2 Konings',
  '1ch': '1 Kronieke',
  '2ch': '2 Kronieke',
  ezr: 'Esra',
  neh: 'Nehemia',
  est: 'Ester',
  job: 'Job',
  psa: 'Psalms',
  pro: 'Spreuke',
  ecc: 'Prediker',
  sng: 'Hooglied',
  isa: 'Jesaja',
  jer: 'Jeremia',
  lam: 'Klaagliedere',
  ezk: 'Esegiël',
  dan: 'Daniël',
  hos: 'Hosea',
  jol: 'Joel',
  amo: 'Amos',
  oba: 'Obadja',
  jon: 'Jona',
  mic: 'Miga',
  nam: 'Nahum',
  hab: 'Habakuk',
  zep: 'Sefanja',
  hag: 'Haggai',
  zec: 'Sagaria',
  mal: 'Maleagi',
  mat: 'Matteus',
  mrk: 'Markus',
  luk: 'Lukas',
  jhn: 'Johannes',
  act: 'Handelinge',
  rom: 'Romeine',
  '1co': '1 Korintiërs',
  '2co': '2 Korintiërs',
  gal: 'Galasiërs',
  eph: 'Efesiërs',
  php: 'Filippense',
  col: 'Kolossense',
  '1th': '1 Tessalonisense',
  '2th': '2 Tessalonisense',
  '1ti': '1 Timoteus',
  '2ti': '2 Timoteus',
  tit: 'Titus',
  phm: 'Filemon',
  heb: 'Hebreërs',
  jas: 'Jakobus',
  '1pe': '1 Petrus',
  '2pe': '2 Petrus',
  '1jn': '1 Johannes',
  '2jn': '2 Johannes',
  '3jn': '3 Johannes',
  jud: 'Judas',
  rev: 'Openbaring'
}

export function isAfrikaansBibleTranslation(meta: {
  label?: string
  abbr?: string
  catalogSourceId?: string | null
} | null | undefined): boolean {
  if (!meta) return false
  if (meta.catalogSourceId === 'bss:afri' || meta.catalogSourceId === 'afri') return true
  const label = meta.label?.toLowerCase() ?? ''
  const abbr = meta.abbr?.toLowerCase() ?? ''
  return label.includes('afrikaans') || abbr.includes('afr') || abbr === 'afrikaans'
}
