/**
 * Format a Date as `YYYY-MM-DD` in the user's local time zone.
 *
 * `worn_date` is a calendar day as the user experiences it. Building it with
 * `toISOString()` uses UTC, which is already "tomorrow" on a US evening.
 */
export function toLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
