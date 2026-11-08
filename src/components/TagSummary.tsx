/**
 * Pouch — TagSummary.
 *
 * Spending isolated by custom event tag: how much a tagged event such as
 * `#ApartmentMove` actually cost this month, plus how much of the month's
 * outflow those tags account for overall.
 *
 * Like `CategoryBreakdown`, it receives an already month-filtered list and
 * only ever looks at `expense` rows — tags on income are ignored so the
 * figures stay a true measure of spending.
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Transaction } from '../db/schema';
import { colors, radius, spacing } from '../theme';
import { formatMoney, roundMoney } from '../utils/format';

export interface TagSummaryProps {
  /** Every transaction in the selected month, both `income` and `expense`. */
  transactions: Transaction[];
}

/** One aggregated tag, ready to render. */
interface TagSlice {
  /** Tag exactly as stored (no leading `#`), e.g. `ApartmentMove`. */
  tag: string;
  /** Sum of expenses carrying this tag (2-dp rounded). */
  total: number;
  /** How many expenses carry it. */
  count: number;
}

export default function TagSummary({ transactions }: TagSummaryProps) {
  const { slices, taggedTotal, totalExpenses } = useMemo(() => {
    const byTag = new Map<string, { total: number; count: number }>();
    let expenses = 0;

    for (const transaction of transactions) {
      if (transaction.type !== 'expense') continue;
      expenses += transaction.amount;

      // Normalise defensively: the logger strips a leading `#` and trims,
      // but an empty tag must not become its own row.
      const tag = transaction.tag?.trim();
      if (!tag) continue;

      const bucket = byTag.get(tag) ?? { total: 0, count: 0 };
      bucket.total += transaction.amount;
      bucket.count += 1;
      byTag.set(tag, bucket);
    }

    const all: TagSlice[] = [...byTag.entries()]
      .map(([tag, bucket]) => ({
        tag,
        total: roundMoney(bucket.total),
        count: bucket.count,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      slices: all,
      taggedTotal: roundMoney(
        all.reduce((sum, slice) => sum + slice.total, 0),
      ),
      totalExpenses: roundMoney(expenses),
    };
  }, [transactions]);

  /** Share of the month's spending that carries a tag, 0–100. */
  const taggedPercent =
    totalExpenses > 0 ? Math.round((taggedTotal / totalExpenses) * 100) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Spending by tag</Text>
        <Text style={styles.headerTotal}>{formatMoney(taggedTotal)}</Text>
      </View>
      <Text style={styles.subtitle}>
        {slices.length > 0
          ? `${taggedPercent}% of this month's spending · ${
              slices.length === 1 ? '1 tag' : `${slices.length} tags`
            }`
          : 'No tagged spending'}
      </Text>

      {slices.length === 0 ? (
        <Text style={styles.empty}>
          Nothing tagged yet. Add a tag when you log an expense — such as{' '}
          <Text style={styles.emptyEmphasis}>#ApartmentMove</Text> or{' '}
          <Text style={styles.emptyEmphasis}>#ExamWeek</Text> — and it will be
          totalled here.
        </Text>
      ) : (
        slices.map((slice) => {
          // Share of *all* spending, so an event's weight in the month is
          // obvious even when other tags are present.
          const percent =
            totalExpenses > 0
              ? Math.round((slice.total / totalExpenses) * 100)
              : 0;

          return (
            <View key={slice.tag} style={styles.row}>
              <View style={styles.tagChip}>
                <Text style={styles.tagText} numberOfLines={1}>
                  #{slice.tag}
                </Text>
              </View>

              <View style={styles.rowBody}>
                <Text style={styles.amount}>{formatMoney(slice.total)}</Text>
                <Text style={styles.meta}>
                  {slice.count} {slice.count === 1 ? 'entry' : 'entries'} ·{' '}
                  {percent}% of spending
                </Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  headerTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  empty: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },
  emptyEmphasis: {
    fontWeight: '700',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  tagChip: {
    backgroundColor: colors.chip,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    maxWidth: '48%',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  rowBody: {
    flex: 1,
    marginLeft: spacing.md,
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  meta: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textMuted,
  },
});
