use serde::{Serialize, Deserialize};
use tauri::AppHandle;
use tauri::{Manager, Emitter};

use crate::db;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BibleVerse {
    pub book: String,
    pub chapter: i32,
    pub verse: i32,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BibleTranslation {
    pub id: String,
    pub name: String,
    pub shortname: String,
    pub module: String,
    pub year: i32,
}

#[tauri::command]
pub async fn get_bible_translations() -> Result<Vec<BibleTranslation>, String> {
    db::get_bible_translations()
        .map(|translations| translations.into_iter().map(|t| BibleTranslation {
            id: t.shortname.clone(),
            name: t.name,
            shortname: t.shortname,
            module: t.module,
            year: t.year,
        }).collect())
        .map_err(|e| format!("Failed to get translations: {}", e))
}

#[tauri::command]
pub async fn search_bible_verses(query: String) -> Result<Vec<BibleVerse>, String> {
    db::search_bible_verses(&query)
        .map(|verses| verses.into_iter().map(|v| BibleVerse {
            book: v.book,
            chapter: v.chapter,
            verse: v.verse,
            text: v.text,
        }).collect())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_last_verse_of_book(book: String) -> Result<db::BibleVerse, String> {
    db::get_last_verse_of_book(&book)
        .map_err(|e| format!("Failed to get last verse: {}", e))
}

#[tauri::command]
pub async fn get_verse_count(book: String, chapter: i32) -> Result<i32, String> {
    db::get_verse_count(&book, chapter)
        .map_err(|e| format!("Failed to get verse count: {}", e))
}

#[tauri::command]
pub fn get_bible_verse(book: String, chapter: i32, verse: i32) -> Result<db::BibleVerse, String> {
    db::get_bible_verse(&book, chapter, verse)
        .map_err(|e| format!("Failed to get verse: {}", e))
}

#[tauri::command]
pub fn get_bible_windows(app: AppHandle) -> Result<Vec<String>, String> {
    Ok(app.webview_windows()
        .into_iter()
        .filter(|(label, _)| label.starts_with("bible-window"))
        .map(|(label, _)| label)
        .collect())
}

#[tauri::command]
pub async fn emit_verse_navigation(app: AppHandle, key: String) -> Result<(), String> {
    let windows = app.webview_windows();
    for (label, window) in windows.iter() {
        if label.starts_with("bible-window") {
            window.emit("verse-navigation", &serde_json::json!({ "key": key }))
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn set_bible_background(app: AppHandle, path: String) -> Result<(), String> {
    let app_dir = app.path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;

    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create config dir: {}", e))?;

    let destination = app_dir.join("bible-background").with_extension("jpg");
    std::fs::copy(&path, &destination)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_bible_background(app: AppHandle) -> Result<Option<String>, String> {
    let app_dir = app.path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;

    let bg_path = app_dir.join("bible-background.jpg");
    if bg_path.exists() {
        Ok(Some(bg_path.to_string_lossy().into_owned()))
    } else {
        Ok(None)
    }
}


