'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { QueueMusic, PlayArrow } from '@nine-thirty-five/material-icons-react/rounded'
import { invoke } from '@tauri-apps/api/core'
import { toast } from "sonner"
import { Hymn } from "@/app/types/hymn"

interface HymnSearchDialogProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (language: string, hymnType: string, hymnNumber: string, hymnTitle: string, selectedVerses: number[]) => void
}

export function HymnSearchDialog({ isOpen, onClose, onAdd }: HymnSearchDialogProps) {
  const [language, setLanguage] = useState('AFR')
  const [hymnType, setHymnType] = useState('adventlofliedere')
  const [searchValue, setSearchValue] = useState('')
  const [hymns, setHymns] = useState<Hymn[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedHymn, setSelectedHymn] = useState<Hymn | null>(null)
  const [selectedVerses, setSelectedVerses] = useState<number[]>([])
  const [allVerses, setAllVerses] = useState(true)

  // Update hymnType when language changes
  useEffect(() => {
    if (language === 'AFR') {
      setHymnType('adventlofliedere')
    } else {
      setHymnType('adventhymnal')
    }
  }, [language])

  // Handle verse selection
  useEffect(() => {
    if (selectedHymn && allVerses) {
      // Select all verses
      const verses = Array.from({ length: selectedHymn.verses_count }, (_, i) => i + 1)
      setSelectedVerses(verses)
    } else if (selectedHymn && !allVerses && selectedVerses.length === 0) {
      // If no verses are selected, default to verse 1
      setSelectedVerses([1])
    }
  }, [selectedHymn, allVerses])

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      toast.error("Please enter a hymn number")
      return
    }

    setIsLoading(true)
    try {
      const results = await invoke<Hymn[]>('get_hymns', {
        language,
        hymnType,
        searchValue
      })
      
      setHymns(results)
      
      if (results.length === 0) {
        toast.error(`No hymns found for number: ${searchValue}`)
      }
    } catch (error) {
      console.error('Error searching hymns:', error)
      toast.error('Failed to search hymns')
    } finally {
      setIsLoading(false)
    }
  }

  const handleHymnSelect = (hymn: Hymn) => {
    setSelectedHymn(hymn)
    // Reset verse selection and revert to "All Verses" on hymn change
    setAllVerses(true)
    setSelectedVerses(Array.from({ length: hymn.verses_count }, (_, i) => i + 1))
  }

  const handleAddHymn = () => {
    if (!selectedHymn) return
    
    onAdd(
      language, 
      hymnType, 
      selectedHymn.number.toString(), 
      selectedHymn.title,
      selectedVerses
    )
    
    // Reset state
    setSearchValue('')
    setHymns([])
    setSelectedHymn(null)
    setSelectedVerses([])
    setAllVerses(true)
    onClose()
  }

  const handleVerseToggle = (verseNumber: number) => {
    setAllVerses(false)
    if (selectedVerses.includes(verseNumber)) {
      // Remove verse if already selected
      const newVerses = selectedVerses.filter(v => v !== verseNumber)
      // If removing would leave no verses, add verse 1 by default
      if (newVerses.length === 0) {
        setSelectedVerses([1])
      } else {
        setSelectedVerses(newVerses)
      }
    } else {
      // Add verse if not already selected
      setSelectedVerses(prev => [...prev, verseNumber])
    }
  }

  const handleAllVersesToggle = (checked: boolean) => {
    setAllVerses(checked)
    if (checked && selectedHymn) {
      setSelectedVerses(Array.from({ length: selectedHymn.verses_count }, (_, i) => i + 1))
    } else if (!checked) {
      // Default to verse 1 when switching from All Verses to specific verses
      setSelectedVerses([1])
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed top-[35%] left-1/2 -translate-x-1/2 sm:max-w-[675px] max-h-[70vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium">Add Hymn to List</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="bg-background border-muted-foreground/25">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AFR">Afrikaans</SelectItem>
                    <SelectItem value="ENG">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Hymn Book</Label>
                <Select value={hymnType} onValueChange={setHymnType}>
                  <SelectTrigger className="bg-background border-muted-foreground/25">
                    <SelectValue placeholder="Select hymn book" />
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
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Hymn Number</Label>
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter hymn number"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="bg-background border-muted-foreground/25"
                />
                <Button 
                  onClick={handleSearch} 
                  disabled={isLoading}
                  className="min-w-[100px]"
                >
                  {isLoading ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </div>

            {hymns.length > 0 && (
              <div className="border border-muted-foreground/25 rounded-md overflow-hidden mt-4">
                <div className="bg-muted-foreground/10 px-4 py-2">
                  <Label className="text-sm font-medium">Search Results</Label>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {hymns.map(hymn => (
                    <div 
                      key={hymn.id} 
                      className={`px-4 py-3 border-t border-muted-foreground/25 hover:bg-muted-foreground/5 cursor-pointer flex justify-between items-center ${selectedHymn?.id === hymn.id ? 'bg-green-500/10' : ''}`}
                      onClick={() => handleHymnSelect(hymn)}
                    >
                      <div>
                        <div className="font-medium text-foreground">{hymn.title}</div>
                        <div className="text-sm text-muted-foreground">
                          #{hymn.number} - {hymnType === 'adventlofliedere' ? 'Advent Lofliedere' :
                                           hymnType === 'adventjeugliede' ? 'Advent Jeug Liede' :
                                           hymnType === 'adventhymnal' ? 'Advent Hymnal' :
                                           hymnType === 'adventyouthsongs' ? 'Advent Youth Songs' : 
                                           hymnType}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8"
                      >
                        <QueueMusic className="h-5 w-5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedHymn && (
              <div className="border border-muted-foreground/25 rounded-md overflow-hidden mt-4">
                <div className="bg-muted-foreground/10 px-4 py-2">
                  <Label className="text-sm font-medium">Verse Selection</Label>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="all-verses" 
                      checked={allVerses} 
                      onCheckedChange={handleAllVersesToggle}
                    />
                    <Label htmlFor="all-verses" className="font-medium text-sm">
                      All Verses
                    </Label>
                  </div>
                  
                  {!allVerses && (
                    <div className="grid grid-cols-5 sm:grid-cols-6 gap-1 pt-2">
                      {Array.from({ length: selectedHymn.verses_count }, (_, i) => i + 1).map(verseNum => (
                        <div 
                          key={verseNum}
                          onClick={() => handleVerseToggle(verseNum)}
                          className={`
                            h-10 w-10 rounded-md flex items-center justify-center cursor-pointer
                            transition-colors duration-200
                            ${selectedVerses.includes(verseNum) 
                              ? 'bg-green-500/20 text-green-500 font-medium ring-1 ring-green-500' 
                              : 'bg-muted-foreground/5 text-muted-foreground hover:bg-muted-foreground/10'}
                          `}
                        >
                          {verseNum}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="bg-muted-foreground/10 hover:bg-muted-foreground/20"
            >
              Cancel
            </Button>
            {selectedHymn && (
              <Button 
                onClick={handleAddHymn}
                className="min-w-[100px]"
              >
                Add Hymn
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
