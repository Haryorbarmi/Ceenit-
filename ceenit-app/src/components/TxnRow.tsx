import { Pressable, StyleSheet, View } from 'react-native';
import { color, radius, spacing, tone as palette, ToneName } from '@/theme/tokens';
import { Icon, IconName } from './Icon';
import { StatusChip } from './Chips';
import { Text } from './Text';
import type { Txn } from '@/data/mock';

const icons: Record<Txn['status'], IconName> = {
  Paid: 'arrow-down-left',
  Pending: 'clock',
  Expired: 'x-circle',
  'Needs attention': 'alert-triangle',
};

const tones: Record<Txn['status'], ToneName> = { Paid: 'success', Pending: 'accent', Expired: 'error', 'Needs attention': 'warning' };

export function TxnRow({ txn, onPress }: { txn: Txn; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <View style={[styles.icon, { backgroundColor: palette[tones[txn.status]].bg }]}>
        <Icon name={icons[txn.status]} size={20} tone={tones[txn.status]} />
      </View>
      <View style={styles.info}>
        <Text variant="bodyMedium" numberOfLines={1}>{txn.item}</Text>
        <Text variant="bodySmall" tone="tertiary" numberOfLines={1}>{txn.sub}</Text>
      </View>
      <View style={styles.right}>
        <Text variant="bodyMedium">{txn.amount} USDT</Text>
        <StatusChip status={txn.status} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: color.borderDefault,
  },
  icon: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: color.bgSubtle, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: spacing.xxs },
  right: { alignItems: 'flex-end', gap: spacing.xxs },
});
