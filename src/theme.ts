/**
 * Pouch — visual tokens.
 *
 * One small module holding every color, spacing and radius value used by the
 * UI, so StyleSheets across components stay consistent and a re-skin is a
 * single-file change. Pure data: no React, no native imports.
 */

/**
 * App-wide palette: cozy minimalist flat design. Neutrals carry a faint
 * warm-green cast so the screen feels calm, `brand` (the app's forest
 * green, matching the icon background) anchors every primary/selected
 * control, and the income/expense pair stays strictly semantic — money
 * in vs. money out — never decorative. Kept deliberately small.
 */
export const colors = {
  /** Screen background — soft warm neutral. */
  background: '#F5F6F2',
  /** Flat surfaces: cards, rows, sheets. */
  surface: '#FFFFFF',
  /** Primary text — deep charcoal with a green cast. */
  text: '#1A211C',
  /** Secondary / supporting text. */
  textMuted: '#6B746C',
  /** Hairlines, card borders, input outlines — the only depth cue. */
  border: '#E4E7E1',
  /** Brand / primary accent: selected states, primary buttons, active tab. */
  brand: '#2E3B2B',
  /** Money in and positive balances. */
  income: '#16A34A',
  /** Soft tint behind income indicators. */
  incomeSoft: '#E9F6EF',
  /** Expenses, liabilities and settle actions. */
  expense: '#EF4444',
  /** Soft tint behind expense indicators. */
  expenseSoft: '#FDECEC',
  /** Neutral fill for chips, inputs and pressed states. */
  chip: '#EFF1EC',
  /** Selected chip — brand fill, high contrast against `surface`. */
  chipActive: '#2E3B2B',
  /** Scrim behind modal sheets. */
  backdrop: 'rgba(26, 33, 28, 0.45)',
  /** Text on top of brand/income/expense fills. */
  onAccent: '#FFFFFF',
} as const;

/** 4-pt spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/** Corner radii. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;
