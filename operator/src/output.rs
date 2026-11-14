use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};

use serde_json::json;

#[derive(Clone)]
pub struct DisplaySpec {
    pub id: i64,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub primary: bool,
}

pub struct Output {
    child: Option<Child>,
}

impl Output {
    pub fn new() -> Self {
        Self { child: None }
    }

    pub fn project_image(&mut self, path: &str) -> Result<(), String> {
        let displays = output_displays();
        if displays.is_empty() {
            return Err("No display found.".into());
        }
        self.send(&json!({
            "op": "configure",
            "displays": displays
                .iter()
                .map(|display| json!({
                    "id": display.id,
                    "x": display.x,
                    "y": display.y,
                    "width": display.width,
                    "height": display.height,
                    "topmost": !display.primary
                }))
                .collect::<Vec<_>>()
        }))?;
        self.send(&json!({
            "op": "stage",
            "base": {
                "animation": "cut",
                "durationMs": 0,
                "imagePath": path,
                "fit": "contain",
                "dim": 0,
                "color": "#000000",
                "title": "",
                "lines": [],
                "footer": "",
                "highlight": -1
            },
            "overlay": null
        }))
    }

    pub fn hide(&mut self) {
        let _ = self.send(&json!({ "op": "hide" }));
        self.child = None;
    }

    pub fn shutdown(&mut self) {
        if self.child.is_none() {
            return;
        }
        let _ = self.send(&json!({ "op": "quit" }));
        if let Some(child) = self.child.as_mut() {
            let _ = child.wait();
        }
        self.child = None;
    }

    fn send(&mut self, message: &serde_json::Value) -> Result<(), String> {
        let child = self.ensure()?;
        let stdin = child.stdin.as_mut().ok_or("Projector has no input.")?;
        writeln!(stdin, "{message}").map_err(|error| format!("Projector write failed: {error}"))?;
        let _ = stdin.flush();
        Ok(())
    }

    fn ensure(&mut self) -> Result<&mut Child, String> {
        let running = self
            .child
            .as_mut()
            .is_some_and(|child| child.try_wait().ok().flatten().is_none());
        if !running {
            self.child = Some(spawn_helper()?);
        }
        Ok(self.child.as_mut().unwrap())
    }
}

impl Drop for Output {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn spawn_helper() -> Result<Child, String> {
    let path = helper_path().ok_or("orion-output.exe was not found. Build the projector first.")?;
    let mut command = Command::new(path);
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    command
        .spawn()
        .map_err(|error| format!("Could not start the projector: {error}"))
}

fn helper_path() -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("ORION_OUTPUT_HELPER") {
        let path = PathBuf::from(path);
        if path.is_file() {
            return Some(path);
        }
    }
    let mut candidates = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("orion-output.exe"));
            candidates.push(dir.join("..").join("..").join("output-helper").join("target").join("release").join("orion-output.exe"));
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("output-helper").join("target").join("release").join("orion-output.exe"));
    }
    candidates.into_iter().find(|path| path.is_file())
}

fn output_displays() -> Vec<DisplaySpec> {
    let all = monitors();
    let external: Vec<_> = all.iter().filter(|display| !display.primary).cloned().collect();
    if external.is_empty() { all } else { external }
}

fn monitors() -> Vec<DisplaySpec> {
    let mut list = Vec::new();
    unsafe {
        let _ = windows::Win32::Graphics::Gdi::EnumDisplayMonitors(
            None,
            None,
            Some(enum_monitor),
            windows::Win32::Foundation::LPARAM(&mut list as *mut Vec<DisplaySpec> as isize),
        );
    }
    if list.is_empty() {
        list.push(DisplaySpec {
            id: 1,
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            primary: true,
        });
    }
    list
}

unsafe extern "system" fn enum_monitor(
    monitor: windows::Win32::Graphics::Gdi::HMONITOR,
    _: windows::Win32::Graphics::Gdi::HDC,
    _: *mut windows::Win32::Foundation::RECT,
    data: windows::Win32::Foundation::LPARAM,
) -> windows::core::BOOL {
    let list = unsafe { &mut *(data.0 as *mut Vec<DisplaySpec>) };
    let mut info = windows::Win32::Graphics::Gdi::MONITORINFO {
        cbSize: std::mem::size_of::<windows::Win32::Graphics::Gdi::MONITORINFO>() as u32,
        ..unsafe { std::mem::zeroed() }
    };
    if unsafe { windows::Win32::Graphics::Gdi::GetMonitorInfoW(monitor, &mut info) }.as_bool() {
        let rect = info.rcMonitor;
        let id = (list.len() + 1) as i64;
        list.push(DisplaySpec {
            id,
            x: rect.left,
            y: rect.top,
            width: rect.right.saturating_sub(rect.left).max(1) as u32,
            height: rect.bottom.saturating_sub(rect.top).max(1) as u32,
            primary: info.dwFlags & 1 != 0,
        });
    }
    windows::core::BOOL(1)
}
