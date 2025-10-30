import { create } from 'zustand';
import { Hymn } from '@/app/types/hymn';

interface HymnState {
  currentHymn: Hymn | null;
  isPlaying: boolean;
  currentVerse: number;
  setCurrentHymn: (hymn: Hymn | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentVerse: (verse: number) => void;
  reset: () => void;
}

export const useHymnStore = create<HymnState>((set) => ({
  currentHymn: null,
  isPlaying: false,
  currentVerse: 0,
  setCurrentHymn: (hymn) => set({ currentHymn: hymn }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentVerse: (verse) => set({ currentVerse: verse }),
  reset: () => set({ currentHymn: null, isPlaying: false, currentVerse: 0 }),
}));
