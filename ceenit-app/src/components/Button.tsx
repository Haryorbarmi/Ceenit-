import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/theme';
import { radius, spacing } from '@/theme/tokens';
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
  const { color } = useTheme();
  const isText = variant === 'text';
  const bg =
    variant === 'primary' ? (inverse ? color.textInverse : color.bgAction)
    : variant === 'secondary' ? color.bgSubtle
    : 'transparent';
  const onPrimary = inverse ? color.bgInverse : color.textOnAction;
  const textColor = variant === 'primary' ? onPrimary : inverse ? color.textInverse : color.textPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, height: isText ? 44 : 52, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        variant === 'outline' && { borderWidth: 1, borderColor: color.borderStrong },
        style,
      ]}
    >
      <Text variant="label" style={{ color: textColor }}>{label}</Text>
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
