import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Icon, IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useSession } from '@/state/session';
import { color, spacing, tone } from '@/theme/tokens';

type Row = { icon: IconName; title: string; value?: string; locked?: boolean; onPress?: () => void };

const rowsFor = (plan: string, wallet: string, logout: () => void): Row[] => [
  { icon: 'link', title: 'My link page' },
  { icon: 'credit-card', title: 'Wallet', value: `TRON · ${wallet.slice(0, 4)}…${wallet.slice(-4)}` },
  { icon: 'file-text', title: 'Plan and billing', value: plan[0]!.toUpperCase() + plan.slice(1), onPress: () => router.push('/free-limit') },
  { icon: 'bar-chart-2', title: 'Sales reports', value: 'Business', locked: true },
  { icon: 'bell', title: 'Notifications' },
  { icon: 'lock', title: 'Security', value: 'PIN, devices' },
  { icon: 'help-circle', title: 'Help and support' },
  { icon: 'log-out', title: 'Log out', onPress: logout },
];

export default function Account() {
  const { me, logout } = useSession();
  const rows = rowsFor(me?.plan ?? 'free', me?.wallet ?? '', async () => { await logout(); router.replace('/'); });
  return (
    <Screen>
      <View style={styles.profile}>
        <View style={styles.avatar}><Text variant="h2" tone="inverse">{(me?.shopName ?? 'C')[0]}</Text></View>
        <View style={{ gap: spacing.xxs }}>
          <Text variant="h3">{me?.shopName}</Text>
          <Text variant="bodySmall" tone="secondary">{me?.link.replace(/^https?:\/\//, '')}</Text>
        </View>
      </View>
      <View>
        {rows.map((r) => (
          <Pressable key={r.title} onPress={r.onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
            <Icon name={r.icon} size={24} />
            <Text style={{ flex: 1 }}>{r.title}</Text>
            {r.value ? <Text variant="bodySmall" tone="tertiary">{r.value}</Text> : null}
            {r.locked ? <Icon name="lock" size={16} tone="tertiary" /> : null}
            <Icon name="chevron-right" size={20} tone="tertiary" />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: tone.accent.solid, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: color.borderDefault },
});
