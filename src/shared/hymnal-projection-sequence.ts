import type { HymnStanza, HymnalStanzaTagStyle } from './hymnal-types'
import { stanzaDisplayTagWithPart } from './hymnal-stanza-format'

export type HymnSlideKind = 'title' | 'lyrics' | 'end'

export type HymnProjectionStep = {
  kind: HymnSlideKind
  stanzaIndex: number
  lines: string[]
}

export type HymnProjectionBuildOptions = {
  /** Verse numbers to omit from projection (1-based). */
  disabledVerseNumbers?: ReadonlySet<number> | number[]
  /** When false, refrain/chorus slides are skipped. Default true. */
  includeRefrain?: boolean
  /** When false, the opening title slide is skipped. Default true. */
  includeTitle?: boolean
  /** When false, the closing end slide is skipped. Default true. */
  includeEnd?: boolean
}

function isRefrainKind(kind: HymnStanza['kind']): boolean {
  return kind === 'refrain' || kind === 'chorus'
}

/** Reading order in the editor pane: verses first, refrain/chorus at the bottom. */
export function orderStanzasForReading(stanzas: HymnStanza[]): number[] {
  const verses: number[] = []
  const tail: number[] = []
  for (let i = 0; i < stanzas.length; i++) {
    if (isRefrainKind(stanzas[i]!.kind)) tail.push(i)
    else verses.push(i)
  }
  return [...verses, ...tail]
}

export function projectionStepLabel(
  stanzas: HymnStanza[],
  step: HymnProjectionStep,
  tagStyle: HymnalStanzaTagStyle = 'short'
): string {
  if (step.kind === 'title') return 'Title slide'
  if (step.kind === 'end') return 'End'
  return stanzaDisplayTagWithPart(stanzas, step.stanzaIndex, tagStyle)
}

function verseDisabled(
  verse: number | undefined,
  disabled: ReadonlySet<number> | number[] | undefined
): boolean {
  if (verse == null || !disabled) return false
  if (Array.isArray(disabled)) return disabled.includes(verse)
  return disabled.has(verse)
}

function disabledSet(opts?: HymnProjectionBuildOptions): Set<number> {
  const d = opts?.disabledVerseNumbers
  if (!d) return new Set()
  return d instanceof Set ? d : new Set(d)
}

/** Index of the stanza repeated after each verse (first refrain/chorus). */
export function findRefrainStanzaIndex(stanzas: HymnStanza[]): number {
  return stanzas.findIndex((s) => isRefrainKind(s.kind))
}

function lyricStep(stanzas: HymnStanza[], index: number): HymnProjectionStep {
  return { kind: 'lyrics', stanzaIndex: index, lines: stanzas[index]?.lines ?? [] }
}

const TITLE_STEP: HymnProjectionStep = { kind: 'title', stanzaIndex: -1, lines: [] }
const END_STEP: HymnProjectionStep = { kind: 'end', stanzaIndex: -1, lines: [] }

function withBookends(
  body: HymnProjectionStep[],
  options?: HymnProjectionBuildOptions
): HymnProjectionStep[] {
  const lyrics = body.map((s) => ({ ...s, kind: 'lyrics' as const }))
  const steps: HymnProjectionStep[] = []
  if (options?.includeTitle !== false) steps.push(TITLE_STEP)
  steps.push(...lyrics)
  if (options?.includeEnd !== false) steps.push(END_STEP)
  return steps
}

function indicesForVerse(stanzas: HymnStanza[], verseNum: number): number[] {
  const out: number[] = []
  for (let i = 0; i < stanzas.length; i++) {
    const s = stanzas[i]!
    if (s.kind === 'verse' && s.verse === verseNum) out.push(i)
  }
  return out
}

/**
 * Presentation order for arrow keys / outputs.
 * Verses only: document order (respecting slide splits as separate stanzas).
 * With refrain: V1 (slides…), refrain, V2, refrain, …
 */
export function buildHymnProjectionSteps(
  stanzas: HymnStanza[],
  options?: HymnProjectionBuildOptions
): HymnProjectionStep[] {
  if (stanzas.length === 0) return withBookends([], options)
  const disabled = disabledSet(options)
  const includeRefrain = options?.includeRefrain !== false
  const refrainIdx = findRefrainStanzaIndex(stanzas)

  if (refrainIdx < 0) {
    const body: HymnProjectionStep[] = []
    for (let i = 0; i < stanzas.length; i++) {
      const s = stanzas[i]!
      if (s.kind === 'verse' && verseDisabled(s.verse, disabled)) continue
      if (isRefrainKind(s.kind) && !includeRefrain) continue
      body.push(lyricStep(stanzas, i))
    }
    return withBookends(body, options)
  }

  const verseNumbers = [...new Set(
    stanzas
      .filter((s) => s.kind === 'verse' && s.verse != null && s.verse > 0)
      .map((s) => s.verse!)
  )].sort((a, b) => a - b)

  if (verseNumbers.length === 0) {
    return withBookends(stanzas.map((_, i) => lyricStep(stanzas, i)), options)
  }

  const body: HymnProjectionStep[] = []
  for (const num of verseNumbers) {
    if (disabled.has(num)) continue
    for (const i of indicesForVerse(stanzas, num)) {
      body.push(lyricStep(stanzas, i))
    }
    if (includeRefrain) {
      body.push(lyricStep(stanzas, refrainIdx))
    }
  }
  return withBookends(body, options)
}

export function clampProjectionStep(step: number, stepCount: number): number {
  if (stepCount <= 0) return 0
  return Math.min(Math.max(0, step), stepCount - 1)
}

export function projectionStepForStanzaIndex(steps: HymnProjectionStep[], stanzaIndex: number): number {
  if (steps.length === 0) return 0
  const hit = steps.findIndex((s) => s.kind === 'lyrics' && s.stanzaIndex === stanzaIndex)
  return hit >= 0 ? hit : 0
}

export function projectionStepAt(steps: HymnProjectionStep[], step: number): HymnProjectionStep | null {
  if (steps.length === 0) return null
  return steps[clampProjectionStep(step, steps.length)] ?? null
}

export function stanzaIndexAtProjectionStep(steps: HymnProjectionStep[], step: number): number {
  return projectionStepAt(steps, step)?.stanzaIndex ?? 0
}

export function linesAtProjectionStep(steps: HymnProjectionStep[], step: number): string[] {
  return projectionStepAt(steps, step)?.lines ?? []
}

export function offsetProjectionStep(step: number, delta: number, stepCount: number): number {
  if (stepCount <= 0) return 0
  return (step + delta + stepCount) % stepCount
}
