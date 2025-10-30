import { create } from 'zustand';
import { LanguageType, HymnType } from '@/app/types/hymn';

export interface DisplayContent {
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

interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

interface VerseState {
  // Basic verse information
  totalVerses: number;
  activeVerse: number;
  hasRefrain: boolean;
  
  // Display sequence information
  sequence: string[];
  currentSequenceIndex: number;
  
  // Display content information
  displayContents: DisplayContent[];
  
  // Actions
  setActiveVerse: (activeVerse: number) => void;
  setTotalVerses: (totalVerses: number) => void;
  setHasRefrain: (hasRefrain: boolean) => void;
  setSequence: (sequence: string[]) => void;
  setCurrentSequenceIndex: (currentSequenceIndex: number) => void;
  setDisplayContents: (displayContents: DisplayContent[]) => void;
  resetAll: () => void;
  nextInSequence: () => void;
  previousInSequence: () => void;
}

const useVerseStore = create<VerseState>((set, get) => ({
  totalVerses: 0,
  activeVerse: 0,
  hasRefrain: false,
  sequence: [],
  currentSequenceIndex: 0,
  displayContents: [],
  setActiveVerse: (activeVerse: number) => {
    console.log('Store: Setting active verse to', activeVerse);
    set({ activeVerse });
  },
  setTotalVerses: (totalVerses: number) => {
    console.log('Store: Setting total verses to', totalVerses);
    set({ totalVerses });
  },
  setHasRefrain: (hasRefrain: boolean) => {
    console.log('Store: Setting hasRefrain to', hasRefrain);
    set({ hasRefrain });
  },
  setSequence: (sequence: string[]) => {
    console.log('Store: Setting sequence with length', sequence.length);
    set({ sequence });
  },
  setCurrentSequenceIndex: (currentSequenceIndex: number) => {
    console.log('Store: Setting current sequence index to', currentSequenceIndex);
    set({ currentSequenceIndex });
  },
  nextInSequence: () => {
    const { sequence, currentSequenceIndex } = get();
    console.log('Store: Moving to next in sequence', { 
      current: currentSequenceIndex, 
      max: sequence.length - 1 
    });
    
    if (sequence.length === 0) {
      console.warn('Store: Cannot move to next in sequence because sequence is empty');
      return;
    }
    
    const nextIndex = currentSequenceIndex + 1;
    if (nextIndex >= sequence.length) {
      set({ currentSequenceIndex: 0 });
    } else {
      set({ currentSequenceIndex: nextIndex });
    }
  },
  previousInSequence: () => {
    const { sequence, currentSequenceIndex } = get();
    console.log('Store: Moving to previous in sequence', { 
      current: currentSequenceIndex, 
      max: sequence.length - 1 
    });
    
    if (sequence.length === 0) {
      console.warn('Store: Cannot move to previous in sequence because sequence is empty');
      return;
    }
    
    const prevIndex = currentSequenceIndex - 1;
    if (prevIndex < 0) {
      set({ currentSequenceIndex: sequence.length - 1 });
    } else {
      set({ currentSequenceIndex: prevIndex });
    }
  },
  setDisplayContents: (displayContents: DisplayContent[]) => {
    console.log('Store: Setting display contents with length', displayContents.length);
    
    // Debug if any content has multiple parts
    const multiPartContents = displayContents.filter(c => 
      (c.type === 'verse' || c.type === 'refrain') && 
      c.totalParts && c.totalParts > 1
    );
    
    if (multiPartContents.length > 0) {
      console.log('Store: Found multi-part contents:', 
        multiPartContents.map(c => `${c.type}${c.number ? ` ${c.number}` : ''} part ${c.part}/${c.totalParts}`).join(', ')
      );
    }
    
    set({ displayContents });
  },
  resetAll: () => {
    console.log('Store: Resetting all state');
    set({
      totalVerses: 0,
      activeVerse: 0,
      hasRefrain: false,
      sequence: [],
      currentSequenceIndex: 0,
      displayContents: []
    });
  }
}));

interface BibleVerseState {
  currentVerse: BibleVerse | null;
  book: string;
  chapter: number;
  verse: number;
  setCurrentVerse: (verse: BibleVerse | null) => void;
  setBook: (book: string) => void;
  setChapter: (chapter: number) => void;
  setVerse: (verse: number) => void;
  resetAll: () => void;
}

export const useBibleVerseStore = create<BibleVerseState>((set) => ({
  currentVerse: null,
  book: '',
  chapter: 1,
  verse: 1,
  setCurrentVerse: (verse) => set({ currentVerse: verse }),
  setBook: (book) => set({ book }),
  setChapter: (chapter) => set({ chapter }),
  setVerse: (verse) => set({ verse }),
  resetAll: () => set({
    currentVerse: null,
    book: '',
    chapter: 1,
    verse: 1,
  }),
}));

interface ScrapedHymn {
  number: number;
  title: string;
  verses: string[];
  hasRefrain: boolean;
  refrainText?: string;
}

interface ScraperState {
  isLoading: boolean;
  isScraping: boolean;
  progress: number;
  statusMessage: string;
  scrapedHymns: ScrapedHymn[];
  error: string | null;
  importComplete: boolean;
  language: LanguageType;
  
  setIsLoading: (isLoading: boolean) => void;
  setIsScraping: (isScraping: boolean) => void;
  setProgress: (progress: number) => void;
  setStatusMessage: (message: string) => void;
  setScrapedHymns: (hymns: ScrapedHymn[]) => void;
  setError: (error: string | null) => void;
  setImportComplete: (complete: boolean) => void;
  setLanguage: (language: LanguageType) => void;
  resetScraperState: () => void;
}

export const useScraperStore = create<ScraperState>((set) => ({
  isLoading: false,
  isScraping: false,
  progress: 0,
  statusMessage: "",
  scrapedHymns: [],
  error: null,
  importComplete: false,
  language: "AFR" as LanguageType,
  
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsScraping: (isScraping) => set({ isScraping }),
  setProgress: (progress) => set({ progress }),
  setStatusMessage: (message) => set({ statusMessage: message }),
  setScrapedHymns: (hymns) => set({ scrapedHymns: hymns }),
  setError: (error) => set({ error }),
  setImportComplete: (complete) => set({ importComplete: complete }),
  setLanguage: (language) => set({ language }),
  resetScraperState: () => set({
    isLoading: false,
    isScraping: false,
    progress: 0,
    statusMessage: "",
    scrapedHymns: [],
    error: null,
    importComplete: false
  })
}));

export default useVerseStore;
