import JSZip from 'jszip'

type PlaceholderStyle = {
  latin: string
  fill: string
}

const TITLE_TYPES = new Set(['title', 'ctrTitle'])
const BODY_TYPES = new Set(['body', 'subTitle'])

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function styleFrom(xml: string, type: string): PlaceholderStyle | null {
  const marker = xml.match(new RegExp(`<p:ph\\b[^>]*\\btype="${type}"[^>]*/?>`))
  if (!marker || marker.index === undefined) return null
  const start = xml.lastIndexOf('<p:sp>', marker.index)
  const end = xml.indexOf('</p:sp>', marker.index)
  if (start < 0 || end < 0) return null
  const level = xml.slice(start, end).match(/<a:lvl1pPr\b[\s\S]*?<\/a:lvl1pPr>/)?.[0] ?? ''
  const latin = level.match(/<a:latin\b[^>]*\btypeface="([^"]+)"/)?.[1]
  if (!latin) return null
  const fill = level.match(/<a:solidFill>[\s\S]*?<\/a:solidFill>/)?.[0] ?? ''
  return { latin, fill }
}

function withDefaults(block: string, style: PlaceholderStyle, fontOnly: boolean): string {
  return block.replace(/<a:lvl1pPr\b[\s\S]*?<\/a:lvl1pPr>/, (level) => {
    if (level.includes('<a:latin')) return level
    const fill = !fontOnly && style.fill && !level.includes('<a:solidFill>') ? style.fill : ''
    const children = `<a:latin typeface="${escapeAttr(style.latin)}"/>${fill}`
    if (/<a:defRPr\b[^>]*\/>/.test(level)) {
      return level.replace(/<a:defRPr\b([^>]*)\/>/, `<a:defRPr$1>${children}</a:defRPr>`)
    }
    if (/<a:defRPr\b/.test(level)) {
      return level.replace(/<a:defRPr\b([^>]*)>/, `<a:defRPr$1>${children}`)
    }
    return level.replace('</a:lvl1pPr>', `<a:defRPr>${children}</a:defRPr></a:lvl1pPr>`)
  })
}

function applyLayout(xml: string, title: PlaceholderStyle | null, body: PlaceholderStyle | null): string {
  return xml.replace(/<p:sp\b[\s\S]*?<\/p:sp>/g, (block) => {
    const marker = block.match(/<p:ph\b[^>]*>/)
    const type = marker?.[0].match(/\btype="([^"]+)"/)?.[1]
    if (!type) return block
    if (TITLE_TYPES.has(type) && title) return withDefaults(block, title, true)
    if (BODY_TYPES.has(type) && body) return withDefaults(block, body, false)
    return block
  })
}

/**
 * Layout placeholders often omit the typeface and color, expecting the matching
 * master placeholder (title for ctrTitle, body for every subtitle) to supply them.
 * The slide reader only follows a placeholder when the index matches, so extra
 * titles and subtitles fall back to Arial black. Copy the master face and fill
 * onto those layout defaults before the deck is read.
 */
export async function inheritPlaceholderFonts(bytes: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(bytes)
  } catch {
    return bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  }
  const masterFile = zip.file('ppt/slideMasters/slideMaster1.xml')
  if (!masterFile) {
    return bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  }
  const master = await masterFile.async('string')
  const title = styleFrom(master, 'title') ?? styleFrom(master, 'ctrTitle')
  const body = styleFrom(master, 'body') ?? styleFrom(master, 'subTitle')
  if (!title && !body) {
    return bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  }
  const layouts = Object.keys(zip.files).filter((name) => /ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(name))
  let changed = false
  for (const name of layouts) {
    const file = zip.file(name)
    if (!file) continue
    const xml = await file.async('string')
    const next = applyLayout(xml, title, body)
    if (next === xml) continue
    zip.file(name, next)
    changed = true
  }
  if (!changed) {
    return bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  }
  return zip.generateAsync({ type: 'arraybuffer' })
}
