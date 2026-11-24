// cspell:ignore neubrutalism

/**
 * Pouch — DebtCard.
 *
 * One IOU in the Debts list — with a person or a shop: counterparty,
 * amount, date and a direction tag tailored to the entity ("I Owe" /
 * "They Owe Me" vs "Shop Tab" / "Shop Owes You"), plus a single-tap
 * **Settle Up** (**Pay Tab** for shops you owe) that goes straight to
 * `settleDebt()` in the store (SQLite write first, state second).
 * Settled rows swap the button for a muted confirmation instead.
 *
 * Fills, ink, badges, borders and shadows follow the active `useTheme()`
 * tokens. `darkFlat` reproduces the old card exactly — every token
 * equals the former constant, and the two soft tint washes (which have
 * no token) keep their flat constant behind `isFlat`. `neubrutalism`
 * turns the card into a white slab — 2.5px solid black border, sharp
 * 6px corners, hard 4x4 offset shadow — with the direction tag and
 * settle button stamped in the solid money-direction accent under black
 * ink. Props, data logic and the settle interaction are untouched.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
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

  // Active mode + tokens. `isFlat` gates only the values with no token:
  // the two soft tint washes, plus the flat-only pill/small radii and
  // 1px hairline.
  const { mode, theme } = useTheme();
  const isFlat = mode === 'darkFlat';

  // Direction is always phrased from the student's point of view; a shop
  // you owe reads as a tab (baki), one that owes you as store credit.
  const directionLabel = isShop
    ? isIOwe
      ? 'Shop Tab'
      : 'Shop Owes You'
    : isIOwe
      ? 'I Owe'
      : 'They Owe Me';

  // Direction accents as tokens — darkFlat's expense/income equal the
  // old constants exactly. The soft tint washes they're painted from
  // have no token, so they stay the flat constants (brutal stamps the
  // solid accent instead).
  const directionColor = isIOwe ? theme.expense : theme.income;
  const directionSoft = isIOwe ? colors.expenseSoft : colors.incomeSoft;

  // Hard offset shadow: inert zeros in darkFlat, the paper-cut drop
  // shadow in the neo-brutalist mode.
  const hardShadow = {
    shadowColor: theme.shadowColor,
    shadowOffset: theme.shadowOffset,
    shadowOpacity: theme.shadowOpacity,
    shadowRadius: theme.shadowRadius,
    elevation: theme.elevation,
  };

  // The 2.5px black outline the brutal mode puts on the slabs; inert
  // (an empty spread) in flat, where the card keeps its 1px hairline.
  const activeSlab = isFlat
    ? {}
    : { borderWidth: theme.borderWidth, borderColor: theme.borderColor };

  // Card: surface + 1px hairline + the old `radius.md` (12 — the token
  // mirrors it) in flat; white slab with the hard shadow in brutal.
  const cardFrame = {
    backgroundColor: theme.surface,
    borderWidth: isFlat ? 1 : theme.borderWidth,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadius,
    ...hardShadow,
  };

  // Direction tag: soft tint pill in flat; in brutal it stamps solid —
  // accent fill, black slab border, sharp corners, hard shadow.
  const tagFrame = {
    backgroundColor: isFlat ? directionSoft : directionColor,
    borderRadius: isFlat ? radius.pill : theme.borderRadius,
    ...activeSlab,
    ...hardShadow,
  };
  // Tag ink: the accent itself on the flat tint, black on the solid fill.
  const tagInk = isFlat ? directionColor : theme.text;

  // Settle button: the soft tint with the old `radius.sm` (8) in flat;
  // the solid accent slab — outlined, sharp, hard-shadowed — in brutal.
  const settleFrame = {
    backgroundColor: isFlat ? directionSoft : directionColor,
    borderRadius: isFlat ? radius.sm : theme.borderRadius,
    ...activeSlab,
    ...hardShadow,
  };

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
    <View style={[styles.card, cardFrame, !isOpen && styles.cardSettled]}>
      <View style={styles.headerRow}>
        <View style={[styles.tag, tagFrame]}>
          <Text style={[styles.tagText, { color: tagInk }]}>
            {directionLabel}
          </Text>
        </View>
        {isOpen ? null : (
          <Text style={[styles.settledBadge, { color: theme.income }]}>
            Settled ✓
          </Text>
        )}
      </View>

      <View style={styles.mainRow}>
        <View style={styles.personBlock}>
          <Text
            style={[styles.personName, { color: theme.text }]}
            numberOfLines={1}
          >
            {debt.personName}
          </Text>
          <Text style={[styles.date, { color: theme.textMuted }]}>
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
            settleFrame,
            pressed && styles.settlePressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={settleA11yLabel}
        >
          <Text style={[styles.settleLabel, { color: theme.text }]}>
            {settleLabel}
          </Text>
        </Pressable>
      ) : (
        <Text style={[styles.settledDate, { color: theme.textMuted }]}>
          Settled {formatDateLong(debt.settledAt ?? debt.createdAt)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // Fill/border/radius/shadow arrive through `cardFrame` (the active
    // theme); padding stays here.
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
    // Fill/radius/border/shadow arrive through `tagFrame`.
  },
  tagText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    // `color` follows `tagInk` (inline above).
  },
  settledBadge: {
    fontSize: 12,
    fontWeight: '700',
    // `color` follows the active theme (inline above).
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
    // `color` follows the active theme (inline above).
  },
  date: {
    marginTop: 2,
    fontSize: 12,
    // `color` follows the active theme (inline above).
  },
  amount: {
    fontSize: 18,
    fontWeight: '800',
    // `color` follows the direction accent token (inline above).
  },
  settleButton: {
    marginTop: spacing.md,
    minHeight: 44,
    // Fill/radius/border/shadow arrive through `settleFrame`.
    alignItems: 'center',
    justifyContent: 'center',
  },
  settlePressed: {
    opacity: 0.75,
  },
  settleLabel: {
    fontSize: 15,
    fontWeight: '800',
    // Ink follows the active theme (inline above).
  },
  settledDate: {
    marginTop: spacing.md,
    fontSize: 12,
    // `color` follows the active theme (inline above).
  },
});
