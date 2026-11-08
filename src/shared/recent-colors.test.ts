import { describe, expect, it } from 'vitest'
import { mergeRecentSwatches, pushRecentColor, type RecentColorSwatch } from './recent-colors'

const defaults: RecentColorSwatch[] = [
  { color: '#ffffff', label: 'White' },
  { color: '#fff9a7', label: 'Soft gold' },
  { color: '#ffd400', label: 'Gold' }
]

describe('recent color swatches', () => {
  it('keeps the defaults until a color is selected', () => {
    expect(mergeRecentSwatches(defaults, [])).toEqual(defaults)
  })

  it('puts the newest selection first and keeps the other defaults', () => {
    const recents = pushRecentColor([], '#112233', defaults.length)
    expect(mergeRecentSwatches(defaults, recents)).toEqual([
      { color: '#112233', label: '#112233' },
      { color: '#ffffff', label: 'White' },
      { color: '#fff9a7', label: 'Soft gold' }
    ])
  })

  it('moves a selected default to the front without duplicating it', () => {
    const recents = pushRecentColor(['#112233'], '#FFD400', defaults.length)
    expect(mergeRecentSwatches(defaults, recents)).toEqual([
      { color: '#ffd400', label: 'Gold' },
      { color: '#112233', label: '#112233' },
      { color: '#ffffff', label: 'White' }
    ])
  })

  it('drops the oldest color once the row is full', () => {
    const recents = ['#112233', '#445566', '#778899'].reduce(
      (current, color) => pushRecentColor(current, color, defaults.length),
      [] as readonly string[]
    )
    expect(mergeRecentSwatches(defaults, recents).map((swatch) => swatch.color)).toEqual([
      '#778899',
      '#445566',
      '#112233'
    ])
  })
})
