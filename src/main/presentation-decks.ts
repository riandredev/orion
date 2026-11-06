import { BrowserWindow, dialog } from 'electron'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises'
import { basename, extname, join, resolve } from 'path'
import JSZip from 'jszip'
import { listPackageMedia, readPptxCues, type PptxSlideCue } from '../shared/pptx-cues'
import { createCanvas } from '@napi-rs/canvas'
import type {
  PresentationDeckDetail,
  PresentationDeckSummary,
  PresentationImportProgress,
  PresentationImportResult,
  PresentationSlideInfo
} from '../shared/presentation-deck-types'
import { presentationsRoot } from './paths'
import { isPathUnderRoot } from './projection-paths'
import { resolveSofficeForPresentationImport } from './presentation-import-deps'

const DECK_EXT = new Set(['.pptx', '.key'])
const MANIFEST = 'manifest.json'
/** Target width for slide PNGs (re-import to refresh existing decks). */
const SLIDE_WIDTH = 2560
const PDF_EXPORT_FILTER =
  'pdf:impress_pdf_Export:Quality=100:ReduceImageResolution=false:MaxImageResolution=300'

type DeckManifest = {
  version: 1 | 2
  id: string
  title: string
  sourceFileName: string
  sourceExt: string
  importedAt: string
  slideCount: number
  slideFiles: string[]
  cues?: PptxSlideCue[]
}

function deckDir(id: string): string {
  return join(presentationsRoot(), id)
}

function broadcastImportProgress(progress: PresentationImportProgress): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.webContents.send('orion:presentation-import-progress', progress)
  }
}

function manifestPath(id: string): string {
  return join(deckDir(id), MANIFEST)
}

function titleFromFileName(fileName: string): string {
  const ext = extname(fileName)
  return basename(fileName, ext).replace(/[-_]+/g, ' ').trim() || 'Presentation'
}

async function findSofficeExecutable(): Promise<string | null> {
  return resolveSofficeForPresentationImport()
}

async function runSofficeConvert(sourcePath: string, outDir: string): Promise<void> {
  const soffice = await findSofficeExecutable()
  if (!soffice) {
    throw new Error('Presentation import components are not installed.')
  }

  const tryConvert = (convertTo: string): Promise<void> =>
    new Promise((resolvePromise, reject) => {
      const child = spawn(
        soffice,
        ['--headless', '--norestore', '--convert-to', convertTo, '--outdir', outDir, sourcePath],
        { windowsHide: true }
      )
      let stderr = ''
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })
      child.on('error', (err) => {
        reject(err)
      })
      child.on('close', (code) => {
        if (code === 0) {
          resolvePromise()
          return
        }
        reject(new Error(stderr.trim() || `LibreOffice exited with code ${code ?? 'unknown'}`))
      })
    })

  try {
    await tryConvert(PDF_EXPORT_FILTER)
  } catch {
    await tryConvert('pdf')
  }
}

async function renderPdfToPngSlides(pdfPath: string, outDir: string): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(await readFile(pdfPath))
  const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true })
  const doc = await loadingTask.promise
  const slideFiles: string[] = []
  const slideCount = doc.numPages
  for (let pageNum = 1; pageNum <= slideCount; pageNum += 1) {
    broadcastImportProgress({
      phase: 'rendering',
      percent: Math.round((pageNum / slideCount) * 100),
      message: 'Rendering slides…',
      slideIndex: pageNum,
      slideCount
    })
    const page = await doc.getPage(pageNum)
    const baseViewport = page.getViewport({ scale: 1 })
    const scale = SLIDE_WIDTH / baseViewport.width
    const viewport = page.getViewport({ scale })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const context = canvas.getContext('2d')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
      intent: 'print',
      canvas: canvas as unknown as HTMLCanvasElement
    }).promise
    const fileName = `slide-${String(pageNum).padStart(3, '0')}.png`
    await writeFile(join(outDir, fileName), canvas.toBuffer('image/png'))
    slideFiles.push(fileName)
  }

  return slideFiles
}

function detailFromManifest(manifest: DeckManifest): PresentationDeckDetail {
  const dir = deckDir(manifest.id)
  const slides: PresentationSlideInfo[] = manifest.slideFiles.map((file, index) => ({
    index,
    name: `Slide ${index + 1}`,
    path: join(dir, file)
  }))
  const coverPath = slides[0]?.path || undefined
  const sourcePath = join(dir, manifest.sourceFileName)
  const liveExt = manifest.sourceExt === '.pptx' || manifest.sourceExt === '.key'
  const engine = liveExt && existsSync(sourcePath) ? 'live' : 'raster'
  const liveSlides: PresentationSlideInfo[] =
    engine === 'live'
      ? Array.from({ length: manifest.slideCount }, (_, index) => ({
          index,
          name: `Slide ${index + 1}`,
          path: ''
        }))
      : slides
  return {
    id: manifest.id,
    title: manifest.title,
    slideCount: engine === 'live' ? manifest.slideCount : manifest.slideCount,
    importedAt: manifest.importedAt,
    sourceExt: manifest.sourceExt,
    coverPath: engine === 'live' ? undefined : coverPath,
    sourcePath,
    engine,
    cues: manifest.cues,
    slides: liveSlides
  }
}

async function readManifest(id: string): Promise<DeckManifest | null> {
  try {
    const raw = await readFile(manifestPath(id), 'utf8')
    const parsed = JSON.parse(raw) as DeckManifest
    if ((parsed.version !== 1 && parsed.version !== 2) || !Array.isArray(parsed.slideFiles)) return null
    return parsed
  } catch {
    return null
  }
}

export async function listPresentationDecks(): Promise<PresentationDeckSummary[]> {
  const root = presentationsRoot()
  await mkdir(root, { recursive: true })
  let entries: string[] = []
  try {
    entries = await readdir(root)
  } catch {
    return []
  }
  const decks: PresentationDeckSummary[] = []
  for (const entry of entries) {
    const manifest = await readManifest(entry)
    if (!manifest) continue
    decks.push({
      id: manifest.id,
      title: manifest.title,
      slideCount: manifest.slideCount,
      importedAt: manifest.importedAt,
      sourceExt: manifest.sourceExt,
      coverPath:
        manifest.slideFiles[0] != null
          ? join(deckDir(manifest.id), manifest.slideFiles[0])
          : undefined
    })
  }
  decks.sort((a, b) => b.importedAt.localeCompare(a.importedAt))
  return decks
}

export async function getPresentationDeck(deckId: string): Promise<PresentationDeckDetail | null> {
  const manifest = await readManifest(deckId)
  if (!manifest) return null
  return detailFromManifest(manifest)
}

function isDeckId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

export async function removePresentationDeck(deckId: string): Promise<boolean> {
  if (!isDeckId(deckId)) return false
  const root = presentationsRoot()
  let dir = join(root, deckId)
  if (!existsSync(dir)) {
    const entries = await readdir(root).catch(() => [] as string[])
    for (const entry of entries) {
      const manifest = await readManifest(entry)
      if (manifest?.id === deckId) {
        dir = deckDir(entry)
        break
      }
    }
  }
  if (!existsSync(dir)) return true
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  return !existsSync(dir)
}

export async function importPresentationDeckFromDialog(): Promise<PresentationImportResult> {
  const res = await dialog.showOpenDialog({
    title: 'Import presentation',
    properties: ['openFile'],
    filters: [
      { name: 'Presentations', extensions: ['pptx', 'key'] },
      { name: 'All files', extensions: ['*'] }
    ]
  })
  if (res.canceled || !res.filePaths[0]) {
    return { ok: false, message: 'Import canceled.' }
  }
  const sourcePath = resolve(res.filePaths[0])
  const ext = extname(sourcePath).toLowerCase()
  if (!DECK_EXT.has(ext)) {
    return {
      ok: false,
      message: 'Use a .pptx or .key file. Legacy .ppt must be saved as PowerPoint (.pptx) first.'
    }
  }

  const id = randomUUID()
  const dir = deckDir(id)
  await mkdir(dir, { recursive: true })

  const sourceFileName = `${basename(sourcePath, ext).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80)}${ext}`
  const copiedSource = join(dir, sourceFileName)
  await copyFile(sourcePath, copiedSource)

  try {
    broadcastImportProgress({
      phase: 'converting',
      message: 'Reading presentation…'
    })
    const bytes = await readFile(copiedSource)
    const mediaDir = join(dir, 'media')
    await mkdir(mediaDir, { recursive: true })
    const zip = await JSZip.loadAsync(bytes)
    const mediaPaths = await listPackageMedia(bytes)
    for (const mediaPath of mediaPaths) {
      const file = zip.file(mediaPath)
      if (!file) continue
      const base = mediaPath.split('/').pop()
      if (!base) continue
      await writeFile(join(mediaDir, base), await file.async('nodebuffer'))
    }

    let slideCount = 0
    let cues: PptxSlideCue[] | undefined
    if (ext === '.pptx') {
      const sheet = await readPptxCues(bytes)
      slideCount = sheet.slideCount
      cues = sheet.slides
    } else {
      zip.forEach((path) => {
        if (/slide/i.test(path) && path.endsWith('.iwa')) slideCount += 1
      })
    }
    if (slideCount === 0) {
      throw new Error('The presentation has no slides.')
    }

    const manifest: DeckManifest = {
      version: 2,
      id,
      title: titleFromFileName(basename(sourcePath)),
      sourceFileName,
      sourceExt: ext,
      importedAt: new Date().toISOString(),
      slideCount,
      slideFiles: [],
      cues
    }
    await writeFile(manifestPath(id), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    broadcastImportProgress({
      phase: 'rendering',
      percent: 100,
      message: 'Presentation ready.'
    })
    return { ok: true, deck: detailFromManifest(manifest) }
  } catch (err) {
    await rm(dir, { recursive: true, force: true })
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Could not read the presentation.'
    }
  }
}

export async function readPresentationDeckSource(
  deckId: string
): Promise<{ bytes: Uint8Array; mediaDir: string; mediaFiles: string[] } | null> {
  const manifest = await readManifest(deckId)
  if (!manifest) return null
  const sourcePath = join(deckDir(deckId), manifest.sourceFileName)
  if (!existsSync(sourcePath)) return null
  const bytes = await readFile(sourcePath)
  const mediaDir = join(deckDir(deckId), 'media')
  let mediaFiles: string[] = []
  try {
    mediaFiles = (await readdir(mediaDir)).filter((name) => !name.startsWith('.'))
  } catch {
    mediaFiles = []
  }
  return { bytes, mediaDir, mediaFiles }
}

export function presentationDeckSlidePathAllowed(filePath: string): boolean {
  return isPathUnderRoot(filePath, presentationsRoot())
}
