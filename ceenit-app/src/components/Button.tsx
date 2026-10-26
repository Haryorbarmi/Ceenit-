import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { color, radius, spacing } from '@/theme/tokens';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'outline' | 'text';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  /** Use on a black background (white button, white outline). */
  inverse?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = 'primary', inverse, disabled, style }: Props) {
  const isText = variant === 'text';
  const bg =
    variant === 'primary' ? (inverse ? color.bgPage : color.bgInverse)
    : variant === 'secondary' ? color.bgSubtle
    : 'transparent';
  const textTone =
    variant === 'primary' ? (inverse ? 'primary' : 'inverse')
    : inverse ? 'inverse'
    : 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, height: isText ? 44 : 52, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        variant === 'outline' && { borderWidth: 1, borderColor: inverse ? color.borderStrong : color.borderStrong },
        style,
      ]}
    >
      <Text variant="label" tone={textTone}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
});
