/**
 * Pouch — SQLite client.
 *
 * Owns the single, lazily-opened connection to the on-device database file
 * (`pouch.db`) and applies the schema on first use. Everything here is
 * local-only: `expo-sqlite` stores the file in the app's sandboxed
 * database directory, so no network or cloud dependency is involved.
 */

import { openDatabaseAsync } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

/** File name of the database, resolved inside the app's private directory. */
export const DATABASE_NAME = 'pouch.db';

/**
 * Idempotent DDL (`CREATE ... IF NOT EXISTS`), so it is safe to run on every
 * cold start. Column types mirror the domain models in `schema.ts`:
 * - `amount` is `REAL` and guarded by a `CHECK` so zero/negative values can
 *   never be persisted, even through raw SQL.
 * - `created_at` defaults to SQLite's clock in ISO-8601 form, which keeps
 *   text ordering identical to chronological ordering.
 */
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS transactions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    amount     REAL NOT NULL CHECK (amount > 0),
    type       TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category   TEXT NOT NULL,
    tag        TEXT,
    note       TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_created_at
    ON transactions (created_at DESC);

  CREATE TABLE IF NOT EXISTS debts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    person_name TEXT NOT NULL,
    amount      REAL NOT NULL CHECK (amount > 0),
    type        TEXT NOT NULL CHECK (type IN ('owed_to_you', 'you_owe')),
    status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled')),
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    settled_at  TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_debts_status ON debts (status);
`;

/**
 * Memoized connection promise. Created synchronously on the first
 * `getDatabase()` call so concurrent callers (e.g. `Promise.all` in the
 * store) share one connection instead of racing to open the file twice.
 */
let databasePromise: Promise<SQLiteDatabase> | null = null;

/**
 * Opens `pouch.db`, applies pragmas and runs the DDL above.
 * Not called directly — use {@link getDatabase}.
 */
async function openAndMigrate(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DATABASE_NAME);

  // WAL improves read/write concurrency for an offline-first app (readers
  // never block the writer). Not every platform (notably web) supports it,
  // so failure here is non-fatal.
  try {
    await db.execAsync('PRAGMA journal_mode = WAL;');
  } catch {
    // Platform rejected the pragma; continue with the default journal mode.
  }

  await db.execAsync(SCHEMA_SQL);
  return db;
}

/**
 * Returns the shared database handle, opening and migrating it on first use.
 * Subsequent calls resolve immediately with the same connection.
 *
 * If opening fails (e.g. the disk is full), the memoized promise is cleared
 * so the next call retries instead of caching the failure forever.
 */
export function getDatabase(): Promise<SQLiteDatabase> {
  if (databasePromise === null) {
    databasePromise = openAndMigrate();
    databasePromise.catch(() => {
      databasePromise = null;
    });
  }
  return databasePromise;
}

/** Closes the connection (if any) and forgets it, so a later
 *  {@link getDatabase} call re-opens a fresh one. */
export async function closeDatabase(): Promise<void> {
  const pending = databasePromise;
  databasePromise = null;
  if (pending === null) return;
  try {
    const db = await pending;
    await db.closeAsync();
  } catch {
    // Already closed or never finished opening — nothing to release.
  }
}
