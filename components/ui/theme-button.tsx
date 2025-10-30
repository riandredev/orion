'use client'

import { useTheme } from '@/lib/theme-context'
import { cn } from '@/lib/utils'
import { Check, Monitor, Sun, Moon } from 'lucide-react'

interface ThemeButtonProps {
  theme: 'dark' | 'light' | 'system'
  label: string
}

export function ThemeButton({ theme, label }: ThemeButtonProps) {
  const { theme: currentTheme, setTheme } = useTheme()

  // Define theme colors for each theme - more monochromatic within each theme
  const themeColors = {
    light: {
      background: '#FFFFFF', // Pure white background
      foreground: '#F1F5F9', // Very light text  
      card: '#F9FAFB', // Very light card
      primary: '#E2E8F0', // Light gray
      secondary: '#F1F5F9', // Lighter gray
      accent: '#EEF2FF', // Light indigo
      muted: '#F8FAFC', // Almost white gray
      border: '#F3F4F6', // Nearly white border
    },
    dark: {
      background: '#0F172A', // Navy background
      foreground: '#111111', // Very dark text
      card: '#1E293B', // Dark navy card
      primary: '#334155', // Dark slate
      secondary: '#1E293B', // Navy
      accent: '#0F172A', // Darker navy
      muted: '#475569', // Slate gray
      border: '#1E293B', // Dark border
    },
    system: {
      background: 'transparent',
      foreground: '#FFFFFF',
      card: '#F9FAFB',
      primary: '#E2E8F0',
      secondary: '#F1F5F9',
      accent: '#EEF2FF',
      muted: '#F8FAFC',
      border: '#F3F4F6',
    }
  }

  // Get colors for the current theme
  const colors = themeColors[theme]

  // Theme icon
  const ThemeIcon = 
    theme === 'light' ? Sun :
    theme === 'dark' ? Moon :
    Monitor

  // Extra styling for system theme
  const isSystem = theme === 'system'

  return (
    <button
      onClick={() => setTheme(theme)}
      className="w-full"
    >
      <div className={cn(
        'relative w-full h-[350px] md:h-[450px] lg:h-[650px] rounded-xl overflow-hidden transition-all',
        currentTheme === theme ? 'ring-4 ring-blue-500' : 'ring-2 ring-muted-foreground/20',
        theme === 'light' ? 'bg-white' : 
        theme === 'dark' ? 'bg-[#0F172A]' : 
        'bg-gradient-to-r from-white to-[#0F172A]'
      )}>
        {/* Distinct visual identity for each theme */}
        <div className="absolute inset-0">
          {theme === 'light' && (
            <div className="w-full h-full bg-[radial-gradient(#f0f0f0_1px,transparent_1px)] [background-size:16px_16px]"></div>
          )}
          {theme === 'dark' && (
            <div className="w-full h-full bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]"></div>
          )}
          {theme === 'system' && (
            <div className="w-full h-full flex">
              <div className="w-1/2 h-full bg-[radial-gradient(#f0f0f0_1px,transparent_1px)] [background-size:16px_16px]"></div>
              <div className="w-1/2 h-full bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]"></div>
            </div>
          )}
        </div>
        
        {/* Color bars - only for light and dark themes */}
        {!isSystem && (
          <div className="absolute inset-0 flex h-full">
            {/* Color column 1 */}
            <div className="flex flex-col w-1/3 h-full">
              <div className="h-1/6 w-full" style={{ background: colors.foreground, opacity: 0.9 }}></div>
              <div className="h-1/6 w-full" style={{ background: colors.primary, opacity: 0.9 }}></div>
              <div className="h-1/6 w-full" style={{ background: colors.secondary, opacity: 0.9 }}></div>
              <div className="h-1/6 w-full" style={{ background: colors.accent, opacity: 0.9 }}></div>
              <div className="h-1/6 w-full" style={{ background: colors.card, opacity: 0.9 }}></div>
              <div className="h-1/6 w-full" style={{ background: colors.muted, opacity: 0.9 }}></div>
            </div>
            
            {/* Color column 2 */}
            <div className="flex flex-col w-1/3 h-full">
              <div className="h-1/4 w-full" style={{ background: colors.primary, opacity: 0.9 }}></div>
              <div className="h-1/4 w-full" style={{ background: colors.muted, opacity: 0.9 }}></div>
              <div className="h-1/4 w-full" style={{ background: colors.secondary, opacity: 0.9 }}></div>
              <div className="h-1/4 w-full" style={{ background: colors.border, opacity: 0.9 }}></div>
            </div>
            
            {/* Color column 3 */}
            <div className="flex flex-col w-1/3 h-full">
              <div className="h-1/3 w-full" style={{ background: colors.card, opacity: 0.9 }}></div>
              <div className="h-1/3 w-full" style={{ background: colors.accent, opacity: 0.9 }}></div>
              <div className="h-1/3 w-full" style={{ background: colors.foreground, opacity: 0.9 }}></div>
            </div>
          </div>
        )}
        
        {/* System theme special handling - wider columns and more distinct separation */}
        {isSystem && (
          <div className="absolute inset-0 flex">
            {/* Light side - only light colors */}
            <div className="w-1/2 h-full relative">
              <div className="absolute inset-0 flex flex-col">
                <div className="h-1/6 w-full" style={{ background: themeColors.light.foreground }}></div>
                <div className="h-1/6 w-full" style={{ background: themeColors.light.primary }}></div>
                <div className="h-1/6 w-full" style={{ background: themeColors.light.secondary }}></div>
                <div className="h-1/6 w-full" style={{ background: themeColors.light.accent }}></div>
                <div className="h-1/6 w-full" style={{ background: themeColors.light.card }}></div>
                <div className="h-1/6 w-full" style={{ background: themeColors.light.muted }}></div>
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="text-5xl font-semibold text-black">Aa</span>
              </div>
            </div>
            
            {/* Divider line */}
            <div className="w-[2px] h-full bg-blue-500"></div>
            
            {/* Dark side - only dark colors */}
            <div className="w-1/2 h-full relative">
              <div className="absolute inset-0 flex flex-col">
                <div className="h-1/6 w-full" style={{ background: themeColors.dark.foreground }}></div>
                <div className="h-1/6 w-full" style={{ background: themeColors.dark.primary }}></div>
                <div className="h-1/6 w-full" style={{ background: themeColors.dark.secondary }}></div>
                <div className="h-1/6 w-full" style={{ background: themeColors.dark.accent }}></div>
                <div className="h-1/6 w-full" style={{ background: themeColors.dark.card }}></div>
                <div className="h-1/6 w-full" style={{ background: themeColors.dark.muted }}></div>
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="text-5xl font-semibold text-white">Aa</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Theme icon */}
        <div className={cn(
          "absolute top-6 left-6 w-10 h-10 rounded-full flex items-center justify-center",
          theme === 'light' ? 'bg-gray-100' : 
          theme === 'dark' ? 'bg-slate-700' : 
          'bg-blue-500/10'
        )}>
          <ThemeIcon className={cn(
            "w-6 h-6",
            theme === 'light' ? 'text-gray-700' : 
            theme === 'dark' ? 'text-gray-300' : 
            'text-blue-500'
          )} />
        </div>
        
        {/* Selected Theme Indicator */}
        {currentTheme === theme && (
          <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
            <Check className="w-5 h-5 text-white" />
          </div>
        )}
        
        {/* Theme preview text - only shown for light and dark themes */}
        {!isSystem && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <span className={cn(
              'text-6xl font-semibold',
              theme === 'light' ? 'text-black' : 'text-white'
            )}>
              Aa
            </span>
          </div>
        )}
        
        {/* Theme name label */}
        <div className={cn(
          "absolute bottom-6 right-6 px-4 py-2 rounded-lg backdrop-blur-sm",
          theme === 'light' ? 'bg-gray-800/10' : 
          theme === 'dark' ? 'bg-white/10' : 
          'bg-blue-500/10'
        )}>
          <span className={cn(
            'text-lg font-medium',
            theme === 'light' ? 'text-black' : 'text-white'
          )}>
            {label}
          </span>
        </div>
      </div>
    </button>
  )
}
