/**
 * Pouch — async CRUD helpers.
 *
 * A thin, promise-based data-access layer over `expo-sqlite`. Every function
 * is fully typed, uses bound parameters (never string interpolation) to avoid
 * SQL injection, and returns domain objects from `schema.ts` rather than raw
 * rows, so callers never have to think about snake_case columns.
 */

import { getDatabase } from './client';
import type {
  Debt,
  DebtRow,
  DebtType,
  Transaction,
  TransactionRow,
  TransactionType,
} from './schema';

/* -------------------------------------------------------------------------- */
/*                                Row mapping                                 */
/* -------------------------------------------------------------------------- */

/** Maps a raw `transactions` row to a domain {@link Transaction}. */
function mapRowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    amount: row.amount,
    type: row.type,
    category: row.category,
    tag: row.tag ?? null,
    note: row.note ?? null,
    createdAt: row.created_at,
  };
}

/** Maps a raw `debts` row to a domain {@link Debt}. */
function mapRowToDebt(row: DebtRow): Debt {
  return {
    id: row.id,
    personName: row.person_name,
    amount: row.amount,
    type: row.type,
    status: row.status,
    createdAt: row.created_at,
    settledAt: row.settled_at ?? null,
  };
}

/**
 * Rounds a monetary value to 2 decimal places on write so tiny float
 * artifacts (e.g. `0.1 + 0.2`) never make it into storage.
 */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Validates a money amount shared by transactions and debts. */
function assertPositiveAmount(amount: number, label: string): number {
  const normalized = roundMoney(amount);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return normalized;
}

/* -------------------------------------------------------------------------- */
/*                               Transactions                                 */
/* -------------------------------------------------------------------------- */

/**
 * Inserts a new ledger entry and returns the persisted row.
 *
 * @param amount  Positive money magnitude (rounded to 2 decimals).
 * @param type    `'income'` or `'expense'`.
 * @param category Non-empty grouping label, e.g. `"food"`.
 * @param tag     Optional finer-grained label.
 * @param note    Optional free-text memo.
 * @throws If the amount or category is invalid, or the insert cannot be read back.
 */
export async function addTransaction(
  amount: number,
  type: TransactionType,
  category: string,
  tag?: string,
  note?: string,
): Promise<Transaction> {
  const normalizedAmount = assertPositiveAmount(amount, 'Transaction amount');

  const normalizedCategory = category.trim();
  if (normalizedCategory.length === 0) {
    throw new Error('Transaction category is required.');
  }

  const db = await getDatabase();
  const createdAt = new Date().toISOString();

  const result = await db.runAsync(
    `INSERT INTO transactions (amount, type, category, tag, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      normalizedAmount,
      type,
      normalizedCategory,
      tag?.trim() || null,
      note?.trim() || null,
      createdAt,
    ],
  );

  // Read the row back so defaults/generated values are always accurate.
  const row = await db.getFirstAsync<TransactionRow>(
    'SELECT * FROM transactions WHERE id = ?',
    [result.lastInsertRowId],
  );
  if (!row) {
    throw new Error('Failed to read back the inserted transaction.');
  }
  return mapRowToTransaction(row);
}

/**
 * Returns every transaction, newest first.
 * The order is deterministic (`created_at DESC, id DESC`) so list UIs stay
 * stable when two entries share the same timestamp.
 */
export async function getTransactions(): Promise<Transaction[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TransactionRow>(
    'SELECT * FROM transactions ORDER BY created_at DESC, id DESC',
  );
  return rows.map(mapRowToTransaction);
}

/* -------------------------------------------------------------------------- */
/*                                   Debts                                    */
/* -------------------------------------------------------------------------- */

/**
 * Records a new debt (money lent to, or borrowed from, someone).
 *
 * @param personName Non-empty name of the counterparty.
 * @param amount     Positive money magnitude (rounded to 2 decimals).
 * @param type       `'owed_to_you'` or `'you_owe'`.
 * @returns The persisted debt, always with `status: 'open'`.
 * @throws If the name or amount is invalid, or the insert cannot be read back.
 */
export async function addDebt(
  personName: string,
  amount: number,
  type: DebtType,
): Promise<Debt> {
  const normalizedAmount = assertPositiveAmount(amount, 'Debt amount');

  const normalizedName = personName.trim();
  if (normalizedName.length === 0) {
    throw new Error('Person name is required.');
  }

  const db = await getDatabase();
  const createdAt = new Date().toISOString();

  const result = await db.runAsync(
    `INSERT INTO debts (person_name, amount, type, status, created_at)
     VALUES (?, ?, ?, 'open', ?)`,
    [normalizedName, normalizedAmount, type, createdAt],
  );

  const row = await db.getFirstAsync<DebtRow>(
    'SELECT * FROM debts WHERE id = ?',
    [result.lastInsertRowId],
  );
  if (!row) {
    throw new Error('Failed to read back the inserted debt.');
  }
  return mapRowToDebt(row);
}

/**
 * Marks an outstanding debt as settled.
 *
 * The `WHERE ... AND status = 'open'` clause makes this idempotent: a second
 * call (or a call for an unknown id) matches no rows and reports `null`
 * instead of corrupting an already-settled record.
 *
 * @returns The updated debt, or `null` if it did not exist or was already settled.
 */
export async function settleDebt(debtId: number): Promise<Debt | null> {
  const db = await getDatabase();
  const settledAt = new Date().toISOString();

  const result = await db.runAsync(
    `UPDATE debts SET status = 'settled', settled_at = ?
     WHERE id = ? AND status = 'open'`,
    [settledAt, debtId],
  );
  if (result.changes === 0) {
    return null;
  }

  const row = await db.getFirstAsync<DebtRow>(
    'SELECT * FROM debts WHERE id = ?',
    [debtId],
  );
  return row ? mapRowToDebt(row) : null;
}

/**
 * Returns every debt, outstanding first (then newest first), so active IOUs
 * surface at the top of the screen without extra sorting in the UI.
 */
export async function getDebts(): Promise<Debt[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DebtRow>(
    `SELECT * FROM debts
     ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, created_at DESC, id DESC`,
  );
  return rows.map(mapRowToDebt);
}
