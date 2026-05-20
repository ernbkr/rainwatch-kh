/**
 * HTML-escape an untrusted string for safe insertion into a `setHTML` body.
 *
 * Extracted from the weather-stations popup code in `useRadarMap.ts` when the
 * provincial-capitals layer added a second caller. The escape set covers the
 * five HTML metacharacters and is intentionally narrow — no entity-decoding,
 * no tag stripping, no allow-list of safe markup.
 */
export function escapeHtml(raw: string): string {
  return raw.replace(
    /[&<>"']/g,
    (ch) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[ch] ?? ch
  );
}
