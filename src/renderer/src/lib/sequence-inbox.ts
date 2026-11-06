import type { SequenceInsertDraft } from './sequence-drag'

type SequenceInbox = (draft: SequenceInsertDraft) => void

let inbox: SequenceInbox | null = null

export function setSequenceInbox(next: SequenceInbox | null): void {
  inbox = next
}

export function pushSequenceDraft(draft: SequenceInsertDraft): void {
  inbox?.(draft)
}
