import { describe, expect, it } from 'vitest'
import {
  compareContentVersions,
  libraryInstallAction,
  libraryRows,
  libraryUninstallRemoves,
  mergeLibraryPreview,
  parseLibraryCatalog
} from './content-bundles'

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

  it('lists every catalog entry', () => {
    const catalog = parseLibraryCatalog({
      bundles: [
        {
          id: 'panorama',
          name: 'SDA Panorama Church',
          summary: '',
          version: '1',
          downloadUrl: 'https://example.test/panorama.zip'
        },
        {
          id: 'other-church',
          name: 'Other Church',
          summary: '',
          version: '1',
          downloadUrl: 'https://example.test/other.zip'
        }
      ]
    })
    expect(libraryRows(catalog ?? [], []).map((row) => row.id)).toEqual(['panorama', 'other-church'])
  })

  it('keeps a contents preview and ignores a broken one', () => {
    const catalog = parseLibraryCatalog({
      bundles: [
        {
          id: 'panorama',
          name: 'Panorama',
          summary: 'Church library',
          version: '2',
          downloadUrl: 'https://example.test/panorama.zip',
          preview: [
            { label: 'Bibles', items: ['King James Version', ''] },
            { label: '', items: ['Skipped'] }
          ]
        }
      ]
    })
    expect(catalog?.[0]?.preview).toEqual([{ label: 'Bibles', items: ['King James Version'] }])
  })

  it('keeps every slide thumbnail in a library preview', () => {
    const images = Array.from({ length: 41 }, (_, index) => ({
      folder: 'Welkom',
      src: `preview/order/Welkom/image${index + 1}.jpg`,
      alt: 'Welkom slide'
    }))
    const catalog = parseLibraryCatalog({
      bundles: [
        {
          id: 'panorama',
          name: 'Panorama',
          summary: 'Church library',
          version: '5',
          downloadUrl: 'https://example.test/panorama.zip',
          preview: [{ label: 'Service order', items: ['Welkom'], images }]
        }
      ]
    })
    expect(catalog?.[0]?.preview?.[0]?.images).toHaveLength(41)
  })

  it('keeps bundled preview images when the remote catalog omits them', () => {
    const shipped = parseLibraryCatalog({
      bundles: [
        {
          id: 'panorama',
          name: 'Panorama',
          summary: 'Church library',
          version: '2',
          downloadUrl: 'https://example.test/panorama.zip',
          preview: [
            {
              label: 'Service order',
              items: ['Welkom'],
              images: [
                { folder: 'Welkom', src: 'preview/order/Welkom/image1.jpg', alt: 'Welkom slide' },
                { folder: 'Welkom', src: 'https://example.test/nope.jpg', alt: 'Remote' },
                { folder: 'Welkom', src: '../secret.jpg', alt: 'Escape' }
              ]
            }
          ]
        }
      ]
    })
    const remote = parseLibraryCatalog({
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
    expect(shipped?.[0]?.preview?.[0]?.images).toEqual([
      { folder: 'Welkom', src: 'preview/order/Welkom/image1.jpg', alt: 'Welkom slide' }
    ])
    expect(mergeLibraryPreview(remote ?? [], shipped ?? [])[0]?.preview?.[0]?.images).toEqual([
      { folder: 'Welkom', src: 'preview/order/Welkom/image1.jpg', alt: 'Welkom slide' }
    ])
  })

  it('installs only missing files and files this library already owns', () => {
    expect(libraryInstallAction(undefined, null, 'pack')).toBe('copy')
    expect(libraryInstallAction(undefined, 'mine', 'pack')).toBe('leave')
    expect(libraryInstallAction(undefined, 'pack', 'pack')).toBe('leave')
    expect(libraryInstallAction('pack', 'edited', 'pack-v2')).toBe('leave')
    expect(libraryInstallAction('pack', 'pack', 'pack')).toBe('keep')
    expect(libraryInstallAction('pack', 'pack', 'pack-v2')).toBe('copy')
  })

  it('uninstalls only an untouched file this library wrote', () => {
    expect(libraryUninstallRemoves('pack', 'pack', false, false)).toBe(true)
    expect(libraryUninstallRemoves('pack', 'edited', false, false)).toBe(false)
    expect(libraryUninstallRemoves('pack', null, false, false)).toBe(false)
    expect(libraryUninstallRemoves('pack', 'pack', true, false)).toBe(false)
    expect(libraryUninstallRemoves('pack', 'pack', false, true)).toBe(false)
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
