use lazy_static::lazy_static;
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

lazy_static! {
    static ref SELECTED_DISPLAYS: Mutex<Vec<usize>> = Mutex::new(vec![0]);
}

#[derive(Serialize)]
pub struct DisplayInfo {
    pub id: String,
    pub name: String,
}

#[tauri::command]
pub fn save_selected_displays(app: AppHandle, displays: Vec<usize>) -> Result<(), String> {
    let app_dir = app.path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;

    let file = app_dir.join("displays.json");

    if let Some(parent) = file.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let content = serde_json::to_string(&displays)
        .map_err(|e| format!("Failed to serialize: {}", e))?;

    std::fs::write(&file, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    if let Ok(mut selected) = SELECTED_DISPLAYS.lock() {
        *selected = displays;
    }

    Ok(())
}

#[tauri::command]
pub fn get_selected_displays(app: AppHandle) -> Result<Vec<usize>, String> {
    let app_dir = app.path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {}", e))?;

    let file = app_dir.join("displays.json");

    // Determine monitor count to validate or choose defaults
    let monitor_count = {
        if let Some(window) = app.get_webview_window("main") {
            window
                .available_monitors()
                .map(|m| m.len())
                .unwrap_or(1)
        } else {
            1
        }
    };

    if file.exists() {
        let content = std::fs::read_to_string(&file)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        let mut displays: Vec<usize> = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to deserialize: {}", e))?;

        // Filter to valid indices and ensure at least one selection
        displays.retain(|&idx| idx < monitor_count);
        if displays.is_empty() {
            let fallback = if monitor_count > 1 { 1 } else { 0 };
            displays = vec![fallback];
            save_selected_displays(app.clone(), displays.clone())?;
        }

        if let Ok(mut selected) = SELECTED_DISPLAYS.lock() {
            *selected = displays.clone();
        }

        Ok(displays)
    } else {
        let default = if monitor_count > 1 { vec![1] } else { vec![0] };
        save_selected_displays(app, default.clone())?;
        Ok(default)
    }
}

#[tauri::command]
pub async fn get_displays(app: AppHandle) -> Result<Vec<DisplayInfo>, String> {
    let window = match app.get_webview_window("main") {
        Some(win) => win,
        None => return Err("Failed to get main window".to_string())
    };

    let monitors = window.available_monitors()
        .map_err(|e| e.to_string())?;

    Ok(monitors.into_iter().enumerate().map(|(index, monitor)| {
        let monitor_name = monitor.name()
            .map(String::from)
            .unwrap_or_else(|| String::from("Unknown"));

        DisplayInfo {
            id: monitor_name.clone(),
            name: format!("Display {} - {}", index + 1, monitor_name)
        }
    }).collect())
}

#[tauri::command]
pub fn get_image_windows(app: AppHandle) -> Result<Vec<String>, String> {
    Ok(app.webview_windows()
        .into_iter()
        .filter(|(label, _)| label.starts_with("image-window"))
        .map(|(label, _)| label)
        .collect())
}


