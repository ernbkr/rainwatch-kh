//! Tauri application entry point.
//!
//! Exposes a narrow command API to the renderer. The renderer keeps all
//! playback, scheduling, and UI logic; Rust owns source fetching, radar-frame
//! parsing, and HTTP egress (see `radar.rs`).

mod cambodia_grid;
mod domains;
mod forecast_grid;
mod http;
mod provincial_capitals;
mod radar;

use serde::Serialize;

/// CLI flags that enable the calibration panel. Ported from `src/flags.js`.
const CALIBRATION_FLAGS: [&str; 2] = ["--calibrate", "--debug-positioning"];

/// Runtime configuration. Serializes to the renderer's `RuntimeConfig` shape.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeConfig {
    calibration_enabled: bool,
}

/// Whether a calibration flag was passed on the command line.
fn is_calibration_enabled() -> bool {
    std::env::args().any(|arg| CALIBRATION_FLAGS.contains(&arg.as_str()))
}

/// Returns the frozen runtime configuration derived from process arguments.
#[tauri::command]
fn get_runtime_config() -> RuntimeConfig {
    RuntimeConfig {
        calibration_enabled: is_calibration_enabled(),
    }
}

/// Closes the application.
#[tauri::command]
fn quit(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            radar::get_radar_frames,
            radar::get_radar_image,
            provincial_capitals::get_provincial_capitals,
            forecast_grid::get_forecast_grid,
            get_runtime_config,
            quit,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Rainwatch KH");
}
