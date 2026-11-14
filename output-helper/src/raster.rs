use std::collections::HashMap;
use std::path::Path;

use fontdue::Font;
use image::{imageops, Rgba, RgbaImage};

use crate::protocol::{parse_color, SlideSpec};

pub struct Fonts {
    faces: HashMap<String, Font>,
    fallback: String,
}

impl Fonts {
    pub fn load() -> Option<Self> {
        let mut faces = HashMap::new();
        let files: &[(&str, &[&str])] = &[
            ("arial-narrow", &[r"C:\Windows\Fonts\ARIALN.TTF", r"C:\Windows\Fonts\arialn.ttf", r"C:\Windows\Fonts\arial.ttf"]),
            ("arial", &[r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\Arial.ttf"]),
            ("calibri", &[r"C:\Windows\Fonts\calibri.ttf", r"C:\Windows\Fonts\arial.ttf"]),
            ("cambria", &[r"C:\Windows\Fonts\cambria.ttf", r"C:\Windows\Fonts\georgia.ttf"]),
            ("georgia", &[r"C:\Windows\Fonts\georgia.ttf", r"C:\Windows\Fonts\times.ttf"]),
            ("segoe", &[r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\arial.ttf"]),
            ("tahoma", &[r"C:\Windows\Fonts\tahoma.ttf", r"C:\Windows\Fonts\arial.ttf"]),
            ("times", &[r"C:\Windows\Fonts\times.ttf", r"C:\Windows\Fonts\georgia.ttf"]),
            ("verdana", &[r"C:\Windows\Fonts\verdana.ttf", r"C:\Windows\Fonts\arial.ttf"]),
            ("palatino", &[r"C:\Windows\Fonts\pala.ttf", r"C:\Windows\Fonts\PALA.TTF", r"C:\Windows\Fonts\georgia.ttf"]),
        ];
        for (id, paths) in files {
            if let Some(font) = load_file_font(paths) {
                faces.insert((*id).to_string(), font);
            }
        }
        if let Some(font) = load_bytes(include_bytes!("../fonts/EBGaramond-Regular.ttf")) {
            faces.insert("garamond".into(), font);
        }
        if let Some(font) = load_bytes(include_bytes!("../fonts/Cantarell-Regular.ttf")) {
            faces.insert("cantarell".into(), font);
        }
        let fallback = ["segoe", "arial", "garamond", "cantarell"]
            .into_iter()
            .find(|id| faces.contains_key(*id))
            .map(str::to_string)
            .or_else(|| faces.keys().next().cloned())?;
        eprintln!("orion-output: loaded {} text fonts", faces.len());
        Some(Self { faces, fallback })
    }

    fn face<'a>(&'a self, id: &str) -> &'a Font {
        self.faces.get(id).or_else(|| self.faces.get(&self.fallback)).unwrap()
    }
}

fn load_bytes(bytes: &[u8]) -> Option<Font> {
    Font::from_bytes(bytes, fontdue::FontSettings::default()).ok()
}

fn load_file_font(paths: &[&str]) -> Option<Font> {
    for path in paths {
        let Ok(bytes) = std::fs::read(path) else { continue };
        if let Ok(font) = Font::from_bytes(bytes, fontdue::FontSettings::default()) {
            return Some(font);
        }
    }
    None
}

pub struct SlideBitmap {
    pub image: RgbaImage,
    pub aspect: f32,
    pub framed: bool,
}

pub fn raster_slide(spec: &SlideSpec, width: u32, height: u32, fonts: Option<&Fonts>) -> SlideBitmap {
    let has_text = fonts.is_some()
        && (!spec.title.is_empty() || !spec.lines.is_empty() || !spec.footer.is_empty());
    if !has_text {
        if let Some(photo) = load_photo(spec, width, height) {
            return photo;
        }
    }
    let width = width.min(1920).max(1);
    let height = height.min(1080).max(1);
    let [r, g, b] = parse_color(&spec.color);
    let mut canvas = RgbaImage::from_pixel(width, height, Rgba([r, g, b, 255]));
    if !spec.image_path.is_empty() {
        blit_image(&mut canvas, Path::new(&spec.image_path), &spec.fit, spec.dim);
    }
    if let Some(fonts) = fonts {
        if !spec.title.is_empty() || !spec.lines.is_empty() || !spec.footer.is_empty() {
            draw_text(&mut canvas, fonts, spec);
        }
    }
    SlideBitmap {
        aspect: width as f32 / height.max(1) as f32,
        framed: true,
        image: canvas,
    }
}

fn load_photo(spec: &SlideSpec, max_w: u32, max_h: u32) -> Option<SlideBitmap> {
    if spec.image_path.is_empty() {
        return None;
    }
    let opened = image::open(Path::new(&spec.image_path)).ok()?;
    let src = opened.to_rgba8();
    let (sw, sh) = src.dimensions();
    if sw == 0 || sh == 0 {
        return None;
    }
    let cap_w = max_w.min(1920).max(1);
    let cap_h = max_h.min(1080).max(1);
    let scale = (cap_w as f32 / sw as f32).min(cap_h as f32 / sh as f32).min(1.0);
    let tw = ((sw as f32 * scale).round() as u32).max(1);
    let th = ((sh as f32 * scale).round() as u32).max(1);
    let mut image = if tw == sw && th == sh {
        src
    } else {
        imageops::resize(&src, tw, th, imageops::FilterType::Triangle)
    };
    let keep = 1.0 - spec.dim.clamp(0.0, 0.95);
    if keep < 0.999 {
        for pixel in image.pixels_mut() {
            pixel[0] = (pixel[0] as f32 * keep) as u8;
            pixel[1] = (pixel[1] as f32 * keep) as u8;
            pixel[2] = (pixel[2] as f32 * keep) as u8;
        }
    }
    Some(SlideBitmap {
        aspect: tw as f32 / th as f32,
        framed: false,
        image,
    })
}

fn blit_image(canvas: &mut RgbaImage, path: &Path, fit: &str, dim: f32) {
    let Ok(opened) = image::open(path) else {
        eprintln!("orion-output: could not read {}", path.display());
        return;
    };
    let src = opened.to_rgba8();
    let (cw, ch) = canvas.dimensions();
    let (sw, sh) = src.dimensions();
    if sw == 0 || sh == 0 || cw == 0 || ch == 0 {
        return;
    }
    let cover = fit == "cover";
    let scale = if cover {
        (cw as f32 / sw as f32).max(ch as f32 / sh as f32)
    } else {
        (cw as f32 / sw as f32).min(ch as f32 / sh as f32)
    };
    let tw = ((sw as f32 * scale).round() as u32).max(1);
    let th = ((sh as f32 * scale).round() as u32).max(1);
    let resized = imageops::resize(&src, tw, th, imageops::FilterType::Triangle);
    let dim = dim.clamp(0.0, 0.95);
    let keep = 1.0 - dim;
    let ox = (cw as i32 - tw as i32) / 2;
    let oy = (ch as i32 - th as i32) / 2;
    for y in 0..th {
        for x in 0..tw {
            let dx = ox + x as i32;
            let dy = oy + y as i32;
            if dx < 0 || dy < 0 || dx >= cw as i32 || dy >= ch as i32 {
                continue;
            }
            let p = resized.get_pixel(x, y);
            canvas.put_pixel(
                dx as u32,
                dy as u32,
                Rgba([
                    (p[0] as f32 * keep) as u8,
                    (p[1] as f32 * keep) as u8,
                    (p[2] as f32 * keep) as u8,
                    255,
                ]),
            );
        }
    }
}

fn draw_text(canvas: &mut RgbaImage, fonts: &Fonts, spec: &SlideSpec) {
    let (width, height) = canvas.dimensions();
    let body_font = fonts.face(if spec.body_font.is_empty() { "arial-narrow" } else { &spec.body_font });
    let title_font = fonts.face(if spec.title_font.is_empty() { &spec.body_font } else { &spec.title_font });
    let footer_font = fonts.face(if spec.footer_font.is_empty() { &spec.body_font } else { &spec.footer_font });
    let title_px = if spec.title_px > 0.0 { spec.title_px } else { (height as f32 * 0.045).clamp(18.0, 72.0) };
    let footer_px = if spec.footer_px > 0.0 { spec.footer_px } else { (height as f32 * 0.032).clamp(16.0, 42.0) };
    let wanted = if spec.body_px > 0.0 { spec.body_px } else { height as f32 * 0.08 };
    let body_px = fit_body_px(body_font, &spec.lines, width, height, wanted);
    let max_w = (width as f32 * 0.86) as i32;
    let wrapped = wrap_lines(body_font, &spec.lines, body_px, max_w);
    let line_gap = (body_px * 0.28) as i32;
    let body_h = wrapped.len() as i32 * (body_px as i32 + line_gap);
    let mut y = ((height as i32 - body_h) / 2).max(title_px as i32 + 24);
    let body_color = paint_color(&spec.body_color);
    if !spec.title.is_empty() {
        blit_line(canvas, title_font, &spec.title, title_px, (height as f32 * 0.08) as i32, paint_color(&spec.title_color), false);
    }
    for (index, line) in wrapped.iter().enumerate() {
        let highlight = spec.highlight == index as i32;
        blit_line(canvas, body_font, line, body_px, y, body_color, highlight);
        y += body_px as i32 + line_gap;
    }
    if !spec.footer.is_empty() {
        blit_line(
            canvas,
            footer_font,
            &spec.footer,
            footer_px,
            height as i32 - (height as f32 * 0.08) as i32,
            paint_color(&spec.footer_color),
            false,
        );
    }
}

fn paint_color(value: &str) -> [u8; 3] {
    if value.trim().is_empty() { [255, 255, 255] } else { parse_color(value) }
}

fn fit_body_px(font: &Font, lines: &[String], width: u32, height: u32, max_px: f32) -> f32 {
    let max_w = (width as f32 * 0.86) as i32;
    let max_h = height as f32 * 0.62;
    let mut px = max_px.max(28.0);
    for _ in 0..14 {
        let wrapped = wrap_lines(font, lines, px, max_w);
        let gap = px * 0.28;
        let block = wrapped.len() as f32 * (px + gap);
        let too_wide = wrapped.iter().any(|line| measure(font, line, px) > max_w);
        if !too_wide && block <= max_h {
            return px;
        }
        px = (px * 0.88).max(22.0);
        if px <= 22.0 {
            return px;
        }
    }
    px
}

fn wrap_lines(font: &Font, lines: &[String], px: f32, max_w: i32) -> Vec<String> {
    let mut out = Vec::new();
    for line in lines {
        let words: Vec<&str> = line.split_whitespace().collect();
        if words.is_empty() {
            out.push(String::new());
            continue;
        }
        let mut current = String::new();
        for word in words {
            let trial = if current.is_empty() {
                word.to_string()
            } else {
                format!("{current} {word}")
            };
            if measure(font, &trial, px) > max_w && !current.is_empty() {
                out.push(current);
                current = word.to_string();
            } else {
                current = trial;
            }
        }
        if !current.is_empty() {
            out.push(current);
        }
    }
    out
}

fn measure(font: &Font, text: &str, px: f32) -> i32 {
    text.chars()
        .map(|ch| font.metrics(ch, px).advance_width)
        .sum::<f32>() as i32
}

fn blit_line(canvas: &mut RgbaImage, font: &Font, text: &str, px: f32, baseline: i32, color: [u8; 3], highlight: bool) {
    let width = measure(font, text, px);
    let mut pen = (canvas.width() as i32 - width) / 2;
    let shadow = if highlight { 4 } else { 3 };
    for ch in text.chars() {
        let (metrics, bitmap) = font.rasterize(ch, px);
        stamp(canvas, &bitmap, metrics.width, metrics.height, pen + metrics.xmin, baseline - metrics.ymin - metrics.height as i32, [0, 0, 0], shadow, true);
        pen += metrics.advance_width as i32;
    }
    pen = (canvas.width() as i32 - width) / 2;
    for ch in text.chars() {
        let (metrics, bitmap) = font.rasterize(ch, px);
        stamp(canvas, &bitmap, metrics.width, metrics.height, pen + metrics.xmin, baseline - metrics.ymin - metrics.height as i32, color, 0, false);
        pen += metrics.advance_width as i32;
    }
}

fn stamp(
    canvas: &mut RgbaImage,
    bitmap: &[u8],
    gw: usize,
    gh: usize,
    origin_x: i32,
    origin_y: i32,
    color: [u8; 3],
    spread: i32,
    solid: bool,
) {
    let (cw, ch) = canvas.dimensions();
    for oy in -spread..=spread {
        for ox in -spread..=spread {
            if !solid && spread > 0 && ox == 0 && oy == 0 {
                continue;
            }
            for row in 0..gh {
                for col in 0..gw {
                    let coverage = bitmap[row * gw + col];
                    if coverage == 0 {
                        continue;
                    }
                    let x = origin_x + ox + col as i32;
                    let y = origin_y + oy + row as i32;
                    if x < 0 || y < 0 || x >= cw as i32 || y >= ch as i32 {
                        continue;
                    }
                    let dst = canvas.get_pixel(x as u32, y as u32);
                    let a = coverage as f32 / 255.0;
                    let mix = |s: u8, d: u8| (s as f32 * a + d as f32 * (1.0 - a)) as u8;
                    canvas.put_pixel(
                        x as u32,
                        y as u32,
                        Rgba([mix(color[0], dst[0]), mix(color[1], dst[1]), mix(color[2], dst[2]), 255]),
                    );
                }
            }
        }
    }
}
