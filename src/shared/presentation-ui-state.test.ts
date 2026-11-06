import { describe, expect, it } from 'vitest'
import {
  buildPresentationUiState,
  emptyPresentationUiState,
  operatorLiveFlags,
  optimisticProgramPatch,
  presentationUiFromStack
} from './presentation-ui-state'

describe('presentation ui state (program bus)', () => {
  it('empty program', () => {
    expect(emptyPresentationUiState()).toEqual({
      stack: { base: null, overlay: null },
      orderActive: false,
      bibleActive: false,
      presentationActive: false,
      outputsOpen: false,
      stage: { base: null, overlay: null }
    })
  })

  it('pending order pixels mark order active', () => {
    const ui = presentationUiFromStack({ base: null, overlay: null }, { orderPending: true })
    expect(ui.orderActive).toBe(true)
    expect(ui.bibleActive).toBe(false)
  })

  it('open outputs reinforce stack flags', () => {
    const ui = buildPresentationUiState({
      stack: { base: 'order', overlay: null },
      orderPending: false,
      biblePending: false,
      presentationPending: false,
      outputsOpen: true
    })
    expect(ui.orderActive).toBe(true)
    expect(ui.outputsOpen).toBe(true)
  })

  it('operator flags stay true while outputs open with order on stack', () => {
    const ui = buildPresentationUiState({
      stack: { base: 'order', overlay: 'bible' },
      orderPending: false,
      biblePending: false,
      presentationPending: false,
      outputsOpen: true
    })
    expect(operatorLiveFlags({ ...ui, orderActive: false }).order).toBe(true)
    expect(operatorLiveFlags(ui).bible).toBe(true)
  })

  it('optimistic patch transitions order -> bible overlay -> stop bible keeps order live', () => {
    let state = emptyPresentationUiState()

    // 1. Project Order image
    state = optimisticProgramPatch(state, { orderActive: true, outputsOpen: true })
    expect(state.stack).toEqual({ base: 'order', overlay: null })
    expect(operatorLiveFlags(state)).toEqual({
      order: true,
      bible: false,
      dictionary: false,
      hymns: false,
      presentation: false
    })

    // 2. Project Bible verse over Order
    state = optimisticProgramPatch(state, { bibleActive: true, outputsOpen: true })
    expect(state.stack).toEqual({ base: 'order', overlay: 'bible' })
    expect(operatorLiveFlags(state)).toEqual({
      order: true,
      bible: true,
      dictionary: false,
      hymns: false,
      presentation: false
    })

    // 3. Stop Bible projection -> Order remains active on base
    state = optimisticProgramPatch(state, { bibleActive: false })
    expect(state.stack).toEqual({ base: 'order', overlay: null })
    expect(operatorLiveFlags(state)).toEqual({
      order: true,
      bible: false,
      dictionary: false,
      hymns: false,
      presentation: false
    })
    expect(state.outputsOpen).toBe(true)

    // 4. Stop Order projection -> Everything closes
    state = optimisticProgramPatch(state, { orderActive: false })
    expect(state.stack).toEqual({ base: null, overlay: null })
    expect(operatorLiveFlags(state)).toEqual({
      order: false,
      bible: false,
      dictionary: false,
      hymns: false,
      presentation: false
    })
    expect(state.outputsOpen).toBe(false)
  })
})
