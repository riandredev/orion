import { describe, expect, it } from 'vitest'
import { installerRequestUrls, selectUpdate, type ReleaseInfo } from './app-update'

const releases: ReleaseInfo[] = [
  {
    tag_name: 'v0.1.0',
    body: 'Clean',
    assets: [
      {
        name: 'Orion-0.1.0-windows-setup.exe',
        browser_download_url: 'https://example.test/orion.exe',
        size: 10
      }
    ]
  },
  {
    tag_name: 'v0.1.0-panorama',
    body: 'Panorama',
    assets: [
      {
        name: 'Orion-Panorama-0.1.0-windows-setup.exe',
        browser_download_url: 'https://example.test/panorama.exe',
        size: 20
      }
    ]
  },
  {
    tag_name: 'v0.2.0-panorama',
    body: 'Newer panorama',
    assets: [
      {
        name: 'Orion-Panorama-0.2.0-windows-setup.exe',
        browser_download_url: 'https://example.test/panorama-new.exe',
        size: 21
      },
      {
        name: 'Orion-Panorama-0.2.0-linux.AppImage',
        browser_download_url: 'https://example.test/panorama.AppImage',
        size: 22
      }
    ]
  }
]

describe('selectUpdate', () => {
  it('ignores panorama tags and stays on the Orion release line', () => {
    const releasesWithStandard: ReleaseInfo[] = [
      ...releases,
      {
        tag_name: 'v0.2.0',
        body: 'Orion',
        assets: [
          {
            name: 'Orion-0.2.0-windows-setup.exe',
            browser_download_url: 'https://example.test/orion-new.exe',
            size: 11
          }
        ]
      }
    ]
    const selected = selectUpdate(releasesWithStandard, 'win32', '0.1.0')
    expect(selected?.version).toBe('0.2.0')
    expect(selected?.asset.name).toBe('Orion-0.2.0-windows-setup.exe')
    expect(selectUpdate(releases, 'win32', '0.1.0')).toBeNull()
  })

  it('asks GitHub for the asset directly before the public download link', () => {
    expect(
      installerRequestUrls({
        name: 'Orion-Panorama-1.0.5-windows-setup.exe',
        url: 'https://api.github.com/repos/riandredev/orion/releases/assets/1',
        browser_download_url: 'https://github.com/riandredev/orion/releases/download/v1.0.5-panorama/Orion-Panorama-1.0.5-windows-setup.exe',
        size: 10
      })
    ).toEqual([
      'https://api.github.com/repos/riandredev/orion/releases/assets/1',
      'https://github.com/riandredev/orion/releases/download/v1.0.5-panorama/Orion-Panorama-1.0.5-windows-setup.exe'
    ])
  })

  it('picks the installer for the current platform', () => {
    const update = selectUpdate(
      [
        {
          tag_name: 'v0.2.0',
          assets: [
            {
              name: 'Orion-0.2.0-linux.AppImage',
              browser_download_url: 'https://example.test/orion.AppImage',
              size: 22
            }
          ]
        }
      ],
      'linux',
      '0.1.0'
    )
    expect(update?.asset.name).toBe('Orion-0.2.0-linux.AppImage')
  })
})
