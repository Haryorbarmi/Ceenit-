import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TxnRow } from '@/components/TxnRow';
import { seller } from '@/data/mock';
import { useLinks } from '@/state/links';
import { router } from 'expo-router';
import { color, radius, spacing, tone } from '@/theme/tokens';

function SectionHead({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text variant="h3">{title}</Text>
      {action ? <Text variant="label" tone="secondary">{action}</Text> : null}
    </View>
  );
}

export default function Home() {
  const { txns } = useLinks();
  const pending = txns.filter((t) => t.status === 'Pending');
  const recent = txns.filter((t) => t.status === 'Paid');
  const attention = txns.filter((t) => t.status === 'Needs attention');

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ gap: spacing.xxs }}>
          <Text variant="bodySmall" tone="tertiary">Good morning, {seller.name}</Text>
          <Text variant="h3">{seller.shop}</Text>
        </View>
        <View style={styles.bell}>
          <Icon name="bell" size={22} />
          <View style={styles.badge} />
        </View>
      </View>

      <View style={styles.summary}>
        <Text variant="bodySmall" tone="muted">Total received</Text>
        <View style={{ gap: spacing.xxs }}>
          <Text variant="h1" tone="inverse">{seller.totalReceived} USDT</Text>
          <Text variant="caption" tone="muted">{seller.naira}</Text>
        </View>
        <View style={styles.stats}>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <Text variant="caption" tone="muted">Paid</Text>
            <Text variant="h3" tone="inverse">{seller.paid}</Text>
          </View>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <Text variant="caption" tone="muted">Pending</Text>
            <Text variant="h3" tone="inverse">{seller.pending}</Text>
          </View>
        </View>
      </View>

      <View style={styles.free}>
        <View style={styles.freeRow}>
          <Text variant="bodySmall">Free plan · {seller.freeUsed} of {seller.freeTotal} transactions used</Text>
          <Text variant="label" onPress={() => router.push('/free-limit')}>Upgrade</Text>
        </View>
        <View style={styles.meter}>
          {Array.from({ length: seller.freeTotal }).map((_, i) => (
            <View key={i} style={[styles.meterBar, { backgroundColor: i < seller.freeUsed ? tone.accent.solid : color.borderDefault }]} />
          ))}
        </View>
      </View>

      {attention.length > 0 ? (
        <Pressable style={styles.attention}>
          <Icon name="alert-triangle" size={24} tone="warning" />
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <Text variant="bodyMedium">{attention.length} late payment needs attention</Text>
            <Text variant="bodySmall" tone="secondary">Chidi paid after the link expired</Text>
          </View>
          <Icon name="chevron-right" size={20} />
        </Pressable>
      ) : null}

      <SectionHead title="Pending" action="See all" />
      <View>{pending.map((t) => <TxnRow key={t.id} txn={t} />)}</View>

      <SectionHead title="Recent payments" action="See all" />
      <View>{recent.map((t) => <TxnRow key={t.id} txn={t} />)}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.xs },
  bell: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: color.borderDefault, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 8, right: 10, width: 10, height: 10, borderRadius: 5, backgroundColor: tone.accent.solid, borderWidth: 2, borderColor: color.bgPage },
  summary: { backgroundColor: color.bgInverse, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: color.textSecondary },
  free: { borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  freeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meter: { flexDirection: 'row', gap: spacing.xxs },
  meterBar: { flex: 1, height: 6, borderRadius: 3 },
  attention: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: tone.warning.border, backgroundColor: tone.warning.bg },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
});
