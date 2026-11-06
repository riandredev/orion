import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: false
})

const EMU_PER_PT = 12700

export type PlacedImage = {
  type: string
  position: { x: number; y: number }
  size: { width: number; height: number }
}

type Box = {
  type?: string
  idx?: string
  x: number
  y: number
  width: number
  height: number
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function entries(node: unknown): [string, unknown][] {
  if (!node || typeof node !== 'object') return []
  return Object.entries(node as Record<string, unknown>)
}

function localName(tag: string): string {
  const index = tag.lastIndexOf(':')
  return index >= 0 ? tag.slice(index + 1) : tag
}

function child(node: unknown, name: string): unknown {
  for (const [key, value] of entries(node)) {
    if (key.startsWith('@_')) continue
    if (localName(key) === name) return value
  }
  return undefined
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
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

function resolveZipPath(baseFile: string, target: string): string {
  const parts = baseFile.split('/').slice(0, -1)
  for (const segment of target.split('/')) {
    if (segment === '..') parts.pop()
    else if (segment && segment !== '.') parts.push(segment)
  }
  return parts.join('/')
}

async function xml(zip: JSZip, path: string): Promise<unknown | null> {
  const file = zip.file(path)
  if (!file) return null
  return parser.parse(await file.async('string'))
}

async function slidePaths(zip: JSZip): Promise<string[]> {
  const presentation = await xml(zip, 'ppt/presentation.xml')
  const rels = await xml(zip, 'ppt/_rels/presentation.xml.rels')
  if (!presentation || !rels) return []
  const ids = asArray(child(child(presentation, 'presentation'), 'sldIdLst')).flatMap((list) =>
    asArray(child(list, 'sldId'))
  )
  const relationships = asArray(child(rels, 'Relationships')).flatMap((root) =>
    asArray(child(root, 'Relationship'))
  )
  return ids.flatMap((id) => {
    const rel = relationships.find((item) => attr(item, 'Id') === attr(id, 'id'))
    const target = attr(rel, 'Target')
    return target ? [resolveZipPath('ppt/presentation.xml', target)] : []
  })
}

function pictureBoxes(doc: unknown): Box[] {
  const found: Box[] = []
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    const ph =
      child(child(child(node, 'nvSpPr'), 'nvPr'), 'ph') ??
      child(child(child(node, 'nvPicPr'), 'nvPr'), 'ph')
    const xfrm = child(child(node, 'spPr'), 'xfrm')
    if (ph && xfrm) {
      const off = child(xfrm, 'off')
      const ext = child(xfrm, 'ext')
      const width = (numAttr(ext, 'cx') ?? 0) / EMU_PER_PT
      const height = (numAttr(ext, 'cy') ?? 0) / EMU_PER_PT
      const type = attr(ph, 'type')
      if ((type === 'pic' || type === 'clipArt') && width > 1 && height > 1) {
        found.push({
          type,
          idx: attr(ph, 'idx'),
          x: (numAttr(off, 'x') ?? 0) / EMU_PER_PT,
          y: (numAttr(off, 'y') ?? 0) / EMU_PER_PT,
          width,
          height
        })
      }
    }
    for (const [key, value] of entries(node)) {
      if (key.startsWith('@_')) continue
      for (const item of asArray(value)) walk(item)
    }
  }
  walk(doc)
  return found
}

async function layoutBoxes(zip: JSZip, slidePath: string): Promise<Box[]> {
  const rels = await xml(zip, slidePath.replace(/([^/]+)$/, '_rels/$1.rels'))
  const relationships = asArray(child(rels, 'Relationships')).flatMap((root) =>
    asArray(child(root, 'Relationship'))
  )
  const layoutRel = relationships.find((item) => (attr(item, 'Type') ?? '').endsWith('/slideLayout'))
  const layoutTarget = attr(layoutRel, 'Target')
  if (!layoutTarget) return []
  const layoutPath = resolveZipPath(slidePath, layoutTarget)
  const layout = await xml(zip, layoutPath)
  const fromLayout = pictureBoxes(layout)
  if (fromLayout.length > 0) return fromLayout
  const layoutRels = await xml(zip, layoutPath.replace(/([^/]+)$/, '_rels/$1.rels'))
  const masterRel = asArray(child(layoutRels, 'Relationships'))
    .flatMap((root) => asArray(child(root, 'Relationship')))
    .find((item) => (attr(item, 'Type') ?? '').endsWith('/slideMaster'))
  const masterTarget = attr(masterRel, 'Target')
  if (!masterTarget) return []
  return pictureBoxes(await xml(zip, resolveZipPath(layoutPath, masterTarget)))
}

function needsFrame(element: PlacedImage): boolean {
  return element.type === 'image' && (element.size.width < 1 || element.size.height < 1)
}

/** Picture placeholders often omit xfrm on the slide and inherit it from the layout. */
export async function applyPicturePlaceholderFrames(
  bytes: ArrayBuffer | Uint8Array,
  slides: { elements: PlacedImage[] }[]
): Promise<void> {
  const zip = await JSZip.loadAsync(bytes)
  const paths = await slidePaths(zip)
  for (let index = 0; index < slides.length; index += 1) {
    const path = paths[index]
    if (!path) continue
    const boxes = await layoutBoxes(zip, path)
    if (boxes.length === 0) continue
    let cursor = 0
    for (const element of slides[index].elements) {
      if (!needsFrame(element)) continue
      const box = boxes[cursor] ?? boxes[boxes.length - 1]
      if (!box) continue
      element.position = { x: box.x, y: box.y }
      element.size = { width: box.width, height: box.height }
      if (boxes[cursor]) cursor += 1
    }
  }
}
