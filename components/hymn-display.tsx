import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import useVerseStore from '@/lib/store';
import { emit } from '@tauri-apps/api/event';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Hymn {
  id: number;
  number: number;
  title: string;
  verses_count: number;
  has_refrain: boolean;
  refrain_text: string | null;
  key_signature: string | null;
  author: string | null;
  language: string;
}

interface Verse {
  verse_number: number;
  verse_text: string;
}

interface DisplayContent {
  type: 'title' | 'verse' | 'refrain' | 'blank';
  number?: number | null;
  content?: string | null;
  metadata?: {
    verses?: string;
    key?: string;
  } | null;
  part?: number;
  totalParts?: number;
}

export function HymnDisplay() {
  const searchParams = useSearchParams();
  const hymnQuery = searchParams.get('hymn');
  
  const [hymn, setHymn] = useState<Hymn | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [displayContents, setDisplayContents] = useState<DisplayContent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [displayedContent, setDisplayedContent] = useState<DisplayContent | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setTotalVerses, setHasRefrain, setSequence, verseStates, resetAll } = useVerseStore();
  const [currentVerse, setCurrentVerse] = useState(0); // Start at 0 for title
  const [isInitializing, setIsInitializing] = useState(true);

  const validateContent = useCallback((content: DisplayContent | null): boolean => {
    return !!content &&
           typeof content === 'object' &&
           typeof content === 'object' &&
           typeof content.type === 'string' &&
           ['title', 'verse', 'refrain', 'blank'].includes(content.type);
  }, []);

  const initializeContent = useCallback((content: DisplayContent) => {
    if (!content) return null;
    
    console.log('Initializing content:', JSON.stringify(content, null, 2));
    
    if (content.type === 'verse') {
      return {
        ...content,
        type: 'verse',
        number: content.number,
        content: content.content,
        part: content.part,
        totalParts: content.totalParts
      };
    }
    
    if (content.type === 'refrain') {
      return {
        ...content,
        type: 'refrain',
        content: content.content,
        part: content.part,
        totalParts: content.totalParts
      };
    }
    
    if (content.type === 'title') {
      return {
        ...content,
        type: 'title',
        content: content.content
      };
    }
    
    if (content.type === 'blank') {
      return {
        ...content,
        type: 'blank'
      };
    }
    
    return null;
  }, []);

  const splitTextIntoEvenParts = (text: string | null | undefined): string[] => {
    if (!text) return [''];
    
    console.log('Splitting text of length:', text.length);
    
    // For very short text, don't split
    if (text.length <= 180) {
      console.log('Text is shorter than minimum split threshold (180 chars), not splitting');
      return [text];
    }
    
    // Always split text longer than this threshold
    const FORCE_SPLIT_THRESHOLD = 230;
    
    const midPoint = Math.floor(text.length / 2);
    console.log('Midpoint is at:', midPoint);
    
    const searchRange = Math.min(100, Math.floor(text.length / 3));
    const startSearch = Math.max(0, midPoint - searchRange);
    const endSearch = Math.min(text.length, midPoint + searchRange);
    
    console.log(`Searching for break points between positions ${startSearch} and ${endSearch}`);
    
    if (text.length > FORCE_SPLIT_THRESHOLD) {
      console.log(`Text exceeds force split threshold (${FORCE_SPLIT_THRESHOLD}), will split even if no natural breaks found`);
    } else {
      console.log(`Text is ${text.length} chars, between min (180) and force (${FORCE_SPLIT_THRESHOLD}) thresholds`);
    }
    
    const paragraphBreaks = [];
    let searchText = text.substring(startSearch, endSearch);
    
    let paragraphIndex = searchText.indexOf('\n\n');
    while (paragraphIndex !== -1) {
      paragraphBreaks.push(startSearch + paragraphIndex);
      paragraphIndex = searchText.indexOf('\n\n', paragraphIndex + 2);
    }
    
    let newlineIndex = searchText.indexOf('\n');
    while (newlineIndex !== -1) {
      if (!paragraphBreaks.includes(startSearch + newlineIndex)) {
        paragraphBreaks.push(startSearch + newlineIndex);
      }
      newlineIndex = searchText.indexOf('\n', newlineIndex + 1);
    }
    
    console.log('Found paragraph/newline breaks near midpoint:', paragraphBreaks);
    
    if (paragraphBreaks.length > 0) {
      let closestBreak = paragraphBreaks[0];
      let minDistance = Math.abs(closestBreak - midPoint);
      
      for (const breakPoint of paragraphBreaks) {
        const distance = Math.abs(breakPoint - midPoint);
        if (distance < minDistance) {
          minDistance = distance;
          closestBreak = breakPoint;
        }
      }
      
      console.log('Using paragraph/newline break at:', closestBreak);
      const isDoubleNewline = text.substring(closestBreak, closestBreak + 2) === '\n\n';
      return [
        text.substring(0, closestBreak).trim(),
        text.substring(closestBreak + (isDoubleNewline ? 2 : 1)).trim()
      ];
    }
    
    const sentenceEndings = [];
    for (let i = startSearch; i < endSearch; i++) {
      const char = text[i];
      if (char === '.' || char === '!' || char === '?') {
        if (i + 1 < text.length && (text[i + 1] === ' ' || text[i + 1] === '\n')) {
          sentenceEndings.push(i);
        }
      }
    }
    
    console.log('Found sentence endings near midpoint:', sentenceEndings);
    
    if (sentenceEndings.length > 0) {
      let closestBreak = sentenceEndings[0];
      let minDistance = Math.abs(closestBreak - midPoint);
      
      for (const breakPoint of sentenceEndings) {
        const distance = Math.abs(breakPoint - midPoint);
        if (distance < minDistance) {
          minDistance = distance;
          closestBreak = breakPoint;
        }
      }
      
      console.log('Using sentence break at:', closestBreak);
      return [
        text.substring(0, closestBreak + 1).trim(),
        text.substring(closestBreak + 1).trim()
      ];
    }
    
    const commaBreaks = [];
    for (let i = startSearch; i < endSearch; i++) {
      if (text[i] === ',') {
        commaBreaks.push(i);
      }
    }
    
    console.log('Found comma breaks near midpoint:', commaBreaks);
    
    if (commaBreaks.length > 0) {
      let closestBreak = commaBreaks[0];
      let minDistance = Math.abs(closestBreak - midPoint);
      
      for (const breakPoint of commaBreaks) {
        const distance = Math.abs(breakPoint - midPoint);
        if (distance < minDistance) {
          minDistance = distance;
          closestBreak = breakPoint;
        }
      }
      
      console.log('Using comma break at:', closestBreak);
      return [
        text.substring(0, closestBreak + 1).trim(),
        text.substring(closestBreak + 1).trim()
      ];
    }
    
    const spaceBreaks = [];
    for (let i = startSearch; i < endSearch; i++) {
      if (text[i] === ' ') {
        spaceBreaks.push(i);
      }
    }
    
    console.log('Found space breaks near midpoint:', spaceBreaks);
    
    if (spaceBreaks.length > 0) {
      let closestBreak = spaceBreaks[0];
      let minDistance = Math.abs(closestBreak - midPoint);
      
      for (const breakPoint of spaceBreaks) {
        const distance = Math.abs(breakPoint - midPoint);
        if (distance < minDistance) {
          minDistance = distance;
          closestBreak = breakPoint;
        }
      }
      
      console.log('Using space break at:', closestBreak);
      return [
        text.substring(0, closestBreak).trim(),
        text.substring(closestBreak).trim()
      ];
    }
    
    if (text.length > FORCE_SPLIT_THRESHOLD) {
      console.log('No good break points found, forcing split at midpoint because text exceeds threshold');
      return [
        text.substring(0, midPoint).trim(),
        text.substring(midPoint).trim()
      ];
    }
    
    console.log('Text has no natural break points and is below force threshold - not splitting');
    return [text];
  };

  const createDisplayContents = useCallback((fetchedVerses: Verse[], currentHymn: Hymn) => {
    console.log('Creating display contents');
    
    // Debug the input
    console.log('Fetched verses:', JSON.stringify(fetchedVerses, null, 2));
    console.log('Current hymn:', JSON.stringify({
      id: currentHymn.id,
      number: currentHymn.number,
      title: currentHymn.title,
      verses_count: currentHymn.verses_count,
      has_refrain: currentHymn.has_refrain,
      refrain_length: currentHymn.refrain_text?.length || 0
    }, null, 2));
    
    const contents: DisplayContent[] = [
      {
        type: 'title',
        content: currentHymn ? `${currentHymn.number} - ${currentHymn.title}` : ''
      }
    ];

    fetchedVerses.forEach((verse, verseIndex) => {
      console.log(`Processing verse ${verse.verse_number}, text length: ${verse.verse_text?.length || 0}`);
      
      const verseParts = splitTextIntoEvenParts(verse.verse_text);
      console.log(`Verse ${verse.verse_number} split into ${verseParts.length} parts`);
      
      if (verseParts.length > 1) {
        // Add multiple parts of the verse
        verseParts.forEach((part, index) => {
          console.log(`Adding verse ${verse.verse_number}-${index + 1}/${verseParts.length} with length ${part.length}`);
          contents.push({
            type: 'verse',
            number: verse.verse_number,
            content: part,
            part: index + 1,
            totalParts: verseParts.length
          });
        });
      } else {
        // Just add the verse as a single slide
        console.log(`Adding verse ${verse.verse_number} as a single slide`);
        // Still set part=1 and totalParts=1 for consistency
        contents.push({
          type: 'verse',
          number: verse.verse_number,
          content: verseParts[0],
          part: 1,
          totalParts: 1
        });
      }

      // After each verse, add a refrain if the hymn has one
      if (currentHymn.has_refrain && currentHymn.refrain_text) {
        // Add refrain after each verse except the last one
        if (verseIndex < fetchedVerses.length - 1) {
          console.log(`Adding refrain after verse ${verse.verse_number}, text length: ${currentHymn.refrain_text?.length || 0}`);
          
          const refrainParts = splitTextIntoEvenParts(currentHymn.refrain_text);
          console.log(`Refrain split into ${refrainParts.length} parts`);
          
          if (refrainParts.length > 1) {
            // Add multiple parts of the refrain
            refrainParts.forEach((part, index) => {
              console.log(`Adding refrain part ${index + 1}/${refrainParts.length} with length ${part.length}`);
              contents.push({
                type: 'refrain',
                content: part,
                part: index + 1,
                totalParts: refrainParts.length
              });
            });
          } else {
            // Just add the refrain as a single slide
            console.log('Adding refrain as a single slide');
            contents.push({
              type: 'refrain',
              content: refrainParts[0],
              part: 1,
              totalParts: 1
            });
          }
        }
      }
    });

    // Add a blank slide at the end
    contents.push({
      type: 'blank'
    });

    console.log('Final display contents structure:', JSON.stringify(contents.map(c => ({
      type: c.type,
      number: c.number,
      part: c.part,
      totalParts: c.totalParts
    })), null, 2));
    
    // Update Zustand store
    console.log('Updating store with displayContents - length:', contents.length);
    const sequence = contents.map(content => content.type);
    useVerseStore.getState().setSequence(sequence);
    useVerseStore.getState().setDisplayContents(contents);
    
    // Update component state
    setDisplayContents(contents);
    setDisplayedContent(null);
    
    return contents;
  }, [setDisplayContents, setDisplayedContent, splitTextIntoEvenParts]);

  const fetchVerses = useCallback(async (hymnId: number, currentHymn: Hymn) => {
    try {
      console.log('Fetching verses for hymn ID:', hymnId);
      const fetchedVerses = await invoke<Verse[]>('get_verses_for_hymn', { hymnId });
      console.log('Fetched verses:', fetchedVerses);
      setVerses(fetchedVerses);
      createDisplayContents(fetchedVerses, currentHymn);
    } catch (error) {
      console.error('Failed to fetch verses:', error);
      setError('Failed to fetch verses');
    }
  }, [createDisplayContents]);

  const buildSequence = useCallback((fetchedVerses: Verse[], currentHymn: Hymn) => {
    const sequence: ('title' | 'verse' | 'refrain' | 'blank')[] = ['title'];

    for (let i = 0; i < currentHymn.verses_count; i++) {
      sequence.push('verse');
      if (currentHymn.has_refrain) {
        sequence.push('refrain');
      }
    }
    sequence.push('blank');
    return sequence;
  }, []);

  useEffect(() => {
    const initializeHymn = async () => {
      const hymnParam = searchParams.get('hymn');
      if (!hymnParam) {
        setError('No hymn data provided');
        setIsInitializing(false);
        return;
      }

      try {
        const parsedHymn: Hymn = JSON.parse(decodeURIComponent(hymnParam));
        setHymn(parsedHymn);

        const fetchedVerses = await invoke<Verse[]>('get_verses_for_hymn', { hymnId: parsedHymn.id });
        setVerses(fetchedVerses);

        setTotalVerses(parsedHymn.verses_count);
        setHasRefrain(parsedHymn.has_refrain);

        const sequence = buildSequence(fetchedVerses, parsedHymn);
        setSequence(sequence);

        const contents = createDisplayContents(fetchedVerses, parsedHymn);
        setDisplayContents(contents);
        if (contents.length > 0) {
          setDisplayedContent(initializeContent(contents[0]));
        }
      } catch (error) {
        console.error('Error initializing hymn:', error);
        setError('Failed to initialize hymn');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeHymn();
  }, [searchParams]);

  const handleNavigation = useCallback((direction: 'next' | 'prev') => {
    if (direction === 'next') {
      useVerseStore.getState().nextInSequence();
    } else {
      useVerseStore.getState().previousInSequence();
    }

    const currentIndex = useVerseStore.getState().currentSequenceIndex;
    const sequenceItem = useVerseStore.getState().sequence[currentIndex];

    let nextIndex = 0;
    if (sequenceItem === 'verse') {
      const verseNumber = Math.floor((currentIndex - 1) / (hymn?.has_refrain ? 2 : 1)) + 1;
      nextIndex = displayContents.findIndex(
        content => content.type === 'verse' && content.number === verseNumber
      );
    } else if (sequenceItem === 'refrain') {
      nextIndex = displayContents.findIndex(content => content.type === 'refrain');
    } else if (sequenceItem === 'blank') {
      nextIndex = displayContents.length - 1;
    }

    setCurrentIndex(nextIndex);
  }, [hymn, displayContents]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!displayContents.length) return;
      
      // Skip handling if modifiers are pressed, except for page navigation
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }
      
      // Define the current state
      const currentState = {
        contentType: displayContents[currentIndex].type,
        verseNumber: displayContents[currentIndex].type === 'verse' 
                    ? displayContents[currentIndex].number 
                    : displayContents[currentIndex].type === 'refrain' 
                      ? -1 
                      : displayContents[currentIndex].type === 'title' 
                        ? 0 
                        : null,
        part: displayContents[currentIndex].part || null,
        totalParts: displayContents[currentIndex].totalParts || null
      };
      
      // Prepare verse states for backend navigation
      const verseStates = displayContents.map(content => {
        // Determine verse_number based on content type
        let verse_number = -999; // Default placeholder
        
        if (content.type === 'title') {
          verse_number = 0;
        } else if (content.type === 'refrain') {
          verse_number = -1;
        } else if (content.type === 'verse' && content.number !== undefined) {
          verse_number = content.number;
        }
        
        return {
          verse_number, // This is the required field that was missing
          visible: true,
          part: content.part || null,
          total_parts: content.totalParts || null
        };
      });
      
      let newIndex = currentIndex;
      
      // Handle navigation keys
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case 'Space':
          // Use the Rust backend for navigation
          try {
            e.preventDefault();
            
            // Check if we're using the new navigation method
            if (verseStates.length > 0) {
              await invoke('navigate_hymn', { 
                direction: 'next',
                currentVerse: currentState.verseNumber,
                verseStates
              });
            } else {
              // Fallback to the old method
              await invoke('navigate_hymn', { 
                direction: 'next',
                currentVerse: currentState.verseNumber 
              });
            }
            
            // The navigation will be handled via events
            return;
          } catch (error) {
            console.error('Error in forward navigation:', error);
            // Fall back to client-side navigation if backend fails
            newIndex = Math.min(currentIndex + 1, displayContents.length - 1);
          }
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          // Use the Rust backend for navigation
          try {
            e.preventDefault();
            
            // Check if we're using the new navigation method
            if (verseStates.length > 0) {
              await invoke('navigate_hymn', { 
                direction: 'prev',
                currentVerse: currentState.verseNumber,
                verseStates
              });
            } else {
              // Fallback to the old method
              await invoke('navigate_hymn', { 
                direction: 'prev',
                currentVerse: currentState.verseNumber 
              });
            }
            
            // The navigation will be handled via events
            return;
          } catch (error) {
            console.error('Error in backward navigation:', error);
            // Fall back to client-side navigation if backend fails
            newIndex = Math.max(currentIndex - 1, 0);
          }
          break;
        case 'Home':
          // Move to title slide
          newIndex = 0;
          break;
        case 'End':
          // Move to last slide
          newIndex = displayContents.length - 1;
          break;
      }
      
      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
        
        // Update the current verse based on what's shown
        const content = displayContents[newIndex];
        if (content.type === 'verse') {
          // When changing to a verse, update the active verse
          setCurrentVerse(content.number);
          
          // Emit the verse-changed event so other components can update
          await emit('verse-changed', { 
            verseNumber: content.number,
            part: content.part || null,
            totalParts: content.totalParts || null
          });
        } else if (content.type === 'refrain') {
          // When changing to a refrain, update to special refrain value
          setCurrentVerse(-1);
          
          // Emit the verse-changed event
          await emit('verse-changed', { 
            verseNumber: -1,
            part: content.part || null,
            totalParts: content.totalParts || null
          });
        } else if (content.type === 'title') {
          // When changing to the title, update to title value
          setCurrentVerse(0);
          
          // Emit the verse-changed event
          await emit('verse-changed', { verseNumber: 0 });
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentIndex, displayContents, setCurrentIndex, setCurrentVerse]);

  useEffect(() => {
    const setupNavigationListeners = async () => {
      try {
        const unsubscribe = await listen('hymn-navigation', async (event) => {
          try {
            console.log('Received hymn-navigation event:', event);
            const { key } = event.payload;
            
            if (key.startsWith('goto-index-')) {
              const index = parseInt(key.replace('goto-index-', ''), 10);
              console.log(`Navigating to index ${index}`);
              
              if (isNaN(index)) {
                console.error('Invalid index:', key);
                return;
              }
              
              if (index >= 0 && index < displayContents.length) {
                setCurrentIndex(index);
              } else {
                console.error(`Index ${index} out of bounds (0-${displayContents.length - 1})`);
              }
            } else if (key.startsWith('goto-verse-')) {
              const verseNumber = parseInt(key.split('-')[2]);
              
              const indices = displayContents
                .map((content, index) => 
                  content.type === 'verse' && content.number === verseNumber ? index : -1)
                .filter(idx => idx !== -1);
                
              if (indices.length > 0) {
                // Go to the first part of the verse
                setCurrentIndex(indices[0]);
                setCurrentVerse(verseNumber);
                console.log(`Emitting verse-changed for verse ${verseNumber}, part: ${displayContents[indices[0]].part || 'none'}, totalParts: ${displayContents[indices[0]].totalParts || 'none'}`);
                await emit('verse-changed', { 
                  verseNumber,
                  part: displayContents[indices[0]].part || null,
                  totalParts: displayContents[indices[0]].totalParts || null
                });
              }
            } else if (key === 'next' || key === 'forward') {
              await handleNavigation('next');
            } else if (key === 'prev' || key === 'backward') {
              await handleNavigation('prev');
            } else if (key === 'goto-verse--1') {
              // Go to refrain
              const index = displayContents.findIndex(content => content.type === 'refrain');
              if (index !== -1) {
                setCurrentIndex(index);
              } else {
                console.error('Refrain not found in display contents');
              }
            }
          } catch (error) {
            console.error('Error handling hymn-navigation event:', error);
          }
        });
        
        // Add new listener for verse part navigation
        const versePartUnsubscribe = await listen('hymn-verse-part-navigation', async (event) => {
          try {
            console.log('Received hymn-verse-part-navigation event:', event);
            const { verseNumber, partNumber } = event.payload;
            
            if (typeof verseNumber !== 'number' || typeof partNumber !== 'number') {
              console.error('Invalid verse-part navigation payload:', event.payload);
              return;
            }
            
            console.log(`Navigating to verse ${verseNumber} part ${partNumber}`);
            
            // Find the specific verse part in displayContents
            const index = displayContents.findIndex(content => 
              content.type === 'verse' && 
              content.number === verseNumber && 
              content.part === partNumber
            );
            
            if (index !== -1) {
              console.log(`Found verse ${verseNumber} part ${partNumber} at index ${index}`);
              setCurrentIndex(index);
              
              // Also emit a verse-changed event to update UI
              await emit('verse-changed', { 
                verseNumber, 
                part: partNumber, 
                totalParts: displayContents[index].totalParts || null 
              });
            } else {
              console.error(`Verse ${verseNumber} part ${partNumber} not found in display contents`);
              
              // Fallback: try to find any part of this verse
              const anyPartIndex = displayContents.findIndex(content => 
                content.type === 'verse' && 
                content.number === verseNumber
              );
              
              if (anyPartIndex !== -1) {
                console.log(`Found verse ${verseNumber} at index ${anyPartIndex}, using as fallback`);
                setCurrentIndex(anyPartIndex);
              }
            }
          } catch (error) {
            console.error('Error handling hymn-verse-part-navigation event:', error);
          }
        });
        
        return () => {
          unsubscribe();
          versePartUnsubscribe();
        };
      } catch (error) {
        console.error('Error setting up hymn-navigation listener:', error);
        return null;
      }
    };
    
    const unsubPromise = setupNavigationListeners();
    
    return () => {
      unsubPromise.then(unsub => {
        if (unsub) unsub();
      }).catch(err => {
        console.error('Error during cleanup of hymn-navigation listener:', err);
      });
    };
  }, [displayContents, handleNavigation]);

  const handleHymnNavigation = useCallback(async (event: any) => {
    const { key } = event.payload;
    console.log('Hymn navigation triggered:', key);
    
    if (!displayContents || displayContents.length === 0) {
      console.warn('No display contents available for navigation');
      return;
    }
    
    // Parse the navigation command
    if (key === 'next' || key === 'forward') {
      try {
        console.log('Navigating forward from index', currentIndex);
        // Prepare verse states for backend navigation
        const verseStates = displayContents.map(content => {
          // Determine verse_number based on content type
          let verse_number = -999; // Default placeholder
          
          if (content.type === 'title') {
            verse_number = 0;
          } else if (content.type === 'refrain') {
            verse_number = -1;
          } else if (content.type === 'verse' && content.number !== undefined) {
            verse_number = content.number;
          }
          
          return {
            verse_number, // This is the required field that was missing
            visible: true,
            part: content.part || null,
            total_parts: content.totalParts || null
          };
        });
        
        let newIndex = currentIndex;
        
        // First try to use the backend navigation
        try {
          const result = await invoke<number>('navigate_hymn', {
            direction: 'forward',
            currentVerse,
            verseStates
          });
          
          console.log('Navigate result:', result);
          
          // Find the index corresponding to the returned verse number
          const targetIndex = displayContents.findIndex((content, idx) => {
            if (idx <= currentIndex) return false; // Only look forward
            
            if (result === 0 && content.type === 'title') return true;
            if (result === -1 && content.type === 'refrain') return true;
            return content.type === 'verse' && content.number === result;
          });
          
          if (targetIndex !== -1) {
            newIndex = targetIndex;
          } else {
            // Fallback to simple increment
            newIndex = Math.min(currentIndex + 1, displayContents.length - 1);
          }
        } catch (error) {
          console.error('Error in forward navigation:', error);
          // Fallback to simple increment
          newIndex = Math.min(currentIndex + 1, displayContents.length - 1);
        }
        
        setCurrentIndex(newIndex);
        
        // Update verse info based on the content at that index
        const content = displayContents[newIndex];
        if (content.type === 'verse') {
          setCurrentVerse(content.number);
          console.log(`Emitting verse-changed for verse ${content.number}, part: ${content.part || 'none'}, totalParts: ${content.totalParts || 'none'}`);
          await emit('verse-changed', { 
            verseNumber: content.number,
            part: content.part || null,
            totalParts: content.totalParts || null
          });
        } else if (content.type === 'refrain') {
          setCurrentVerse(-1);
          console.log(`Emitting verse-changed for refrain, part: ${content.part || 'none'}, totalParts: ${content.totalParts || 'none'}`);
          await emit('verse-changed', { 
            verseNumber: -1,
            part: content.part || null,
            totalParts: content.totalParts || null
          });
        } else if (content.type === 'title') {
          setCurrentVerse(0);
          console.log('Emitting verse-changed for title');
          await emit('verse-changed', { verseNumber: 0 });
        }
      } catch (error) {
        console.error('Error handling forward navigation:', error);
      }
    } else if (key === 'prev' || key === 'backward') {
      try {
        console.log('Navigating backward from index', currentIndex);

        // Simply find the target verse number without using hasRefrain or totalVerses
        // Just determine which verse indices are before the current one
        const previousIndices = displayContents
          .map((content, idx) => idx < currentIndex ? idx : -1)
          .filter(idx => idx !== -1);
        
        console.log(`Found ${previousIndices.length} indices before current index`);
        
        // Default to the most recent previous index
        const newIndex = previousIndices.length > 0 
          ? previousIndices[previousIndices.length - 1] 
          : 0; // Fallback to first element
        
        console.log(`Selected index ${newIndex}`);
        
        setCurrentIndex(newIndex);
        
        // Update verse info based on the content at that index
        const content = displayContents[newIndex];
        if (content.type === 'verse') {
          setCurrentVerse(content.number);
          console.log(`Emitting verse-changed for verse ${content.number}, part: ${content.part || 'none'}, totalParts: ${content.totalParts || 'none'}`);
          await emit('verse-changed', { 
            verseNumber: content.number,
            part: content.part || null,
            totalParts: content.totalParts || null
          });
        } else if (content.type === 'refrain') {
          setCurrentVerse(-1);
          console.log(`Emitting verse-changed for refrain, part: ${content.part || 'none'}, totalParts: ${content.totalParts || 'none'}`);
          await emit('verse-changed', { 
            verseNumber: -1,
            part: content.part || null,
            totalParts: content.totalParts || null
          });
        } else if (content.type === 'title') {
          setCurrentVerse(0);
          console.log('Emitting verse-changed for title');
          await emit('verse-changed', { verseNumber: 0 });
        }
      } catch (error) {
        console.error('Error handling backward navigation:', error);
      }
    } else if (key.startsWith('goto-verse-')) {
      const verseNumber = parseInt(key.split('-')[2]);
      
      const indices = displayContents
        .map((content, index) => 
          content.type === 'verse' && content.number === verseNumber ? index : -1)
        .filter(idx => idx !== -1);
        
      if (indices.length > 0) {
        // Go to the first part of the verse
        setCurrentIndex(indices[0]);
        setCurrentVerse(verseNumber);
        console.log(`Emitting verse-changed for verse ${verseNumber}, part: ${displayContents[indices[0]].part || 'none'}, totalParts: ${displayContents[indices[0]].totalParts || 'none'}`);
        await emit('verse-changed', { 
          verseNumber,
          part: displayContents[indices[0]].part || null,
          totalParts: displayContents[indices[0]].totalParts || null
        });
      }
    } else if (key === 'goto-verse--1') {
      // Find all refrain indices
      const indices = displayContents
        .map((content, index) => content.type === 'refrain' ? index : -1)
        .filter(idx => idx !== -1);
        
      if (indices.length > 0) {
        // Go to the first refrain part
        setCurrentIndex(indices[0]);
        setCurrentVerse(-1);
        console.log(`Emitting verse-changed for refrain, part: ${displayContents[indices[0]].part || 'none'}, totalParts: ${displayContents[indices[0]].totalParts || 'none'}`);
        await emit('verse-changed', { 
          verseNumber: -1,
          part: displayContents[indices[0]].part || null,
          totalParts: displayContents[indices[0]].totalParts || null
        });
      }
    } else if (key === 'goto-verse-0') {
      // Find the title index
      const titleIndex = displayContents.findIndex(content => content.type === 'title');
      if (titleIndex !== -1) {
        setCurrentIndex(titleIndex);
        setCurrentVerse(0);
        console.log('Emitting verse-changed for title');
        await emit('verse-changed', { verseNumber: 0 });
      }
    } else if (key.startsWith('goto-index-')) {
      // Direct navigation to a specific index (used for multi-part verses)
      const targetIndex = parseInt(key.split('-')[2]);
      
      if (targetIndex >= 0 && targetIndex < displayContents.length) {
        setCurrentIndex(targetIndex);
        
        // Update verse info based on the content at that index
        const content = displayContents[targetIndex];
        if (content.type === 'verse') {
          setCurrentVerse(content.number);
          console.log(`Emitting verse-changed for verse ${content.number}, part: ${content.part || 'none'}, totalParts: ${content.totalParts || 'none'}`);
          await emit('verse-changed', { 
            verseNumber: content.number,
            part: content.part || null,
            totalParts: content.totalParts || null
          });
        } else if (content.type === 'refrain') {
          setCurrentVerse(-1);
          console.log(`Emitting verse-changed for refrain, part: ${content.part || 'none'}, totalParts: ${content.totalParts || 'none'}`);
          await emit('verse-changed', { 
            verseNumber: -1,
            part: content.part || null,
            totalParts: content.totalParts || null
          });
        } else if (content.type === 'title') {
          setCurrentVerse(0);
          console.log('Emitting verse-changed for title');
          await emit('verse-changed', { verseNumber: 0 });
        }
      }
    }
  }, [currentIndex, displayContents, setCurrentIndex, setCurrentVerse]);

  useEffect(() => {
    const setupHymnNavigation = async () => {
      try {
        const unsubscribe = await listen('hymn-navigation', handleHymnNavigation);
        return unsubscribe;
      } catch (error) {
        console.error('Error setting up hymn-navigation listener:', error);
        return null;
      }
    };
    
    const unsubPromise = setupHymnNavigation();
    
    return () => {
      unsubPromise.then(unsub => {
        if (unsub) unsub();
      }).catch(err => {
        console.error('Error during cleanup of hymn-navigation listener:', err);
      });
    };
  }, [handleHymnNavigation]);

  const handleArrowKeys = useCallback(async (event: any) => {
    console.log('Received arrow key event:', event);
    
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' 
      ? 'next' 
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' 
      ? 'prev' 
      : null;
    
    if (direction && displayContents.length > 0) {
      try {
        if (direction === 'next') {
          // For next, use the Rust backend
          await invoke('navigate_hymn', { 
            direction, 
            currentVerse: currentVerse, 
            verseStates: displayContents.map((content, index) => ({
              verse_number: content.type === 'title' ? 0 : content.type === 'refrain' ? -1 : content.number,
              part: content.part || null,
              total_parts: content.totalParts || null,
              sequence_index: index,
            }))
          });
        } else {
          // For prev/backward, use our direct frontend navigation
          // This ensures we correctly handle multi-part verses when going backwards
          await emit('hymn-navigation', { key: 'backward' });
        }
      } catch (error) {
        console.error('Error navigating hymn:', error);
      }
    }
  }, [currentVerse, displayContents]);

  useEffect(() => {
    const unsubscribe = listen('keyboard-event', async (event: any) => {
      const { key } = event.payload;
      const arrowKeys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'];
      
      if (arrowKeys.includes(key)) {
        await handleArrowKeys(event.payload);
      }
    });
    
    return () => {
      unsubscribe.then(fn => fn());
    };
  }, [handleArrowKeys]);

  useEffect(() => {
    console.log('Current index changed:', currentIndex);
    if (displayContents[currentIndex]) {
      const newContent = initializeContent(displayContents[currentIndex]);
      if (newContent) {
        if (shouldTransition(newContent, displayedContent)) {
          handleTransition(newContent);
        } else {
          setDisplayedContent(newContent);
        }
      }
    }
  }, [currentIndex, displayContents, initializeContent]);

  useEffect(() => {
    if (displayedContent) {
      const emitVerseChanged = async () => {
        try {
          if (displayedContent.type === 'verse') {
            console.log(`Emitting verse-changed for verse ${displayedContent.number}, part: ${displayedContent.part || 'none'}, totalParts: ${displayedContent.totalParts || 'none'}`);
            await emit('verse-changed', { 
              verseNumber: displayedContent.number,
              part: displayedContent.part || null,
              totalParts: displayedContent.totalParts || null
            });
          } else if (displayedContent.type === 'refrain') {
            console.log(`Emitting verse-changed for refrain, part: ${displayedContent.part || 'none'}, totalParts: ${displayedContent.totalParts || 'none'}`);
            await emit('verse-changed', { 
              verseNumber: -1,
              part: displayedContent.part || null,
              totalParts: displayedContent.totalParts || null
            });
          } else if (displayedContent.type === 'title') {
            console.log('Emitting verse-changed for title');
            await emit('verse-changed', { verseNumber: 0 });
          } else {
            console.log('Emitting verse-changed with null verseNumber for type:', displayedContent.type);
            await emit('verse-changed', { verseNumber: null });
          }
        } catch (error) {
          console.error('Failed to emit verse change:', error);
        }
      };

      emitVerseChanged();
    }
  }, [displayedContent]);

  useEffect(() => {
    if (!currentIndex || !displayContents || displayContents.length === 0) return;
    
    if (currentIndex >= 0 && currentIndex < displayContents.length) {
      const currentContent = displayContents[currentIndex];
      
      // Update currentVerse if this is a verse
      if (currentContent.type === 'verse' && currentContent.number) {
        console.log(`Set current verse to ${currentContent.number} (part: ${currentContent.part || 1}/${currentContent.totalParts || 1})`);
        setCurrentVerse(currentContent.number);
      } else if (currentContent.type === 'refrain') {
        console.log(`Set current verse to refrain (part: ${currentContent.part || 1}/${currentContent.totalParts || 1})`);
        setCurrentVerse(-1);
      }
      
      // Update sequence index in store
      console.log(`Update current sequence index to ${currentIndex}`);
      useVerseStore.getState().setCurrentSequenceIndex(currentIndex);
    }
  }, [currentIndex, displayContents, setCurrentVerse]);

  const shouldTransition = useCallback((current: DisplayContent, displayed: DisplayContent | null): boolean => {
    if (!current?.type || !displayed?.type) return false;
    return (current.type === 'title' && displayed.type === 'verse') ||
           (current.type === 'verse' && displayed.type === 'title') ||
           (current.type === 'blank' && displayed.type !== 'blank') ||
           (displayed.type === 'blank' && current.type !== 'blank');
  }, []);

  const handleTransition = useCallback((newContent: DisplayContent) => {
    setIsTransitioning(false);
    setDisplayedContent(newContent);
  }, []);

  const renderContent = (content: DisplayContent | null) => {
    if (!content || !hymn) {
      console.log('No content or hymn to render');
      return null;
    }

    if (content.type === 'blank') {
      return null;
    }

    console.log('Rendering content:', content);

    const getVerseLabel = (): string => {
      const t = translations[hymn.language as keyof Translations];
      console.log('Getting verse label for:', JSON.stringify(content, null, 2));
      
      if (content.type === 'verse' && content.part && content.totalParts && content.totalParts > 1) {
        const label = `${t.versePrefix} ${content.number}-${content.part}/${content.totalParts}`;
        console.log('Generated label for multi-part verse:', label);
        return label;
      }
      
      if (content.type === 'verse') {
        const label = `${t.versePrefix} ${content.number}`;
        console.log('Generated standard verse label:', label);
        return label;
      }
      
      return '';
    };

    const getRefrainLabel = (): string => {
      const label = hymn.language === 'AFR' ? 'Refrein' : 'Refrain';
      console.log('Getting refrain label for:', JSON.stringify(content, null, 2));
      
      if (content.type === 'refrain' && content.part && content.totalParts && content.totalParts > 1) {
        const partLabel = `${label} ${content.part}/${content.totalParts}`;
        console.log('Generated label for multi-part refrain:', partLabel);
        return partLabel;
      }
      
      console.log('Generated standard refrain label:', label);
      return label;
    };

    if (content.type === 'title') {
      return (
        <div className="w-full relative min-h-screen">
          <div className="absolute top-8 left-1/2 transform -translate-x-1/2 flex items-center gap-12 text-3xl text-white/80">
            <div className="flex items-center gap-3 bg-black/40 backdrop-blur-sm px-6 py-3 rounded-full">
              <span>{content.metadata?.verses}</span>
            </div>
            {hymn.key_signature && (
              <div className="flex items-center gap-3 bg-black/40 backdrop-blur-sm px-6 py-3 rounded-full">
                <span>{content.metadata?.key}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-center justify-center min-h-screen">
            <h1 className="text-9xl font-bold mb-8 text-white/90">{hymn.number}</h1>
            <h2 className="text-7xl font-medium text-white/90">{hymn.title}</h2>
          </div>
          {hymn.author && (
            <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
              <span className="text-2xl italic text-white/70">{hymn.author}</span>
            </div>
          )}
        </div>
      );
    }

    if (content.type === 'verse') {
      return (
        <div className="w-full relative min-h-screen flex flex-col justify-center items-center">
          <div className="absolute top-8 left-0 right-0 text-center">
            <span className="text-7xl font-bold text-white">
              {hymn.number}
            </span>
          </div>
          <div className="absolute top-8 left-8">
            <span className="text-6xl font-medium text-white" data-part={content.part} data-total-parts={content.totalParts}>
              {getVerseLabel()}
            </span>
          </div>
          <div className="relative max-w-[75%] bg-transparent rounded-xl p-8">
            <div className="absolute -left-20 top-1/2 -translate-y-1/2 text-[20rem] font-bold text-white/10 select-none pointer-events-none">
              {content.number}
            </div>
            <div className="relative z-10 text-7xl whitespace-pre-wrap leading-relaxed font-medium text-white">
              {content.content}
            </div>
          </div>
          {hymn.author && (
            <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
              <span className="text-2xl italic text-white/70">{hymn.author}</span>
            </div>
          )}
        </div>
      );
    }

    if (content.type === 'refrain') {
      return (
        <div className="w-full relative min-h-screen flex flex-col justify-center items-center">
          <div className="absolute top-8 left-0 right-0 text-center">
            <span className="text-7xl font-bold text-white">
              {hymn.number}
            </span>
          </div>
          <div className="absolute top-8 left-8">
            <span className="text-6xl font-medium text-white">
              {getRefrainLabel()}
            </span>
          </div>
          <div className="relative max-w-[80%] bg-transparent backdrop-blur-sm rounded-xl p-8 shadow-xl">
            <div className="absolute -left-20 top-1/2 -translate-y-1/2 text-[20rem] font-bold text-white/10 select-none pointer-events-none tracking-wider">
              R
            </div>
            <div className="relative z-10 text-7xl whitespace-pre-wrap leading-relaxed font-medium text-white">
              {content.content}
            </div>
          </div>
          {hymn.author && (
            <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
              <span className="text-2xl italic text-white/70">{hymn.author}</span>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const [navigationDots, setNavigationDots] = useState<{
    index: number;
    type: string;
    number?: number | null;
    part?: number | null;
    label: string;
  }[]>([]);

  const getContentLabel = (content: DisplayContent): string => {
    if (content.type === 'title') return 'Title';
    if (content.type === 'blank') return 'End';
    if (content.type === 'verse') {
      if (content.part && content.totalParts) {
        return `Verse ${content.number}-${content.part}/${content.totalParts}`;
      }
      return `Verse ${content.number}`;
    }
    if (content.type === 'refrain') {
      if (content.part && content.totalParts) {
        return `Refrain ${content.part}/${content.totalParts}`;
      }
      return 'Refrain';
    }
    return 'Unknown';
  };

  useEffect(() => {
    if (!Array.isArray(displayContents) || displayContents.length === 0) return;
    
    console.log('Generating navigation dots for', displayContents.length, 'slides');
    
    const dots = displayContents.map((content, index) => {
      const label = getContentLabel(content);
      
      return {
        index,
        type: content.type,
        number: content.type === 'verse' ? content.number : null,
        part: content.part || null,
        label
      };
    });
    
    setNavigationDots(dots);
    console.log('Navigation dots:', dots);
  }, [displayContents, currentIndex]);

  const renderNavigationDots = () => {
    if (navigationDots.length === 0) return null;

    return (
      <div className="absolute bottom-5 left-0 right-0 flex justify-center items-center space-x-1 pb-1">
        <TooltipProvider>
          {navigationDots.map((dot, idx) => {
            if (dot.type === 'blank') return null;
            
            const isActive = idx === currentIndex;
            
            let title = dot.label;
            
            // Enhanced display for multi-part verses and refrains
            if (dot.part && dot.totalParts) {
              if (dot.type === 'verse') {
                title = `Verse ${dot.number} (Part ${dot.part}/${dot.totalParts})`;
              } else if (dot.type === 'refrain') {
                title = `Refrain (Part ${dot.part}/${dot.totalParts})`;
              }
            }
            
            return (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "rounded-full w-2 h-2 transition-colors",
                      isActive ? "bg-white" : "bg-white/50 hover:bg-white/80"
                    )}
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={title}
                  />
                </TooltipTrigger>
                <TooltipContent side="top">
                  {title}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
    );
  };

  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
  };

  if (isInitializing) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="text-white text-4xl opacity-50">Loading hymn...</div>
      </div>
    );
  }

  if (error) {
    return <div className="w-full h-screen flex items-center justify-center bg-black text-white text-2xl">Error: {error}</div>;
  }

  if (!hymn || !displayedContent) {
    return <div className="w-full h-screen flex items-center justify-center bg-black text-white text-2xl">Loading...</div>;
  }

  console.log('Rendering HymnDisplay component');
  return (
    <div className="h-screen w-screen bg-black relative">
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: "url('/hymn-image.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "brightness(0.3)",
        }}
      />
      <div className="relative z-10 h-full flex items-center justify-center">
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
            isTransitioning || displayedContent?.type === 'blank' ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {renderContent(displayedContent)}
        </div>
        {displayedContent?.type !== 'blank' && navigationDots.length > 0 && (
          renderNavigationDots()
        )}
      </div>
    </div>
  );
};

interface TranslationType {
  verses: string;
  verse: string;
  and: string;
  refrain: string;
  versePrefix: string;
}

interface Translations {
  AFR: TranslationType;
  ENG: TranslationType;
}

const translations: Translations = {
  AFR: {
    verses: "Verse",
    verse: "Vers",
    and: "en",
    refrain: "Refrein",
    versePrefix: "Vers"
  },
  ENG: {
    verses: "Verses",
    verse: "Verse",
    and: "and",
    refrain: "Refrain",
    versePrefix: "Verse"
  }
};

export default HymnDisplay;
