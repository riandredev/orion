/** localStorage keys bundled into Orion profiles (portable app settings). */
export const ORION_PROFILE_SETTINGS_KEYS = [
  'orion-background-settings-v1',
  'orion-projection-content-insets-v2',
  'orion-hymn-typography-v2',
  'orion-projection-typography-v1',
  'orion-display-enabled',
  'orion-display-layout-positions',
  'orion-projector-panel-width-v1',
  'orion-bible-translation',
  'orion-selected-hymnal',
  'orion-hymnal-stanza-tags',
  'orion-sequence-bundle-content',
  'orion-kanban-column-order',
  'orion-hymn-pins-v1',
  'orion-hymn-motion-v1',
  'orion-bible-motion-v1',
  'orion-playback-v1',
  'orion-order-folder-playback-v1'
] as const

export type OrionProfileSettingsKey = (typeof ORION_PROFILE_SETTINGS_KEYS)[number]
