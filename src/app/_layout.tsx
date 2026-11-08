/**
 * Pouch — root layout (Expo Router).
 *
 * Owns the bottom tab navigator (Home / Debts / Summary) and boots the
 * offline store exactly once, before the first screen renders. `expo-router` wraps this
 * tree in its own `SafeAreaProvider`, so screens can use
 * `useSafeAreaInsets()` / `SafeAreaView` directly.
 *
 * Note: `Tabs` is imported from `expo-router/js-tabs` — the root export
 * still works but is deprecated as of SDK 58.
 */

import { StatusBar } from 'expo-status-bar';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';

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

  return (
    <>
      {/* Dark status-bar content: every screen has a light background. */}
      <StatusBar style="dark" />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.text,
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
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
