import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { DisclaimerSheet } from '@/components/DisclaimerSheet';
import { Note, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { ApiError } from '@/lib/api';
import { useRate } from '@/lib/rate';
import { formatNaira, formatUsdt, parseAmount } from '@/lib/format';
import { useLinks } from '@/state/links';
import { useSession } from '@/state/session';
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
  const rate = useRate();
  const { draft, createLink } = useLinks();
  const { me } = useSession();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const base = parseAmount(draft.amount);

  const create = async () => {
    setSheet(false);
    setBusy(true);
    setError('');
    try {
      const link = await createLink(draft);
      router.replace({ pathname: '/link-ready', params: { id: link.id } });
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'free_limit_reached' || e.code === 'subscription_ended')) router.replace('/free-limit');
      else setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Preview"
      footer={
        <>
          <Button label={busy ? 'Creating…' : 'Create and share link'} disabled={busy} onPress={() => setSheet(true)} />
          <Button variant="outline" label="Edit details" onPress={() => router.back()} />
        </>
      }
    >
      <Text variant="h2">What your buyer will see</Text>
      <Text tone="secondary">Check the details before you share.</Text>

      <View style={styles.card}>
        <View style={styles.seller}>
          <View style={styles.avatar}><Text variant="label" tone="inverse">{me?.shopName[0]}</Text></View>
          <Text variant="bodyMedium">{me?.shopName}</Text>
        </View>
        <Text variant="h3">{draft.item}</Text>
        <View style={{ gap: spacing.xxs }}>
          <Text variant="caption" tone="tertiary">Pay exactly</Text>
          <Text variant="h1">{formatUsdt(base)} USDT</Text>
          <Text variant="bodySmall" tone="tertiary">plus a few cents added when you create it · ≈ {formatNaira(base, rate)} · estimate</Text>
        </View>
        <View>
          <Row k="Network" v="TRON (TRC20)" strong />
          <Row k="Expires in" v={draft.expiry} />
        </View>
      </View>

      {error ? <Note icon="alert-triangle" tone="error">{error}</Note> : null}
      <Note icon="shield" tone="accent">Buyers pay straight to your wallet. Once created, the link is live and cannot be cancelled.</Note>

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
