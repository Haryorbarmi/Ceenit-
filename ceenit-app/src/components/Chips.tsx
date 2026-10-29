import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { radius, spacing, ToneName } from '@/theme/tokens';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

/** Selectable pill, e.g. category or expiry. */
export function OptionChip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const { color, tone: palette } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        styles.option,
        selected ? { backgroundColor: palette.accent.solid } : { borderWidth: 1, borderColor: color.borderDefault },
      ]}
    >
      <Text variant="bodySmall" style={selected ? { color: palette.accent.onSolid } : undefined}>{label}</Text>
    </Pressable>
  );
}

export type Status = 'Paid' | 'Pending' | 'Expired' | 'Needs attention';

const statusIcon: Record<Status, IconName> = {
  Paid: 'check',
  Pending: 'clock',
  Expired: 'x-circle',
  'Needs attention': 'alert-triangle',
};

const statusTone: Record<Status, ToneName> = {
  Paid: 'success',
  Pending: 'accent',
  Expired: 'error',
  'Needs attention': 'warning',
};

/** Status is shown with colour, icon and label, so it still reads without colour. */
export function StatusChip({ status }: { status: Status }) {
  const { tone: palette } = useTheme();
  const t = statusTone[status];
  return (
    <View style={[styles.status, { backgroundColor: palette[t].bg, borderColor: palette[t].border }]}>
      <Icon name={statusIcon[status]} size={14} tone={t} />
      <Text variant="caption" tone={t}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    height: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
});
