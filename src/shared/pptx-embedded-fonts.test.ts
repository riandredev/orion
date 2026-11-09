import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { extractPptxEmbeddedFonts } from './pptx-embedded-fonts'

const GUID = '00000001-0002-0003-0405-060708090A0B'

function obfuscate(data: Uint8Array): Uint8Array {
  const key = [0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x03, 0x00, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]
  const out = new Uint8Array(data)
  for (let index = 0; index < 32; index += 1) out[index] = (out[index] ?? 0) ^ (key[index % 16] ?? 0)
  return out
}

async function packageWith(files: Record<string, Uint8Array>, fontXml: string, relXml: string): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:embeddedFontLst>${fontXml}</p:embeddedFontLst>
</p:presentation>`
  )
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relXml}
</Relationships>`
  )
  for (const [name, data] of Object.entries(files)) zip.file(name, data)
  return zip.generateAsync({ type: 'uint8array' })
}

describe('extractPptxEmbeddedFonts', () => {
  it('returns raw embedded font parts with the typeface and style slot', async () => {
    const regular = new Uint8Array([0, 1, 0, 0, 9])
    const bold = new Uint8Array([0, 1, 0, 0, 8])
    const bytes = await packageWith(
      {
        'ppt/fonts/fixture.fntdata': regular,
        'ppt/fonts/fixture-bold.fntdata': bold
      },
      `<p:embeddedFont>
        <p:font typeface="Fixture Sans"/>
        <p:regular r:id="rId10"/>
        <p:bold r:id="rId11"/>
      </p:embeddedFont>`,
      `<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/fixture.fntdata"/>
       <Relationship Id="rId11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/fixture-bold.fntdata"/>`
    )
    const fonts = await extractPptxEmbeddedFonts(bytes)
    expect(fonts.map((font) => [font.familyName, font.weight, font.italic, font.data[4]])).toEqual([
      ['Fixture Sans', 400, false, 9],
      ['Fixture Sans', 700, false, 8]
    ])
  })

  it('deobfuscates a GUID-named embedded font part', async () => {
    const plain = new Uint8Array(32)
    plain[0] = 0
    plain[1] = 1
    plain[4] = 7
    const bytes = await packageWith(
      { [`ppt/fonts/${GUID}.odttf`]: obfuscate(plain) },
      `<p:embeddedFont><p:font typeface="Obfuscated"/><p:italic r:id="rId3"/></p:embeddedFont>`,
      `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/${GUID}.odttf"/>`
    )
    const fonts = await extractPptxEmbeddedFonts(bytes)
    expect(fonts).toHaveLength(1)
    expect(fonts[0]?.italic).toBe(true)
    expect(fonts[0]?.weight).toBe(400)
    expect(fonts[0]?.data[4]).toBe(7)
  })

  it('returns no fonts when the deck does not embed any', async () => {
    const zip = new JSZip()
    zip.file('ppt/presentation.xml', '<p:presentation/>')
    zip.file('ppt/_rels/presentation.xml.rels', '<Relationships/>')
    const bytes = await zip.generateAsync({ type: 'uint8array' })
    expect(await extractPptxEmbeddedFonts(bytes)).toEqual([])
  })
})
