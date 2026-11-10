export const BIBLE_ANCHORS = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right'
] as const

export type BibleAnchor = (typeof BIBLE_ANCHORS)[number]

export type BibleBlockId = 'reference' | 'translation' | 'verse'

export type BibleBlockMargin = {
  top: number
  right: number
  bottom: number
  left: number
}

export const BIBLE_BLOCK_MARGIN_MAX = 30
export const BLOCK_WIDTH_MIN = 20
export const BLOCK_WIDTH_MAX = 100

export type BibleBlockLayout = Record<BibleBlockId, BibleAnchor> & {
  margin: Record<BibleBlockId, BibleBlockMargin>
  width: Record<BibleBlockId, number>
}

const ZERO_MARGIN: BibleBlockMargin = { top: 0, right: 0, bottom: 0, left: 0 }

export const DEFAULT_BIBLE_BLOCK_LAYOUT: BibleBlockLayout = {
  reference: 'top',
  translation: 'top',
  verse: 'center',
  margin: {
    reference: { ...ZERO_MARGIN },
    translation: { ...ZERO_MARGIN },
    verse: { ...ZERO_MARGIN }
  },
  width: {
    reference: 100,
    translation: 100,
    verse: 100
  }
}

const ANCHOR_SET = new Set<string>(BIBLE_ANCHORS)

export function clampBibleAnchor(value: unknown, fallback: BibleAnchor): BibleAnchor {
  return typeof value === 'string' && ANCHOR_SET.has(value) ? (value as BibleAnchor) : fallback
}

function clampMarginSide(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(BIBLE_BLOCK_MARGIN_MAX, Math.max(0, Math.round(n * 10) / 10))
}

export function clampBlockWidth(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 100
  return Math.min(BLOCK_WIDTH_MAX, Math.max(BLOCK_WIDTH_MIN, Math.round(n)))
}

function clampBlockMargin(raw: unknown): BibleBlockMargin {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    top: clampMarginSide(record.top),
    right: clampMarginSide(record.right),
    bottom: clampMarginSide(record.bottom),
    left: clampMarginSide(record.left)
  }
}

export function clampBibleBlockLayout(raw: unknown): BibleBlockLayout {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const margin =
    record.margin && typeof record.margin === 'object'
      ? (record.margin as Record<string, unknown>)
      : {}
  const width =
    record.width && typeof record.width === 'object' ? (record.width as Record<string, unknown>) : {}
  return {
    reference: clampBibleAnchor(record.reference, DEFAULT_BIBLE_BLOCK_LAYOUT.reference),
    translation: clampBibleAnchor(record.translation, DEFAULT_BIBLE_BLOCK_LAYOUT.translation),
    verse: clampBibleAnchor(record.verse, DEFAULT_BIBLE_BLOCK_LAYOUT.verse),
    margin: {
      reference: clampBlockMargin(margin.reference),
      translation: clampBlockMargin(margin.translation),
      verse: clampBlockMargin(margin.verse)
    },
    width: {
      reference: clampBlockWidth(width.reference),
      translation: clampBlockWidth(width.translation),
      verse: clampBlockWidth(width.verse)
    }
  }
}

export function bibleBlockMarginVars(margin: BibleBlockMargin): {
  '--block-margin-top': string
  '--block-margin-right': string
  '--block-margin-bottom': string
  '--block-margin-left': string
} {
  return {
    '--block-margin-top': `${margin.top}vmin`,
    '--block-margin-right': `${margin.right}vmin`,
    '--block-margin-bottom': `${margin.bottom}vmin`,
    '--block-margin-left': `${margin.left}vmin`
  }
}

export function bibleLayoutIsStacked(layout: BibleBlockLayout): boolean {
  return layout.reference === 'top' && layout.translation === 'top' && layout.verse === 'center'
}

export function bibleAnchorClass(anchor: BibleAnchor): string {
  return `bible-anchor-${anchor}`
}

export function bibleProjPartClasses(layout: BibleBlockLayout): {
  wrap: string
  top: string
  location: string
  translation: string
  body: string
} {
  if (bibleLayoutIsStacked(layout)) {
    return {
      wrap: 'bible-proj',
      top: 'bible-proj__top',
      location: 'bible-proj__location',
      translation: 'bible-proj__translation',
      body: 'bible-proj__body'
    }
  }
  const split = layout.translation !== layout.reference
  return {
    wrap: `bible-proj bible-proj--anchored${split ? ' bible-proj--split-heading' : ''}`,
    top: `bible-proj__top bible-proj__pair ${bibleAnchorClass(layout.reference)}`,
    location: 'bible-proj__location',
    translation: split
      ? `bible-proj__translation ${bibleAnchorClass(layout.translation)}`
      : 'bible-proj__translation',
    body: `bible-proj__body ${bibleAnchorClass(layout.verse)}`
  }
}
