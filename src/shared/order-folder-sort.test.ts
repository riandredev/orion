import { describe, expect, it } from 'vitest'
import { compareOrderFolderNames } from './order-folder-sort'

const names = ['Boodskap', 'Doop', 'Welkom', 'Lesstudie', 'Spesiale Item']

describe('compareOrderFolderNames', () => {
  it('sorts the standard edition A to Z', () => {
    expect([...names].sort((a, b) => compareOrderFolderNames(a, b, 'standard'))).toEqual([
      'Boodskap',
      'Doop',
      'Lesstudie',
      'Spesiale Item',
      'Welkom'
    ])
  })

  it('sorts panorama Z to A', () => {
    expect([...names].sort((a, b) => compareOrderFolderNames(a, b, 'panorama'))).toEqual([
      'Welkom',
      'Spesiale Item',
      'Lesstudie',
      'Doop',
      'Boodskap'
    ])
  })
})