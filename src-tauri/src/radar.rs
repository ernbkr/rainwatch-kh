//! Source-page fetching and radar-frame parsing.
//!
//! Ported from the Electron `src/parser.js` and the fetch helpers in
//! `src/main.js`. Every HTTP request the app makes originates here and is
//! restricted to `http://cambodiameteo.com`: the slideshow domain is checked
//! against the allow-list in `domains.rs`, and image URLs against a fixed
//! origin plus the `/data/animation/radar/` path prefix. No caller-supplied
//! URL is ever fetched verbatim.

use std::collections::{BTreeMap, HashMap};
use std::sync::LazyLock;
use std::time::Duration;

use base64::Engine;
use regex::Regex;
use serde::Serialize;
use url::Url;

use crate::domains::assert_valid_domain;

const SOURCE_URL: &str = "http://cambodiameteo.com/slideshow?menu=117&lang=en";
const SOURCE_ORIGIN: &str = "http://cambodiameteo.com";
const RADAR_IMAGE_PATH_PREFIX: &str = "/data/animation/radar/";
const FETCH_TIMEOUT: Duration = Duration::from_secs(15);
const USER_AGENT: &str =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) CambodiaRadar/0.1 Safari/537.36";

/// Matches `theImagesComplete[<n>] = "<path>";` for either quote style.
/// Group 1 is the index; group 2/3 the double/single-quoted body.
static IMAGE_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"theImagesComplete\[(\d+)\]\s*=\s*(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)')\s*;"#)
        .expect("image pattern is a valid regex")
});

/// Matches `ImagesText[<n>] = "<label>";` for either quote style.
static LABEL_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"ImagesText\[(\d+)\]\s*=\s*(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)')\s*;"#)
        .expect("label pattern is a valid regex")
});

/// Shared HTTP client. Built once with a fixed User-Agent and request timeout.
static HTTP_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(FETCH_TIMEOUT)
        .gzip(true)
        .build()
        .expect("HTTP client builds with the rustls TLS backend")
});

/// A single radar frame. Serializes to the renderer's `RawFrame` shape.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct RadarFrame {
    pub index: u32,
    pub url: String,
    pub label: String,
}

/// Response for `get_radar_frames`. Serializes to the renderer's
/// `FetchFramesResult` shape (`{ domain, fetchedAt, frames }`).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RadarFrameResponse {
    pub domain: String,
    pub fetched_at: String,
    pub frames: Vec<RadarFrame>,
}

/// Fetches the Cambodia Meteo slideshow page for `domain` and returns the
/// parsed, index-sorted radar frames.
#[tauri::command]
pub async fn get_radar_frames(domain: String) -> Result<RadarFrameResponse, String> {
    assert_valid_domain(&domain)?;

    let mut url = Url::parse(SOURCE_URL).map_err(|_| "Invalid source URL.".to_string())?;
    url.query_pairs_mut().append_pair("domain", &domain);

    let response = HTTP_CLIENT
        .get(url)
        .header(reqwest::header::ACCEPT, "text/html,application/xhtml+xml")
        .send()
        .await
        .map_err(describe_fetch_error)?;

    if !response.status().is_success() {
        return Err(format!(
            "Cambodia Meteo returned HTTP {}",
            response.status().as_u16()
        ));
    }

    let bytes = response.bytes().await.map_err(describe_fetch_error)?;
    let html = String::from_utf8_lossy(&bytes);
    let frames = parse_radar_frames(&html);

    Ok(RadarFrameResponse {
        domain,
        fetched_at: now_iso8601(),
        frames,
    })
}

/// Fetches a single radar image and returns it as a base64 `data:` URL.
///
/// The renderer crops each frame on a `<canvas>`; loading the cross-origin
/// image directly would taint the canvas (Cambodia Meteo sends no CORS
/// headers), so the bytes are proxied here and handed back same-origin.
#[tauri::command]
pub async fn get_radar_image(url: String) -> Result<String, String> {
    let validated = validate_radar_image_url(&url)?;

    let response = HTTP_CLIENT
        .get(validated)
        .header(reqwest::header::ACCEPT, "image/jpeg,image/*")
        .send()
        .await
        .map_err(describe_fetch_error)?;

    if !response.status().is_success() {
        return Err(format!(
            "Cambodia Meteo returned HTTP {}",
            response.status().as_u16()
        ));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string)
        .unwrap_or_else(|| "image/jpeg".to_string());

    if !content_type.to_ascii_lowercase().starts_with("image/") {
        return Err("Radar image response was not an image.".to_string());
    }

    let bytes = response.bytes().await.map_err(describe_fetch_error)?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{content_type};base64,{encoded}"))
}

/// Maps a transport-level fetch failure to a short, user-facing message.
fn describe_fetch_error(error: reqwest::Error) -> String {
    if error.is_timeout() {
        "Cambodia Meteo request timed out.".to_string()
    } else {
        "Could not reach Cambodia Meteo.".to_string()
    }
}

/// Current UTC time as an ISO-8601 string, matching JS `Date.toISOString()`.
fn now_iso8601() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

/// Validates that `image_url` is an absolute Cambodia Meteo radar image URL.
/// Ported from `assertValidRadarImageUrl` in `src/main.js`.
fn validate_radar_image_url(image_url: &str) -> Result<Url, String> {
    let url = Url::parse(image_url).map_err(|_| "Invalid radar image URL.".to_string())?;
    if url.origin().ascii_serialization() != SOURCE_ORIGIN
        || !url.path().starts_with(RADAR_IMAGE_PATH_PREFIX)
    {
        return Err("Invalid radar image URL.".to_string());
    }
    Ok(url)
}

/// Decodes a JavaScript string literal body (handles escapes such as `\/`).
/// Ported from `decodeJsString` in `src/parser.js`.
fn decode_js_string(value: &str) -> String {
    let escaped = value.replace('"', "\\\"");
    serde_json::from_str::<String>(&format!("\"{escaped}\"")).unwrap_or_else(|_| value.to_string())
}

/// Resolves a source-page image path to an absolute URL, accepting only paths
/// under `http://cambodiameteo.com/data/animation/radar/`.
/// Ported from `normalizeRadarUrl` in `src/parser.js`.
pub fn normalize_radar_url(path: &str) -> Option<String> {
    if !path.starts_with(RADAR_IMAGE_PATH_PREFIX) {
        return None;
    }

    let resolved = Url::parse(SOURCE_ORIGIN).ok()?.join(path).ok()?;
    if resolved.origin().ascii_serialization() != SOURCE_ORIGIN
        || !resolved.path().starts_with(RADAR_IMAGE_PATH_PREFIX)
    {
        return None;
    }

    Some(resolved.to_string())
}

/// Parses `theImagesComplete[]` / `ImagesText[]` arrays out of the slideshow
/// HTML and returns the frames sorted numerically by index.
/// Ported from `parseRadarFrames` in `src/parser.js`.
pub fn parse_radar_frames(html: &str) -> Vec<RadarFrame> {
    if html.is_empty() {
        return Vec::new();
    }

    // BTreeMap keeps frames sorted numerically by index.
    let mut image_by_index: BTreeMap<u32, String> = BTreeMap::new();
    let mut label_by_index: HashMap<u32, String> = HashMap::new();

    for captures in IMAGE_PATTERN.captures_iter(html) {
        let Ok(index) = captures[1].parse::<u32>() else {
            continue;
        };
        let raw = quoted_body(&captures);
        if let Some(url) = normalize_radar_url(&decode_js_string(raw)) {
            image_by_index.insert(index, url);
        }
    }

    for captures in LABEL_PATTERN.captures_iter(html) {
        let Ok(index) = captures[1].parse::<u32>() else {
            continue;
        };
        let raw = quoted_body(&captures);
        label_by_index.insert(index, decode_js_string(raw).trim().to_string());
    }

    image_by_index
        .into_iter()
        .map(|(index, url)| RadarFrame {
            index,
            url,
            label: label_by_index.get(&index).cloned().unwrap_or_default(),
        })
        .collect()
}

/// Returns the matched string body — group 2 (double-quoted) or 3 (single).
fn quoted_body<'a>(captures: &regex::Captures<'a>) -> &'a str {
    captures
        .get(2)
        .or_else(|| captures.get(3))
        .map_or("", |m| m.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_frames_labels_and_sorts_indexes_numerically() {
        let html = r#"
            theImagesComplete[0] = "/data/animation/radar/frame-0.jpg";
            ImagesText[0] = "18/05/2026 - 07:01:05";
            theImagesComplete[10] = "/data/animation/radar/frame-10.jpg";
            ImagesText[10] = "18/05/2026 - 09:31:05";
            theImagesComplete[2] = "/data/animation/radar/frame-2.jpg";
            ImagesText[2] = "18/05/2026 - 07:31:05";
            theImagesComplete[11] = "/data/animation/radar/frame-11.jpg";
            ImagesText[11] = "18/05/2026 - 09:46:05";
            theImagesComplete[1] = "/data/animation/radar/frame-1.jpg";
            ImagesText[1] = "18/05/2026 - 07:16:05";
        "#;

        let frames = parse_radar_frames(html);

        let indexes: Vec<u32> = frames.iter().map(|frame| frame.index).collect();
        assert_eq!(indexes, vec![0, 1, 2, 10, 11]);
        assert_eq!(
            frames[0],
            RadarFrame {
                index: 0,
                url: "http://cambodiameteo.com/data/animation/radar/frame-0.jpg".to_string(),
                label: "18/05/2026 - 07:01:05".to_string(),
            }
        );
    }

    #[test]
    fn allows_missing_labels() {
        let frames =
            parse_radar_frames(r#"theImagesComplete[0] = "/data/animation/radar/frame-0.jpg";"#);

        assert_eq!(
            frames,
            vec![RadarFrame {
                index: 0,
                url: "http://cambodiameteo.com/data/animation/radar/frame-0.jpg".to_string(),
                label: String::new(),
            }]
        );
    }

    #[test]
    fn ignores_malformed_or_disallowed_image_paths() {
        let html = r#"
            theImagesComplete[0] = "/data/animation/radar/frame-0.jpg";
            theImagesComplete[1] = "/layouts/cambodia/images/logo.png";
            theImagesComplete[2] = "https://example.com/frame.jpg";
            theImagesComplete[3] = "../data/animation/radar/frame-3.jpg";
        "#;

        let indexes: Vec<u32> = parse_radar_frames(html)
            .iter()
            .map(|frame| frame.index)
            .collect();
        assert_eq!(indexes, vec![0]);
    }

    #[test]
    fn returns_empty_for_empty_or_irrelevant_html() {
        assert_eq!(parse_radar_frames(""), Vec::new());
        assert_eq!(parse_radar_frames("<html></html>"), Vec::new());
    }

    #[test]
    fn decodes_escaped_forward_slashes_in_paths() {
        let frames = parse_radar_frames(
            r#"theImagesComplete[0] = "\/data\/animation\/radar\/frame-0.jpg";"#,
        );
        assert_eq!(
            frames[0].url,
            "http://cambodiameteo.com/data/animation/radar/frame-0.jpg"
        );
    }

    #[test]
    fn normalizes_only_cambodia_meteo_radar_paths() {
        assert_eq!(
            normalize_radar_url("/data/animation/radar/example.jpg"),
            Some("http://cambodiameteo.com/data/animation/radar/example.jpg".to_string())
        );
        assert_eq!(
            normalize_radar_url("/data/animation/satellite/example.jpg"),
            None
        );
        assert_eq!(
            normalize_radar_url("http://example.com/data/animation/radar/example.jpg"),
            None
        );
    }

    #[test]
    fn validates_radar_image_urls_against_origin_and_path() {
        assert!(
            validate_radar_image_url("http://cambodiameteo.com/data/animation/radar/x.jpg").is_ok()
        );
        assert!(
            validate_radar_image_url("http://example.com/data/animation/radar/x.jpg").is_err()
        );
        assert!(validate_radar_image_url(
            "http://cambodiameteo.com/data/animation/satellite/x.jpg"
        )
        .is_err());
        assert!(validate_radar_image_url("not a url").is_err());
    }

    /// Live smoke test against cambodiameteo.com. Ignored by default since it
    /// needs network access; run with `cargo test -- --ignored`.
    #[tokio::test]
    #[ignore = "hits the live Cambodia Meteo site"]
    async fn live_fetch_returns_phn_frames_and_image() {
        let response = get_radar_frames("PHN".to_string())
            .await
            .expect("PHN frames fetch succeeds");
        assert_eq!(response.domain, "PHN");
        assert!(!response.frames.is_empty(), "expected at least one frame");

        let data_url = get_radar_image(response.frames[0].url.clone())
            .await
            .expect("radar image fetch succeeds");
        assert!(data_url.starts_with("data:image/"), "got: {data_url:.40}");
    }
}
