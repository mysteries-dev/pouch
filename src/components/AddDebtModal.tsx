/**
 * Pouch — AddDebtModal.
 *
 * The IOU recorder, for people *and* shops: an entity toggle (Person /
 * Shop), the counterparty's name, amount and direction — tailored labels
 * ("I Owe Shop", "Shop Owes Me", **Add Tab**) plus a caption stating when
 * the entry actually moves cash. Saved to SQLite through `addDebt()` and
 * dismissed on the same tap. Shares its sheet chrome with
 * FastLoggerModal; the parent remounts it once per session (a changing
 * `key`), so every open starts with a clean form — no reset effect, no
 * cascading renders.
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

import type { DebtEntityType, DebtType } from '../db/schema';
import { useFinanceStore } from '../store/useFinanceStore';
import { colors, radius, spacing } from '../theme';
import {
  CURRENCY,
  formatMoney,
  roundMoney,
  sanitizeAmountInput,
} from '../utils/format';

/** Entity choices, phrased the way a student would say it. */
const ENTITIES: { type: DebtEntityType; label: string }[] = [
  { type: 'person', label: 'Person' },
  { type: 'shop', label: 'Shop' },
];

/** Direction options per entity, always from the student's point of view. */
const DIRECTIONS: Record<
  DebtEntityType,
  { type: DebtType; label: string }[]
> = {
  person: [
    { type: 'you_owe', label: 'I Owe' },
    { type: 'owed_to_you', label: 'They Owe Me' },
  ],
  shop: [
    { type: 'you_owe', label: 'I Owe Shop' },
    { type: 'owed_to_you', label: 'Shop Owes Me' },
  ],
};

/**
 * One-line explanation of when this entry hits the cash balance — the
 * rules differ by direction (and, for shops, the tab only settles on
 * payment), so the sheet states them instead of leaving them implicit.
 */
function balanceHint(
  entityType: DebtEntityType,
  direction: DebtType,
): string {
  if (direction === 'you_owe') {
    return entityType === 'shop'
      ? 'Store tab — balance drops only when you pay the shop.'
      : 'Balance drops only when you repay.';
  }
  return entityType === 'shop'
    ? 'Cash advanced now — credited back when the shop pays you.'
    : 'Balance drops now; credited back when they repay.';
}

export interface AddDebtModalProps {
  /** Whether the sheet is on screen. */
  visible: boolean;
  /** Called on backdrop tap, Android back, close button and successful save. */
  onClose: () => void;
}

export default function AddDebtModal({ visible, onClose }: AddDebtModalProps) {
  // Store action: writes the IOU to SQLite — plus the lending/advance
  // expense, since cash leaves the wallet then — then updates `debts`,
  // `activeDebts`, the three direction totals and the money totals
  // together. A borrow or shop tab books no balance movement until paid.
  const addDebt = useFinanceStore((state) => state.addDebt);

  // Bottom inset so the sheet's Save row never sits under the system
  // navigation area — the same pattern SummaryScreen uses (see
  // `paddingBottom: insets.bottom + 96` there).
  const insets = useSafeAreaInsets();

  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [entityType, setEntityType] = useState<DebtEntityType>('person');
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

    void addDebt(name, roundMoney(parsed), direction, entityType);
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
              {/* Entity type: person or shop (store credit / tab). */}
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.toggle}>
                {ENTITIES.map((option) => {
                  const isActive = option.type === entityType;
                  return (
                    <Pressable
                      key={option.type}
                      onPress={() => {
                        setEntityType(option.type);
                        setFormError(null);
                      }}
                      style={({ pressed }) => [
                        styles.toggleButton,
                        isActive && styles.toggleButtonActive,
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

              {/* Counterparty name — a person's name or the shop's. */}
              <Text style={styles.fieldLabel}>
                {entityType === 'shop' ? 'Which shop' : 'Who’s it with'}
              </Text>
              <TextInput
                ref={nameInputRef}
                value={personName}
                onChangeText={setPersonName}
                placeholder={
                  entityType === 'shop' ? 'Shop / dokan name' : "Roommate's name"
                }
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={40}
                selectionColor={accentColor}
                returnKeyType="next"
                style={styles.nameInput}
                accessibilityLabel="Counterparty name"
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
                {DIRECTIONS[entityType].map((option) => {
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

              {/* When this entry actually moves cash — spelled out. */}
              <Text style={styles.formHint}>
                {balanceHint(entityType, direction)}
              </Text>

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
                accessibilityLabel={
                  entityType === 'shop' ? 'Add shop tab' : 'Add debt'
                }
              >
                <Text style={styles.submitLabel}>
                  {entityType === 'shop' ? 'Add Tab' : 'Add Debt'}
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
  // Entity toggle uses a neutral dark fill — income/expense colours are
  // reserved for money direction.
  toggleButtonActive: {
    backgroundColor: colors.text,
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
  // Balance-rule caption under the direction toggle.
  formHint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
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
