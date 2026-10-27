import { useEffect, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Note, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/state/session';
import { color, radius, spacing, tone } from '@/theme/tokens';

/** "TQn9 Y2kh DGZM …" so an address is easy to check by eye. */
const blocks = (a: string) => a.match(/.{1,4}/g)?.join(' ') ?? a;

function countdown(startsAt: string, now: number): string {
  const m = Math.ceil((new Date(startsAt).getTime() - now) / 60_000);
  if (m <= 0) return 'Starting now';
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m left` : `${m}m left`;
}

// Wallet: the address buyers pay into, and a protected way to change it.
export default function MyWallet() {
  const { me, setMe, refreshMe } = useSession();
  const [now, setNow] = useState(() => Date.now());
  const [pulling, setPulling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const pending = me?.pendingWalletChange ?? null;

  // While a change is waiting, keep the countdown moving and notice when it has started.
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => { setNow(Date.now()); void refreshMe(); }, 30_000);
    return () => clearInterval(t);
  }, [pending, refreshMe]);

  if (!me) return null;

  const copy = async () => {
    await Clipboard.setStringAsync(me.wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cancel = () =>
    Alert.alert('Cancel wallet change?', 'Your current wallet stays as it is.', [
      { text: 'Keep waiting', style: 'cancel' },
      { text: 'Cancel change', style: 'destructive', onPress: async () => { try { setMe(await api.cancelWalletChange()); } catch (e) { setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.'); } } },
    ]);

  return (
    <Screen
      title="Wallet"
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={async () => { setPulling(true); await refreshMe(); setPulling(false); }} />}
      footer={pending ? <Button variant="outline" label="Cancel wallet change" onPress={cancel} /> : <Button label="Change wallet" onPress={() => router.push('/change-wallet')} />}
    >
      <View style={styles.card}>
        <View style={styles.top}>
          <Text variant="caption" tone="tertiary">Your payout wallet</Text>
          <View style={styles.active}><Icon name="check-circle" size={14} tone="success" /><Text variant="caption" tone="success">Active</Text></View>
        </View>
        <Text variant="h3" style={styles.address}>{blocks(me.wallet)}</Text>
        <Text variant="label" tone="accent" onPress={copy}>{copied ? 'Copied' : 'Copy address'}</Text>
      </View>

      <View style={styles.network}>
        <Icon name="credit-card" size={20} tone="accent" />
        <View style={{ gap: spacing.xxs }}>
          <Text variant="caption" tone="tertiary">Network</Text>
          <Text variant="bodyMedium">TRON (TRC20) · USDT</Text>
        </View>
      </View>

      {pending ? (
        <View style={styles.pending}>
          <Text variant="bodyMedium">A wallet change is waiting</Text>
          <Text variant="h3" style={styles.address}>{blocks(pending.address)}</Text>
          <Text variant="bodySmall" tone="secondary">It starts in {countdown(pending.startsAt, now)}. Links you make until then still pay the wallet above.</Text>
        </View>
      ) : null}

      {error ? <Note icon="alert-triangle" tone="error">{error}</Note> : null}
      <Note icon="shield" tone="accent">Ceenit never holds your money or your keys. Buyers pay straight into this wallet.</Note>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: color.borderDefault, backgroundColor: color.bgSurface },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  active: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  address: { lineHeight: 28 },
  network: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: color.borderDefault },
  pending: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: tone.warning.border, backgroundColor: tone.warning.bg },
});
