'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info, FolderOpen } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'

interface AddOrderItemDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (name: string) => void
  initialValue?: string
  isEditing?: boolean
}

export default function AddOrderItemDialog({
  isOpen,
  onOpenChange,
  onAdd,
  initialValue = '',
  isEditing = false,
}: AddOrderItemDialogProps) {
  const [name, setName] = useState(initialValue)
  const [availableFolders, setAvailableFolders] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setName(initialValue);
      loadFolders();
    }
  }, [isOpen, initialValue]);

  const loadFolders = async () => {
    try {
      setLoading(true);
      await invoke('preload_images');
      const folders = await invoke<string[]>('get_image_folders');
      setAvailableFolders(folders);
    } catch (error) {
      console.error('Failed to load folders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      try {
        // Check if the folder exists, create it if it doesn't
        const folderExists = availableFolders.includes(name.trim());
        if (!folderExists) {
          await invoke('create_image_folder', { folderName: name.trim() });
        }
        // Add the item
        onAdd(name.trim())
        setName('')
      } catch (error) {
        console.error('Failed to create folder:', error);
      }
    }
  }

  const handleFolderSelect = (folderName: string) => {
    setName(folderName);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="fixed top-[35%] left-1/2 -translate-x-1/2 sm:max-w-[675px] max-h-[70vh] overflow-y-auto bg-background border-0 shadow-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Order Item' : 'Add Order Item'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Item Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter item name"
              />
            </div>
            
            {availableFolders.length > 0 && (
              <div className="space-y-2">
                <Label>Available Folders</Label>
                <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-2 border rounded-md bg-card-background">
                  {availableFolders.map((folder) => (
                    <Button
                      key={folder}
                      type="button"
                      variant={name === folder ? "default" : "outline"}
                      className="justify-start gap-2 overflow-hidden"
                      onClick={() => handleFolderSelect(folder)}
                    >
                      <FolderOpen className="h-4 w-4 shrink-0" />
                      <span className="truncate">{folder}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            <Alert className="bg-muted/50 border border-muted">
              <Info className="h-4 w-4" />
              <AlertDescription>
                A folder with this name will be created for storing images. If the folder already exists, it will be used.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={!name.trim()}>
              {isEditing ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
