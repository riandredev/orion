import { describe, expect, it } from 'vitest'
import { fileUrlToLocalPath, localPathToFileUrl } from './file-url'

describe('file urls', () => {
  it('keeps a Linux absolute path', () => {
    expect(localPathToFileUrl('/home/orion/media/clip.mp4')).toBe('file:///home/orion/media/clip.mp4')
    expect(fileUrlToLocalPath('file:///home/orion/media/clip.mp4')).toBe('/home/orion/media/clip.mp4')
  })

  it('keeps a Windows drive path', () => {
    expect(localPathToFileUrl('C:\\order\\slide.png')).toBe('file:///C:/order/slide.png')
    expect(fileUrlToLocalPath('file:///C:/order/slide.png')).toBe('C:\\order\\slide.png')
  })
})
