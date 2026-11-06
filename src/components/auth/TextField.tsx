import { forwardRef, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radii, spacing, typography } from '../../theme/tokens';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  trailing?: ReactNode;
}

// DESIGN.md "Inputs": a darker glass variant, same as the name modal's field.
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, trailing, style, ...inputProps },
  ref
) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, error ? styles.fieldError : null]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.outline}
          selectionColor={colors.primary}
          style={[styles.input, style]}
          {...inputProps}
        />
        {trailing}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.base,
  },
  label: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    fontWeight: typography.labelSm.fontWeight,
    letterSpacing: typography.labelSm.letterSpacing,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radii.DEFAULT,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  fieldError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: spacing.base * 2,
    color: colors.onSurface,
    fontFamily: typography.bodyMd.fontFamily,
    fontSize: typography.bodyMd.fontSize,
  },
  error: {
    fontFamily: typography.labelSm.fontFamily,
    fontSize: typography.labelSm.fontSize,
    lineHeight: typography.labelSm.lineHeight,
    color: colors.error,
  },
});
