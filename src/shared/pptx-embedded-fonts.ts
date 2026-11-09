import { eotToTtf } from 'mtx-decompressor'
import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'

export type PptxEmbeddedFont = {
  familyName: string
  style: 'regular' | 'bold' | 'italic' | 'boldItalic'
  weight: number
  italic: boolean
  data: Uint8Array
  contentType: 'font/ttf' | 'font/otf'
}

const SLOTS = [
  { key: 'regular', style: 'regular', weight: 400, italic: false },
  { key: 'bold', style: 'bold', weight: 700, italic: false },
  { key: 'italic', style: 'italic', weight: 400, italic: true },
  { key: 'boldItalic', style: 'boldItalic', weight: 700, italic: true }
] as const

const GUID = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true
})

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function attr(node: unknown, name: string): string {
  if (!node || typeof node !== 'object') return ''
  const record = node as Record<string, unknown>
  const value = record[`@_${name}`] ?? record[`@_r:${name}`]
  return typeof value === 'string' ? value : ''
}

function resolvePart(baseFile: string, target: string): string {
  if (target.startsWith('/')) return target.replace(/^\/+/, '')
  const parts = baseFile.split('/').slice(0, -1)
  for (const segment of target.split('/')) {
    if (segment === '..') parts.pop()
    else if (segment && segment !== '.') parts.push(segment)
  }
  return parts.join('/')
}

function sniff(data: Uint8Array): 'ttf' | 'otf' | null {
  if (data.length < 4) return null
  const tag = String.fromCharCode(data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, data[3] ?? 0)
  if (tag === 'OTTO') return 'otf'
  if (tag === 'true' || tag === 'typ1') return 'ttf'
  if (data[0] === 0 && data[1] === 1 && data[2] === 0 && data[3] === 0) return 'ttf'
  return null
}

/** Undo the OOXML embedded-font XOR. The key is the part-name GUID in Guid.ToByteArray order. */
function deobfuscateOfficeFont(data: Uint8Array, guid: string): Uint8Array {
  const parts = guid.split('-')
  const data1 = Number.parseInt(parts[0] ?? '', 16)
  const data2 = Number.parseInt(parts[1] ?? '', 16)
  const data3 = Number.parseInt(parts[2] ?? '', 16)
  const tail = `${parts[3] ?? ''}${parts[4] ?? ''}`
  const key = new Uint8Array(16)
  key[0] = data1 & 0xff
  key[1] = (data1 >> 8) & 0xff
  key[2] = (data1 >> 16) & 0xff
  key[3] = (data1 >> 24) & 0xff
  key[4] = data2 & 0xff
  key[5] = (data2 >> 8) & 0xff
  key[6] = data3 & 0xff
  key[7] = (data3 >> 8) & 0xff
  for (let index = 0; index < 8; index += 1) {
    key[8 + index] = Number.parseInt(tail.slice(index * 2, index * 2 + 2), 16)
  }
  const out = new Uint8Array(data)
  const length = Math.min(32, out.length)
  for (let index = 0; index < length; index += 1) out[index] = (out[index] ?? 0) ^ (key[index % 16] ?? 0)
  return out
}

function decodeFontPart(partName: string, raw: Uint8Array): Uint8Array | null {
  const stem = partName.split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''
  const candidates = GUID.test(stem) ? [deobfuscateOfficeFont(raw, stem), raw] : [raw]
  for (const candidate of candidates) {
    if (sniff(candidate)) return candidate.slice()
    try {
      const decoded = eotToTtf(candidate)
      if (sniff(decoded)) return decoded
    } catch {
      /* This part is not an EOT container. */
    }
  }
  return null
}

/**
 * Read ppt/fonts parts listed in presentation.xml.
 * PowerPoint embeds them as MicroType-compressed EOT (.fntdata) or GUID-obfuscated font parts.
 */
export async function extractPptxEmbeddedFonts(bytes: ArrayBuffer | Uint8Array): Promise<PptxEmbeddedFont[]> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(bytes)
  } catch {
    return []
  }
  const presentationFile = zip.file('ppt/presentation.xml')
  const relsFile = zip.file('ppt/_rels/presentation.xml.rels')
  if (!presentationFile || !relsFile) return []

  const presentationXml = await presentationFile.async('string')
  const relsXml = await relsFile.async('string')
  const presentation = parser.parse(presentationXml)?.presentation
  const fonts = asArray(presentation?.embeddedFontLst?.embeddedFont)
  if (fonts.length === 0) return []

  const rels = new Map<string, string>()
  for (const rel of asArray(parser.parse(relsXml)?.Relationships?.Relationship)) {
    const id = attr(rel, 'Id')
    const target = attr(rel, 'Target')
    if (id && target) rels.set(id, target)
  }

  const decoded: PptxEmbeddedFont[] = []
  for (const entry of fonts) {
    const familyName = attr(entry?.font, 'typeface').trim()
    if (!familyName) continue
    for (const slot of SLOTS) {
      const id = attr(entry?.[slot.key], 'id')
      const target = id ? rels.get(id) : undefined
      if (!target) continue
      const partName = resolvePart('ppt/presentation.xml', target)
      const file = zip.file(partName)
      if (!file) continue
      const raw = await file.async('uint8array')
      const data = decodeFontPart(partName, raw)
      const kind = data ? sniff(data) : null
      if (!data || !kind) continue
      decoded.push({
        familyName,
        style: slot.style,
        weight: slot.weight,
        italic: slot.italic,
        data,
        contentType: kind === 'otf' ? 'font/otf' : 'font/ttf'
      })
    }
  }
  return decoded
}
