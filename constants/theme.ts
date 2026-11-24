// cspell:ignore neubrutalism

/**
 * Pouch — theme modes.
 *
 * Two visual identities behind one token shape. **`darkFlat`** is the
 * shipped look: a verbatim mirror of the palette in `src/theme.ts` (deep
 * charcoal-green canvas, slate-moss cards, sage/terracotta accents),
 * flat by design — no borders, no shadows, smooth corners. **`neubrutalism`**
 * is the high-contrast neo-brutalist skin: warm cream canvas, crisp white
 * cards, punchy accents on black ink, thick slabs and hard zero-blur
 * offset shadows.
 *
 * Pure data: no React, no native imports, so any component can accept a
 * `ThemeTokens` without knowing which mode is active. Nothing consumes
 * this module yet — existing screens keep reading `src/theme.ts`, whose
 * color values `darkFlat` mirrors exactly (keep the two in step).
 */

/** Which visual identity the UI is dressed in. */
export type ThemeMode = 'darkFlat' | 'neubrutalism';

/**
 * The contract every theme fills: canvas, surface, the two ink levels,
 * the accent trio, and the flat-vs-slab geometry (border, corners, hard
 * shadow). Each value drops straight into a StyleSheet prop.
 */
export interface ThemeTokens {
  /** Self-identifying copy of the key it sits under in `themes`. */
  mode: ThemeMode;
  /** Screen canvas. */
  background: string;
  /** Cards, sheets and rows — the surface lifted off the canvas. */
  surface: string;
  /** Primary ink — titles and numbers. */
  text: string;
  /** Secondary ink — labels, dates, hints. */
  textMuted: string;
  /** Primary accent — CTAs, active tab, focus. */
  accent: string;
  /** Money-in / receivables accent. */
  income: string;
  /** Money-out / liabilities accent. */
  expense: string;
  /** Stroke color, drawn only when `borderWidth > 0`. */
  borderColor: string;
  /** Stroke weight: `0` flat, `2.5` neo-brutalist slab. */
  borderWidth: number;
  /** Corner radius: smooth vs sharp. */
  borderRadius: number;
  /** Offset-shadow ink (never rendered while `shadowOpacity` is `0`). */
  shadowColor: string;
  /** Hard offset — `{0, 0}` disables the drop entirely. */
  shadowOffset: { width: number; height: number };
  /** `0` renders no shadow at all; `1` is fully opaque. */
  shadowOpacity: number;
  /** Blur radius — `0` keeps the edge razor-sharp. */
  shadowRadius: number;
  /** Android stand-in for the offset shadow (Material elevation blurs;
   * use `boxShadow` there when a truly hard edge is required). */
  elevation: number;
}

/** Both moods, keyed by `ThemeMode`. */
export const themes: Record<ThemeMode, ThemeTokens> = {
  // -------------------------------------------------------------------------
  // Dark flat — the shipped app. Colors copied verbatim from
  // `src/theme.ts`'s `colors`; flat by spec: the token border width is 0
  // and every shadow stops rendering, so separation comes from the
  // canvas/surface contrast alone. (The app's StyleSheets keep drawing
  // their own 1px `#273028` hairlines until they migrate to this module
  // — that exact color is preserved here. `borderRadius` mirrors the
  // workhorse `radius.md`.)
  // -------------------------------------------------------------------------
  darkFlat: {
    mode: 'darkFlat',
    background: '#111512',
    surface: '#191F1A',
    text: '#F1F4F1',
    textMuted: '#9AA69B',
    accent: '#7BA675',
    income: '#7BA675',
    expense: '#E07A6B',
    borderColor: '#273028',
    borderWidth: 0,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  // -------------------------------------------------------------------------
  // Neo-brutalism — warm cream canvas, white cards, yellow/teal/coral
  // accents all carrying black ink (>= 6.5:1 on each fill), 2.5px solid
  // `#111111` slabs, 6px corners and a hard 4x4 shadow with zero blur
  // (iOS). Android's elevation approximates the lift — it blurs, so it
  // stays small.
  // -------------------------------------------------------------------------
  neubrutalism: {
    mode: 'neubrutalism',
    background: '#FFFDF7',
    surface: '#FFFFFF',
    text: '#111111',
    textMuted: '#555555',
    accent: '#FFD166',
    income: '#4ECDC4',
    expense: '#FF6B6B',
    borderColor: '#111111',
    borderWidth: 2.5,
    borderRadius: 6,
    shadowColor: '#111111',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
};
