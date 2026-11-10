/**
 * Pouch — AddDebtModal.
 *
 * The IOU recorder: person name, amount and direction ("I Owe" vs
 * "They Owe Me"), saved to SQLite through `addDebt()` and dismissed on the
 * same tap. Shares its sheet chrome with FastLoggerModal; the parent
 * remounts it once per session (a changing `key`), so every open starts
 * with a clean form — no reset effect, no cascading renders.
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

import type { DebtType } from '../db/schema';
import { useFinanceStore } from '../store/useFinanceStore';
import { colors, radius, spacing } from '../theme';
import {
  CURRENCY,
  formatMoney,
  roundMoney,
  sanitizeAmountInput,
} from '../utils/format';

/** Direction options, always phrased from the student's point of view. */
const DIRECTIONS: { type: DebtType; label: string }[] = [
  { type: 'you_owe', label: 'I Owe' },
  { type: 'owed_to_you', label: 'They Owe Me' },
];

export interface AddDebtModalProps {
  /** Whether the sheet is on screen. */
  visible: boolean;
  /** Called on backdrop tap, Android back, close button and successful save. */
  onClose: () => void;
}

export default function AddDebtModal({ visible, onClose }: AddDebtModalProps) {
  // Store action: writes the IOU plus its expense movement to SQLite,
  // then updates `debts`, `activeDebts`, `netRoommateBalance` and the
  // money totals together — so `netBalance` drops in the same frame.
  const addDebt = useFinanceStore((state) => state.addDebt);

  // Bottom inset so the sheet's Save row never sits under the system
  // navigation area — the same pattern SummaryScreen uses (see
  // `paddingBottom: insets.bottom + 96` there).
  const insets = useSafeAreaInsets();

  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<DebtType>('you_owe');
  const [formError, setFormError] = useState<string | null>(null);

  const nameInputRef = useRef<TextInputInstance>(null);

  // Remounted per session, so a mount is always a fresh form: just focus
  // the first field once the sheet has landed.
  useEffect(() => {
    const focusTimer = setTimeout(() => nameInputRef.current?.focus(), 250);
    return () => clearTimeout(focusTimer);
  }, []);

  /** Validate, persist, dismiss — one tap, no waiting on I/O. */
  const handleSubmit = (): void => {
    const name = personName.trim();
    const parsed = Number.parseFloat(amount);

    if (name.length === 0) {
      setFormError('Who is this IOU with?');
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setFormError('Enter an amount greater than zero.');
      return;
    }
    setFormError(null);

    void addDebt(name, roundMoney(parsed), direction);
    onClose();
  };

  // Accent follows the selected direction: red for what you owe, green for
  // what is owed to you.
  const accentColor =
    direction === 'you_owe' ? colors.expense : colors.income;

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
          accessibilityLabel="Dismiss debt form"
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
                accessibilityLabel="Close debt form"
              >
                <Text style={styles.closeGlyph}>✕</Text>
              </Pressable>
            </View>

            {/* Scrolls if the keypad squeezes the sheet on small devices. */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetBody}
            >
              {/* Person */}
              <Text style={styles.fieldLabel}>Who’s it with</Text>
              <TextInput
                ref={nameInputRef}
                value={personName}
                onChangeText={setPersonName}
                placeholder="Roommate's name"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={40}
                selectionColor={accentColor}
                returnKeyType="next"
                style={styles.nameInput}
                accessibilityLabel="Person name"
              />

              {/* Amount */}
              <Text style={styles.fieldLabel}>Amount</Text>
              <View style={styles.amountBox}>
                <Text style={styles.currencySymbol}>{CURRENCY}</Text>
                <TextInput
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

              {/* Direction */}
              <Text style={styles.fieldLabel}>Direction</Text>
              <View style={styles.toggle}>
                {DIRECTIONS.map((option) => {
                  const isActive = option.type === direction;
                  const optionColor =
                    option.type === 'you_owe' ? colors.expense : colors.income;

                  return (
                    <Pressable
                      key={option.type}
                      onPress={() => {
                        setDirection(option.type);
                        setFormError(null);
                      }}
                      style={({ pressed }) => [
                        styles.toggleButton,
                        isActive && { backgroundColor: optionColor },
                        pressed && styles.togglePressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text
                        style={[
                          styles.toggleLabel,
                          isActive && styles.toggleLabelActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

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
                accessibilityLabel="Add debt"
              >
                <Text style={styles.submitLabel}>Add Debt</Text>
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
    // Full-bleed scrim (explicit props: `absoluteFillObject` is not part of
    // the RN 0.88 type surface).
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
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  nameInput: {
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textMuted,
    marginRight: spacing.xs,
  },
  amountInput: {
    minWidth: 120,
    padding: 0,
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.chip,
    borderRadius: radius.pill,
    padding: spacing.xs,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
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
  formError: {
    fontSize: 13,
    color: colors.expense,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  submitButton: {
    minHeight: 54,
    marginTop: spacing.lg,
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
