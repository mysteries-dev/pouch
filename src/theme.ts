/**
 * Pouch — visual tokens.
 *
 * One small module holding every color, spacing and radius value used by the
 * UI, so StyleSheets across components stay consistent and a re-skin is a
 * single-file change. Pure data: no React, no native imports.
 */

/**
 * App-wide palette: cozy minimalist **dark flat** design. The background
 * is a deep matte charcoal-green (never pure black — no harsh glare or
 * contrast clipping), cards lift one notch to slate-moss, and every
 * section is separated by crisp 1px hairlines instead of shadows. The
 * sage-emerald `accent` anchors primary actions, the active tab and
 * positive/receivable highlights; `brand` (the forest green from the app
 * icon) holds selected badges/containers; the income/expense pair stays
 * strictly semantic — money in vs. money out — in muted, high-contrast
 * tones. Kept deliberately small.
 */
export const colors = {
  /** Screen background — deep matte charcoal-green. */
  background: '#111512',
  /** Flat surfaces: cards, rows, sheets — lifted slate-moss. */
  surface: '#191F1A',
  /** Primary text — soft warm off-white. */
  text: '#F1F4F1',
  /** Secondary / supporting text — muted sage-gray. */
  textMuted: '#9AA69B',
  /** Hairlines, card borders, input outlines — the only depth cue. */
  border: '#273028',
  /** Brand forest green: selected badges and dark containers. */
  brand: '#2E3B2B',
  /** Sage-emerald: primary buttons, active tab, positive highlights. */
  accent: '#7BA675',
  /** Cash-in and receivables ("they owe you") — semantic sage. */
  income: '#7BA675',
  /** Subtle dark tint behind income indicators. */
  incomeSoft: '#1D2B1E',
  /** Expenses, liabilities and settle actions — warm terracotta. */
  expense: '#E07A6B',
  /** Subtle dark tint behind expense indicators. */
  expenseSoft: '#2B1D1B',
  /** Neutral fill for chips, inputs and pressed states. */
  chip: '#202721',
  /** Selected chip — brand container; the off-white label signals it. */
  chipActive: '#2E3B2B',
  /** Scrim behind modal sheets — near-black green, never pure black. */
  backdrop: 'rgba(4, 6, 5, 0.62)',
  /** Text on top of brand/dark fills (selected pills, toggles). */
  onAccent: '#F1F4F1',
  /** Ink on top of bright sage/terracotta fills (buttons, toggles). */
  onBright: '#111512',
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
