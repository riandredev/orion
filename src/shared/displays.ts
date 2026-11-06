export type OrionDisplayBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type OrionDisplayInfo = {
  id: number
  label: string
  bounds: OrionDisplayBounds
  workArea: OrionDisplayBounds
  scaleFactor: number
  rotation: number
  internal: boolean
  primary: boolean
  colorDepth: number
  refreshRate: number | null
}
