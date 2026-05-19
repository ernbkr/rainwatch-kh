/** Formats a time as HH:MM (24-hour), or "-" when absent. */
export function formatClock(date: Date | null): string {
  if (!date) {
    return '-';
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}
