import { snapArrangementPosition } from '../../../shared/display-arrangement'
import type { OrionDisplayInfo } from '../../../shared/displays'
import { touchProfileSettings } from './profile-autosave'

export const DISPLAY_LAYOUT_CANVAS = {
  width: 720,
  height: 280,
  padding: 28
} as const

const STORAGE_KEY = 'orion-display-layout-positions'

export type DisplayCanvasPosition = {
  x: number
  y: number
}

export type LayoutMonitor = {
  display: OrionDisplayInfo
  x: number
  y: number
  width: number
  height: number
  order: number
}

type VirtualUnion = {
  minX: number
  minY: number
  width: number
  height: number
}

function virtualDesktopUnion(displays: OrionDisplayInfo[]): VirtualUnion | null {
  if (displays.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const d of displays) {
    minX = Math.min(minX, d.bounds.x)
    minY = Math.min(minY, d.bounds.y)
    maxX = Math.max(maxX, d.bounds.x + d.bounds.width)
    maxY = Math.max(maxY, d.bounds.y + d.bounds.height)
  }
  const width = Math.max(1, maxX - minX)
  const height = Math.max(1, maxY - minY)
  return { minX, minY, width, height }
}

function canvasScale(union: VirtualUnion): number {
  const { width: canvasW, height: canvasH, padding } = DISPLAY_LAYOUT_CANVAS
  const availW = canvasW - padding * 2
  const availH = canvasH - padding * 2
  return Math.min(availW / union.width, availH / union.height)
}

export function osPositionToCanvas(
  display: OrionDisplayInfo,
  union: VirtualUnion,
  scale: number
): DisplayCanvasPosition {
  const { padding } = DISPLAY_LAYOUT_CANVAS
  return {
    x: padding + (display.bounds.x - union.minX) * scale,
    y: padding + (display.bounds.y - union.minY) * scale
  }
}

export function osSizeToCanvas(display: OrionDisplayInfo, scale: number): { width: number; height: number } {
  return {
    width: Math.max(48, display.bounds.width * scale),
    height: Math.max(36, display.bounds.height * scale)
  }
}

export function loadSavedLayoutPositions(): Record<number, DisplayCanvasPosition> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, { x?: number; y?: number }>
    const out: Record<number, DisplayCanvasPosition> = {}
    for (const [key, value] of Object.entries(parsed)) {
      const id = Number(key)
      if (!Number.isFinite(id) || value == null) continue
      if (typeof value.x !== 'number' || typeof value.y !== 'number') continue
      out[id] = { x: value.x, y: value.y }
    }
    return out
  } catch {
    return {}
  }
}

export function saveLayoutPositions(positions: Record<number, DisplayCanvasPosition>): void {
  try {
    const payload: Record<string, DisplayCanvasPosition> = {}
    for (const [id, pos] of Object.entries(positions)) {
      payload[String(id)] = pos
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
  touchProfileSettings()
}

export function clearSavedLayoutPositions(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  touchProfileSettings()
}

function assignOrder(monitors: Omit<LayoutMonitor, 'order'>[]): LayoutMonitor[] {
  const sorted = [...monitors].sort((a, b) => {
    const cyA = a.y + a.height / 2
    const cyB = b.y + b.height / 2
    if (Math.abs(cyA - cyB) > 12) return cyA - cyB
    return a.x + a.width / 2 - (b.x + b.width / 2)
  })
  return sorted.map((m, index) => ({ ...m, order: index + 1 }))
}

export function buildLayoutMonitors(
  displays: OrionDisplayInfo[],
  saved: Record<number, DisplayCanvasPosition>
): LayoutMonitor[] {
  const union = virtualDesktopUnion(displays)
  if (!union) return []

  const scale = canvasScale(union)
  const draft = displays.map((display) => {
    const size = osSizeToCanvas(display, scale)
    const savedPos = saved[display.id]
    const osPos = osPositionToCanvas(display, union, scale)
    const pos = displays.length === 1 ? osPos : (savedPos ?? osPos)
    return {
      display,
      x: pos.x,
      y: pos.y,
      width: size.width,
      height: size.height
    }
  })

  return assignOrder(settleJoined(draft))
}

/** Pull every monitor flush against the cluster so none sit in empty space. */
function settleJoined(draft: Omit<LayoutMonitor, 'order'>[]): Omit<LayoutMonitor, 'order'>[] {
  if (draft.length <= 1) return draft
  const ordered = [...draft].sort(
    (a, b) => Number(b.display.primary) - Number(a.display.primary) || a.display.id - b.display.id
  )
  const placed: Omit<LayoutMonitor, 'order'>[] = []
  const bounds = { x: 0, y: 0, width: DISPLAY_LAYOUT_CANVAS.width, height: DISPLAY_LAYOUT_CANVAS.height }
  for (const monitor of ordered) {
    if (placed.length === 0) {
      placed.push({ ...monitor, ...clampMonitorPosition(monitor.x, monitor.y, monitor.width, monitor.height) })
      continue
    }
    const snapped = snapArrangementPosition(
      monitor.x,
      monitor.y,
      monitor.width,
      monitor.height,
      placed,
      { x: monitor.x, y: monitor.y },
      bounds,
      { x: monitor.x, y: monitor.y }
    )
    placed.push({ ...monitor, x: snapped.x, y: snapped.y })
  }
  return placed
}

/** Recompute output order badges after positions changed. */
export function reorderLayoutMonitors(monitors: LayoutMonitor[]): LayoutMonitor[] {
  return assignOrder(
    monitors.map(({ display, x, y, width, height }) => ({
      display,
      x,
      y,
      width,
      height
    }))
  )
}

export function clampMonitorPosition(
  x: number,
  y: number,
  width: number,
  height: number
): DisplayCanvasPosition {
  const { width: canvasW, height: canvasH } = DISPLAY_LAYOUT_CANVAS
  const maxX = canvasW - width
  const maxY = canvasH - height
  return {
    x: Math.min(maxX, Math.max(0, x)),
    y: Math.min(maxY, Math.max(0, y))
  }
}

export function layoutToSavedPositions(monitors: LayoutMonitor[]): Record<number, DisplayCanvasPosition> {
  const out: Record<number, DisplayCanvasPosition> = {}
  for (const m of monitors) {
    out[m.display.id] = { x: m.x, y: m.y }
  }
  return out
}
