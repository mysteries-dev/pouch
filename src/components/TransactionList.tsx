// cspell:ignore neubrutalism

/**
 * Pouch — TransactionList.
 *
 * The recent-activity feed: transactions grouped into day sections
 * (`Today`, `Yesterday`, …) with a category icon and signed amount.
 * Presentational on purpose — it takes `transactions` as a prop, so the
 * Home Screen owns the store subscription and this stays easy to reuse.
 *
 * Fills, ink, borders and shadows follow the active `useTheme()`
 * tokens. `darkFlat` reproduces the old feed exactly — every token
 * equals the former constant, and the icon chip's two fill values (a
 * soft tint and the chip wash, neither with a token) keep their flat
 * constant behind `isFlat`. `neubrutalism` turns each row into a white
 * slab — 2.5px solid black border, sharp 6px corners, hard 4x4 offset
 * shadow — with the icon chip stamped in a bordered accent square.
 * Props, grouping and formatting logic are untouched.
 */

import { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import type { SectionListRenderItemInfo } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import type { Transaction } from '../db/schema';
import { colors, spacing } from '../theme';
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
 * One feed row. A real component (not a bare render callback) so the
 * theme context reaches it directly — context updates re-render this
 * instance even while `SectionList` itself stays pure.
 */
function TransactionRow({
  item,
}: SectionListRenderItemInfo<Transaction, TransactionSection>) {
  const { mode, theme } = useTheme();
  const isFlat = mode === 'darkFlat';
  const isIncome = item.type === 'income';

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
  // (an empty spread) in flat, where the row keeps its 1px hairline.
  const activeSlab = isFlat
    ? {}
    : { borderWidth: theme.borderWidth, borderColor: theme.borderColor };

  // Row: surface + 1px hairline + the old `radius.md` (12 — the token
  // mirrors it) in flat; white slab with the hard shadow in brutal.
  const rowFrame = {
    backgroundColor: theme.surface,
    borderWidth: isFlat ? 1 : theme.borderWidth,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadius,
    ...hardShadow,
  };

  // Icon chip: the soft income tint / neutral chip wash in flat (neither
  // has a token, so both stay flat constants); in brutal it stamps as a
  // bordered accent square — solid money-direction fill for income, the
  // white surface for expense.
  const iconFrame = {
    backgroundColor: isFlat
      ? isIncome
        ? colors.incomeSoft
        : colors.chip
      : isIncome
        ? theme.income
        : theme.surface,
    // Full circle in flat (half of the 40px chip), sharp in brutal.
    borderRadius: isFlat ? 20 : theme.borderRadius,
    ...activeSlab,
    ...hardShadow,
  };

  return (
    <View style={[styles.row, rowFrame]}>
      <View style={[styles.iconCircle, iconFrame]}>
        <Text style={styles.icon}>{iconFor(item)}</Text>
      </View>

      <View style={styles.rowBody}>
        <Text style={[styles.category, { color: theme.text }]} numberOfLines={1}>
          {item.category}
        </Text>
        <Text style={[styles.meta, { color: theme.textMuted }]} numberOfLines={1}>
          {buildMeta(item)}
        </Text>
      </View>

      <Text
        style={[
          styles.amount,
          { color: isIncome ? theme.income : theme.expense },
        ]}
      >
        {isIncome ? '+' : '−'}
        {formatMoney(item.amount)}
      </Text>
    </View>
  );
}

/**
 * Module-level renderer: a stable reference, so `SectionList` (a
 * `PureComponent`) never re-renders solely because a callback identity
 * changed on the parent. Theming lives in `TransactionRow`, so this
 * wrapper stays a pure element factory.
 */
function renderRow(
  info: SectionListRenderItemInfo<Transaction, TransactionSection>,
) {
  return <TransactionRow {...info} />;
}

/** Day header component — consumes the theme in its own fiber. */
function SectionHeader({ section }: { section: TransactionSection }) {
  const { theme } = useTheme();
  return (
    <Text
      style={[
        styles.sectionHeader,
        {
          color: theme.textMuted,
          backgroundColor: theme.background,
        },
      ]}
    >
      {section.title}
    </Text>
  );
}

/** Stable module-level wrapper — see `renderRow`. */
function renderSectionHeader({
  section,
}: {
  section: TransactionSection;
}) {
  return <SectionHeader section={section} />;
}

/** Friendly placeholder shown before the first entry exists. */
function EmptyState() {
  const { theme } = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>🪙</Text>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        Nothing logged yet
      </Text>
      <Text style={[styles.emptyText, { color: theme.textMuted }]}>
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
    // Ink + canvas arrive through the active theme (inline above).
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // Fill/border/radius/shadow arrive through `rowFrame`.
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    // `borderRadius` follows the mode (circle in flat, sharp in brutal).
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
    // `color` follows the active theme (inline above).
  },
  meta: {
    marginTop: 2,
    fontSize: 12,
    // `color` follows the active theme (inline above).
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    // `color` follows the direction accent token (inline above).
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
    // `color` follows the active theme (inline above).
  },
  emptyText: {
    marginTop: spacing.xs,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    // `color` follows the active theme (inline above).
  },
});
