import { describe, expect, it } from 'vitest'
import { snapArrangementPosition, type ArrangementRect } from './display-arrangement'

const bounds: ArrangementRect = { x: 0, y: 0, width: 720, height: 280 }

describe('snapArrangementPosition', () => {
  it('keeps a single monitor in its home slot', () => {
    const home = { x: 40, y: 30 }
    expect(snapArrangementPosition(400, 180, 200, 110, [], home, bounds, { x: 400, y: 180 })).toEqual(home)
  })

  it('joins a second monitor to the nearest flush side', () => {
    const other = { x: 40, y: 40, width: 180, height: 100 }
    const snapped = snapArrangementPosition(300, 50, 180, 100, [other], { x: 0, y: 0 }, bounds, other)
    expect(snapped).toEqual({ x: 220, y: 40 })
  })

  it('pulls an overlapping monitor out to a flush edge', () => {
    const other = { x: 40, y: 40, width: 180, height: 100 }
    expect(
      snapArrangementPosition(190, 70, 180, 100, [other], { x: 0, y: 0 }, bounds, { x: 40, y: 40 })
    ).toEqual({ x: 220, y: 40 })
  })
})
