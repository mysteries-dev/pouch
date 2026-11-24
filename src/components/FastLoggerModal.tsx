// cspell:ignore neubrutalism

/**
 * Pouch — FastLoggerModal.
 *
 * The 3-second logger: a bottom sheet for recording money in or an expense
 * without leaving the Home Screen. Design rules:
 *  - one tap per decision (type → presets → save),
 *  - the amount field is focused the moment the sheet lands,
 *  - save persists through the store and dismisses on the same tap.
 *
 * Built on the core React Native `Modal`, so it adds no dependencies.
 * The parent remounts it once per logging session (a changing `key`), which
 * is what gives every open a clean form: RN's `Modal` keeps its children
 * alive while hidden, so `useState` initializers only re-run on a remount.
 *
 * Fills, ink, borders, corners and shadows follow the active `useTheme()`
 * tokens. `darkFlat` reproduces the old sheet exactly — every token
 * equals the former constant, and the few values with no token (the
 * scrim, the chip/chipActive fills, the pill radii, the 1px hairlines)
 * keep their flat constant behind `isFlat`. `neubrutalism` turns the
 * sheet, inputs, type toggle, category pills and submit button into
 * white slabs: 2.5px solid black borders, sharp 6px corners and the hard
 * 4x4 offset shadow. Form state, validation, keyboard handling and the
 * submission path are untouched.
 */

import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../context/ThemeContext';
import type { TransactionType } from '../db/schema';
import { useFinanceStore } from '../store/useFinanceStore';
import { colors, radius, spacing } from '../theme';
import {
  CURRENCY,
  formatMoney,
  roundMoney,
  sanitizeAmountInput,
} from '../utils/format';

/** One-tap category presets for expenses (order = display order). */
const EXPENSE_CATEGORIES = [
  'Food/Snack',
  'Transport',
  'Bills',
  'Academic',
  'Personal',
] as const;

/** Matching presets for money in — `category` is required by the schema. */
const INCOME_CATEGORIES = [
  'Allowance',
  'Part-time',
  'Gift',
  'Scholarship',
  'Other',
] as const;

export interface FastLoggerModalProps {
  /** Whether the sheet is on screen. */
  visible: boolean;
  /** Tab the sheet opens on. Defaults to `'expense'`. */
  initialType?: TransactionType;
  /** Called on backdrop tap, Android back, close button and successful save. */
  onClose: () => void;
}

export default function FastLoggerModal({
  visible,
  initialType = 'expense',
  onClose,
}: FastLoggerModalProps) {
  // The store action persists to SQLite and updates Zustand state itself.
  const addTransaction = useFinanceStore((state) => state.addTransaction);

  // Bottom inset so the sheet's action row never sits under the system
  // navigation area — the same pattern SummaryScreen uses for its scroll
  // content (see `paddingBottom: insets.bottom + 96` there).
  const insets = useSafeAreaInsets();

  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>(
    initialType === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0],
  );
  const [tag, setTag] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const amountInputRef = useRef<TextInputInstance>(null);

  // The parent remounts this sheet for every logging session (a changing
  // `key`), so the `useState` initializers above already hand each open a
  // clean form — no reset effect, no cascading render. All that's left on
  // mount is to focus the amount field once the sheet has landed.
  useEffect(() => {
    const focusTimer = setTimeout(() => amountInputRef.current?.focus(), 250);
    return () => clearTimeout(focusTimer);
  }, []);

  /** Switching tabs swaps the preset row with it. */
  const handleTypeChange = (nextType: TransactionType): void => {
    if (nextType === type) return;
    setType(nextType);
    setCategory(
      nextType === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0],
    );
    setFormError(null);
  };

  /**
   * Validate, persist, dismiss — all in one tap. The SQLite write and the
   * store update continue in the background, so closing never waits on I/O.
   */
  const handleSubmit = (): void => {
    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setFormError('Enter an amount greater than zero.');
      return;
    }
    setFormError(null);

    // Store tags without the leading `#`; the feed renders `#` back on.
    const normalizedTag = tag.trim().replace(/^#+/, '');

    void addTransaction(
      roundMoney(parsed),
      type,
      category,
      normalizedTag || undefined,
    );
    onClose();
  };

  // Active mode + tokens. `isFlat` gates only the values with no token:
  // the scrim, the chip/chipActive fills and the pill radii the flat
  // look is built from.
  const { mode, theme } = useTheme();
  const isFlat = mode === 'darkFlat';

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  // Accent follows the selected tab: terracotta for expense, sage for
  // money in (the brutal palette swaps in coral/teal).
  const accentColor = type === 'expense' ? theme.expense : theme.income;

  // Ink on the bright fills — the inverse of text-on-canvas: darkFlat's
  // #111512 (the old `onBright`), the brutal mode's #111111 black ink
  // (>= 6.5:1 on every fill in either palette).
  const inkOnFill = isFlat ? theme.background : theme.text;

  // Secondary ink: field labels, inactive pills, the glyph chrome.
  const mutedInk = { color: theme.textMuted };

  // Hard offset shadow: inert zeros in darkFlat, the paper-cut drop
  // shadow in the neo-brutalist mode.
  const hardShadow = {
    shadowColor: theme.shadowColor,
    shadowOffset: theme.shadowOffset,
    shadowOpacity: theme.shadowOpacity,
    shadowRadius: theme.shadowRadius,
    elevation: theme.elevation,
  };

  // Corner radius for the pill rows: full round in flat, sharp in brutal.
  const pillRadius = isFlat ? radius.pill : theme.borderRadius;

  // The 2.5px black outline the brutal mode puts on the slab frames and
  // the selected pills; inert (an empty spread) in flat.
  const activeSlab = isFlat
    ? {}
    : { borderWidth: theme.borderWidth, borderColor: theme.borderColor };

  // Sheet: flat keeps the rounded top and the crisp hairline against the
  // backdrop; brutal flips to a white slab — sharp corners, thick solid
  // border on every visible side, hard offset shadow.
  const sheetFrame = isFlat
    ? {
        backgroundColor: theme.surface,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        borderTopWidth: 1,
        borderTopColor: theme.borderColor,
      }
    : {
        backgroundColor: theme.surface,
        borderWidth: theme.borderWidth,
        borderColor: theme.borderColor,
        borderRadius: theme.borderRadius,
        ...hardShadow,
      };

  // Inputs (amount box, tag field): chip fill + 1px hairline in flat —
  // pixel-identical to before, `borderRadius` 12 equals the old
  // `radius.md` — white slab in brutal.
  const fieldFrame = {
    backgroundColor: isFlat ? colors.chip : theme.surface,
    borderWidth: isFlat ? 1 : theme.borderWidth,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadius,
  };

  // Type-toggle housing: the chip pill in flat, a sharp-cornered white
  // slab — with the hard shadow — in brutal.
  const toggleFrame = {
    backgroundColor: isFlat ? colors.chip : theme.surface,
    borderWidth: isFlat ? 1 : theme.borderWidth,
    borderColor: theme.borderColor,
    borderRadius: pillRadius,
    ...hardShadow,
  };

  // Selected type tab: the bright money-direction fill in both modes,
  // outlined by the slab in brutal (no border in flat, as before).
  const expensePill = { backgroundColor: theme.expense, ...activeSlab };
  const incomePill = { backgroundColor: theme.income, ...activeSlab };

  // Category preset chips: chip fill + full round in flat (no border,
  // inert shadow zeros); white slab with hard shadow in brutal, and the
  // selected one stamps itself in the accent yellow.
  const presetFrame = {
    backgroundColor: isFlat ? colors.chip : theme.surface,
    borderRadius: pillRadius,
    ...activeSlab,
    ...hardShadow,
  };
  const presetActivePill = {
    backgroundColor: isFlat ? colors.chipActive : theme.accent,
  };

  // Single-tap save: accent fill with the old `radius.md` in flat (no
  // border, inert shadow zeros), the outlined slab in brutal.
  const submitFrame = {
    backgroundColor: accentColor,
    borderRadius: theme.borderRadius,
    ...activeSlab,
    ...hardShadow,
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Tap outside to dismiss. */}
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss logger"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetWrap}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.sheet,
              sheetFrame,
              // Safe-area clearance for the action row (unchanged).
              { paddingBottom: spacing.xl + insets.bottom },
            ]}
          >
            <View style={styles.sheetHeader}>
              <View
                style={[styles.handle, { backgroundColor: theme.borderColor }]}
              />
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.closePressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close logger"
              >
                <Text style={[styles.closeGlyph, mutedInk]}>✕</Text>
              </Pressable>
            </View>

            {/* Scrolls if the keypad squeezes the sheet on smaller devices. */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetBody}
            >
              {/* Expense / Money In toggle. */}
              <View style={[styles.toggle, toggleFrame]}>
                <Pressable
                  onPress={() => handleTypeChange('expense')}
                  style={({ pressed }) => [
                    styles.toggleButton,
                    { borderRadius: pillRadius },
                    type === 'expense' && expensePill,
                    pressed && styles.togglePressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: type === 'expense' }}
                >
                  <Text
                    style={[
                      styles.toggleLabel,
                      mutedInk,
                      // Dark ink on the bright terracotta selection fill.
                      type === 'expense' && { color: inkOnFill },
                    ]}
                  >
                    Expense
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => handleTypeChange('income')}
                  style={({ pressed }) => [
                    styles.toggleButton,
                    { borderRadius: pillRadius },
                    type === 'income' && incomePill,
                    pressed && styles.togglePressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: type === 'income' }}
                >
                  <Text
                    style={[
                      styles.toggleLabel,
                      mutedInk,
                      // Dark ink on the bright sage selection fill.
                      type === 'income' && { color: inkOnFill },
                    ]}
                  >
                    Money In
                  </Text>
                </Pressable>
              </View>

              {/* Large amount field. */}
              <View style={[styles.amountBox, fieldFrame]}>
                <Text style={[styles.currencySymbol, mutedInk]}>
                  {CURRENCY}
                </Text>
                <TextInput
                  ref={amountInputRef}
                  value={amount}
                  onChangeText={(next) => setAmount(sanitizeAmountInput(next))}
                  placeholder="0"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  maxLength={10}
                  selectionColor={accentColor}
                  onSubmitEditing={handleSubmit}
                  style={[styles.amountInput, { color: theme.text }]}
                  accessibilityLabel="Amount"
                />
              </View>

              {/* Quick-preset categories. */}
              <Text style={[styles.fieldLabel, mutedInk]}>Category</Text>
              <View style={styles.presetRow}>
                {categories.map((preset) => {
                  const isActive = preset === category;
                  return (
                    <Pressable
                      key={preset}
                      onPress={() => {
                        setCategory(preset);
                        setFormError(null);
                      }}
                      style={({ pressed }) => [
                        styles.preset,
                        presetFrame,
                        isActive && presetActivePill,
                        pressed && styles.presetPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text
                        style={[
                          styles.presetLabel,
                          mutedInk,
                          // Light ink on the dark brand chip in flat;
                          // black ink on the accent stamp in brutal.
                          isActive && { color: theme.text },
                        ]}
                      >
                        {preset}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Optional tag, e.g. #ApartmentMove */}
              <Text style={[styles.fieldLabel, mutedInk]}>Tag (optional)</Text>
              <TextInput
                value={tag}
                onChangeText={setTag}
                placeholder="#ApartmentMove"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={40}
                selectionColor={accentColor}
                returnKeyType="done"
                style={[styles.tagInput, fieldFrame, { color: theme.text }]}
                accessibilityLabel="Tag"
              />

              {formError !== null ? (
                <Text style={[styles.formError, { color: theme.expense }]}>
                  {formError}
                </Text>
              ) : null}

              {/* Single-tap save. */}
              <Pressable
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.submitButton,
                  submitFrame,
                  pressed && styles.submitPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Add ${type === 'expense' ? 'expense' : 'money in'}`}
              >
                <Text style={[styles.submitLabel, { color: inkOnFill }]}>
                  {type === 'expense' ? 'Add Expense' : 'Add Money In'}
                </Text>
                {Number.parseFloat(amount) > 0 ? (
                  <Text style={[styles.submitAmount, { color: inkOnFill }]}>
                    {formatMoney(roundMoney(Number.parseFloat(amount)))}
                  </Text>
                ) : null}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    // Full-bleed scrim behind the sheet (explicit props: `absoluteFillObject`
    // is not part of the RN 0.88 type surface). No `backdrop` token exists,
    // and the translucent dim reads neutral over both canvases, so it stays
    // the flat constant in both modes.
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.backdrop,
  },
  // Full-screen column that pins the sheet to its bottom edge. `behavior`
  // then shrinks this wrapper by the keyboard height, so the sheet lifts as
  // a whole instead of being squashed — and `box-none` keeps taps in the
  // empty area reaching the backdrop behind.
  sheetWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  sheet: {
    // Fill, corners, hairline/slab border and shadow arrive through
    // `sheetFrame` (the active theme).
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '88%',
  },
  sheetHeader: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    // `backgroundColor` follows the active theme (inline above).
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  closePressed: {
    opacity: 0.6,
  },
  closeGlyph: {
    fontSize: 16,
    // `color` follows the active theme.
  },
  sheetBody: {
    paddingTop: spacing.sm,
  },
  toggle: {
    flexDirection: 'row',
    // Fill/border/radius/shadow arrive through `toggleFrame`.
    marginBottom: spacing.lg,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    // `borderRadius` follows `pillRadius` (inline above).
    alignItems: 'center',
    justifyContent: 'center',
  },
  togglePressed: {
    opacity: 0.85,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '700',
    // Base ink follows the theme; the selected tab overrides it above.
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Fill/border/radius arrive through `fieldFrame`.
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '700',
    // `color` follows the active theme.
    marginRight: spacing.xs,
  },
  amountInput: {
    minWidth: 120,
    padding: 0,
    fontSize: 44,
    fontWeight: '800',
    // `color` follows the active theme.
    textAlign: 'center',
    letterSpacing: -1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    // `color` follows the active theme.
    marginBottom: spacing.sm,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  preset: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    // Fill/radius/border/shadow arrive through `presetFrame`.
  },
  presetPressed: {
    opacity: 0.7,
  },
  presetLabel: {
    fontSize: 13,
    fontWeight: '600',
    // Base ink follows the theme; the selected preset overrides it above.
  },
  tagInput: {
    // Fill/border/radius arrive through `fieldFrame`; ink follows the theme.
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  formError: {
    fontSize: 13,
    // `color` follows the active theme (inline above).
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  submitButton: {
    minHeight: 54,
    // Fill/radius/border/shadow arrive through `submitFrame`.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  submitPressed: {
    opacity: 0.9,
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: '800',
    // Ink follows `inkOnFill` (inline above).
  },
  submitAmount: {
    fontSize: 16,
    fontWeight: '700',
    // Ink follows `inkOnFill` (inline above).
    opacity: 0.85,
  },
});
