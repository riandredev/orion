import { touchProfileSettings } from './profile-autosave'

export const PROJECTOR_PANEL_WIDTH_MIN = 196
export const PROJECTOR_PANEL_WIDTH_MAX = 440
export const PROJECTOR_PANEL_WIDTH_DEFAULT = PROJECTOR_PANEL_WIDTH_MIN

const STORAGE_KEY = 'orion-projector-panel-width-v1'

export function loadProjectorPanelWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return PROJECTOR_PANEL_WIDTH_DEFAULT
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n)) return PROJECTOR_PANEL_WIDTH_DEFAULT
    return Math.min(PROJECTOR_PANEL_WIDTH_MAX, Math.max(PROJECTOR_PANEL_WIDTH_MIN, n))
  } catch {
    return PROJECTOR_PANEL_WIDTH_DEFAULT
  }
}

export function saveProjectorPanelWidth(width: number): void {
  const clamped = Math.min(
    PROJECTOR_PANEL_WIDTH_MAX,
    Math.max(PROJECTOR_PANEL_WIDTH_MIN, Math.round(width))
  )
  try {
    localStorage.setItem(STORAGE_KEY, String(clamped))
  } catch {
    /* ignore */
  }
  touchProfileSettings()
}

export function clampProjectorPanelWidth(width: number): number {
  return Math.min(PROJECTOR_PANEL_WIDTH_MAX, Math.max(PROJECTOR_PANEL_WIDTH_MIN, Math.round(width)))
}
