import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { Icon, IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useSession } from '@/state/session';
import { color, spacing, tone } from '@/theme/tokens';

type Row = { icon: IconName; title: string; value?: string; locked?: boolean; onPress?: () => void };

const rowsFor = (plan: string, wallet: string, logout: () => void): Row[] => [
  { icon: 'user', title: 'Edit profile', onPress: () => router.push('/profile') },
  { icon: 'credit-card', title: 'Wallet', value: `TRON · ${wallet.slice(0, 4)}…${wallet.slice(-4)}` },
  { icon: 'file-text', title: 'Plan and billing', value: plan[0]!.toUpperCase() + plan.slice(1), onPress: () => router.push('/plan') },
  { icon: 'bar-chart-2', title: 'Sales reports', value: 'Business', locked: true },
  { icon: 'bell', title: 'Notifications' },
  { icon: 'lock', title: 'Security', value: 'PIN, devices' },
  { icon: 'help-circle', title: 'Help and support' },
  { icon: 'log-out', title: 'Log out', onPress: logout },
];

export default function Account() {
  const { me, logout, refreshMe } = useSession();
  const [pulling, setPulling] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    if (!me) return;
    await Clipboard.setStringAsync(me.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const rows = rowsFor(me?.plan ?? 'free', me?.wallet ?? '', async () => { await logout(); router.replace('/'); });
  return (
    <Screen refreshControl={<RefreshControl refreshing={pulling} onRefresh={async () => { setPulling(true); await refreshMe(); setPulling(false); }} />}>
      <View style={styles.profile}>
        <Avatar me={me} size={64} />
        <View style={{ gap: spacing.xxs, flex: 1 }}>
          <View style={styles.nameRow}>
            <Text variant="h3" style={{ flexShrink: 1 }}>{me?.shopName}</Text>
            {me?.subscribed ? <VerifiedBadge size={20} /> : null}
          </View>
          <View style={styles.nameRow}>
            <Text variant="bodySmall" tone="secondary" style={{ flexShrink: 1 }}>{me?.link.replace(/^https?:\/\//, '')}</Text>
            <Pressable onPress={copyLink} hitSlop={8} accessibilityLabel="Copy my page link" style={({ pressed }) => pressed && { opacity: 0.6 }}>
              <Icon name={copied ? 'check' : 'copy'} size={18} tone={copied ? 'success' : 'accent'} />
            </Pressable>
          </View>
          {me?.subscribed ? <Text variant="caption" tone="tertiary">{me.likes} {me.likes === 1 ? 'like' : 'likes'}</Text> : null}
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: color.borderDefault },
});
