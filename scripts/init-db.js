import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../src-tauri/resources/db/hymnals.db');

// Ensure the directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Create new database
const db = new sqlite3.Database(DB_PATH);

// Promisify database operations
const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
    });
});

async function initializeDatabase() {
    try {
        // Create tables
        await run(`CREATE TABLE IF NOT EXISTS hymns (
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
            hymn_type TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(number, language)
        )`);

        await run(`CREATE TABLE IF NOT EXISTS verses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hymn_id INTEGER NOT NULL,
            verse_number INTEGER NOT NULL,
            verse_text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(hymn_id) REFERENCES hymns(id) ON DELETE CASCADE,
            UNIQUE(hymn_id, verse_number)
        )`);

        // Insert sample hymn
        const hymn = await run(
            `INSERT OR REPLACE INTO hymns (
                number, title, verses_count, has_refrain, refrain_text, language, hymn_type, is_youth_song
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [162, "Sing, O Sing Weer Die Boodskap Oor", 3, true, "Sample refrain text", "AFR", "adventlofliedere", 0]
        );

        // Insert verses
        const verses = [
            { number: 1, text: "First verse text" },
            { number: 2, text: "Second verse text" },
            { number: 3, text: "Third verse text" }
        ];

        for (const verse of verses) {
            await run(
                `INSERT OR REPLACE INTO verses (hymn_id, verse_number, verse_text) VALUES (?, ?, ?)`,
                [hymn.lastID, verse.number, verse.text]
            );
        }

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            } else {
                console.log('Database connection closed');
            }
        });
    }
}

initializeDatabase();
