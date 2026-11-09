import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { countKeynoteSlides, prepareKeynotePackage } from './keynote-package'

async function nestedKeynote(): Promise<Uint8Array> {
  const inner = new JSZip()
  inner.file('Index/Slide.iwa', new Uint8Array([1]))
  inner.file('Index/Slide-2.iwa', new Uint8Array([2]))
  inner.file('Index/MasterSlide.iwa', new Uint8Array([3]))
  inner.file('Index/OperationStorage.iwa', new Uint8Array([4]))
  const indexZip = await inner.generateAsync({ type: 'uint8array' })
  const outer = new JSZip()
  outer.file('Deck.key/Index.zip', indexZip)
  outer.file('Deck.key/preview.jpg', new Uint8Array([5]))
  return outer.generateAsync({ type: 'uint8array' })
}

describe('keynote package', () => {
  it('counts slides inside a nested Index.zip and ignores master slides', async () => {
    expect(await countKeynoteSlides(await nestedKeynote())).toBe(2)
  })

  it('removes OperationStorage from the nested archive', async () => {
    const prepared = await prepareKeynotePackage(await nestedKeynote())
    const outer = await JSZip.loadAsync(prepared)
    const nested = outer.file('Deck.key/Index.zip')
    expect(nested).toBeTruthy()
    const inner = await JSZip.loadAsync(await nested!.async('uint8array'))
    expect(Object.keys(inner.files).some((name) => /operationstorage/i.test(name))).toBe(false)
    expect(inner.file('Index/Slide.iwa')).toBeTruthy()
  })
})