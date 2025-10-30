'use client'

import React, { useCallback, useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SkipPrevious, SkipNext, Stop, MusicNote, PlayArrow } from '@nine-thirty-five/material-icons-react/rounded';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import useVerseStore from '@/lib/store';
import { toast } from 'sonner';

export function HymnPlaybackControls() {
  const { 
    sequence, 
    currentSequenceIndex, 
    setCurrentSequenceIndex, 
    activeVerse, 
    totalVerses, 
    hasRefrain,
    resetAll
  } = useVerseStore();

  const [isPlaying, setIsPlaying] = useState(false);

  // Handle hymn navigation in sync with Rust backend logic
  const handleNavigation = useCallback(async (action: 'previous' | 'next' | 'play' | 'stop') => {
    if (action === 'stop') {
      try {
        // Stop playback by calling the Rust stop_hymn command
        await invoke('stop_hymn');
        // State will be updated via event listener
      } catch (error) {
        console.error("Error stopping hymn:", error);
        toast.error("Failed to stop hymn playback");
      }
      return;
    }

    if (action === 'play') {
      // This is just a visual indicator - actual hymn selection is in other components
      setIsPlaying(true);
      return;
    }

    // For previous/next navigation
    if (!isPlaying) {
      toast.error("No hymn is currently playing");
      return;
    }
    
    if (sequence.length === 0) {
      toast.error("No verses available to navigate");
      return;
    }

    try {
      // Use the same navigation logic as in the Rust code
      await invoke('navigate_hymn', {
        direction: action === 'next' ? 'forward' : 'backward',
        currentVerse: activeVerse
      });
      
      // The actual sequence index update will happen via the change-verse event listener
    } catch (error) {
      console.error("Navigation error:", error);
      toast.error("Failed to navigate hymn");
    }
  }, [sequence, isPlaying, activeVerse]);

  // Listen for keyboard events (arrow keys) - matching the logic in Rust
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isPlaying) return;

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        handleNavigation('previous');
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        handleNavigation('next');
      } else if (event.key === 'Escape') {
        handleNavigation('stop');
      }
    };

    // Also listen for Tauri events from the Rust backend
    const handleHymnNavigation = (event: any) => {
      const { key } = event.payload;
      if (key === 'ArrowLeft' || key === 'ArrowUp') {
        handleNavigation('previous');
      } else if (key === 'ArrowRight' || key === 'ArrowDown') {
        handleNavigation('next');
      } else if (key === 'Escape') {
        handleNavigation('stop');
      }
    };

    // Add keyboard event listener
    window.addEventListener('keydown', handleKeyDown);
    
    // Listen for hymn navigation events from Rust backend
    const unsubscribe = listen('hymn-navigation', handleHymnNavigation);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribe.then(unsub => unsub());
    };
  }, [isPlaying, handleNavigation]);

  // Listen for change-verse events from Rust
  useEffect(() => {
    const changeVerseHandler = (event: any) => {
      const newVerse = event.payload;
      console.log("Verse changed to:", newVerse);
      
      // Find the corresponding sequence index for this verse
      if (sequence.length > 0) {
        const index = sequence.findIndex(item => item.verse === newVerse);
        if (index !== -1) {
          setCurrentSequenceIndex(index);
        }
      }
    };
    
    const unsubscribe = listen('change-verse', changeVerseHandler);
    
    return () => {
      unsubscribe.then(unsub => unsub());
    };
  }, [sequence, setCurrentSequenceIndex]);

  // Listen for display-hymn and stop-hymn events
  useEffect(() => {
    const displayHymnHandler = () => {
      console.log("Display hymn event received");
      setIsPlaying(true);
    };

    const stopHymnHandler = () => {
      console.log("Stop hymn event received");
      setIsPlaying(false);
      resetAll();
    };

    // Check for any existing hymn windows when component mounts
    const checkExistingHymns = async () => {
      try {
        const existingWindows = await invoke<string[]>('get_hymn_windows');
        setIsPlaying(existingWindows.length > 0);
      } catch (error) {
        console.error("Error checking for existing hymn windows:", error);
      }
    };

    // Subscribe to events
    const unsubscribe1 = listen('display-hymn', displayHymnHandler);
    const unsubscribe2 = listen('stop-hymn', stopHymnHandler);
    
    // Check for existing hymns on mount
    checkExistingHymns();

    return () => {
      unsubscribe1.then(unsub => unsub());
      unsubscribe2.then(unsub => unsub());
    };
  }, [resetAll]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background mb-8">
      <Card className="w-full bg-card-background border-0 rounded-none shadow-lg">
        <CardContent className="p-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <MusicNote className="text-muted-foreground h-7 w-7" />
            <span className="text-foreground text-lg font-medium">Playback Controls</span>
          </div>
          
          <div className="flex flex-1 justify-center">
            <div className="text-base text-muted-foreground font-medium">
              {isPlaying ? (
                activeVerse !== null ? 
                `Currently on: ${activeVerse === -1 ? 'Refrain' : activeVerse === 0 ? 'Title' : `Verse ${activeVerse}`}` : 
                'No verse selected'
              ) : (
                'No hymn playing'
              )}
              {isPlaying && totalVerses ? ` | Total verses: ${totalVerses}${hasRefrain ? ' (with refrain)' : ''}` : ''}
            </div>
          </div>
          
          <div className="flex gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleNavigation('previous')}
              disabled={!isPlaying}
              className="h-12 w-12 rounded-full bg-foreground/5 hover:bg-foreground/10 border-foreground/10 disabled:opacity-30"
            >
              <SkipPrevious className="h-6 w-6" />
            </Button>
            
            {isPlaying ? (
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleNavigation('stop')}
                className="h-12 w-12 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Stop className="h-6 w-6" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleNavigation('play')}
                disabled={totalVerses === 0}
                className="h-12 w-12 rounded-full bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlayArrow className="h-6 w-6" />
              </Button>
            )}
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleNavigation('next')}
              disabled={!isPlaying}
              className="h-12 w-12 rounded-full bg-foreground/5 hover:bg-foreground/10 border-foreground/10 disabled:opacity-30"
            >
              <SkipNext className="h-6 w-6" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default HymnPlaybackControls;
