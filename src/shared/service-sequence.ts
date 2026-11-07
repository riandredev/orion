export type ServiceSequenceHymnStep = {
  kind: 'title' | 'lyrics' | 'end'
  stanzaIndex: number
  lines: string[]
  stanzaKind: string
  verse?: number
  versePart?: number
  versePartCount?: number
  label: string
}

export type ServiceSequenceOrderImage = {
  id: string
  kind: 'order-image'
  folder: string
  path: string
  name: string
}

export type ServiceSequenceHymn = {
  id: string
  kind: 'hymn'
  hymnalId: string
  hymnId: string
  number: number
  title: string
  disabledVerseNumbers: number[]
  includeRefrain: boolean
  includeTitle?: boolean
  includeEnd?: boolean
  steps: ServiceSequenceHymnStep[]
}

export type ServiceSequenceBible = {
  id: string
  kind: 'bible'
  bookId: string
  chapter: number
  verse: number
  text: string
  reference: string
  locationLabel: string
  translationLabel: string
}

export type ServiceSequencePresentation = {
  id: string
  kind: 'presentation'
  deckId: string
  title: string
  slideCount: number
}

export type ServiceSequenceMedia = {
  id: string
  kind: 'media'
  folder: string
  path: string
  name: string
  mediaKind: 'video' | 'audio'
}

export type ServiceSequenceWeb = {
  id: string
  kind: 'web'
  url: string
  title: string
}

export type ServiceSequenceDictionary = {
  id: string
  kind: 'dictionary'
  strongs: string
  lemma: string
  transliteration: string | null
  gloss: string | null
  partOfSpeech: string | null
  definition: string
  language: 'hebrew' | 'aramaic' | 'greek'
  infoBar: string[]
  infoBarActive: number
}

export type ServiceSequenceItem =
  | ServiceSequenceOrderImage
  | ServiceSequenceHymn
  | ServiceSequenceBible
  | ServiceSequencePresentation
  | ServiceSequenceDictionary
  | ServiceSequenceMedia
  | ServiceSequenceWeb

export type ServiceSequenceDraft = {
  [K in ServiceSequenceItem['kind']]: Omit<Extract<ServiceSequenceItem, { kind: K }>, 'id'>
}[ServiceSequenceItem['kind']]

export type ServiceSequenceFile = {
  version: 1
  items: ServiceSequenceItem[]
}

export type SequenceCursor = {
  itemIndex: number
  stepIndex: number
}

export function sequenceStepCount(item: ServiceSequenceItem): number {
  if (item.kind === 'hymn') return Math.max(1, item.steps.length)
  if (item.kind === 'presentation') return Math.max(1, item.slideCount)
  return 1
}

export function sequenceItemTitle(item: ServiceSequenceItem): string {
  if (item.kind === 'order-image') return item.name
  if (item.kind === 'hymn') return `${item.number} ${item.title}`.trim()
  if (item.kind === 'bible') return item.reference
  if (item.kind === 'presentation') return item.title
  if (item.kind === 'media') return item.name
  if (item.kind === 'web') return item.title || item.url
  return item.lemma || item.strongs
}

export function sequenceItemKindLabel(item: ServiceSequenceItem): string {
  if (item.kind === 'order-image') return 'Order'
  if (item.kind === 'hymn') return 'Hymn'
  if (item.kind === 'bible') return 'Bible'
  if (item.kind === 'presentation') return 'Presentation'
  if (item.kind === 'media') return item.mediaKind === 'audio' ? 'Audio' : 'Video'
  if (item.kind === 'web') return 'Web'
  return 'Dictionary'
}

export function sequenceItemSubtitle(item: ServiceSequenceItem, stepIndex: number | null): string {
  const step = stepIndex == null ? 0 : stepIndex
  if (item.kind === 'order-image') return item.folder
  if (item.kind === 'hymn') {
    const count = sequenceStepCount(item)
    const label = item.steps[step]?.label
    return label ? `${label} · ${step + 1}/${count}` : `${count} slides`
  }
  if (item.kind === 'bible') {
    const text = item.text.trim()
    return text.length > 72 ? `${text.slice(0, 72)}…` : text
  }
  if (item.kind === 'presentation') {
    const count = sequenceStepCount(item)
    return `Slide ${Math.min(step, count - 1) + 1} of ${count}`
  }
  if (item.kind === 'media') return item.folder
  if (item.kind === 'web') {
    try {
      return new URL(item.url).hostname
    } catch {
      return item.url
    }
  }
  return item.gloss?.trim() || item.strongs
}

export function moveSequenceCursor(
  items: ServiceSequenceItem[],
  cursor: SequenceCursor,
  delta: 1 | -1
): SequenceCursor {
  if (items.length === 0) return { itemIndex: 0, stepIndex: 0 }
  const itemIndex = Math.min(Math.max(0, cursor.itemIndex), items.length - 1)
  const count = sequenceStepCount(items[itemIndex]!)
  const stepIndex = Math.min(Math.max(0, cursor.stepIndex), count - 1)
  const nextStep = stepIndex + delta
  if (nextStep >= 0 && nextStep < count) return { itemIndex, stepIndex: nextStep }
  if (delta > 0 && itemIndex < items.length - 1) return { itemIndex: itemIndex + 1, stepIndex: 0 }
  if (delta < 0 && itemIndex > 0) {
    const prev = itemIndex - 1
    return { itemIndex: prev, stepIndex: sequenceStepCount(items[prev]!) - 1 }
  }
  return { itemIndex, stepIndex }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function text(value: unknown, max = 400): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function hymnStep(value: unknown): ServiceSequenceHymnStep | null {
  if (!isRecord(value)) return null
  const kind = value.kind === 'title' || value.kind === 'end' || value.kind === 'lyrics' ? value.kind : null
  if (!kind) return null
  const lines = Array.isArray(value.lines) ? value.lines.filter((line) => typeof line === 'string').slice(0, 40) : []
  return {
    kind,
    stanzaIndex: typeof value.stanzaIndex === 'number' ? value.stanzaIndex : -1,
    lines: lines.map((line) => line.slice(0, 500)),
    stanzaKind: text(value.stanzaKind, 40) || kind,
    ...(typeof value.verse === 'number' ? { verse: value.verse } : {}),
    ...(typeof value.versePart === 'number' ? { versePart: value.versePart } : {}),
    ...(typeof value.versePartCount === 'number' ? { versePartCount: value.versePartCount } : {}),
    label: text(value.label, 80) || kind
  }
}

function sequenceItem(value: unknown, index: number): ServiceSequenceItem | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null
  const id = text(value.id, 80) || `item-${index + 1}`
  if (value.kind === 'order-image') {
    const path = text(value.path, 1000)
    const folder = text(value.folder, 200)
    if (!path || !folder) return null
    return { id, kind: 'order-image', folder, path, name: text(value.name, 200) || path }
  }
  if (value.kind === 'hymn') {
    const steps = Array.isArray(value.steps) ? value.steps.map(hymnStep).filter((step) => step !== null).slice(0, 80) : []
    const hymnId = text(value.hymnId, 80)
    if (!hymnId) return null
    return {
      id,
      kind: 'hymn',
      hymnalId: text(value.hymnalId, 80),
      hymnId,
      number: typeof value.number === 'number' ? value.number : 0,
      title: text(value.title, 200),
      disabledVerseNumbers: Array.isArray(value.disabledVerseNumbers)
        ? value.disabledVerseNumbers.filter((n) => typeof n === 'number').slice(0, 40)
        : [],
      includeRefrain: value.includeRefrain !== false,
      includeTitle: value.includeTitle !== false,
      includeEnd: value.includeEnd !== false,
      steps
    }
  }
  if (value.kind === 'bible') {
    const reference = text(value.reference, 120)
    const textBody = text(value.text, 4000)
    if (!reference || !textBody) return null
    return {
      id,
      kind: 'bible',
      bookId: text(value.bookId, 40),
      chapter: typeof value.chapter === 'number' ? value.chapter : 1,
      verse: typeof value.verse === 'number' ? value.verse : 1,
      text: textBody,
      reference,
      locationLabel: text(value.locationLabel, 120) || reference,
      translationLabel: text(value.translationLabel, 80) || 'Bible'
    }
  }
  if (value.kind === 'presentation') {
    const deckId = text(value.deckId, 80)
    if (!deckId) return null
    return {
      id,
      kind: 'presentation',
      deckId,
      title: text(value.title, 200) || 'Presentation',
      slideCount: typeof value.slideCount === 'number' ? Math.max(1, Math.round(value.slideCount)) : 1
    }
  }
  if (value.kind === 'media') {
    const path = text(value.path, 1000)
    const folder = text(value.folder, 200)
    if (!path || !folder) return null
    return {
      id,
      kind: 'media',
      folder,
      path,
      name: text(value.name, 200) || path,
      mediaKind: value.mediaKind === 'audio' ? 'audio' : 'video'
    }
  }
  if (value.kind === 'web') {
    const url = text(value.url, 2000)
    if (!/^https?:\/\//i.test(url)) return null
    return { id, kind: 'web', url, title: text(value.title, 200) || url }
  }
  if (value.kind === 'dictionary') {
    const strongs = text(value.strongs, 40)
    const lemma = text(value.lemma, 200)
    if (!strongs || !lemma) return null
    const language = value.language === 'greek' || value.language === 'aramaic' ? value.language : 'hebrew'
    return {
      id,
      kind: 'dictionary',
      strongs,
      lemma,
      transliteration: typeof value.transliteration === 'string' ? value.transliteration.slice(0, 200) : null,
      gloss: typeof value.gloss === 'string' ? value.gloss.slice(0, 200) : null,
      partOfSpeech: typeof value.partOfSpeech === 'string' ? value.partOfSpeech.slice(0, 80) : null,
      definition: text(value.definition, 8000),
      language,
      infoBar: Array.isArray(value.infoBar) ? value.infoBar.filter((part) => typeof part === 'string').slice(0, 12) : [],
      infoBarActive: typeof value.infoBarActive === 'number' ? value.infoBarActive : 0
    }
  }
  return null
}

export function parseServiceSequence(raw: string | null | undefined): ServiceSequenceFile | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || !Array.isArray(parsed.items)) return null
    const items = parsed.items
      .map((item, index) => sequenceItem(item, index))
      .filter((item) => item !== null)
      .slice(0, 400)
    return { version: 1, items }
  } catch {
    return null
  }
}

export function serializeServiceSequence(items: ServiceSequenceItem[]): string {
  const file: ServiceSequenceFile = { version: 1, items }
  return JSON.stringify(file, null, 2)
}
