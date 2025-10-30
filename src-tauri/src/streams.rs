use lazy_static::lazy_static;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use xcap::Monitor;

use crate::displays::get_selected_displays;

lazy_static! {
    static ref VIDEO_STREAM: Mutex<Option<VideoStream>> = Mutex::new(None);
    static ref STREAM_STOPPED: Mutex<bool> = Mutex::new(false);
}

#[derive(Clone)]
struct VideoStream {
    is_recording: Arc<AtomicBool>,
    monitor_index: usize,
    monitor_x: i32,
    monitor_y: i32,
    video_recorder: Arc<Mutex<xcap::VideoRecorder>>,
}

impl VideoStream {
    fn new(monitor_index: usize, x: i32, y: i32, recorder: xcap::VideoRecorder) -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
            monitor_index,
            monitor_x: x,
            monitor_y: y,
            video_recorder: Arc::new(Mutex::new(recorder)),
        }
    }

    fn start_recording(&self, app: AppHandle) -> Result<(), String> {
        {
            let app_clone = app.clone();
            if let Ok(recorder_guard) = self.video_recorder.lock() {
                let result = recorder_guard.on_frame(move |frame| {
                    let _ = app_clone.emit("frame-update", (
                        frame.width,
                        frame.height,
                        frame.raw.clone()
                    ));
                    Ok(())
                });

                if let Err(e) = result {
                    return Err(format!("Failed to set frame callback: {}", e));
                }
            } else {
                return Err("Failed to lock video recorder".to_string());
            }
        }

        self.is_recording.store(true, Ordering::SeqCst);
        let video_recorder = self.video_recorder.clone();
        let is_recording = self.is_recording.clone();

        thread::spawn(move || {
            if let Ok(recorder_guard) = video_recorder.lock() {
                if let Ok(_) = recorder_guard.start() {
                    while is_recording.load(Ordering::SeqCst) {
                        thread::sleep(Duration::from_millis(16));
                    }
                }
            }
        });

        Ok(())
    }

    fn stop(&self) {
        self.is_recording.store(false, Ordering::SeqCst);
        if let Ok(recorder_guard) = self.video_recorder.lock() {
            let _ = recorder_guard.stop();
        }
    }
}

#[tauri::command]
pub async fn start_stream(app: AppHandle) -> Result<(), String> {
    fn setup_stream(app: &AppHandle) -> Result<VideoStream, String> {
        let selected_displays = get_selected_displays(app.clone())?;
        let target_display = selected_displays.get(0).copied().unwrap_or(0);

        let window = app.get_webview_window("main")
            .ok_or("Failed to get main window")?;

        let monitors = window.available_monitors()
            .map_err(|e| format!("Failed to get monitors: {}", e))?;

        let monitor = monitors.get(target_display)
            .ok_or_else(|| format!("Monitor {} not found", target_display))?;

        let position = monitor.position();

        let mut attempts = 0;
        let max_attempts = 5;

        while attempts < max_attempts {
            if let Ok(xcap_monitor) = Monitor::from_point(position.x, position.y) {
                if let Ok(recorder) = xcap_monitor.video_recorder() {
                    return Ok(VideoStream::new(
                        target_display,
                        position.x,
                        position.y,
                        recorder
                    ));
                }
            }

            if let Ok(monitors) = Monitor::all() {
                if let Some(xcap_monitor) = monitors.into_iter().nth(target_display) {
                    if let Ok(recorder) = xcap_monitor.video_recorder() {
                        return Ok(VideoStream::new(
                            target_display,
                            position.x,
                            position.y,
                            recorder
                        ));
                    }
                }
            }

            if let Ok(monitors) = Monitor::all() {
                for xcap_monitor in monitors {
                    if (xcap_monitor.x() as i32 - position.x).abs() < 300 &&
                       (xcap_monitor.y() as i32 - position.y).abs() < 300 {
                        if let Ok(recorder) = xcap_monitor.video_recorder() {
                            return Ok(VideoStream::new(
                                target_display,
                                xcap_monitor.x() as i32,
                                xcap_monitor.y() as i32,
                                recorder
                            ));
                        }
                    }
                }
            }

            attempts += 1;
            thread::sleep(Duration::from_millis(500));
        }

        *STREAM_STOPPED.lock().map_err(|e| format!("Mutex lock failed: {}", e))? = true;
        Err(String::new())
    }

    {
        let stream_stopped = STREAM_STOPPED.lock()
            .map_err(|e| e.to_string())?;
        if *stream_stopped {
            return Ok(());
        }
    }

    {
        let mut stream_stopped = STREAM_STOPPED.lock()
            .map_err(|e| e.to_string())?;
        *stream_stopped = false;
    }

    match setup_stream(&app) {
        Ok(new_stream) => {
            new_stream.start_recording(app.clone())?;
            {
                let mut stream = VIDEO_STREAM.lock()
                    .map_err(|e| e.to_string())?;
                *stream = Some(new_stream);
            }
            Ok(())
        },
        Err(e) if e.is_empty() => Ok(()),
        Err(e) => Err(e)
    }
}

#[tauri::command]
pub async fn stop_stream() -> Result<(), String> {
    {
        let mut stream_stopped = STREAM_STOPPED.lock().map_err(|e| e.to_string())?;
        *stream_stopped = true;
    }

    {
        let mut stream_guard = VIDEO_STREAM.lock().map_err(|e| e.to_string())?;
        if let Some(stream) = stream_guard.as_ref() {
            stream.stop();
            *stream_guard = None;
        }
    }

    Ok(())
}


