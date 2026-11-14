import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { join } from 'path'
import type { ProjectionStageState, ProjectionWirePayload } from '../shared/projection-mixer'

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
  return payload.type === 'image' || payload.type === 'bible' || payload.type === 'hymn' || payload.type === 'dictionary'
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

export function presentNativeStage(displays: NativeDisplay[], state: ProjectionStageState): boolean {
  if (!nativeOutputRequested() || displays.length === 0) return false
  if (!stageUsesNativeOutput(state)) return false
  if (!send({ op: 'configure', displays })) return false
  return send({
    op: 'stage',
    base: toSlide(state.base),
    overlay: toSlide(state.overlay)
  })
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

function toSlide(payload: ProjectionWirePayload | null): NativeSlide | null {
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
      return {
        animation: payload.animation || 'cut',
        durationMs: payload.durationMs || 0,
        ...backdrop(payload),
        title: [payload.number ? String(payload.number) : '', payload.title].filter(Boolean).join('  '),
        lines: payload.lines,
        footer: payload.author || '',
        highlight: -1,
        kind: 'hymn'
      }
    case 'bible':
      return {
        animation: payload.animation || 'cut',
        durationMs: payload.durationMs || 0,
        ...backdrop(payload),
        title: payload.locationLabel || payload.reference,
        lines: payload.verses.map((verse) => `${verse.number}  ${verse.text}`),
        footer: payload.translationLabel,
        highlight: payload.verses.findIndex((verse) => verse.number === payload.highlightVerse),
        kind: 'bible'
      }
    case 'dictionary':
      return {
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
      }
    default:
      return null
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
