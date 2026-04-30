// Desktop entry. Mobile binds elsewhere via the #[mobile_entry_point] in lib.rs.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    wyrdloom_lib::run();
}
