'use client'

import React, { useEffect, useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileUpload, Refresh } from '@nine-thirty-five/material-icons-react/rounded';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Image from "next/image";
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { open } from '@tauri-apps/plugin-dialog';
import { PhysicalPosition, availableMonitors } from '@tauri-apps/api/window';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash } from 'lucide-react';
import { setupScreenshotObserver } from '@/lib/screenshot';
import { displayStream } from '@/lib/display-stream';

interface ImageInfo {
  name: string;
  path: string;
}

interface ImageDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  onImageSelect?: (folder: string) => void;  // Add this prop
}

export default function ImageDialog({ isOpen, onOpenChange, folderName, onImageSelect }: ImageDialogProps) {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const dialogContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Set up screenshot observer whenever the dialog is open
  useEffect(() => {
    let cleanup = { cleanup: () => {} };

    if (isOpen && dialogContentRef.current) {
      // Setup screenshot observer to capture dialog content changes
      cleanup = setupScreenshotObserver(dialogContentRef.current, 'image');
    }

    return () => {
      cleanup.cleanup();
    };
  }, [isOpen]);

  useEffect(() => {
    const loadImages = async () => {
      if (!mounted) return;

      try {
        await invoke('preload_images');
        const imageData: ImageInfo[] = await invoke('get_images', { folder: folderName });
        setImages(imageData);
      } catch (error) {
        console.error('Failed to load images:', error);
        setError('Failed to load images');
      }
    };

    if (isOpen && mounted) {
      loadImages();
    }
  }, [isOpen, folderName, mounted]);

  const handleUpload = async () => {
    if (!mounted) return;

    try {
      const selected = await open({
        directory: false,
        multiple: true,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp']
        }]
      });

      if (selected && Array.isArray(selected)) {
        await invoke('upload_images', {
          folder: folderName,
          files: selected
        });
        await invoke('preload_images');
        const imageData: ImageInfo[] = await invoke('get_images', { folder: folderName });
        setImages(imageData);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError('Failed to upload images');
    }
  };

  const handleClearCache = async () => {
    if (!mounted) return;

    try {
      await invoke('clear_cache_for_folder', { folder: folderName });
      setImages([]);
    } catch (error) {
      console.error('Failed to clear cache:', error);
      setError('Failed to clear cache');
    }
  };

  const handleImageClick = async (imagePath: string, shouldStartTimer: boolean = true) => {
    try {
      const url = imagePath.replace(/\\/g, '/');
      const encodedPath = encodeURIComponent(url);

      // First update existing windows
      const existingWindows = await invoke<string[]>('get_image_windows');

      // If there are existing windows, update them with new image
      for (const windowLabel of existingWindows) {
        const window = await WebviewWindow.getByLabel(windowLabel);
        if (window) {
          await window.emit('update-image', { path: encodedPath });
        }
      }

      // If no existing windows, create them for each selected display
      if (existingWindows.length === 0) {
        const selectedDisplays = await invoke<number[]>('get_selected_displays');
        const monitors = await availableMonitors();

        for (const [index, displayIndex] of selectedDisplays.entries()) {
          const windowLabel = `image-window-${index}`;
          const validIndex = Math.min(displayIndex, monitors.length - 1);
          const targetMonitor = monitors[validIndex];

          const webview = new WebviewWindow(windowLabel, {
            url: `/display?image=${encodedPath}`,
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
          });
        }
      }

      // Now that windows are created, start the stream
      await displayStream.startStream({
        type: 'image',
        sourceId: encodedPath,
        source: 'image-dialog'
      });

      // Store the current image path
      await invoke('set_current_image', { path: encodedPath });

      // Use the window-preview-update event with stream information
      await invoke('emit_main', {
        event: 'window-preview-update',
        payload: {
          content: encodedPath,
          type: 'image',
          displayId: 'image',
          source: 'image-dialog',
          isStream: true
        }
      });

      if (shouldStartTimer) {
        window.dispatchEvent(new Event('startTimer'));
      }

      onImageSelect?.(folderName);
    } catch (error) {
      console.error('Failed to handle image click:', error);
    }
  };

  const handleDeleteImage = async (imagePath: string) => {
    try {
      await invoke('delete_image', { path: imagePath });
      setImages(images.filter(img => img.path !== imagePath));
    } catch (error) {
      console.error('Failed to delete image:', error);
      setError('Failed to delete image');
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent ref={dialogContentRef} className="fixed top-[40%] left-1/2 -translate-x-1/2 sm:max-w-[675px] max-h-[500px] bg-background flex flex-col">
        <DialogHeader className="flex flex-row items-center gap-2 flex-shrink-0 px-6 py-4 border-b">
          <DialogTitle className='text-xl font-medium mr-2'>{folderName} Images</DialogTitle>
          <TooltipProvider>
            <Tooltip defaultOpen={false} delayDuration={50}>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleUpload}
                  className="h-8 w-8"
                >
                  <FileUpload className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="select-none">
                <p>Upload images</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip defaultOpen={false} delayDuration={50}>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleClearCache}
                  className="h-8 w-8"
                >
                  <Refresh className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="select-none">
                <p>Clear cache</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error ? (
            <p className="text-red-500">{error}</p>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <div className="text-muted-foreground text-center">
                <p>No images found in this folder</p>
                <p className="text-sm">Click the upload button to add images</p>
              </div>
              <Button
                variant="outline"
                onClick={handleUpload}
                className="gap-2"
              >
                <FileUpload className="h-5 w-5" />
                Upload Images
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {images.map((image, index) => (
                <div
                  key={index}
                  className="relative w-full cursor-pointer overflow-hidden rounded-lg border border-border hover:border-border/80"
                  style={{ aspectRatio: '16/9' }}
                >
                  <div
                    className="absolute top-2 right-2 z-10"
                    onClick={e => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-background/25"
                        >
                          <MoreVertical className="h-6 w-6 text-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() => handleDeleteImage(image.path)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div
                    onClick={() => handleImageClick(image.path)}
                    className="w-full h-full"
                  >
                    <Image
                      src={convertFileSrc(image.path)}
                      alt={image.name}
                      width="300"
                      height={300 * (9 / 16)}
                      className="h-full w-full object-contain bg-black"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
