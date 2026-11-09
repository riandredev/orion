import { describe, expect, it } from 'vitest'
import { compareOrderFolderNames } from './order-folder-sort'

const names = ['Boodskap', 'Doop', 'Welkom', 'Lesstudie', 'Spesiale Item']

describe('compareOrderFolderNames', () => {
  it('sorts A to Z by default', () => {
    expect([...names].sort((a, b) => compareOrderFolderNames(a, b, 'az'))).toEqual([
      'Boodskap',
      'Doop',
      'Lesstudie',
      'Spesiale Item',
      'Welkom'
    ])
  })

  it('sorts Z to A when a library asks for that order', () => {
    expect([...names].sort((a, b) => compareOrderFolderNames(a, b, 'za'))).toEqual([
      'Welkom',
      'Spesiale Item',
      'Lesstudie',
      'Doop',
      'Boodskap'
    ])
  })
})