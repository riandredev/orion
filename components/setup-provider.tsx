'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { SetupModal } from './setup-modal'
import { ThemeProvider } from '@/lib/theme-context'

interface SetupData {
  organizationName: string
  theme: 'system' | 'light' | 'dark'
  accentColor: string
}

interface SetupContextType {
  isSetupComplete: boolean
  setupData: SetupData | null
  completeSetup: (data: SetupData) => void
  openSetupModal: () => void
}

const SetupContext = createContext<SetupContextType | undefined>(undefined)

export function useSetup() {
  const context = useContext(SetupContext)
  if (context === undefined) {
    throw new Error('useSetup must be used within a SetupProvider')
  }
  return context
}

interface SetupProviderProps {
  children: ReactNode
}

export function SetupProvider({ children }: SetupProviderProps) {
  const [isSetupComplete, setIsSetupComplete] = useState(false)
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    // Check if setup has been completed before
    const checkSetupStatus = () => {
      try {
        const savedSetup = localStorage.getItem('orion-setup')
        if (savedSetup) {
          const parsed = JSON.parse(savedSetup)
          setSetupData(parsed)
          setIsSetupComplete(true)
        } else {
          // First time opening the app
          setIsModalOpen(true)
        }
      } catch (error) {
        console.error('Error checking setup status:', error)
        // If there's an error, show the setup modal
        setIsModalOpen(true)
      }
    }

    checkSetupStatus()
  }, [])

  const completeSetup = (data: SetupData) => {
    try {
      // Save setup data to localStorage
      localStorage.setItem('orion-setup', JSON.stringify(data))
      localStorage.setItem('orion-organization-name', data.organizationName)
      localStorage.setItem('theme', data.theme)
      localStorage.setItem('accentColor', data.accentColor)
      
      // Update state
      setSetupData(data)
      setIsSetupComplete(true)
      setIsModalOpen(false)
      
      // Don't manually set className - let ThemeProvider handle it
      
      console.log('Setup completed:', data)
    } catch (error) {
      console.error('Error completing setup:', error)
    }
  }

  const openSetupModal = () => setIsModalOpen(true)

  const value: SetupContextType = {
    isSetupComplete,
    setupData,
    completeSetup,
    openSetupModal
  }

  return (
    <SetupContext.Provider value={value}>
      <ThemeProvider>
        {children}
        <SetupModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={completeSetup}
        />
      </ThemeProvider>
    </SetupContext.Provider>
  )
}
