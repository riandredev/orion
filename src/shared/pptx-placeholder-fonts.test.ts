import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { inheritPlaceholderFonts } from './pptx-placeholder-fonts'

async function deck(): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file(
    'ppt/slideMasters/slideMaster1.xml',
    `<p:sldMaster><p:cSld><p:spTree>
      <p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:lstStyle>
        <a:lvl1pPr><a:defRPr b="1"><a:solidFill><a:schemeClr val="dk1"/></a:solidFill><a:latin typeface="Cinzel"/></a:defRPr></a:lvl1pPr>
      </a:lstStyle></p:txBody></p:sp>
      <p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody><a:lstStyle>
        <a:lvl1pPr><a:defRPr><a:solidFill><a:schemeClr val="dk1"/></a:solidFill><a:latin typeface="Anaheim"/></a:defRPr></a:lvl1pPr>
      </a:lstStyle></p:txBody></p:sp>
    </p:spTree></p:cSld></p:sldMaster>`
  )
  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    `<p:sldLayout><p:cSld><p:spTree>
      <p:sp><p:nvSpPr><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr><p:txBody><a:lstStyle>
        <a:lvl1pPr><a:defRPr sz="6200"><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></a:defRPr></a:lvl1pPr>
      </a:lstStyle></p:txBody></p:sp>
      <p:sp><p:nvSpPr><p:nvPr><p:ph idx="3" type="subTitle"/></p:nvPr></p:nvSpPr><p:txBody><a:lstStyle>
        <a:lvl1pPr><a:defRPr sz="1400"/></a:lvl1pPr>
      </a:lstStyle></p:txBody></p:sp>
      <p:sp><p:nvSpPr><p:nvPr><p:ph type="subTitle"/></p:nvPr></p:nvSpPr><p:txBody><a:lstStyle>
        <a:lvl1pPr><a:defRPr><a:latin typeface="Poppins"/></a:defRPr></a:lvl1pPr>
      </a:lstStyle></p:txBody></p:sp>
    </p:spTree></p:cSld></p:sldLayout>`
  )
  return zip.generateAsync({ type: 'uint8array' })
}

describe('inheritPlaceholderFonts', () => {
  it('copies the master title face and body face onto layout placeholders that omit them', async () => {
    const next = await JSZip.loadAsync(await inheritPlaceholderFonts(await deck()))
    const layout = await next.file('ppt/slideLayouts/slideLayout1.xml')!.async('string')
    expect(layout).toContain('typeface="Cinzel"')
    expect(layout).toContain('typeface="Anaheim"')
    expect(layout).toContain('val="accent2"')
    expect(layout).toContain('typeface="Poppins"')
    const subtitle = layout.split('idx="3"')[1] ?? ''
    expect(subtitle.slice(0, 500)).toContain('val="dk1"')
  })
})
