'use client'

import React from 'react'
import { ThemeProvider as GravityThemeProvider } from '@gravity-ui/uikit'
import { useTheme } from '@/lib/theme-context'

export function GravityProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()
  // Map app theme ('dark' | 'light') directly to Gravity UI theme
  return (
    <GravityThemeProvider theme={resolvedTheme}>
      {children}
    </GravityThemeProvider>
  )
}