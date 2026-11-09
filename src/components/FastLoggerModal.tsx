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

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const accentColor = type === 'expense' ? colors.expense : colors.income;

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
            style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}
          >
            <View style={styles.sheetHeader}>
              <View style={styles.handle} />
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close logger"
              >
                <Text style={styles.closeGlyph}>✕</Text>
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
              <View style={styles.toggle}>
                <Pressable
                  onPress={() => handleTypeChange('expense')}
                  style={({ pressed }) => [
                    styles.toggleButton,
                    type === 'expense' && styles.toggleExpenseActive,
                    pressed && styles.togglePressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: type === 'expense' }}
                >
                  <Text
                    style={[
                      styles.toggleLabel,
                      type === 'expense' && styles.toggleLabelActive,
                    ]}
                  >
                    Expense
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => handleTypeChange('income')}
                  style={({ pressed }) => [
                    styles.toggleButton,
                    type === 'income' && styles.toggleIncomeActive,
                    pressed && styles.togglePressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: type === 'income' }}
                >
                  <Text
                    style={[
                      styles.toggleLabel,
                      type === 'income' && styles.toggleLabelActive,
                    ]}
                  >
                    Money In
                  </Text>
                </Pressable>
              </View>

              {/* Large amount field. */}
              <View style={styles.amountBox}>
                <Text style={styles.currencySymbol}>{CURRENCY}</Text>
                <TextInput
                  ref={amountInputRef}
                  value={amount}
                  onChangeText={(next) => setAmount(sanitizeAmountInput(next))}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  maxLength={10}
                  selectionColor={accentColor}
                  onSubmitEditing={handleSubmit}
                  style={styles.amountInput}
                  accessibilityLabel="Amount"
                />
              </View>

              {/* Quick-preset categories. */}
              <Text style={styles.fieldLabel}>Category</Text>
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
                        isActive && styles.presetActive,
                        pressed && styles.presetPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text
                        style={[
                          styles.presetLabel,
                          isActive && styles.presetLabelActive,
                        ]}
                      >
                        {preset}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Optional tag, e.g. #ApartmentMove */}
              <Text style={styles.fieldLabel}>Tag (optional)</Text>
              <TextInput
                value={tag}
                onChangeText={setTag}
                placeholder="#ApartmentMove"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={40}
                selectionColor={accentColor}
                returnKeyType="done"
                style={styles.tagInput}
                accessibilityLabel="Tag"
              />

              {formError !== null ? (
                <Text style={styles.formError}>{formError}</Text>
              ) : null}

              {/* Single-tap save. */}
              <Pressable
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: accentColor },
                  pressed && styles.submitPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Add ${type === 'expense' ? 'expense' : 'money in'}`}
              >
                <Text style={styles.submitLabel}>
                  {type === 'expense' ? 'Add Expense' : 'Add Money In'}
                </Text>
                {Number.parseFloat(amount) > 0 ? (
                  <Text style={styles.submitAmount}>
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
    // is not part of the RN 0.88 type surface).
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
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
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
    backgroundColor: colors.border,
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  closeGlyph: {
    fontSize: 16,
    color: colors.textMuted,
  },
  sheetBody: {
    paddingTop: spacing.sm,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.chip,
    borderRadius: radius.pill,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleExpenseActive: {
    backgroundColor: colors.expense,
  },
  toggleIncomeActive: {
    backgroundColor: colors.income,
  },
  togglePressed: {
    opacity: 0.85,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  toggleLabelActive: {
    color: colors.onAccent,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textMuted,
    marginRight: spacing.xs,
  },
  amountInput: {
    minWidth: 120,
    padding: 0,
    fontSize: 44,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
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
    borderRadius: radius.pill,
    backgroundColor: colors.chip,
  },
  presetActive: {
    backgroundColor: colors.chipActive,
  },
  presetPressed: {
    opacity: 0.7,
  },
  presetLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  presetLabelActive: {
    color: colors.onAccent,
  },
  tagInput: {
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.md,
  },
  formError: {
    fontSize: 13,
    color: colors.expense,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  submitButton: {
    minHeight: 54,
    borderRadius: radius.md,
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
    color: colors.onAccent,
  },
  submitAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onAccent,
    opacity: 0.85,
  },
});
