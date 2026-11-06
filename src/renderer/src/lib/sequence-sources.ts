import type { ServiceSequenceDraft } from '../../../shared/service-sequence'

let hymn: Extract<ServiceSequenceDraft, { kind: 'hymn' }> | null = null
let bible: Extract<ServiceSequenceDraft, { kind: 'bible' }> | null = null

export function publishHymnSequenceDraft(next: Extract<ServiceSequenceDraft, { kind: 'hymn' }> | null): void {
  hymn = next
}

export function currentHymnSequenceDraft(): Extract<ServiceSequenceDraft, { kind: 'hymn' }> | null {
  return hymn
}

export function publishBibleSequenceDraft(next: Extract<ServiceSequenceDraft, { kind: 'bible' }> | null): void {
  bible = next
}

export function currentBibleSequenceDraft(): Extract<ServiceSequenceDraft, { kind: 'bible' }> | null {
  return bible
}
