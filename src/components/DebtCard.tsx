/**
 * Pouch — DebtCard.
 *
 * One IOU in the Debts list: person, amount, date and the direction tag
 * ("I Owe" vs "They Owe Me"), plus a single-tap **Settle Up** that goes
 * straight to `settleDebt()` in the store (SQLite write first, state second).
 * Settled rows swap the button for a muted confirmation instead.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Debt } from '../db/schema';
import { useFinanceStore } from '../store/useFinanceStore';
import { colors, radius, spacing } from '../theme';
import { formatDateLong, formatMoney } from '../utils/format';

export interface DebtCardProps {
  /** The IOU to render. */
  debt: Debt;
}

export default function DebtCard({ debt }: DebtCardProps) {
  // Store action: persists the settlement plus the repayment movement it
  // triggers, and updates `debts` / `activeDebts` / the direction totals
  // / money totals in the same tick.
  const settleDebt = useFinanceStore((state) => state.settleDebt);

  const isOpen = debt.status === 'open';
  const isIOwe = debt.type === 'you_owe';

  // Direction is always phrased from the student's point of view.
  const directionLabel = isIOwe ? 'I Owe' : 'They Owe Me';
  const directionColor = isIOwe ? colors.expense : colors.income;
  const directionSoft = isIOwe ? colors.expenseSoft : colors.incomeSoft;

  return (
    <View style={[styles.card, !isOpen && styles.cardSettled]}>
      <View style={styles.headerRow}>
        <View style={[styles.tag, { backgroundColor: directionSoft }]}>
          <Text style={[styles.tagText, { color: directionColor }]}>
            {directionLabel}
          </Text>
        </View>
        {isOpen ? null : <Text style={styles.settledBadge}>Settled ✓</Text>}
      </View>

      <View style={styles.mainRow}>
        <View style={styles.personBlock}>
          <Text style={styles.personName} numberOfLines={1}>
            {debt.personName}
          </Text>
          <Text style={styles.date}>Added {formatDateLong(debt.createdAt)}</Text>
        </View>

        <Text
          style={[styles.amount, { color: directionColor }]}
          accessibilityLabel={`${directionLabel} ${formatMoney(debt.amount)}`}
        >
          {formatMoney(debt.amount)}
        </Text>
      </View>

      {isOpen ? (
        <Pressable
          onPress={() => void settleDebt(debt.id)}
          style={({ pressed }) => [
            styles.settleButton,
            isIOwe ? styles.settleButtonIOwe : styles.settleButtonTheyOwe,
            pressed && styles.settlePressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Settle up with ${debt.personName}`}
        >
          <Text style={styles.settleLabel}>Settle Up</Text>
        </Pressable>
      ) : (
        <Text style={styles.settledDate}>
          Settled {formatDateLong(debt.settledAt ?? debt.createdAt)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  // Settled rows recede visually but stay readable when opted in.
  cardSettled: {
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  tag: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  settledBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.income,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  personBlock: {
    flex: 1,
    marginRight: spacing.sm,
  },
  personName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  date: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
  },
  amount: {
    fontSize: 18,
    fontWeight: '800',
  },
  settleButton: {
    marginTop: spacing.md,
    minHeight: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleButtonIOwe: {
    backgroundColor: colors.expenseSoft,
  },
  settleButtonTheyOwe: {
    backgroundColor: colors.incomeSoft,
  },
  settlePressed: {
    opacity: 0.75,
  },
  settleLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  settledDate: {
    marginTop: spacing.md,
    fontSize: 12,
    color: colors.textMuted,
  },
});
