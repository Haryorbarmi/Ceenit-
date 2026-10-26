import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { color, tone as palette, type, TypeVariant } from '@/theme/tokens';

type Tone = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'muted' | 'accent' | 'success' | 'error' | 'warning';

const tones: Record<Tone, string> = {
  primary: color.textPrimary,
  secondary: color.textSecondary,
  tertiary: color.textTertiary,
  inverse: color.textInverse,
  muted: color.borderStrong,
  accent: palette.accent.text,
  success: palette.success.text,
  error: palette.error.text,
  warning: palette.warning.text,
};

type Props = RNTextProps & {
  variant?: TypeVariant;
  tone?: Tone;
  align?: 'left' | 'center' | 'right';
};

export function Text({ variant = 'body', tone = 'primary', align, style, ...rest }: Props) {
  return (
    <RNText
      {...rest}
      style={[type[variant], { color: tones[tone] }, align ? { textAlign: align } : null, style]}
    />
  );
}
