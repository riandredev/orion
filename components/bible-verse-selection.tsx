"use client"

import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Book, Language, PlayArrow, Translate, Notes, Timeline, Stop } from "@nine-thirty-five/material-icons-react/rounded"
import ComboBox from "@/components/combobox"
import NumberComboBox from "@/components/number-combobox"
import type { BibleVerse, BibleTranslation } from "@/app/types/bible"
import { invoke } from "@tauri-apps/api/core"
import { useBibleVerseStore } from '@/lib/store';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { availableMonitors, PhysicalPosition } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { displayStream } from '@/lib/display-stream';

const languages = [
  {
    value: "AFR",
    label: "AFR",
  },
  {
    value: "ENG",
    label: "ENG",
  },
]

// Generate arrays for chapters and verses
const chapters = Array.from({ length: 150 }, (_, i) => i + 1) // Assuming max 150 chapters
const verses = Array.from({ length: 176 }, (_, i) => i + 1) // Assuming max 176 verses (Psalm 119)

export function BibleVerseSelection() {
  const [searchTerm, setSearchTerm] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedVerse, setSelectedVerse] = useState<BibleVerse | null>(null)
  const [searchResults, setSearchResults] = useState<BibleVerse[]>([])
  const [openTranslation, setOpenTranslation] = useState(false)
  const [translationValue, setTranslationValue] = useState("")
  const [openLanguage, setOpenLanguage] = useState(false)
  const [languageValue, setLanguageValue] = useState("AFR")
  const [openChapter, setOpenChapter] = useState(false)
  const [chapterValue, setChapterValue] = useState("") // Changed to empty string
  const [openVerse, setOpenVerse] = useState(false)
  const [verseValue, setVerseValue] = useState("") // Changed to empty string
  const [comparisonVerse, setComparisonVerse] = useState("")
  const [translation, setTranslation] = useState<BibleTranslation | null>(null)
  const [translations, setTranslations] = useState<BibleTranslation[]>([])
  const [availableChapters, setAvailableChapters] = useState<number[]>([])
  const [availableVerses, setAvailableVerses] = useState<number[]>([])
  const [selectedBook, setSelectedBook] = useState<string>("")
  const [isPlaying, setIsPlaying] = useState(false);
  const { setCurrentVerse, resetAll } = useBibleVerseStore();

  useEffect(() => {
    // Load available translations when component mounts
    const loadTranslations = async () => {
      try {
        const data = await invoke<BibleTranslation[]>("get_bible_translations")
        setTranslations(data)
        if (data.length > 0) {
          setTranslation(data[0]) // Set first translation as default
          setTranslationValue(data[0].id) // Set the first translation as default value
        }
      } catch (error) {
        console.error("Failed to load translations:", error)
      }
    }
    loadTranslations()
  }, [])

  const parseVerseReference = (input: string) => {
    // Match patterns like "Genesis 1:1" or "Genesis 1" or just "Genesis"
    const match = input.match(/^(\w+(?:\s+\w+)?)\s*(\d+)?(?::(\d+))?$/)
    if (match) {
      const [_, book, chapter, verse] = match
      return {
        book,
        chapter: chapter ? Number.parseInt(chapter) : undefined,
        verse: verse ? Number.parseInt(verse) : undefined,
      }
    }
    return null
  }

  const loadBookDetails = async (bookName: string) => {
    // Only try to load book details if we have at least 3 characters and no numbers
    if (bookName.length < 3 || /\d/.test(bookName)) return;

    try {
      const lastVerse = await invoke<BibleVerse>("get_last_verse_of_book", {
        book: bookName,
      });

      if (lastVerse) {
        const chapterCount = lastVerse.chapter
        setAvailableChapters(Array.from({ length: chapterCount }, (_, i) => i + 1))
        setSelectedBook(bookName)

        // Load first chapter's verses
        await loadChapterVerses(bookName, 1)

        // Add preview verses to search results
        const previewVerses = await invoke<BibleVerse[]>("search_bible_verses", {
          query: `${bookName} 1`,
        })
        setSearchResults(previewVerses)
      }
    } catch {
      // Silently ignore errors for partial or invalid book names
    }
  }

  const loadChapterVerses = async (book: string, chapter: number) => {
    try {
      const verseCount = await invoke<number>("get_verse_count", {
        book,
        chapter,
      })
      setAvailableVerses(Array.from({ length: verseCount }, (_, i) => i + 1))

      // Load first verse as preview if no specific verse is selected
      if (!verseValue) {
        const verseData = await invoke<BibleVerse>("get_bible_verse", {
          book,
          chapter,
          verse: 1,
        })
        if (verseData) {
          setSelectedVerse(verseData)
          setVerseValue("1")
        }
      }
    } catch (error) {
      console.error("Failed to load verse count:", error)
    }
  }

  const handleSearchChange = async (value: string) => {
    setSearchTerm(value)

    if (!value || value.length < 2) {
      setSelectedVerse(null)
      setShowDropdown(false)
      setChapterValue("")
      setVerseValue("")
      return
    }

    try {
      // First check if it's a potential verse reference
      const reference = parseVerseReference(value)

      // Check if the input ends with a space, in which case we want to preserve it
      const endsWithSpace = value.endsWith(" ")

      // Always perform search first to get available matches
      const verses = await invoke<BibleVerse[]>("search_bible_verses", { query: value.trim() })

      // Filter and sort results
      const bookMatches = verses.filter((v) => v.chapter === 0)
      const verseMatches = verses.filter((v) => v.chapter !== 0)

      // Auto-complete logic: If we have exactly one book match and no specific verse reference
      if (bookMatches.length === 1 && !reference?.chapter && !reference?.verse) {
        const matchedBook = bookMatches[0]
        const newSearchTerm = matchedBook.book + (endsWithSpace ? " " : "")
        setSearchTerm(newSearchTerm)
        setSelectedBook(matchedBook.book)
        await loadBookDetails(matchedBook.book)
        // Don't hide dropdown but update results
        setSearchResults([matchedBook, ...verseMatches])
        setShowDropdown(true)
        return
      }

      // Check for exact matches or single results
      const exactMatch = verseMatches.find(
        (v) =>
          v.book.toLowerCase() === (reference?.book || "").toLowerCase() &&
          v.chapter === reference?.chapter &&
          v.verse === reference?.verse,
      )

      const singleVerseMatch = verseMatches.length === 1 && bookMatches.length === 0

      // Auto-select if we have an exact match or single verse result
      if (exactMatch || (singleVerseMatch && verseMatches[0])) {
        const matchedVerse = exactMatch || verseMatches[0]
        await handleVerseSelect(matchedVerse)
        setShowDropdown(false)
        return
      }

      // Update search results and show dropdown
      setSearchResults([...bookMatches, ...verseMatches])
      setShowDropdown(verses.length > 0)

      // If we have a book reference, try to load its details
      if (reference?.book) {
        try {
          const lastVerse = await invoke<BibleVerse>("get_last_verse_of_book", {
            book: reference.book,
          })

          if (lastVerse) {
            await handleBookReference(reference, lastVerse)
          }
        } catch (error) {
          console.error("Failed to load book details:", error)
        }
      }
    } catch {
      // Silently ignore search errors
      setShowDropdown(false);
    }
  }

  const handleVerseReference = async (verse: BibleVerse) => {
    try {
      setSelectedBook(verse.book)
      setChapterValue(verse.chapter.toString())
      setVerseValue(verse.verse.toString())

      // Load chapter details
      const lastVerse = await invoke<BibleVerse>("get_last_verse_of_book", {
        book: verse.book,
      })

      if (lastVerse) {
        const chapters = Array.from({ length: lastVerse.chapter }, (_, i) => i + 1);
        setAvailableChapters(chapters)

        const verseCount = await invoke<number>("get_verse_count", {
          book: verse.book,
          chapter: verse.chapter,
        })
        setAvailableVerses(Array.from({ length: verseCount }, (_, i) => i + 1))
      }
    } catch (error) {
      console.error("Failed to handle verse reference:", error)
    }
  }

  const handleBookReference = async (
    reference: { book: string; chapter?: number; verse?: number },
    lastVerse: BibleVerse,
  ) => {
    setSelectedBook(reference.book)
    setAvailableChapters(Array.from({ length: lastVerse.chapter }, (_, i) => i + 1))

    if (reference.chapter) {
      setChapterValue(reference.chapter.toString())
      const verseCount = await invoke<number>("get_verse_count", {
        book: reference.book,
        chapter: reference.chapter,
      })
      setAvailableVerses(Array.from({ length: verseCount }, (_, i) => i + 1))

      if (reference.verse) {
        setVerseValue(reference.verse.toString())
        const verse = await invoke<BibleVerse>("get_bible_verse", {
          book: reference.book,
          chapter: reference.chapter,
          verse: reference.verse,
        })
        if (verse) {
          setSelectedVerse(verse)
        }
      }
    }
  }

  const handleVerseSelect = async (verse: BibleVerse) => {
    if (verse.chapter === 0) {
      // Book selection
      setSearchTerm(verse.book + " ")
      setSelectedBook(verse.book)
      await loadBookDetails(verse.book)
      setChapterValue("")
      setVerseValue("")
      setSelectedVerse(null) // Reset selected verse for book-only selection
    } else {
      // Full verse selection - Important: Set selectedVerse first!
      setSelectedVerse(verse)
      setSearchTerm(`${verse.book} ${verse.chapter}:${verse.verse}`)
      await handleVerseReference(verse) // This loads chapters and verses
    }
    setShowDropdown(false)
  }

  const handleVerseNumberSelect = async (verse: string) => {
    const verseNum = Number.parseInt(verse)
    if (!selectedBook || !chapterValue || isNaN(verseNum)) return

    try {
      const chapterNum = Number.parseInt(chapterValue)
      const verseData = await invoke<BibleVerse>("get_bible_verse", {
        book: selectedBook,
        chapter: chapterNum,
        verse: verseNum,
      })

      if (verseData) {
        setVerseValue(verse)
        setSelectedVerse(verseData)
        setSearchTerm(`${selectedBook} ${chapterValue}:${verse}`)

        // Update the display if playing
        if (isPlaying) {
          setCurrentVerse(verseData);
          const window = await WebviewWindow.getByLabel('bible-window-0');
          if (window) {
            window.emit('update-verse', verseData);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load verse:", error)
    }
  }

  const handleChapterSelect = async (chapter: string) => {
    const chapterNum = Number.parseInt(chapter)
    if (!selectedBook || isNaN(chapterNum)) return

    try {
      setChapterValue(chapter)
      await loadChapterVerses(selectedBook, chapterNum)

      // Load the first verse of the chapter
      const verseData = await invoke<BibleVerse>("get_bible_verse", {
        book: selectedBook,
        chapter: chapterNum,
        verse: 1,
      })

      if (verseData) {
        setVerseValue("1")
        setSelectedVerse(verseData)
        setSearchTerm(`${selectedBook} ${chapter}:1`)

        // Update the display if playing
        if (isPlaying) {
          setCurrentVerse(verseData);
          const window = await WebviewWindow.getByLabel('bible-window-0');
          if (window) {
            window.emit('update-verse', verseData);
          }
        }
      }
    } catch (error) {
      console.error("Failed to update chapter:", error)
    }
  }

  const loadSpecificVerse = async (book: string, chapter: number, verse: number) => {
    try {
      const verseData = await invoke<BibleVerse>("get_bible_verse", {
        book,
        chapter,
        verse,
      })
      if (verseData) {
        setSelectedVerse(verseData)
      }
    } catch (error) {
      console.error("Failed to load specific verse:", error)
    }
  }

  const handleVerseSelection = () => {
    // Fetch the selected verse based on the selected book, chapter, and verse
    // This is a placeholder implementation
    setComparisonVerse(`Comparison verse: ${chapterValue}:${verseValue}`)
  }

  const renderVerseDetails = (verse: BibleVerse) => (
    <div className="flex items-center justify-between">
      <span className="text-lg font-medium">
        {verse.chapter === 0 ? verse.book : `${verse.book} ${verse.chapter}:${verse.verse}`}
      </span>
      {verse.translation && <span className="text-sm text-muted-foreground">{verse.translation}</span>}
    </div>
  )

  const renderSearchResults = () => {
    // Deduplicate verses with the same reference
    const uniqueVerses = searchResults.reduce((acc, verse) => {
      const key = `${verse.book}-${verse.chapter}-${verse.verse}`
      if (!acc.has(key)) {
        acc.set(key, verse)
      }
      return acc
    }, new Map<string, BibleVerse>())

    return Array.from(uniqueVerses.values()).map((verse, index) => (
      <div
        key={`${verse.book}-${verse.chapter}-${verse.verse}-${index}`}
        onClick={() => handleVerseSelect(verse)}
        className="px-4 py-3 hover:bg-accent hover:text-accent-foreground cursor-pointer"
      >
        {renderVerseDetails(verse)}
        <p className="text-sm text-muted-foreground truncate">{verse.text}</p>
      </div>
    ))
  }

  const handleKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedVerse && !isPlaying) {
      e.preventDefault();
      startVerseDisplay();
    }
  };

  const startVerseDisplay = async () => {
    if (!selectedVerse) return;

    try {
      const selectedDisplays = await invoke<number[]>('get_selected_displays');
      const monitors = await availableMonitors();

      if (!selectedDisplays.length || !monitors.length) {
        console.error('No displays selected or available');
        return;
      }

      const verseData = JSON.stringify(selectedVerse);
      const encodedVerse = encodeURIComponent(verseData);

      // Create display window
      const displayIndex = selectedDisplays[0];
      const validIndex = Math.min(displayIndex, monitors.length - 1);
      const targetMonitor = monitors[validIndex];

      const webview = new WebviewWindow('bible-window-0', {
        url: `/bible-display?verse=${encodedVerse}`,
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

      // Start the stream after the window is created
      await displayStream.startStream({
        type: 'bible',
        sourceId: selectedVerse.id ? selectedVerse.id.toString() : selectedVerse.reference,
        source: 'bible-verse-selection'
      });

      // Send info about the stream to the projection
      await invoke('emit_main', {
        event: 'window-preview-update',
        payload: { 
          source: 'bible-verse-selection', 
          displayId: 'bible', 
          content: selectedVerse.reference,
          isStream: true
        }
      });

      setCurrentVerse(selectedVerse);
      setIsPlaying(true);
      window.dispatchEvent(new Event('startTimer'));
    } catch (error) {
      console.error('Failed to start verse display:', error);
    }
  };

  const clearProjectionContent = async () => {
    try {
      const projectionWindow = await WebviewWindow.getByLabel('projection');
      if (projectionWindow) {
        // Only clear bible-specific content, not all content
        await projectionWindow.emit('clear-content', { 
          source: 'bible-verse-selection' 
        });
        console.log('Sent clear-content event for bible-verse-selection to projection window');
      }
    } catch (error) {
      console.error('Error clearing projection content:', error);
    }
  };

  const stopVerseDisplay = async () => {
    try {
      // Stop the stream
      await displayStream.stopStream('bible', 'bible-verse-selection');

      // Then close all windows
      const windows = await invoke<string[]>('get_bible_windows');
      await Promise.all(windows.map(async (label) => {
        const window = await WebviewWindow.getByLabel(label);
        if (window) {
          await window.close();
        }
      }));

      // Clear the preview in main window
      await invoke('emit_main', {
        event: 'clear-preview',
        payload: { source: 'bible-verse-selection' }
      });
      
      // Clear projection content
      await clearProjectionContent();

      // Trigger a check for active windows to see if we need to clear everything
      const projectionWindow = await WebviewWindow.getByLabel('projection');
      if (projectionWindow) {
        await projectionWindow.emit('check-active-windows', {});
      }

      // Reset all states
      setIsPlaying(false);
      setSearchTerm('');
      setSelectedVerse(null);
      window.dispatchEvent(new CustomEvent('stopTimer', {
        detail: { source: 'bible-verse-selection' }
      }));
      resetAll();
    } catch (error) {
      console.error('Failed to stop verse display:', error);
    }
  };

  const handlePlayClick = async () => {
    if (isPlaying) {
      await stopVerseDisplay();
    } else {
      await startVerseDisplay();
    }
  };

  // Add keydown event listener for navigation
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!isPlaying) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        await invoke('emit_verse_navigation', { key: e.key });
      }
    };

    if (isPlaying) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying]);

  // Add a useEffect to listen for verse navigation events
  useEffect(() => {
    const handleVerseNavigation = async (e: { payload: { key: string } }) => {
      if (!selectedVerse || !isPlaying) return;

      try {
        let nextVerse: BibleVerse | null = null;

        if (e.payload.key === 'ArrowRight' || e.payload.key === 'ArrowDown') {
          try {
            nextVerse = await invoke<BibleVerse>('get_bible_verse', {
              book: selectedVerse.book,
              chapter: selectedVerse.chapter,
              verse: selectedVerse.verse + 1,
            });
          } catch {
            // If next verse doesn't exist, try next chapter
            const lastVerse = await invoke<BibleVerse>('get_last_verse_of_book', {
              book: selectedVerse.book,
            });
            if (selectedVerse.chapter < lastVerse.chapter) {
              nextVerse = await invoke<BibleVerse>('get_bible_verse', {
                book: selectedVerse.book,
                chapter: selectedVerse.chapter + 1,
                verse: 1,
              });
            }
          }
        } else if (e.payload.key === 'ArrowLeft' || e.payload.key === 'ArrowUp') {
          if (selectedVerse.verse > 1) {
            nextVerse = await invoke<BibleVerse>('get_bible_verse', {
              book: selectedVerse.book,
              chapter: selectedVerse.chapter,
              verse: selectedVerse.verse - 1,
            });
          } else if (selectedVerse.chapter > 1) {
            // Get last verse of previous chapter
            const verseCount = await invoke<number>('get_verse_count', {
              book: selectedVerse.book,
              chapter: selectedVerse.chapter - 1,
            });
            nextVerse = await invoke<BibleVerse>('get_bible_verse', {
              book: selectedVerse.book,
              chapter: selectedVerse.chapter - 1,
              verse: verseCount,
            });
          }
        }

        if (nextVerse) {
          // First update the UI
          setSelectedVerse(nextVerse);
          setCurrentVerse(nextVerse);
          setVerseValue(nextVerse.verse.toString());
          setChapterValue(nextVerse.chapter.toString());
          setSearchTerm(`${nextVerse.book} ${nextVerse.chapter}:${nextVerse.verse}`);

          // Then update the display window
          const window = await WebviewWindow.getByLabel('bible-window-0');
          if (window) {
            window.emit('update-verse', nextVerse);
          }
        }
      } catch (error) {
        console.error('Navigation error:', error);
      }
    };

    // Listen for verse navigation events
    const unsubscribe = listen('verse-navigation', handleVerseNavigation);
    return () => {
      unsubscribe.then(f => f());
    };
  }, [selectedVerse, isPlaying, setCurrentVerse]);

  // Add listener for main stop action
  useEffect(() => {
    const handleMainStop = (event: CustomEvent<{ source: string }>) => {
      if (event.detail?.source === 'bible-verse-selection') {
        setIsPlaying(false);
        setSearchTerm('');
        setSelectedVerse(null);
        resetAll();
      }
    };

    window.addEventListener('stopTimer', handleMainStop as EventListener);
    return () => {
      window.removeEventListener('stopTimer', handleMainStop as EventListener);
    };
  }, [resetAll]);

  return (
    <div>
      <div className="flex w-full items-center gap-4">
        <Book className="text-muted-foreground h-9 w-9" />
        <span className="text-foreground text-xl font-medium">Bible Verse Selection</span>
      </div>
      <div className="flex w-full items-center gap-5 mt-5">
        <div className="relative flex-1">
          <Input
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleKeyPress} // Add this line
            placeholder="Enter a book name or search text..."
            className="flex-1 text-xl h-16 placeholder:text-muted-foreground"
          />
          {showDropdown && (
            <div className="absolute w-full mt-1 py-1 rounded-md bg-card border border-border shadow-md z-50">
              <div className="max-h-[300px] overflow-y-auto">{renderSearchResults()}</div>
            </div>
          )}
        </div>
        <NumberComboBox
          numbers={availableChapters}
          selectedValue={chapterValue}
          onOpenChange={setOpenChapter}
          onSelect={handleChapterSelect}
          placeholder="Ch"
          open={openChapter}
          className="w-[125px]"
        />
        <NumberComboBox
          numbers={availableVerses}
          selectedValue={verseValue}
          onOpenChange={setOpenVerse}
          onSelect={handleVerseNumberSelect}
          placeholder="Vs"
          open={openVerse}
          className="w-[125px]"
        />
        <ComboBox
          items={translations.map((t) => ({ value: t.id, label: t.name }))}
          selectedValue={translationValue}
          onOpenChange={setOpenTranslation}
          onSelect={setTranslationValue}
          placeholder="Vertaling"
          icon={<Translate className="h-9 w-9 shrink-0 opacity-80" />}
          open={openTranslation}
          className="w-[300px]"
        />
        <ComboBox
          items={languages}
          selectedValue={languageValue}
          onOpenChange={setOpenLanguage}
          onSelect={setLanguageValue}
          placeholder="Language"
          icon={<Language className="h-9 w-9 shrink-0 opacity-80" />}
          open={openLanguage}
          className="w-[200px]"
        />
        <Button
          className={cn(
            "text-xl w-16 h-16",
            isPlaying
              ? "bg-red-500/25 text-red-500 hover:text-red-600 hover:bg-red-500/30"
              : selectedVerse
                ? "bg-green-500/25 text-green-500 hover:text-green-600 hover:bg-green-500/30"
                : "text-muted-foreground bg-card-background"
          )}
          onClick={handlePlayClick}
          disabled={!selectedVerse}
        >
          {isPlaying ? (
            <Stop className="h-10 w-10" />
          ) : (
            <PlayArrow className="h-10 w-10" />
          )}
        </Button>
      </div>
      <div className="flex w-full gap-5 mt-5 mb-4"> {/* Added mb-4 */}
        <Card className="flex-1 min-h-[150px] bg-card-background text-foreground overflow-hidden"> {/* Changed min-h-[200px] to min-h-[150px] */}
          <CardContent className="p-0 relative h-[150px]"> {/* Changed h-[200px] to h-[150px] */}
            {selectedVerse ? (
              <div className="h-full relative">
                <div className="absolute inset-0 p-6">
                  <div className="h-full overflow-y-auto scrollbar-custom pr-2">
                    <div className="space-y-4">
                      {renderVerseDetails(selectedVerse)}
                      <p className="text-lg leading-relaxed pb-8">{selectedVerse.text}</p>
                    </div>
                  </div>
                </div>
                {/* Fixed fade-out overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card-background via-card-background/90 to-transparent pointer-events-none" />
              </div>
            ) : (
              <div className="flex flex-col justify-center items-center h-40 p-6">
                <Notes className="text-muted-foreground h-12 w-12" />
                <span className="text-lg font-medium mt-2">No verses are selected</span>
                <span className="text-muted-foreground text-base font-normal">Select a verse to display</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="flex-1 min-h-[150px] bg-card-background text-foreground"> {/* Changed min-h-44 to min-h-[150px] */}
          <CardContent className="mt-3 flex flex-col justify-center items-center h-full">
            <Timeline className="text-muted-foreground h-12 w-12" />
            <span className="text-lg font-medium mt-2">Select a translation to compare</span>
            <Button variant="outline" className="mt-4 border-2" size="sm">
              Select translation
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default BibleVerseSelection
