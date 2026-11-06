import { describe, expect, it } from 'vitest'
import { buildOrionProfileFile, createEmptyProfileMeta, parseOrionProfileFile } from './orion-profile'

describe('orion-profile', () => {
  it('round-trips profile files', () => {
    const meta = createEmptyProfileMeta('a', 'Main')
    meta.organizationName = 'Grace Church'
    meta.settings['orion-background-settings-v1'] = '{}'
    const file = buildOrionProfileFile(meta)
    const parsed = parseOrionProfileFile(file)
    expect(parsed?.profile.name).toBe('Main')
    expect(parsed?.profile.organizationName).toBe('Grace Church')
  })

  it('rejects unknown format', () => {
    expect(parseOrionProfileFile({ format: 'other' })).toBeNull()
  })
})
