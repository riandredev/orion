import type { OrionDisplayInfo } from '../../../shared/displays'
import {
  buildLayoutMonitors,
  loadSavedLayoutPositions,
  type LayoutMonitor
} from './display-layout'
import {
  displayProjectionSignature,
  isDisplayProjectionEnabled,
  rememberDisplays
} from './display-enabled'

export function projectionTargetsFromDisplays(displays: OrionDisplayInfo[]): LayoutMonitor[] {
  const enabled = rememberDisplays(displays)
  const layout = buildLayoutMonitors(displays, loadSavedLayoutPositions())
  return layout.filter((monitor) =>
    isDisplayProjectionEnabled(
      monitor.display.id,
      enabled,
      displayProjectionSignature(monitor.display)
    )
  )
}

export function projectionDisplayIds(displays: OrionDisplayInfo[]): number[] {
  return projectionTargetsFromDisplays(displays).map((m) => m.display.id)
}
