import type { ServiceSequenceDraft } from '../../../shared/service-sequence'

export const SEQUENCE_DRAG_MIME = 'application/x-orion-sequence'

export type SequenceHymnRef = {
  kind: 'hymn-ref'
  hymnalId: string
  hymnId: string
  number: number
  title: string
  disabledVerseNumbers: number[]
  includeRefrain: boolean
}

export type SequenceDictionaryRef = {
  kind: 'dictionary-ref'
  id: string
}

export type SequenceInsertDraft = ServiceSequenceDraft | SequenceHymnRef | SequenceDictionaryRef

export type SequenceDropBody =
  | { op: 'insert'; draft: SequenceInsertDraft }
  | { op: 'move'; id: string }

export function writeSequenceDrag(dataTransfer: DataTransfer, body: SequenceDropBody): void {
  dataTransfer.setData(SEQUENCE_DRAG_MIME, JSON.stringify(body))
  dataTransfer.effectAllowed = body.op === 'move' ? 'move' : 'copy'
}

export function readSequenceDrag(dataTransfer: DataTransfer): SequenceDropBody | null {
  const raw = dataTransfer.getData(SEQUENCE_DRAG_MIME)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SequenceDropBody
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.op === 'move' && typeof parsed.id === 'string') return parsed
    if (parsed.op === 'insert' && parsed.draft && typeof parsed.draft === 'object') return parsed
    return null
  } catch {
    return null
  }
}
