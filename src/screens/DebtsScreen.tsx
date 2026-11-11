/**
 * Pouch — Debts Screen ("I Owe / They Owe").
 *
 * The roommate, friend & shop-tab (baki) tracker:
 *  - three independent totals — money lent out ("They owe you"), owed to
 *    people ("I owe") and owed to shops ("Shop tab") — each summed from
 *    its own bucket and never netted across people or shops, updated in
 *    the same tick as the list,
 *  - an All / I Owe / They Owe Me / Shops segmented filter,
 *  - a switch to reveal settled debts,
 *  - a scrollable list of `DebtCard`s and a floating **+ Add Debt** button.
 *
 * Data comes from the store only — SQLite writes happen inside the store's
 * actions, so this screen never touches the database directly.
 */

import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AddDebtModal from '../components/AddDebtModal';
import DebtCard from '../components/DebtCard';
import { useFinanceStore } from '../store/useFinanceStore';
import { colors, radius, spacing } from '../theme';
import { formatMoney } from '../utils/format';

/** List filter: everything, by direction, or only shop entries. */
type DebtFilter = 'all' | 'you_owe' | 'owed_to_you' | 'shops';

const FILTERS: { key: DebtFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'you_owe', label: 'I Owe' },
  { key: 'owed_to_you', label: 'They Owe Me' },
  { key: 'shops', label: 'Shops' },
];

export default function DebtsScreen() {
  // Store selectors: the totals and list derive from the same state.
  const debts = useFinanceStore((state) => state.debts);
  const activeDebts = useFinanceStore((state) => state.activeDebts);
  const totalLentOut = useFinanceStore((state) => state.totalLentOut);
  const totalBorrowed = useFinanceStore((state) => state.totalBorrowed);
  const totalShopTab = useFinanceStore((state) => state.totalShopTab);

  const [filter, setFilter] = useState<DebtFilter>('all');
  const [showSettled, setShowSettled] = useState(false);

  // Modal visibility plus a session counter: bumping it remounts the sheet
  // so each open starts with a clean form (RN's Modal keeps children alive
  // while hidden).
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSession, setModalSession] = useState(0);

  const openModal = (): void => {
    setModalSession((session) => session + 1);
    setIsModalOpen(true);
  };
  const closeModal = (): void => setIsModalOpen(false);

  // The store already returns debts open-first, then newest — filtering
  // preserves that order, so no re-sorting is needed here.
  const visibleDebts = useMemo(
    () =>
      debts.filter((debt) => {
        if (!showSettled && debt.status !== 'open') return false;
        if (filter === 'all') return true;
        if (filter === 'shops') return debt.entityType === 'shop';
        return debt.type === filter;
      }),
    [debts, filter, showSettled],
  );

  /** Empty copy that explains *which* view is empty. */
  const emptyMessage = (): string => {
    if (debts.length === 0) {
      return 'Tap + Add Debt to record your first IOU.';
    }
    if (visibleDebts.length === 0 && filter === 'shops') {
      return 'No shop entries yet — add a dokan tab with + Add Debt.';
    }
    if (visibleDebts.length === 0 && filter !== 'all') {
      return 'Nothing in this direction yet.';
    }
    if (visibleDebts.length === 0 && !showSettled) {
      return 'All settled here — turn on "Show settled" to look back.';
    }
    return 'Nothing to show in this view.';
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Debts</Text>
        <Text style={styles.tagline}>Roommates, friends & shop tabs.</Text>
      </View>

      {/* Independent totals — lent, owed to people and owed to shops are
          never netted against each other or across entities. */}
      <View style={styles.banner}>
        <View style={styles.bannerColumns}>
          <View style={styles.bannerColumn}>
            <Text style={styles.bannerLabel}>They owe you</Text>
            <Text
              style={[styles.bannerValue, styles.bannerValuePositive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              accessibilityLabel={`They owe you ${formatMoney(totalLentOut)}`}
            >
              {formatMoney(totalLentOut)}
            </Text>
          </View>

          <View style={styles.bannerDivider} />

          <View style={styles.bannerColumn}>
            <Text style={styles.bannerLabel}>I owe</Text>
            <Text
              style={[styles.bannerValue, styles.bannerValueNegative]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              accessibilityLabel={`I owe ${formatMoney(totalBorrowed)}`}
            >
              {formatMoney(totalBorrowed)}
            </Text>
          </View>
        </View>

        {/* Running shop tab (baki) — shown only while one is open. */}
        {totalShopTab > 0 ? (
          <View style={styles.bannerShopRow}>
            <Text style={styles.bannerLabel}>Shop tab</Text>
            <Text
              style={styles.bannerShopValue}
              accessibilityLabel={`Shop tab ${formatMoney(totalShopTab)}`}
            >
              {formatMoney(totalShopTab)}
            </Text>
          </View>
        ) : null}

        <Text style={styles.bannerMeta}>
          {activeDebts.length} open {activeDebts.length === 1 ? 'debt' : 'debts'}
        </Text>
      </View>

      {/* Segmented filter. */}
      <View style={styles.filterRow}>
        {FILTERS.map((option) => {
          const isActive = option.key === filter;
          return (
            <Pressable
              key={option.key}
              onPress={() => setFilter(option.key)}
              style={({ pressed }) => [
                styles.filterButton,
                isActive && styles.filterButtonActive,
                pressed && styles.filterPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                // Four chips share the row; long labels shrink, not clip.
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={[
                  styles.filterLabel,
                  isActive && styles.filterLabelActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Settled-debt visibility. */}
      <View style={styles.optionsRow}>
        <Text style={styles.optionsLabel}>Show settled</Text>
        <Switch
          value={showSettled}
          onValueChange={setShowSettled}
          trackColor={{ false: colors.border, true: colors.income }}
          thumbColor={colors.surface}
          accessibilityLabel="Show settled debts"
        />
      </View>

      <FlatList
        data={visibleDebts}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <DebtCard debt={item} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          visibleDebts.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🤝</Text>
            <Text style={styles.emptyTitle}>No debts here</Text>
            <Text style={styles.emptyText}>{emptyMessage()}</Text>
          </View>
        }
      />

      {/* Floating action button. */}
      <Pressable
        onPress={openModal}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Add debt"
      >
        <Text style={styles.fabLabel}>+ Add Debt</Text>
      </Pressable>

      <AddDebtModal
        key={modalSession}
        visible={isModalOpen}
        onClose={closeModal}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
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
  banner: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  // Two side-by-side columns, split by a hairline — one per direction.
  bannerColumns: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  bannerColumn: {
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
  bannerDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  // Shop-tab row under the two columns, hairline-separated.
  bannerShopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bannerShopValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.expense,
    letterSpacing: -0.2,
  },
  bannerLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  bannerValue: {
    marginTop: spacing.xs,
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  bannerValuePositive: {
    color: colors.income,
  },
  bannerValueNegative: {
    color: colors.expense,
  },
  bannerMeta: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.textMuted,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  filterButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.chipActive,
  },
  filterPressed: {
    opacity: 0.75,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  filterLabelActive: {
    color: colors.onAccent,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  optionsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  listContent: {
    paddingBottom: 96,
  },
  // Centres the empty state in the available space.
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
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
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    // Lift the pill off the list so it reads as floating.
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  fabPressed: {
    opacity: 0.85,
  },
  fabLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.onAccent,
  },
});
