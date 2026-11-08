/**
 * Pouch — domain schema.
 *
 * Pure TypeScript models shared by the SQLite layer (`src/db`) and the
 * Zustand store (`src/store`). This module performs no I/O and imports no
 * native modules, so it is safe to import from anywhere (including tests
 * and component files) without pulling in the database.
 */

/** Direction of money movement for a single ledger entry. */
export type TransactionType = 'income' | 'expense';

/**
 * Direction of a debt, always from the student's point of view:
 * - `owed_to_you`: you lent money, so someone owes you.
 * - `you_owe`: you borrowed money, so you owe someone.
 */
export type DebtType = 'owed_to_you' | 'you_owe';

/** Lifecycle of a debt. Only `open` debts count towards `activeDebts`. */
export type DebtStatus = 'open' | 'settled';

/** A single income or expense entry as consumed by the UI. */
export interface Transaction {
  /** Auto-incrementing primary key. */
  id: number;
  /** Positive magnitude of the money moved, in the app's currency unit. */
  amount: number;
  /** Whether this entry adds to or subtracts from the balance. */
  type: TransactionType;
  /** Free-form grouping, e.g. `"food"` or `"transport"`. */
  category: string;
  /** Optional finer-grained label, e.g. `"coffee"`. `null` when omitted. */
  tag: string | null;
  /** Optional free-text memo. `null` when omitted. */
  note: string | null;
  /** ISO-8601 timestamp of when the entry was recorded (UTC). */
  createdAt: string;
}

/** An IOU between the student and another person. */
export interface Debt {
  /** Auto-incrementing primary key. */
  id: number;
  /** Name of the counterparty, e.g. `"Alex"`. */
  personName: string;
  /** Positive magnitude of the money lent or borrowed. */
  amount: number;
  /** Who owes whom (see {@link DebtType}). */
  type: DebtType;
  /** Whether the debt is still outstanding. */
  status: DebtStatus;
  /** ISO-8601 timestamp of when the debt was recorded (UTC). */
  createdAt: string;
  /** ISO-8601 timestamp of settlement, or `null` while still open. */
  settledAt: string | null;
}

/**
 * Raw `transactions` row exactly as SQLite returns it: snake_case column
 * names and nullable columns for optional fields. Mapped to
 * {@link Transaction} by the helpers in `queries.ts`.
 */
export interface TransactionRow {
  id: number;
  amount: number;
  type: TransactionType;
  category: string;
  tag: string | null;
  note: string | null;
  created_at: string;
}

/** Raw `debt` row exactly as SQLite returns it. See {@link TransactionRow}. */
export interface DebtRow {
  id: number;
  person_name: string;
  amount: number;
  type: DebtType;
  status: DebtStatus;
  created_at: string;
  settled_at: string | null;
}
