'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useSetup } from '@/components/setup-provider'

// Easy to extend with more themes in the future
type Theme = 'system' | 'dark' | 'light' // | 'auto' | 'blue' | 'green'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'dark' | 'light' // The actual theme being applied
  accentColor: string
  setAccentColor: (color: string) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { setupData } = useSetup()
  
  // Function to get system theme preference
  const getSystemTheme = (): 'dark' | 'light' => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'dark'
  }

  // Function to resolve the actual theme (system -> dark/light)
  const resolveTheme = (theme: Theme): 'dark' | 'light' => {
    return theme === 'system' ? getSystemTheme() : theme
  }

  // Accent color mapping
  const accentColorMap = {
    blue: '#0EA5E9',
    orange: '#F59E0B', 
    pink: '#EC4899',
    green: '#10B981'
  }

  // Initial theme is determined by setup data, fallback to localStorage, then dark
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      // Check if setup data is available
      if (setupData?.theme) {
        return setupData.theme;
      }
      const savedTheme = localStorage.getItem('theme') as Theme;
      return savedTheme || 'dark';
    }
    return 'dark';
  });

  // Initial accent color
  const [accentColor, setAccentColor] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      if (setupData?.accentColor) {
        return setupData.accentColor;
      }
      const savedColor = localStorage.getItem('accentColor');
      return savedColor || 'orange';
    }
    return 'orange';
  });

  // Resolved theme (what's actually applied)
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>(() => resolveTheme(theme))

  // Initialize theme on mount
  useEffect(() => {
    // Apply theme immediately on mount
    const initialTheme = localStorage.getItem('theme') as Theme || 'dark';
    const initialAccentColor = localStorage.getItem('accentColor') || 'orange';
    const resolved = resolveTheme(initialTheme);
    document.documentElement.className = `${resolved} accent-${initialAccentColor}`;
  }, []);

  // Update theme when setup data changes
  useEffect(() => {
    if (setupData?.theme && setupData.theme !== theme) {
      setTheme(setupData.theme);
    }
    if (setupData?.accentColor && setupData.accentColor !== accentColor) {
      setAccentColor(setupData.accentColor);
    }
  }, [setupData?.theme, setupData?.accentColor]);

  // Update resolved theme when theme changes
  useEffect(() => {
    setResolvedTheme(resolveTheme(theme))
  }, [theme])

  // Listen for system theme changes when using system theme
  useEffect(() => {
    if (theme === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => {
        setResolvedTheme(getSystemTheme())
      }
      
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  // Update theme when theme changes
  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // Update accent color when accent color changes
  const handleAccentColorChange = (newColor: string) => {
    setAccentColor(newColor);
    localStorage.setItem('accentColor', newColor);
  };

  // Apply accent color to CSS custom properties
  useEffect(() => {
    const colorValue = accentColorMap[accentColor as keyof typeof accentColorMap] || accentColorMap.orange;
    document.documentElement.style.setProperty('--accent-color', colorValue);
  }, [accentColor]);

  useEffect(() => {
    document.documentElement.className = `${resolvedTheme} accent-${accentColor}`
  }, [resolvedTheme, accentColor])

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      setTheme: handleThemeChange, 
      resolvedTheme, 
      accentColor, 
      setAccentColor: handleAccentColorChange 
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
