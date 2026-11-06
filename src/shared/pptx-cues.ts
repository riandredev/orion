import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'

export type PptxTransitionName = 'fade' | 'push' | 'wipe' | 'split' | 'cover' | 'uncover' | 'cut' | 'none'

export type PptxMediaCue = {
  fileName: string
  kind: 'video' | 'audio'
  leftPct: number
  topPct: number
  widthPct: number
  heightPct: number
}

export type PptxSlideCue = {
  transition: PptxTransitionName
  durationMs: number
  /** Push/wipe/cover direction from the OOXML `dir` attribute. */
  dir?: 'l' | 'r' | 'u' | 'd'
  media: PptxMediaCue[]
}

export type PptxCueSheet = {
  slideCount: number
  slides: PptxSlideCue[]
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: false
})

const SPEED_MS: Record<string, number> = { slow: 1000, med: 750, fast: 500 }

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function entries(node: unknown): [string, unknown][] {
  if (!node || typeof node !== 'object') return []
  return Object.entries(node as Record<string, unknown>)
}

function localName(tag: string): string {
  const i = tag.lastIndexOf(':')
  return i >= 0 ? tag.slice(i + 1) : tag
}

function child(node: unknown, name: string): unknown {
  for (const [key, value] of entries(node)) {
    if (key.startsWith('@_')) continue
    if (localName(key) === name) return value
  }
  return undefined
}

function children(node: unknown, name: string): unknown[] {
  return asArray(child(node, name) as unknown)
}

function attr(node: unknown, name: string): string | undefined {
  if (!node || typeof node !== 'object') return undefined
  const record = node as Record<string, unknown>
  const keys = Object.keys(record).filter(
    (key) => key.startsWith('@_') && localName(key.slice(2)) === name
  )
  const key = keys.find((item) => item.slice(2).includes(':')) ?? keys[0]
  if (!key) return undefined
  const value = record[key]
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return undefined
}

function numAttr(node: unknown, name: string): number | undefined {
  const raw = attr(node, name)
  if (raw == null) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

const KNOWN_TRANSITIONS = new Set<PptxTransitionName>([
  'fade',
  'push',
  'wipe',
  'split',
  'cover',
  'uncover',
  'cut',
  'none'
])

function mapTransition(tag: string): PptxTransitionName {
  if (KNOWN_TRANSITIONS.has(tag as PptxTransitionName)) return tag as PptxTransitionName
  if (tag === 'dissolve' || tag === 'random' || tag === 'morph' || tag === 'checker') return 'fade'
  if (tag === 'pull' || tag === 'strips' || tag === 'newsflash' || tag === 'blinds' || tag === 'wheel') {
    return 'wipe'
  }
  if (tag === 'plus' || tag === 'wedge') return 'split'
  return 'fade'
}

function readDir(node: unknown): 'l' | 'r' | 'u' | 'd' | undefined {
  const raw = attr(node, 'dir')
  if (raw === 'l' || raw === 'r' || raw === 'u' || raw === 'd') return raw
  return undefined
}

function readTransition(sld: unknown): {
  transition: PptxTransitionName
  durationMs: number
  dir?: 'l' | 'r' | 'u' | 'd'
} {
  const transition = child(sld, 'transition')
  if (!transition) return { transition: 'none', durationMs: 0 }
  let kind: PptxTransitionName = 'fade'
  let dir: 'l' | 'r' | 'u' | 'd' | undefined
  for (const [key, value] of entries(transition)) {
    if (key.startsWith('@_')) continue
    const name = localName(key)
    if (name === 'extLst' || name === 'sndAc') continue
    kind = mapTransition(name)
    dir = readDir(value)
    break
  }
  const dur = numAttr(transition, 'dur')
  const spd = attr(transition, 'spd')
  const durationMs = dur ?? (spd ? SPEED_MS[spd] ?? 500 : 500)
  return dir ? { transition: kind, durationMs, dir } : { transition: kind, durationMs }
}

function shapeBox(node: unknown): unknown {
  return child(child(node, 'spPr'), 'xfrm') ?? child(node, 'xfrm')
}

function findMediaLinks(
  node: unknown,
  found: { kind: 'video' | 'audio'; rel: string; box: unknown }[],
  host: unknown
): void {
  if (!node || typeof node !== 'object') return
  const nextHost = shapeBox(node) ? node : host
  for (const [key, value] of entries(node)) {
    if (key.startsWith('@_')) continue
    const name = localName(key)
    if (name === 'videoFile' || name === 'audioFile') {
      const rel = attr(value, 'link') ?? attr(value, 'embed')
      if (rel) found.push({ kind: name === 'videoFile' ? 'video' : 'audio', rel, box: shapeBox(nextHost) })
    }
    for (const item of asArray(value)) findMediaLinks(item, found, nextHost)
  }
}

function boxPercents(
  box: unknown,
  slideCx: number,
  slideCy: number
): Pick<PptxMediaCue, 'leftPct' | 'topPct' | 'widthPct' | 'heightPct'> {
  const off = child(box, 'off')
  const ext = child(box, 'ext')
  const x = numAttr(off, 'x') ?? 0
  const y = numAttr(off, 'y') ?? 0
  const cx = numAttr(ext, 'cx') ?? slideCx
  const cy = numAttr(ext, 'cy') ?? slideCy
  const safeCx = slideCx > 0 ? slideCx : 1
  const safeCy = slideCy > 0 ? slideCy : 1
  return {
    leftPct: (x / safeCx) * 100,
    topPct: (y / safeCy) * 100,
    widthPct: (cx / safeCx) * 100,
    heightPct: (cy / safeCy) * 100
  }
}

function relTarget(rels: unknown, id: string): string | undefined {
  const relationships = child(rels, 'Relationships') ?? rels
  for (const rel of children(relationships, 'Relationship')) {
    if (attr(rel, 'Id') === id) return attr(rel, 'Target')
  }
  return undefined
}

function fileNameFromTarget(target: string): string {
  const parts = target.split('/')
  return parts[parts.length - 1] || target
}

export async function readPptxCues(data: ArrayBuffer | Uint8Array): Promise<PptxCueSheet> {
  const zip = await JSZip.loadAsync(data)
  const presentationXml = await zip.file('ppt/presentation.xml')?.async('string')
  if (!presentationXml) throw new Error('Not a PowerPoint file (missing presentation.xml).')
  const presentation = parser.parse(presentationXml)
  const root = child(presentation, 'presentation') ?? presentation
  const sldSz = child(root, 'sldSz')
  const slideCx = numAttr(sldSz, 'cx') ?? 9144000
  const slideCy = numAttr(sldSz, 'cy') ?? 5143500

  const presRelsXml = await zip.file('ppt/_rels/presentation.xml.rels')?.async('string')
  const presRels = presRelsXml ? parser.parse(presRelsXml) : {}
  const sldIdList = child(root, 'sldIdLst')
  const slides: PptxSlideCue[] = []

  for (const sldId of children(sldIdList, 'sldId')) {
    const relId = attr(sldId, 'id')
    const target = relId ? relTarget(presRels, relId) : undefined
    if (!target) continue
    const slidePath = `ppt/${target.replace(/^\//, '')}`
    const slideXml = await zip.file(slidePath)?.async('string')
    if (!slideXml) continue
    const slideDoc = parser.parse(slideXml)
    const sld = child(slideDoc, 'sld') ?? slideDoc
    const { transition, durationMs, dir } = readTransition(sld)

    const relsPath = slidePath.replace(/^(.*)\/([^/]+)$/, '$1/_rels/$2.rels')
    const slideRelsXml = await zip.file(relsPath)?.async('string')
    const slideRels = slideRelsXml ? parser.parse(slideRelsXml) : {}
    const links: { kind: 'video' | 'audio'; rel: string; box: unknown }[] = []
    findMediaLinks(sld, links, undefined)
    const media: PptxMediaCue[] = []
    for (const link of links) {
      const mediaTarget = relTarget(slideRels, link.rel)
      if (!mediaTarget) continue
      media.push({
        fileName: fileNameFromTarget(mediaTarget),
        kind: link.kind,
        ...boxPercents(link.box, slideCx, slideCy)
      })
    }
    slides.push({ transition, durationMs, ...(dir ? { dir } : {}), media })
  }

  return { slideCount: slides.length, slides }
}

export async function listPackageMedia(data: ArrayBuffer | Uint8Array): Promise<string[]> {
  const zip = await JSZip.loadAsync(data)
  const names: string[] = []
  zip.forEach((path, entry) => {
    if (entry.dir) return
    if (/\.(mp4|m4v|mov|webm|avi|wmv|mp3|m4a|wav|aac)$/i.test(path)) names.push(path)
  })
  return names
}
