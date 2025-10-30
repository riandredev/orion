// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use lazy_static::lazy_static;
use std::{sync::Mutex, sync::Arc, path::PathBuf, cell::RefCell};
use tauri::{Manager, Emitter, Window, WebviewWindowBuilder, AppHandle, Event, Listener};
use tauri::async_runtime::block_on;
use tauri::path::BaseDirectory;
use tauri::command;
use serde::Serialize;
use std::fs;
use serde_json::{json, Value as JsonValue};
use window_shadows::set_shadow;
// pruned: image/base64/cursor (no longer used)
use url::Url;
// pruned: XcapWindow (no longer used)
use tauri::window::Window as TauriWindow;
use std::sync::atomic::{AtomicBool, Ordering};
// pruned: xcap Monitor/thread/duration moved to streams module

mod db;
mod scraper;
mod hymn_display;
mod images;
mod displays;
mod streams;
mod bible_api;

use db::{Hymn, Verse};

lazy_static! {
    static ref TIME_SELECTIONS: Mutex<Vec<TimeSelection>> = Mutex::new(Vec::new());
}

// pruned local VideoStream; moved to streams module

// removed: start_stream/stop_stream (moved to streams module)

// removed: update_window_content and WindowContentArgs (unused)

// removed: save_selected_displays (moved to displays module)

// removed: get_selected_displays (moved to displays module)

/* #[command]
fn save_clock_displays(app: tauri::AppHandle, displays: Vec<usize>) -> Result<(), String> {
    println!("Saving clock display selections: {:?}", displays);
    let app_dir = app.path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;

    let file = app_dir.join("clock_displays.json");
    println!("Saving to file: {:?}", file);

    let json = serde_json::to_string(&displays)
        .map_err(|e| format!("Failed to serialize: {}", e))?;

    fs::write(&file, json)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    let mut selected = CLOCK_DISPLAYS.lock()
        .map_err(|e| format!("Failed to lock: {}", e))?;
    *selected = displays;

    Ok(())
} */

/* #[command]
fn get_clock_displays(app: tauri::AppHandle) -> Result<Vec<usize>, String> {
    println!("Getting clock display selections");
    let app_dir = app.path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;

    let file = app_dir.join("clock_displays.json");
    println!("Loading from file: {:?}", file);

    if file.exists() {
        let content = fs::read_to_string(&file)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        let displays: Vec<usize> = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to deserialize: {}", e))?;

        println!("Loaded clock displays: {:?}", displays);

        if let Ok(mut selected) = CLOCK_DISPLAYS.lock() {
            *selected = displays.clone();
        }

        Ok(displays)
    } else {
        println!("No saved clock displays found, defaulting to [0]");
        let default = vec![0];
        save_clock_displays(app, default.clone())?;
        Ok(default)
    }
} */

// moved: image windows and image/display structs

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct VerseState {
    verse_number: i32,
    visible: bool,
    part: Option<i32>,
    total_parts: Option<i32>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct TimeSelection {
    id: String,
    name: String,
    time: String,
    runtime: String,
    is_playing: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct OrderItem {
    id: String,
    content: String,
}

#[command]
fn save_order_items(app: tauri::AppHandle, items: Vec<OrderItem>) -> Result<(), String> {
    let app_dir = app.path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;

    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let items_file = app_dir.join("order_items.json");
    let json = serde_json::to_string(&items).map_err(|e| e.to_string())?;
    fs::write(items_file, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
fn get_order_items(app: tauri::AppHandle) -> Result<Vec<OrderItem>, String> {
    let app_dir = app.path()
        .app_config_dir()
        .map_err(|_| String::from("Failed to get app config directory"))?;

    let items_file = app_dir.join("order_items.json");

    if items_file.exists() {
        let json = fs::read_to_string(items_file).map_err(|e| e.to_string())?;
        serde_json::from_str(&json).map_err(|e| e.to_string())
    } else {
        Ok(Vec::new())
    }
}

// moved: image and display helpers/commands to modules

#[command]
fn save_time_selections(app: tauri::AppHandle, selections: Vec<TimeSelection>) -> Result<(), String> {
    let app_dir = app.path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;

    // Create the config directory if it doesn't exist
    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;

    let selections_file = app_dir.join("time_selections.json");
    let json = serde_json::to_string(&selections).map_err(|e| e.to_string())?;
    fs::write(selections_file, json).map_err(|e| e.to_string())?;

    let mut stored_selections = TIME_SELECTIONS.lock().map_err(|e| e.to_string())?;
    *stored_selections = selections;
    Ok(())
}

#[command]
fn get_time_selections(app: tauri::AppHandle) -> Result<Vec<TimeSelection>, String> {
    let app_dir = app.path()
        .app_config_dir()
        .map_err(|_| String::from("Failed to get app config directory"))?;

    let selections_file = app_dir.join("time_selections.json");

    if selections_file.exists() {
        let json = fs::read_to_string(selections_file).map_err(|e| e.to_string())?;
        let selections: Vec<TimeSelection> = serde_json::from_str(&json).map_err(|e| e.to_string())?;

        let mut stored_selections = TIME_SELECTIONS.lock().map_err(|e| e.to_string())?;
        *stored_selections = selections.clone();

        Ok(selections)
    } else {
        Ok(Vec::new())
    }
}

#[command]
async fn emit_main(app: tauri::AppHandle, event: String, payload: serde_json::Value) -> Result<(), String> {
    if let Some(main_window) = app.get_webview_window("main") {
        main_window
            .emit(&event, payload)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/* #[command]
async fn get_window_url(app: tauri::AppHandle, label: String) -> Result<String, String> {
    let window = match app.get_webview_window(&label) {
        Some(win) => win,
        None => return Err(format!("Window {} not found", label))
    };

    window.url()
        .map(|url| url.to_string())
        .map_err(|e| e.to_string())
} */

// moved: image current and delete commands to images module

#[derive(serde::Deserialize)]
struct CapturePreviewArgs {
    label: String,
}

#[command]
async fn initialize_app(app: tauri::AppHandle) -> Result<(), String> {
    println!("Initializing app...");

    // Initialize database
    db::init_db(&app).map_err(|e| format!("Database initialization failed: {}", e))?;

    // Pre-load display settings at startup
    let _ = displays::get_selected_displays(app.clone())?;

    println!("App initialization completed");
    Ok(())
}

#[command]
async fn scrape_hymns(app: tauri::AppHandle, language: String, fetch_only: Option<bool>) -> Result<Vec<serde_json::Value>, String> {
    let fetch_only = fetch_only.unwrap_or(false);

    if fetch_only {
        // Just return an empty array for now, will implement fetching later
        return Ok(Vec::new());
    }

    let result = tokio::task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create runtime");
        rt.block_on(scraper::scrape_sda_hymnal(app, &language))
            .map_err(|e| format!("Scraping failed: {}", e))
    }).await
    .map_err(|e| format!("Task join error: {}", e))??;

    // Convert the Rust struct field names to match the TypeScript interface
    let converted_hymns: Vec<serde_json::Value> = result.into_iter().map(|hymn| {
        serde_json::json!({
            "number": hymn.number,
            "title": hymn.title,
            "verses": hymn.verses,
            "hasRefrain": hymn.has_refrain,
            "refrainText": hymn.refrain_text,
            "author": hymn.author,
            "keySignature": hymn.key_signature
        })
    }).collect();

    Ok(converted_hymns)
}

#[command]
async fn get_hymns(language: String, hymnType: String, searchValue: Option<String>) -> Result<Vec<Hymn>, String> {
    println!("get_hymns called with language: {}, hymnType: {}, searchValue: {:?}", language, hymnType, searchValue);
    let mut hymns = db::get_hymns_by_language(&language, &hymnType)
        .map_err(|e| format!("Failed to get hymns: {}", e))?;

    // If searchValue is provided, filter hymns by number
    if let Some(search) = searchValue {
        if !search.is_empty() {
            hymns = hymns.into_iter()
                .filter(|h| h.number.to_string().contains(&search))
                .collect();
        }
    }

    Ok(hymns)
}

#[command]
async fn add_hymn(hymn: Hymn) -> Result<i64, String> {
    db::insert_hymn(&hymn)
        .map_err(|e| format!("Failed to insert hymn: {}", e))
}

#[command]
async fn add_verse(verse: Verse) -> Result<i64, String> {
    db::add_verse(&verse)
        .map_err(|e| format!("Failed to add verse: {}", e))
}

#[command]
async fn delete_hymn(id: i64) -> Result<(), String> {
    db::delete_hymn(id)
        .map_err(|e| format!("Failed to delete hymn: {}", e))
}

#[command]
async fn update_hymn(hymn: Hymn) -> Result<(), String> {
    db::update_hymn(&hymn)
        .map_err(|e| format!("Failed to update hymn: {}", e))
}

#[command]
async fn navigate_hymn(app: tauri::AppHandle, direction: String, current_verse: Option<i32>, verse_states: Option<Vec<VerseState>>) -> Result<i32, String> {
    println!("Navigating hymn with direction: {}, current verse: {:?}", direction, current_verse);

    // Get hymn data from window URL
    let hymn_windows = app.webview_windows();
    let first_window = hymn_windows.iter()
        .find(|(label, _)| label.starts_with("hymn-window"))
        .map(|(_, window)| window);

    // Get the hymn data before spawning thread
    let hymn_data = if let Some(window) = first_window {
        let url = window.url().map_err(|e| e.to_string())?;
        let parsed_url = url::Url::parse(&url.to_string()).map_err(|e| e.to_string())?;
        let hymn_param = parsed_url.query_pairs()
            .find(|(key, _)| key == "hymn")
            .ok_or("No hymn parameter found")?;
        let hymn: Hymn = serde_json::from_str(&urlencoding::decode(&hymn_param.1).map_err(|e| e.to_string())?.into_owned())
            .map_err(|_| "Failed to parse hymn data")?;
        (hymn.verses_count, hymn.has_refrain)
    } else {
        return Err("No hymn window found".to_string());
    };

    let (total_verses, has_refrain) = hymn_data;
    let curr = current_verse.unwrap_or(0);
    
    // Check if we have verse_states to handle multi-part verses
    if let Some(states) = verse_states {
        if !states.is_empty() {
            // Find the current content index based on the active verse
            let mut current_index_opt = None;
            let mut current_part = None;
            let mut current_total_parts = None;
            
            // First, try to find exact match including part
            for (idx, state) in states.iter().enumerate() {
                let matches = match curr {
                    0 => state.verse_number == 0, // Title
                    -1 => state.verse_number == -1, // Refrain
                    _ => state.verse_number == curr, // Regular verse
                };
                
                if matches {
                    current_index_opt = Some(idx);
                    current_part = state.part;
                    current_total_parts = state.total_parts;
                    break;
                }
            }
            
            if let Some(current_index) = current_index_opt {
                // Check if this is a multi-part verse/refrain
                let is_multi_part = current_total_parts.is_some() && current_total_parts.unwrap() > 1;
                let current_part_value = current_part.unwrap_or(1);
                
                // Find the next content index based on the direction
                let target_index = match direction.as_str() {
                    "forward" | "next" => {
                        if is_multi_part && current_part_value < current_total_parts.unwrap() {
                            // Navigate to the next part of the same verse
                            let next_part = current_part_value + 1;
                            
                            // Find the index of the next part
                            let next_part_index = states.iter().position(|state| {
                                state.verse_number == states[current_index].verse_number && 
                                state.part.unwrap_or(1) == next_part
                            });
                            
                            next_part_index.unwrap_or_else(|| {
                                if current_index + 1 < states.len() {
                                    current_index + 1
                                } else {
                                    0 // Loop back to beginning
                                }
                            })
                        } else {
                            // Move to the next content (which might be a different verse)
                            if current_index + 1 < states.len() {
                                current_index + 1
                            } else {
                                0 // Loop back to beginning
                            }
                        }
                    },
                    "backward" | "prev" => {
                        if is_multi_part && current_part_value > 1 {
                            // Navigate to the previous part of the same verse
                            let prev_part = current_part_value - 1;
                            
                            // Find the index of the previous part
                            let prev_part_index = states.iter().position(|state| {
                                state.verse_number == states[current_index].verse_number && 
                                state.part.unwrap_or(1) == prev_part
                            });
                            
                            prev_part_index.unwrap_or_else(|| {
                                if current_index > 0 {
                                    current_index - 1
                                } else {
                                    states.len() - 1 // Loop to the end
                                }
                            })
                        } else {
                            // Find the previous content, which might be a verse with multiple parts
                            let prev_index = if current_index > 0 { current_index - 1 } else { states.len() - 1 };
                            
                            // Check if the previous verse has multiple parts
                            let prev_verse_has_parts = states.get(prev_index)
                                .and_then(|state| state.total_parts)
                                .map(|total_parts| total_parts > 1)
                                .unwrap_or(false);
                                
                            if prev_verse_has_parts {
                                // Find the last part of the previous verse
                                let prev_verse_number = states[prev_index].verse_number;
                                let prev_verse_parts = states.iter()
                                    .filter(|state| state.verse_number == prev_verse_number)
                                    .collect::<Vec<_>>();
                                    
                                if !prev_verse_parts.is_empty() {
                                    // Find the state with the highest part number
                                    let highest_part_state = prev_verse_parts.iter()
                                        .max_by_key(|state| state.part.unwrap_or(1));
                                        
                                    if let Some(highest_part_state) = highest_part_state {
                                        // Find the index of the highest part
                                        states.iter().position(|state| 
                                            state.verse_number == prev_verse_number && 
                                            state.part == highest_part_state.part
                                        ).unwrap_or(prev_index)
                                    } else {
                                        prev_index
                                    }
                                } else {
                                    prev_index
                                }
                            } else {
                                prev_index
                            }
                        }
                    },
                    _ => current_index,
                };
                
                // Send a goto-index event to all hymn windows
                for (label, window) in app.webview_windows().iter() {
                    if label.starts_with("hymn-window") {
                        let key = format!("goto-index-{}", target_index);
                        window.emit("hymn-navigation", json!({"key": key}))
                            .map_err(|e| e.to_string())?;
                    }
                }
                
                // Return the verse number that corresponds to the new index
                return Ok(states[target_index].verse_number);
            }
        }
    }
    
    // Fall back to the old navigation logic if no verse states are provided
    let next_verse = match direction.as_str() {
        "goto" => curr, // Direct navigation
        "forward" | "next" => {
            match curr {
                0 => 1, // Title -> First verse
                -1 => { // From refrain
                    let next = curr.abs() + 1;
                    if next <= total_verses { next } else { 0 }
                },
                v if v > 0 => {
                    if v < total_verses {
                        if has_refrain { -1 } else { v + 1 }
                    } else {
                        0 // Back to title
                    }
                },
                _ => curr,
            }
        },
        "backward" | "prev" => {
            match curr {
                0 => {
                    if has_refrain && total_verses > 0 { -1 } else { total_verses }
                },
                -1 => total_verses, // From refrain to last verse
                1 => 0, // First verse -> Title
                v if v > 1 => {
                    if has_refrain { -1 } else { v - 1 }
                },
                _ => curr,
            }
        },
        _ => curr,
    };
    
    // Send navigation event to all hymn windows
    for (label, window) in app.webview_windows().iter() {
        if label.starts_with("hymn-window") {
            let key = if direction == "goto" {
                format!("goto-verse-{}", next_verse)
            } else {
                format!("goto-verse-{}", next_verse)
            };
            window.emit("hymn-navigation", json!({"key": key}))
                .map_err(|e| e.to_string())?;
        }
    }
    
    Ok(next_verse)
}

#[command]
async fn stop_hymn(app: tauri::AppHandle) -> Result<(), String> {
    println!("Stopping hymn playback");

    // Close all hymn-window instances
    for (label, window) in app.webview_windows().iter() {
        if label.starts_with("hymn-window") {
            window.close().map_err(|e| format!("Failed to close window: {}", e))?;
        }
    }

    // Emit the stop-hymn event to notify frontend components
    app.emit("stop-hymn", {})
        .map_err(|e| format!("Failed to emit stop-hymn event: {}", e))?;

    Ok(())
}

#[command]
async fn delete_verses_for_hymn(hymn_id: i64) -> Result<(), String> {
    db::delete_verses_for_hymn(hymn_id)
        .map_err(|e| format!("Failed to delete verses: {}", e))
}

#[command]
fn get_hymn_windows(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    Ok(app.webview_windows()
        .into_iter()
        .filter(|(label, _)| label.starts_with("hymn-window"))
        .map(|(label, _)| label)
        .collect())
}

#[command]
async fn set_hymn_background(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let app_dir = app.path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;

    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create config dir: {}", e))?;

    // Copy the image to the app's config directory
    let destination = app_dir.join("hymn-background").with_extension("jpg");
    std::fs::copy(&path, &destination)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    Ok(())
}

#[command]
fn get_hymn_background(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let app_dir = app.path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;

    let bg_path = app_dir.join("hymn-background.jpg");
    if bg_path.exists() {
        Ok(Some(bg_path.to_string_lossy().into_owned()))
    } else {
        Ok(None)
    }
}

#[command]
async fn get_verses_for_hymn(hymnId: i64) -> Result<Vec<Verse>, String> {
    println!("Getting verses for hymn ID: {}", hymnId);
    db::get_verses_for_hymn(hymnId)
        .map_err(|e| format!("Failed to get verses: {}", e))
}

#[command]
async fn emit_hymn_navigation(app: tauri::AppHandle, key: String) -> Result<(), String> {
    println!("Emitting hymn navigation event with key: {}", key);
    let windows = app.webview_windows();
    for (label, window) in windows.iter() {
        if label.starts_with("hymn-window") {
            println!("Sending navigation event to window: {}", label);
            window.emit("hymn-navigation", &json!({ "key": key }))
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/* #[command]
async fn navigate_church_window(app: tauri::AppHandle, action: String) -> Result<(), String> {
    println!("Navigating church window with action: {}", action);
    let windows = app.webview_windows();
    for (label, window) in windows.iter() {
        if label.starts_with("church-window") {
            window.emit("church-navigation", &json!({ "action": action }))
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[command]
async fn navigate_slides(app: tauri::AppHandle, direction: String) -> Result<(), String> {
    println!("Navigating slides with direction: {}", direction);
    let windows = app.webview_windows();
    for (label, window) in windows.iter() {
        if label.starts_with("slide-window") {
            window.emit("slide-navigation", &json!({ "direction": direction }))
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
} */

// moved: bible APIs to bible_api module

/* #[command]
async fn capture_window_content(window: Window) -> Result<String, String> {
    // Add a small delay (150ms) for smoother capture timing
    tokio::time::sleep(tokio::time::Duration::from_millis(25)).await;

    let app = window.app_handle();
    let selected_displays = get_selected_displays(app.clone())?;
    let target_display = selected_displays.get(0).copied().unwrap_or(0);

    // Get monitor position from Tauri window API first
    let tauri_window = app.get_webview_window("main")
        .ok_or("Failed to get main window")?;

    // Get monitor info before spawning thread
    let monitor_info = {
        let monitors = tauri_window.available_monitors()
            .map_err(|e| format!("Failed to get monitors: {}", e))?;
        let target_monitor = monitors.get(target_display)
            .ok_or_else(|| format!("Monitor {} not found", target_display))?;
        let position = target_monitor.position();
        (position.x, position.y)
    };

    let encoded_image = std::thread::spawn(move || -> Result<String, String> {
        let (target_x, target_y) = monitor_info;

        // Get all xcap monitors
        let monitors = Monitor::all()
            .map_err(|e| format!("Failed to get monitors: {}", e))?;

        // Find the monitor that matches our target position
        let capture_monitor = monitors.into_iter()
            .find(|m| {
                let x_match = (m.x() as i32 - target_x).abs() < 200;
                let y_match = (m.y() as i32 - target_y).abs() < 200;
                x_match && y_match
            })
            .ok_or_else(|| format!("No monitor found at position ({}, {})", target_x, target_y))?;

        println!("Capturing monitor at {}x{} position ({}, {})",
            capture_monitor.width(), capture_monitor.height(),
            capture_monitor.x(), capture_monitor.y());

        let image = capture_monitor.capture_image()
            .map_err(|e| format!("Failed to capture image: {}", e))?;

        let width = image.width();
        let height = image.height();
        let raw_pixels = image.into_raw();
        let new_image = image::ImageBuffer::from_raw(width, height, raw_pixels)
            .ok_or("Failed to convert image buffer")?;

        let dynamic_image = DynamicImage::ImageRgba8(new_image);
        let scaled = dynamic_image.resize(
            width / 3,
            height / 3,
            image::imageops::FilterType::Nearest
        );

        let mut buffer = Vec::with_capacity(1024 * 1024);
        let mut cursor = Cursor::new(&mut buffer);
        scaled.write_to(&mut cursor, image::ImageFormat::Jpeg)
            .map_err(|e| format!("Failed to encode image: {}", e))?;

        Ok(BASE64.encode(&buffer))
    }).join()
        .map_err(|e| format!("Thread error: {:?}", e))??;

    Ok(encoded_image)
} */

/* #[command]
async fn update_stream(app: AppHandle) -> Result<(), String> {
    // First stop the current stream
    stop_stream().await?;

    // Then start a new stream with the updated display
    start_stream(app).await?;

    Ok(())
} */

/* #[command]
fn convert_file_path(path: String) -> Result<String, String> {
    // Convert backslashes to forward slashes and ensure proper format
    let normalized_path = path.replace('\\', "/");
    if normalized_path.starts_with('/') {
        Ok(format!("file://{}", normalized_path))
    } else {
        Ok(format!("file:///{}", normalized_path))
    }
} */

#[tauri::command]
async fn emit_event(app: tauri::AppHandle, window_label: &str, event: &str, payload: serde_json::Value) -> Result<(), String> {
    let window = app.get_webview_window(window_label)
        .ok_or_else(|| format!("Window '{}' not found", window_label))?;

    window.emit(event, payload)
        .map_err(|e| format!("Failed to emit event: {}", e))
}

// removed: image folder helpers (moved to images module)

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize database directly in setup
            println!("Initializing database...");
            match db::init_db(&app.handle()) {
                Ok(_) => println!("Database initialized successfully"),
                Err(e) => println!("Database initialization error: {}", e),
            }
            
            println!("Application starting...");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            images::get_images,
            images::preload_images,
            images::upload_images,
            displays::get_displays,
            images::clear_cache_for_folder,
            save_time_selections,
            get_time_selections,
            emit_main,
            images::set_current_image,
            images::get_current_image,
            images::clear_current_image,
            images::delete_image,
            save_order_items,
            get_order_items,
            displays::save_selected_displays,
            displays::get_selected_displays,
            displays::get_image_windows,
            initialize_app,
            images::get_image_folders,
            images::delete_image_folder,
            images::create_image_folder,

            // Hymn functions
            get_hymns,
            add_hymn,
            add_verse,
            delete_hymn,
            update_hymn,
            navigate_hymn,
            stop_hymn,
            get_verses_for_hymn,
            delete_verses_for_hymn,
            get_hymn_windows,
            set_hymn_background,
            get_hymn_background,
            emit_hymn_navigation,
            hymn_display::display_hymn,

            // Bible functions
            bible_api::get_bible_translations,
            bible_api::search_bible_verses,
            bible_api::get_bible_verse,
            bible_api::get_last_verse_of_book,
            bible_api::get_verse_count,
            bible_api::get_bible_windows,
            bible_api::emit_verse_navigation,
            bible_api::set_bible_background,
            bible_api::get_bible_background,

            // Church/Slides removed

            // Utility functions
            streams::start_stream,
            streams::stop_stream,
            scrape_hymns,
            emit_event,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            tauri::RunEvent::WindowEvent { label, event, .. } => {
                if label == "image-window" {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        if let Some(window) = app_handle.get_webview_window("image-window") {
                            // First emit the event
                            let _ = window.emit("stopTimer", ());
                            // Call clear_current_image directly
                            let _ = images::clear_current_image();
                            // Force close the window
                            let _ = window.close();
                        }
                    }
                }
            },
            _ => {}
        });
}
