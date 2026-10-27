import { useCallback, useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Keypad, PinDots } from '@/components/Keypad';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useSession } from '@/state/session';
import { spacing } from '@/theme/tokens';

// Shown each time the app opens for a seller who is already signed in.
export default function Unlock() {
  const { me, checkPin, unlock, logout, biometric } = useSession();
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);

  const openWithFace = useCallback(async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Open Ceeneet', fallbackLabel: 'Use PIN' });
    if (r.success) {
      unlock();
      router.replace('/(tabs)/home');
    }
  }, [unlock]);

  // If Face ID is on, ask for it straight away. The PIN keypad stays available.
  useEffect(() => {
    if (biometric) void openWithFace();
  }, [biometric, openWithFace]);

  const add = async (d: string) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setWrong(false);
    if (next.length === 6) {
      if (await checkPin(next)) {
        unlock();
        router.replace('/(tabs)/home');
      } else {
        setTimeout(() => { setPin(''); setWrong(true); }, 200);
      }
    }
  };

  return (
    <Screen
      noBack
      footer={
        <>
          <Keypad onDigit={add} onBackspace={() => setPin((p) => p.slice(0, -1))} />
          {biometric ? <Button variant="secondary" label="Use Face ID or fingerprint" onPress={openWithFace} /> : null}
          <Button variant="text" label="Forgot PIN? Log in again" onPress={async () => { await logout(); router.replace('/'); }} />
        </>
      }
    >
      <View style={{ paddingTop: spacing.xxl, gap: spacing.xs }}>
        <Text variant="h2">Welcome back{me ? `, ${me.shopName}` : ''}</Text>
        <Text tone="secondary">Enter your PIN to open Ceeneet.</Text>
      </View>
      <View style={{ paddingTop: spacing.xl, gap: spacing.md }}>
        <PinDots filled={pin.length} />
        {wrong ? <Text variant="bodySmall" tone="error" align="center">That PIN is not right. Try again.</Text> : null}
      </View>
    </Screen>
  );
}
