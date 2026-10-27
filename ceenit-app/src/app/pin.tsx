import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { Keypad, PinDots } from '@/components/Keypad';
import { Progress, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { api, ApiError } from '@/lib/api';
import { useOnboarding } from '@/state/onboarding';
import { useSession } from '@/state/session';
import { spacing } from '@/theme/tokens';

export default function Pin() {
  const { data } = useOnboarding();
  const { me, setMe, savePin } = useSession();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const returning = !!me; // an existing seller logging in on a new phone only needs a PIN for this phone

  const finish = async (value: string) => {
    setBusy(true);
    try {
      if (returning) {
        await savePin(value);
        router.replace('/(tabs)/home');
      } else {
        const created = await api.register({
          method: data.method,
          fullName: data.fullName.trim(),
          shopName: data.shopName.trim(),
          category: data.category,
          city: data.city.trim(),
          linkName: data.linkName,
          wallet: data.wallet.trim(),
        });
        await savePin(value);
        setMe(created);
        router.replace('/ready');
      }
    } catch (e) {
      setPin('');
      Alert.alert('We could not finish sign up', e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const add = (d: string) => {
    if (busy || pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 6) setTimeout(() => finish(next), 200);
  };

  return (
    <Screen title={returning ? 'Set your PIN' : 'Step 4 of 4'} footer={<Keypad onDigit={add} onBackspace={() => setPin((p) => p.slice(0, -1))} />}>
      {returning ? null : <Progress step={4} />}
      <Text variant="h2">Create your app PIN</Text>
      <Text tone="secondary">You will use it to open Ceeneet and approve sensitive actions.</Text>
      <View style={{ paddingTop: spacing.xl }}>
        <PinDots filled={pin.length} />
      </View>
      {busy ? <Text variant="bodySmall" tone="tertiary" align="center">{returning ? 'Saving…' : 'Creating your account…'}</Text> : null}
    </Screen>
  );
}
