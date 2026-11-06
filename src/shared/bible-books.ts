import { AFRIKAANS_BOOK_NAMES } from './bible-book-names-af'

export type BibleBook = {
  id: string
  name: string
  chapters: number
  testament: 'ot' | 'nt'
}

/** Protestant canon — chapter counts for navigation. */
export const bibleBooks: BibleBook[] = [
  { id: 'gen', name: 'Genesis', chapters: 50, testament: 'ot' },
  { id: 'exo', name: 'Exodus', chapters: 40, testament: 'ot' },
  { id: 'lev', name: 'Leviticus', chapters: 27, testament: 'ot' },
  { id: 'num', name: 'Numbers', chapters: 36, testament: 'ot' },
  { id: 'deu', name: 'Deuteronomy', chapters: 34, testament: 'ot' },
  { id: 'jos', name: 'Joshua', chapters: 24, testament: 'ot' },
  { id: 'jdg', name: 'Judges', chapters: 21, testament: 'ot' },
  { id: 'rut', name: 'Ruth', chapters: 4, testament: 'ot' },
  { id: '1sa', name: '1 Samuel', chapters: 31, testament: 'ot' },
  { id: '2sa', name: '2 Samuel', chapters: 24, testament: 'ot' },
  { id: '1ki', name: '1 Kings', chapters: 22, testament: 'ot' },
  { id: '2ki', name: '2 Kings', chapters: 25, testament: 'ot' },
  { id: '1ch', name: '1 Chronicles', chapters: 29, testament: 'ot' },
  { id: '2ch', name: '2 Chronicles', chapters: 36, testament: 'ot' },
  { id: 'ezr', name: 'Ezra', chapters: 10, testament: 'ot' },
  { id: 'neh', name: 'Nehemiah', chapters: 13, testament: 'ot' },
  { id: 'est', name: 'Esther', chapters: 10, testament: 'ot' },
  { id: 'job', name: 'Job', chapters: 42, testament: 'ot' },
  { id: 'psa', name: 'Psalms', chapters: 150, testament: 'ot' },
  { id: 'pro', name: 'Proverbs', chapters: 31, testament: 'ot' },
  { id: 'ecc', name: 'Ecclesiastes', chapters: 12, testament: 'ot' },
  { id: 'sng', name: 'Song of Solomon', chapters: 8, testament: 'ot' },
  { id: 'isa', name: 'Isaiah', chapters: 66, testament: 'ot' },
  { id: 'jer', name: 'Jeremiah', chapters: 52, testament: 'ot' },
  { id: 'lam', name: 'Lamentations', chapters: 5, testament: 'ot' },
  { id: 'ezk', name: 'Ezekiel', chapters: 48, testament: 'ot' },
  { id: 'dan', name: 'Daniel', chapters: 12, testament: 'ot' },
  { id: 'hos', name: 'Hosea', chapters: 14, testament: 'ot' },
  { id: 'jol', name: 'Joel', chapters: 3, testament: 'ot' },
  { id: 'amo', name: 'Amos', chapters: 9, testament: 'ot' },
  { id: 'oba', name: 'Obadiah', chapters: 1, testament: 'ot' },
  { id: 'jon', name: 'Jonah', chapters: 4, testament: 'ot' },
  { id: 'mic', name: 'Micah', chapters: 7, testament: 'ot' },
  { id: 'nam', name: 'Nahum', chapters: 3, testament: 'ot' },
  { id: 'hab', name: 'Habakkuk', chapters: 3, testament: 'ot' },
  { id: 'zep', name: 'Zephaniah', chapters: 3, testament: 'ot' },
  { id: 'hag', name: 'Haggai', chapters: 2, testament: 'ot' },
  { id: 'zec', name: 'Zechariah', chapters: 14, testament: 'ot' },
  { id: 'mal', name: 'Malachi', chapters: 4, testament: 'ot' },
  { id: 'mat', name: 'Matthew', chapters: 28, testament: 'nt' },
  { id: 'mrk', name: 'Mark', chapters: 16, testament: 'nt' },
  { id: 'luk', name: 'Luke', chapters: 24, testament: 'nt' },
  { id: 'jhn', name: 'John', chapters: 21, testament: 'nt' },
  { id: 'act', name: 'Acts', chapters: 28, testament: 'nt' },
  { id: 'rom', name: 'Romans', chapters: 16, testament: 'nt' },
  { id: '1co', name: '1 Corinthians', chapters: 16, testament: 'nt' },
  { id: '2co', name: '2 Corinthians', chapters: 13, testament: 'nt' },
  { id: 'gal', name: 'Galatians', chapters: 6, testament: 'nt' },
  { id: 'eph', name: 'Ephesians', chapters: 6, testament: 'nt' },
  { id: 'php', name: 'Philippians', chapters: 4, testament: 'nt' },
  { id: 'col', name: 'Colossians', chapters: 4, testament: 'nt' },
  { id: '1th', name: '1 Thessalonians', chapters: 5, testament: 'nt' },
  { id: '2th', name: '2 Thessalonians', chapters: 3, testament: 'nt' },
  { id: '1ti', name: '1 Timothy', chapters: 6, testament: 'nt' },
  { id: '2ti', name: '2 Timothy', chapters: 4, testament: 'nt' },
  { id: 'tit', name: 'Titus', chapters: 3, testament: 'nt' },
  { id: 'phm', name: 'Philemon', chapters: 1, testament: 'nt' },
  { id: 'heb', name: 'Hebrews', chapters: 13, testament: 'nt' },
  { id: 'jas', name: 'James', chapters: 5, testament: 'nt' },
  { id: '1pe', name: '1 Peter', chapters: 5, testament: 'nt' },
  { id: '2pe', name: '2 Peter', chapters: 3, testament: 'nt' },
  { id: '1jn', name: '1 John', chapters: 5, testament: 'nt' },
  { id: '2jn', name: '2 John', chapters: 1, testament: 'nt' },
  { id: '3jn', name: '3 John', chapters: 1, testament: 'nt' },
  { id: 'jud', name: 'Jude', chapters: 1, testament: 'nt' },
  { id: 'rev', name: 'Revelation', chapters: 22, testament: 'nt' }
]

export function getBookById(id: string): BibleBook | undefined {
  return bibleBooks.find((b) => b.id === id)
}

export function formatPassageRef(bookName: string, chapter: number, verse: number): string {
  return `${bookName} ${chapter}:${verse}`
}

export function getBookDisplayName(bookId: string, afrikaans: boolean): string {
  const book = getBookById(bookId)
  if (!book) return bookId
  if (afrikaans) return AFRIKAANS_BOOK_NAMES[bookId] ?? book.name
  return book.name
}

export function formatPassageRefForBook(
  bookId: string,
  chapter: number,
  verse: number,
  afrikaans: boolean
): string {
  return formatPassageRef(getBookDisplayName(bookId, afrikaans), chapter, verse)
}

export const bibleBookIdsInOrder: string[] = bibleBooks.map((b) => b.id)
