'use client'

import React, { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QueueMusic, AutoStories, Language, PlayArrow, Stop, MusicNote } from '@nine-thirty-five/material-icons-react/rounded'
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Hymn } from '@/app/types/hymn';
import { Search } from 'lucide-react';
import { toast } from "sonner";
import useVerseStore from '@/lib/store';

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
  ]
};

export function HymnSearch() {
  const [language, setLanguage] = useState("AFR");
  const [hymnType, setHymnType] = useState("adventlofliedere");
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputRef, setInputRef] = useState<HTMLInputElement | null>(null);
  const [selectedHymn, setSelectedHymn] = useState<Hymn | null>(null);
  
  const handleHymnSelect = useCallback((hymn: Hymn) => {
    setSearchTerm(`${hymn.number} - ${hymn.title}`);
    setSelectedHymn(hymn);
    setShowDropdown(false);
  }, []);

  const fetchHymns = useCallback(async (lang: string, type: string, searchValue: string = "") => {
    try {
      const hymnData = await invoke<Hymn[]>('get_hymns', {
        language: lang,
        hymnType: type,
        searchValue
      });

      if (!hymnData) {
        console.error('No hymn data returned from database');
        return;
      }

      setHymns(hymnData);
      
      // If we have a search value, try to select the matching hymn
      if (searchValue && hymnData.length > 0) {
        const matchingHymn = hymnData.find(h => h.number.toString() === searchValue);
        if (matchingHymn) {
          handleHymnSelect(matchingHymn);
        }
      }
    } catch (error) {
      console.error('Failed to load hymns:', error);
      toast.error("Failed to load hymns");
    }
  }, [handleHymnSelect]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setShowDropdown(value.length > 0);
    
    // Reset selectedHymn when search is cleared
    if (!value) {
      setSelectedHymn(null);
    }
  };

  const handleDisplayHymn = async () => {
    if (!selectedHymn) return;

    try {
      // Initialize verse store
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
      useVerseStore.getState().setActiveVerse(0);
      
      // Display the hymn
      await invoke('display_hymn', {
        language: selectedHymn.language,
        hymnType: selectedHymn.hymn_type,
        hymnNumber: selectedHymn.number.toString()
      });
      
      toast.success(`Displaying hymn ${selectedHymn.number}`);
    } catch (error) {
      console.error("Error displaying hymn:", error);
      toast.error("Failed to display hymn");
    }
  };

  const handleKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedHymn) {
      e.preventDefault();
      handleDisplayHymn();
    }
  };

  useEffect(() => {
    // Initial loading of hymns
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

  // Handle language change based on dropdown
  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    setHymnType(HYMN_TYPES[newLanguage as keyof typeof HYMN_TYPES][0].value);
    setSearchTerm('');
    setSelectedHymn(null);
    setShowDropdown(false);
  };

  // Handle hymn type change based on dropdown
  const handleHymnTypeChange = (newType: string) => {
    setHymnType(newType);
    setSearchTerm('');
    setSelectedHymn(null);
    setShowDropdown(false);
  };

  return (
    <div>
      <div className="flex justify-start items-center gap-4">
        <QueueMusic className="text-muted-foreground h-9 w-9" />
        <span className="text-foreground text-xl font-medium">Hymn Search</span>
      </div>
      
      <div className="mt-4 space-y-4">
        {/* Language Selector */}
        <div className="flex space-x-4">
          <div className="flex-1">
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full p-3 bg-card border border-border rounded-md"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          </div>
          
          <div className="flex-1">
            <select
              value={hymnType}
              onChange={(e) => handleHymnTypeChange(e.target.value)}
              className="w-full p-3 bg-card border border-border rounded-md"
            >
              {HYMN_TYPES[language as keyof typeof HYMN_TYPES].map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Search Input */}
        <div className="relative">
          <div className="flex h-16 items-center bg-card/5 border border-border rounded-md hover:bg-card/10">
            <div className="h-full w-16 flex items-center justify-center bg-card-background border-r border-border">
              <MusicNote className="h-9 w-9 text-muted-foreground" />
            </div>
            <input
              ref={setInputRef}
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Search for a hymn..."
              className="flex-1 h-full px-4 text-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="px-4">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
          
          {/* Dropdown Results */}
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
        
        {/* Action Button */}
        {selectedHymn && (
          <Button
            onClick={handleDisplayHymn}
            className="w-full h-12 bg-green-500/25 text-green-500 hover:text-green-600 hover:bg-green-500/30"
          >
            <PlayArrow className="h-6 w-6 mr-2" />
            Display Hymn {selectedHymn.number}
          </Button>
        )}
      </div>
    </div>
  );
}

export default HymnSearch;
