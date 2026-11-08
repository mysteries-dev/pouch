/**
 * Pouch — Summary Screen (end-of-month audit).
 *
 * One place to review a single calendar month:
 *
 *  - a month/year selector that defaults to the current month and can only
 *    travel backwards (you cannot audit a month that hasn't happened),
 *  - the month's headline numbers: Money In, Expenses and Net Remaining,
 *  - `CategoryBreakdown` and `TagSummary` for where the money went,
 *  - a roll-forward card listing roommate IOUs that stay open past this
 *    month,
 *  - and **Export Month to CSV**, which writes the month to a local file
 *    and opens the OS share sheet.
 *
 * Data flow is fully offline: SQLite → `fetchInitialData()` → Zustand →
 * this screen. The only async boundary is that initial load, so every
 * figure below is derived from state that has already settled — no network
 * and no cloud service is involved at any point.
 */

import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import CategoryBreakdown from '../components/CategoryBreakdown';
import TagSummary from '../components/TagSummary';
import type { Debt } from '../db/schema';
import { useFinanceStore } from '../store/useFinanceStore';
import { colors, radius, spacing } from '../theme';
import {
  formatMoney,
  formatNetBalanceLine,
  isSameMonth,
  roundMoney,
} from '../utils/format';
import { exportMonthToCSV } from '../utils/csvExporter';

/** Full month names, indexed by `Date#getMonth()`. */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** `YYYY-MM` key for a date's local calendar month. */
function monthKeyOf(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

/** Accent for a single open IOU, from the student's point of view. */
function debtColor(debt: Debt): string {
  return debt.type === 'you_owe' ? colors.expense : colors.income;
}

/** Short right-aligned label for an open IOU row. */
function debtLine(debt: Debt): string {
  const amount = formatMoney(debt.amount);
  return debt.type === 'you_owe' ? `You owe ${amount}` : `Owes you ${amount}`;
}

export default function SummaryScreen() {
  // Store selectors — the same arrays the Home feed and Debts list read,
  // so all three tabs describe one identical dataset.
  const transactions = useFinanceStore((state) => state.transactions);
  const activeDebts = useFinanceStore((state) => state.activeDebts);
  const netRoommateBalance = useFinanceStore(
    (state) => state.netRoommateBalance,
  );

  // Offset in whole months from the current one: `0` is this month, `-1`
  // is last month. Staying at or below zero is what caps the selector at
  // the present — there is no future month to step into.
  const [monthOffset, setMonthOffset] = useState(0);

  // Export button lifecycle. `exportMessage` is the confirmation or error
  // line rendered beneath the button.
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportFailed, setExportFailed] = useState(false);

  const now = new Date();
  const selected = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthKey = monthKeyOf(selected);
  const monthLabel = `${MONTH_NAMES[selected.getMonth()]} ${selected.getFullYear()}`;

  // Home-indicator inset, so the export button clears the tab bar on
  // notched devices as well as on flat-bottomed ones.
  const insets = useSafeAreaInsets();

  /** Just this month's rows — the single source for every figure below. */
  const monthTransactions = useMemo(
    () =>
      transactions.filter((transaction) =>
        isSameMonth(transaction.createdAt, monthKey),
      ),
    [transactions, monthKey],
  );

  /** Headline totals for the selected month, in one pass. */
  const { moneyIn, moneyOut, netRemaining, entryCount } = useMemo(() => {
    let incoming = 0;
    let outgoing = 0;

    for (const transaction of monthTransactions) {
      if (transaction.type === 'income') {
        incoming += transaction.amount;
      } else {
        outgoing += transaction.amount;
      }
    }

    incoming = roundMoney(incoming);
    outgoing = roundMoney(outgoing);

    return {
      moneyIn: incoming,
      moneyOut: outgoing,
      netRemaining: roundMoney(incoming - outgoing),
      entryCount: monthTransactions.length,
    };
  }, [monthTransactions]);

  const canGoNext = monthOffset < 0;
  // An empty month has nothing to write, so the button stays disabled
  // rather than producing a header-only file.
  const canExport = entryCount > 0 && !isExporting;

  /** Writes the month out and reports the outcome under the button. */
  const handleExport = async (): Promise<void> => {
    if (!canExport) return;

    setIsExporting(true);
    setExportFailed(false);
    setExportMessage(null);

    try {
      // Passes the full list; the exporter applies the same month filter
      // this screen uses, so the file always matches the numbers on show.
      const result = await exportMonthToCSV(transactions, monthKey);
      setExportMessage(
        result.shared
          ? `${result.fileName} · ${result.transactionCount} rows ready to share.`
          : `${result.fileName} saved · sharing isn't available on this device.`,
      );
    } catch (error) {
      setExportFailed(true);
      setExportMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          // Clears the floating tab bar, including the home-indicator inset.
          { paddingBottom: insets.bottom + 96 },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Summary</Text>
          <Text style={styles.tagline}>End-of-month audit.</Text>
        </View>

        {/* Month / year selector. */}
        <View style={styles.monthRow}>
          <Pressable
            onPress={() => setMonthOffset((offset) => offset - 1)}
            style={({ pressed }) => [
              styles.arrowButton,
              pressed && styles.arrowPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Text style={styles.arrow}>‹</Text>
          </Pressable>

          <View style={styles.monthLabelWrap}>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Text style={styles.monthMeta}>
              {monthOffset === 0 ? 'Current month · ' : ''}
              {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
            </Text>
          </View>

          <Pressable
            onPress={() => canGoNext && setMonthOffset((offset) => offset + 1)}
            disabled={!canGoNext}
            style={({ pressed }) => [
              styles.arrowButton,
              !canGoNext && styles.arrowDisabled,
              pressed && canGoNext && styles.arrowPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            accessibilityState={{ disabled: !canGoNext }}
          >
            <Text style={[styles.arrow, !canGoNext && styles.arrowTextDisabled]}>
              ›
            </Text>
          </Pressable>
        </View>

        {/* Headline stats for the month. */}
        <View style={styles.statsCard}>
          <View style={styles.statsTop}>
            <View style={styles.statColumn}>
              <Text style={styles.statLabel}>Money In</Text>
              <Text
                style={[styles.statValue, styles.statValueIncome]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {formatMoney(moneyIn)}
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statColumn}>
              <Text style={styles.statLabel}>Expenses</Text>
              <Text
                style={[styles.statValue, styles.statValueExpense]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {formatMoney(moneyOut)}
              </Text>
            </View>
          </View>

          <View style={styles.statsRule} />

          <Text style={styles.statLabel}>Net Remaining</Text>
          <Text
            style={[
              styles.netValue,
              netRemaining < 0 && styles.netValueNegative,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {formatMoney(netRemaining)}
          </Text>
        </View>

        {/* Where it went. */}
        <CategoryBreakdown transactions={monthTransactions} />
        <TagSummary transactions={monthTransactions} />

        {/* Unresolved IOUs carried into the next month. */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rolling into next month</Text>
          <Text style={styles.cardSubtitle}>Unresolved roommate balances</Text>

          {activeDebts.length === 0 ? (
            <Text style={styles.settledLine}>
              {formatNetBalanceLine(netRoommateBalance)}
            </Text>
          ) : (
            <>
              <Text
                style={[
                  styles.netLine,
                  netRoommateBalance > 0 && styles.netLinePositive,
                  netRoommateBalance < 0 && styles.netLineNegative,
                ]}
              >
                {formatNetBalanceLine(netRoommateBalance)}
              </Text>
              <Text style={styles.netMeta}>
                {activeDebts.length} open{' '}
                {activeDebts.length === 1 ? 'debt' : 'debts'} carried forward
              </Text>

              {activeDebts.map((debt) => (
                <View key={debt.id} style={styles.debtRow}>
                  <Text style={styles.debtPerson} numberOfLines={1}>
                    {debt.personName}
                  </Text>
                  <Text
                    style={[styles.debtAmount, { color: debtColor(debt) }]}
                    numberOfLines={1}
                  >
                    {debtLine(debt)}
                  </Text>
                </View>
              ))}
            </>
          )}

          <Text style={styles.cardFootnote}>
            IOUs are not part of your monthly spend — settle or record them on
            the Debts tab.
          </Text>
        </View>

        {/* CSV export. */}
        <Pressable
          onPress={() => void handleExport()}
          disabled={!canExport}
          style={({ pressed }) => [
            styles.exportButton,
            !canExport && styles.exportDisabled,
            pressed && canExport && styles.exportPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Export month to CSV"
          accessibilityState={{ disabled: !canExport }}
        >
          <Text style={styles.exportGlyph}>⬇</Text>
          <Text style={styles.exportLabel}>
            {isExporting ? 'Preparing…' : 'Export Month to CSV'}
          </Text>
        </Pressable>

        {entryCount === 0 ? (
          <Text style={styles.exportHint}>
            Nothing to export for {monthLabel} yet.
          </Text>
        ) : exportMessage !== null ? (
          <Text
            style={[
              styles.exportMessage,
              exportFailed && styles.exportMessageError,
            ]}
          >
            {exportMessage}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textMuted,
  },
  /* ---------------------------------------------------------------- month */
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  arrowButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.chip,
  },
  arrowPressed: {
    opacity: 0.7,
  },
  arrowDisabled: {
    opacity: 0.4,
  },
  arrow: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 28,
  },
  arrowTextDisabled: {
    color: colors.textMuted,
  },
  monthLabelWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  monthMeta: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  /* ----------------------------------------------------------------- stats */
  statsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  statsTop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statColumn: {
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  statValue: {
    marginTop: spacing.xs,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  statValueIncome: {
    color: colors.income,
  },
  statValueExpense: {
    color: colors.expense,
  },
  statsRule: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  netValue: {
    marginTop: spacing.xs,
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  netValueNegative: {
    color: colors.expense,
  },
  /* ------------------------------------------------------------ roll-over */
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  settledLine: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.income,
    paddingVertical: spacing.xs,
  },
  netLine: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  netLinePositive: {
    color: colors.income,
  },
  netLineNegative: {
    color: colors.expense,
  },
  netMeta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
  },
  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  debtPerson: {
    flex: 1,
    marginRight: spacing.sm,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  debtAmount: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  cardFootnote: {
    marginTop: spacing.md,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },
  /* ---------------------------------------------------------------- export */
  exportButton: {
    marginTop: spacing.lg,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.text,
  },
  exportDisabled: {
    backgroundColor: colors.border,
  },
  exportPressed: {
    opacity: 0.85,
  },
  exportGlyph: {
    fontSize: 15,
    color: colors.onAccent,
  },
  exportLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.onAccent,
  },
  exportHint: {
    marginTop: spacing.sm,
    fontSize: 12,
    textAlign: 'center',
    color: colors.textMuted,
  },
  exportMessage: {
    marginTop: spacing.sm,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.textMuted,
  },
  exportMessageError: {
    color: colors.expense,
  },
});
