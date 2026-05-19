// Frame labels from Cambodia Meteo look like "19/05/2026 - 08:31:05".
const FRAME_LABEL_PATTERN =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/** Parses a radar frame label into a Date, or null when it is empty/malformed. */
export function parseFrameTime(label: string): Date | null {
  const match = label.trim().match(FRAME_LABEL_PATTERN);
  if (!match) {
    return null;
  }

  const [, day, month, year, hour, minute, second] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? '0')
  );

  return Number.isNaN(date.getTime()) ? null : date;
}
