"use client"

import { Icon, Card } from '@gravity-ui/uikit'
import { MusicNote } from '@gravity-ui/icons'
import useVerseStore from "@/lib/store";
import { cn } from "@/lib/utils";
import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { useCallback, useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DisplayContent {
  type: 'title' | 'verse' | 'refrain' | 'blank';
  number?: number;
  text?: string;
  content?: string;
  part?: number;
  totalParts?: number;
}

interface VerseChangedEvent {
  payload: {
    verseNumber: number | null;
    part: number | null;
    totalParts: number | null;
  };
}

type VerseChangedPayload = {
  verseNumber: number | null;
  part: number | null;
  totalParts: number | null;
};

interface VersePartInfo {
  verseNumber: number;
  totalParts: number;
  activePart: number | null;
  fromEvent: boolean;
}

export default function VerseSelector() {
  const {
    activeVerse,
    setActiveVerse,
    totalVerses,
    resetAll,
    hasRefrain,
    sequence,
    setSequence,
    currentSequenceIndex,
    setCurrentSequenceIndex,
    displayContents,
  } = useVerseStore();

  // Track split verses and their active parts
  const [splitVerses, setSplitVerses] = useState<VersePartInfo[]>([]);
  const [activeRefrainPart, setActiveRefrainPart] = useState<{ part: number | null, totalParts: number | null }>({
    part: null,
    totalParts: null
  });
  
  // Debug state to track processed events
  const [processedEvents, setProcessedEvents] = useState<Set<string>>(new Set());
  
  // Scan display contents for multi-part verses when they change or when we receive events
  useEffect(() => {
    if (!displayContents || displayContents.length === 0) return;
    
    console.log('Scanning displayContents for multi-part verses...', {
      totalVerses,
      displayContentsLength: displayContents.length
    });
    
    const newSplitVerses: VersePartInfo[] = [];
    const processedVerses = new Set<number>();
    
    // First pass: look for explicit part and totalParts information
    displayContents.forEach(content => {
      if (content.type !== 'verse' || !content.number) return;
      const verseNumber = content.number;
      
      // Only process each verse number once
      if (processedVerses.has(verseNumber)) return;
      
      // Check if this verse has explicit part information
      if (content.totalParts && content.totalParts > 1) {
        console.log(`Found multi-part verse ${verseNumber} with ${content.totalParts} parts`);
        newSplitVerses.push({
          verseNumber,
          totalParts: content.totalParts,
          activePart: content.part || null,
          fromEvent: false
        });
        processedVerses.add(verseNumber);
      }
    });
    
    // Second pass: count occurrences of each verse number
    const verseCounts = new Map<number, number>();
    
    displayContents.forEach(content => {
      if (content.type !== 'verse' || !content.number) return;
      const verseNumber = content.number;
      
      // Skip verses we've already identified as multi-part
      if (processedVerses.has(verseNumber)) return;
      
      const currentCount = verseCounts.get(verseNumber) || 0;
      verseCounts.set(verseNumber, currentCount + 1);
    });
    
    // Add verses that appear multiple times
    verseCounts.forEach((count, verseNumber) => {
      if (count > 1) {
        console.log(`Found verse ${verseNumber} appearing ${count} times`);
        processedVerses.add(verseNumber);
        newSplitVerses.push({
          verseNumber,
          totalParts: count,
          activePart: null,
          fromEvent: false
        });
      }
    });
    
    // Update the splitVerses state, preserving any existing active part information
    setSplitVerses(prev => {
      // Only update if we have new information or if this is the first load
      if (newSplitVerses.length === 0 && prev.length > 0) return prev;
      
      // Merge existing active part information with new detection
      const merged = newSplitVerses.map(newVerseInfo => {
        const existing = prev.find(p => p.verseNumber === newVerseInfo.verseNumber);
        if (existing) {
          return {
            ...newVerseInfo,
            activePart: existing.activePart,
            fromEvent: existing.fromEvent || newVerseInfo.fromEvent
          };
        }
        return newVerseInfo;
      });
      
      console.log('Updated splitVerses:', merged);
      return merged;
    });
  }, [displayContents, totalVerses]);
  
  // Removed debug subscribe (type mismatch); relying on existing effects

  useEffect(() => {
    const setupListener = async () => {
      try {
        const unsubscribe = await listen<VerseChangedPayload>('verse-changed', (event) => {
          console.log('Received verse change event:', event.payload);
          handleVerseChanged({ payload: event.payload });
        });
        
        return unsubscribe;
      } catch (error) {
        console.error('Error setting up verse-changed listener:', error);
        return null;
      }
    };
    
    const unsubPromise = setupListener();
    
    return () => {
      unsubPromise.then(unsub => {
        if (unsub) unsub();
      }).catch(err => {
        console.error('Error during cleanup of verse-changed listener:', err);
      });
      
      resetAll();
    };
  }, [resetAll]);

  useEffect(() => {
    console.log('Current sequence index changed:', currentSequenceIndex);
    
    if (!displayContents || displayContents.length === 0 || currentSequenceIndex === undefined) {
      console.log('No displayContents or currentSequenceIndex available');
      return;
    }
    
    if (currentSequenceIndex < 0 || currentSequenceIndex >= displayContents.length) {
      console.log(`Current index ${currentSequenceIndex} out of bounds (0-${displayContents.length - 1})`);
      return;
    }
    
    const currentContent = displayContents[currentSequenceIndex];
    console.log('Current content:', currentContent);
    
    if (currentContent.type === 'verse' && currentContent.number !== undefined) {
      console.log(`Setting active verse to ${currentContent.number}`);
      // Update active verse in store
      setActiveVerse(currentContent.number as number);
      
      // If this verse has multiple parts, update active part
      if (currentContent.part !== undefined && currentContent.totalParts && currentContent.totalParts > 1) {
        console.log(`Setting active part for verse ${currentContent.number} to ${currentContent.part}/${currentContent.totalParts}`);
        
        // Update split verses state
        setSplitVerses(prev => {
          return prev.map(v => {
            if (v.verseNumber === currentContent.number) {
              return { ...v, activePart: currentContent.part ?? null };
            }
            return v;
          });
        });
      }
    } else if (currentContent.type === 'refrain') {
      console.log('Setting active verse to refrain');
      // Update active verse in store
      setActiveVerse(-1);
      
      // If refrain has multiple parts, update active part
      if (currentContent.part !== undefined && currentContent.totalParts && currentContent.totalParts > 1) {
        console.log(`Setting active refrain part to ${currentContent.part}/${currentContent.totalParts}`);
        setActiveRefrainPart(prev => ({
          ...prev,
          part: currentContent.part ?? null
        }));
      }
    }
  }, [currentSequenceIndex, displayContents, setActiveVerse]);

  // Handle verse changed events from backend
  const handleVerseChanged = useCallback(async (event: VerseChangedEvent) => {
    if (!event || !event.payload) return;
    
    const { verseNumber, part, totalParts } = event.payload;
    
    // Create a unique ID for this event to prevent duplicate processing
    const eventId = `${verseNumber}-${part}-${totalParts}`;
    
    // Skip if we've already processed this event
    if (processedEvents.has(eventId)) return;
    
    console.log(`Verse changed event: verse=${verseNumber}, part=${part}, totalParts=${totalParts}`);
    setProcessedEvents(prev => new Set(prev).add(eventId));
    
    // Special case for refrain
    if (verseNumber === -1) {
      setActiveVerse(-1);
      setActiveRefrainPart({ part, totalParts });
      return;
    }
    
    // Special case for title
    if (verseNumber === 0) {
      setActiveVerse(0);
      return;
    }
    
    // Set active verse and update UI
    if (verseNumber !== null) {
      setActiveVerse(verseNumber);
      
      // CRITICAL: If we receive part information, directly use it to update splitVerses
      // regardless of what displayContents shows
      if (totalParts && totalParts > 1) {
        console.log(`Updating split verse info for verse ${verseNumber}: part=${part}, totalParts=${totalParts}`);
        
        setSplitVerses(prev => {
          // Check if this verse is already in our splitVerses array
          const existingIndex = prev.findIndex(v => v.verseNumber === verseNumber);
          
          if (existingIndex >= 0) {
            // Update the existing verse info
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              totalParts,
              activePart: part,
              fromEvent: true
            };
            console.log('Updated existing split verse:', updated[existingIndex]);
            return updated;
          } else {
            // Add a new entry
            const newEntry = {
              verseNumber,
              totalParts,
              activePart: part,
              fromEvent: true
            };
            console.log('Adding new split verse:', newEntry);
            return [...prev, newEntry];
          }
        });
      } else if (part !== null) {
        // Single part verse, update active part if this verse is in splitVerses
        setSplitVerses(prev => 
          prev.map(v => 
            v.verseNumber === verseNumber 
              ? { ...v, activePart: part, fromEvent: true } 
              : v
          )
        );
      }
    }
  }, [processedEvents, setActiveVerse]);

  const handleVerseClick = useCallback((verseNumber: number) => {
    // Retrieve displayContents directly from the store to ensure we have the latest value
    const storeState = useVerseStore.getState();
    const currentDisplayContents = storeState.displayContents;
    console.log(`Verse ${verseNumber} clicked. Checking display contents...`, {
      displayContentsLength: currentDisplayContents?.length || 0,
      totalVerses: storeState.totalVerses,
      hasRefrain: storeState.hasRefrain
    });

    if (!currentDisplayContents || currentDisplayContents.length === 0) {
      console.error('No display contents available in the store. This may indicate that the hymn data has not been properly loaded.');
      
      // Try to navigate directly to the verse without relying on displayContents
      try {
        emit('hymn-navigation', { key: `goto-verse-${verseNumber}` })
          .catch(error => {
            console.error(`Error navigating to verse ${verseNumber} using fallback method:`, error);
          });
        return;
      } catch (error) {
        console.error(`Failed to use fallback navigation method for verse ${verseNumber}:`, error);
        return;
      }
    }
    
    // Find all indices for this verse in the displayContents
    const verseIndices = currentDisplayContents
      .map((content, index) => {
        if (content.type === 'verse' && content.number === verseNumber) {
          return index;
        }
        return -1;
      })
      .filter(idx => idx !== -1);
    
    console.log(`Found verse ${verseNumber} at indices:`, verseIndices);
    
    if (verseIndices.length > 0) {
      // Go to the first part of the verse
      const targetIndex = verseIndices[0];
      console.log(`Navigating to verse ${verseNumber} at index ${targetIndex}`);
      
      emit('hymn-navigation', { key: `goto-index-${targetIndex}` })
        .catch(error => {
          console.error(`Error navigating to verse ${verseNumber}:`, error);
        });
    } else {
      console.warn(`Could not find verse ${verseNumber} in display contents`);
    }
  }, []); // No dependencies since we're getting fresh state directly from the store

  // Fixed implementation of handlePartClick to properly navigate
  const handlePartClick = useCallback((verseNumber: number, partNumber: number) => {
    console.log(`Verse ${verseNumber}, Part ${partNumber} clicked`);
    
    // First, update the split verses state to show the selected part as active
    setSplitVerses(prev => 
      prev.map(v => 
        v.verseNumber === verseNumber 
          ? { ...v, activePart: partNumber } 
          : v
      )
    );
    
    // Try to navigate using event emission
    try {
      // Start by setting the active verse
      setActiveVerse(verseNumber);
      
      // Emit an event to navigate to this verse part
      emit('hymn-verse-part-navigation', { 
        verseNumber, 
        partNumber 
      }).catch(error => {
        console.error(`Error emitting navigation event:`, error);
      });
    } catch (error) {
      console.error(`Error handling part click:`, error);
    }
  }, [setActiveVerse]);

  const handleRefrainPartClick = useCallback((partNumber: number) => {
    console.log(`Refrain part ${partNumber} clicked`);
    
    // Get fresh display contents from the store
    const currentDisplayContents = useVerseStore.getState().displayContents;
    
    if (!currentDisplayContents || currentDisplayContents.length === 0) {
      console.error('No display contents available in the store');
      return;
    }
    
    // Find the specific part in displayContents
    const targetIndex = currentDisplayContents.findIndex(content => 
      content.type === 'refrain' && 
      content.part === partNumber
    );
    
    if (targetIndex !== -1) {
      console.log(`Navigating to refrain part ${partNumber} at index ${targetIndex}`);
      
      emit('hymn-navigation', { key: `goto-index-${targetIndex}` })
        .catch(error => {
          console.error(`Error navigating to refrain part ${partNumber}:`, error);
        });
    } else {
      console.warn(`Could not find refrain part ${partNumber} in display contents`);
    }
  }, []);

  // Utility function to find if a verse has multiple parts
  const getVersePartInfo = (verseNumber: number): VersePartInfo | undefined => {
    // First check the splitVerses state which gets directly updated from events
    const stateInfo = splitVerses.find(v => v.verseNumber === verseNumber);
    if (stateInfo) {
      return stateInfo;
    }
    
    // Check for explicit part information in displayContents as a fallback
    if (displayContents && displayContents.length > 0 && totalVerses > 0) {
      // Count occurrences of this verse number
      const occurrences = displayContents.filter(c => 
        c.type === 'verse' && c.number === verseNumber
      );
      
      if (occurrences.length > 1) {
        return {
          verseNumber,
          totalParts: occurrences.length,
          activePart: activeVerse === verseNumber ? 
            (occurrences.find(c => c.part)?.part || null) : null,
          fromEvent: false
        };
      }
      
      // Check if any occurrences have part info
      const withPartInfo = occurrences.find(c => c.totalParts && c.totalParts > 1);
      if (withPartInfo) {
        return {
          verseNumber,
          totalParts: withPartInfo.totalParts as number,
          activePart: activeVerse === verseNumber ? withPartInfo.part || null : null,
          fromEvent: false
        };
      }
    }
    
    // No part info found
    return undefined;
  };

  // (Removed duplicate multi-part-verse-detected effect to avoid double listeners in Strict Mode)


  useEffect(() => {
    const unlisten = listen<{verseNumber: number, totalParts: number}>('multi-part-verse-detected', (event) => {
      if (!event.payload) return;
      
      const { verseNumber, totalParts } = event.payload;
      console.log(`Received multi-part verse detection event: verse=${verseNumber}, totalParts=${totalParts}`);
      
      if (totalParts > 1) {
        setSplitVerses(prev => {
          // Check if this verse is already in our splitVerses array
          const existingIndex = prev.findIndex(v => v.verseNumber === verseNumber);
          
          if (existingIndex >= 0) {
            // Update the existing verse info
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              totalParts,
              fromEvent: true
            };
            return updated;
          } else {
            // Add a new entry
            return [...prev, {
              verseNumber,
              totalParts,
              activePart: null,
              fromEvent: true
            }];
          }
        });
      }
    });
    
    // Also listen for hymn-selected event from the custom DOM event
    const handleHymnSelectedDomEvent = (event: CustomEvent) => {
      console.log('Verse selector received hymn-selected DOM event, resetting state');
      resetAll();
      setSplitVerses([]);
      setActiveRefrainPart({ part: null, totalParts: null });
      setProcessedEvents(new Set());
    };
    
    window.addEventListener('hymn-selected', handleHymnSelectedDomEvent as EventListener);
    
    return () => {
      unlisten.then(f => f());
      window.removeEventListener('hymn-selected', handleHymnSelectedDomEvent as EventListener);
    };
  }, [resetAll]);


  // Add listener for stopTimer event to reset verse selector state
  useEffect(() => {
    const handleStopTimer = (event: CustomEvent<{ source: string }>) => {
      // Reset the verse selector state when hymn stops displaying
      console.log('Verse selector received stopTimer event');
      resetAll();
      setSplitVerses([]);
      setActiveRefrainPart({ part: null, totalParts: null });
      setProcessedEvents(new Set());
    };

    // Also listen for hymn-selected event to reset state when a new hymn is selected
    const handleHymnSelected = () => {
      console.log('Verse selector received hymn-selected event, resetting state');
      resetAll();
      setSplitVerses([]);
      setActiveRefrainPart({ part: null, totalParts: null });
      setProcessedEvents(new Set());
    };

    window.addEventListener('stopTimer', handleStopTimer as EventListener);
    window.addEventListener('hymn-selected', handleHymnSelected as EventListener);
    
    return () => {
      window.removeEventListener('stopTimer', handleStopTimer as EventListener);
      window.removeEventListener('hymn-selected', handleHymnSelected as EventListener);
    };
  }, [resetAll]);

  return (
    <div className="flex-1">
      <div className="flex justify-start items-center gap-3 min-w-[180px]">
        <Icon data={MusicNote} size={20} />
        <span className="text-foreground text-base font-medium">Verses</span>
      </div>
      
      <Card className="h-72 w-full mt-3 bg-card-background border border-border min-w-[180px] p-3">
        <div className="grid gap-3 grid-cols-2 grid-rows-4 w-full h-full">
          {[...Array(6)].map((_, idx) => {
            const verseNumber = idx + 1;
            const isActive = activeVerse === verseNumber;
            // Only disable if a hymn is selected (totalVerses > 0) and verse number exceeds total verses
            const isDisabled = totalVerses > 0 && verseNumber > totalVerses;
            const versePartInfo = getVersePartInfo(verseNumber);
            
            // Check if this verse has multiple parts
            const hasParts = versePartInfo && versePartInfo.totalParts > 1;

            return (
              <div 
                key={`v${verseNumber}`} 
                className="flex flex-row h-14 gap-1 items-center w-full"
              >
                {/* Main verse button - adjust width for consistent overall space */}
                <div
                  className={cn(
                    "flex items-center justify-center transition-all duration-200 rounded-md border h-full",
                    isDisabled ? "opacity-50 cursor-not-allowed bg-background/5" : "cursor-pointer bg-foreground/5 hover:bg-foreground/10",
                    "border-foreground/10",
                    isActive && !isDisabled && "bg-green-500/25 ring-1 ring-primary ring-offset-1 ring-offset-background",
                    hasParts ? "w-16" : "w-full" // Wider to match total space with indicators
                  )}
                  onClick={() => !isDisabled && handleVerseClick(verseNumber)}
                >
                  <span className={cn(
                    "text-base font-medium",
                    isDisabled ? "text-muted-foreground" : "text-foreground"
                  )}>
                    {verseNumber}
                  </span>
                </div>
                
                {/* Part indicators beside verse */}
                {hasParts && (
                  <div className="flex flex-col gap-1 h-full justify-center flex-1">
                    {[...Array(versePartInfo?.totalParts || 2)].map((_, i) => {
                      const partNum = i + 1;
                      
                      // Only show as active if this verse is the active verse AND the part is active
                      const isActivePartNum = isActive && versePartInfo?.activePart === partNum;
                      
                      return (
                        <div 
                          key={`indicator-${verseNumber}-${partNum}`}
                          className={cn(
                            "h-[45%] rounded flex items-center justify-center cursor-pointer shadow-sm", 
                            isActivePartNum 
                              ? "bg-green-500/25 text-foreground border border-primary" 
                              : "bg-card-background text-foreground/25 hover:bg-foreground/10 border border-foreground/30"
                          )}
                          onClick={() => handlePartClick(verseNumber, partNum)}
                        >
                          <span className="text-xs font-medium">{partNum}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Refrain button */}
          <div className="col-span-2 flex flex-row h-14 gap-1 items-center">
            {/* Main refrain button - make it smaller if it has parts */}
            <div
              className={cn(
                "flex items-center justify-center transition-all duration-200 rounded-md border h-full",
                totalVerses > 0 && !hasRefrain ? "opacity-50 cursor-not-allowed bg-background/5" : "cursor-pointer bg-foreground/5 hover:bg-foreground/10",
                "border-foreground/10",
                activeVerse === -1 && hasRefrain && "bg-green-500/25 ring-1 ring-primary ring-offset-1 ring-offset-background",
                activeRefrainPart.totalParts && activeRefrainPart.totalParts > 1 ? "w-1/3" : "w-full"
              )}
              onClick={() => {
                if (!totalVerses || hasRefrain) {
                  // Get fresh display contents from the store
                  const storeState = useVerseStore.getState();
                  const currentDisplayContents = storeState.displayContents;
                  console.log('Refrain button clicked. Checking display contents...');
                  
                  if (!currentDisplayContents || currentDisplayContents.length === 0) {
                    console.error('No display contents available in the store');
                    // Try fallback navigation method
                    emit('hymn-navigation', { key: 'goto-verse--1' })
                      .catch(error => {
                        console.error('Error navigating to refrain using fallback method:', error);
                      });
                    return;
                  }
                  
                  // Find all indices for refrain in the displayContents
                  const refrainIndices = currentDisplayContents
                    .map((content, index) => {
                      if (content.type === 'refrain') {
                        return index;
                      }
                      return -1;
                    })
                    .filter(idx => idx !== -1);
                  
                  console.log(`Found refrain at indices:`, refrainIndices);
                  
                  if (refrainIndices.length > 0) {
                    // Go to the first refrain
                    const targetIndex = refrainIndices[0];
                    console.log(`Navigating to refrain at index ${targetIndex}`);
                    
                    emit('hymn-navigation', { key: `goto-index-${targetIndex}` })
                      .catch(error => {
                        console.error(`Error navigating to refrain:`, error);
                      });
                  } else {
                    console.warn('Could not find refrain in display contents');
                    // Try fallback navigation method
                    emit('hymn-navigation', { key: 'goto-verse--1' })
                      .catch(error => {
                        console.error('Error navigating to refrain using fallback method:', error);
                      });
                  }
                }
              }}
            >
              <span className={cn(
                "text-sm font-medium whitespace-nowrap",
                totalVerses > 0 && !hasRefrain ? "text-muted-foreground" : "text-foreground"
              )}>
                {activeRefrainPart.totalParts && activeRefrainPart.totalParts > 1 ? "Ref" : "Refrain"}
              </span>
            </div>
            
            {/* Refrain part indicators */}
            {activeRefrainPart.totalParts && activeRefrainPart.totalParts > 1 && (
              <div className="flex flex-row gap-1 h-full items-center flex-1 ml-1">
                {[...Array(activeRefrainPart.totalParts)].map((_, i) => {
                  const partNum = i + 1;
                  const isActivePartNum = activeRefrainPart.part === partNum;
                  
                  return (
                    <div 
                      key={`refrain-indicator-${partNum}`}
                      className={cn(
                        "h-full flex-1 rounded flex items-center justify-center cursor-pointer shadow-sm",
                        isActivePartNum 
                          ? "bg-primary text-primary-foreground border border-primary" 
                          : "bg-card-background text-foreground hover:bg-foreground/10 border border-foreground/30"
                      )}
                      onClick={() => handleRefrainPartClick(partNum)}
                    >
                      <span className="text-xs font-medium">{partNum}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
