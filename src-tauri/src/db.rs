use serde::{Serialize, Deserialize};
use rusqlite::{Connection, Result as SqlResult, params, OptionalExtension, Params}; // Add Params here
use std::sync::Mutex;
use std::path::PathBuf;
use std::collections::HashMap;
use tauri::AppHandle;
use tauri::Manager;
use serde_json::Value as JsonValue;
use tauri_plugin_sql::DbInstances;
use lazy_static::lazy_static;

// Add this constant at the top of the file after imports
const BIBLE_BOOKS: [&str; 66] = [
    "Genesis", "Eksodus", "Levitikus", "Numeri", "Deuteronomium",
    "Josua", "Rigters", "Rut", "1 Samuel", "2 Samuel",
    "1 Konings", "2 Konings", "1 Kronieke", "2 Kronieke", "Esra",
    "Nehemia", "Ester", "Job", "Psalms", "Spreuke",
    "Prediker", "Hooglied", "Jesaja", "Jeremia", "Klaagliedere",
    "Esegiël", "Daniël", "Hosea", "Joël", "Amos",
    "Obadja", "Jona", "Miga", "Nahum", "Habakuk",
    "Sefanja", "Haggai", "Sagaria", "Maleagi", "Matteus",
    "Markus", "Lukas", "Johannes", "Handelinge", "Romeine",
    "1 Korintiërs", "2 Korintiërs", "Galasiërs", "Efesiërs", "Filippense",
    "Kolossense", "1 Tessalonisense", "2 Tessalonisense", "1 Timoteus", "2 Timoteus",
    "Titus", "Filemon", "Hebreërs", "Jakobus", "1 Petrus",
    "2 Petrus", "1 Johannes", "2 Johannes", "3 Johannes", "Judas",
    "Openbaring"
];

// Update find_book_number function to handle numbered books better
fn find_book_number(query: &str) -> (Option<(i32, &'static str)>, bool) {
    let query = query.trim();

    // Handle numbered books first (e.g., "1" or "1 Jo")
    if let Some(first_char) = query.chars().next() {
        if (first_char.is_numeric()) {
            // Get all books that start with the numeric prefix
            let matching_books: Vec<_> = BIBLE_BOOKS.iter()
                .enumerate()
                .filter(|(_, &book)| book.starts_with(first_char))
                .collect();

            // Try exact prefix match first
            let exact_prefix = matching_books.iter()
                .find(|(_, &book)| book.to_lowercase().starts_with(&query.to_lowercase()));

            if let Some(&(index, book)) = exact_prefix {
                return (Some((index as i32 + 1, book)), true);
            }

            // If there's only one book with this number, return it
            if (matching_books.len() == 1) {
                let (index, book) = matching_books[0];
                return (Some((index as i32 + 1, book)), true);
            }
        }
    }

    // Then try exact match
    let exact_match = BIBLE_BOOKS.iter()
        .enumerate()
        .find(|(_, &book)| book.to_lowercase() == query.to_lowercase())
        .map(|(index, &book)| (index as i32 + 1, book));

    if (exact_match.is_some()) {
        return (exact_match, true);
    }

    // Then try prefix match
    let prefix_matches = BIBLE_BOOKS.iter()
        .enumerate()
        .filter(|(_, &book)| book.to_lowercase().starts_with(&query.to_lowercase()))
        .collect::<Vec<_>>();

    if (prefix_matches.len() == 1) {
        return (Some((prefix_matches[0].0 as i32 + 1, prefix_matches[0].1)), true);
    }

    // Finally, try partial match
    let partial_match = BIBLE_BOOKS.iter()
        .enumerate()
        .find(|(_, &book)| query.len() >= 2 && book.to_lowercase().contains(&query.to_lowercase()))
        .map(|(index, &book)| (index as i32 + 1, book));

    (partial_match, false)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Hymn {
    pub id: Option<i64>,
    pub number: i32,
    pub title: String,
    pub verses_count: i32,
    pub has_refrain: bool,
    pub refrain_text: Option<String>,
    pub key_signature: Option<String>,
    pub author: Option<String>,
    pub language: String,
    pub is_youth_song: bool,
    pub hymn_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Verse {
    pub id: Option<i64>,
    pub hymn_id: i64,
    pub verse_number: i32,
    pub verse_text: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct BibleVerse {
    pub id: i64,
    pub book: String,
    pub chapter: i32,
    pub verse: i32,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BibleTranslation {
    pub name: String,
    pub shortname: String,
    pub module: String,
    pub year: i32,
}

#[derive(Debug)]
struct DbVersion {
    version: i32,
}

lazy_static! {
    static ref DB_CONNECTION: Mutex<Option<Connection>> = Mutex::new(None);
    static ref BIBLE_DB_CONNECTION: Mutex<Option<Connection>> = Mutex::new(None);
}

pub fn init_db(app: &AppHandle) -> SqlResult<()> {
    // Initialize hymns database
    let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_dir).expect("Failed to create app data directory");
    let hymns_db_path = app_dir.join("hymnals.db");

    // Initialize Bible database (directly from resources)
    let bible_db_path = app.path()
        .resolve("resources/db/afrikaans53.sqlite", tauri::path::BaseDirectory::Resource)
        .expect("Failed to resolve Bible database path");

    // Copy hymns database if needed
    if (!hymns_db_path.exists()) {
        println!("First time setup: Copying initial hymns database...");
        let resource_path = app.path()
            .resolve("resources/db/hymnals.db", tauri::path::BaseDirectory::Resource)
            .expect("Failed to resolve hymns database path");

        std::fs::copy(&resource_path, &hymns_db_path)
            .expect("Failed to copy hymns database from resources");
    }

    // Connect to both databases
    let hymns_conn = Connection::open(&hymns_db_path)?;
    let bible_conn = Connection::open(&bible_db_path)?;

    // Store connections
    {
        let mut db = DB_CONNECTION.lock().unwrap();
        *db = Some(hymns_conn);
    }
    {
        let mut bible_db = BIBLE_DB_CONNECTION.lock().unwrap();
        *bible_db = Some(bible_conn);
    }

    Ok(())
}

fn get_db_version(conn: &Connection) -> SqlResult<i32> {
    // Create version table if it doesn't exist
    conn.execute("
        CREATE TABLE IF NOT EXISTS db_version (
            version INTEGER NOT NULL
        )", [])?;

    // Get current version
    let version: Option<i32> = conn.query_row(
        "SELECT version FROM db_version LIMIT 1",
        [],
        |row| row.get(0)
    ).optional()?;

    Ok(version.unwrap_or(0))
}

fn update_db_version(conn: &Connection, version: i32) -> SqlResult<()> {
    conn.execute("DELETE FROM db_version", [])?;
    conn.execute("INSERT INTO db_version (version) VALUES (?1)", [version])?;
    Ok(())
}

fn run_migrations(conn: &Connection) -> SqlResult<()> {
    let current_version = get_db_version(conn)?;
    let latest_version = 1; // Increment this when adding new migrations

    if (current_version < latest_version) {
        println!("Running database migrations from version {} to {}", current_version, latest_version);

        // Add your migrations here
        if (current_version < 1) {
            // First add column with no default
            conn.execute("
                ALTER TABLE hymns
                ADD COLUMN last_updated TEXT
            ", [])?;

            // Then update all existing rows with current timestamp
            conn.execute("
                UPDATE hymns
                SET last_updated = datetime('now')
                WHERE last_updated IS NULL
            ", [])?;
        }

        update_db_version(conn, latest_version)?;
        println!("Migrations completed successfully");
    }

    Ok(())
}

pub fn insert_hymn(hymn: &Hymn) -> SqlResult<i64> {
    let conn = DB_CONNECTION.lock().unwrap();
    let conn = conn.as_ref().expect("Database not initialized");

    // First check if hymn with same number and language exists
    let mut stmt = conn.prepare(
        "SELECT COUNT(*) FROM hymns WHERE number = ?1 AND language = ?2"
    )?;

    // Convert number to i64 for the query and use params! macro
    let count: i64 = stmt.query_row(
        params![hymn.number, hymn.language],
        |row| row.get(0)
    )?;

    if (count > 0) {
        return Err(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(1),
            Some(String::from("Hymn with this number already exists for this language"))
        ));
    }

    // If no duplicate found, proceed with insert
    conn.execute(
        "INSERT INTO hymns (number, title, verses_count, has_refrain, refrain_text,
         key_signature, author, language, is_youth_song, hymn_type)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            hymn.number,
            hymn.title,
            hymn.verses_count,
            hymn.has_refrain,
            hymn.refrain_text,
            hymn.key_signature,
            hymn.author,
            hymn.language,
            hymn.is_youth_song,
            hymn.hymn_type,
        ],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn get_hymns_by_language(lang: &str, hymn_type: &str) -> SqlResult<Vec<Hymn>> {
    let conn = DB_CONNECTION.lock().unwrap();
    let conn = conn.as_ref().expect("Database not initialized");

    println!("Querying hymns with lang: {} and type: {}", lang, hymn_type);

    let sql = if (hymn_type == "*") {
        "SELECT * FROM hymns WHERE language = ?1 ORDER BY number"
    } else {
        "SELECT * FROM hymns WHERE language = ?1 AND hymn_type = ?2 ORDER BY number"
    };

    let mut stmt = conn.prepare(sql)?;

    let hymns = if (hymn_type == "*") {
        stmt.query_map(params![lang], map_hymn_row)?
    } else {
        stmt.query_map(params![lang, hymn_type], map_hymn_row)?
    }.collect::<SqlResult<Vec<_>>>()?;

    println!("Found {} hymns", hymns.len());
    Ok(hymns)
}

// Helper function to map a row to a Hymn
fn map_hymn_row(row: &rusqlite::Row) -> SqlResult<Hymn> {
    Ok(Hymn {
        id: row.get(0)?,
        number: row.get(1)?,
        title: row.get(2)?,
        verses_count: row.get(3)?,
        has_refrain: row.get(4)?,
        refrain_text: row.get(5)?,
        key_signature: row.get(6)?,
        author: row.get(7)?,
        language: row.get(8)?,
        is_youth_song: row.get(9)?,
        hymn_type: row.get(10)?,
    })
}

pub fn add_verse(verse: &Verse) -> SqlResult<i64> {
    let conn = DB_CONNECTION.lock().unwrap();
    let conn = conn.as_ref().expect("Database not initialized");

    conn.execute(
        "INSERT INTO verses (hymn_id, verse_number, verse_text)
         VALUES (?1, ?2, ?3)",
        params![
            verse.hymn_id,
            verse.verse_number,
            verse.verse_text,
        ],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn delete_hymn(id: i64) -> SqlResult<()> {
    let conn = DB_CONNECTION.lock().unwrap();
    let conn = conn.as_ref().expect("Database not initialized");

    conn.execute("DELETE FROM hymns WHERE id = ?1", [id])?;
    Ok(())
}

pub fn update_hymn(hymn: &Hymn) -> SqlResult<()> {
    let conn = DB_CONNECTION.lock().unwrap();
    let conn = conn.as_ref().expect("Database not initialized");

    conn.execute(
        "UPDATE hymns SET number = ?1, title = ?2, verses_count = ?3,
         has_refrain = ?4, refrain_text = ?5, key_signature = ?6,
         author = ?7, language = ?8, is_youth_song = ?9, hymn_type = ?10
         WHERE id = ?11",
        params![
            hymn.number,
            hymn.title,
            hymn.verses_count,
            hymn.has_refrain,
            hymn.refrain_text,
            hymn.key_signature,
            hymn.author,
            hymn.language,
            hymn.is_youth_song,
            hymn.hymn_type,
            hymn.id,
        ],
    )?;

    Ok(())
}

// Update the get_verses_for_hymn function
pub fn get_verses_for_hymn(hymn_id: i64) -> Result<Vec<Verse>, rusqlite::Error> {
    let conn = DB_CONNECTION.lock().unwrap();
    let conn = conn.as_ref().expect("Database not initialized");
    println!("Fetching verses for hymn ID: {}", hymn_id);

    let mut stmt = conn.prepare(
        "SELECT id, hymn_id, verse_number, verse_text
         FROM verses
         WHERE hymn_id = ?
         ORDER BY verse_number ASC"
    )?;

    let verses = stmt.query_map([hymn_id], |row| {
        let verse = Verse {
            id: row.get(0)?,
            hymn_id: row.get(1)?,
            verse_number: row.get(2)?,
            verse_text: row.get(3)?
        };
        println!("Found verse {}: {}", verse.verse_number, verse.verse_text);
        Ok(verse)
    })?
    .filter_map(Result::ok)
    .collect::<Vec<_>>();

    println!("Total verses found for hymn {}: {}", hymn_id, verses.len());
    Ok(verses)
}

pub fn delete_verses_for_hymn(hymn_id: i64) -> SqlResult<()> {
    let conn = DB_CONNECTION.lock().unwrap();
    let conn = conn.as_ref().expect("Database not initialized");

    conn.execute(
        "DELETE FROM verses WHERE hymn_id = ?1",
        params![hymn_id]
    )?;

    Ok(())
}

pub fn search_bible_verses(query: &str) -> SqlResult<Vec<BibleVerse>> {
    let conn = BIBLE_DB_CONNECTION.lock().unwrap();
    let conn = conn.as_ref().expect("Bible database not initialized");

    println!("Searching for verses with query: {}", query);

    // Parse the query to check if it's a specific reference
    let parts: Vec<&str> = query.trim().split(|c| c == ' ' || c == ':').collect();
    let (book_query, chapter, verse) = match parts.len() {
        3 => (parts[0], parts[1].parse::<i32>().ok(), parts[2].parse::<i32>().ok()),
        2 => (parts[0], parts[1].parse::<i32>().ok(), None),
        1 => (parts[0], None, None),
        _ => return Ok(Vec::new()),
    };

    // Find matching books
    let matching_books: Vec<(i32, &str)> = BIBLE_BOOKS.iter()
        .enumerate()
        .filter(|(_, book)| book.to_lowercase().contains(&book_query.to_lowercase()))
        .map(|(index, book)| (index as i32 + 1, *book))
        .collect();

    println!("Matching books: {:?}", matching_books);
    let mut verses = Vec::new();

    // If we have matching books
    if !matching_books.is_empty() {
        // If we have a specific chapter/verse request
        if let Some(ch) = chapter {
            for (book_num, book_name) in &matching_books {
                if let Some(v) = verse {
                    // Store verse number first to extend its lifetime
                    let verse_num = v;
                    let mut stmt = conn.prepare(
                        "SELECT id, book, chapter, verse, text
                         FROM verses
                         WHERE book = ? AND chapter = ? AND verse = ?"
                    )?;

                    let verse_matches = stmt.query_map([book_num, &ch, &verse_num], |row| {
                        Ok(BibleVerse {
                            id: row.get(0)?,
                            book: book_name.to_string(),
                            chapter: row.get(2)?,
                            verse: row.get(3)?,
                            text: row.get(4)?,
                        })
                    })?.filter_map(Result::ok);

                    verses.extend(verse_matches);
                } else {
                    // Show all verses in chapter (up to 10)
                    let mut stmt = conn.prepare(
                        "SELECT id, book, chapter, verse, text
                         FROM verses
                         WHERE book = ? AND chapter = ?
                         ORDER BY verse
                         LIMIT 10"
                    )?;

                    let verse_matches = stmt.query_map([book_num, &ch], |row| {
                        Ok(BibleVerse {
                            id: row.get(0)?,
                            book: book_name.to_string(),
                            chapter: row.get(2)?,
                            verse: row.get(3)?,
                            text: row.get(4)?,
                        })
                    })?.filter_map(Result::ok);

                    verses.extend(verse_matches);
                }
            }
        } else {
            // No chapter specified, show book names and first few verses of each matching book
            for (book_num, book_name) in &matching_books {
                // Add book name entry
                verses.push(BibleVerse {
                    id: *book_num as i64,
                    book: book_name.to_string(),
                    chapter: 0,
                    verse: 0,
                    text: format!("Book of {}", book_name),
                });

                // Add first few verses from chapter 1
                let mut stmt = conn.prepare(
                    "SELECT id, book, chapter, verse, text
                     FROM verses
                     WHERE book = ?1 AND chapter = 1
                     ORDER BY verse
                     LIMIT 5"
                )?;

                let verse_matches = stmt.query_map([book_num], |row| {
                    Ok(BibleVerse {
                        id: row.get(0)?,
                        book: book_name.to_string(),
                        chapter: row.get(2)?,
                        verse: row.get(3)?,
                        text: row.get(4)?,
                    })
                })?.filter_map(Result::ok);

                verses.extend(verse_matches);
            }
        }
    }

    // Also search for text matches if query is long enough
    if query.len() >= 3 {
        let mut stmt = conn.prepare(
            "SELECT id, book, chapter, verse, text
             FROM verses
             WHERE text LIKE '%' || ?1 || '%'
             LIMIT 5"
        )?;

        let text_matches = stmt.query_map([query], |row| {
            let book_num: i32 = row.get(1)?;
            let book_name = BIBLE_BOOKS.get(book_num as usize - 1)
                .unwrap_or(&"Unknown");

            Ok(BibleVerse {
                id: row.get(0)?,
                book: book_name.to_string(),
                chapter: row.get(2)?,
                verse: row.get(3)?,
                text: row.get(4)?,
            })
        })?.filter_map(Result::ok);

        verses.extend(text_matches);
    }

    Ok(verses)
}

// Update get_bible_verse to handle non-existent verses gracefully
pub fn get_bible_verse(book: &str, chapter: i32, verse: i32) -> SqlResult<BibleVerse> {
    let conn = BIBLE_DB_CONNECTION.lock().unwrap();
    let conn = conn.as_ref().expect("Bible database not initialized");

    let (book_match, _) = find_book_number(book);
    let (book_num, book_name) = book_match
        .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;

    // First check if the verse exists
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM verses WHERE book = ?1 AND chapter = ?2 AND verse = ?3",
        params![book_num, chapter, verse],
        |row| row.get(0)
    )?;

    if count == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    conn.query_row(
        "SELECT id, book, chapter, verse, text
         FROM verses
         WHERE book = ?1 AND chapter = ?2 AND verse = ?3",
        params![book_num, chapter, verse],
        |row| Ok(BibleVerse {
            id: row.get(0)?,
            book: book_name.to_string(),
            chapter: row.get(2)?,
            verse: row.get(3)?,
            text: row.get(4)?,
        })
    )
}

pub fn get_bible_translations() -> SqlResult<Vec<BibleTranslation>> {
    let conn = BIBLE_DB_CONNECTION.lock().unwrap();
    let conn = conn.as_ref().expect("Bible database not initialized");

    // Query using field/value structure
    let mut stmt = conn.prepare("SELECT field, value FROM meta")?;
    let rows = stmt.query_map([], |row| {
        let field: String = row.get(0)?;
        let value: Option<String> = row.get(1)?;
        Ok((field, value))
    })?;

    // Collect all field/value pairs
    let meta_data: HashMap<String, Option<String>> = rows
        .filter_map(|row| {
            row.ok().map(|(field, value)| (field, value))
        })
        .collect();

    // Create a single translation from the metadata
    Ok(vec![BibleTranslation {
        name: meta_data.get("name")
            .and_then(|v| v.clone())
            .unwrap_or_else(|| String::from("Afrikaans 1953")),
        shortname: meta_data.get("shortname")
            .and_then(|v| v.clone())
            .unwrap_or_else(|| String::from("AFR")),
        module: meta_data.get("module")
            .and_then(|v| v.clone())
            .unwrap_or_else(|| String::from("afri")),
        year: meta_data.get("year")
            .and_then(|v| v.as_ref())
            .and_then(|v| v.parse().ok())
            .unwrap_or(1953),
    }])
}

// Modify get_last_verse_of_book to be more lenient with book name matching
// Update get_last_verse_of_book to fix the SQL query
pub fn get_last_verse_of_book(book: &str) -> SqlResult<BibleVerse> {
    let conn = BIBLE_DB_CONNECTION.lock().unwrap();
    let conn = conn.as_ref().expect("Bible database not initialized");

    let (book_match, is_exact) = find_book_number(book);

    // Only proceed if we have an exact match
    if !is_exact {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    let (book_num, book_name) = book_match
        .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;

    conn.query_row(
        "SELECT MAX(id) as id, book, MAX(chapter) as chapter, MAX(verse) as verse, text
         FROM verses
         WHERE book = ?1
         GROUP BY book",
        params![book_num],
        |row| Ok(BibleVerse {
            id: row.get(0)?,
            book: book_name.to_string(),
            chapter: row.get(2)?,
            verse: row.get(3)?,
            text: row.get(4)?,
        })
    )
}

pub fn get_verse_count(book: &str, chapter: i32) -> SqlResult<i32> {
    let conn = BIBLE_DB_CONNECTION.lock().unwrap();
    let conn = conn.as_ref().expect("Bible database not initialized");

    let (book_match, _) = find_book_number(book);
    let (book_num, _) = book_match
        .ok_or_else(|| rusqlite::Error::InvalidParameterName(format!("Invalid book name: {}", book)))?;

    conn.query_row(
        "SELECT COUNT(*) FROM verses WHERE book = ?1 AND chapter = ?2",
        params![book_num, chapter],
        |row| row.get(0)
    )
}
