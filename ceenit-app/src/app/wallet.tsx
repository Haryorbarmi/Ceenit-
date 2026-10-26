import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Input } from '@/components/Input';
import { Note, Progress, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { color, radius, spacing, tone } from '@/theme/tokens';
import { api } from '@/lib/api';
import { isTronAddress } from '@/lib/format';
import { useOnboarding } from '@/state/onboarding';

export default function Wallet() {
  const { data, update } = useOnboarding();
  const address = data.wallet.trim();
  const shapeOk = isTronAddress(address);
  // The API also checks the address's built-in checksum, which catches a mistyped character.
  const [check, setCheck] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle');
  useEffect(() => {
    if (!shapeOk) return setCheck('idle');
    setCheck('checking');
    let stale = false;
    api.walletValid(address).then((r) => !stale && setCheck(r.valid ? 'ok' : 'bad')).catch(() => !stale && setCheck('ok'));
    return () => { stale = true; };
  }, [address, shapeOk]);
  const valid = shapeOk && check === 'ok';
  const error = address.length > 0 && (!shapeOk || check === 'bad') ? 'This is not a valid TRON (TRC20) address. Check every character.' : undefined;

  return (
    <Screen
      title="Step 3 of 4"
      footer={<Button label="Continue" disabled={!valid} onPress={() => router.push('/confirm-wallet')} />}
    >
      <Progress step={3} />
      <Text variant="h2">Add your USDT wallet</Text>
      <Text tone="secondary">Buyers pay straight into this wallet. Use a TRON (TRC20) address.</Text>

      <View style={styles.network}>
        <View style={styles.netIcon}><Icon name="credit-card" size={20} tone="accent" /></View>
        <View style={{ gap: spacing.xxs }}>
          <Text variant="caption" tone="tertiary">Network</Text>
          <Text variant="bodyMedium">TRON (TRC20) · USDT</Text>
        </View>
      </View>

      <Input
        label="Wallet address"
        value={data.wallet}
        onChangeText={(wallet) => update({ wallet })}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="T…"
        error={error}
      />
      <Note icon="alert-triangle" tone="warning">
        Only TRON (TRC20) addresses work. A wrong address means lost payments, and Ceenit cannot recover them.
      </Note>
    </Screen>
  );
}

const styles = StyleSheet.create({
  network: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: color.bgSurface,
    borderWidth: 1,
    borderColor: color.borderDefault,
  },
  netIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: tone.accent.bg, alignItems: 'center', justifyContent: 'center' },
});
