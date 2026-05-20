//! Current weather for Cambodia's 25 provincial capitals, sourced from
//! Open-Meteo (https://api.open-meteo.com/v1/forecast).
//!
//! The API takes comma-separated `latitude` and `longitude` query parameters
//! and returns a JSON **array** of per-location responses in the same order
//! as the request. We return the body verbatim; the renderer pairs each entry
//! back to its source capital by index (see `useProvincialCapitals`).
//!
//! The capital list is duplicated in `renderer/src/lib/cambodia-provinces.ts`
//! with the same order; the renderer asserts the response length matches the
//! TS list, which catches drift between the two copies.

use crate::http::{describe_fetch_error, HTTP_CLIENT};

const SERVICE_NAME: &str = "Open-Meteo";
const FORECAST_URL: &str = "https://api.open-meteo.com/v1/forecast";

/// The 25 provincial capitals as `(name, lat, lon)`. **Must match the order**
/// of `PROVINCIAL_CAPITALS` in `renderer/src/lib/cambodia-provinces.ts`.
const CAPITALS: [(&str, f64, f64); 25] = [
    ("Serei Saophoan",   13.5859, 102.9747),
    ("Battambang",       13.0957, 103.2028),
    ("Kampong Cham",     12.0001, 105.4533),
    ("Kampong Chhnang",  12.2503, 104.6675),
    ("Chbar Mon",        11.4534, 104.5217),
    ("Stueng Sen",       12.7111, 104.8887),
    ("Kampot",           10.6105, 104.1820),
    ("Ta Khmau",         11.4836, 104.9492),
    ("Krong Kep",        10.4847, 104.3168),
    ("Khemarak Phoumin", 11.6153, 102.9831),
    ("Kratie",           12.4881, 106.0190),
    ("Sen Monorom",      12.4524, 107.1881),
    ("Samraong",         14.1822, 103.6118),
    ("Pailin",           12.8489, 102.6094),
    ("Phnom Penh",       11.5564, 104.9282),
    ("Sihanoukville",    10.6280, 103.5223),
    ("Tbeng Meanchey",   13.8079, 104.9803),
    ("Prey Veng",        11.4854, 105.3245),
    ("Pursat",           12.5388, 103.9192),
    ("Banlung",          13.7395, 106.9870),
    ("Siem Reap",        13.3633, 103.8564),
    ("Stung Treng",      13.5236, 105.9683),
    ("Svay Rieng",       11.0879, 105.7993),
    ("Doun Kaev",        10.9908, 104.7849),
    ("Suong",            11.9143, 105.6939),
];

/// The `current=...` fields Open-Meteo should return for each location.
const CURRENT_FIELDS: &str = "temperature_2m,relative_humidity_2m,apparent_temperature,\
precipitation,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,is_day";

/// Builds the comma-separated lat/lon strings expected by Open-Meteo's
/// multi-location request format.
fn join_coords() -> (String, String) {
    let mut lats = String::with_capacity(CAPITALS.len() * 8);
    let mut lons = String::with_capacity(CAPITALS.len() * 8);
    for (i, (_, lat, lon)) in CAPITALS.iter().enumerate() {
        if i > 0 {
            lats.push(',');
            lons.push(',');
        }
        // 4 decimal places ≈ 11 m precision, well below the API's ~9 km cell
        // and small enough to keep the URL short.
        lats.push_str(&format!("{:.4}", lat));
        lons.push_str(&format!("{:.4}", lon));
    }
    (lats, lons)
}

/// Fetches current weather at the 25 provincial capitals and returns the
/// Open-Meteo response body unparsed.
#[tauri::command]
pub async fn get_provincial_capitals() -> Result<String, String> {
    let (latitudes, longitudes) = join_coords();

    let response = HTTP_CLIENT
        .get(FORECAST_URL)
        .query(&[
            ("latitude", latitudes.as_str()),
            ("longitude", longitudes.as_str()),
            ("current", CURRENT_FIELDS),
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
    fn join_coords_produces_25_comma_separated_pairs_in_order() {
        let (lats, lons) = join_coords();
        let lat_parts: Vec<&str> = lats.split(',').collect();
        let lon_parts: Vec<&str> = lons.split(',').collect();
        assert_eq!(lat_parts.len(), 25, "expected 25 latitudes");
        assert_eq!(lon_parts.len(), 25, "expected 25 longitudes");
        // Phnom Penh is at index 14 in both Rust and TS lists.
        assert_eq!(lat_parts[14], "11.5564");
        assert_eq!(lon_parts[14], "104.9282");
    }

    /// Live smoke test against api.open-meteo.com. Ignored by default since
    /// it needs network access; run with `cargo test -- --ignored`.
    #[tokio::test]
    #[ignore = "hits the live Open-Meteo API"]
    async fn live_fetch_returns_25_locations() {
        let body = get_provincial_capitals()
            .await
            .expect("provincial-capitals fetch succeeds");

        let parsed: serde_json::Value =
            serde_json::from_str(&body).expect("response body parses as JSON");
        let entries = parsed
            .as_array()
            .expect("Open-Meteo returns an array for multi-location requests");

        assert_eq!(entries.len(), 25, "expected one entry per capital");

        let first = &entries[0];
        let current = first
            .get("current")
            .expect("entry has a `current` block");
        assert!(
            current.get("temperature_2m").and_then(|v| v.as_f64()).is_some(),
            "current.temperature_2m is a number"
        );
        assert!(
            current.get("weather_code").and_then(|v| v.as_u64()).is_some(),
            "current.weather_code is a number"
        );
        assert!(
            current.get("is_day").and_then(|v| v.as_u64()).is_some(),
            "current.is_day is 0 or 1"
        );
    }
}
