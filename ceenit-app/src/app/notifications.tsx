import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Icon, IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { AppNotification } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { openFromAlert } from '@/lib/push';
import { useInbox } from '@/state/inbox';
import { useStyles, useTheme } from '@/theme/theme';
import { radius, spacing, ToneName, Theme } from '@/theme/tokens';

const look: Record<string, { icon: IconName; tone: ToneName }> = {
  payment_confirmed: { icon: 'arrow-down-left', tone: 'success' },
  payment_detected: { icon: 'clock', tone: 'accent' },
  payment_flagged: { icon: 'alert-triangle', tone: 'warning' },
  payment_unmatched: { icon: 'help-circle', tone: 'warning' },
  invoice_expired: { icon: 'x-circle', tone: 'error' },
  plan_ending: { icon: 'clock', tone: 'warning' },
  plan_ended: { icon: 'x-circle', tone: 'error' },
  billing_failed: { icon: 'alert-triangle', tone: 'error' },
  new_device: { icon: 'smartphone', tone: 'warning' },
  wallet_change_requested: { icon: 'credit-card', tone: 'warning' },
  wallet_changed: { icon: 'credit-card', tone: 'success' },
  link_requested: { icon: 'refresh-cw', tone: 'accent' },
};

function Row({ n }: { n: AppNotification }) {
  const { tone: palette } = useTheme();
  const styles = useStyles(makeStyles);
  const l = look[n.type] ?? { icon: 'bell' as IconName, tone: 'accent' as ToneName };
  return (
    <Pressable onPress={() => openFromAlert({ type: n.type, invoiceId: n.invoiceId ?? undefined })} style={({ pressed }) => [styles.row, !n.read && styles.unread, pressed && { opacity: 0.6 }]}>
      <View style={[styles.icon, { backgroundColor: palette[l.tone].bg }]}>
        <Icon name={l.icon} size={20} tone={l.tone} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <View style={styles.top}>
          <Text variant="bodyMedium" style={{ flex: 1 }}>{n.title}</Text>
          <Text variant="caption" tone="tertiary">{timeAgo(n.at)}</Text>
        </View>
        <Text variant="bodySmall" tone="secondary">{n.body}</Text>
      </View>
      {!n.read ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

// The bell inbox. Opening it loads the latest alerts; the unread dots stay for this visit and clear when you leave.
export default function Notifications() {
  const styles = useStyles(makeStyles);
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

const makeStyles = ({ color, tone: palette }: Theme) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xs, borderBottomWidth: 1, borderBottomColor: color.borderDefault },
  unread: { backgroundColor: palette.accent.bg, borderRadius: radius.md },
  icon: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.accent.solid, marginTop: spacing.xs },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: palette.accent.bg, alignItems: 'center', justifyContent: 'center' },
});
