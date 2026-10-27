import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Icon, IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { AppNotification } from '@/lib/api';
import { openFromAlert } from '@/lib/push';
import { useInbox } from '@/state/inbox';
import { color, radius, spacing, tone as palette, ToneName } from '@/theme/tokens';

const look: Record<string, { icon: IconName; tone: ToneName }> = {
  payment_confirmed: { icon: 'arrow-down-left', tone: 'success' },
  payment_detected: { icon: 'clock', tone: 'accent' },
  payment_flagged: { icon: 'alert-triangle', tone: 'warning' },
  payment_unmatched: { icon: 'help-circle', tone: 'warning' },
  link_requested: { icon: 'refresh-cw', tone: 'accent' },
};

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  if (s < 172800) return 'yesterday';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function Row({ n }: { n: AppNotification }) {
  const l = look[n.type] ?? { icon: 'bell' as IconName, tone: 'accent' as ToneName };
  return (
    <Pressable onPress={() => openFromAlert({ type: n.type, invoiceId: n.invoiceId ?? undefined })} style={({ pressed }) => [styles.row, !n.read && styles.unread, pressed && { opacity: 0.6 }]}>
      <View style={[styles.icon, { backgroundColor: palette[l.tone].bg }]}>
        <Icon name={l.icon} size={20} tone={l.tone} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <View style={styles.top}>
          <Text variant="bodyMedium" style={{ flex: 1 }}>{n.title}</Text>
          <Text variant="caption" tone="tertiary">{ago(n.at)}</Text>
        </View>
        <Text variant="bodySmall" tone="secondary">{n.body}</Text>
      </View>
      {!n.read ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

// The bell inbox. Opening it loads the latest alerts; the unread dots stay for this visit and clear when you leave.
export default function Notifications() {
  const { inbox, refresh, markAllRead } = useInbox();
  const [pulling, setPulling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => { void markAllRead(); };
    }, [refresh, markAllRead]),
  );

  return (
    <Screen title="Notifications" refreshControl={<RefreshControl refreshing={pulling} onRefresh={async () => { setPulling(true); await refresh(); setPulling(false); }} />}>
      {inbox.items.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><Icon name="bell" size={32} tone="accent" /></View>
          <Text variant="h3">No notifications yet</Text>
          <Text tone="secondary" align="center">When you are paid, or a buyer asks for a new link, it shows up here.</Text>
        </View>
      ) : (
        <View>{inbox.items.map((n) => <Row key={n.id} n={n} />)}</View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xs, borderBottomWidth: 1, borderBottomColor: color.borderDefault },
  unread: { backgroundColor: palette.accent.bg, borderRadius: radius.md },
  icon: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.accent.solid, marginTop: spacing.xs },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: palette.accent.bg, alignItems: 'center', justifyContent: 'center' },
});
