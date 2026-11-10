/**
 * Pouch — money and date formatting.
 *
 * Hand-rolled instead of `Intl.NumberFormat` on purpose: Hermes' ICU data
 * varies by platform, and a finance app must render the same string
 * everywhere. No dependencies, no locale surprises.
 */

/** Currency shown everywhere in the UI (Taka, per product spec). */
export const CURRENCY = 'Tk';

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const WEEKDAY_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/**
 * Rounds to 2 decimal places so stored/derived money never shows float
 * artifacts such as `0.30000000000000004`.
 */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Formats a number as currency with thousands separators: `1234.5` → `Tk 1,234.50`.
 * Non-finite input degrades to `Tk 0.00` rather than crashing a screen.
 */
export function formatMoney(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const negative = safe < 0;
  const [whole, decimals] = Math.abs(safe).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${CURRENCY} ${grouped}.${decimals}`;
}

/** Parses an ISO timestamp, returning `null` for anything unparseable. */
function parseIso(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Midnight (local time) of the calendar day the date falls on. */
function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Stable `YYYY-MM-DD` key in the device's local timezone — used to group the
 * transaction feed into day sections.
 */
export function localDateKey(iso: string): string {
  const date = parseIso(iso);
  if (!date) return 'unknown';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * True when an ISO timestamp falls inside `monthKey` (`YYYY-MM`) according
 * to the device's local calendar.
 *
 * Shares {@link localDateKey}'s local-timezone rule, so the feed, the
 * summary screen and the CSV export can never disagree about which month a
 * late-night transaction belongs to.
 */
export function isSameMonth(iso: string, monthKey: string): boolean {
  return localDateKey(iso).slice(0, 7) === monthKey;
}

/**
 * Human-friendly day header for the feed:
 * `Today`, `Yesterday`, a weekday within the last week, then `Nov 8` / `Nov 8, 2025`.
 */
export function formatDateHeader(iso: string): string {
  const date = parseIso(iso);
  if (!date) return 'Unknown date';

  const now = new Date();
  const dayDelta = Math.round(
    (startOfLocalDay(now) - startOfLocalDay(date)) / 86_400_000,
  );

  if (dayDelta <= 0) return 'Today';
  if (dayDelta === 1) return 'Yesterday';
  if (dayDelta < 7) return WEEKDAY_LONG[date.getDay()];

  const shortDate = `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === now.getFullYear()
    ? shortDate
    : `${shortDate}, ${date.getFullYear()}`;
}

/** 24-hour clock label for a row's timestamp: `14:05`. */
export function formatClockTime(iso: string): string {
  const date = parseIso(iso);
  if (!date) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Date label for records: `Nov 8, 2026` (`Nov 8` within the current year). */
export function formatDateLong(iso: string): string {
  const date = parseIso(iso);
  if (!date) return 'Unknown date';

  const shortDate = `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === new Date().getFullYear()
    ? shortDate
    : `${shortDate}, ${date.getFullYear()}`;
}

/**
 * Keeps only digits and a single decimal point with at most 2 decimals, so
 * an amount field stays valid no matter what the keypad produces. A trailing
 * `.` is preserved while the user is still typing.
 */
export function sanitizeAmountInput(raw: string): string {
  const withoutJunk = raw.replace(/[^0-9.]/g, '');
  const dotIndex = withoutJunk.indexOf('.');
  if (dotIndex === -1) return withoutJunk;

  const whole = withoutJunk.slice(0, dotIndex);
  const decimals = withoutJunk.slice(dotIndex + 1).replace(/\./g, '');
  return decimals.length > 0 ? `${whole}.${decimals.slice(0, 2)}` : `${whole}.`;
}
