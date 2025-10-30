export interface Hymn {
  id?: number;  // Make sure this matches i64 in Rust
  number: number;
  title: string;
  verses_count: number;
  has_refrain: boolean;
  refrain_text?: string;
  key_signature?: KeySignature | null;
  author?: string;
  language: LanguageType;
  is_youth_song: boolean;
  hymn_type: HymnType;  // Make sure this matches the Rust struct field name
}

export type KeySignature = typeof keySignatures[number] | "";

export const keySignatures = [
  "C Major", "G Major", "D Major", "A Major", "E Major", "B Major",
  "F# Major", "Gb Major", "Db Major", "Ab Major", "Eb Major", "Bb Major", "F Major",
  "A Minor", "E Minor", "B Minor", "F# Minor", "C# Minor", "G# Minor",
  "D# Minor", "Bb Minor", "F Minor", "C Minor", "G Minor", "D Minor"
] as const;

export type LanguageType = 'AFR' | 'ENG' | 'SPA';
export type HymnType = 'adventlofliedere' | 'adventjeugliede' | 'adventhymnal' | 'adventyouthsongs';

export interface Verse {
  id?: number;
  hymn_id: number;
  verse_number: number;
  verse_text: string;
}
