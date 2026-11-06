import { buildDictionaryProjectionInfoBar } from '../../../shared/dictionary-lexicon'
import { verseSlidePart } from '../../../shared/hymnal-stanza-format'
import { buildHymnProjectionSteps, projectionStepLabel } from '../../../shared/hymnal-projection-sequence'
import type { HymnEntry } from '../../../shared/hymnal-types'
import type { LexiconEntry } from '../../../shared/dictionary-types'
import type { ServiceSequenceDraft, ServiceSequenceHymnStep, ServiceSequenceItem } from '../../../shared/service-sequence'
import { getDictionaryLexiconEntry } from './dictionary-api'
import { fetchHymnEntry } from './hymnals-api'
import type { SequenceInsertDraft } from './sequence-drag'

export function hymnStepsFromEntry(
  entry: HymnEntry,
  options: { disabledVerseNumbers: number[]; includeRefrain: boolean }
): ServiceSequenceHymnStep[] {
  const steps = buildHymnProjectionSteps(entry.stanzas, options)
  return steps.map((step) => {
    const stanza = entry.stanzas[step.stanzaIndex]
    const part = verseSlidePart(entry.stanzas, step.stanzaIndex)
    return {
      kind: step.kind,
      stanzaIndex: step.stanzaIndex,
      lines: step.lines,
      stanzaKind: step.kind === 'lyrics' ? stanza?.kind ?? 'verse' : step.kind,
      ...(stanza?.kind === 'verse' && stanza.verse != null ? { verse: stanza.verse } : {}),
      ...(part && part.count > 1 ? { versePart: part.part, versePartCount: part.count } : {}),
      label: projectionStepLabel(entry.stanzas, step)
    }
  })
}

export function dictionaryItemFromEntry(entry: LexiconEntry): ServiceSequenceDraft | null {
  const sense = entry.senses[0]
  if (!sense) return null
  const { segments, activeIndex } = buildDictionaryProjectionInfoBar(
    entry.language,
    entry.senses.map((item) => ({
      partOfSpeech: item.partOfSpeech,
      transliteration: item.transliteration,
      gloss: item.gloss,
      definition: item.definition
    }))
  )
  const projected = entry.senses[activeIndex] ?? sense
  return {
    kind: 'dictionary',
    strongs: entry.id,
    lemma: projected.lemma,
    transliteration: projected.transliteration,
    gloss: projected.gloss,
    partOfSpeech: projected.partOfSpeech,
    definition: projected.definition,
    language: entry.language,
    infoBar: segments,
    infoBarActive: activeIndex
  }
}

export async function materializeSequenceDraft(
  draft: SequenceInsertDraft
): Promise<ServiceSequenceDraft | null> {
  if (draft.kind === 'hymn-ref') {
    const entry = await fetchHymnEntry(draft.hymnalId, draft.hymnId)
    if (!entry) return null
    return {
      kind: 'hymn',
      hymnalId: draft.hymnalId,
      hymnId: draft.hymnId,
      number: entry.number,
      title: entry.title,
      disabledVerseNumbers: draft.disabledVerseNumbers,
      includeRefrain: draft.includeRefrain,
      steps: hymnStepsFromEntry(entry, draft)
    }
  }
  if (draft.kind === 'dictionary-ref') {
    const entry = await getDictionaryLexiconEntry(draft.id)
    if (!entry) return null
    return dictionaryItemFromEntry(entry)
  }
  return draft
}

export function withSequenceId(item: ServiceSequenceDraft): ServiceSequenceItem {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `seq-${Date.now()}`
  return { ...item, id } as ServiceSequenceItem
}

export function hymnDraftFromEntry(
  entry: HymnEntry,
  hymnalId: string,
  options: { disabledVerseNumbers: number[]; includeRefrain: boolean }
): Extract<ServiceSequenceDraft, { kind: 'hymn' }> {
  return {
    kind: 'hymn',
    hymnalId,
    hymnId: entry.id,
    number: entry.number,
    title: entry.title,
    disabledVerseNumbers: options.disabledVerseNumbers,
    includeRefrain: options.includeRefrain,
    steps: hymnStepsFromEntry(entry, options)
  }
}
