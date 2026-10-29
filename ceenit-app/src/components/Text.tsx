import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/theme/theme';
import { type, TypeVariant } from '@/theme/tokens';

type Tone = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'muted' | 'accent' | 'success' | 'error' | 'warning';

type Props = RNTextProps & {
  variant?: TypeVariant;
  tone?: Tone;
  align?: 'left' | 'center' | 'right';
};

export function Text({ variant = 'body', tone = 'primary', align, style, ...rest }: Props) {
  const { color, tone: palette } = useTheme();
  const tones: Record<Tone, string> = {
    primary: color.textPrimary,
    secondary: color.textSecondary,
    tertiary: color.textTertiary,
    inverse: color.textInverse,
    muted: color.textMuted,
    accent: palette.accent.text,
    success: palette.success.text,
    error: palette.error.text,
    warning: palette.warning.text,
  };
  return (
    <RNText
      {...rest}
      style={[type[variant], { color: tones[tone] }, align ? { textAlign: align } : null, style]}
    />
  );
}
