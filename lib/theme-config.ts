// Theme configuration - easy to add new themes here
export interface ThemeConfig {
  id: string
  name: string
  description: string
  icon: string // Lucide icon name
}

export const availableThemes: ThemeConfig[] = [
  {
    id: 'light',
    name: 'Light',
    description: 'Clean and bright interface',
    icon: 'Sun'
  },
  {
    id: 'dark',
    name: 'Dark', 
    description: 'Easy on the eyes',
    icon: 'Moon'
  }
  // Future themes can be added here:
  // {
  //   id: 'auto',
  //   name: 'Auto',
  //   description: 'Follows system preference',
  //   icon: 'Monitor'
  // },
  // {
  //   id: 'blue',
  //   name: 'Blue',
  //   description: 'Professional blue theme',
  //   icon: 'Palette'
  // },
  // {
  //   id: 'green',
  //   name: 'Green',
  //   description: 'Nature-inspired green theme',
  //   icon: 'Leaf'
  // }
]

// Helper function to get theme by id
export function getThemeById(id: string): ThemeConfig | undefined {
  return availableThemes.find(theme => theme.id === id)
}

// Helper function to get all theme ids
export function getAllThemeIds(): string[] {
  return availableThemes.map(theme => theme.id)
}
