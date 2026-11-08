/**
 * Pouch — Home Screen.
 *
 * Layout, top to bottom: brand header, live BalanceCard, the two primary
 * logging actions, an optional store-error banner, and the scrollable
 * transaction feed. The card and buttons stay fixed while the feed scrolls,
 * so logging is always one tap away.
 */

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BalanceCard from '../components/BalanceCard';
import FastLoggerModal from '../components/FastLoggerModal';
import TransactionList from '../components/TransactionList';
import type { TransactionType } from '../db/schema';
import { useFinanceStore } from '../store/useFinanceStore';
import { colors, radius, spacing } from '../theme';

export default function HomeScreen() {
  // Store subscription: the feed re-renders whenever SQLite-backed state moves.
  const transactions = useFinanceStore((state) => state.transactions);
  const error = useFinanceStore((state) => state.error);
  const clearError = useFinanceStore((state) => state.clearError);

  // Which logger tab to open next; `expense` is the default workflow.
  const [isLoggerOpen, setIsLoggerOpen] = useState(false);
  const [loggerType, setLoggerType] = useState<TransactionType>('expense');
  // Bumped on every open: the resulting `key` remounts the sheet, so each
  // session starts with a clean form (RN's Modal keeps hidden children alive,
  // which means the sheet's own state would otherwise survive a close).
  const [loggerSession, setLoggerSession] = useState(0);

  const openLogger = useCallback((type: TransactionType) => {
    setLoggerType(type);
    setLoggerSession((session) => session + 1);
    setIsLoggerOpen(true);
  }, []);

  const closeLogger = useCallback(() => setIsLoggerOpen(false), []);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Pouch</Text>
        <Text style={styles.tagline}>Money logged in 3 seconds.</Text>
      </View>

      <BalanceCard />

      {/* Two primary actions, green for money in, accent red for expenses. */}
      <View style={styles.actions}>
        <Pressable
          onPress={() => openLogger('income')}
          style={({ pressed }) => [
            styles.actionButton,
            styles.incomeButton,
            pressed && styles.actionPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add money in"
        >
          <Text style={styles.actionLabel}>+ Money In</Text>
        </Pressable>

        <Pressable
          onPress={() => openLogger('expense')}
          style={({ pressed }) => [
            styles.actionButton,
            styles.expenseButton,
            pressed && styles.actionPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add expense"
        >
          <Text style={styles.actionLabel}>+ Expense</Text>
        </Pressable>
      </View>

      {/* Store errors (failed writes, bad input) surface here; tap to dismiss. */}
      {error !== null ? (
        <Pressable
          onPress={clearError}
          style={styles.errorBanner}
          accessibilityRole="button"
          accessibilityLabel="Dismiss error"
        >
          <Text style={styles.errorText}>{error}</Text>
        </Pressable>
      ) : null}

      <View style={styles.feed}>
        <TransactionList transactions={transactions} />
      </View>

      <FastLoggerModal
        key={loggerSession}
        visible={isLoggerOpen}
        initialType={loggerType}
        onClose={closeLogger}
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
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomeButton: {
    backgroundColor: colors.income,
  },
  expenseButton: {
    backgroundColor: colors.expense,
  },
  actionPressed: {
    opacity: 0.9,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.onAccent,
  },
  errorBanner: {
    backgroundColor: colors.expenseSoft,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: 13,
    color: colors.expense,
    textAlign: 'center',
  },
  feed: {
    flex: 1,
  },
});
