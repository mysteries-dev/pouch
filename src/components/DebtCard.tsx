/**
 * Pouch — DebtCard.
 *
 * One IOU in the Debts list — with a person or a shop: counterparty,
 * amount, date and a direction tag tailored to the entity ("I Owe" /
 * "They Owe Me" vs "Shop Tab" / "Shop Owes You"), plus a single-tap
 * **Settle Up** (**Pay Tab** for shops you owe) that goes straight to
 * `settleDebt()` in the store (SQLite write first, state second).
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
  const isShop = debt.entityType === 'shop';

  // Direction is always phrased from the student's point of view; a shop
  // you owe reads as a tab (baki), one that owes you as store credit.
  const directionLabel = isShop
    ? isIOwe
      ? 'Shop Tab'
      : 'Shop Owes You'
    : isIOwe
      ? 'I Owe'
      : 'They Owe Me';
  const directionColor = isIOwe ? colors.expense : colors.income;
  const directionSoft = isIOwe ? colors.expenseSoft : colors.incomeSoft;

  // Spoken label spells the full relationship for tabs: "Tab with
  // Bhai Bhai Dokan: Tk 150.00".
  const amountLabel =
    isShop && isIOwe
      ? `Tab with ${debt.personName}: ${formatMoney(debt.amount)}`
      : `${directionLabel} ${formatMoney(debt.amount)}`;

  // Paying a tab is settling, but the button says what really happens.
  const settleLabel =
    isShop && isIOwe ? 'Pay Tab' : 'Settle Up';
  const settleA11yLabel =
    isShop && isIOwe
      ? `Pay tab at ${debt.personName}`
      : `Settle up with ${debt.personName}`;

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
          <Text style={styles.date}>
            {isShop ? 'Shop · Added ' : 'Added '}
            {formatDateLong(debt.createdAt)}
          </Text>
        </View>

        <Text
          style={[styles.amount, { color: directionColor }]}
          accessibilityLabel={amountLabel}
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
          accessibilityLabel={settleA11yLabel}
        >
          <Text style={styles.settleLabel}>{settleLabel}</Text>
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
