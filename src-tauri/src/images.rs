use lazy_static::lazy_static;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri::path::BaseDirectory;

lazy_static! {
    static ref CACHED_IMAGES: Mutex<Vec<ImageInfo>> = Mutex::new(Vec::new());
    static ref CURRENT_IMAGE: Mutex<Option<String>> = Mutex::new(None);
}

#[derive(serde::Serialize, Clone)]
pub struct ImagePayload {
    pub path: String,
}

#[derive(Serialize, Clone)]
pub struct ImageInfo {
    pub name: String,
    pub path: String,
}

#[tauri::command]
pub async fn preload_images(app_handle: AppHandle) -> Result<(), String> {
    let resource_path = app_handle
        .path()
        .resolve("resources/images", BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve path: {}", e))?;

    let folders = std::fs::read_dir(&resource_path)
        .map_err(|e| format!("Failed to read resource directory: {}", e))?;

    let mut all_images = Vec::new();

    for folder in folders {
        let folder = folder.map_err(|e| format!("Failed to read folder entry: {}", e))?;
        if folder.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
            let folder_path = folder.path();
            if let Some(_) = folder_path.file_name() {
                let images = get_images_from_folder(&folder_path)?;
                all_images.extend(images);
            }
        }
    }

    let mut cached = CACHED_IMAGES.lock().unwrap();
    *cached = all_images;
    Ok(())
}

#[tauri::command]
pub async fn clear_cache_for_folder(folder: String) -> Result<(), String> {
    let mut cached = CACHED_IMAGES.lock().unwrap();
    cached.retain(|img| !img.path.contains(&folder));
    Ok(())
}

fn get_images_from_folder(folder_path: &PathBuf) -> Result<Vec<ImageInfo>, String> {
    let entries = std::fs::read_dir(folder_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut images = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if let Some(extension) = path.extension() {
            if let Some(ext) = extension.to_str() {
                if ["png", "jpg", "jpeg", "gif", "webp"].contains(&ext.to_lowercase().as_str()) {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        images.push(ImageInfo {
                            name: name.to_string(),
                            path: path.to_string_lossy().into_owned(),
                        });
                    }
                }
            }
        }
    }

    Ok(images)
}

#[tauri::command]
pub async fn get_images(_app_handle: AppHandle, folder: String) -> Result<Vec<ImageInfo>, String> {
    let cached = CACHED_IMAGES.lock().unwrap();
    Ok(cached
        .iter()
        .filter(|img| img.path.contains(&folder))
        .cloned()
        .collect())
}

#[tauri::command]
pub async fn upload_images(
    app_handle: AppHandle,
    folder: String,
    files: Vec<String>,
) -> Result<(), String> {
    let resource_path = app_handle
        .path()
        .resolve(
            format!("resources/images/{}", folder),
            BaseDirectory::Resource,
        )
        .map_err(|e| format!("Failed to resolve path: {}", e))?;

    std::fs::create_dir_all(&resource_path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    for file_path in files {
        let file_name = std::path::Path::new(&file_path)
            .file_name()
            .ok_or("Invalid file path")?
            .to_str()
            .ok_or("Invalid file name")?;

        let destination = resource_path.join(file_name);
        std::fs::copy(&file_path, &destination).map_err(|e| format!("Failed to copy file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_image(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {}", e))?;
    let mut cached = CACHED_IMAGES.lock().unwrap();
    cached.retain(|img| img.path != path);
    Ok(())
}

#[tauri::command]
pub fn set_current_image(path: String) -> Result<(), String> {
    let mut current = CURRENT_IMAGE.lock().map_err(|e| e.to_string())?;
    *current = Some(path);
    Ok(())
}

#[tauri::command]
pub fn get_current_image() -> Result<Option<String>, String> {
    let current = CURRENT_IMAGE.lock().map_err(|e| e.to_string())?;
    Ok(current.clone())
}

#[tauri::command]
pub fn clear_current_image() -> Result<(), String> {
    let mut current = CURRENT_IMAGE.lock().map_err(|e| e.to_string())?;
    *current = None;
    Ok(())
}

#[tauri::command]
pub async fn get_image_folders(app_handle: AppHandle) -> Result<Vec<String>, String> {
    let resource_path = app_handle
        .path()
        .resolve("resources/images", BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve path: {}", e))?;

    let folders = std::fs::read_dir(&resource_path)
        .map_err(|e| format!("Failed to read resource directory: {}", e))?;

    let mut folder_names = Vec::new();

    for folder in folders {
        let folder = folder.map_err(|e| format!("Failed to read folder entry: {}", e))?;
        if folder.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
            if let Some(folder_name) = folder.path().file_name() {
                if let Some(name) = folder_name.to_str() {
                    folder_names.push(name.to_string());
                }
            }
        }
    }

    Ok(folder_names)
}

#[tauri::command]
pub async fn delete_image_folder(app_handle: AppHandle, folder_name: String) -> Result<(), String> {
    let resource_path = app_handle
        .path()
        .resolve(format!("resources/images/{}", folder_name), BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve path: {}", e))?;

    if !resource_path.exists() {
        return Err(format!("Folder '{}' does not exist", folder_name));
    }

    std::fs::remove_dir_all(&resource_path)
        .map_err(|e| format!("Failed to delete folder: {}", e))?;

    let mut cached = CACHED_IMAGES.lock().unwrap();
    cached.retain(|img| !img.path.contains(&folder_name));

    Ok(())
}

#[tauri::command]
pub async fn create_image_folder(app_handle: AppHandle, folder_name: String) -> Result<(), String> {
    let resource_path = app_handle
        .path()
        .resolve(format!("resources/images/{}", folder_name), BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve path: {}", e))?;

    if !resource_path.exists() {
        std::fs::create_dir_all(&resource_path)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    Ok(())
}


