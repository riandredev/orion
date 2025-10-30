-- Drop tables if they exist to avoid conflicts
DROP TABLE IF EXISTS verses;
DROP TABLE IF EXISTS hymns;

-- Create hymns table
CREATE TABLE hymns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    verses_count INTEGER NOT NULL,
    has_refrain BOOLEAN NOT NULL DEFAULT 0,
    refrain_text TEXT,
    key_signature TEXT DEFAULT NULL,
    author TEXT,
    language TEXT NOT NULL,
    is_youth_song BOOLEAN NOT NULL DEFAULT 0,
    hymn_type TEXT NOT NULL,  -- Changed to required field without default
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(number, language)
);

-- Create verses table
CREATE TABLE verses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hymn_id INTEGER NOT NULL,
    verse_number INTEGER NOT NULL,
    verse_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(hymn_id) REFERENCES hymns(id) ON DELETE CASCADE,
    UNIQUE(hymn_id, verse_number)
);
