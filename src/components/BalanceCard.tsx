/**
 * Pouch — BalanceCard.
 *
 * The hero of the Home Screen: live net balance plus the two totals it is
 * derived from, all read straight from the Zustand store (which mirrors
 * SQLite), so the numbers update the instant a transaction is logged.
 */

import { StyleSheet, Text, View } from 'react-native';

import { useFinanceStore } from '../store/useFinanceStore';
import { colors, radius, spacing } from '../theme';
import { formatMoney } from '../utils/format';

/** Days left in the current month, counting today as a whole day. */
function daysLeftInMonth(): number {
  const now = new Date();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDayOfMonth - now.getDate() + 1;
}

/**
 * The casual "pace" line under the balance. Always mentions the remaining
 * funds, and turns into a nudge when the student is over budget.
 */
function buildPaceSubtitle(netBalance: number): string {
  if (netBalance <= 0) {
    return `Over by ${formatMoney(Math.abs(netBalance))} — go easy on the next few days.`;
  }

  const daysLeft = daysLeftInMonth();
  if (daysLeft > 1) {
    const perDay = netBalance / daysLeft;
    return `Nice pace — ${formatMoney(netBalance)} left to ride out the month (≈ ${formatMoney(perDay)}/day).`;
  }

  return `Last day of the month — ${formatMoney(netBalance)} left to ride out today.`;
}

export default function BalanceCard() {
  // Individual primitive selectors: each re-renders only when its value moves.
  const netBalance = useFinanceStore((state) => state.netBalance);
  const totalIncome = useFinanceStore((state) => state.totalIncome);
  const totalExpenses = useFinanceStore((state) => state.totalExpenses);

  const isNegative = netBalance < 0;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Net Balance</Text>

      <Text
        style={[styles.balance, isNegative && styles.balanceNegative]}
        accessibilityLabel={`Net balance ${formatMoney(netBalance)}`}
      >
        {formatMoney(netBalance)}
      </Text>

      {/* Casual remaining-funds pace line. */}
      <Text style={styles.pace}>{buildPaceSubtitle(netBalance)}</Text>

      <View style={styles.divider} />

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <View style={styles.statLabelRow}>
            <View style={[styles.dot, styles.dotIncome]} />
            <Text style={styles.statLabel}>Money In</Text>
          </View>
          <Text style={[styles.statValue, styles.statValueIncome]}>
            +{formatMoney(totalIncome)}
          </Text>
        </View>

        <View style={styles.stat}>
          <View style={styles.statLabelRow}>
            <View style={[styles.dot, styles.dotExpense]} />
            <Text style={styles.statLabel}>Expenses</Text>
          </View>
          <Text style={[styles.statValue, styles.statValueExpense]}>
            -{formatMoney(totalExpenses)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    // Soft elevation; `elevation` is the Android equivalent of the shadow props.
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  balance: {
    marginTop: spacing.xs,
    fontSize: 40,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  balanceNegative: {
    color: colors.expense,
  },
  pace: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    flex: 1,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  dotIncome: {
    backgroundColor: colors.income,
  },
  dotExpense: {
    backgroundColor: colors.expense,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  statValue: {
    marginTop: spacing.xs,
    fontSize: 17,
    fontWeight: '700',
  },
  statValueIncome: {
    color: colors.income,
  },
  statValueExpense: {
    color: colors.expense,
  },
});
