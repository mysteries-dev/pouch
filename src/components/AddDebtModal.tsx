// cspell:ignore neubrutalism

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
 *
 * Fills, ink, borders, corners and shadows follow the active `useTheme()`
 * tokens. `darkFlat` reproduces the old sheet exactly — every token
 * equals the former constant, and the few values with no token (the
 * scrim, the chip/brand fills, the pill radii, the 1px hairlines) keep
 * their flat constant behind `isFlat`. `neubrutalism` turns the sheet,
 * inputs, toggles and submit button into white slabs: 2.5px solid black
 * borders, sharp 6px corners and the hard 4x4 offset shadow. Keyboard
 * handling, safe-area padding and the submission path are untouched.
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
      ? 'Store tab (baki) — balance drops only when you pay the shop.'
      : 'Balance drops only when you repay.';
  }
  return entityType === 'shop'
    ? 'Cash advanced now — credited back when the shop pays you.'
    : 'Balance drops now; credited back when they repay.';
}

/**
 * Amount-field copy per entity: a shop you owe reads as the store tab
 * itself — "Amount Owed to Store" — and store credit says who it is owed
 * to; people keep the plain label.
 */
function amountLabelFor(
  entityType: DebtEntityType,
  direction: DebtType,
): string {
  if (entityType !== 'shop') return 'Amount';
  return direction === 'you_owe'
    ? 'Amount Owed to Store'
    : 'Store Credit Owed to You';
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

  // Bottom safe-area inset, carried by the ScrollView's content so the
  // Add Debt button clears the system navigation area and keeps scroll
  // room above the keypad (insets.bottom + 16 — see the
  // `contentContainerStyle` below).
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
      setFormError(
        entityType === 'shop'
          ? 'Which shop is this tab with?'
          : 'Who is this IOU with?',
      );
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

  // Active mode + tokens. `isFlat` gates only the values with no token:
  // the scrim, the chip/brand fills, the pill radii and the 1px
  // hairlines the flat look is built from.
  const { mode, theme } = useTheme();
  const isFlat = mode === 'darkFlat';

  // Accent follows the selected direction: terracotta for what you owe,
  // sage for what is owed to you (the brutal palette swaps in coral/teal).
  const accentColor = direction === 'you_owe' ? theme.expense : theme.income;

  // Ink on the bright fills — the inverse of text-on-canvas: darkFlat's
  // #111512 (the old `onBright`), the brutal mode's #111111 black ink
  // (>= 6.5:1 on every fill in either palette).
  const inkOnFill = isFlat ? theme.background : theme.text;

  // Secondary ink: field labels, hints, the grabber-adjacent chrome.
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

  // The 2.5px black outline the brutal mode puts on the active pill and
  // the slab frames; inert (an empty spread) in flat.
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

  // Inputs (name field, amount box): chip fill + 1px hairline in flat —
  // pixel-identical to before, `borderRadius` 12 equals the old
  // `radius.md` — white slab in brutal.
  const fieldFrame = {
    backgroundColor: isFlat ? colors.chip : theme.surface,
    borderWidth: isFlat ? 1 : theme.borderWidth,
    borderColor: theme.borderColor,
    borderRadius: theme.borderRadius,
  };

  // Toggle housing (entity + direction): the chip pill in flat, a
  // sharp-cornered white slab — with the hard shadow — in brutal.
  const toggleFrame = {
    backgroundColor: isFlat ? colors.chip : theme.surface,
    borderWidth: isFlat ? 1 : theme.borderWidth,
    borderColor: theme.borderColor,
    borderRadius: pillRadius,
    ...hardShadow,
  };

  // Entity selection: brand fill in flat (income/expense colours stay
  // reserved for money direction), the punchy accent slab in brutal.
  const entityActivePill = {
    backgroundColor: isFlat ? colors.brand : theme.accent,
    ...activeSlab,
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
          accessibilityLabel="Dismiss debt form"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetWrap}
          pointerEvents="box-none"
        >
          <View style={[styles.sheet, sheetFrame]}>
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
                accessibilityLabel="Close debt form"
              >
                <Text style={[styles.closeGlyph, mutedInk]}>✕</Text>
              </Pressable>
            </View>

            {/* Scrolls if the keypad squeezes the sheet on small devices. */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.sheetBody,
                // Safe-area + keyboard clearance: the button always has
                // room below it, scrollable when the keypad squeezes
                // the sheet.
                { paddingBottom: insets.bottom + 16 },
              ]}
            >
              {/* Entity type: person or shop (store credit / tab). */}
              <Text style={[styles.fieldLabel, mutedInk]}>Type</Text>
              <View style={[styles.toggle, toggleFrame]}>
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
                        { borderRadius: pillRadius },
                        isActive && entityActivePill,
                        pressed && styles.togglePressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text
                        style={[
                          styles.toggleLabel,
                          mutedInk,
                          // Light ink on the dark brand container in flat;
                          // black ink on the accent slab in brutal.
                          isActive && { color: theme.text },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Counterparty name — a person's name, or the shop the
                  tab (baki) is with: "Tab with [Shop Name]". */}
              <Text style={[styles.fieldLabel, mutedInk]}>
                {entityType === 'shop' ? 'Tab with' : 'Who’s it with'}
              </Text>
              <TextInput
                ref={nameInputRef}
                value={personName}
                onChangeText={setPersonName}
                placeholder={
                  entityType === 'shop' ? 'Shop / dokan name' : "Roommate's name"
                }
                placeholderTextColor={theme.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={40}
                selectionColor={accentColor}
                returnKeyType="next"
                style={[styles.nameInput, fieldFrame, { color: theme.text }]}
                accessibilityLabel="Counterparty name"
              />

              {/* Amount */}
              <Text style={[styles.fieldLabel, mutedInk]}>
                {amountLabelFor(entityType, direction)}
              </Text>
              <View style={[styles.amountBox, fieldFrame]}>
                <Text style={[styles.currencySymbol, mutedInk]}>
                  {CURRENCY}
                </Text>
                <TextInput
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
                  accessibilityLabel={amountLabelFor(entityType, direction)}
                />
              </View>

              {/* Direction */}
              <Text style={[styles.fieldLabel, mutedInk]}>Direction</Text>
              <View style={[styles.toggle, toggleFrame]}>
                {DIRECTIONS[entityType].map((option) => {
                  const isActive = option.type === direction;
                  const optionColor =
                    option.type === 'you_owe' ? theme.expense : theme.income;

                  return (
                    <Pressable
                      key={option.type}
                      onPress={() => {
                        setDirection(option.type);
                        setFormError(null);
                      }}
                      style={({ pressed }) => [
                        styles.toggleButton,
                        { borderRadius: pillRadius },
                        isActive && {
                          backgroundColor: optionColor,
                          ...activeSlab,
                        },
                        pressed && styles.togglePressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text
                        style={[
                          styles.toggleLabel,
                          mutedInk,
                          // Bright sage/terracotta fill → dark ink (the
                          // entity toggle above keeps the light ink on
                          // its dark brand container in flat).
                          isActive && { color: inkOnFill },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* When this entry actually moves cash — spelled out. */}
              <Text style={[styles.formHint, mutedInk]}>
                {balanceHint(entityType, direction)}
              </Text>

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
                accessibilityLabel={
                  entityType === 'shop' ? 'Add shop tab' : 'Add debt'
                }
              >
                <Text style={[styles.submitLabel, { color: inkOnFill }]}>
                  {entityType === 'shop' ? 'Add Tab' : 'Add Debt'}
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
    // Full-bleed scrim (explicit props: `absoluteFillObject` is not part of
    // the RN 0.88 type surface). No `backdrop` token exists, and the
    // translucent dim reads neutral over both canvases, so it stays the
    // flat constant in both modes.
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
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    // `color` follows the active theme.
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  nameInput: {
    // Fill/border/radius arrive through `fieldFrame`; ink follows the theme.
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Fill/border/radius arrive through `fieldFrame`.
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '700',
    // `color` follows the active theme.
    marginRight: spacing.xs,
  },
  amountInput: {
    minWidth: 120,
    padding: 0,
    fontSize: 36,
    fontWeight: '800',
    // `color` follows the active theme.
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  toggle: {
    flexDirection: 'row',
    // Fill/border/radius/shadow arrive through `toggleFrame`.
    padding: spacing.xs,
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
    // Base ink follows the theme; the active state overrides it above.
  },
  formError: {
    fontSize: 13,
    // `color` follows the active theme (inline above).
    textAlign: 'center',
    marginTop: spacing.md,
  },
  // Balance-rule caption under the direction toggle.
  formHint: {
    fontSize: 12,
    lineHeight: 17,
    // `color` follows the active theme.
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  submitButton: {
    minHeight: 54,
    marginTop: spacing.lg,
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
