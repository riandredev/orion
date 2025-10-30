import { create } from 'zustand';
import { Hymn } from '@/app/types/hymn';

export interface HymnContent {
  type: 'title' | 'verse' | 'refrain' | 'blank';
  id: string;
  content?: string;
  number?: number;
  isEnabled: boolean;
  metadata?: {
    verses: string;
    hasRefrain: string;
    key: string;
    type: string;
  };
}

interface HymnContentState {
  currentHymn: Hymn | null;
  contentList: HymnContent[];
  activeContentId: string | null;
  setHymn: (hymn: Hymn, verses: { verse_number: number; verse_text: string; }[]) => void;
  toggleContent: (id: string, enabled: boolean) => void;
  setActiveContent: (id: string | null) => void;
  getNextValidContent: (currentId: string, direction: 1 | -1) => string | null;
  clearHymn: () => void;
}

export const useHymnContentStore = create<HymnContentState>((set, get) => ({
  currentHymn: null,
  contentList: [],
  activeContentId: null,

  setHymn: (hymn, verses) => {
    const contentList: HymnContent[] = [
      {
        type: 'title',
        id: 'title',
        content: `${hymn.number} - ${hymn.title}`,
        isEnabled: true,
        metadata: {
          verses: `${hymn.verses_count} Verses${hymn.has_refrain ? ' and Refrain' : ''}`,
          hasRefrain: hymn.has_refrain ? 'Refrain' : '',
          key: hymn.key_signature || '',
          type: hymn.hymn_type
        }
      }
    ];

    verses.forEach(verse => {
      contentList.push({
        type: 'verse',
        id: `v${verse.verse_number}`,
        content: verse.verse_text,
        number: verse.verse_number,
        isEnabled: true
      });

      if (hymn.has_refrain && hymn.refrain_text) {
        contentList.push({
          type: 'refrain',
          id: `refrain-${verse.verse_number}`,
          content: hymn.refrain_text,
          isEnabled: true
        });
      }
    });

    contentList.push({ type: 'blank', id: 'blank', isEnabled: true });

    set({
      currentHymn: hymn,
      contentList,
      activeContentId: 'title'
    });
  },

  toggleContent: (id, enabled) => {
    set(state => {
      const newList = state.contentList.map(content =>
        content.id === id ? { ...content, isEnabled: enabled } : content
      );

      // If disabling current content, move to next valid content
      if (!enabled && id === state.activeContentId) {
        const nextId = get().getNextValidContent(id, 1);
        return {
          contentList: newList,
          activeContentId: nextId
        };
      }

      return { contentList: newList };
    });
  },

  setActiveContent: (id) => set({ activeContentId: id }),

  getNextValidContent: (currentId, direction) => {
    const { contentList } = get();
    const currentIndex = contentList.findIndex(c => c.id === currentId);
    if (currentIndex === -1) return null;

    let nextIndex = currentIndex;
    do {
      nextIndex += direction;
      if (nextIndex < 0 || nextIndex >= contentList.length) return null;
      if (contentList[nextIndex].isEnabled) return contentList[nextIndex].id;
    } while (nextIndex > 0 && nextIndex < contentList.length - 1);

    return null;
  },

  clearHymn: () => set({
    currentHymn: null,
    contentList: [],
    activeContentId: null
  })
}));
