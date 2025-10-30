'use client'

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, Icon, Button, Tooltip } from '@gravity-ui/uikit'
import Link from 'next/link'
import { Display as DisplayIcon } from '@gravity-ui/icons'
import { cn } from "@/lib/utils";
import { listen } from '@tauri-apps/api/event';
import Image from 'next/image';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { TRANSITION_DURATION, TRANSITION_CLASS, preloadImage, prepareImageUrl } from '@/lib/transition-utils';
import VerseSelector from '@/components/verse-selector';
import BibleQuickVerseButtons from '@/components/bible-quick-verse-buttons';

interface ContentState {
  content: string;
  type: string;
  source: string;
  isScreenshot?: boolean;
  isStream?: boolean;
  streamId?: string;
}

interface PreviewContent {
  type: 'image' | 'hymn' | 'bible';
  content: string;
  isScreenshot?: boolean;
  fill?: boolean;
  source?: string;
}

type RawFrame = [number, number, Uint8Array];  // [width, height, raw frame data]

interface StreamUpdateEvent {
  type: string;
  content: string;
  source: string;
  streamId: string;
  isActive: boolean;
}

const isBase64 = (str: string) => {
  // Check if string is already a complete data URL
  if (str.startsWith('data:image/')) return true;

  // Check if string is a raw base64 string
  try {
    const firstChar = str.charAt(0);
    return firstChar === '/' || firstChar === 'i'; // Common base64 image starts
  } catch {
    return false;
  }
};

export function Projection() {
  const [isActive, setIsActive] = useState(false);
  const [currentContent, setCurrentContent] = useState<ContentState | null>(null);
  const [nextContent, setNextContent] = useState<ContentState | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [liveStream, setLiveStream] = useState<boolean>(false);
  const [streamContent, setStreamContent] = useState<Record<string, { type: string; content: string; streamId: string }>>({});
  const [lastActiveSource, setLastActiveSource] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const lastStreamUpdateRef = useRef<number>(0);

  const updateContent = useCallback(async (payload: { content: string, type: string, displayId: string, fill?: boolean, source?: string, isStream?: boolean }) => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      if (!payload.content) {
        setIsUpdating(false);
        return;
      }

      const fill = payload.fill ?? payload.type === 'image';
      let content = payload.content;

      // Track this source as the last active one
      setLastActiveSource(payload.source || null);

      // Special handling for live streams
      if (payload.isStream) {
        setLiveStream(true);
        
        // Only update the canvas if we need to - may not be needed with stream events
        const newStreamContent = {
          content,
          type: payload.type as 'image' | 'hymn' | 'bible',
          source: payload.source || 'unknown',
          isScreenshot: false,
          isStream: true,
        };
        
        setCurrentContent(newStreamContent);
        setIsActive(true);
        setIsUpdating(false);
        return;
      } else {
        setLiveStream(false);
      }

      // Add error handling for failed screenshots
      if (content === "error" || (isBase64(content) && content.length < 100)) {
        console.warn("Invalid screenshot content received");
        setIsUpdating(false);
        return;
      }

      // Handle content based on type and format
      if (isBase64(content)) {
        content = content.startsWith('data:image/')
          ? content
          : `data:image/jpeg;base64,${content}`;
      } else if (payload.type === 'image') {
        content = prepareImageUrl(content);
      }

      // Only update if:
      // 1. No current content exists
      // 2. Content is different and from the same source
      // 3. Content is from a different source (allowing overlays)
      if (!currentContent ||
          (currentContent.content !== content && currentContent.source === payload.source) ||
          currentContent.source !== payload.source) {

        const newContent = {
          content,
          type: payload.type as 'image' | 'hymn' | 'bible',
          source: payload.source || 'unknown',
          isScreenshot: isBase64(content),
          isStream: false,
        };

        // Store current content as next if it should persist
        if (currentContent?.isScreenshot && currentContent.source !== payload.source) {
          setNextContent(currentContent);
        }

        setCurrentContent(newContent);
        setIsActive(true);
      }
    } catch (error) {
      console.error('Error updating preview:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [currentContent, isUpdating]);

  useEffect(() => {
    let unmounted = false;
    
    // Setup canvas for live stream rendering if needed
    if (liveStream && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d', {
        alpha: false,
        desynchronized: true,
      });
      
      if (ctx) {
        // Set up optimal rendering properties
        ctx.imageSmoothingEnabled = false;
        canvasRef.current.width = 1920;
        canvasRef.current.height = 1080;
      }
    }
    
    // Listeners for frame updates from the backend
    const unlistenFrame = listen<[number, number, Uint8Array]>('frame-update', (event) => {
      if (unmounted || !liveStream || !canvasRef.current) return;
      
      const [width, height, rawData] = event.payload;
      const ctx = canvasRef.current.getContext('2d');
      
      if (ctx) {
        // Update canvas dimensions if needed
        if (canvasRef.current.width !== width || canvasRef.current.height !== height) {
          canvasRef.current.width = width;
          canvasRef.current.height = height;
        }
        
        // Create ImageData from raw bytes
        const imageData = new ImageData(
          new Uint8ClampedArray(rawData),
          width,
          height
        );
        
        // Draw the frame
        ctx.putImageData(imageData, 0, 0);
        
        // Track updates
        lastStreamUpdateRef.current = Date.now();
      }
    });
    
    // Stream-related listeners
    const unlistenStreamFrame = listen<[number, number, Uint8Array]>('stream-frame-update', (event) => {
      try {
        const [width, height, rawData] = event.payload;
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Make sure canvas is sized correctly
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        // Convert the raw data to an ImageData object
        const newImageData = new ImageData(
          new Uint8ClampedArray(rawData),
          width,
          height
        );

        // Draw the frame to the canvas
        ctx.putImageData(newImageData, 0, 0);
      } catch (error) {
        console.error('Error processing frame:', error);
      }
    });

    const unlistenStreamUpdate = listen<StreamUpdateEvent>('stream-update', (event) => {
      const { type, content, source, streamId, isActive = true } = event.payload;
      
      console.log(`Stream update received: ${type} from ${source}, active: ${isActive}`);
      
      if (isActive) {
        // Add new stream or update existing
        setStreamContent(prev => ({
          ...prev,
          [source]: {
            type,
            content,
            streamId
          }
        }));
        setLiveStream(true);
      } else {
        // Remove stream
        setStreamContent(prev => {
          const newContent = { ...prev };
          delete newContent[source];
          return newContent;
        });
        
        // If no more streams, turn off live stream mode
        setTimeout(() => {
          setStreamContent(prev => {
            if (Object.keys(prev).length === 0) {
              setLiveStream(false);
            }
            return prev;
          });
        }, 100);
      }
    });

    return () => {
      unmounted = true;
      unlistenFrame.then(f => f());
      unlistenStreamFrame.then(f => f());
      unlistenStreamUpdate.then(f => f());
    };
  }, [liveStream]);

  useEffect(() => {
    let unmounted = false;
    
    // Setup canvas for live stream rendering if needed
    if (liveStream && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d', {
        alpha: false,
        desynchronized: true,
      });
      
      if (ctx) {
        // Set up optimal rendering properties
        ctx.imageSmoothingEnabled = false;
        canvasRef.current.width = 1920;
        canvasRef.current.height = 1080;
      }
    }
    
    // Listeners for frame updates from the backend
    const unlistenFrame = listen<[number, number, Uint8Array]>('frame-update', (event) => {
      if (unmounted || !liveStream || !canvasRef.current) return;
      
      const [width, height, rawData] = event.payload;
      const ctx = canvasRef.current.getContext('2d');
      
      if (ctx) {
        // Update canvas dimensions if needed
        if (canvasRef.current.width !== width || canvasRef.current.height !== height) {
          canvasRef.current.width = width;
          canvasRef.current.height = height;
        }
        
        // Create ImageData from raw bytes
        const imageData = new ImageData(
          new Uint8ClampedArray(rawData),
          width,
          height
        );
        
        // Draw the frame
        ctx.putImageData(imageData, 0, 0);
        
        // Track updates
        lastStreamUpdateRef.current = Date.now();
      }
    });
    
    // Stream-related listeners
    const unlistenStreamFrame = listen<[number, number, Uint8Array]>('stream-frame-update', (event) => {
      try {
        const [width, height, rawData] = event.payload;
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Make sure canvas is sized correctly
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        // Convert the raw data to an ImageData object
        const newImageData = new ImageData(
          new Uint8ClampedArray(rawData),
          width,
          height
        );

        // Draw the frame to the canvas
        ctx.putImageData(newImageData, 0, 0);
      } catch (error) {
        console.error('Error processing frame:', error);
      }
    });

    const unlistenStreamUpdate = listen<StreamUpdateEvent>('stream-update', (event) => {
      const { type, content, source, streamId, isActive = true } = event.payload;
      
      console.log(`Stream update received: ${type} from ${source}, active: ${isActive}`);
      
      if (isActive) {
        // Add new stream or update existing
        setStreamContent(prev => ({
          ...prev,
          [source]: {
            type,
            content,
            streamId
          }
        }));
        setLiveStream(true);
      } else {
        // Remove stream
        setStreamContent(prev => {
          const newContent = { ...prev };
          delete newContent[source];
          return newContent;
        });
        
        // If no more streams, turn off live stream mode
        setTimeout(() => {
          setStreamContent(prev => {
            if (Object.keys(prev).length === 0) {
              setLiveStream(false);
            }
            return prev;
          });
        }, 100);
      }
    });

    return () => {
      unmounted = true;
      unlistenFrame.then(f => f());
      unlistenStreamFrame.then(f => f());
      unlistenStreamUpdate.then(f => f());
    };
  }, [liveStream]);

  useEffect(() => {
    let unmounted = false;

    const unlistenUpdate = listen<{ displayId: string, content: string, source: string, isStream?: boolean, type?: string }>('window-preview-update', (event) => {
      if (unmounted || !event.payload) return;
      
      // Determine content type (default to 'image' if not specified)
      const type = event.payload.type || 'image';
      
      updateContent({ 
        ...event.payload, 
        type,
      });
    });

    // Add listener for clear-preview event
    const unlistenClear = listen<{ source: string }>(
      'clear-preview',
      (event) => {
        if (unmounted) return;

        const { source } = event.payload;
        if (!source) return;
        
        console.log(`Clear preview for source: ${source}`);
        
        // Remove content from this source
        setCurrentContent((prevContent) => {
          if (!prevContent) return prevContent;
          return prevContent.source === source ? null : prevContent;
        });
        
        // Also remove from stream content if it exists
        setStreamContent(prev => {
          const newContent = { ...prev };
          delete newContent[source];
          
          // If no more streams, turn off live stream mode
          if (Object.keys(newContent).length === 0) {
            setLiveStream(false);
          }
          
          return newContent;
        });
      }
    );

    // Add listener for stopTimer event
    const unlistenClose = listen('stopTimer', async (event) => {
      if (unmounted) return;
      // Clear everything on stopTimer
      setCurrentContent(null);
      setNextContent(null);
      setIsActive(false);
      setIsUpdating(false);
      setLiveStream(false);
    });

    // Listen for stream updates from the DisplayStreamManager
    const unlistenStream = listen<{ type: string, content: string, source: string, streamId: string }>('stream-update', (event) => {
      if (unmounted) return;
      
      const { content, type, source, streamId } = event.payload;
      
      // Setup for live stream
      setLiveStream(true);
      setCurrentContent({
        content,
        type: type as 'image' | 'hymn' | 'bible',
        source,
        isScreenshot: false,
        isStream: true,
        streamId
      });
      setIsActive(true);
    });

    // Check initial state only if no stopTimer was received and no content is already displayed
    // This prevents overriding screenshots with stored image paths
    invoke<string | null>('get_current_image').then(image => {
      if (!unmounted && image && !currentContent) {
        updateContent({ 
          content: image, 
          type: 'image', 
          displayId: 'default',
          source: 'restore'
        });
      }
    });

    return () => {
      unmounted = true;
      unlistenUpdate.then(f => f());
      unlistenClear.then(f => f());
      unlistenClose.then(f => f());
      unlistenStream.then(f => f());
    };
  }, [updateContent, currentContent, nextContent, liveStream]);

  useEffect(() => {
    let unmounted = false;

    // Listen for clear-all-content for universal stop button
    const unlistenClearAll = listen('clear-all-content', () => {
      // Reset all content and streams
      setCurrentContent(null);
      setStreamContent({});
      setLiveStream(false);
      setLastActiveSource(null);
      
      // Clear canvas if it exists
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
      
      // Clear the projection preview in the main window as well
      invoke('emit_main', {
        event: 'clear-projection-preview',
        payload: {}
      }).catch(err => console.error('Error clearing projection preview:', err));
      
      console.log('All content cleared by universal stop button');
    });

    // Listen for source-specific clear events
    const unlistenClearContent = listen('clear-content', (event: { payload: { source: string } }) => {
      const { source } = event.payload;
      console.log(`Clearing content for source: ${source}`);

      // Check if we need to handle stream content
      if (streamContent && streamContent[source]) {
        // Remove this source from stream content
        setStreamContent(prev => {
          const newContent = { ...prev };
          delete newContent[source];
          
          // If no more streams, turn off live stream mode
          if (Object.keys(newContent).length === 0) {
            setLiveStream(false);
            
            // Clear canvas if it exists and we're turning off live stream
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
              }
            }
          } else {
            // If we still have active streams, trigger a refresh of the canvas
            // This helps when one source is stopped but others continue
            invoke('refresh_stream').catch(err => 
              console.error('Error refreshing stream after source clear:', err)
            );
          }
          
          return newContent;
        });
      }

      // If current content is from this source, clear it
      if (currentContent && currentContent.source === source) {
        setCurrentContent(null);
        
        // If this was the last active source, clear that tracking
        if (lastActiveSource === source) {
          setLastActiveSource(null);
        }
        
        // Clear the projection preview in the main window as well for this source
        invoke('emit_main', {
          event: 'clear-projection-preview',
          payload: { source }
        }).catch(err => console.error(`Error clearing projection preview for ${source}:`, err));
      }
      
      console.log(`Content cleared for source: ${source}`);
    });

    // Add a "check-active-windows" event listener
    const unlistenCheckWindows = listen('check-active-windows', async () => {
      // Check for any active display windows
      const hymnsActive = await invoke<string[]>('get_hymn_windows').then(windows => windows.length > 0);
      const bibleActive = await invoke<string[]>('get_bible_windows').then(windows => windows.length > 0);
      const imagesActive = await invoke<string[]>('get_image_windows').then(windows => windows.length > 0);
      
      const anyWindowsActive = hymnsActive || bibleActive || imagesActive;
      
      console.log(`Active windows check - Hymns: ${hymnsActive}, Bible: ${bibleActive}, Images: ${imagesActive}`);
      
      // If no windows are active, clear all content
      if (!anyWindowsActive) {
        console.log('No active windows detected, clearing all content');
        setCurrentContent(null);
        setStreamContent({});
        setLiveStream(false);
        setLastActiveSource(null);
        
        // Clear the projection preview in the main window as well
        invoke('emit_main', {
          event: 'clear-projection-preview',
          payload: {}
        }).catch(err => console.error('Error clearing projection preview:', err));
        
        // Clear canvas if it exists
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      }
    });
    
    // Add a "reset-projection" event listener for complete component reset
    const unlistenResetProjection = listen<{ source: string }>('reset-projection', (event) => {
      const { source } = event.payload;
      console.log(`Reset projection request from source: ${source}`);
      
      // Perform a complete reset of the projection component
      setCurrentContent(null);
      setNextContent(null);
      setStreamContent({});
      setLiveStream(false);
      setLastActiveSource(null);
      setIsActive(false);
      setIsUpdating(false);
      
      // Clear canvas if it exists
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
      
      // Clear the projection preview in the main window
      invoke('emit_main', {
        event: 'clear-projection-preview',
        payload: { source }
      }).catch(error => console.error(`Error clearing projection preview for ${source}:`, error));
      
      // Also clear any stored state that might persist between hymns
      window.dispatchEvent(new CustomEvent('projection-reset', {
        detail: { source }
      }));
      
      console.log(`Projection component fully reset by ${source}`);
    });

    return () => {
      unmounted = true;
      unlistenClearAll.then(f => f());
      unlistenClearContent.then(f => f());
      unlistenCheckWindows.then(f => f());
      unlistenResetProjection.then(f => f());
    };

  }, [canvasRef, currentContent, streamContent, lastActiveSource]);

  const hasContent = currentContent !== null;

  return (
    <div>
      <div className="flex items-center gap-3">
        <Icon data={DisplayIcon} size={20} />
        <span className="text-foreground text-base font-medium">Projection</span>
      </div>
      <Card className="relative h-72 mt-3 border border-border overflow-hidden p-0 rounded-b-none" style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
        <div className="p-0 h-full overflow-hidden">
          {hasContent ? (
            <div className={cn(
              "w-full h-full flex flex-col items-center justify-center overflow-hidden relative",
              isActive ? "bg-black" : "bg-accent"
            )}>
              {/* Live stream canvas - only shown when streaming */}
              {liveStream && (
                <canvas
                  ref={canvasRef}
                  className={cn(
                    "w-full h-full object-fill",
                    transitioning ? TRANSITION_CLASS : ""
                  )}
                  style={{ objectFit: 'fill' }}
                />
              )}
              
              {/* Regular content - only shown when not streaming */}
              {!liveStream && currentContent && (
                currentContent.isScreenshot || currentContent.type === 'image' ? (
                  <div className="relative w-full h-full">
                    <Image
                      ref={imageRef}
                      src={currentContent.content}
                      alt="Projection content"
                      className={cn(
                        "object-fill",
                        transitioning ? TRANSITION_CLASS : ""
                      )}
                      fill={true}
                      unoptimized={true}
                      priority={true}
                      style={{ objectFit: 'fill' }}
                    />
                  </div>
                ) : (
                  <div 
                    dangerouslySetInnerHTML={{ __html: currentContent.content }}
                    className={cn(
                      "w-full h-full flex items-center justify-center text-center",
                      transitioning ? TRANSITION_CLASS : ""
                    )}
                  />
                )
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <Icon data={DisplayIcon} size={28} />
              <span className="text-sm font-medium mt-2">No active content</span>
              <span className="text-muted-foreground text-xs">Content will appear here when you start a preview</span>
            </div>
          )}
        </div>
      </Card>
      {/* Dynamic controls beneath preview - always render to avoid layout shift */}
      <div className="border border-border border-t-0 rounded-t-none rounded-b-md p-3">
        {currentContent?.type === 'hymn' ? (
          <div className="text-sm text-muted-foreground">Hymn controls will appear here</div>
        ) : currentContent?.type === 'bible' ? (
          <BibleQuickVerseButtons referenceText={currentContent.content} embedded />
        ) : currentContent?.type === 'image' && currentContent.source === 'church-order' ? (
          <div className="text-sm text-muted-foreground">Running order active</div>
        ) : (
          <div className="text-sm text-muted-foreground flex items-center justify-between">
            <span>Controls will appear here when content is active</span>
            <Link href="/settings/display" className="ml-2">
              <Tooltip content="Display settings">
                <Button size="s" view="outlined" className="h-6 px-2">
                  <Icon data={DisplayIcon} size={14} />
                </Button>
              </Tooltip>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
