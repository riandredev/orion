#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod order;
mod output;

use std::cell::RefCell;
use std::rc::Rc;

use slint::{Image, ModelRc, Rgba8Pixel, SharedPixelBuffer, VecModel};

use order::{list_folders, list_images, order_root, OrderImage};
use output::Output;

slint::include_modules!();

struct Desk {
    root: std::path::PathBuf,
    folders: Vec<order::Folder>,
    images: Vec<OrderImage>,
    folder_index: usize,
    image_index: usize,
    output: Output,
}

fn main() {
    let ui = AppWindow::new().unwrap();
    let desk = Rc::new(RefCell::new(Desk {
        root: order_root(),
        folders: Vec::new(),
        images: Vec::new(),
        folder_index: 0,
        image_index: 0,
        output: Output::new(),
    }));
    reload_folders(&ui, &desk);

    let ui_folder = ui.as_weak();
    let desk_folder = desk.clone();
    ui.on_select_folder(move |index| {
        let Some(ui) = ui_folder.upgrade() else { return };
        select_folder(&ui, &desk_folder, index as usize);
    });

    let desk_image = desk.clone();
    let ui_image = ui.as_weak();
    ui.on_select_image(move |index| {
        let Some(ui) = ui_image.upgrade() else { return };
        {
            let mut desk = desk_image.borrow_mut();
            if desk.images.is_empty() {
                return;
            }
            desk.image_index = (index as usize).min(desk.images.len() - 1);
        }
        show_images(&ui, &desk_image);
    });

    let ui_tab = ui.as_weak();
    ui.on_select_tab(move |index| {
        let Some(ui) = ui_tab.upgrade() else { return };
        ui.set_tab(index);
    });

    let ui_project = ui.as_weak();
    let desk_project = desk.clone();
    ui.on_project(move || {
        let Some(ui) = ui_project.upgrade() else { return };
        project_selected(&ui, &desk_project);
    });

    let ui_clear = ui.as_weak();
    let desk_clear = desk.clone();
    ui.on_clear_output(move || {
        let Some(ui) = ui_clear.upgrade() else { return };
        desk_clear.borrow_mut().output.hide();
        ui.set_status("Output cleared".into());
    });

    let ui_prev = ui.as_weak();
    let desk_prev = desk.clone();
    ui.on_previous_image(move || {
        let Some(ui) = ui_prev.upgrade() else { return };
        step(&ui, &desk_prev, -1);
    });

    let ui_next = ui.as_weak();
    let desk_next = desk.clone();
    ui.on_next_image(move || {
        let Some(ui) = ui_next.upgrade() else { return };
        step(&ui, &desk_next, 1);
    });

    ui.run().unwrap();
    desk.borrow_mut().output.shutdown();
}

fn reload_folders(ui: &AppWindow, desk: &Rc<RefCell<Desk>>) {
    let root = desk.borrow().root.clone();
    let folders = list_folders(&root);
    desk.borrow_mut().folders = folders;
    desk.borrow_mut().folder_index = 0;
    publish_folders(ui, desk);
    select_folder(ui, desk, 0);
}

fn publish_folders(ui: &AppWindow, desk: &Rc<RefCell<Desk>>) {
    let desk = desk.borrow();
    let items: Vec<FolderItem> = desk
        .folders
        .iter()
        .enumerate()
        .map(|(index, folder)| FolderItem {
            name: folder.name.clone().into(),
            count: folder.count.to_string().into(),
            selected: index == desk.folder_index,
        })
        .collect();
    ui.set_folders(ModelRc::new(VecModel::from(items)));
}

fn select_folder(ui: &AppWindow, desk: &Rc<RefCell<Desk>>, index: usize) {
    let images = {
        let mut desk = desk.borrow_mut();
        if desk.folders.is_empty() {
            desk.images.clear();
            desk.image_index = 0;
            Vec::new()
        } else {
            desk.folder_index = index.min(desk.folders.len() - 1);
            let name = desk.folders[desk.folder_index].name.clone();
            let images = list_images(&desk.root.join(name));
            desk.image_index = 0;
            desk.images = images.clone();
            images
        }
    };
    publish_folders(ui, desk);
    if images.is_empty() {
        ui.set_rows(ModelRc::new(VecModel::from(Vec::<ThumbRow>::new())));
        ui.set_status("No images in this folder.".into());
        return;
    }
    show_images(ui, desk);
    ui.set_status(format!("{} images", images.len()).into());
}

fn show_images(ui: &AppWindow, desk: &Rc<RefCell<Desk>>) {
    let desk = desk.borrow();
    let mut rows = Vec::new();
    for chunk in desk.images.chunks(4) {
        let mut thumbs = chunk
            .iter()
            .enumerate()
            .map(|(offset, image)| {
                let index = rows.len() * 4 + offset;
                thumb_item(image, index == desk.image_index)
            })
            .collect::<Vec<_>>();
        while thumbs.len() < 4 {
            thumbs.push(empty_thumb());
        }
        rows.push(ThumbRow {
            a: thumbs[0].clone(),
            b: thumbs[1].clone(),
            c: thumbs[2].clone(),
            d: thumbs[3].clone(),
        });
    }
    ui.set_rows(ModelRc::new(VecModel::from(rows)));
}

fn thumb_item(image: &OrderImage, selected: bool) -> Thumb {
    let source = order::decode_thumb(&image.path, 180)
        .map(|(width, height, pixels)| image_from_rgba(width, height, &pixels))
        .unwrap_or_else(blank_image);
    Thumb {
        source,
        name: image.name.clone().into(),
        selected,
        visible: true,
    }
}

fn empty_thumb() -> Thumb {
    Thumb {
        source: blank_image(),
        name: String::new().into(),
        selected: false,
        visible: false,
    }
}

fn project_selected(ui: &AppWindow, desk: &Rc<RefCell<Desk>>) {
    let path = {
        let desk = desk.borrow();
        desk.images
            .get(desk.image_index)
            .map(|image| image.path.display().to_string())
    };
    let Some(path) = path else {
        ui.set_status("Select an image first.".into());
        return;
    };
    match desk.borrow_mut().output.project_image(&path) {
        Ok(()) => ui.set_status(format!("Showing {path}").into()),
        Err(error) => ui.set_status(error.into()),
    }
}

fn step(ui: &AppWindow, desk: &Rc<RefCell<Desk>>, delta: isize) {
    let should_project = {
        let mut desk = desk.borrow_mut();
        if desk.images.is_empty() {
            return;
        }
        let last = desk.images.len() as isize - 1;
        let next = (desk.image_index as isize + delta).clamp(0, last) as usize;
        if next == desk.image_index {
            return;
        }
        desk.image_index = next;
        true
    };
    show_images(ui, desk);
    if should_project {
        project_selected(ui, desk);
    }
}

fn image_from_rgba(width: u32, height: u32, pixels: &[u8]) -> Image {
    let mut buffer = SharedPixelBuffer::<Rgba8Pixel>::new(width, height);
    let dest = buffer.make_mut_slice();
    let bytes = unsafe {
        std::slice::from_raw_parts_mut(dest.as_mut_ptr() as *mut u8, pixels.len())
    };
    bytes.copy_from_slice(pixels);
    Image::from_rgba8(buffer)
}

fn blank_image() -> Image {
    Image::from_rgba8(SharedPixelBuffer::<Rgba8Pixel>::new(1, 1))
}
