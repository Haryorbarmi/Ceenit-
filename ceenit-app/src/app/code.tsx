import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { CodeBoxes, Keypad } from '@/components/Keypad';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useOnboarding } from '@/state/onboarding';

export default function Code() {
  const { data } = useOnboarding();
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(42);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const via = data.method === 'phone' ? `on WhatsApp to +234 ${data.contact || '801 234 5678'}` : `to ${data.contact || 'your email'}`;

  return (
    <Screen
      title="Verify"
      footer={
        <>
          {/* Demo build: any 6 digits are accepted. Real code checking comes with the backend. */}
          <Button label="Verify" disabled={code.length < 6} onPress={() => router.push('/details')} />
          <Keypad onDigit={(d) => setCode((c) => (c.length < 6 ? c + d : c))} onBackspace={() => setCode((c) => c.slice(0, -1))} />
        </>
      }
    >
      <Text variant="h2">Enter the 6-digit code</Text>
      <Text tone="secondary">Sent {via}.</Text>
      <CodeBoxes value={code} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="bodySmall" tone="tertiary" onPress={() => seconds <= 0 && setSeconds(42)}>
          {seconds > 0 ? `Resend code in 0:${String(seconds).padStart(2, '0')}` : 'Resend code'}
        </Text>
        <Text variant="label" onPress={() => router.back()}>Change {data.method === 'phone' ? 'number' : 'email'}</Text>
      </View>
    </Screen>
  );
}
