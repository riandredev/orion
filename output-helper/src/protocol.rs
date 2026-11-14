use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum Command {
    Configure { displays: Vec<DisplaySpec> },
    Stage { base: Option<SlideSpec>, overlay: Option<SlideSpec> },
    Hide,
    Quit,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplaySpec {
    pub id: i64,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlideSpec {
    #[serde(default)]
    pub animation: String,
    #[serde(default)]
    pub duration_ms: u32,
    #[serde(default)]
    pub image_path: String,
    #[serde(default = "default_contain")]
    pub fit: String,
    #[serde(default)]
    pub dim: f32,
    #[serde(default = "default_black")]
    pub color: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub lines: Vec<String>,
    #[serde(default)]
    pub footer: String,
    #[serde(default = "default_highlight")]
    pub highlight: i32,
}

fn default_contain() -> String {
    "contain".into()
}
fn default_black() -> String {
    "#000000".into()
}
fn default_highlight() -> i32 {
    -1
}

impl SlideSpec {
    pub fn content_key(&self) -> String {
        format!(
            "{}|{}|{}|{}|{}|{}|{}|{}",
            self.image_path,
            self.fit,
            self.dim,
            self.color,
            self.title,
            self.lines.join("\n"),
            self.footer,
            self.highlight
        )
    }
}

pub fn parse_color(text: &str) -> [u8; 3] {
    let hex = text.trim().trim_start_matches('#');
    if hex.len() == 6 {
        if let (Ok(r), Ok(g), Ok(b)) = (
            u8::from_str_radix(&hex[0..2], 16),
            u8::from_str_radix(&hex[2..4], 16),
            u8::from_str_radix(&hex[4..6], 16),
        ) {
            return [r, g, b];
        }
    }
    [0, 0, 0]
}

/// Motion index consumed by the transition shader.
pub fn motion_kind(name: &str) -> u32 {
    match name {
        "crossfade" => 1,
        "fade" => 2,
        "wipe" => 3,
        "push" => 4,
        "cover" => 5,
        "uncover" => 6,
        "split" => 7,
        "zoom" => 8,
        "iris" => 9,
        "bars" => 10,
        "pixels" => 11,
        _ => 0,
    }
}
