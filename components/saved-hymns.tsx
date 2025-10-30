'use client'

import React, { useState, useEffect } from "react";
import { Bookmark, Add, Delete } from '@nine-thirty-five/material-icons-react/rounded';
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invoke } from '@tauri-apps/api/core';
import { toast } from "sonner";
import useVerseStore from "@/lib/store";
import { Hymn } from "@/app/types/hymn";

interface SavedHymn {
  id: string;
  number: string;
  language: string;
  hymnType: string;
  label?: string;
}

export function SavedHymns() {
  const [savedHymns, setSavedHymns] = useState<SavedHymn[]>([]);
  const [hymnNumber, setHymnNumber] = useState('');
  const [language, setLanguage] = useState('AFR');
  const [hymnType, setHymnType] = useState('adventlofliedere');
  const [label, setLabel] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Load saved hymns from localStorage
  useEffect(() => {
    const storedHymns = localStorage.getItem('savedHymns');
    if (storedHymns) {
      setSavedHymns(JSON.parse(storedHymns));
    }
  }, []);

  // Save hymns to localStorage whenever savedHymns changes
  useEffect(() => {
    localStorage.setItem('savedHymns', JSON.stringify(savedHymns));
  }, [savedHymns]);

  const addHymn = () => {
    if (!hymnNumber.trim()) {
      toast.error("Please enter a hymn number");
      return;
    }

    const newHymn: SavedHymn = {
      id: Date.now().toString(),
      number: hymnNumber,
      language,
      hymnType,
      label: label.trim() || `${language} ${hymnNumber}`
    };

    setSavedHymns(prev => [...prev, newHymn]);
    setHymnNumber('');
    setLabel('');
    setDialogOpen(false);
    toast.success("Hymn saved");
  };

  const removeHymn = (id: string) => {
    setSavedHymns(prev => prev.filter(hymn => hymn.id !== id));
    toast.success("Hymn removed");
  };

  const displayHymn = async (hymn: SavedHymn) => {
    try {
      // First, get the hymn details to initialize the verse store
      const hymns = await invoke<Hymn[]>('get_hymns_by_language', {
        language: hymn.language,
        hymnType: hymn.hymnType
      });
      
      const selectedHymn = hymns.find(h => h.number.toString() === hymn.number);
      
      if (selectedHymn) {
        // Initialize verse store for playback controls
        useVerseStore.getState().resetAll();
        useVerseStore.getState().setTotalVerses(selectedHymn.verses_count);
        useVerseStore.getState().setHasRefrain(selectedHymn.has_refrain);
        
        // Create a default sequence based on the hymn structure
        const sequence: ('title' | 'verse' | 'refrain' | 'blank')[] = ['title'];
        
        // Add verses and refrains in the correct order
        for (let i = 1; i <= selectedHymn.verses_count; i++) {
          sequence.push('verse');
          if (selectedHymn.has_refrain) {
            sequence.push('refrain');
          }
        }
        
        useVerseStore.getState().setSequence(sequence);
        
        // Display the hymn
        await invoke('display_hymn', {
          language: hymn.language,
          hymnType: hymn.hymnType,
          hymnNumber: hymn.number
        });
        
        // Set the first verse as active
        useVerseStore.getState().setActiveVerse(0);
        
        toast.success(`Displaying hymn ${hymn.number}`);
      } else {
        throw new Error(`Hymn ${hymn.number} not found`);
      }
    } catch (error) {
      console.error("Error displaying hymn:", error);
      toast.error("Failed to display hymn");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Bookmark className="text-muted-foreground h-9 w-9" />
          <span className="text-foreground text-xl font-medium">Saved Hymns</span>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="gap-2"
            >
              <Add className="h-5 w-5" />
              Add Hymn
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Hymn</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="language" className="text-sm font-medium">Language</label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AFR">Afrikaans</SelectItem>
                    <SelectItem value="ENG">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <label htmlFor="hymnType" className="text-sm font-medium">Hymn Type</label>
                <Select value={hymnType} onValueChange={setHymnType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select hymn type" />
                  </SelectTrigger>
                  <SelectContent>
                    {language === 'AFR' ? (
                      <>
                        <SelectItem value="adventlofliedere">Advent Lofliedere</SelectItem>
                        <SelectItem value="adventjeugliede">Advent Jeug Liede</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="adventhymnal">Advent Hymnal</SelectItem>
                        <SelectItem value="adventyouthsongs">Advent Youth Songs</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <label htmlFor="hymnNumber" className="text-sm font-medium">Hymn Number</label>
                <Input
                  id="hymnNumber"
                  value={hymnNumber}
                  onChange={(e) => setHymnNumber(e.target.value)}
                  placeholder="Enter hymn number"
                />
              </div>
              
              <div className="grid gap-2">
                <label htmlFor="label" className="text-sm font-medium">Label (optional)</label>
                <Input
                  id="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Custom label"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={addHymn}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="relative h-72 w-[30rem] p-0 mt-5 bg-card-background border-0">
        <CardContent className="p-3 h-full">
          {savedHymns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Bookmark className="text-muted-foreground h-12 w-12" />
              <span className="text-lg font-medium mt-1">No saved hymns</span>
              <span className="text-muted-foreground text-base font-normal">Save hymns for quick access</span>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 mt-3"
                  >
                    <Add className="h-4 w-4" />
                    Add First Hymn
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          ) : (
            <div className="overflow-y-auto h-full pr-1">
              <div className="grid grid-cols-3 gap-2">
                {savedHymns.map(hymn => (
                  <div key={hymn.id} className="relative group">
                    <Button 
                      variant="outline" 
                      className="w-full justify-between overflow-hidden bg-foreground/5 hover:bg-foreground/10 border-foreground/10 h-10"
                      onClick={() => displayHymn(hymn)}
                    >
                      <span className="truncate">{hymn.label}</span>
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -right-2 -top-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeHymn(hymn.id);
                      }}
                    >
                      <Delete className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SavedHymns;
