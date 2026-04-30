// WYRDLOOM Tauri 2.x shell. Capability allow-list lives in capabilities/default.json
// and intentionally excludes http/shell/process per BUILD_PROMPT §2.5.
//
// Anything wanting those would need an ADR in docs/adr/ first; the spec's anti-goal
// is "no telemetry / phone-home" so this is the one rule we never relax casually.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
