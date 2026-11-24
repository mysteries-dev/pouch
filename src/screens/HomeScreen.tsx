/**
 * Pouch — Home Screen.
 *
 * Layout, top to bottom: brand header (title + the ThemeToggle), live
 * BalanceCard, the two primary logging actions, an optional store-error
 * banner, and the scrollable transaction feed. The card and buttons stay
 * fixed while the feed scrolls, so logging is always one tap away.
 *
 * Color/border/shadow values come from `useTheme()`. Every token equals
 * the old constant in `darkFlat`, so that mode renders exactly as
 * before; in the neo-brutalist mode the buttons, balance frame and error
 * banner pick up the thick solid border, sharp corners and hard offset
 * shadow. The banner's flat-only details (hairline, 8px radius, soft
 * tint) have no token, so they keep their exact flat value in `darkFlat`
 * and switch with the mode otherwise. Balance calculations, lists and
 * button handlers are untouched.
 */

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../context/ThemeContext';
import BalanceCard from '../components/BalanceCard';
import FastLoggerModal from '../components/FastLoggerModal';
import ThemeToggle from '../components/ThemeToggle';
import TransactionList from '../components/TransactionList';
import type { TransactionType } from '../db/schema';
import { useFinanceStore } from '../store/useFinanceStore';
import { colors, radius, spacing } from '../theme';

export default function HomeScreen() {
  // Store subscription: the feed re-renders whenever SQLite-backed state moves.
  const transactions = useFinanceStore((state) => state.transactions);
  const error = useFinanceStore((state) => state.error);
  const clearError = useFinanceStore((state) => state.clearError);

  // Active mode + tokens; `isFlat` gates the few values that have no token.
  const { mode, theme } = useTheme();
  const isFlat = mode === 'darkFlat';

  // Ink on the bright semantic fills: the inverse of text-on-canvas —
  // darkFlat's #111512, the neo-brutalist mode's #111111 — clearing
  // >= 6.5:1 on every fill in either palette.
  const inkOnFill = isFlat ? theme.background : theme.text;

  // Hard offset shadow: inert zeros in darkFlat, the paper-cut drop
  // shadow in the neo-brutalist mode.
  const hardShadow = {
    shadowColor: theme.shadowColor,
    shadowOffset: theme.shadowOffset,
    shadowOpacity: theme.shadowOpacity,
    shadowRadius: theme.shadowRadius,
    elevation: theme.elevation,
  };

  // Frame shared by the action buttons (and, spread with a fill, the
  // balance wrapper): flat lands width 0 / opacity 0 — pixel-identical
  // to the previous styles — while the neo-brutalist mode gets the
  // thick solid border, sharp corners and hard shadow.
  const slabFrame = {
    borderRadius: theme.borderRadius,
    borderWidth: theme.borderWidth,
    borderColor: theme.borderColor,
    ...hardShadow,
  };

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
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right']}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.text }]}>Pouch</Text>
          <ThemeToggle />
        </View>
        <Text style={[styles.tagline, { color: theme.textMuted }]}>
          Money logged in 3 seconds.
        </Text>
      </View>

      {/* Balance container: unstyled in darkFlat (the card renders exactly
          as always); in the neo-brutalist mode it becomes a white slab —
          thick solid border, sharp corners, hard offset shadow — with the
          card's own surface filling it. */}
      <View
        style={
          isFlat ? undefined : { backgroundColor: theme.surface, ...slabFrame }
        }
      >
        <BalanceCard />
      </View>

      {/* Two primary actions — the fill follows the direction of money:
          `theme.income` for cash in, `theme.expense` for cash out. */}
      <View style={styles.actions}>
        <Pressable
          onPress={() => openLogger('income')}
          style={({ pressed }) => [
            styles.actionButton,
            slabFrame,
            { backgroundColor: theme.income },
            pressed && styles.actionPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add money in"
        >
          <Text style={[styles.actionLabel, { color: inkOnFill }]}>
            + Money In
          </Text>
        </Pressable>

        <Pressable
          onPress={() => openLogger('expense')}
          style={({ pressed }) => [
            styles.actionButton,
            slabFrame,
            { backgroundColor: theme.expense },
            pressed && styles.actionPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add expense"
        >
          <Text style={[styles.actionLabel, { color: inkOnFill }]}>
            + Expense
          </Text>
        </Pressable>
      </View>

      {/* Store errors (failed writes, bad input) surface here; tap to dismiss. */}
      {error !== null ? (
        <Pressable
          onPress={clearError}
          style={({ pressed }) => [
            styles.errorBanner,
            {
              // Exact flat tint/rule in darkFlat; the mode flips it to
              // the white slab with the thick solid border.
              backgroundColor: isFlat ? colors.expenseSoft : theme.surface,
              borderWidth: isFlat ? 1 : theme.borderWidth,
              borderColor: isFlat ? theme.expense : theme.borderColor,
              borderRadius: isFlat ? radius.sm : theme.borderRadius,
              ...hardShadow,
            },
            pressed && styles.errorPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Dismiss error"
        >
          <Text style={[styles.errorText, { color: theme.expense }]}>
            {error}
          </Text>
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
    // `backgroundColor` follows the active theme (inline above).
  },
  header: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    // `color` follows the active theme.
  },
  tagline: {
    marginTop: 2,
    fontSize: 13,
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
    alignItems: 'center',
    justifyContent: 'center',
    // Border/shadow tokens arrive through `slabFrame`.
  },
  actionPressed: {
    opacity: 0.9,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '800',
    // Ink follows `inkOnFill` — dark on the bright fills, both modes.
  },
  errorBanner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    // Fill/border/radius follow the mode (inline above).
  },
  errorPressed: {
    opacity: 0.75,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  feed: {
    flex: 1,
  },
});
