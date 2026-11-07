import { touchProfileSettings } from './profile-autosave'

const STORAGE_KEY = 'orion-hymn-pins-v1'

export type HymnPin = {
  hymnalId: string
  hymnId: string
  disabledVerseNumbers: number[]
  includeRefrain: boolean
  includeTitle: boolean
  includeEnd: boolean
}

function sanitizePin(raw: unknown): HymnPin | null {
  if (!raw || typeof raw !== 'object') return null
  const pin = raw as Partial<HymnPin>
  if (typeof pin.hymnalId !== 'string' || typeof pin.hymnId !== 'string') return null
  if (!pin.hymnalId || !pin.hymnId) return null
  const disabledVerseNumbers = Array.isArray(pin.disabledVerseNumbers)
    ? pin.disabledVerseNumbers.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    : []
  return {
    hymnalId: pin.hymnalId,
    hymnId: pin.hymnId,
    disabledVerseNumbers,
    includeRefrain: pin.includeRefrain !== false,
    includeTitle: pin.includeTitle !== false,
    includeEnd: pin.includeEnd !== false
  }
}

export function loadHymnPins(): HymnPin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(sanitizePin).filter((pin): pin is HymnPin => pin != null)
  } catch {
    return []
  }
}

export function saveHymnPins(pins: HymnPin[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins))
  } catch {
    /* ignore quota */
  }
  touchProfileSettings()
}

export function hymnPinFor(pins: HymnPin[], hymnalId: string, hymnId: string): HymnPin | undefined {
  return pins.find((pin) => pin.hymnalId === hymnalId && pin.hymnId === hymnId)
}

export function upsertHymnPin(pins: HymnPin[], pin: HymnPin): HymnPin[] {
  const rest = pins.filter((item) => item.hymnalId !== pin.hymnalId || item.hymnId !== pin.hymnId)
  return [...rest, pin]
}

export function removeHymnPin(pins: HymnPin[], hymnalId: string, hymnId: string): HymnPin[] {
  return pins.filter((pin) => pin.hymnalId !== hymnalId || pin.hymnId !== hymnId)
}
