// cspell:ignore neubrutalism Pressable

/**
 * Pouch — ThemeToggle.
 *
 * A compact mode pill: it shows the active theme ("🌙 Flat" /
 * "☀️ Brutal") and flips modes through `toggleTheme()`. Every visual
 * property comes from the active `ThemeTokens`, so the same element
 * re-skins itself without a single mode check in its styling — flat and
 * borderless on `darkFlat`, a thick 2.5px slab with sharp corners and a
 * hard 4x4 zero-blur drop shadow on `neubrutalism`.
 *
 * Not wired into any screen yet — this file only, nothing else changed.
 */

import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../theme';

export default function ThemeToggle() {
  const { mode, theme, toggleTheme } = useTheme();

  const isFlat = mode === 'darkFlat';

  return (
    <Pressable
      onPress={toggleTheme}
      style={({ pressed }) => [
        styles.pill,
        // Tokens only: `borderWidth: 0` + `shadowOpacity: 0` render the
        // flat pill; `2.5` + the hard offset render the brutal one.
        {
          backgroundColor: theme.surface,
          borderColor: theme.borderColor,
          borderWidth: theme.borderWidth,
          borderRadius: theme.borderRadius,
          shadowColor: theme.shadowColor,
          shadowOffset: theme.shadowOffset,
          shadowOpacity: theme.shadowOpacity,
          shadowRadius: theme.shadowRadius,
          elevation: theme.elevation,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        isFlat
          ? 'Switch to the neo-brutalist theme'
          : 'Switch to the dark flat theme'
      }
    >
      <Text style={styles.glyph}>{isFlat ? '🌙' : '☀️'}</Text>
      <Text style={[styles.label, { color: theme.text }]}>
        {isFlat ? 'Flat' : 'Brutal'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // Compact: a half-step of vertical padding over `xs`.
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  pressed: {
    // Press feedback stays opacity-only, in both modes.
    opacity: 0.85,
  },
  glyph: {
    fontSize: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
