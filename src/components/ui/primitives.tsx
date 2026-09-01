import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { colors, radii, spacing, typography, webPointer } from '@/theme/tokens';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  compact?: boolean;
  accessibilityHint?: string;
};

export function AppButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  compact = false,
  accessibilityHint,
}: AppButtonProps) {
  const palette = buttonPalette[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        fullWidth && styles.fullWidth,
        { backgroundColor: palette.background, borderColor: palette.border },
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        webPointer,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.foreground} size="small" />
      ) : (
        <>
          {icon ? <MaterialCommunityIcons name={icon} color={palette.foreground} size={20} /> : null}
          <Text style={[styles.buttonText, { color: palette.foreground }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const buttonPalette: Record<ButtonVariant, { background: string; foreground: string; border: string }> = {
  primary: { background: colors.accent, foreground: colors.black, border: colors.accent },
  secondary: { background: colors.surfaceRaised, foreground: colors.text, border: colors.border },
  ghost: { background: 'transparent', foreground: colors.textMuted, border: 'transparent' },
  danger: { background: colors.dangerSoft, foreground: colors.danger, border: colors.dangerSoft },
};

type IconButtonProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  size?: number;
};

export function IconButton({ icon, label, onPress, danger = false, disabled = false, size = 44 }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size },
        pressed && styles.pressed,
        disabled && styles.disabled,
        webPointer,
      ]}
    >
      <MaterialCommunityIcons name={icon} color={danger ? colors.danger : colors.textMuted} size={21} />
    </Pressable>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type FieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
};

export function Field({ label, error, hint, ...inputProps }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.textSubtle}
        selectionColor={colors.accent}
        style={[styles.field, error ? styles.fieldError : null]}
        {...inputProps}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  );
}

type NumberControlProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
};

export function NumberControl({ label, value, onChange, min, max, step = 1, suffix }: NumberControlProps) {
  return (
    <View style={styles.numberControl}>
      <Text style={styles.numberLabel}>{label}</Text>
      <View style={styles.numberRow}>
        <IconButton
          icon="minus"
          label={`Diminuir ${label.toLowerCase()}`}
          disabled={value <= min}
          onPress={() => onChange(Math.max(min, value - step))}
          size={44}
        />
        <Text style={styles.numberValue}>
          {value}
          {suffix ? <Text style={styles.numberSuffix}> {suffix}</Text> : null}
        </Text>
        <IconButton
          icon="plus"
          label={`Aumentar ${label.toLowerCase()}`}
          disabled={value >= max}
          onPress={() => onChange(Math.min(max, value + step))}
          size={44}
        />
      </View>
    </View>
  );
}

type ChoiceChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function ChoiceChip({ label, selected, onPress }: ChoiceChipProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
        webPointer,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

type ToggleRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon?: IconName;
};

export function ToggleRow({ label, description, value, onValueChange, icon }: ToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      {icon ? (
        <View style={styles.toggleIcon}>
          <MaterialCommunityIcons name={icon} color={colors.accent} size={20} />
        </View>
      ) : null}
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.hintText}>{description}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.accentStrong }}
        thumbColor={Platform.OS === 'android' ? colors.text : undefined}
      />
    </View>
  );
}

export function SectionHeader({ title, trailing }: { title: string; trailing?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      {trailing ? <Text style={styles.sectionTrailing}>{trailing}</Text> : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <Card style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} size={36} color={colors.accent} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {action}
    </Card>
  );
}

type AdaptiveModalProps = PropsWithChildren<{
  visible: boolean;
  onRequestClose: () => void;
  title: string;
  footer?: ReactNode;
  maxWidth?: number;
  fullHeightOnPhone?: boolean;
}>;

export function AdaptiveModal({
  visible,
  onRequestClose,
  title,
  children,
  footer,
  maxWidth = 760,
  fullHeightOnPhone = true,
}: AdaptiveModalProps) {
  const { isPhone } = useResponsiveLayout();
  const fullScreen = isPhone && fullHeightOnPhone;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose} statusBarTranslucent>
      <View style={[styles.modalBackdrop, fullScreen && styles.modalBackdropPhone]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalSurface, fullScreen && styles.modalSurfacePhone, { maxWidth }]}
        >
          <SafeAreaView style={styles.modalSafeArea} edges={fullScreen ? ['top', 'bottom', 'left', 'right'] : []}>
            <View style={styles.modalHeader}>
              <Text accessibilityRole="header" style={styles.modalTitle} numberOfLines={2}>
                {title}
              </Text>
              <IconButton icon="close" label="Fechar" onPress={onRequestClose} />
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
            {footer ? <View style={styles.modalFooter}>{footer}</View> : null}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  buttonCompact: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  buttonText: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.42,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
  },
  fieldWrap: {
    gap: spacing.xs,
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  field: {
    minHeight: 50,
    color: colors.text,
    backgroundColor: colors.backgroundRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    outlineColor: colors.accent,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.caption,
  },
  hintText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  numberControl: {
    flex: 1,
    minWidth: 138,
    backgroundColor: colors.backgroundRaised,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  numberLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  numberValue: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  numberSuffix: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: typography.small,
  },
  chipTextSelected: {
    color: colors.black,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 54,
  },
  toggleIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: typography.caption,
    letterSpacing: 1,
    fontWeight: '800',
  },
  sectionTrailing: {
    color: colors.accent,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  emptyCard: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xxl,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyMessage: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 420,
    marginBottom: spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdropPhone: {
    padding: 0,
  },
  modalSurface: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: colors.background,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  modalSurfacePhone: {
    maxHeight: '100%',
    height: '100%',
    borderRadius: 0,
    borderWidth: 0,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalScroll: {
    flex: 1,
  },
  modalHeader: {
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  modalTitle: {
    flex: 1,
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  modalContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  modalFooter: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.backgroundRaised,
  },
});
