import { describe, expect, it } from 'vitest'
import { selectUpdate, type ReleaseInfo } from './app-update'

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
  it('keeps each edition on its own release line', () => {
    const panorama = selectUpdate(releases, 'panorama', 'win32', '0.1.0')
    expect(panorama?.version).toBe('0.2.0')
    expect(panorama?.asset.name).toBe('Orion-Panorama-0.2.0-windows-setup.exe')

    const standard = selectUpdate(releases, 'standard', 'win32', '0.1.0')
    expect(standard).toBeNull()
  })

  it('picks the installer for the current platform', () => {
    const update = selectUpdate(releases, 'panorama', 'linux', '0.1.0')
    expect(update?.asset.name).toBe('Orion-Panorama-0.2.0-linux.AppImage')
  })
})
