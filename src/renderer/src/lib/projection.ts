import type { OrionProjectionPayload } from '../../../shared/projection'
import type {
  OrderImageAnimation,
  OrionProjectionCommand,
  OrionStackLayerContent,
  OrionStackSource
} from '../../../shared/projection-stack'
import {
  emptyPresentationUiState,
  optimisticProgramPatch,
  type PresentationUiState
} from '../../../shared/presentation-ui-state'
import { liveFlagsFromStack, normalizeStackState } from '../../../shared/presentation-layers'
import type { OrionDisplayInfo } from '../../../shared/displays'
import { fileUrlToLocalPath } from '../../../shared/file-url'
import { projectionDisplayIds } from './display-projection'
import { loadPlaybackSettings } from './playback-settings'

export { liveFlagsFromStack, normalizeStackState }
export type { PresentationUiState }
export {
  emptyPresentationUiState,
  optimisticProgramPatch,
  operatorLiveFlags
} from '../../../shared/presentation-ui-state'

let fallbackState: PresentationUiState = emptyPresentationUiState()

function presentationApiReady(): boolean {
  return (
    typeof window.orion?.runProjectionCommand === 'function' &&
    typeof window.orion?.getPresentationUiState === 'function'
  )
}

async function resolveDisplayIds(displays: OrionDisplayInfo[]): Promise<number[]> {
  const list =
    displays.length > 0 ? displays : await window.orion.listDisplays()
  let ids = projectionDisplayIds(list)
  if (ids.length === 0) {
    const fresh = await window.orion.listDisplays()
    ids = projectionDisplayIds(fresh)
    if (ids.length === 0 && fresh.length > 0) {
      ids = [fresh[0]!.id]
    }
  }
  return ids
}

export async function fetchPresentationUiState(): Promise<PresentationUiState> {
  if (!presentationApiReady()) {
    return fallbackState
  }
  try {
    const ui = await window.orion.getPresentationUiState()
    fallbackState = ui
    return ui
  } catch (error) {
    console.error('[orion] getPresentationUiState failed', error)
    return fallbackState
  }
}

async function runLegacyFallback(
  command: OrionProjectionCommand,
  displayIds: number[]
): Promise<PresentationUiState> {
  if (command.type === 'set-layer') {
    if (command.source === 'order' && command.content.type === 'image') {
      await window.orion.setProjection(
        { type: 'image', filePath: command.content.filePath },
        displayIds
      )
      fallbackState = optimisticProgramPatch(fallbackState, {
        orderActive: true,
        outputsOpen: true
      })
      return fallbackState
    }
    if (command.source === 'bible' && command.content.type === 'bible') {
      await window.orion.setProjection(
        {
          type: 'bible',
          reference: command.content.reference,
          verses: command.content.verses,
          highlightVerse: command.content.highlightVerse,
          asOverlay: fallbackState.orderActive
        },
        displayIds
      )
      fallbackState = optimisticProgramPatch(fallbackState, {
        bibleActive: true,
        outputsOpen: true
      })
      return fallbackState
    }
  } else if (command.type === 'clear-layer') {
    if (command.source === 'bible' && fallbackState.orderActive) {
      await window.orion.setProjection({ type: 'clear-overlay' }, [])
      fallbackState = optimisticProgramPatch(fallbackState, { bibleActive: false })
      return fallbackState
    }
    await window.orion.setProjection({ type: 'clear' }, [])
    fallbackState = emptyPresentationUiState()
    return fallbackState
  } else if (command.type === 'clear-all') {
    await window.orion.setProjection({ type: 'clear' }, [])
    fallbackState = emptyPresentationUiState()
    return fallbackState
  }
  return fallbackState
}

export async function runPresentationCommand(
  command: OrionProjectionCommand,
  displays: OrionDisplayInfo[]
): Promise<PresentationUiState> {
  const displayIds =
    command.type === 'set-layer' ? await resolveDisplayIds(displays) : []

  if (command.type === 'set-layer' && displayIds.length === 0) {
    console.warn('[orion] No enabled projection displays — Settings → Displays.')
    return fetchPresentationUiState()
  }

  if (!presentationApiReady()) {
    return runLegacyFallback(command, displayIds)
  }

  try {
    const ui = await window.orion.runProjectionCommand(command, displayIds)
    fallbackState = ui
    return ui
  } catch (error) {
    console.error('[orion] runProjectionCommand failed', error)
    return fetchPresentationUiState()
  }
}

export async function presentDeckSlide(
  frame: {
    markup: string
    width: number
    height: number
    transition: string
    durationMs: number
    fontCss?: string
    autoplayMedia?: boolean
    media: {
      src: string
      leftPct: number
      topPct: number
      widthPct: number
      heightPct: number
      kind: 'video' | 'audio'
    }[]
  },
  displays: OrionDisplayInfo[]
): Promise<PresentationUiState> {
  const markup = await inlineBlobUrls(frame.markup)
  const media = frame.media.flatMap((item) => {
    const path = fileUrlToLocalPath(item.src)
    if (!path) return []
    return [
      {
        filePath: path,
        leftPct: item.leftPct,
        topPct: item.topPct,
        widthPct: item.widthPct,
        heightPct: item.heightPct,
        kind: item.kind
      }
    ]
  })
  return runPresentationCommand(
    {
      type: 'set-layer',
      source: 'presentation',
      content: {
        type: 'deck-slide',
        markup,
        fontCss: frame.fontCss,
        width: frame.width,
        height: frame.height,
        transition: frame.transition,
        durationMs: frame.durationMs,
        autoplayMedia: frame.autoplayMedia ?? loadPlaybackSettings().autoplayPresentationMedia,
        media
      }
    },
    displays
  )
}

async function inlineBlobUrls(markup: string): Promise<string> {
  const found = markup.match(/blob:[^"'\\\s)]+/g) ?? []
  let next = markup
  for (const url of new Set(found)) {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
      next = next.split(url).join(dataUrl)
    } catch {
      /* The output window cannot see this document's blob URLs. */
    }
  }
  return next
}

export async function presentMediaFile(
  file: { path: string; name: string; kind: 'video' | 'audio' },
  displays: OrionDisplayInfo[],
  autoplay = false
): Promise<PresentationUiState> {
  return runPresentationCommand(
    {
      type: 'set-layer',
      source: 'presentation',
      content: { type: 'media', filePath: file.path, name: file.name, kind: file.kind, autoplay }
    },
    displays
  )
}

export async function presentPresentationImage(
  filePath: string,
  displays: OrionDisplayInfo[]
): Promise<PresentationUiState> {
  return runPresentationCommand(
    { type: 'set-layer', source: 'presentation', content: { type: 'image', filePath } },
    displays
  )
}

export async function presentOrderLayer(
  filePath: string,
  displays: OrionDisplayInfo[],
  motion?: { animation: OrderImageAnimation; durationMs: number }
): Promise<PresentationUiState> {
  return runPresentationCommand(
    {
      type: 'set-layer',
      source: 'order',
      content: {
        type: 'image',
        filePath,
        animation: motion?.animation ?? 'cut',
        durationMs: motion?.durationMs ?? 0
      }
    },
    displays
  )
}

export async function presentBibleLayer(
  content: Extract<OrionStackLayerContent, { type: 'bible' }>,
  displays: OrionDisplayInfo[]
): Promise<PresentationUiState> {
  return runPresentationCommand({ type: 'set-layer', source: 'bible', content }, displays)
}

export async function presentDictionaryLayer(
  content: Extract<OrionStackLayerContent, { type: 'dictionary' }>,
  displays: OrionDisplayInfo[]
): Promise<PresentationUiState> {
  return runPresentationCommand({ type: 'set-layer', source: 'bible', content }, displays)
}

export async function presentHymnLayer(
  content: Extract<OrionStackLayerContent, { type: 'hymn' }>,
  displays: OrionDisplayInfo[]
): Promise<PresentationUiState> {
  return runPresentationCommand({ type: 'set-layer', source: 'bible', content }, displays)
}

function stopLocalPlayback(): void {
  window.dispatchEvent(new Event('orion-pause-local-media'))
}

export async function clearPresentationLayer(
  source: OrionStackSource
): Promise<PresentationUiState> {
  if (source === 'presentation') stopLocalPlayback()
  return runPresentationCommand({ type: 'clear-layer', source }, [])
}

export async function clearProjection(): Promise<PresentationUiState> {
  stopLocalPlayback()
  return runPresentationCommand({ type: 'clear-all' }, [])
}

export async function sendToProjection(
  payload: OrionProjectionPayload,
  displays: OrionDisplayInfo[]
): Promise<boolean> {
  const displayIds = await resolveDisplayIds(displays)
  if (displayIds.length === 0) return false
  try {
    await window.orion.setProjection(payload, displayIds)
    return true
  } catch {
    return false
  }
}
