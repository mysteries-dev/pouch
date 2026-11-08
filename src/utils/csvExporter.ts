/**
 * Pouch — end-of-month CSV export.
 *
 * Turns one month of transactions into a spreadsheet-friendly CSV and hands
 * it to the OS share sheet. Entirely on-device — the pipeline is:
 *
 *   rows (Zustand ← SQLite) → CSV string → `expo-file-system` cache → `expo-sharing`
 *
 * There are no network calls and no cloud storage anywhere in this module,
 * which is why the only two imports outside the codebase are Expo's local
 * file and sharing APIs.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { Transaction } from '../db/schema';
import { isSameMonth, roundMoney } from './format';

/** Shape of a valid month key: `YYYY-MM`, e.g. `2026-11`. */
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Column order of the exported file. Keep in sync with {@link buildRow} —
 * the header is a literal so a stray field reordering is caught by eye.
 */
const CSV_HEADER = 'Date,Type,Category,Amount,Tag,Note';

/**
 * RFC 4180 row terminator. CRLF rather than LF so Excel on Windows opens
 * the file without complaining.
 */
const NEWLINE = '\r\n';

/**
 * UTF-8 byte order mark. Excel otherwise guesses an ANSI codepage and
 * renders Bangla characters in notes/categories as mojibake; every other
 * CSV reader skips it.
 */
const BOM = '\uFEFF';

/** Outcome of one export run, used to build the confirmation copy in the UI. */
export interface ExportMonthResult {
  /** File name written into the cache directory, e.g. `pouch-2026-11.csv`. */
  fileName: string;
  /** Absolute local URI of that file, passed to the share sheet. */
  uri: string;
  /** How many transactions actually made it into the file. */
  transactionCount: number;
  /**
   * `true` when the OS share sheet was presented, `false` when sharing is
   * unavailable on this host and the file was only written to disk.
   */
  shared: boolean;
}

/* -------------------------------------------------------------------------- */
/*                                 Formatting                                 */
/* -------------------------------------------------------------------------- */

/** Pads to two digits so dates sort correctly as text in a spreadsheet. */
function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Locale-independent timestamp: `2026-11-08 14:05`.
 *
 * Built from local date components instead of slicing the stored ISO string,
 * which is UTC — exporting `2026-11-08T20:35:00.000Z` verbatim would report
 * the wrong day to anyone reading the sheet.
 */
function formatCsvTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const day = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const clock = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  return `${day} ${clock}`;
}

/**
 * Quotes a field only when it has to be quoted (comma, quote or newline),
 * doubling embedded quotes per RFC 4180. Ordinary rows stay bare and
 * readable; `Dhaka, Banani` and a note containing `"lunch"` survive intact.
 */
function escapeField(value: string): string {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
/** One CSV line: `Date,Type,Category,Amount,Tag,Note`. */
function buildRow(transaction: Transaction): string {
  const fields = [
    formatCsvTimestamp(transaction.createdAt),
    transaction.type === 'income' ? 'Income' : 'Expense',
    transaction.category,
    // Plain 2dp number with no `Tk` symbol, so the column sums natively.
    roundMoney(transaction.amount).toFixed(2),
    // Tags are stored without their `#`; add it back so the sheet matches
    // what the app shows (e.g. `#ApartmentMove`).
    transaction.tag ? `#${transaction.tag}` : '',
    transaction.note ?? '',
  ];

  return fields.map(escapeField).join(',');
}

/* -------------------------------------------------------------------------- */
/*                                   Public                                   */
/* -------------------------------------------------------------------------- */

/**
 * A month's transactions in chronological order (oldest first) — the order
 * an audit trail is meant to be read in.
 *
 * `filter` already returns a fresh array, so the in-place `sort` can never
 * reorder the store's own list.
 */
export function selectMonthRows(
  transactions: Transaction[],
  monthKey: string,
): Transaction[] {
  return transactions
    .filter((transaction) => isSameMonth(transaction.createdAt, monthKey))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Pure string builder for the CSV body — no I/O, so it can be unit-tested
 * or reused for a preview without touching the filesystem.
 *
 * Always emits the header, even for an empty month: "no rows" is a valid
 * audit result, not an error.
 */
export function buildMonthCSV(rows: Transaction[]): string {
  return BOM + [CSV_HEADER, ...rows.map(buildRow)].join(NEWLINE) + NEWLINE;
}

/**
 * Writes one month of transactions to a CSV in the app's cache directory
 * and opens the native share sheet so the file can be saved, mailed or
 * handed to a spreadsheet.
 *
 * @param transactions  Full transaction list from the store (any order).
 * @param monthYearString  Month to export, as `YYYY-MM` (e.g. `2026-11`).
 * @throws If `monthYearString` is not a well-formed month key, or if the
 *         file cannot be created or written.
 */
export async function exportMonthToCSV(
  transactions: Transaction[],
  monthYearString: string,
): Promise<ExportMonthResult> {
  if (!MONTH_KEY_PATTERN.test(monthYearString)) {
    throw new Error(
      `Invalid month "${monthYearString}" — expected YYYY-MM, e.g. "2026-11".`,
    );
  }

  const rows = selectMonthRows(transactions, monthYearString);
  const fileName = `pouch-${monthYearString}.csv`;
  const file = new File(Paths.cache, fileName);

  // `create()` throws when the file already exists, so opt into overwriting:
  // exporting the same month twice must not fail on the second tap.
  file.create({ overwrite: true });
  await file.write(buildMonthCSV(rows));

  // A share sheet is not available on every host (web notably lacks it), so
  // ask first and degrade to "written to disk" instead of failing the export.
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    // Resolves once the sheet is dismissed, which keeps the button's busy
    // state honest for the whole interaction.
    await Sharing.shareAsync(file.uri, {
      dialogTitle: `Pouch transactions — ${monthYearString}`,
      mimeType: 'text/csv',
    });
  }

  return {
    fileName,
    uri: file.uri,
    transactionCount: rows.length,
    shared: canShare,
  };
}
