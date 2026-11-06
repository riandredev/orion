import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { applyPicturePlaceholderFrames, type PlacedImage } from './pptx-picture-frames'

async function fixture(): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
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
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree>
    <p:pic><p:nvPicPr><p:nvPr><p:ph type="pic" idx="1"/></p:nvPr></p:nvPicPr><p:spPr/></p:pic>
  </p:spTree></p:cSld>
</p:sld>`
  )
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`
  )
  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp>
      <p:nvSpPr><p:nvPr><p:ph type="pic" idx="1"/></p:nvPr></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="609600" y="1676400"/><a:ext cx="8001000" cy="4495800"/></a:xfrm></p:spPr>
    </p:sp>
  </p:spTree></p:cSld>
</p:sldLayout>`
  )
  return zip.generateAsync({ type: 'uint8array' })
}

describe('applyPicturePlaceholderFrames', () => {
  it('copies picture placeholder geometry onto a slide image that omitted xfrm', async () => {
    const image: PlacedImage = {
      type: 'image',
      position: { x: 0, y: 0 },
      size: { width: 0, height: 0 }
    }
    await applyPicturePlaceholderFrames(await fixture(), [{ elements: [image] }])
    expect(image.position.x).toBeCloseTo(48)
    expect(image.position.y).toBeCloseTo(132)
    expect(image.size.width).toBeCloseTo(630)
    expect(image.size.height).toBeCloseTo(354)
  })
})
