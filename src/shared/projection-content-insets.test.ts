import { describe, expect, it } from 'vitest'
import {
  clampProjectionContentInsets,
  clampProjectionContentInsetsByCategory,
  DEFAULT_PROJECTION_CONTENT_INSETS,
  DEFAULT_PROJECTION_CONTENT_INSETS_BY_CATEGORY
} from './projection-content-insets'

describe('projection-content-insets', () => {
  it('clamps sides into range', () => {
    expect(clampProjectionContentInsets({ top: 99, right: -2, bottom: 4, left: 4.5 })).toEqual({
      top: 40,
      right: 0,
      bottom: 4,
      left: 4.5
    })
  })

  it('falls back to defaults for invalid flat input', () => {
    expect(clampProjectionContentInsets(undefined)).toEqual(DEFAULT_PROJECTION_CONTENT_INSETS)
  })

  it('clamps per-category settings', () => {
    expect(
      clampProjectionContentInsetsByCategory({
        bible: { top: 1, right: 2, bottom: 3, left: 4 },
        hymns: { top: 5, right: 6, bottom: 7, left: 8 }
      })
    ).toEqual({
      bible: { top: 1, right: 2, bottom: 3, left: 4 },
      hymns: { top: 5, right: 6, bottom: 7, left: 8 },
      dictionary: DEFAULT_PROJECTION_CONTENT_INSETS_BY_CATEGORY.dictionary
    })
  })
})
