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
    expect(parsed?.profile.settings['orion-background-settings-v1']).toBe('{}')
  })

  it('keeps service sequence and library preferences and drops unknown keys', () => {
    const meta = createEmptyProfileMeta('a', 'Main')
    meta.settings['orion-service-sequence'] = '[]'
    meta.settings['orion-order-view'] = 'list'
    meta.settings['orion-not-a-setting'] = 'nope'
    const parsed = parseOrionProfileFile(buildOrionProfileFile(meta))
    expect(parsed?.profile.settings['orion-service-sequence']).toBe('[]')
    expect(parsed?.profile.settings['orion-order-view']).toBe('list')
    expect(parsed?.profile.settings['orion-not-a-setting']).toBeUndefined()
  })

  it('rejects unknown format', () => {
    expect(parseOrionProfileFile({ format: 'other' })).toBeNull()
  })
})
