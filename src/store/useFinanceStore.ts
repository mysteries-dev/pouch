/**
 * Pouch — reactive finance store.
 *
 * Wraps the SQLite helpers in `src/db/queries` in a Zustand store so every
 * screen reads from one on-device source of truth. The pattern is always the
 * same: persist first (SQLite), then mirror the result into memory so
 * subscribers re-render. Derived values (`totalIncome`, `totalExpenses`,
 * `netBalance`, `activeDebts`, `totalLentOut`, `totalBorrowed`) are
 * recomputed inside the same `set` call, so they can never drift from the
 * raw arrays.
 *
 * No cloud sync, no network calls — the store is fully offline-first.
 */

import { create } from 'zustand';

import {
  addDebtWithMovement as insertDebtWithMovement,
  addTransaction as insertTransaction,
  getDebts,
  getTransactions,
  settleDebtWithMovement as insertSettlement,
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
  /**
   * `totalIncome - totalExpenses`; negative means the student is in the
   * red. Lending deducts the cash at creation and credits it back when
   * the other person repays; borrowing leaves the balance alone until
   * **Settle Up** pays it back — see {@link FinanceState.addDebt} and
   * {@link FinanceState.settleDebt}.
   */
  netBalance: number;
  /** Convenience view: only debts whose `status === 'open'`. */
  activeDebts: Debt[];
  /**
   * Total money lent out across *open* debts (`owed_to_you`) — "they owe
   * you". Kept strictly separate from what the student owes: lent and
   * borrowed balances are never netted against each other or across
   * people.
   */
  totalLentOut: number;
  /**
   * Total money borrowed across *open* debts (`you_owe`) — "I owe",
   * independent of {@link FinanceState.totalLentOut}.
   */
  totalBorrowed: number;
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
  /**
   * Persists a debt. A lend also writes the expense that moves the cash
   * out of `netBalance`, in the same SQLite transaction as the debt; a
   * borrow creates only the liability (no balance movement until it is
   * settled).
   */
  addDebt: (personName: string, amount: number, type: DebtType) => Promise<void>;
  /**
   * Marks a debt settled and records the repayment's cash movement
   * atomically: money comes back for a lend, and leaves the balance for
   * the first time for a borrow.
   */
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
 * rows (`activeDebts`) plus the two independent totals — lent out and
 * borrowed — which are summed separately and never netted. Always called
 * inside the same `set` as a debt change, so list and totals move together.
 */
function deriveDebtSummary(
  debts: Debt[],
): Pick<FinanceState, 'activeDebts' | 'totalLentOut' | 'totalBorrowed'> {
  const activeDebts: Debt[] = [];
  let lentOut = 0;
  let borrowed = 0;

  for (const debt of debts) {
    if (debt.status !== 'open') continue;
    activeDebts.push(debt);
    // Direction always from the student's point of view; each bucket
    // only ever sees its own direction's debts.
    if (debt.type === 'owed_to_you') {
      lentOut += debt.amount;
    } else {
      borrowed += debt.amount;
    }
  }

  return {
    activeDebts,
    totalLentOut: roundMoney(lentOut),
    totalBorrowed: roundMoney(borrowed),
  };
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
  totalLentOut: 0,
  totalBorrowed: 0,
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

  /**
   * Persists a debt plus (for a lend) its expense movement in one SQLite
   * transaction, then updates the lists and every derivation in a single
   * `set`, so the balance, the totals and the feed can never disagree.
   * A borrow writes no movement — its balance leaves only at settlement.
   */
  addDebt: async (personName, amount, type) => {
    set({ error: null });
    try {
      const { debt: created, movement } = await insertDebtWithMovement(
        personName,
        amount,
        type,
      );
      set((state) => {
        const debts = [created, ...state.debts];
        const transactions = movement
          ? [movement, ...state.transactions]
          : state.transactions;
        return {
          debts,
          transactions,
          ...deriveDebtSummary(debts),
          ...deriveTotals(transactions),
        };
      });
    } catch (error) {
      set({ error: toMessage(error) });
    }
  },

  /**
   * Settles a debt and records the repayment that changes hands, in one
   * SQLite transaction: a lend being paid back credits the balance, a
   * borrow being repaid debits it for the first time. Lists, totals and
   * debt summary then move together in a single `set`.
   */
  settleDebt: async (debtId) => {
    set({ error: null });
    try {
      const settled = await insertSettlement(debtId);
      if (!settled) {
        set({ error: 'That debt no longer exists or is already settled.' });
        return;
      }
      set((state) => {
        const debts = state.debts.map((debt) =>
          debt.id === settled.debt.id ? settled.debt : debt,
        );
        const transactions = [settled.movement, ...state.transactions];
        return {
          debts,
          transactions,
          ...deriveDebtSummary(debts),
          ...deriveTotals(transactions),
        };
      });
    } catch (error) {
      set({ error: toMessage(error) });
    }
  },

  /** Clears the error banner. */
  clearError: () => set({ error: null }),
}));
