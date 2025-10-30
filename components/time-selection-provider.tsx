'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { PhysicalPosition, availableMonitors } from '@tauri-apps/api/window';

interface TimeSelection {
  id: string;
  name: string;
  time: string;
  runtime: string;
  is_playing: boolean;
}

function parseTime(timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number)
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes)
}

function getRemainingTime(endTime: Date): string {
  const now = new Date()
  const diff = endTime.getTime() - now.getTime()

  if (diff <= 0) return '00:00'

  const minutes = Math.floor(diff / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

interface TimeSelectionContextType {
  startProjection: (selection: TimeSelection) => Promise<void>;
  stopProjection: (selectionId: string) => Promise<void>;
  selections: TimeSelection[];
  setSelections: (selections: TimeSelection[]) => void;
}

export const TimeSelectionContext = createContext<TimeSelectionContextType | null>(null);

export function useTimeSelection() {
  const context = useContext(TimeSelectionContext);
  if (!context) {
    throw new Error('useTimeSelection must be used within a TimeSelectionProvider');
  }
  return context;
}

export function TimeSelectionProvider({ children }: { children: React.ReactNode }) {
  const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__
  const [activeWindow, setActiveWindow] = useState<WebviewWindow | null>(null);
  const [selections, setSelections] = useState<TimeSelection[]>([]);
  const [manuallyStoppedIds, setManuallyStoppedIds] = useState<Set<string>>(new Set());

  const saveSelections = useCallback(async (newSelections: TimeSelection[]) => {
    try {
      if (!isTauri) return
      await invoke('save_time_selections', { selections: newSelections });
    } catch (error) {
      console.error('Failed to save selections:', error);
    }
  }, [isTauri]);

  const createClockWindow = useCallback(async () => {
    try {
      if (!isTauri) return null
      // Use get_clock_displays instead of get_selected_display
      const selectedDisplays = await invoke<number[]>('get_clock_displays');
      const monitors = await availableMonitors();

      if (!monitors || monitors.length === 0) {
        throw new Error('No monitors found');
      }

      // Create a window for each selected display
      const windows = await Promise.all(selectedDisplays.map(async (displayIndex, index) => {
        const validIndex = Math.min(displayIndex, monitors.length - 1);
        const targetMonitor = monitors[validIndex];

        const webview = new WebviewWindow(`clock-window-${index}`, {
          url: '/clock-display',
          width: targetMonitor.size.width,
          height: targetMonitor.size.height,
          x: targetMonitor.position.x,
          y: targetMonitor.position.y
        });

        await webview.once('tauri://created', async () => {
          await webview.setPosition(new PhysicalPosition(
            targetMonitor.position.x,
            targetMonitor.position.y
          ));
          await webview.setFullscreen(true);
        });

        return webview;
      }));

      // Store the primary window for state management
      setActiveWindow(windows[0]);
      return windows[0];
    } catch (error) {
      console.error('Failed to create clock window:', error);
      return null;
    }
  }, [isTauri]);

  const startProjection = useCallback(async (selection: TimeSelection) => {
    try {
      if (!isTauri) return
      // First check if there's already a window and close it
      if (activeWindow) {
        try {
          await activeWindow.close();
        } catch (e) {
          console.log('Failed to close existing window:', e);
        }
      }

      // Create new window
      const window = await createClockWindow();
      if (!window) return;

      const [startTime, endTime] = selection.time.split(' - ');
      const endDateTime = parseTime(endTime);

      // Set up the interval after window is created
      const interval = setInterval(async () => {
        try {
          const remaining = getRemainingTime(endDateTime);
          await window.emit('update-time', {
            name: selection.name,
            remainingTime: remaining
          });

          if (remaining === '00:00') {
            clearInterval(interval);
            const currentIndex = selections.findIndex(s => s.id === selection.id);
            const nextSelection = selections[currentIndex + 1];

            if (nextSelection) {
              // Start next selection
              startProjection(nextSelection);
            } else {
              // No more selections, clean up
              await window.close();
              setActiveWindow(null);
              const newSelections = selections.map(s => ({
                ...s,
                is_playing: false
              }));
              setSelections(newSelections);
              await saveSelections(newSelections);
            }
          }
        } catch (error) {
          console.error('Error in interval:', error);
          clearInterval(interval);
          setActiveWindow(null);
        }
      }, 1000);

      // Update selections state
      const newSelections = selections.map(s => ({
        ...s,
        is_playing: s.id === selection.id
      }));
      setSelections(newSelections);
      await saveSelections(newSelections);

    } catch (error) {
      console.error('Error in startProjection:', error);
      setActiveWindow(null);
    }
  }, [activeWindow, selections, createClockWindow, saveSelections]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        if (!isTauri) return
        const now = new Date();
        const currentTime = now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        });

        // Check for selections that should start
        for (const selection of selections) {
          const [startTime] = selection.time.split(' - ');
          if (startTime === currentTime &&
              !selection.is_playing &&
              !manuallyStoppedIds.has(selection.id)) {
            console.log('Starting selection:', selection.name, 'at', currentTime);
            await startProjection(selection);
            break; // Only start one selection at a time
          }
        }
      } catch (error) {
        console.error('Error in time check interval:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [selections, manuallyStoppedIds, startProjection, isTauri]);

  // Add an effect to load selections immediately and periodically
  useEffect(() => {
    const loadSelections = async () => {
      try {
        if (!isTauri) return
        const backendSelections = await invoke<TimeSelection[]>('get_time_selections');
        if (backendSelections) {
          setSelections(backendSelections);
          console.log('Loaded selections:', backendSelections);
        }
      } catch (error) {
        console.error('Failed to load selections:', error);
      }
    };

    loadSelections();
  }, [isTauri]); // Remove the interval - we don't need to reload periodically

  // Add this useEffect to handle selections changes
  useEffect(() => {
    if (selections.length > 0) {
      saveSelections(selections);
    }
  }, [selections, saveSelections]);

  // Create a context value object to expose methods
  const contextValue = {
    startProjection,
    stopProjection: async (selectionId: string) => {
      try {
        if (!isTauri) {
          // In web preview, just reset state without invoking Tauri APIs
          const newSelections = selections.map(s => ({
            ...s,
            is_playing: false
          }));
          setSelections(newSelections);
          setManuallyStoppedIds(prev => new Set([...prev, selectionId]));
          return
        }
        if (activeWindow) {
          await activeWindow.close();
          setActiveWindow(null);
        }
        const newSelections = selections.map(s => ({
          ...s,
          is_playing: false
        }));
        setSelections(newSelections);
        await saveSelections(newSelections);
        setManuallyStoppedIds(prev => new Set([...prev, selectionId]));
      } catch (error) {
        console.error('Error stopping projection:', error);
      }
    },
    selections,
    setSelections,
  };

  // Create and export the context
  return (
    <TimeSelectionContext.Provider value={contextValue}>
      {children}
    </TimeSelectionContext.Provider>
  );
}
