'use client'

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { List } from '@nine-thirty-five/material-icons-react/rounded'
import { Button, Card, DropdownMenu, Icon, Menu } from '@gravity-ui/uikit'
import { GripVertical } from 'lucide-react'
import { Plus, EllipsisVertical, Shuffle as GShuffle, PencilToSquare, TrashBin } from '@gravity-ui/icons'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
// Replaced custom dropdown with Gravity UI Menu
import { displayStream } from '@/lib/display-stream';
import { invoke } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { PhysicalPosition, availableMonitors } from '@tauri-apps/api/window'

// Check if we're running in Tauri or browser
const isTauri = typeof window !== 'undefined' && window !== undefined && '__TAURI__' in window;

// Tauri APIs are imported with types above; guard their usage with isTauri

interface OrderItem {
  id: string
  content: string
}

interface ImageInfo {
  name: string
  path: string
}

const ImageDialog = dynamic(() => import('@/components/image-dialog'), {
  ssr: false,
  loading: () => null
})

const AddOrderItemDialog = dynamic(() => import('@/components/add-order-item-dialog'), {
  ssr: false,
  loading: () => null
})

export function Order() {
  const [openImageDialog, setOpenImageDialog] = useState(false)
  const [openAddDialog, setOpenAddDialog] = useState(false)
  const [currentFolder, setCurrentFolder] = useState("")
  const [items, setItems] = useState<OrderItem[]>([])
  const [currentEditItem, setCurrentEditItem] = useState<OrderItem | null>(null)
  const [scale, setScale] = useState(1);
  const [lastRandomImage, setLastRandomImage] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  type ColId = 'col-0' | 'col-1';
  const [columns, setColumns] = useState<Record<ColId, string[]>>({ 'col-0': [], 'col-1': [] });

  // DnD handled via @hello-pangea/dnd

  useEffect(() => {
    const loadItems = async () => {
      try {
        // In web preview, do nothing (no placeholders)
        if (!isTauri) return;
        // load items from local storage
        const savedItems = await invoke<OrderItem[]>('get_order_items');
        
        await invoke('preload_images');
        const imageFolders = await invoke<string[]>('get_image_folders');
        
        // Create a map of existing items by content name for quick lookup
        const existingItemsMap = new Map<string, OrderItem>();
        if (savedItems) {
          savedItems.forEach(item => existingItemsMap.set(item.content, item));
        }
        
        // Combine saved items with folders that don't have items yet
        const combinedItems: OrderItem[] = [];
        
        // Add all saved items first
        if (savedItems) {
          combinedItems.push(...savedItems);
        }
        
        // Add new items for folders that don't have a corresponding saved item
        // but limit total to 10 items maximum
        let remainingSlots = 10 - combinedItems.length;
        
        if (remainingSlots > 0) {
          for (const folder of imageFolders) {
            if (!existingItemsMap.has(folder) && remainingSlots > 0) {
              combinedItems.push({ 
                id: `item-${Date.now()}-${folder}`, 
                content: folder 
              });
              remainingSlots--;
            }
          }
          
          // If we added any new items, save them
          if (combinedItems.length > savedItems.length) {
            await invoke('save_order_items', { items: combinedItems });
          }
        }
        
        setItems(combinedItems);

        // Initialize two-column layout alternating ids
        const ids = combinedItems.map(it => it.id);
        const left: string[] = [];
        const right: string[] = [];
        ids.forEach((id, idx) => (idx % 2 === 0 ? left : right).push(id));
        setColumns({ 'col-0': left, 'col-1': right });
      } catch (error) {
        console.error('Failed to load order items:', error);
      }
    };
    loadItems();
  }, []);

  useEffect(() => {
    const updateScale = () => {
      const scaleStr = getComputedStyle(document.documentElement)
        .getPropertyValue('--scale-factor');
      setScale(parseFloat(scaleStr) || 1);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  useEffect(() => {
    // Listen for stop events
    const handleMainStop = async (event: Event) => {
      if (!isTauri) {
        setActiveItem(null);
        return;
      }
      // Always check for active windows, regardless of source
      const imageWindows = await invoke<string[]>('get_image_windows');
      if (imageWindows.length === 0) {
        setActiveItem(null);
      }
    };

    // Use CustomEvent to handle the payload
    window.addEventListener('stopTimer', handleMainStop as EventListener);
    return () => window.removeEventListener('stopTimer', handleMainStop as EventListener);
  }, []);

  const saveItems = async (newItems: OrderItem[]) => {
    try {
      if (isTauri) {
        await invoke('save_order_items', { items: newItems });
      }
    } catch (error) {
      console.error('Failed to save order items:', error);
    }
  };

  const handleButtonClick = (item: string) => {
    // Open should only open dialog; do not toggle active state
    setCurrentFolder(item)
    setOpenImageDialog(true)
  }

  const handleAddItem = (name: string) => {
    if (items.length >= 10) return;

    if (currentEditItem) {
      const newItems = items.map(item =>
        item.id === currentEditItem.id
          ? { ...item, content: name }
          : item
      );
      setItems(newItems);
      saveItems(newItems);
    } else {
      const newId = `item-${Date.now()}`;
      const newItems = [...items, { id: newId, content: name }];
      setItems(newItems);
      saveItems(newItems);

      // Place new item into the shorter column to keep balance
      setColumns(prev => {
        const leftLen = prev['col-0'].length;
        const rightLen = prev['col-1'].length;
        const target: ColId = leftLen <= rightLen ? 'col-0' : 'col-1';
        return {
          'col-0': target === 'col-0' ? [...prev['col-0'], newId] : prev['col-0'],
          'col-1': target === 'col-1' ? [...prev['col-1'], newId] : prev['col-1'],
        };
      });
    }
    setOpenAddDialog(false);
  }

  const handleEditItem = (id: string) => {
    const item = items.find(item => item.id === id);
    if (item) {
      setCurrentEditItem(item);
      setOpenAddDialog(true);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      // Find the item with this id to get its content (folder name) before removing
      const itemToDelete = items.find(item => item.id === id);
      if (!itemToDelete) return;
      
      // First remove from local state and storage
      const newItems = items.filter(item => item.id !== id);
      setItems(newItems);
      await saveItems(newItems);
      // Remove from columns as well
      setColumns(prev => ({
        'col-0': prev['col-0'].filter((x) => x !== id),
        'col-1': prev['col-1'].filter((x) => x !== id),
      }));
      
      // Then attempt to delete the folder if it exists and is no longer referenced
      // Only delete if no other item uses this folder name
      const isUsedByOtherItem = newItems.some(item => item.content === itemToDelete.content);
      if (!isUsedByOtherItem) {
        // Ask user to confirm deletion of the folder and all its images
        const confirmed = window.confirm(
          `Do you want to delete the "${itemToDelete.content}" folder and all its images?\n\nThis action cannot be undone.`
        );
        
        if (confirmed) {
          if (isTauri) {
            await invoke('delete_image_folder', { folderName: itemToDelete.content });
            console.log(`Deleted folder: ${itemToDelete.content}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  // Handle drag end across two columns
  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const srcCol = source.droppableId as ColId;
    const dstCol = destination.droppableId as ColId;

    setColumns(prev => {
      const next = { 'col-0': [...prev['col-0']], 'col-1': [...prev['col-1']] };
      // remove from source
      const srcArr = next[srcCol];
      const srcIdx = srcArr.indexOf(draggableId);
      if (srcIdx > -1) srcArr.splice(srcIdx, 1);
      // insert into dest
      const dstArr = next[dstCol];
      dstArr.splice(destination.index, 0, draggableId);

      // Persist unified order (col-0 then col-1)
      const orderedIds = [...next['col-0'], ...next['col-1']];
      const idToItem = new Map(items.map(it => [it.id, it] as const));
      const orderedItems = orderedIds.map(id => idToItem.get(id)!).filter(Boolean);
      saveItems(orderedItems);
      setItems(orderedItems);

      return next;
    });
  };

  const handleRandomClick = async (folderName: string) => {
    try {
        // Mark this folder active only for shuffle flow
        setActiveItem(folderName);
        await invoke('preload_images');
        const images = await invoke<ImageInfo[]>('get_images', { folder: folderName });

        if (images.length === 0) return;

        // Filter out last used image
        const availableImages = lastRandomImage
            ? images.filter(img => img.path !== lastRandomImage)
            : images;

        if (availableImages.length === 0) {
            // If no other images available, reset and use all images
            const randomImage = images[Math.floor(Math.random() * images.length)];
            setLastRandomImage(null);
            await handleImageDisplay(randomImage.path);
        } else {
            const randomImage = availableImages[Math.floor(Math.random() * availableImages.length)];
            setLastRandomImage(randomImage.path);
            await handleImageDisplay(randomImage.path);
        }
    } catch (error) {
        console.error('Failed to handle random image:', error);
    }
};

const handleImageDisplay = async (imagePath: string) => {
    try {
        if (!isTauri) return;
        const url = imagePath.replace(/\\/g, '/');
        const encodedPath = encodeURIComponent(url);

        // First update existing windows
        const existingWindows = await invoke<string[]>('get_image_windows');
        for (const windowLabel of existingWindows) {
            const window = await WebviewWindow.getByLabel(windowLabel);
            if (window) {
                await window.emit('update-image', { path: encodedPath });
            }
        }

        // Create new windows if needed
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

            window.dispatchEvent(new Event('startTimer'));
        }

        // Now start the stream after windows are created
        await displayStream.startStream({
          type: 'church-order',
          sourceId: encodedPath,
          source: 'church-order'
        });

        // Update main window preview
        await invoke('set_current_image', { path: encodedPath });
        await invoke('emit_main', {
            event: 'window-preview-update',
            payload: {
                content: encodedPath,
                type: 'image',
                displayId: 'church-order',
                source: 'church-order',
                isStream: true
            }
        });

    } catch (error) {
        console.error('Failed to display image:', error);
    }
};

  const clearProjectionContent = async () => {
    try {
      if (isTauri) {
        const projectionWindow = await WebviewWindow.getByLabel('projection');
        if (projectionWindow) {
          // Only clear church-order-specific content, not all content
          await projectionWindow.emit('clear-content', { 
            source: 'church-order' 
          });
          console.log('Sent clear-content event for church-order to projection window');
        }
      }
    } catch (error) {
      console.error('Error clearing projection content:', error);
    }
  };

  const handleStopItem = async (folderName: string) => {
    try {
      // Stop the stream for church-order
      await displayStream.stopStream('church-order', 'church-order');
      
      if (isTauri) {
        // Close image windows
        const selectedDisplays = await invoke<number[]>('get_selected_displays');

        for (const [index] of selectedDisplays.entries()) {
          const windowLabel = `image-window-${index}`;
          const window = await WebviewWindow.getByLabel(windowLabel);
          if (window) {
            await window.destroy();
          }
        }

        // Clear the preview
        await invoke('clear_current_image');
        await invoke('emit_main', {
          event: 'clear-preview',
          payload: { source: 'church-order' }
        });
        
        // Clear projection content
        await clearProjectionContent();
        
        // Trigger a check for active windows to see if we need to clear everything
        const projectionWindow = await WebviewWindow.getByLabel('projection');
        if (projectionWindow) {
          await projectionWindow.emit('check-active-windows', {});
        }

        // Check if this was the last window before clearing active item
        const remainingWindows = await invoke<string[]>('get_image_windows');
        if (remainingWindows.length === 0) {
          setActiveItem(null);
          window.dispatchEvent(new CustomEvent('stopTimer', {
            detail: { source: 'church-order' }
          }));
        }
      } else {
        // Web preview: just clear active selection
        setActiveItem(null);
      }
    } catch (error) {
      console.error('Failed to stop item:', error);
    }
  };

  const handleImageSelect = (_folder: string) => {
    // Selection from dialog already displays content; no extra state toggle here
  };

  return (
    <div className="flex-1">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <List className="text-muted-foreground h-5 w-5" />
          <span className="text-foreground text-base font-medium">Order</span>
        </div>
        {items.length < 10 ? (
          <Button view="outlined" size="m" onClick={() => setOpenAddDialog(true)}>
            <Icon data={Plus} size={16} />
            Add Item
          </Button>
        ) : (
          <span className="text-muted-foreground font-medium">10/10</span>
        )}
      </div>
      <Card className="mt-2 p-2 rounded-md border border-border bg-card-background h-72">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <List className="text-muted-foreground h-7 w-7" />
            <span className="text-sm font-medium mt-2">No order items</span>
            <span className="text-muted-foreground text-xs">Add items to create an order</span>
            <div className="mt-2">
              <Button view="outlined" size="m" onClick={() => setOpenAddDialog(true)}>
                <Icon data={Plus} size={16} />
                Add Item
              </Button>
            </div>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(['col-0','col-1'] as const).map((colId) => (
                <Droppable key={colId} droppableId={colId}>
                  {(dropProvided) => (
                    <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="flex flex-col gap-2">
                      {columns[colId]?.map((id, index) => {
                        const item = items.find(i => i.id === id);
                        if (!item) return null;
                        const isActive = activeItem === item.content;
                        return (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={`flex items-center justify-between rounded-md border border-border bg-card-background px-2 py-1 ${dragSnapshot.isDragging ? 'ring-2 ring-primary' : ''}`}
                              >
                                <div
                                  className="flex items-center gap-2 min-w-0 cursor-pointer hover:bg-foreground/5 rounded px-1 py-0.5"
                                  onClick={() => handleButtonClick(item.content)}
                                >
                                  <span {...dragProvided.dragHandleProps} className="text-muted-foreground hover:text-foreground cursor-grab px-1" aria-label="Drag handle">
                                    <GripVertical className="h-4 w-4" />
                                  </span>
                                  <div className="truncate text-sm">{item.content}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="m"
                                    view={'flat'}
                                    aria-label="Shuffle"
                                    onClick={() => handleRandomClick(item.content)}
                                  >
                                    <Icon data={GShuffle} size={16} />
                                  </Button>
                                  <DropdownMenu
                                    size="m"
                                    renderSwitcher={({onClick, onKeyDown}) => (
                                      <Button view="flat" size="m" aria-haspopup="menu" onClick={onClick} onKeyDown={onKeyDown} aria-label="Item menu">
                                        <Icon data={EllipsisVertical} size={16} />
                                      </Button>
                                    )}
                                  >
                                    <Menu size="m">
                                      <Menu.Item iconStart={<Icon data={PencilToSquare} size={14} />} onClick={() => handleEditItem(item.id)}>
                                        Edit
                                      </Menu.Item>
                                      <Menu.Item iconStart={<Icon data={TrashBin} size={14} />} onClick={() => handleDeleteItem(item.id)}>
                                        Delete
                                      </Menu.Item>
                                    </Menu>
                                  </DropdownMenu>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {dropProvided.placeholder}
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </DragDropContext>
        )}
      </Card>
      {isTauri && (
        <ImageDialog
          isOpen={openImageDialog}
          onOpenChange={setOpenImageDialog}
          folderName={currentFolder}
          onImageSelect={handleImageSelect}  
        />
      )}
      <AddOrderItemDialog
        isOpen={openAddDialog}
        onOpenChange={(open) => {
          setOpenAddDialog(open);
          if (!open) setCurrentEditItem(null);
        }}
        onAdd={handleAddItem}
        initialValue={currentEditItem?.content}
        isEditing={!!currentEditItem}
      />
    </div>
  )
}
