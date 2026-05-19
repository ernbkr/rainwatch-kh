//! Allowed radar domains.
//!
//! Ported from the Electron `src/domains.js`. The renderer keeps its own
//! `AREAS` list (with display labels) in `renderer/src/lib/domains.ts`; this
//! module only needs the domain identifiers to validate command input.

/// The Cambodia Meteo radar domains the app is allowed to request.
pub const ALLOWED_DOMAINS: [&str; 3] = ["PHN", "240KM", "CAMBODIA"];

/// Returns whether `domain` is one of the supported radar domains.
pub fn is_valid_domain(domain: &str) -> bool {
    ALLOWED_DOMAINS.contains(&domain)
}

/// Validates a domain, returning a human-readable error for the frontend.
pub fn assert_valid_domain(domain: &str) -> Result<(), String> {
    if is_valid_domain(domain) {
        Ok(())
    } else {
        Err(format!("Invalid radar domain: {domain}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_supported_cambodia_meteo_radar_domains() {
        assert!(is_valid_domain("PHN"));
        assert!(is_valid_domain("240KM"));
        assert!(is_valid_domain("CAMBODIA"));
    }

    #[test]
    fn rejects_arbitrary_values_and_urls() {
        assert!(!is_valid_domain(""));
        assert!(!is_valid_domain("http://example.com"));
        assert!(!is_valid_domain("../PHN"));

        let error = assert_valid_domain("http://example.com").unwrap_err();
        assert!(error.contains("Invalid radar domain"));
    }
}
