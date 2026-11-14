import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { join } from 'path'
import type { ProjectionStageState, ProjectionWirePayload } from '../shared/projection-mixer'
import type { ProjectionTextStyle, ProjectionTypography } from '../shared/projection-typography'

export type NativeDisplay = {
  id: number
  x: number
  y: number
  width: number
  height: number
  topmost?: boolean
}

type NativeSlide = {
  animation: string
  durationMs: number
  imagePath: string
  fit: 'cover' | 'contain'
  dim: number
  color: string
  title: string
  lines: string[]
  footer: string
  highlight: number
  kind: string
  bodyFont?: string
  titleFont?: string
  footerFont?: string
  bodyPx?: number
  titlePx?: number
  footerPx?: number
  bodyColor?: string
  titleColor?: string
  footerColor?: string
}

let child: ChildProcessWithoutNullStreams | null = null
let failed = false

export function nativeOutputRequested(): boolean {
  return process.env.ORION_NATIVE_OUTPUT !== '0'
}

export function stageUsesNativeOutput(state: ProjectionStageState): boolean {
  return payloadSupported(state.base) && payloadSupported(state.overlay)
}

function payloadSupported(payload: ProjectionWirePayload | null): boolean {
  if (!payload) return true
  // Text slides stay on the Electron projection page so fonts, layout, and previews match settings.
  return payload.type === 'image'
}

function helperPath(): string | null {
  const name = process.platform === 'win32' ? 'orion-output.exe' : 'orion-output'
  const candidates = [
    join(process.cwd(), 'output-helper', 'target', 'release', name),
    join(process.cwd(), 'output-helper', 'target', 'debug', name),
    join(process.resourcesPath, name)
  ]
  return candidates.find((path) => existsSync(path)) ?? null
}

function ensureHelper(): ChildProcessWithoutNullStreams | null {
  if (failed) return null
  if (child && !child.killed && child.exitCode === null) return child
  const binary = helperPath()
  if (!binary) {
    console.error('orion-output: helper binary is not built')
    failed = true
    return null
  }
  try {
    child = spawn(binary, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  } catch (error) {
    console.error('orion-output: spawn failed', error)
    failed = true
    return null
  }
  child.stdout.on('data', () => {
    /* reserved for preview frames */
  })
  child.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim()
    if (text) console.error(text)
  })
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`orion-output: exited ${code}`)
    child = null
  })
  return child
}

function send(message: unknown): boolean {
  const proc = ensureHelper()
  if (!proc) return false
  try {
    proc.stdin.write(`${JSON.stringify(message)}\n`)
    return true
  } catch (error) {
    console.error('orion-output: write failed', error)
    failed = true
    return false
  }
}

export function presentNativeStage(
  displays: NativeDisplay[],
  state: ProjectionStageState,
  typography: ProjectionTypography
): Promise<boolean> {
  if (!nativeOutputRequested() || displays.length === 0) return Promise.resolve(false)
  if (!stageUsesNativeOutput(state)) return Promise.resolve(false)
  const proc = ensureHelper()
  if (!proc) return Promise.resolve(false)
  const ready = waitForMarker(proc)
  const configured = write(proc, { op: 'configure', displays })
  const staged = configured && write(proc, {
    op: 'stage',
    base: toSlide(state.base, typography),
    overlay: toSlide(state.overlay, typography)
  })
  if (!staged) return Promise.resolve(false)
  return ready
}

function waitForMarker(proc: ChildProcessWithoutNullStreams): Promise<boolean> {
  return new Promise((resolve) => {
    let pending = ''
    const finish = (ok: boolean): void => {
      clearTimeout(timer)
      proc.stdout.off('data', onData)
      proc.off('exit', onExit)
      resolve(ok)
    }
    const onData = (chunk: Buffer): void => {
      pending += chunk.toString()
      if (pending.includes('shown')) finish(true)
      else if (pending.includes('failed')) finish(false)
    }
    const onExit = (): void => finish(false)
    const timer = setTimeout(() => finish(false), 1500)
    proc.stdout.on('data', onData)
    proc.once('exit', onExit)
  })
}

function write(proc: ChildProcessWithoutNullStreams, message: unknown): boolean {
  try {
    proc.stdin.write(`${JSON.stringify(message)}\n`)
    return true
  } catch (error) {
    console.error('orion-output: write failed', error)
    failed = true
    return false
  }
}

export function hideNativeOutput(): void {
  if (!child) return
  send({ op: 'hide' })
}

export function shutdownNativeOutput(): void {
  if (!child) return
  send({ op: 'quit' })
  const proc = child
  child = null
  setTimeout(() => {
    if (proc.exitCode === null) proc.kill()
  }, 400)
}

function toSlide(payload: ProjectionWirePayload | null, typography: ProjectionTypography): NativeSlide | null {
  if (!payload) return null
  switch (payload.type) {
    case 'image':
      return {
        animation: payload.animation || 'cut',
        durationMs: payload.durationMs || 0,
        imagePath: payload.filePath,
        fit: 'contain',
        dim: 0,
        color: '#000000',
        title: '',
        lines: [],
        footer: '',
        highlight: -1,
        kind: 'image'
      }
    case 'hymn':
      return styled(
        {
          animation: payload.animation || 'cut',
          durationMs: payload.durationMs || 0,
          ...backdrop(payload),
          title: [payload.number ? String(payload.number) : '', payload.title].filter(Boolean).join('  '),
          lines: payload.lines,
          footer: payload.author || '',
          highlight: -1,
          kind: 'hymn'
        },
        typography.hymns.number,
        typography.hymns.lyrics,
        typography.hymns.author
      )
    case 'bible':
      return styled(
        {
          animation: payload.animation || 'cut',
          durationMs: payload.durationMs || 0,
          ...backdrop(payload),
          title: payload.locationLabel || payload.reference,
          lines: payload.verses.map((verse) => `${verse.number}  ${verse.text}`),
          footer: payload.translationLabel,
          highlight: payload.verses.findIndex((verse) => verse.number === payload.highlightVerse),
          kind: 'bible'
        },
        typography.bible.reference,
        typography.bible.verse,
        typography.bible.translation
      )
    case 'dictionary':
      return styled(
        {
          animation: 'cut',
          durationMs: 0,
          ...backdrop(payload),
          title: [payload.strongs, payload.lemma].filter(Boolean).join('  '),
          lines: [payload.transliteration, payload.gloss, payload.partOfSpeech, payload.definition].filter(
            (line): line is string => Boolean(line)
          ),
          footer: payload.language,
          highlight: -1,
          kind: 'dictionary'
        },
        typography.dictionary.lemma,
        typography.dictionary.definition,
        typography.dictionary.details
      )
    default:
      return null
  }
}

function styled(
  slide: NativeSlide,
  title: ProjectionTextStyle,
  body: ProjectionTextStyle,
  footer: ProjectionTextStyle
): NativeSlide {
  return {
    ...slide,
    titleFont: title.fontId,
    titlePx: title.sizePx,
    titleColor: title.color,
    bodyFont: body.fontId,
    bodyPx: body.sizePx,
    bodyColor: body.color,
    footerFont: footer.fontId,
    footerPx: footer.sizePx,
    footerColor: footer.color
  }
}

function backdrop(payload: {
  backgroundMediaUrl?: string
  backgroundDimOpacity?: number
  backgroundFit?: 'cover' | 'contain'
  backgroundColor?: string
}): Pick<NativeSlide, 'imagePath' | 'fit' | 'dim' | 'color'> {
  return {
    imagePath: mediaPath(payload.backgroundMediaUrl),
    dim: Math.min(95, Math.max(0, payload.backgroundDimOpacity ?? 0)) / 100,
    fit: payload.backgroundFit === 'contain' ? 'contain' : 'cover',
    color: payload.backgroundColor || '#000000'
  }
}

function mediaPath(value: string | undefined): string {
  if (!value) return ''
  if (value.startsWith('orion-file:')) {
    try {
      const pathname = decodeURIComponent(new URL(value).pathname)
      return process.platform === 'win32' ? pathname.replace(/^\//, '') : pathname
    } catch {
      return ''
    }
  }
  if (value.startsWith('file:')) {
    try {
      return fileURLToPath(value)
    } catch {
      return ''
    }
  }
  return value
}
