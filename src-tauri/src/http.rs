//! Shared HTTP client for all upstream egress.
//!
//! The radar module fetches from `http://cambodiameteo.com` and the
//! provincial-capitals module fetches from `https://api.open-meteo.com`.
//! Both want the same fixed User-Agent, gzip decompression, and request
//! timeout. Keeping one `reqwest::Client` here reuses the connection pool
//! across modules and keeps the egress policy in one place.

use std::sync::LazyLock;
use std::time::Duration;

const FETCH_TIMEOUT: Duration = Duration::from_secs(15);
const USER_AGENT: &str =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) CambodiaRadar/0.1 Safari/537.36";

/// Shared HTTP client. Built once with a fixed User-Agent and request timeout.
pub static HTTP_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(FETCH_TIMEOUT)
        .gzip(true)
        .build()
        .expect("HTTP client builds with the rustls TLS backend")
});

/// Maps a transport-level fetch failure to a short, user-facing message.
///
/// `service` is the human-readable upstream name (e.g. `"Cambodia Meteo"`,
/// `"Open-Meteo"`); it appears in the rendered toast / inline error.
pub fn describe_fetch_error(service: &str, error: reqwest::Error) -> String {
    if error.is_timeout() {
        format!("{service} request timed out.")
    } else {
        format!("Could not reach {service}.")
    }
}
