/**
 * Pouch — reactive finance store.
 *
 * Wraps the SQLite helpers in `src/db/queries` in a Zustand store so every
 * screen reads from one on-device source of truth. The pattern is always the
 * same: persist first (SQLite), then mirror the result into memory so
 * subscribers re-render. Derived values (`totalIncome`, `totalExpenses`,
 * `netBalance`, `activeDebts`) are recomputed inside the same `set` call, so
 * they can never drift from the raw arrays.
 *
 * No cloud sync, no network calls — the store is fully offline-first.
 */

import { create } from 'zustand';

import {
  addDebt as insertDebt,
  addTransaction as insertTransaction,
  getDebts,
  getTransactions,
  settleDebt as markDebtSettled,
} from '../db/queries';
import type { Debt, DebtType, Transaction, TransactionType } from '../db/schema';

/** Shape of the store: raw records, derived totals, and actions. */
export interface FinanceState {
  /** All transactions, newest first. */
  transactions: Transaction[];
  /** All debts, outstanding ones first. */
  debts: Debt[];
  /** Sum of `income` transactions (2-dp rounded). */
  totalIncome: number;
  /** Sum of `expense` transactions (2-dp rounded). */
  totalExpenses: number;
  /** `totalIncome - totalExpenses`; negative means the student is in the red. */
  netBalance: number;
  /** Convenience view: only debts whose `status === 'open'`. */
  activeDebts: Debt[];
  /**
   * Net roommate balance across *open* debts: `owed_to_you` minus `you_owe`.
   * Positive → roommates owe the student; negative → the student owes them;
   * zero → all settled.
   */
  netRoommateBalance: number;
  /** True while the initial (or a refresh) load is in flight. */
  isLoading: boolean;
  /** Last user-facing error message, or `null`. Cleared on the next action. */
  error: string | null;

  /** Loads all data from SQLite. Call once on app startup. */
  fetchInitialData: () => Promise<void>;
  /** Persists a transaction, then appends it to local state. */
  addTransaction: (
    amount: number,
    type: TransactionType,
    category: string,
    tag?: string,
    note?: string,
  ) => Promise<void>;
  /** Persists a debt, then appends it to local state. */
  addDebt: (personName: string, amount: number, type: DebtType) => Promise<void>;
  /** Marks a debt settled, then updates it in local state. */
  settleDebt: (debtId: number) => Promise<void>;
  /** Clears the current error message. */
  clearError: () => void;
}

/* -------------------------------------------------------------------------- */
/*                               Derived helpers                              */
/* -------------------------------------------------------------------------- */

/** Rounds to 2 decimal places to keep money totals free of float noise. */
const roundMoney = (value: number): number => Math.round(value * 100) / 100;

/** Converts any thrown value into a message safe to display in the UI. */
function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Recomputes the three money totals from the transaction list in a single
 * pass. Called only from `set`, so totals always move with the array.
 */
function deriveTotals(
  transactions: Transaction[],
): Pick<FinanceState, 'totalIncome' | 'totalExpenses' | 'netBalance'> {
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const transaction of transactions) {
    if (transaction.type === 'income') {
      totalIncome += transaction.amount;
    } else {
      totalExpenses += transaction.amount;
    }
  }

  totalIncome = roundMoney(totalIncome);
  totalExpenses = roundMoney(totalExpenses);

  return {
    totalIncome,
    totalExpenses,
    netBalance: roundMoney(totalIncome - totalExpenses),
  };
}

/**
 * Derives everything the UI shows about debts from the raw list: the open
 * rows (`activeDebts`) and the net roommate balance. Always called inside
 * the same `set` as a debt change, so list and banner move together.
 */
function deriveDebtSummary(
  debts: Debt[],
): Pick<FinanceState, 'activeDebts' | 'netRoommateBalance'> {
  const activeDebts: Debt[] = [];
  let net = 0;

  for (const debt of debts) {
    if (debt.status !== 'open') continue;
    activeDebts.push(debt);
    // Money owed *to* the student counts positive; money the student owes,
    // negative.
    net += debt.type === 'owed_to_you' ? debt.amount : -debt.amount;
  }

  return { activeDebts, netRoommateBalance: roundMoney(net) };
}

/* -------------------------------------------------------------------------- */
/*                                    Store                                   */
/* -------------------------------------------------------------------------- */

/**
 * Global finance store.
 *
 * Action errors are never thrown at the caller: they are written to
 * `state.error`, so a component can simply render `{store.error}` instead of
 * wrapping every dispatch in a `try/catch`.
 */
export const useFinanceStore = create<FinanceState>()((set) => ({
  transactions: [],
  debts: [],
  totalIncome: 0,
  totalExpenses: 0,
  netBalance: 0,
  activeDebts: [],
  netRoommateBalance: 0,
  isLoading: false,
  error: null,

  /** Reads every record from SQLite and refreshes all derived values. */
  fetchInitialData: async () => {
    set({ isLoading: true, error: null });
    try {
      // Both helpers share the same memoized connection, so this is safe.
      const [transactions, debts] = await Promise.all([
        getTransactions(),
        getDebts(),
      ]);
      set({
        transactions,
        debts,
        ...deriveDebtSummary(debts),
        isLoading: false,
        ...deriveTotals(transactions),
      });
    } catch (error) {
      set({ isLoading: false, error: toMessage(error) });
    }
  },

  /** Persists a transaction and prepends it (newest-first list order). */
  addTransaction: async (amount, type, category, tag, note) => {
    set({ error: null });
    try {
      const created = await insertTransaction(amount, type, category, tag, note);
      set((state) => {
        const transactions = [created, ...state.transactions];
        return { transactions, ...deriveTotals(transactions) };
      });
    } catch (error) {
      set({ error: toMessage(error) });
    }
  },

  /** Persists a debt and prepends it, keeping active debts in sync. */
  addDebt: async (personName, amount, type) => {
    set({ error: null });
    try {
      const created = await insertDebt(personName, amount, type);
      set((state) => {
        const debts = [created, ...state.debts];
        return { debts, ...deriveDebtSummary(debts) };
      });
    } catch (error) {
      set({ error: toMessage(error) });
    }
  },

  /**
   * Marks a debt settled. Totals are intentionally untouched: settling an
   * IOU is not a money movement — record it as a transaction separately if
   * it should affect the balance.
   */
  settleDebt: async (debtId) => {
    set({ error: null });
    try {
      const settled = await markDebtSettled(debtId);
      if (!settled) {
        set({ error: 'That debt no longer exists or is already settled.' });
        return;
      }
      set((state) => {
        const debts = state.debts.map((debt) =>
          debt.id === settled.id ? settled : debt,
        );
        return { debts, ...deriveDebtSummary(debts) };
      });
    } catch (error) {
      set({ error: toMessage(error) });
    }
  },

  /** Clears the error banner. */
  clearError: () => set({ error: null }),
}));
