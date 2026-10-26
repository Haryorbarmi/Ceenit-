import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Keypad, PinDots } from '@/components/Keypad';
import { Progress, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { spacing } from '@/theme/tokens';

export default function Pin() {
  const [pin, setPin] = useState('');

  const add = (d: string) => {
    const next = pin.length < 6 ? pin + d : pin;
    setPin(next);
    // The real app will store a hash of the PIN in the phone's secure storage.
    if (next.length === 6) setTimeout(() => router.replace('/ready'), 250);
  };

  return (
    <Screen
      title="Step 4 of 4"
      footer={
        <>
          <Keypad onDigit={add} onBackspace={() => setPin((p) => p.slice(0, -1))} />
          <Button variant="text" label="Use fingerprint instead" onPress={() => router.replace('/ready')} />
        </>
      }
    >
      <Progress step={4} />
      <Text variant="h2">Create your app PIN</Text>
      <Text tone="secondary">You will use it to open Ceenit and approve sensitive actions.</Text>
      <View style={{ paddingTop: spacing.xl }}>
        <PinDots filled={pin.length} />
      </View>
    </Screen>
  );
}
