import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { CodeBoxes, Keypad } from '@/components/Keypad';
import { Note, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { ApiError } from '@/lib/api';
import { useOnboarding } from '@/state/onboarding';
import { useSession } from '@/state/session';

export default function Code() {
  const { data, update } = useOnboarding();
  const { verifyCode, requestCode, hasPin } = useSession();
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(42);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const via = data.method === 'phone' ? `on WhatsApp to +234 ${data.contact}` : `to ${data.contact}`;

  const verify = async () => {
    setBusy(true);
    setError('');
    try {
      const hasAccount = await verifyCode(data.method, data.contact, code);
      // New sellers finish sign up. Returning sellers go straight in, after setting a PIN on this phone if it has none.
      router.replace(hasAccount ? (hasPin ? '/(tabs)/home' : '/pin') : '/details');
    } catch (e) {
      setCode('');
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (seconds > 0) return;
    setError('');
    try {
      update({ devCode: (await requestCode(data.method, data.contact)) ?? '' });
      setSeconds(42);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    }
  };

  return (
    <Screen
      title="Verify"
      footer={
        <>
          <Button label={busy ? 'Checking…' : 'Verify'} disabled={code.length < 6 || busy} onPress={verify} />
          <Keypad onDigit={(d) => setCode((c) => (c.length < 6 ? c + d : c))} onBackspace={() => setCode((c) => c.slice(0, -1))} />
        </>
      }
    >
      <Text variant="h2">Enter the 6-digit code</Text>
      <Text tone="secondary">Sent {via}.</Text>
      <CodeBoxes value={code} />
      {error ? <Note icon="alert-triangle" tone="error">{error}</Note> : null}
      {data.devCode ? <Note icon="terminal" tone="accent">Test mode: WhatsApp is not connected yet, so your code is {data.devCode}.</Note> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="bodySmall" tone="tertiary" onPress={resend}>
          {seconds > 0 ? `Resend code in 0:${String(seconds).padStart(2, '0')}` : 'Resend code'}
        </Text>
        <Text variant="label" onPress={() => router.back()}>Change {data.method === 'phone' ? 'number' : 'email'}</Text>
      </View>
    </Screen>
  );
}
