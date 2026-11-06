import { MaterialIcons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, type TextInput } from 'react-native';

import { colors } from '../../theme/tokens';
import { TextField, type TextFieldProps } from './TextField';

export const PasswordField = forwardRef<TextInput, Omit<TextFieldProps, 'trailing'>>(
  function PasswordField(props, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <TextField
        ref={ref}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={!visible}
        {...props}
        trailing={
          <Pressable
            onPress={() => setVisible((current) => !current)}
            style={styles.toggle}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          >
            <MaterialIcons
              name={visible ? 'visibility-off' : 'visibility'}
              size={22}
              color={colors.onSurfaceVariant}
            />
          </Pressable>
        }
      />
    );
  }
);

const styles = StyleSheet.create({
  toggle: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
