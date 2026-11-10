import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { text } from '../../features/home/styles';
import { colors, radii, spacing, typography } from '../../theme/tokens';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  trailing?: ReactNode;
}

// Dark input on the navy background: a faint fill, hairline border that gets
// lighter while focused, white text, sentence-case label. The focus border is
// visual only; any onFocus/onBlur a screen passes is still called.
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, trailing, style, ...inputProps },
  ref
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, focused && styles.fieldFocused, error ? styles.fieldError : null]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.outline}
          selectionColor={colors.primary}
          style={[styles.input, style]}
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
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
    ...text.meta,
    color: colors.onSurfaceVariant,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderRadius: radii.DEFAULT,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  fieldFocused: {
    borderColor: 'rgba(185,195,255,0.55)',
  },
  fieldError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    minHeight: 56,
    paddingHorizontal: spacing.base * 2,
    ...typography.bodyMd,
    color: '#ffffff',
  },
  error: {
    ...text.meta,
    color: colors.error,
  },
});
