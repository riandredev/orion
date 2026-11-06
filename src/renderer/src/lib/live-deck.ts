import { parse, type ImageElement, type Presentation, type SlideElement } from '@pagus-kit/core'
import { buildFontSubstitutes, generateFontCss, renderSlide } from '@pagus-kit/renderer'
import { parseIworkDocument, type IworkScene, type IworkVisualObject } from 'iwork-viewer'
import { applyPicturePlaceholderFrames } from '../../../shared/pptx-picture-frames'
import { readPptxCues, type PptxSlideCue } from '../../../shared/pptx-cues'
import { normalizeSlideBullets, pinDefaultTextColor, type BulletHost } from '../../../shared/slide-bullets'

export type LiveMedia = {
  kind: 'video' | 'audio'
  src: string
  leftPct: number
  topPct: number
  widthPct: number
  heightPct: number
}

export type LiveFrame = {
  markup: string
  width: number
  height: number
  transition: string
  durationMs: number
  dir?: 'l' | 'r' | 'u' | 'd'
  media: LiveMedia[]
  stepCount: number
  notes: string
}

export type DeckSource = {
  bytes: Uint8Array
  mediaDir: string
  mediaFiles: string[]
  cues?: PptxSlideCue[]
  ext: string
}

type PptxSession = {
  kind: 'pptx'
  presentation: Presentation
  fontSubstitutes: Record<string, string>
  fontCss: string
  cues: PptxSlideCue[]
  mediaDir: string
}

type KeySession = {
  kind: 'key'
  scenes: IworkScene[]
  mediaDir: string
  mediaFiles: string[]
  blobs: Map<string, string>
}

export type LiveSession = PptxSession | KeySession

function fileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
  return `file:///${normalized.replace(/^\//, '')}`
}

function joinPath(dir: string, name: string): string {
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/'
  return `${dir.replace(/[\\/]$/, '')}${sep}${name}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

function embeddedFontCss(fonts: Presentation['fonts']): string {
  return fonts.embeddedFonts
    .flatMap((font) => {
      if (!font.data || font.data.byteLength === 0) return []
      const mime = font.contentType || 'font/ttf'
      const format = /otf|opentype/i.test(mime) ? 'opentype' : 'truetype'
      const family = font.familyName.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      return [
        `@font-face{font-family:'${family}';font-style:${font.italic ? 'italic' : 'normal'};font-weight:${font.weight || 400};src:url(data:${mime};base64,${bytesToBase64(font.data)}) format('${format}');}`
      ]
    })
    .join('\n')
}

function eachImage(elements: SlideElement[], visit: (image: ImageElement) => void): void {
  for (const element of elements) {
    if (element.type === 'image') visit(element)
    else if (element.type === 'group') eachImage(element.children, visit)
  }
}

function isMetafile(image: ImageElement): boolean {
  const type = image.contentType.toLowerCase()
  return type.includes('emf') || type.includes('wmf')
}

async function imagePayload(src: string): Promise<string | null> {
  try {
    if (src.startsWith('data:')) {
      const comma = src.indexOf(',')
      return comma >= 0 ? src.slice(comma + 1) : null
    }
    if (!src.startsWith('blob:')) return null
    const response = await fetch(src)
    const bytes = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
    }
    return btoa(binary)
  } catch {
    return null
  }
}

function rasterizeApi(): ((items: string[]) => Promise<(string | null)[]>) | null {
  if (window.orion?.rasterizeMetafiles) return window.orion.rasterizeMetafiles.bind(window.orion)
  if (window.orionPresenter?.rasterizeMetafiles) {
    return window.orionPresenter.rasterizeMetafiles.bind(window.orionPresenter)
  }
  return null
}

async function rasterizeMetafileImages(slides: Presentation['slides']): Promise<void> {
  const groups = new Map<string, ImageElement[]>()
  const images: ImageElement[] = []
  for (const slide of slides) eachImage(slide.elements, (image) => images.push(image))
  for (const image of images) {
    if (!isMetafile(image)) continue
    const payload = await imagePayload(image.src)
    if (!payload) continue
    const group = groups.get(payload) ?? []
    group.push(image)
    groups.set(payload, group)
  }
  const payloads = [...groups.keys()]
  if (payloads.length === 0) return
  const api = rasterizeApi()
  if (!api) return
  const pngs = await api(payloads)
  payloads.forEach((payload, index) => {
    const png = pngs[index]
    if (!png) return
    const src = `data:image/png;base64,${png}`
    for (const image of groups.get(payload) ?? []) {
      image.src = src
      image.contentType = 'image/png'
    }
  })
}

export async function openLiveSession(source: DeckSource): Promise<LiveSession> {
  const bytes = source.bytes.buffer.slice(
    source.bytes.byteOffset,
    source.bytes.byteOffset + source.bytes.byteLength
  ) as ArrayBuffer
  if (source.ext === '.key') {
    const doc = await parseIworkDocument(bytes)
    return {
      kind: 'key',
      scenes: doc.scenes,
      mediaDir: source.mediaDir,
      mediaFiles: source.mediaFiles,
      blobs: new Map()
    }
  }
  const presentation = await parse(bytes)
  for (const slide of presentation.slides) {
    normalizeSlideBullets(slide.elements as unknown as BulletHost[])
  }
  await applyPicturePlaceholderFrames(bytes, presentation.slides)
  try {
    await rasterizeMetafileImages(presentation.slides)
  } catch {
    /* A metafile that cannot be rasterized stays out of the slide. */
  }
  const fontSubstitutes = buildFontSubstitutes(presentation.fonts)
  const fontCss = `${embeddedFontCss(presentation.fonts)}\n${generateFontCss(presentation.fonts, { useGoogleFonts: false }).css}`
  const cues = source.cues ?? (await readPptxCues(bytes)).slides
  return {
    kind: 'pptx',
    presentation,
    fontSubstitutes,
    fontCss,
    cues,
    mediaDir: source.mediaDir
  }
}

export function liveSlideCount(session: LiveSession): number {
  return session.kind === 'pptx' ? session.presentation.slides.length : session.scenes.length
}

function hiddenIds(slide: Presentation['slides'][number], step: number): string[] {
  const animations = slide.animations
  if (!animations) return []
  const hidden = new Set(animations.hiddenShapeIds)
  for (let index = 0; index < step; index += 1) {
    for (const effect of animations.steps[index]?.effects ?? []) {
      if (effect.animClass === 'entrance') hidden.delete(effect.targetId)
      if (effect.animClass === 'exit') hidden.add(effect.targetId)
    }
  }
  return [...hidden]
}

function pptxMedia(session: PptxSession, index: number): LiveMedia[] {
  const cue = session.cues[index]
  if (!cue) return []
  return cue.media.map((media) => ({
    kind: media.kind,
    src: fileUrl(joinPath(session.mediaDir, media.fileName)),
    leftPct: media.leftPct,
    topPct: media.topPct,
    widthPct: media.widthPct,
    heightPct: media.heightPct
  }))
}

function renderKeyScene(session: KeySession, scene: IworkScene): string {
  const width = scene.width || 1920
  const height = scene.height || 1080
  const blocks = scene.blocks
    .map((block) => {
      const style = [
        'position:absolute',
        `left:${(block.x / width) * 100}%`,
        `top:${(block.y / height) * 100}%`,
        `width:${(block.width / width) * 100}%`,
        `height:${(block.height / height) * 100}%`,
        `font-size:${block.fontSize ?? 24}px`,
        `color:${block.color ?? '#111'}`,
        `text-align:${block.align ?? 'left'}`,
        block.bold ? 'font-weight:700' : '',
        'overflow:hidden'
      ]
        .filter(Boolean)
        .join(';')
      return `<div style="${style}">${escapeHtml(block.text)}</div>`
    })
    .join('')
  const objects = scene.objects
    .filter((object) => object.kind !== 'media')
    .map((object) => objectMarkup(session, object, width, height))
    .join('')
  return `<div class="key-scene" style="position:relative;width:100%;height:100%;background:#fff">${objects}${blocks}</div>`
}

function objectMarkup(
  session: KeySession,
  object: IworkVisualObject,
  width: number,
  height: number
): string {
  const style = `position:absolute;left:${(object.x / width) * 100}%;top:${(object.y / height) * 100}%;width:${(object.width / width) * 100}%;height:${(object.height / height) * 100}%`
  if (object.kind === 'image' && object.bytes) {
    const key = object.id
    let url = session.blobs.get(key)
    if (!url) {
      const copy = new Uint8Array(object.bytes.byteLength)
      copy.set(object.bytes)
      url = URL.createObjectURL(new Blob([copy], { type: object.mimeType || 'image/png' }))
      session.blobs.set(key, url)
    }
    return `<img alt="" src="${url}" style="${style};object-fit:contain" />`
  }
  if (object.text) {
    return `<div style="${style}">${escapeHtml(object.text)}</div>`
  }
  return ''
}

function keyMedia(session: KeySession, scene: IworkScene): LiveMedia[] {
  const files = session.mediaFiles.filter((name) => /\.(mp4|m4v|mov|webm|mp3|m4a|wav)$/i.test(name))
  const boxes = scene.objects.filter((object) => object.kind === 'media')
  const width = scene.width || 1
  const height = scene.height || 1
  return boxes.map((object, index): LiveMedia => {
    const fileName = files[index]
    const kind = fileName && /\.(mp3|m4a|wav)$/i.test(fileName) ? 'audio' : 'video'
    return {
      kind,
      src: fileName ? fileUrl(joinPath(session.mediaDir, fileName)) : '',
      leftPct: (object.x / width) * 100,
      topPct: (object.y / height) * 100,
      widthPct: (object.width / width) * 100,
      heightPct: (object.height / height) * 100
    }
  }).filter((media) => media.src)
}

export function frameFor(session: LiveSession, index: number, step: number): LiveFrame | null {
  if (session.kind === 'key') {
    const scene = session.scenes[index]
    if (!scene) return null
    return {
      markup: renderKeyScene(session, scene),
      width: scene.width || 1920,
      height: scene.height || 1080,
      transition: 'fade',
      durationMs: 400,
      dir: undefined,
      media: keyMedia(session, scene),
      stepCount: 1,
      notes: scene.notes.join('\n')
    }
  }
  const slide = session.presentation.slides[index]
  if (!slide) return null
  const rendered = renderSlide(slide, session.presentation.slideSize, {
    fontSubstitutes: session.fontSubstitutes,
    fontCss: session.fontCss,
    hiddenShapeIds: hiddenIds(slide, step)
  })
  const cue = session.cues[index]
  const slideType = slide.transition?.type
  const cueType = cue?.transition
  const transition =
    slideType && slideType !== 'none' ? slideType : cueType && cueType !== 'none' ? cueType : 'none'
  const durationMs =
    slide.transition?.duration ||
    cue?.durationMs ||
    (transition === 'none' || transition === 'cut' ? 0 : 500)
  const dir = slide.transition?.direction ?? cue?.dir
  const steps = slide.animations?.steps.length ?? 0
  return {
    markup: pinDefaultTextColor(rendered.svg),
    width: rendered.width,
    height: rendered.height,
    transition,
    durationMs,
    dir,
    media: pptxMedia(session, index),
    stepCount: Math.max(1, steps + 1),
    notes: ''
  }
}

let active: { deckId: string; session: LiveSession } | null = null
const sessionCache = new Map<string, Promise<LiveSession>>()
const resolvedSessions = new Map<string, LiveSession>()
const frameCache = new Map<string, LiveFrame>()
const sourceCache = new Map<string, Promise<{ bytes: Uint8Array; mediaDir: string; mediaFiles: string[] } | null>>()

type FrameJob = { priority: number; run: () => void }
const frameQueue: FrameJob[] = []
const frameInflight = new Map<string, Promise<LiveFrame | null>>()
let framePumping = false

function frameCacheKey(deckId: string, index: number, step: number): string {
  return `${deckId}:${index}:${step}`
}

export function renderCachedFrame(deckId: string, index: number, step: number): LiveFrame | null {
  const session = resolvedSessions.get(deckId)
  if (!session) return null
  return storeFrame(deckId, session, index, step)
}

export function peekCachedFrame(deckId: string, index: number, step: number): LiveFrame | null {
  return frameCache.get(frameCacheKey(deckId, index, step)) ?? null
}

export function getLiveSession(deckId: string): LiveSession | null {
  return resolvedSessions.get(deckId) ?? null
}

export function rememberSession(deckId: string, session: LiveSession): void {
  active = { deckId, session }
  resolvedSessions.set(deckId, session)
}

export function forgetLiveSession(deckId: string): void {
  sessionCache.delete(deckId)
  resolvedSessions.delete(deckId)
  sourceCache.delete(deckId)
  const prefix = `${deckId}:`
  for (const key of frameCache.keys()) {
    if (key.startsWith(prefix)) frameCache.delete(key)
  }
  if (active?.deckId === deckId) active = null
}

export function loadDeckBytes(
  deckId: string,
  read: () => Promise<{ bytes: Uint8Array; mediaDir: string; mediaFiles: string[] } | null>
): Promise<{ bytes: Uint8Array; mediaDir: string; mediaFiles: string[] } | null> {
  const cached = sourceCache.get(deckId)
  if (cached) return cached
  const pending = read().then((source) => {
    if (!source && sourceCache.get(deckId) === pending) sourceCache.delete(deckId)
    return source
  })
  sourceCache.set(deckId, pending)
  return pending
}

function storeFrame(deckId: string, session: LiveSession, index: number, step: number): LiveFrame | null {
  const key = frameCacheKey(deckId, index, step)
  const hit = frameCache.get(key)
  if (hit) return hit
  const frame = frameFor(session, index, step)
  if (frame) frameCache.set(key, frame)
  return frame
}

function pumpFrames(): void {
  if (framePumping) return
  framePumping = true
  const step = (): void => {
    const job = frameQueue.shift()
    if (!job) {
      framePumping = false
      return
    }
    job.run()
    const schedule =
      window.requestIdleCallback ??
      ((callback: IdleRequestCallback): number => window.setTimeout(() => callback({} as IdleDeadline), 16))
    schedule(() => step(), { timeout: 120 })
  }
  step()
}

/** Renders a slide when the UI is idle. Lower priority runs first. The current slide should use 0. */
export function scheduleFrame(
  deckId: string,
  session: LiveSession,
  index: number,
  step: number,
  priority: number
): Promise<LiveFrame | null> {
  const hit = peekCachedFrame(deckId, index, step)
  if (hit) return Promise.resolve(hit)
  const key = frameCacheKey(deckId, index, step)
  const pending = frameInflight.get(key)
  if (pending) return pending
  const promise = new Promise<LiveFrame | null>((resolve) => {
    frameQueue.push({
      priority,
      run: () => {
        if (!resolvedSessions.has(deckId)) {
          resolve(null)
          return
        }
        resolve(storeFrame(deckId, session, index, step))
      }
    })
    frameQueue.sort((a, b) => a.priority - b.priority)
    pumpFrames()
  })
  frameInflight.set(key, promise)
  void promise.finally(() => {
    if (frameInflight.get(key) === promise) frameInflight.delete(key)
  })
  return promise
}

/** Parses the selected deck and draws its slides in the background so opening the tab stays quick. */
export function warmLiveDeck(deckId: string, source: DeckSource, firstIndex = 0): void {
  void loadLiveSession(deckId, source).then((session) => {
    const count = liveSlideCount(session)
    if (count <= 0) return
    const first = Math.min(Math.max(0, firstIndex), count - 1)
    void scheduleFrame(deckId, session, first, 0, 0)
    for (let index = 0; index < count; index += 1) {
      if (index === first) continue
      void scheduleFrame(deckId, session, index, 0, 10 + index)
    }
  })
}

export function loadLiveSession(deckId: string, source: DeckSource): Promise<LiveSession> {
  const cached = sessionCache.get(deckId)
  if (cached) return cached
  const pending = openLiveSession(source).then((session) => {
    rememberSession(deckId, session)
    return session
  })
  sessionCache.set(deckId, pending)
  pending.catch(() => {
    if (sessionCache.get(deckId) === pending) sessionCache.delete(deckId)
  })
  return pending
}

export function activeFrame(deckId: string, index: number, step: number): LiveFrame | null {
  const session = resolvedSessions.get(deckId)
  if (!session) return null
  return storeFrame(deckId, session, index, step)
}
