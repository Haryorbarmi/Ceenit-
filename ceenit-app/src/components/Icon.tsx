import { Feather } from '@expo/vector-icons';
import { color, tone as palette } from '@/theme/tokens';

export type IconName = React.ComponentProps<typeof Feather>['name'];

type Props = {
  name: IconName;
  size?: number;
  tone?: 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'accent' | 'success' | 'error' | 'warning';
  /** Exact colour, used by the tab bar which passes its own active and inactive tint. */
  tint?: string;
};

const tones = {
  primary: color.textPrimary,
  secondary: color.textSecondary,
  tertiary: color.textTertiary,
  inverse: color.textInverse,
  accent: palette.accent.text,
  success: palette.success.text,
  error: palette.error.text,
  warning: palette.warning.text,
};

export function Icon({ name, size = 24, tone = 'primary', tint }: Props) {
  return <Feather name={name} size={size} color={tint ?? tones[tone]} />;
}
