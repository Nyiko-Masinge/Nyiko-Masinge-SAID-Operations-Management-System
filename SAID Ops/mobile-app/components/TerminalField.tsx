import { ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { colors } from '../theme';

type TerminalFieldProps = {
  accessibilityLabel: string;
  children: ReactNode;
  onChangeText: (value: string) => void;
  placeholder: string;
  rightAccessory?: ReactNode;
  secureTextEntry?: boolean;
  value: string;
};

export function TerminalField({
  accessibilityLabel,
  children,
  onChangeText,
  placeholder,
  rightAccessory,
  secureTextEntry,
  value,
}: TerminalFieldProps) {
  return (
    <View style={styles.shell}>
      <View pointerEvents="none" style={styles.cornerTopLeft} />
      <View pointerEvents="none" style={styles.cornerBottomRight} />
      <View style={styles.icon}>{children}</View>
      <View style={styles.divider} />
      <TextInput
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
      {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 3,
    borderWidth: 1,
    flexDirection: 'row',
    height: 56,
    overflow: 'hidden',
    paddingHorizontal: 12,
  },
  cornerTopLeft: { backgroundColor: colors.blueBright, height: 1, left: 0, position: 'absolute', top: 0, width: 38 },
  cornerBottomRight: { backgroundColor: colors.blue, bottom: 0, height: 1, position: 'absolute', right: 0, width: 38 },
  icon: { alignItems: 'center', justifyContent: 'center', width: 34 },
  divider: { backgroundColor: colors.blueBright, height: 28, marginRight: 12, width: 1 },
  input: { color: colors.text, flex: 1, fontSize: 16, height: '100%' },
  accessory: { alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 48 },
});
