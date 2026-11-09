import { describe, expect, it } from 'vitest'
import { compareContentVersions, libraryRows, parseLibraryCatalog } from './content-bundles'

describe('content bundles', () => {
  it('compares dotted content versions', () => {
    expect(compareContentVersions('1', '2')).toBeLessThan(0)
    expect(compareContentVersions('1.10', '1.2')).toBeGreaterThan(0)
    expect(compareContentVersions('3', '3')).toBe(0)
  })

  it('marks a newer catalog version as an update', () => {
    const catalog = parseLibraryCatalog({
      bundles: [
        {
          id: 'panorama',
          name: 'Panorama',
          summary: 'Church library',
          version: '2',
          downloadUrl: 'https://example.test/panorama.zip'
        }
      ]
    })
    expect(catalog).not.toBeNull()
    const rows = libraryRows(catalog ?? [], [{ id: 'panorama', version: '1' }])
    expect(rows[0]?.status).toBe('update')
  })

  it('rejects a catalog entry without an https download', () => {
    expect(
      parseLibraryCatalog({
        bundles: [
          {
            id: 'panorama',
            name: 'Panorama',
            summary: '',
            version: '1',
            downloadUrl: 'file:///tmp/panorama.zip'
          }
        ]
      })
    ).toBeNull()
  })
})
