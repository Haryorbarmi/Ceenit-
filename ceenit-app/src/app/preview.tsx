import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { DisclaimerSheet } from '@/components/DisclaimerSheet';
import { Note, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { seller } from '@/data/mock';
import { formatNaira, formatUsdt, parseAmount } from '@/lib/format';
import { useLinks } from '@/state/links';
import { color, radius, spacing, tone } from '@/theme/tokens';

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text tone="tertiary">{k}</Text>
      <Text variant={strong ? 'bodyMedium' : 'body'}>{v}</Text>
    </View>
  );
}

export default function Preview() {
  const { draft, pickCents, createLink } = useLinks();
  const [sheet, setSheet] = useState(false);
  const base = parseAmount(draft.amount);
  // Chosen once when the screen opens, so the amount does not change while the seller reviews it.
  const cents = useMemo(() => pickCents(base), []); // eslint-disable-line react-hooks/exhaustive-deps
  const total = cents === null ? base : Math.round((base + cents / 100) * 100) / 100;

  const create = () => {
    if (cents === null) return;
    setSheet(false);
    const link = createLink(draft, cents);
    router.replace({ pathname: '/link-ready', params: { id: link.id } });
  };

  return (
    <Screen
      title="Preview"
      footer={
        <>
          <Button label="Create and share link" disabled={cents === null} onPress={() => setSheet(true)} />
          <Button variant="outline" label="Edit details" onPress={() => router.back()} />
        </>
      }
    >
      <Text variant="h2">What your buyer will see</Text>
      <Text tone="secondary">Check the details before you share.</Text>

      <View style={styles.card}>
        <View style={styles.seller}>
          <View style={styles.avatar}><Text variant="label" tone="inverse">{seller.shop[0]}</Text></View>
          <Text variant="bodyMedium">{seller.shop}</Text>
        </View>
        <Text variant="h3">{draft.item}</Text>
        <View style={{ gap: spacing.xxs }}>
          <Text variant="caption" tone="tertiary">Pay exactly</Text>
          <Text variant="h1">{formatUsdt(total)} USDT</Text>
          <Text variant="bodySmall" tone="tertiary">≈ {formatNaira(total)} · estimate</Text>
        </View>
        <View>
          <Row k="Network" v="TRON (TRC20)" strong />
          <Row k="Expires in" v={draft.expiry} />
        </View>
      </View>

      {cents === null ? (
        <Note icon="alert-triangle" tone="warning">
          You already have 99 open links for this amount. Wait for one to finish, or change the amount.
        </Note>
      ) : (
        <Note icon="shield" tone="accent">Buyers pay straight to your wallet. Once created, the link is live and cannot be cancelled.</Note>
      )}

      <DisclaimerSheet visible={sheet} expiryLabel={draft.expiry} onClose={() => setSheet(false)} onConfirm={create} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: color.bgSurface,
    borderWidth: 1,
    borderColor: color.borderDefault,
  },
  seller: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: tone.accent.solid, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
});
