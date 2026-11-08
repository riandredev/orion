export const HYMN_TYPOGRAPHY_ELEMENTS = [
  { id: 'number', label: 'Hymn number' },
  { id: 'lyrics', label: 'Lyrics' },
  { id: 'corner', label: 'Verse number' },
  { id: 'author', label: 'Author' }
] as const

export type HymnTypographyElementId = (typeof HYMN_TYPOGRAPHY_ELEMENTS)[number]['id']

export const PROJECTION_FONTS = [
  { id: 'arial-narrow', label: 'Arial Narrow', family: '"Liberation Sans Narrow", "Arial Narrow", Arial, sans-serif' },
  { id: 'palatino', label: 'Palatino', family: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif' },
  { id: 'garamond', label: 'EB Garamond', family: '"EB Garamond", Georgia, "Times New Roman", serif' },
  { id: 'arial', label: 'Arial', family: 'Arial, "Liberation Sans", sans-serif' },
  { id: 'calibri', label: 'Calibri', family: 'Calibri, Candara, sans-serif' },
  { id: 'cambria', label: 'Cambria', family: 'Cambria, Georgia, serif' },
  { id: 'cantarell', label: 'Cantarell', family: 'Cantarell, "Segoe UI", sans-serif' },
  { id: 'georgia', label: 'Georgia', family: 'Georgia, Cambria, serif' },
  { id: 'segoe', label: 'Segoe UI', family: '"Segoe UI", Cantarell, sans-serif' },
  { id: 'tahoma', label: 'Tahoma', family: 'Tahoma, Verdana, sans-serif' },
  { id: 'times', label: 'Times New Roman', family: '"Times New Roman", Times, serif' },
  { id: 'verdana', label: 'Verdana', family: 'Verdana, Tahoma, sans-serif' }
] as const

export type ProjectionFontId = (typeof PROJECTION_FONTS)[number]['id']

export const PROJECTION_FONT_WEIGHTS = [
  { value: 300, label: 'Light' },
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'Semibold' },
  { value: 700, label: 'Bold' },
  { value: 800, label: 'Extra bold' }
] as const

export type ProjectionFontWeight = (typeof PROJECTION_FONT_WEIGHTS)[number]['value']

export type ProjectionTextStyle = {
  fontId: ProjectionFontId
  sizePx: number
  fontWeight: ProjectionFontWeight
  color: string
}

export type HymnTextStyle = ProjectionTextStyle

export type HymnTypography = Record<HymnTypographyElementId, HymnTextStyle>

export const HYMN_FONT_SIZE_MIN = 24
export const HYMN_FONT_SIZE_MAX = 160

export const DEFAULT_HYMN_TYPOGRAPHY: HymnTypography = {
  number: { fontId: 'arial-narrow', sizePx: 72, fontWeight: 700, color: '#ffffff' },
  lyrics: { fontId: 'arial-narrow', sizePx: 84, fontWeight: 700, color: '#ffffff' },
  corner: { fontId: 'arial-narrow', sizePx: 60, fontWeight: 700, color: '#ffd400' },
  author: { fontId: 'arial-narrow', sizePx: 28, fontWeight: 700, color: '#ffd400' }
}

const ELEMENT_IDS: HymnTypographyElementId[] = HYMN_TYPOGRAPHY_ELEMENTS.map((item) => item.id)

const SIZE_VAR: Record<HymnTypographyElementId, string> = {
  number: '--hymn-number-size',
  lyrics: '--hymn-lyrics-size',
  corner: '--hymn-corner-size',
  author: '--hymn-author-size'
}

const FONT_VAR: Record<HymnTypographyElementId, string> = {
  number: '--hymn-number-font',
  lyrics: '--hymn-lyrics-font',
  corner: '--hymn-corner-font',
  author: '--hymn-author-font'
}

const HYMN_COLOR_VAR: Record<HymnTypographyElementId, string> = {
  number: '--hymn-number-color',
  lyrics: '--hymn-lyrics-color',
  corner: '--hymn-corner-color',
  author: '--hymn-author-color'
}

const HYMN_WEIGHT_VAR: Record<HymnTypographyElementId, string> = {
  number: '--hymn-number-weight',
  lyrics: '--hymn-lyrics-weight',
  corner: '--hymn-corner-weight',
  author: '--hymn-author-weight'
}

export function projectionFontById(id: string): (typeof PROJECTION_FONTS)[number] {
  return PROJECTION_FONTS.find((font) => font.id === id) ?? PROJECTION_FONTS[0]
}

function isElementId(value: string): value is HymnTypographyElementId {
  return ELEMENT_IDS.includes(value as HymnTypographyElementId)
}

function clampSize(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.min(HYMN_FONT_SIZE_MAX, Math.max(HYMN_FONT_SIZE_MIN, n))
}

export function clampHymnTypography(raw: unknown): HymnTypography {
  const next: HymnTypography = {
    number: { ...DEFAULT_HYMN_TYPOGRAPHY.number },
    lyrics: { ...DEFAULT_HYMN_TYPOGRAPHY.lyrics },
    corner: { ...DEFAULT_HYMN_TYPOGRAPHY.corner },
    author: { ...DEFAULT_HYMN_TYPOGRAPHY.author }
  }
  if (!raw || typeof raw !== 'object') return next
  const record = raw as Record<string, unknown>
  for (const id of ELEMENT_IDS) {
    const item = record[id]
    if (!item || typeof item !== 'object') continue
    next[id] = clampStyle(item as Record<string, unknown>, next[id])
  }
  return next
}

export function hymnTypographyCssVars(value: HymnTypography): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const id of ELEMENT_IDS) {
    vars[SIZE_VAR[id]] = `${value[id].sizePx}px`
    vars[FONT_VAR[id]] = projectionFontById(value[id].fontId).family
    vars[HYMN_WEIGHT_VAR[id]] = String(value[id].fontWeight)
    vars[HYMN_COLOR_VAR[id]] = value[id].color
  }
  return vars
}

export function hymnTypographyElementId(value: string): HymnTypographyElementId | null {
  return isElementId(value) ? value : null
}

export const BIBLE_TYPOGRAPHY_ELEMENTS = [
  { id: 'reference', label: 'Reference' },
  { id: 'translation', label: 'Translation' },
  { id: 'verseNumber', label: 'Verse number' },
  { id: 'verse', label: 'Verse text' }
] as const

export type BibleTypographyElementId = (typeof BIBLE_TYPOGRAPHY_ELEMENTS)[number]['id']
export type BibleTypography = Record<BibleTypographyElementId, ProjectionTextStyle>

export const DEFAULT_BIBLE_TYPOGRAPHY: BibleTypography = {
  reference: { fontId: 'palatino', sizePx: 52, fontWeight: 700, color: '#fff9a7' },
  translation: { fontId: 'palatino', sizePx: 28, fontWeight: 600, color: '#d1d1d1' },
  verseNumber: { fontId: 'palatino', sizePx: 64, fontWeight: 700, color: '#f2f2f2' },
  verse: { fontId: 'palatino', sizePx: 64, fontWeight: 500, color: '#ffffff' }
}

export const BIBLE_PANEL_OPACITY_MIN = 15
export const BIBLE_PANEL_OPACITY_MAX = 90

export type BiblePanelId = 'reference' | 'verse'

export type BibleTextAlign = 'left' | 'center' | 'right'

export const DEFAULT_PANEL_COLOR = '#0f1b2e'

export type BibleTextPanel = {
  enabled: boolean
  opacity: number
  color: string
  align: BibleTextAlign
}

export type BiblePanels = Record<BiblePanelId, BibleTextPanel>

export const DEFAULT_BIBLE_PANELS: BiblePanels = {
  reference: { enabled: true, opacity: 66, color: DEFAULT_PANEL_COLOR, align: 'center' },
  verse: { enabled: true, opacity: 66, color: DEFAULT_PANEL_COLOR, align: 'center' }
}

export type HymnPanelId = HymnTypographyElementId
export type DictionaryPanelId = DictionaryTypographyElementId

function textPanel(align: BibleTextAlign, enabled = false): BibleTextPanel {
  return { enabled, opacity: 66, color: DEFAULT_PANEL_COLOR, align }
}

export const DEFAULT_HYMN_PANELS: Record<HymnPanelId, BibleTextPanel> = {
  number: textPanel('center'),
  lyrics: textPanel('center'),
  corner: textPanel('left'),
  author: textPanel('center')
}

export const DEFAULT_DICTIONARY_PANELS: Record<DictionaryPanelId, BibleTextPanel> = {
  strongs: textPanel('center'),
  lemma: textPanel('center'),
  details: textPanel('center'),
  definition: textPanel('left')
}

export function biblePanelCssColor(panel: BibleTextPanel): string {
  if (!panel.enabled) return 'transparent'
  const hex = /^#[0-9a-fA-F]{6}$/.test(panel.color) ? panel.color : DEFAULT_PANEL_COLOR
  const n = Number.parseInt(hex.slice(1), 16)
  const alpha = Math.min(BIBLE_PANEL_OPACITY_MAX, Math.max(0, panel.opacity)) / 100
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const DICTIONARY_TYPOGRAPHY_ELEMENTS = [
  { id: 'strongs', label: "Strong's number" },
  { id: 'lemma', label: 'Original word' },
  { id: 'details', label: 'Details' },
  { id: 'definition', label: 'Definition' }
] as const

export type DictionaryTypographyElementId = (typeof DICTIONARY_TYPOGRAPHY_ELEMENTS)[number]['id']
export type DictionaryTypography = Record<DictionaryTypographyElementId, ProjectionTextStyle>

export const DEFAULT_DICTIONARY_TYPOGRAPHY: DictionaryTypography = {
  strongs: { fontId: 'cantarell', sizePx: 36, fontWeight: 700, color: '#ebebeb' },
  lemma: { fontId: 'cantarell', sizePx: 96, fontWeight: 700, color: '#ffffff' },
  details: { fontId: 'segoe', sizePx: 28, fontWeight: 600, color: '#b8b8b8' },
  definition: { fontId: 'segoe', sizePx: 36, fontWeight: 400, color: '#fff9a7' }
}

export const LINE_HEIGHT_MIN = 1
export const LINE_HEIGHT_MAX = 2

export const TEXT_SHADOW_OFFSET_MIN = -2
export const TEXT_SHADOW_OFFSET_MAX = 2
export const TEXT_SHADOW_BLUR_MIN = 0
export const TEXT_SHADOW_BLUR_MAX = 2
export const TEXT_SHADOW_SIZE_MIN = 0
export const TEXT_SHADOW_SIZE_MAX = 200
export const TEXT_SHADOW_OPACITY_MIN = 0
export const TEXT_SHADOW_OPACITY_MAX = 100

export type TextShadowStyle = {
  x: number
  y: number
  blur: number
  size: number
  opacity: number
}

export type ProjectionTextShadow = {
  hymns: TextShadowStyle
  bible: TextShadowStyle
  dictionary: TextShadowStyle
}

/** Matches the previous hymn and Bible slide shadow. Dictionary starts off. */
export const DEFAULT_TEXT_SHADOW_STYLE: TextShadowStyle = {
  x: 0,
  y: 0.08,
  blur: 0.28,
  size: 100,
  opacity: 88
}

export const DEFAULT_TEXT_SHADOW: ProjectionTextShadow = {
  hymns: { ...DEFAULT_TEXT_SHADOW_STYLE },
  bible: { ...DEFAULT_TEXT_SHADOW_STYLE },
  dictionary: { ...DEFAULT_TEXT_SHADOW_STYLE, opacity: 0 }
}

export function projectionTextShadowCss(shadow: TextShadowStyle): string {
  if (shadow.opacity <= 0 || shadow.size <= 0) return 'none'
  const n = (value: number): string => {
    const text = value.toFixed(2)
    return text.replace(/0+$/, '').replace(/\.$/, '')
  }
  const scale = Math.min(TEXT_SHADOW_SIZE_MAX, Math.max(0, shadow.size)) / 100
  const alpha = Math.min(TEXT_SHADOW_OPACITY_MAX, Math.max(0, shadow.opacity)) / 100
  return `${n(shadow.x * scale)}em ${n(shadow.y * scale)}em ${n(shadow.blur * scale)}em rgba(0,0,0,${n(alpha)})`
}

export type ProjectionLineHeight = {
  hymns: number
  bible: number
  dictionary: number
}

/** Body leading for lyric lines, verse text, and definitions. */
export const DEFAULT_LINE_HEIGHT: ProjectionLineHeight = {
  hymns: 1.32,
  bible: 1.55,
  dictionary: 1.5
}

export type ProjectionTypography = {
  hymns: HymnTypography
  bible: BibleTypography
  dictionary: DictionaryTypography
  lineHeight: ProjectionLineHeight
  textShadow: ProjectionTextShadow
  biblePanels: BiblePanels
  hymnPanels: Record<HymnPanelId, BibleTextPanel>
  dictionaryPanels: Record<DictionaryPanelId, BibleTextPanel>
}

export const DEFAULT_PROJECTION_TYPOGRAPHY: ProjectionTypography = {
  hymns: DEFAULT_HYMN_TYPOGRAPHY,
  bible: DEFAULT_BIBLE_TYPOGRAPHY,
  dictionary: DEFAULT_DICTIONARY_TYPOGRAPHY,
  lineHeight: DEFAULT_LINE_HEIGHT,
  textShadow: DEFAULT_TEXT_SHADOW,
  biblePanels: DEFAULT_BIBLE_PANELS,
  hymnPanels: DEFAULT_HYMN_PANELS,
  dictionaryPanels: DEFAULT_DICTIONARY_PANELS
}

const BIBLE_SIZE_VAR: Record<BibleTypographyElementId, string> = {
  reference: '--bible-reference-size',
  translation: '--bible-translation-size',
  verseNumber: '--bible-verse-num-size',
  verse: '--bible-verse-size'
}
const BIBLE_FONT_VAR: Record<BibleTypographyElementId, string> = {
  reference: '--bible-reference-font',
  translation: '--bible-translation-font',
  verseNumber: '--bible-verse-num-font',
  verse: '--bible-verse-font'
}
const BIBLE_COLOR_VAR: Record<BibleTypographyElementId, string> = {
  reference: '--bible-reference-color',
  translation: '--bible-translation-color',
  verseNumber: '--bible-verse-num-color',
  verse: '--bible-verse-color'
}
const BIBLE_WEIGHT_VAR: Record<BibleTypographyElementId, string> = {
  reference: '--bible-reference-weight',
  translation: '--bible-translation-weight',
  verseNumber: '--bible-verse-num-weight',
  verse: '--bible-verse-weight'
}
const DICTIONARY_SIZE_VAR: Record<DictionaryTypographyElementId, string> = {
  strongs: '--dictionary-strongs-size',
  lemma: '--dictionary-lemma-size',
  details: '--dictionary-details-size',
  definition: '--dictionary-definition-size'
}
const DICTIONARY_FONT_VAR: Record<DictionaryTypographyElementId, string> = {
  strongs: '--dictionary-strongs-font',
  lemma: '--dictionary-lemma-font',
  details: '--dictionary-details-font',
  definition: '--dictionary-definition-font'
}
const DICTIONARY_COLOR_VAR: Record<DictionaryTypographyElementId, string> = {
  strongs: '--dictionary-strongs-color',
  lemma: '--dictionary-lemma-color',
  details: '--dictionary-details-color',
  definition: '--dictionary-definition-color'
}
const DICTIONARY_WEIGHT_VAR: Record<DictionaryTypographyElementId, string> = {
  strongs: '--dictionary-strongs-weight',
  lemma: '--dictionary-lemma-weight',
  details: '--dictionary-details-weight',
  definition: '--dictionary-definition-weight'
}

function clampLineHeight(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : fallback
  return Math.min(LINE_HEIGHT_MAX, Math.max(LINE_HEIGHT_MIN, n))
}

export function clampProjectionLineHeight(raw: unknown): ProjectionLineHeight {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    hymns: clampLineHeight(record.hymns, DEFAULT_LINE_HEIGHT.hymns),
    bible: clampLineHeight(record.bible, DEFAULT_LINE_HEIGHT.bible),
    dictionary: clampLineHeight(record.dictionary, DEFAULT_LINE_HEIGHT.dictionary)
  }
}

function clampShadowNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : fallback
  return Math.min(max, Math.max(min, n))
}

/** Older profiles stored one 0–100 strength. 100 was the default hymn and Bible shadow. */
function textShadowFromLegacyStrength(strength: number): TextShadowStyle {
  const t = Math.min(100, Math.max(0, strength)) / 100
  return {
    x: 0,
    y: Math.round(DEFAULT_TEXT_SHADOW_STYLE.y * t * 100) / 100,
    blur: Math.round(DEFAULT_TEXT_SHADOW_STYLE.blur * t * 100) / 100,
    size: 100,
    opacity: Math.round(DEFAULT_TEXT_SHADOW_STYLE.opacity * t)
  }
}

function clampTextShadowStyle(value: unknown, fallback: TextShadowStyle): TextShadowStyle {
  if (typeof value === 'number' && Number.isFinite(value)) return textShadowFromLegacyStrength(value)
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const sizeWasOpacity = record.opacity === undefined && typeof record.size === 'number'
  return {
    x: clampShadowNumber(record.x, fallback.x, TEXT_SHADOW_OFFSET_MIN, TEXT_SHADOW_OFFSET_MAX),
    y: clampShadowNumber(record.y, fallback.y, TEXT_SHADOW_OFFSET_MIN, TEXT_SHADOW_OFFSET_MAX),
    blur: clampShadowNumber(record.blur, fallback.blur, TEXT_SHADOW_BLUR_MIN, TEXT_SHADOW_BLUR_MAX),
    size: sizeWasOpacity
      ? 100
      : Math.round(clampShadowNumber(record.size, fallback.size, TEXT_SHADOW_SIZE_MIN, TEXT_SHADOW_SIZE_MAX)),
    opacity: Math.round(
      clampShadowNumber(
        sizeWasOpacity ? record.size : record.opacity,
        fallback.opacity,
        TEXT_SHADOW_OPACITY_MIN,
        TEXT_SHADOW_OPACITY_MAX
      )
    )
  }
}

export function clampProjectionTextShadow(raw: unknown): ProjectionTextShadow {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    hymns: clampTextShadowStyle(record.hymns, DEFAULT_TEXT_SHADOW.hymns),
    bible: clampTextShadowStyle(record.bible, DEFAULT_TEXT_SHADOW.bible),
    dictionary: clampTextShadowStyle(record.dictionary, DEFAULT_TEXT_SHADOW.dictionary)
  }
}

const PREVIOUS_BIBLE_DEFAULTS: BibleTypography = {
  reference: { fontId: 'garamond', sizePx: 52, fontWeight: 700, color: '#fff9a7' },
  translation: { fontId: 'garamond', sizePx: 28, fontWeight: 600, color: '#d1d1d1' },
  verseNumber: { fontId: 'garamond', sizePx: 64, fontWeight: 700, color: '#f2f2f2' },
  verse: { fontId: 'garamond', sizePx: 64, fontWeight: 500, color: '#ffffff' }
}

const PREVIOUS_DICTIONARY_DEFAULTS: Pick<DictionaryTypography, 'strongs' | 'lemma'> = {
  strongs: { fontId: 'segoe', sizePx: 36, fontWeight: 700, color: '#ebebeb' },
  lemma: { fontId: 'times', sizePx: 96, fontWeight: 700, color: '#ffffff' }
}

function migrateDefaultDictionaryFonts(value: DictionaryTypography): DictionaryTypography {
  const next = { ...value }
  for (const id of ['strongs', 'lemma'] as const) {
    const previous = PREVIOUS_DICTIONARY_DEFAULTS[id]
    if (value[id].fontId === previous.fontId && value[id].sizePx === previous.sizePx) {
      next[id] = { ...DEFAULT_DICTIONARY_TYPOGRAPHY[id] }
    }
  }
  return next
}

function migrateDefaultBibleFonts(value: BibleTypography): BibleTypography {
  const untouched = BIBLE_TYPOGRAPHY_ELEMENTS.every(
    (item) =>
      value[item.id].fontId === PREVIOUS_BIBLE_DEFAULTS[item.id].fontId &&
      value[item.id].sizePx === PREVIOUS_BIBLE_DEFAULTS[item.id].sizePx
  )
  if (!untouched) return value
  const next = { ...value }
  for (const item of BIBLE_TYPOGRAPHY_ELEMENTS) {
    next[item.id] = { ...DEFAULT_BIBLE_TYPOGRAPHY[item.id] }
  }
  return next
}

function clampBiblePanel(raw: unknown, fallback: BibleTextPanel): BibleTextPanel {
  if (!raw || typeof raw !== 'object') return { ...fallback }
  const panel = raw as Record<string, unknown>
  const opacity =
    typeof panel.opacity === 'number' && Number.isFinite(panel.opacity)
      ? Math.min(BIBLE_PANEL_OPACITY_MAX, Math.max(BIBLE_PANEL_OPACITY_MIN, Math.round(panel.opacity)))
      : fallback.opacity
  const align: BibleTextAlign =
    panel.align === 'left' || panel.align === 'right' || panel.align === 'center' ? panel.align : fallback.align
  return {
    enabled: typeof panel.enabled === 'boolean' ? panel.enabled : fallback.enabled,
    opacity,
    color: clampColor(panel.color, fallback.color),
    align
  }
}

export function clampBiblePanels(raw: unknown): BiblePanels {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    reference: clampBiblePanel(record.reference, DEFAULT_BIBLE_PANELS.reference),
    verse: clampBiblePanel(record.verse, DEFAULT_BIBLE_PANELS.verse)
  }
}

function clampColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback
}

function clampFontWeight(value: unknown, fallback: ProjectionFontWeight): ProjectionFontWeight {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return PROJECTION_FONT_WEIGHTS.some((item) => item.value === n) ? (n as ProjectionFontWeight) : fallback
}

function clampStyle(raw: unknown, fallback: ProjectionTextStyle): ProjectionTextStyle {
  if (!raw || typeof raw !== 'object') return { ...fallback }
  const style = raw as Record<string, unknown>
  const fontId = typeof style.fontId === 'string' ? style.fontId : fallback.fontId
  return {
    fontId: projectionFontById(fontId).id,
    sizePx: clampSize(style.sizePx, fallback.sizePx),
    fontWeight: clampFontWeight(style.fontWeight, fallback.fontWeight),
    color: clampColor(style.color, fallback.color)
  }
}

function alignJustify(align: BibleTextAlign): string {
  if (align === 'left') return 'flex-start'
  if (align === 'right') return 'flex-end'
  return 'center'
}

function writePanelVars(vars: Record<string, string>, prefix: string, panel: BibleTextPanel): void {
  vars[`${prefix}-panel`] = biblePanelCssColor(panel)
  vars[`${prefix}-align`] = panel.align
  vars[`${prefix}-justify`] = alignJustify(panel.align)
}

function clampRecord<T extends string>(
  raw: unknown,
  defaults: Record<T, ProjectionTextStyle>,
  ids: readonly T[]
): Record<T, ProjectionTextStyle> {
  const next = { ...defaults }
  for (const id of ids) next[id] = { ...defaults[id] }
  if (!raw || typeof raw !== 'object') return next
  const record = raw as Record<string, unknown>
  for (const id of ids) next[id] = clampStyle(record[id], defaults[id])
  return next
}

export function clampProjectionTypography(raw: unknown): ProjectionTypography {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const hymnsSource = record.hymns ?? (record.lyrics || record.number ? raw : undefined)
  return {
    hymns: clampHymnTypography(hymnsSource),
    bible: migrateDefaultBibleFonts(
      clampRecord(record.bible, DEFAULT_BIBLE_TYPOGRAPHY, BIBLE_TYPOGRAPHY_ELEMENTS.map((item) => item.id))
    ),
    dictionary: migrateDefaultDictionaryFonts(
      clampRecord(
        record.dictionary,
        DEFAULT_DICTIONARY_TYPOGRAPHY,
        DICTIONARY_TYPOGRAPHY_ELEMENTS.map((item) => item.id)
      )
    ),
    lineHeight: clampProjectionLineHeight(record.lineHeight),
    textShadow: clampProjectionTextShadow(record.textShadow),
    biblePanels: clampBiblePanels(record.biblePanels),
    hymnPanels: clampPanelRecord(record.hymnPanels, DEFAULT_HYMN_PANELS, ELEMENT_IDS),
    dictionaryPanels: clampPanelRecord(
      record.dictionaryPanels,
      DEFAULT_DICTIONARY_PANELS,
      DICTIONARY_TYPOGRAPHY_ELEMENTS.map((item) => item.id)
    )
  }
}

function clampPanelRecord<T extends string>(
  raw: unknown,
  defaults: Record<T, BibleTextPanel>,
  ids: readonly T[]
): Record<T, BibleTextPanel> {
  const next = { ...defaults }
  for (const id of ids) next[id] = { ...defaults[id] }
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  for (const id of ids) next[id] = clampBiblePanel(record[id], defaults[id])
  return next
}

export function projectionTypographyCssVars(value: ProjectionTypography): Record<string, string> {
  const vars = hymnTypographyCssVars(value.hymns)
  for (const item of BIBLE_TYPOGRAPHY_ELEMENTS) {
    vars[BIBLE_SIZE_VAR[item.id]] = `${value.bible[item.id].sizePx}px`
    vars[BIBLE_FONT_VAR[item.id]] = projectionFontById(value.bible[item.id].fontId).family
    vars[BIBLE_WEIGHT_VAR[item.id]] = String(value.bible[item.id].fontWeight)
    vars[BIBLE_COLOR_VAR[item.id]] = value.bible[item.id].color
  }
  for (const item of DICTIONARY_TYPOGRAPHY_ELEMENTS) {
    vars[DICTIONARY_SIZE_VAR[item.id]] = `${value.dictionary[item.id].sizePx}px`
    vars[DICTIONARY_FONT_VAR[item.id]] = projectionFontById(value.dictionary[item.id].fontId).family
    vars[DICTIONARY_WEIGHT_VAR[item.id]] = String(value.dictionary[item.id].fontWeight)
    vars[DICTIONARY_COLOR_VAR[item.id]] = value.dictionary[item.id].color
  }
  vars['--hymn-line-height'] = String(value.lineHeight.hymns)
  vars['--bible-line-height'] = String(value.lineHeight.bible)
  vars['--dictionary-line-height'] = String(value.lineHeight.dictionary)
  vars['--hymn-shadow'] = projectionTextShadowCss(value.textShadow.hymns)
  vars['--bible-shadow'] = projectionTextShadowCss(value.textShadow.bible)
  vars['--dictionary-shadow'] = projectionTextShadowCss(value.textShadow.dictionary)
  writePanelVars(vars, '--bible-reference', value.biblePanels.reference)
  writePanelVars(vars, '--bible-verse', value.biblePanels.verse)
  writePanelVars(vars, '--hymn-number', value.hymnPanels.number)
  writePanelVars(vars, '--hymn-lyrics', value.hymnPanels.lyrics)
  writePanelVars(vars, '--hymn-corner', value.hymnPanels.corner)
  writePanelVars(vars, '--hymn-author', value.hymnPanels.author)
  writePanelVars(vars, '--dictionary-strongs', value.dictionaryPanels.strongs)
  writePanelVars(vars, '--dictionary-lemma', value.dictionaryPanels.lemma)
  writePanelVars(vars, '--dictionary-details', value.dictionaryPanels.details)
  writePanelVars(vars, '--dictionary-definition', value.dictionaryPanels.definition)
  const corner = value.hymnPanels.corner.align
  vars['--hymn-corner-left'] = corner === 'center' ? '50%' : corner === 'right' ? 'auto' : '0'
  vars['--hymn-corner-right'] = corner === 'right' ? '0' : 'auto'
  vars['--hymn-corner-shift'] = corner === 'center' ? 'translateX(-50%)' : 'none'
  return vars
}

export function bibleTypographyElementId(value: string): BibleTypographyElementId | null {
  return BIBLE_TYPOGRAPHY_ELEMENTS.some((item) => item.id === value) ? (value as BibleTypographyElementId) : null
}
