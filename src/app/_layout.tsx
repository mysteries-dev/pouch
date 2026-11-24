/**
 * Pouch — root layout (Expo Router).
 *
 * Owns the bottom tab navigator (Home / Debts / Summary) and boots the
 * offline store exactly once, before the first screen renders. The whole
 * tree sits inside `ThemeProvider`, and `ThemedRoot` reads it to keep the
 * status bar and root canvas in step with the active mode. `expo-router`
 * wraps this tree in its own `SafeAreaProvider`, so screens can use
 * `useSafeAreaInsets()` / `SafeAreaView` directly.
 *
 * Note: `Tabs` is imported from `expo-router/js-tabs` — the root export
 * still works but is deprecated as of SDK 58.
 */

import { StatusBar } from 'expo-status-bar';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ThemeProvider, useTheme } from '../../context/ThemeContext';
import { useFinanceStore } from '../store/useFinanceStore';
import { colors } from '../theme';

/**
 * Emoji tab icon. Emoji ignore the tint color, so focus is communicated
 * with opacity instead (and a `color`-driven icon can drop in later).
 */
function TabEmoji({
  emoji,
  focused,
  size,
}: {
  emoji: string;
  focused: boolean;
  size: number;
}) {
  return (
    <Text style={{ fontSize: size - 2, opacity: focused ? 1 : 0.55 }}>
      {emoji}
    </Text>
  );
}

export default function RootLayout() {
  // Stable action reference so the effect below runs exactly once.
  const fetchInitialData = useFinanceStore((state) => state.fetchInitialData);

  useEffect(() => {
    void fetchInitialData();
  }, [fetchInitialData]);

  // Everything below may call `useTheme()`.
  return (
    <ThemeProvider>
      <ThemedRoot />
    </ThemeProvider>
  );
}

/**
 * The app tree, inside the provider: system chrome and the root canvas
 * follow the active mode — light status-bar ink on the charcoal-green
 * dark flat canvas, dark ink on the neo-brutalist cream.
 */
function ThemedRoot() {
  const { mode, theme } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Status-bar ink tracks the mode: 'light' on darkFlat, 'dark' on
          the neo-brutalist mode. */}
      <StatusBar style={mode === 'darkFlat' ? 'light' : 'dark'} />

      <Tabs
        screenOptions={{
          headerShown: false,
          // Sage emerald marks the focused tab; muted text for the rest.
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabBarLabel,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused, size }) => (
              <TabEmoji emoji="🏠" focused={focused} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="debts"
          options={{
            title: 'Debts',
            tabBarIcon: ({ focused, size }) => (
              <TabEmoji emoji="🤝" focused={focused} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="summary"
          options={{
            title: 'Summary',
            tabBarIcon: ({ focused, size }) => (
              <TabEmoji emoji="📊" focused={focused} size={size} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // `backgroundColor` is applied inline from the active theme.
  },
  tabBar: {
    backgroundColor: colors.surface,
    // Crisp 1px rule instead of the default hairline.
    borderTopWidth: 1,
    borderTopColor: colors.border,
    // expo-router's tab bar defaults to `elevation: 8` on Android; this
    // style is applied after the built-in one, so zeroing it removes the
    // shadow entirely — depth here comes from the border alone.
    elevation: 0,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
