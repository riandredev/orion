import type { Display } from 'electron'
import type { OrionDisplayInfo } from '../shared/displays'

export type { OrionDisplayInfo } from '../shared/displays'

export function displayInfoFromElectron(display: Display, primaryId: number): OrionDisplayInfo {
  const label =
    typeof display.label === 'string' && display.label.trim().length > 0
      ? display.label.trim()
      : `Display ${display.id}`

  const refreshRate =
    typeof display.displayFrequency === 'number' && display.displayFrequency > 0
      ? Math.round(display.displayFrequency)
      : null

  return {
    id: display.id,
    label,
    bounds: { ...display.bounds },
    workArea: { ...display.workArea },
    scaleFactor: display.scaleFactor,
    rotation: display.rotation,
    internal: display.internal,
    primary: display.id === primaryId,
    colorDepth: display.colorDepth,
    refreshRate
  }
}

export function sortDisplays(displays: OrionDisplayInfo[]): OrionDisplayInfo[] {
  return [...displays].sort((a, b) => {
    if (a.primary !== b.primary) return a.primary ? -1 : 1
    if (a.internal !== b.internal) return a.internal ? -1 : 1
    if (a.bounds.x !== b.bounds.x) return a.bounds.x - b.bounds.x
    return a.bounds.y - b.bounds.y
  })
}
