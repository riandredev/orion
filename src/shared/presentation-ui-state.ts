import type { OrionStackState } from './projection-stack'
import { applyClearLayer, applySetLayer, liveFlagsFromStack, normalizeStackState } from './presentation-layers'
import type { ProjectionStageState } from './projection-mixer'

function scriptureOnStage(stage?: ProjectionStageState): 'bible' | 'dictionary' | 'hymn' | null {
  for (const wire of [stage?.overlay, stage?.base]) {
    if (wire?.type === 'dictionary') return 'dictionary'
    if (wire?.type === 'hymn') return 'hymn'
    if (wire?.type === 'bible') return 'bible'
  }
  return null
}

/** Authoritative UI snapshot from the main process (ProPresenter-style program bus). */
export type PresentationUiState = {
  stack: OrionStackState
  orderActive: boolean
  bibleActive: boolean
  presentationActive: boolean
  /** True when at least one projection output window is open. */
  outputsOpen: boolean
  /** Exact stage payload currently on the projection outputs. */
  stage?: ProjectionStageState
}

export const emptyPresentationUiState = (): PresentationUiState => ({
  stack: { base: null, overlay: null },
  orderActive: false,
  bibleActive: false,
  presentationActive: false,
  outputsOpen: false,
  stage: { base: null, overlay: null }
})

export type PresentationProgramSignals = {
  stack: OrionStackState
  orderPending: boolean
  biblePending: boolean
  presentationPending: boolean
  outputsOpen: boolean
  stage?: ProjectionStageState
}

export function presentationUiFromStack(
  stack: OrionStackState | null | undefined,
  options?: { orderPending?: boolean; biblePending?: boolean; presentationPending?: boolean }
): Pick<PresentationUiState, 'stack' | 'orderActive' | 'bibleActive' | 'presentationActive'> {
  const normalized = normalizeStackState(stack)
  const flags = liveFlagsFromStack(normalized)
  return {
    stack: normalized,
    orderActive: flags.orderLive || options?.orderPending === true,
    bibleActive: flags.bibleLive || options?.biblePending === true,
    presentationActive: flags.presentationLive || options?.presentationPending === true
  }
}

/** Combine stack, pending pixels, and open outputs into operator-facing program state. */
export function buildPresentationUiState(signals: PresentationProgramSignals): PresentationUiState {
  const fromStack = presentationUiFromStack(signals.stack, {
    orderPending: signals.orderPending,
    biblePending: signals.biblePending,
    presentationPending: signals.presentationPending
  })
  const stackFlags = liveFlagsFromStack(fromStack.stack)

  const orderActive =
    fromStack.orderActive || (signals.outputsOpen && stackFlags.orderLive)
  const bibleActive =
    fromStack.bibleActive || (signals.outputsOpen && stackFlags.bibleLive)
  const presentationActive =
    fromStack.presentationActive || (signals.outputsOpen && stackFlags.presentationLive)

  return {
    stack: fromStack.stack,
    orderActive,
    bibleActive,
    presentationActive,
    outputsOpen: signals.outputsOpen,
    ...(signals.stage ? { stage: signals.stage } : {})
  }
}

export function mergePresentationUi(
  current: PresentationUiState,
  patch: Partial<PresentationUiState>
): PresentationUiState {
  return {
    stack: patch.stack ?? current.stack,
    orderActive: patch.orderActive ?? current.orderActive,
    bibleActive: patch.bibleActive ?? current.bibleActive,
    presentationActive: patch.presentationActive ?? current.presentationActive,
    outputsOpen: patch.outputsOpen ?? current.outputsOpen,
    stage: patch.stage ?? current.stage
  }
}

export function optimisticProgramPatch(
  current: PresentationUiState,
  patch: Partial<Pick<PresentationUiState, 'orderActive' | 'bibleActive' | 'presentationActive' | 'outputsOpen'>>
): PresentationUiState {
  let nextStack = normalizeStackState(current.stack)

  if (patch.orderActive === true) {
    nextStack = applySetLayer(nextStack, 'order')
  } else if (patch.orderActive === false) {
    nextStack = applyClearLayer(nextStack, 'order')
  }

  if (patch.bibleActive === true) {
    nextStack = applySetLayer(nextStack, 'bible')
  } else if (patch.bibleActive === false) {
    nextStack = applyClearLayer(nextStack, 'bible')
  }

  if (patch.presentationActive === true) {
    nextStack = applySetLayer(nextStack, 'presentation')
  } else if (patch.presentationActive === false) {
    nextStack = applyClearLayer(nextStack, 'presentation')
  }

  const stackFlags = liveFlagsFromStack(nextStack)
  const orderActive = patch.orderActive ?? stackFlags.orderLive
  const bibleActive = patch.bibleActive ?? stackFlags.bibleLive
  const presentationActive = patch.presentationActive ?? stackFlags.presentationLive
  const outputsOpen = patch.outputsOpen ?? (orderActive || bibleActive || presentationActive)

  return {
    stack: nextStack,
    orderActive,
    bibleActive,
    presentationActive,
    outputsOpen,
    stage: current.stage
  }
}

/** Ribbon / preview: treat open outputs as live when program flags say so. */
function deckOnStage(stage?: ProjectionStageState): boolean {
  return stage?.base?.type === 'deck-slide' || stage?.overlay?.type === 'deck-slide'
}

export function operatorLiveFlags(ui: PresentationUiState): {
  order: boolean
  bible: boolean
  dictionary: boolean
  hymns: boolean
  presentation: boolean
} {
  const stackFlags = liveFlagsFromStack(ui.stack)
  const onScriptureBus = ui.bibleActive || stackFlags.bibleLive
  const scripture = scriptureOnStage(ui.stage)
  const fallbackScripture = onScriptureBus && scripture === null && !deckOnStage(ui.stage)
  return {
    order: ui.orderActive || stackFlags.orderLive,
    bible: onScriptureBus && (scripture === 'bible' || (fallbackScripture && scripture !== 'dictionary' && scripture !== 'hymn')),
    dictionary: onScriptureBus && scripture === 'dictionary',
    hymns: onScriptureBus && scripture === 'hymn',
    presentation: ui.presentationActive || stackFlags.presentationLive || deckOnStage(ui.stage)
  }
}
