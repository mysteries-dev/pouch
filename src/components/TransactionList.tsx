/**
 * Pouch — TransactionList.
 *
 * The recent-activity feed: transactions grouped into day sections
 * (`Today`, `Yesterday`, …) with a category icon and signed amount.
 * Presentational on purpose — it takes `transactions` as a prop, so the
 * Home Screen owns the store subscription and this stays easy to reuse.
 */

import { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import type { SectionListRenderItemInfo } from 'react-native';

import type { Transaction } from '../db/schema';
import { colors, radius, spacing } from '../theme';
import {
  formatClockTime,
  formatDateHeader,
  formatMoney,
  localDateKey,
} from '../utils/format';

/** One day's worth of rows, plus the header label shown above it. */
interface TransactionSection {
  title: string;
  data: Transaction[];
}

/** Emoji per preset category; unknown categories fall back by type. */
const CATEGORY_ICONS: Record<string, string> = {
  'food/snack': '🍜',
  transport: '🚌',
  bills: '🧾',
  academic: '📚',
  personal: '🎒',
  allowance: '👛',
  'part-time': '💼',
  gift: '🎁',
  scholarship: '🎓',
  other: '💡',
};

/** Picks the row's emoji: category first, then a type-based default. */
function iconFor(transaction: Transaction): string {
  const icon = CATEGORY_ICONS[transaction.category.trim().toLowerCase()];
  if (icon) return icon;
  return transaction.type === 'income' ? '💰' : '💸';
}

/** Secondary line: `#tag · note · 14:05`, skipping anything empty. */
function buildMeta(transaction: Transaction): string {
  const parts: string[] = [];
  if (transaction.tag) parts.push(`#${transaction.tag}`);
  if (transaction.note) parts.push(transaction.note);
  parts.push(formatClockTime(transaction.createdAt));
  return parts.join(' · ');
}

/**
 * Groups an already newest-first list into day sections.
 * Input order is preserved, so sections come out newest-first too.
 */
function groupByDay(transactions: Transaction[]): TransactionSection[] {
  const sections: TransactionSection[] = [];
  const indexByKey = new Map<string, number>();

  for (const transaction of transactions) {
    const key = localDateKey(transaction.createdAt);
    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      indexByKey.set(key, sections.length);
      sections.push({
        title: formatDateHeader(transaction.createdAt),
        data: [transaction],
      });
    } else {
      sections[existingIndex].data.push(transaction);
    }
  }

  return sections;
}

/**
 * Module-level renderers: stable references, so `SectionList` (a
 * `PureComponent`) never re-renders solely because a callback identity
 * changed on the parent.
 */
function renderRow({
  item,
}: SectionListRenderItemInfo<Transaction, TransactionSection>) {
  const isIncome = item.type === 'income';
  const iconBackground = isIncome ? colors.incomeSoft : colors.chip;

  return (
    <View style={styles.row}>
      <View style={[styles.iconCircle, { backgroundColor: iconBackground }]}>
        <Text style={styles.icon}>{iconFor(item)}</Text>
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.category} numberOfLines={1}>
          {item.category}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {buildMeta(item)}
        </Text>
      </View>

      <Text
        style={[
          styles.amount,
          { color: isIncome ? colors.income : colors.expense },
        ]}
      >
        {isIncome ? '+' : '−'}
        {formatMoney(item.amount)}
      </Text>
    </View>
  );
}

function renderSectionHeader({
  section,
}: {
  section: TransactionSection;
}) {
  return <Text style={styles.sectionHeader}>{section.title}</Text>;
}

/** Friendly placeholder shown before the first entry exists. */
function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>🪙</Text>
      <Text style={styles.emptyTitle}>Nothing logged yet</Text>
      <Text style={styles.emptyText}>
        Tap + Expense or + Money In to record your first entry.
      </Text>
    </View>
  );
}

export interface TransactionListProps {
  /** Newest-first transaction list, straight from the store. */
  transactions: Transaction[];
}

export default function TransactionList({
  transactions,
}: TransactionListProps) {
  // Regroup only when the list actually changes (a new entry, a load, etc.).
  const sections = useMemo(() => groupByDay(transactions), [transactions]);

  return (
    <SectionList<Transaction, TransactionSection>
      sections={sections}
      renderItem={renderRow}
      renderSectionHeader={renderSectionHeader}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={EmptyState}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.listContent,
        sections.length === 0 && styles.listContentEmpty,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing.xl,
  },
  // Lets the empty state centre itself in the available space.
  listContentEmpty: {
    flexGrow: 1,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    backgroundColor: colors.background,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  icon: {
    fontSize: 18,
  },
  rowBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  category: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  meta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  emptyText: {
    marginTop: spacing.xs,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
