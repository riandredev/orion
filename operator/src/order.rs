use std::fs;
use std::path::{Path, PathBuf};

const IMAGE_EXT: &[&str] = &["png", "jpg", "jpeg", "gif", "webp"];

#[derive(Clone)]
pub struct Folder {
    pub name: String,
    pub count: usize,
}

#[derive(Clone)]
pub struct OrderImage {
    pub name: String,
    pub path: PathBuf,
}

pub fn order_root() -> PathBuf {
    if let Some(path) = std::env::var_os("ORION_ORDER_IMAGES") {
        return PathBuf::from(path);
    }
    let installed = std::env::var_os("APPDATA").map(|root| {
        PathBuf::from(root)
            .join("orion")
            .join("order-images")
    });
    let cwd = std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("order-images");
    if installed.as_ref().is_some_and(|path| has_folders(path)) {
        return installed.unwrap();
    }
    if has_folders(&cwd) {
        return cwd;
    }
    installed.unwrap_or(cwd)
}

pub fn list_folders(root: &Path) -> Vec<Folder> {
    let mut folders = Vec::new();
    let entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(_) => return folders,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        folders.push(Folder {
            count: list_images(&path).len(),
            name,
        });
    }
    folders.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    folders
}

pub fn list_images(folder: &Path) -> Vec<OrderImage> {
    let mut images = Vec::new();
    let entries = match fs::read_dir(folder) {
        Ok(entries) => entries,
        Err(_) => return images,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() || !is_image(&path) {
            continue;
        }
        images.push(OrderImage {
            name: entry.file_name().to_string_lossy().into_owned(),
            path,
        });
    }
    images.sort_by(|a, b| compare_names(&a.name, &b.name));
    images
}

pub fn decode_thumb(path: &Path, max_edge: u32) -> Option<(u32, u32, Vec<u8>)> {
    let image = image::open(path).ok()?;
    let thumb = image.thumbnail(max_edge, max_edge);
    let rgba = thumb.to_rgba8();
    Some((rgba.width(), rgba.height(), rgba.into_raw()))
}

fn has_folders(path: &Path) -> bool {
    fs::read_dir(path)
        .ok()
        .into_iter()
        .flatten()
        .flatten()
        .any(|entry| entry.path().is_dir())
}

fn is_image(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| IMAGE_EXT.contains(&ext.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn compare_names(left: &str, right: &str) -> std::cmp::Ordering {
    left.to_lowercase().cmp(&right.to_lowercase())
}
