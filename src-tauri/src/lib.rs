// WYRDLOOM Tauri 2.x app entry. Lifted out of main.rs so the same builder
// can be invoked from desktop (main.rs) and, eventually, mobile bindings.
//
// Capability allow-list lives in capabilities/default.json and intentionally
// excludes http/shell/process per BUILD_PROMPT §2.5.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
