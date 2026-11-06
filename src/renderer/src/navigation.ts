/** Main workspace tabs (top bar). Settings live in the settings dialog. */
export type WorkspaceTab =
  | 'order'
  | 'hymns'
  | 'bible'
  | 'presentation'
  | 'media'
  | 'web'
  | 'dictionary'

export const workspaceTabs: { id: WorkspaceTab; label: string }[] = [
  { id: 'order', label: 'Service order' },
  { id: 'hymns', label: 'Hymns' },
  { id: 'bible', label: 'Bible' },
  { id: 'presentation', label: 'Presentation' },
  { id: 'media', label: 'Media' },
  { id: 'web', label: 'Web' },
  { id: 'dictionary', label: 'Dictionary' }
]

export type SettingsSection =
  | 'displays'
  | 'backgrounds'
  | 'hymns'
  | 'bible'
  | 'dictionary'
  | 'sequence'
  | 'organization'
  | 'about'

export const settingsSections: { id: SettingsSection; label: string }[] = [
  { id: 'displays', label: 'Displays' },
  { id: 'backgrounds', label: 'Backgrounds' },
  { id: 'hymns', label: 'Hymns' },
  { id: 'bible', label: 'Bible' },
  { id: 'dictionary', label: 'Dictionary' },
  { id: 'sequence', label: 'Sequence' },
  { id: 'organization', label: 'Organization' },
  { id: 'about', label: 'About' }
]

export const workspacePlaceholderCopy: Record<
  WorkspaceTab,
  { title: string; body: string } | null
> = {
  order: null,
  hymns: {
    title: 'Hymns',
    body: 'Search and queue hymns here. Items you add appear in the sequence on the left.'
  },
  bible: null,
  presentation: {
    title: 'Presentation',
    body: 'Build and edit slide decks for live presentation.'
  },
  media: null,
  web: null,
  dictionary: null,
}
