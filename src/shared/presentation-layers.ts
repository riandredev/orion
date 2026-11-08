import type { OrionStackSource, OrionStackState } from './projection-stack'

/** Which sources occupy base vs overlay (ProPresenter-style layer metadata). */
export type LayerDocument = {
  base: OrionStackSource | null
  overlay: OrionStackSource | null
}

export function emptyLayerDocument(): LayerDocument {
  return { base: null, overlay: null }
}

export function stackStateFromDocument(doc: LayerDocument): OrionStackState {
  return { base: doc.base, overlay: doc.overlay }
}

export function documentFromStackState(state: OrionStackState | null | undefined): LayerDocument {
  const normalized = normalizeStackState(state)
  return { base: normalized.base, overlay: normalized.overlay }
}

export function normalizeStackState(state: OrionStackState | null | undefined): OrionStackState {
  if (!state || typeof state !== 'object') {
    return { base: null, overlay: null }
  }
  const allowed = (value: unknown): OrionStackSource | null =>
    value === 'order' || value === 'bible' || value === 'presentation' ? value : null
  const base = allowed(state.base)
  const overlay = allowed(state.overlay)
  return { base, overlay }
}

export function liveFlagsFromStack(state: OrionStackState | null | undefined): {
  orderLive: boolean
  bibleLive: boolean
  presentationLive: boolean
} {
  const normalized = normalizeStackState(state)
  return {
    orderLive: normalized.base === 'order' || normalized.overlay === 'order',
    bibleLive: normalized.base === 'bible' || normalized.overlay === 'bible',
    presentationLive: normalized.base === 'presentation' || normalized.overlay === 'presentation'
  }
}

/** Add or refresh a source on the layer stack. */
export function applySetLayer(doc: LayerDocument, source: OrionStackSource): LayerDocument {
  if (doc.base === null && doc.overlay === null) {
    return { base: source, overlay: null }
  }
  if (doc.base === source) {
    return doc
  }
  if (doc.overlay === source) {
    return doc
  }
  if (doc.overlay === null && doc.base !== null && doc.base !== source) {
    return { base: doc.base, overlay: source }
  }
  return { base: doc.base, overlay: source }
}

/** Remove one source; promote overlay to base when clearing base with an overlay. */
export function applyClearLayer(doc: LayerDocument, source: OrionStackSource): LayerDocument {
  if (doc.overlay === source) {
    return { base: doc.base, overlay: null }
  }
  if (doc.base === source) {
    if (doc.overlay !== null) {
      return { base: doc.overlay, overlay: null }
    }
    return emptyLayerDocument()
  }
  return doc
}
