/**
 * Pouch — CategoryBreakdown.
 *
 * Where the money went this month: expenses aggregated by category and
 * drawn as horizontal bars sized by their share of the month's total
 * outflow, each labelled with an amount and a percentage.
 *
 * The component is handed the selected month's transactions and does no
 * date maths of its own — the parent owns month filtering, so the bars,
 * the stat totals and the CSV export can never disagree about the period
 * being shown.
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Transaction } from '../db/schema';
import { colors, radius, spacing } from '../theme';
import { formatMoney, roundMoney } from '../utils/format';

export interface CategoryBreakdownProps {
  /** Every transaction in the selected month, both `income` and `expense`. */
  transactions: Transaction[];
  /** How many categories to draw before folding the remainder into a note. */
  limit?: number;
}

/** One aggregated category, ready to render. */
interface CategorySlice {
  /** Category name exactly as stored, e.g. `Food`. */
  category: string;
  /** Sum of that category's expenses (2-dp rounded). */
  total: number;
  /** How many transactions it covers. */
  count: number;
  /** Unrounded share of the month's spending, 0–100 — drives bar width. */
  ratio: number;
  /** Rounded share, for the percentage label. */
  percent: number;
}

export default function CategoryBreakdown({
  transactions,
  limit = 6,
}: CategoryBreakdownProps) {
  const { slices, totalSpent, hidden } = useMemo(() => {
    // Income never belongs in a spending chart, so expenses only.
    const byCategory = new Map<string, { total: number; count: number }>();
    let spent = 0;

    for (const transaction of transactions) {
      if (transaction.type !== 'expense') continue;

      const bucket = byCategory.get(transaction.category) ?? {
        total: 0,
        count: 0,
      };
      bucket.total += transaction.amount;
      bucket.count += 1;
      byCategory.set(transaction.category, bucket);
      spent += transaction.amount;
    }

    // Largest first, so the head of the list is always the headline number.
    const all: CategorySlice[] = [...byCategory.entries()]
      .map(([category, bucket]) => {
        const ratio = spent > 0 ? (bucket.total / spent) * 100 : 0;
        return {
          category,
          total: roundMoney(bucket.total),
          count: bucket.count,
          ratio,
          percent: Math.round(ratio),
        };
      })
      .sort((a, b) => b.total - a.total);

    return {
      slices: all.slice(0, limit),
      totalSpent: roundMoney(spent),
      hidden: all.slice(limit),
    };
  }, [transactions, limit]);

  /** Sum of everything past the cut, so the footer can quantify it. */
  const hiddenTotal = roundMoney(
    hidden.reduce((sum, slice) => sum + slice.total, 0),
  );

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Spending by category</Text>
        <Text style={styles.headerTotal}>{formatMoney(totalSpent)}</Text>
      </View>
      <Text style={styles.subtitle}>
        {slices.length > 0
          ? `Top ${slices.length} of ${slices.length + hidden.length} ${
              slices.length + hidden.length === 1 ? 'category' : 'categories'
            }`
          : 'Nothing spent yet'}
      </Text>

      {slices.length === 0 ? (
        <Text style={styles.empty}>
          No spending recorded in this month yet.
        </Text>
      ) : (
        <>
          {slices.map((slice) => (
            <View key={slice.category} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.category} numberOfLines={1}>
                  {slice.category}
                </Text>
                <Text style={styles.amount}>{formatMoney(slice.total)}</Text>
              </View>

              {/* Track + fill: the fill's width is the category's share. */}
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    // A 2% floor keeps a hairline category visible.
                    { width: `${Math.max(slice.ratio, 2)}%` },
                  ]}
                />
              </View>

              <View style={styles.rowFooter}>
                <Text style={styles.count}>
                  {slice.count} {slice.count === 1 ? 'entry' : 'entries'}
                </Text>
                <Text style={styles.percent}>{slice.percent}%</Text>
              </View>
            </View>
          ))}

          {/* Anything past the cut is still accounted for, just not drawn. */}
          {hidden.length > 0 ? (
            <Text style={styles.footerNote}>
              +{hidden.length} more {hidden.length === 1 ? 'category' : 'categories'}{' '}
              · {formatMoney(hiddenTotal)}
            </Text>
          ) : null}
        </>
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
    color: colors.expense,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  empty: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },
  row: {
    marginTop: spacing.md,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  category: {
    flex: 1,
    marginRight: spacing.sm,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  track: {
    height: 8,
    marginTop: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.chip,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.expense,
  },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  count: {
    fontSize: 11,
    color: colors.textMuted,
  },
  percent: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.expense,
  },
  footerNote: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    fontSize: 12,
    color: colors.textMuted,
  },
});
