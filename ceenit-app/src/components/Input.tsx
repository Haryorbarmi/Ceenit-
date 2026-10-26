import { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { color, fonts, radius, spacing, tone, type } from '@/theme/tokens';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = Pick<
  TextInputProps,
  'value' | 'onChangeText' | 'placeholder' | 'keyboardType' | 'autoCapitalize' | 'autoCorrect' | 'autoFocus' | 'maxLength' | 'editable'
> & {
  label: string;
  /** Fixed text shown before the typed value, e.g. "ceenit.app/" */
  prefix?: string;
  error?: string;
};

export function Input({ label, prefix, error, editable = true, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const emphasised = focused || !!error;
  const edge = error ? tone.error.solid : focused ? tone.accent.solid : color.borderDefault;

  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <View
        style={[
          styles.field,
          { borderColor: edge, borderWidth: emphasised ? 2 : 1 },
          !editable && { backgroundColor: color.bgSurface },
        ]}
      >
        {prefix ? <Text variant="body" tone="tertiary">{prefix}</Text> : null}
        <TextInput
          {...rest}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={color.textTertiary}
          selectionColor={tone.accent.solid}
          style={styles.input}
        />
      </View>
      {error ? (
        <View style={styles.error}>
          <Icon name="alert-triangle" size={16} tone="error" />
          <Text variant="bodySmall" tone="error">{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  field: {
    height: 56,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.bgPage,
  },
  input: {
    flex: 1,
    ...type.body,
    fontFamily: fonts.body,
    color: color.textPrimary,
    padding: 0,
    height: '100%',
  },
  error: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
