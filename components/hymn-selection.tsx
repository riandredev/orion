"use client"

import React, { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QueueMusic, AutoStories, Language, PlayArrow, Stop, MusicNote } from '@nine-thirty-five/material-icons-react/rounded'
import ComboBox from "@/components/combobox";
import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { Hymn, Verse } from '@/app/types/hymn';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Search } from 'lucide-react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Window } from '@tauri-apps/api/window';
import { availableMonitors, PhysicalPosition, Monitor } from '@tauri-apps/api/window';
import useVerseStore from '@/lib/store';
import { displayStream } from '@/lib/display-stream';

const LANGUAGES = [
  { value: "AFR", label: "AFR" },
  { value: "ENG", label: "ENG" }
];

const HYMN_TYPES = {
  AFR: [
    { value: "adventlofliedere", label: "Advent Lofliedere" },
    { value: "adventjeugliede", label: "Advent Jeug Liede" }
  ],
  ENG: [
    { value: "adventhymnal", label: "Advent Hymnal" },
    { value: "adventyouthsongs", label: "Advent Youth Songs" }
  ],
  SPA: [
    { value: "adventhymnal", label: "Advent Hymnal" }
  ]
};

const HymnSelection = () => {
  const [language, setLanguage] = useState("AFR");
  const [hymnType, setHymnType] = useState("adventlofliedere");
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [openLanguage, setOpenLanguage] = useState(false);
  const [openHymnType, setOpenHymnType] = useState(false);
  const [inputRef, setInputRef] = useState<HTMLInputElement | null>(null);
  const [selectedHymn, setSelectedHymn] = useState<Hymn | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const availableHymnTypes = HYMN_TYPES[language as keyof typeof HYMN_TYPES] || HYMN_TYPES.AFR;

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    setHymnType(HYMN_TYPES[newLanguage as keyof typeof HYMN_TYPES][0].value);
    setSearchTerm('');
    setShowDropdown(false);
    setOpenLanguage(false);
  };

  const handleHymnTypeChange = (newType: string) => {
    setHymnType(newType);
    setSearchTerm('');
    setShowDropdown(false);
    setOpenHymnType(false);
  };

  const handleHymnSelect = useCallback(async (hymn: Hymn) => {
    setSearchTerm(`${hymn.number} - ${hymn.title}`);
    setSelectedHymn(hymn);
    setShowDropdown(false);
    
    // Reset any previous state first to prevent state persistence between hymns
    useVerseStore.getState().resetAll();
    
    // Dispatch a custom event to notify other components about hymn selection
    // This will trigger state reset in verse-selector and other components
    window.dispatchEvent(new CustomEvent('hymn-selected', {
      detail: hymn
    }));
  
    // Initialize verse store with necessary info for proper part detection
    useVerseStore.getState().setTotalVerses(hymn.verses_count);
    useVerseStore.getState().setHasRefrain(hymn.has_refrain);
  
    // Pre-scan hymn for multi-part verses
    const multiPartVerses = new Map<number, number>();
    
    try {
      // Fetch verses immediately to detect multi-part verses
      const fetchedVerses = await invoke<Verse[]>('get_verses_for_hymn', { hymnId: hymn.id });
      
      if (fetchedVerses && fetchedVerses.length > 0) {
        // Process verses to detect multi-part verses
        const verseCounts = new Map<number, number>();
        
        // First check for explicit part information in verses
        fetchedVerses.forEach(verse => {
          if (!verse.verse_number) return;
          
          const count = verseCounts.get(verse.verse_number) || 0;
          verseCounts.set(verse.verse_number, count + 1);
          
          // Check for explicit part info if available
          if (verse.part && verse.totalParts && verse.totalParts > 1) {
            multiPartVerses.set(verse.verse_number, verse.totalParts);
          }
        });
        
        // Then check for verses that appear multiple times (indicating multi-part)
        verseCounts.forEach((count, verseNumber) => {
          if (count > 1 && !multiPartVerses.has(verseNumber)) {
            multiPartVerses.set(verseNumber, count);
          }
        });
        
        // Also check for long verses that might be split
        fetchedVerses.forEach(verse => {
          if (!verse.verse_number) return;
          
          // If verse text is very long (over 230 chars), it will likely be split
          if (verse.verse_text && verse.verse_text.length > 230 && !multiPartVerses.has(verse.verse_number)) {
            // Estimate number of parts based on length
            const estimatedParts = Math.ceil(verse.verse_text.length / 200);
            if (estimatedParts > 1) {
              multiPartVerses.set(verse.verse_number, estimatedParts);
            }
          }
        });
      }
    } catch (error) {
      console.error('Error pre-scanning verses:', error);
    }
    
    // Emit event for each multi-part verse to ensure UI updates immediately
    if (multiPartVerses.size > 0) {
      console.log("Emitting pre-scan multi-part verse info:", 
        Array.from(multiPartVerses.entries())
          .map(([verse, parts]) => `V${verse}(${parts})`)
          .join(', ')
      );
      
      // First emit events for verse detection
      try {
        await Promise.all(
          Array.from(multiPartVerses.entries()).map(([verseNumber, totalParts]) => 
            emit('multi-part-verse-detected', { 
              verseNumber, 
              totalParts 
            })
          )
        );
        console.log('Successfully emitted all multi-part verse detection events');
      } catch (error) {
        console.error('Error emitting multi-part verse detection events:', error);
      }
    }

    // Emit hymn-selected event to Tauri backend
    emit('hymn-selected', hymn);
  }, []);

  const fetchHymns = useCallback(async (lang: string, type: string, searchValue: string = "") => {
    try {
      console.log('Fetching hymns with params:', { lang, type, searchValue });

      const hymnData = await invoke<Hymn[]>('get_hymns', {
        language: lang,
        hymnType: type,
        searchValue
      });

      if (!hymnData) {
        console.error('No hymn data returned from database');
        return;
      }

      console.log(`Successfully loaded ${hymnData.length} hymns`);
      setHymns(hymnData);

      // If we have a search value, try to select the matching hymn
      if (searchValue && hymnData.length > 0) {
        const matchingHymn = hymnData.find(h => h.number.toString() === searchValue);
        if (matchingHymn) {
          await handleHymnSelect(matchingHymn);
        }
      }
    } catch (error) {
      console.error('Failed to load hymns:', error);
      // You might want to show an error message to the user here
    }
  }, [handleHymnSelect]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setShowDropdown(value.length > 0);

    // Reset selectedHymn when search is cleared
    if (!value) {
      setSelectedHymn(null);
    }

    // The fetchHymns will be called by the useEffect with debounce
  };

  const handlePlayClick = async () => {
    if (!selectedHymn) return;

    try {
      if (isPlaying) {
        // Stop playback and cleanup
        await stopHymnDisplay();
      } else {
        // Start playback with error handling
        await startHymnDisplay();
      }
    } catch (error) {
      console.error('Failed to handle play/stop:', error);
      setIsPlaying(false);
      // You might want to show an error message to the user here
    }
  };

  const startHymnDisplay = async () => {
    try {
      // Preload verses before creating windows
      await invoke<Verse[]>('get_verses_for_hymn', { hymnId: selectedHymn!.id });

      const selectedDisplays = await invoke<number[]>('get_selected_displays');
      if (!selectedDisplays.length) {
        throw new Error('No displays selected');
      }

      const monitors = await availableMonitors();
      if (!monitors.length) {
        throw new Error('No monitors available');
      }

      // Initialize verse store with only necessary calls
      useVerseStore.getState().setTotalVerses(selectedHymn!.verses_count);
      useVerseStore.getState().setHasRefrain(selectedHymn!.has_refrain);

      // Start the live stream for hymn display
      await displayStream.startStream({
        type: 'hymn',
        sourceId: selectedHymn!.id.toString(),
        source: 'hymn-selection'
      });

      // Create display windows for each selected monitor
      for (const [index, displayIndex] of selectedDisplays.entries()) {
        const windowLabel = `hymn-window-${index}`;
        const validIndex = Math.min(displayIndex, monitors.length - 1);
        const targetMonitor = monitors[validIndex];

        const webview = new WebviewWindow(windowLabel, {
          url: `/hymn-display?hymn=${encodeURIComponent(JSON.stringify(selectedHymn!))}`,
          width: targetMonitor.size.width,
          height: targetMonitor.size.height,
          x: targetMonitor.position.x,
          y: targetMonitor.position.y
        });

        await new Promise<void>((resolve) => {
          webview.once('tauri://created', async () => {
            await webview.setPosition(new PhysicalPosition(
              targetMonitor.position.x,
              targetMonitor.position.y
            ));
            await webview.setFullscreen(true);
            await webview.show();
            resolve();
          });

          webview.once('tauri://error', (e) => {
            console.error('Error creating window:', e);
            resolve();
          });
        });
      }

      // Emit window update with stream info
      await invoke('emit_main', {
        event: 'window-preview-update',
        payload: { 
          source: 'hymn-selection', 
          displayId: 'hymn', 
          content: selectedHymn!.title,
          isStream: true
        }
      });

      setIsPlaying(true);
      window.dispatchEvent(new Event('startTimer'));
    } catch (error) {
      console.error('Failed to start hymn display:', error);
      throw error;
    }
  };

  const clearProjectionContent = async () => {
    try {
      const projectionWindow = await WebviewWindow.getByLabel('projection');
      if (projectionWindow) {
        // First, clear hymn-specific content
        await projectionWindow.emit('clear-content', { 
          source: 'hymn-selection' 
        });
        console.log('Sent clear-content event for hymn-selection to projection window');
        
        // Then emit a reset-projection event to ensure projection component fully resets
        await projectionWindow.emit('reset-projection', { 
          source: 'hymn-selection' 
        });
        console.log('Sent reset-projection event for hymn-selection to projection window');
        
        // Finally, emit a check-active-windows event to ensure all state is properly cleaned up
        await projectionWindow.emit('check-active-windows', {});
        console.log('Sent check-active-windows event to projection window');
      }
    } catch (error) {
      console.error('Error clearing projection content:', error);
    }
  };

  const stopHymnDisplay = async () => {
    try {
      // Stop the stream but only clear hymn-related content
      await displayStream.stopStream('hymn', 'hymn-selection');

      // Close all hymn windows
      const windows = await invoke<string[]>('get_hymn_windows');
      await Promise.all(windows.map(async (label) => {
        const window = await WebviewWindow.getByLabel(label);
        if (window) {
          await window.close();
        }
      }));

      // Clear only hymn-related preview content
      await invoke('emit_main', {
        event: 'clear-preview',
        payload: { source: 'hymn-selection' }
      });
      
      // Clear projection content
      await clearProjectionContent();
      
      // Trigger a check for active windows to see if we need to clear everything
      const projectionWindow = await WebviewWindow.getByLabel('projection');
      if (projectionWindow) {
        await projectionWindow.emit('check-active-windows', {});
      }

      // Reset hymn-specific states
      setIsPlaying(false);
      setSearchTerm('');
      setSelectedHymn(null);
      
      // Make sure to reset the verse store before dispatching the stop event
      useVerseStore.getState().resetAll();
      
      // Dispatch the stop event after resetting local state
      window.dispatchEvent(new CustomEvent('stopTimer', {
        detail: { source: 'hymn-selection' }
      }));
    } catch (error) {
      console.error('Failed to stop hymn display:', error);
      throw error;
    }
  };

  const handleKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedHymn && !isPlaying) {
      e.preventDefault();
      handlePlayClick();
    }
  };

  useEffect(() => {
    // Use the fetchHymns function for consistency
    fetchHymns(language, hymnType);
  }, [language, hymnType, fetchHymns]);

  useEffect(() => {
    if (showDropdown) {
      inputRef?.focus();
    }
  }, [showDropdown]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        fetchHymns(language, hymnType, searchTerm);
      }
    }, 300); // Add debounce

    return () => clearTimeout(timer);
  }, [searchTerm, language, hymnType, fetchHymns]);

  const filteredHymns = hymns.filter(hymn =>
    hymn.number.toString().includes(searchTerm) ||
    hymn.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!isPlaying) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        await invoke('emit_hymn_navigation', { key: e.key });
      }
    };

    const unsubscribeKeyEvent = listen<{ key: string }>('key-event', (event) => {
      if (isPlaying && event.payload.key === 'ArrowRight') {
        invoke('emit_hymn_navigation', { key: 'ArrowRight' })
          .catch(console.error);
      }
    });

    if (isPlaying) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribeKeyEvent.then(f => f());
    };
  }, [isPlaying]);

  useEffect(() => {
    let unmounted = false;

    // Listen for display-hymn event
    const unlistenDisplayHymn = listen<Hymn>('display-hymn', (event) => {
      if (unmounted) return;

      const hymn = event.payload;
      setLanguage(hymn.language || "AFR");
      setHymnType(hymn.hymn_type || "adventlofliedere");

      // Find the hymn in the list or fetch it
      const foundHymn = hymns.find(h =>
        h.number.toString() === hymn.number.toString() &&
        h.language === hymn.language &&
        h.hymn_type === hymn.hymn_type
      );

      if (foundHymn) {
        handleHymnSelect(foundHymn);
      } else {
        // Fetch and display the hymn
        setSearchTerm(hymn.number.toString() || "");
        setTimeout(() => {
          fetchHymns(hymn.language || "AFR", hymn.hymn_type || "adventlofliedere", hymn.number.toString() || "");
        }, 500);
      }
    });

    return () => {
      unmounted = true;
      unlistenDisplayHymn.then(unsubscribe => unsubscribe());
    };
  }, [hymns, handleHymnSelect, fetchHymns]);

  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        // Get any existing hymn windows
        const existingWindows = await invoke<string[]>('get_hymn_windows');

        // If there are existing windows, we have an active hymn
        if (existingWindows.length > 0) {
          // Get the URL of the first window to extract hymn data
          const windowUrl = await invoke<string>('get_window_url', {
            label: existingWindows[0]
          });

          if (windowUrl) {
            const url = new URL(windowUrl);
            const hymnParam = url.searchParams.get('hymn');
            if (hymnParam) {
              const hymn: Hymn = JSON.parse(decodeURIComponent(hymnParam));
              setSelectedHymn(hymn);
              setSearchTerm(`${hymn.number} - ${hymn.title}`);
              setIsPlaying(true);

              // Restore verse store state
              useVerseStore.getState().setTotalVerses(hymn.verses_count);
              useVerseStore.getState().setHasRefrain(hymn.has_refrain);
            }
          }
        }
      } catch (error) {
        console.error('Failed to restore state:', error);
      }
    };

    loadPersistedState();
  }, []);

  // Add listener for main stop action
  useEffect(() => {
    const handleMainStop = (event: CustomEvent<{ source: string }>) => {
      // Reset state regardless of the source to ensure synchronization
      // This fixes the issue where universal stop doesn't reset hymn-selection
      setIsPlaying(false);
      setSearchTerm('');
      setSelectedHymn(null);
      useVerseStore.getState().resetAll();
      
      // If this component triggered the stop, also clear projection content
      if (event.detail?.source === 'hymn-selection') {
        clearProjectionContent().catch(console.error);
      }
    };

    window.addEventListener('stopTimer', handleMainStop as EventListener);
    return () => {
      window.removeEventListener('stopTimer', handleMainStop as EventListener);
    };
  }, []);

  return (
    <div>
      <div className="flex mt-3 w-full items-center gap-4">
        <QueueMusic className="text-muted-foreground h-9 w-9" />
        <span className="text-foreground text-xl font-medium">Hymn Selection</span>
      </div>
      <div className="flex w-full items-center gap-5 mt-5">
        <div className="relative flex-1">
          <div className="flex h-16 items-center bg-card/5 border border-border rounded-md hover:bg-card/10">
            <div className="h-full w-16 flex items-center justify-center bg-card-background border-r border-border">
              <MusicNote className="h-9 w-9 text-muted-foreground" />
            </div>
            <input
              ref={setInputRef}
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Select a hymn..."
              className="flex-1 h-full px-4 text-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="px-4">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
          {showDropdown && filteredHymns.length > 0 && (
            <div
              className="absolute w-full mt-1 py-1 rounded-md bg-card border border-border shadow-md"
              style={{ zIndex: 50 }}
            >
              <div className="max-h-[300px] overflow-y-auto">
                {filteredHymns.map(hymn => (
                  <div
                    key={hymn.id}
                    onClick={() => handleHymnSelect(hymn)}
                    className="px-4 py-3 hover:bg-accent hover:text-accent-foreground cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-medium">{hymn.number}</span>
                        <span className="text-lg">{hymn.title}</span>
                      </div>
                      {hymn.key_signature && (
                        <span className="text-sm text-muted-foreground">
                          {hymn.key_signature}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <ComboBox
          items={availableHymnTypes}
          selectedValue={hymnType}
          onOpenChange={setOpenHymnType}
          onSelect={handleHymnTypeChange}
          placeholder="Select Hymnal"
          icon={<AutoStories className="h-9 w-9 shrink-0 opacity-80" />}
          open={openHymnType}
        />
        <ComboBox
          items={LANGUAGES}
          selectedValue={language}
          onOpenChange={setOpenLanguage}
          onSelect={handleLanguageChange}
          placeholder="Language"
          icon={<Language className="h-9 w-9 shrink-0 opacity-80" />}
          open={openLanguage}
        />
        <Button
          onClick={handlePlayClick}
          disabled={!selectedHymn}
          className={cn(
            "text-xl w-16 h-16",
            isPlaying
              ? "bg-red-500/25 text-red-500 hover:text-red-600 hover:bg-red-500/30"
              : selectedHymn
                ? "bg-green-500/25 text-green-500 hover:text-green-600 hover:bg-green-500/30"
                : "text-muted-foreground bg-card-background"
          )}
        >
          {isPlaying ? (
            <Stop className="h-10 w-10" />
          ) : (
            <PlayArrow className="h-10 w-10" />
          )}
        </Button>
      </div>
    </div>
  );
};

export default HymnSelection;
