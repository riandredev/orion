import { orderImageAnimations, type OrderImageAnimation } from '../../../shared/projection-stack'
import {
  defaultFolderPlayback,
  type FolderPlaybackSettings
} from '../types/image-block'
import { touchProfileSettings } from './profile-autosave'

export const ORDER_FOLDER_PLAYBACK_KEY = 'orion-order-folder-playback-v1'

function isAnimation(value: string): value is OrderImageAnimation {
  return (orderImageAnimations as readonly string[]).includes(value)
}

function sanitizeFolder(raw: Partial<FolderPlaybackSettings> | null | undefined): FolderPlaybackSettings {
  const base = defaultFolderPlayback()
  const animation = typeof raw?.animation === 'string' && isAnimation(raw.animation) ? raw.animation : base.animation
  const transitionMs =
    typeof raw?.transitionMs === 'number' && Number.isFinite(raw.transitionMs)
      ? Math.min(5000, Math.max(0, Math.round(raw.transitionMs)))
      : base.transitionMs
  const autoScrollSec =
    typeof raw?.autoScrollSec === 'number' && Number.isFinite(raw.autoScrollSec)
      ? Math.min(120, Math.max(1, Math.round(raw.autoScrollSec)))
      : base.autoScrollSec
  return {
    animation,
    transitionMs,
    autoScrollSec,
    loop: raw?.loop !== false
  }
}

export function loadOrderFolderPlayback(): Record<string, FolderPlaybackSettings> {
  try {
    const raw = localStorage.getItem(ORDER_FOLDER_PLAYBACK_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Partial<FolderPlaybackSettings>>
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, FolderPlaybackSettings> = {}
    for (const [name, value] of Object.entries(parsed)) {
      const folder = name.trim()
      if (!folder || folder.length > 180 || !value || typeof value !== 'object') continue
      out[folder] = sanitizeFolder(value)
    }
    return out
  } catch {
    return {}
  }
}

export function saveOrderFolderPlayback(map: Record<string, FolderPlaybackSettings>): void {
  try {
    localStorage.setItem(ORDER_FOLDER_PLAYBACK_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
  touchProfileSettings()
}
