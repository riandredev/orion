export type OrionProjectionImage = {
  type: 'image'
  filePath: string
}

export type OrionProjectionWeb = {
  type: 'web'
  url: string
}

export type OrionProjectionClear = {
  type: 'clear'
}

export type OrionProjectionBible = {
  type: 'bible'
  reference: string
  verses: { number: number; text: string }[]
  highlightVerse?: number
  /** When true, show over an existing order/base image instead of replacing it. */
  asOverlay?: boolean
  backgroundImagePath?: string | null
  backgroundColor?: string
  backgroundDimOpacity?: number
  backgroundDimColor?: string
  backgroundFit?: 'cover' | 'contain'
}

export type OrionProjectionClearOverlay = {
  type: 'clear-overlay'
}

export type OrionProjectionPayload =
  | OrionProjectionImage
  | OrionProjectionBible
  | OrionProjectionWeb
  | OrionProjectionClear
  | OrionProjectionClearOverlay
