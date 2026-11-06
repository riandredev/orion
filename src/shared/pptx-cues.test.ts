import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { readPptxCues } from './pptx-cues'

async function fixture(): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldSz cx="9144000" cy="5143500"/>
  <p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
</p:presentation>`
  )
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`
  )
  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:transition spd="slow"><p:push dir="l"/></p:transition>
  <p:cSld><p:spTree>
    <p:pic>
      <p:nvPicPr><p:nvPr><a:videoFile r:link="rId3"/></p:nvPr></p:nvPicPr>
      <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="4572000" cy="2571750"/></a:xfrm></p:spPr>
    </p:pic>
  </p:spTree></p:cSld>
</p:sld>`
  )
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/video" Target="../media/clip.mp4"/>
</Relationships>`
  )
  return zip.generateAsync({ type: 'uint8array' })
}

describe('readPptxCues', () => {
  it('reads slide transition timing and embedded video placement', async () => {
    const cues = await readPptxCues(await fixture())
    expect(cues.slideCount).toBe(1)
    expect(cues.slides[0]?.transition).toBe('push')
    expect(cues.slides[0]?.dir).toBe('l')
    expect(cues.slides[0]?.durationMs).toBe(1000)
    expect(cues.slides[0]?.media).toEqual([
      {
        fileName: 'clip.mp4',
        kind: 'video',
        leftPct: 0,
        topPct: 0,
        widthPct: 50,
        heightPct: 50
      }
    ])
  })
})
