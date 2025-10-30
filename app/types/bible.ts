export interface BibleVerse {
  id: number;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  translation?: string; // Make it optional since it might not always be present
}

export interface BibleTranslation {
  id: string;
  name: string;
  shortname: string;
  module: string;
  year: number;
}

export interface BibleBook {
  name: string;
  chapters: number;
  translation: string;
  language: string;
}
