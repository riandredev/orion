use tauri::{AppHandle, Manager, Emitter};
use crate::db;

#[tauri::command]
pub fn display_hymn(
    app: AppHandle,
    language: String,
    hymn_type: String,
    hymn_number: String,
) -> Result<(), String> {
    // Get the hymns from the database
    let hymns = db::get_hymns_by_language(&language, &hymn_type)
        .map_err(|e| format!("Failed to get hymns: {}", e))?;
    
    // Find the hymn with the matching number
    let hymn = hymns.into_iter()
        .find(|h| h.number.to_string() == hymn_number);
    
    if let Some(hymn) = hymn {
        // Emit an event to the frontend to display the hymn
        app.emit("display-hymn", hymn.clone())
            .map_err(|e| format!("Failed to emit display-hymn event: {}", e))?;
        Ok(())
    } else {
        Err(format!("Hymn {} not found", hymn_number))
    }
}
