import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TxnRow } from '@/components/TxnRow';
import { useHideBalance } from '@/lib/privacy';
import { useRate } from '@/lib/rate';
import { formatNaira, formatUsdt } from '@/lib/format';
import { useInbox } from '@/state/inbox';
import { useLinks } from '@/state/links';
import { useSession } from '@/state/session';
import { useStyles, useTheme } from '@/theme/theme';
import { hues, radius, spacing, Theme } from '@/theme/tokens';

function SectionHead({ title, action }: { title: string; action?: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.sectionHead}>
      <Text variant="h3">{title}</Text>
      {action ? <Text variant="label" tone="secondary" onPress={() => router.push('/(tabs)/history')}>{action}</Text> : null}
    </View>
  );
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function Home() {
  const rate = useRate();
  const { color, tone, isDark, toggle: toggleTheme } = useTheme();
  const styles = useStyles(makeStyles);
  const { hidden, toggle: toggleHidden } = useHideBalance();
  const { inbox, refresh: refreshInbox } = useInbox();
  const { me, refreshMe } = useSession();
  const { txns, invoices, requests, totals, loading, refresh } = useLinks();
  const [pulling, setPulling] = useState(false);
  const pending = txns.filter((t) => t.status === 'Pending');
  const recent = txns.filter((t) => t.status === 'Paid').slice(0, 5);
  const attention = txns.filter((t) => t.status === 'Needs attention');
  const freePlan = me?.plan === 'free';
  const firstName = me?.fullName.split(' ')[0] ?? '';

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={pulling} onRefresh={async () => { setPulling(true); await Promise.all([refresh(), refreshMe(), refreshInbox()]); setPulling(false); }} />
      }
      header={
        <>
          <View style={styles.header}>
            <View style={styles.who}>
              <Avatar me={me} size={44} />
              <View style={{ gap: spacing.xxs, flexShrink: 1 }}>
                <Text variant="bodySmall" tone="tertiary">{greeting()}, {firstName}</Text>
                <Text variant="h3">{me?.shopName ?? ''}</Text>
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable style={({ pressed }) => [styles.bell, pressed && { opacity: 0.6 }]} onPress={toggleTheme} accessibilityRole="button" accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
                <Icon name={isDark ? 'sun' : 'moon'} size={22} />
              </Pressable>
              <Pressable style={({ pressed }) => [styles.bell, pressed && { opacity: 0.6 }]} onPress={() => router.push('/notifications')} accessibilityRole="button" accessibilityLabel={inbox.unread ? `Notifications, ${inbox.unread} unread` : 'Notifications'}>
                <Icon name="bell" size={22} />
                {inbox.unread > 0 ? (
                  <View style={styles.badge}><Text variant="caption" tone="inverse" style={styles.badgeText}>{inbox.unread > 9 ? '9+' : inbox.unread}</Text></View>
                ) : null}
              </Pressable>
            </View>
          </View>
          <LinearGradient colors={['#000000', '#1a0b3d', '#4c1d95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summary}>
            <View pointerEvents="none" style={styles.glowA} />
            <View pointerEvents="none" style={styles.glowB} />
            <View style={styles.cardTop}>
              <Text variant="bodySmall" tone="muted">Total received</Text>
              <Pressable onPress={toggleHidden} hitSlop={12} style={({ pressed }) => pressed && { opacity: 0.6 }} accessibilityRole="button" accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}>
                <Icon name={hidden ? 'eye-off' : 'eye'} size={22} tone="inverse" />
              </Pressable>
            </View>
            <View style={{ gap: spacing.xxs }}>
              <Text variant="h1" tone="inverse">{hidden ? '••••••' : formatUsdt(totals.received)} USDT</Text>
              <Text variant="caption" tone="muted">
                {totals.received > 0 ? `≈ ${hidden ? '₦••••••' : formatNaira(totals.received, rate)} · naira is an estimate` : 'Your payments will show here'}
              </Text>
            </View>
            <View style={styles.stats}>
              <View style={{ flex: 1, gap: spacing.xxs }}>
                <Text variant="caption" tone="muted">Paid</Text>
                <Text variant="h3" tone="inverse">{hidden ? '••' : totals.paid}</Text>
              </View>
              <View style={{ flex: 1, gap: spacing.xxs }}>
                <Text variant="caption" tone="muted">Pending</Text>
                <Text variant="h3" tone="inverse">{hidden ? '••' : totals.pending}</Text>
              </View>
            </View>
          </LinearGradient>
        </>
      }
    >
      {freePlan && me ? (
        <View style={styles.free}>
          <View style={styles.freeRow}>
            <Text variant="bodySmall">Free plan · {me.freeUsed} of {me.freeTotal} transactions used</Text>
            <Text variant="label" onPress={() => router.push('/free-limit')}>Upgrade</Text>
          </View>
          <View style={styles.meter}>
            {Array.from({ length: me.freeTotal }).map((_, i) => (
              <View key={i} style={[styles.meterBar, { backgroundColor: i < me.freeUsed ? tone.accent.solid : color.borderDefault }]} />
            ))}
          </View>
        </View>
      ) : null}

      {requests.length > 0 ? (
        <Pressable style={styles.request} onPress={() => router.push('/link-requests')}>
          <Icon name="refresh-cw" size={24} tone="accent" />
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <Text variant="bodyMedium">{requests.length} new link {requests.length === 1 ? 'request' : 'requests'}</Text>
            <Text variant="bodySmall" tone="secondary">{requests[0]!.buyerName || 'A buyer'} wants a fresh link for {requests[0]!.item}</Text>
          </View>
          <Icon name="chevron-right" size={20} />
        </Pressable>
      ) : null}

      {attention.length > 0 ? (
        <Pressable style={styles.attention} onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: attention[0]!.id } })}>
          <Icon name="alert-triangle" size={24} tone="warning" />
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <Text variant="bodyMedium">{attention.length} {attention.length === 1 ? 'payment needs' : 'payments need'} attention</Text>
            <Text variant="bodySmall" tone="secondary">{attention[0]!.item} · {attention[0]!.sub}</Text>
          </View>
          <Icon name="chevron-right" size={20} />
        </Pressable>
      ) : null}

      {!loading && invoices.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><Icon name="file-text" size={32} tone="accent" /></View>
          <Text variant="h3">No payments yet</Text>
          <Text tone="secondary" align="center">Create a payment link for your first sale and share it on WhatsApp.</Text>
          <Button label="Create payment link" onPress={() => router.push('/(tabs)/new')} style={{ alignSelf: 'stretch' }} />
        </View>
      ) : null}

      {pending.length > 0 ? (
        <>
          <SectionHead title="Pending" action="See all" />
          <View>{pending.map((t) => <TxnRow key={t.id} txn={t} onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: t.id } })} />)}</View>
        </>
      ) : null}

      {recent.length > 0 ? (
        <>
          <SectionHead title="Recent payments" action="See all" />
          <View>{recent.map((t) => <TxnRow key={t.id} txn={t} onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: t.id } })} />)}</View>
        </>
      ) : null}
    </Screen>
  );
}

const makeStyles = ({ color, tone }: Theme) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bell: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: color.borderDefault, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: tone.accent.solid, borderWidth: 2, borderColor: color.bgPage, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, lineHeight: 14 },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  summary: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, overflow: 'hidden' },
  glowA: { position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: tone.accent.solid, opacity: 0.35 },
  glowB: { position: 'absolute', bottom: -70, left: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: hues.purple[400], opacity: 0.18 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stats: { flexDirection: 'row', gap: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: '#ffffff33' },
  free: { borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  freeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meter: { flexDirection: 'row', gap: spacing.xxs },
  meterBar: { flex: 1, height: 6, borderRadius: 3 },
  request: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: tone.accent.border, backgroundColor: tone.accent.bg },
  attention: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: tone.warning.border, backgroundColor: tone.warning.bg },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: tone.accent.bg, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
});
