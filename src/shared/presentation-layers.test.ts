import { describe, expect, it } from 'vitest'
import type { OrionStackState } from './projection-stack'
import {
  applyClearLayer,
  applySetLayer,
  documentFromStackState,
  emptyLayerDocument,
  liveFlagsFromStack,
  normalizeStackState,
  stackStateFromDocument
} from './presentation-layers'

describe('presentation layer stack (smoke)', () => {
  it('starts empty', () => {
    const doc = emptyLayerDocument()
    expect(stackStateFromDocument(doc)).toEqual({ base: null, overlay: null })
    expect(liveFlagsFromStack(stackStateFromDocument(doc))).toEqual({
      orderLive: false,
      bibleLive: false,
      presentationLive: false
    })
  })

  it('first source becomes base', () => {
    const doc = applySetLayer(emptyLayerDocument(), 'order')
    expect(doc).toEqual({ base: 'order', overlay: null })
    expect(liveFlagsFromStack(stackStateFromDocument(doc))).toEqual({
      orderLive: true,
      bibleLive: false,
      presentationLive: false
    })
  })

  it('second source becomes overlay (order then bible)', () => {
    let doc = applySetLayer(emptyLayerDocument(), 'order')
    doc = applySetLayer(doc, 'bible')
    expect(doc).toEqual({ base: 'order', overlay: 'bible' })
    expect(liveFlagsFromStack(stackStateFromDocument(doc))).toEqual({
      orderLive: true,
      bibleLive: true,
      presentationLive: false
    })
  })

  it('second source becomes overlay (bible then order)', () => {
    let doc = applySetLayer(emptyLayerDocument(), 'bible')
    doc = applySetLayer(doc, 'order')
    expect(doc).toEqual({ base: 'bible', overlay: 'order' })
    expect(liveFlagsFromStack(stackStateFromDocument(doc))).toEqual({
      orderLive: true,
      bibleLive: true,
      presentationLive: false
    })
  })

  it('clear overlay keeps base (order + bible, stop bible)', () => {
    let doc = applySetLayer(emptyLayerDocument(), 'order')
    doc = applySetLayer(doc, 'bible')
    doc = applyClearLayer(doc, 'bible')
    expect(doc).toEqual({ base: 'order', overlay: null })
    expect(liveFlagsFromStack(stackStateFromDocument(doc)).bibleLive).toBe(false)
  })

  it('clear base promotes overlay (bible + order, stop order)', () => {
    let doc = applySetLayer(emptyLayerDocument(), 'bible')
    doc = applySetLayer(doc, 'order')
    doc = applyClearLayer(doc, 'order')
    expect(doc).toEqual({ base: 'bible', overlay: null })
    expect(liveFlagsFromStack(stackStateFromDocument(doc)).orderLive).toBe(false)
  })

  it('clear sole base empties stack', () => {
    let doc = applySetLayer(emptyLayerDocument(), 'order')
    doc = applyClearLayer(doc, 'order')
    expect(documentFromStackState(stackStateFromDocument(doc))).toEqual(emptyLayerDocument())
  })

  it('normalizes invalid IPC payloads', () => {
    expect(normalizeStackState(undefined)).toEqual({ base: null, overlay: null })
    expect(
      normalizeStackState({ base: 'order', overlay: undefined } as unknown as OrionStackState)
    ).toEqual({
      base: 'order',
      overlay: null
    })
  })
})
