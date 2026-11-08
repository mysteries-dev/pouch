/**
 * Pouch — visual tokens.
 *
 * One small module holding every color, spacing and radius value used by the
 * UI, so StyleSheets across components stay consistent and a re-skin is a
 * single-file change. Pure data: no React, no native imports.
 */

/** App-wide palette. Kept deliberately small for a calm, minimal look. */
export const colors = {
  /** Screen background. */
  background: '#F4F6F8',
  /** Raised surfaces: cards, rows, sheets. */
  surface: '#FFFFFF',
  /** Primary text. */
  text: '#111827',
  /** Secondary / supporting text. */
  textMuted: '#6B7280',
  /** Hairlines, card borders, chip outlines. */
  border: '#E5E7EB',
  /** Money in and positive balances. */
  income: '#16A34A',
  /** Soft tint behind income indicators. */
  incomeSoft: '#E8F7EF',
  /** Expenses and negative balances — Pouch's accent color. */
  expense: '#EF4444',
  /** Soft tint behind expense indicators. */
  expenseSoft: '#FDECEC',
  /** Neutral fill for chips, inputs and pressed states. */
  chip: '#F3F4F6',
  /** Selected chip (high contrast against `surface`). */
  chipActive: '#111827',
  /** Scrim behind modal sheets. */
  backdrop: 'rgba(17, 24, 39, 0.45)',
  /** Text on top of income/expense fills. */
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
