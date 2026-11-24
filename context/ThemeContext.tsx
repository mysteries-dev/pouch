// cspell:ignore neubrutalism

/**
 * Pouch — theme context.
 *
 * Bridges `constants/theme.ts` into React: `ThemeProvider` owns the
 * active `ThemeMode` (default `'darkFlat'` — the shipped look), resolves
 * it to full `ThemeTokens`, and hands every consumer the four-value API
 * `{ theme, mode, setMode, toggleTheme }` through `useTheme()`.
 *
 * Persistence — checked against `package.json`: neither
 * `@react-native-async-storage/async-storage` nor `expo-secure-store`
 * is installed (only `expo-sqlite`, the app's data store — the wrong
 * shape for a UI preference), and adding a dependency is out of scope
 * for this file. So the documented in-memory fallback applies: the
 * choice is loaded from a module scope that survives provider remounts
 * and written back on every change, resetting on cold start. When a
 * key-value store is added later, swap the two marked seams for its
 * async read/write — the context API does not change.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

import { themes } from '../constants/theme';
import type { ThemeMode, ThemeTokens } from '../constants/theme';

/** The four-value contract every consumer reads. */
export interface ThemeContextValue {
  /** Resolved tokens for the active `mode`. */
  theme: ThemeTokens;
  /** Active mode — the key it sits under in `themes`. */
  mode: ThemeMode;
  /** Pick a mode directly (a no-op outside a provider). */
  setMode: Dispatch<SetStateAction<ThemeMode>>;
  /** Flip between `darkFlat` and `neubrutalism`. */
  toggleTheme: () => void;
}

/**
 * In-memory stand-in for a key-value store: module scope survives
 * provider remounts (Fast Refresh, a rebuilt navigation tree) and
 * resets on cold start — exactly the fallback contract.
 */
let sessionMode: ThemeMode = 'darkFlat';

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Shared no-op so `useTheme()` never crashes (and stays render-stable). */
const noop = (): void => {
  // Outside a provider there is nothing to update.
};

/** What `useTheme()` returns outside a `ThemeProvider`. */
const OUTSIDE_PROVIDER: ThemeContextValue = {
  theme: themes.darkFlat,
  mode: 'darkFlat',
  setMode: noop,
  toggleTheme: noop,
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Load seam: read the session's last choice; fresh boots get darkFlat.
  const [mode, setMode] = useState<ThemeMode>(() => sessionMode);

  // Persist seam: write every change back to the session scope.
  useEffect(() => {
    sessionMode = mode;
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setMode((current) =>
      current === 'darkFlat' ? 'neubrutalism' : 'darkFlat',
    );
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: themes[mode], mode, setMode, toggleTheme }),
    [mode, setMode, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Read the active theme. Outside a provider it falls back to
 * `themes.darkFlat` instead of throwing, so isolated screens and tests
 * keep rendering the shipped look.
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? OUTSIDE_PROVIDER;
}
