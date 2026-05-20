//! 24-hour hourly forecast over Cambodia's 0.25° grid, from Open-Meteo.
//!
//! The grid coordinates are pulled from `cambodia_grid::CAMBODIA_GRID`, an
//! auto-generated array kept in lock-step with the renderer's TS copy via
//! `scripts/build-grid.mjs`. Open-Meteo accepts the same comma-separated
//! lat/lon format we use for the provincial-capitals fetch — see
//! `provincial_capitals.rs` for the analogous shape.
//!
//! The response is returned verbatim. The renderer parses each location's
//! `hourly.weather_code`, `hourly.precipitation`, and
//! `hourly.precipitation_probability` arrays and computes the dominant
//! condition per user-selected window (3/6/12/24h) client-side.

use std::time::Duration;

use crate::cambodia_grid::CAMBODIA_GRID;
use crate::http::{describe_fetch_error, HTTP_CLIENT};

const SERVICE_NAME: &str = "Open-Meteo";
const FORECAST_URL: &str = "https://api.open-meteo.com/v1/forecast";
/// Per-request timeout for the grid call. The shared client's 15 s default
/// is fine for the capitals request (~150 ms) but the grid is ~290 points
/// with 24h of hourly data and routinely takes 15-20 s server-side.
const GRID_REQUEST_TIMEOUT: Duration = Duration::from_secs(60);

const HOURLY_FIELDS: &str = "weather_code,precipitation,precipitation_probability";
/// Width of the response in hours. The renderer slices [0, N) for the
/// active window (N ∈ {3, 6, 12, 24}); requesting all 24 lets us switch
/// windows without refetching.
const FORECAST_HOURS: &str = "24";

fn join_coords() -> (String, String) {
    let mut lats = String::with_capacity(CAMBODIA_GRID.len() * 8);
    let mut lons = String::with_capacity(CAMBODIA_GRID.len() * 8);
    for (i, (lat, lon)) in CAMBODIA_GRID.iter().enumerate() {
        if i > 0 {
            lats.push(',');
            lons.push(',');
        }
        lats.push_str(&format!("{:.2}", lat));
        lons.push_str(&format!("{:.2}", lon));
    }
    (lats, lons)
}

/// Fetches 24-hour hourly forecast for every Cambodia grid point and
/// returns the Open-Meteo response body unparsed.
#[tauri::command]
pub async fn get_forecast_grid() -> Result<String, String> {
    let (latitudes, longitudes) = join_coords();

    let response = HTTP_CLIENT
        .get(FORECAST_URL)
        .timeout(GRID_REQUEST_TIMEOUT)
        .query(&[
            ("latitude", latitudes.as_str()),
            ("longitude", longitudes.as_str()),
            ("hourly", HOURLY_FIELDS),
            ("forecast_hours", FORECAST_HOURS),
            ("timezone", "Asia/Phnom_Penh"),
            ("temperature_unit", "celsius"),
            ("wind_speed_unit", "kmh"),
            ("precipitation_unit", "mm"),
        ])
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .await
        .map_err(|err| describe_fetch_error(SERVICE_NAME, err))?;

    if !response.status().is_success() {
        return Err(format!(
            "Open-Meteo returned HTTP {}",
            response.status().as_u16()
        ));
    }

    response
        .text()
        .await
        .map_err(|err| describe_fetch_error(SERVICE_NAME, err))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn join_coords_pair_count_matches_grid_length() {
        let (lats, lons) = join_coords();
        let lat_parts: Vec<&str> = lats.split(',').collect();
        let lon_parts: Vec<&str> = lons.split(',').collect();
        assert_eq!(lat_parts.len(), CAMBODIA_GRID.len());
        assert_eq!(lon_parts.len(), CAMBODIA_GRID.len());
        // Spot-check: first grid point matches the source.
        let (lat0, lon0) = CAMBODIA_GRID[0];
        assert_eq!(lat_parts[0], format!("{:.2}", lat0));
        assert_eq!(lon_parts[0], format!("{:.2}", lon0));
    }

    /// Live smoke test against api.open-meteo.com. Ignored by default since
    /// it needs network access; run with `cargo test -- --ignored`.
    /// Open-Meteo's free tier rate-limits multi-point requests above ~600
    /// locations; we're at 289 which comfortably fits in one call.
    #[tokio::test]
    #[ignore = "hits the live Open-Meteo API"]
    async fn live_fetch_returns_all_grid_points() {
        let body = get_forecast_grid()
            .await
            .expect("forecast-grid fetch succeeds");

        let parsed: serde_json::Value =
            serde_json::from_str(&body).expect("response body parses as JSON");
        let entries = parsed
            .as_array()
            .expect("Open-Meteo returns an array for multi-location requests");

        assert_eq!(
            entries.len(),
            CAMBODIA_GRID.len(),
            "expected one entry per grid point"
        );

        let first = &entries[0];
        let hourly = first.get("hourly").expect("entry has an `hourly` block");
        let codes = hourly
            .get("weather_code")
            .and_then(|v| v.as_array())
            .expect("hourly.weather_code is an array");
        assert_eq!(codes.len(), 24, "expected 24 hourly weather codes");
        let precip = hourly
            .get("precipitation")
            .and_then(|v| v.as_array())
            .expect("hourly.precipitation is an array");
        assert_eq!(precip.len(), 24);
        let probs = hourly
            .get("precipitation_probability")
            .and_then(|v| v.as_array())
            .expect("hourly.precipitation_probability is an array");
        assert_eq!(probs.len(), 24);
    }
}
