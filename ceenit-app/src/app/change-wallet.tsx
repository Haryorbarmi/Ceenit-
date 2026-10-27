import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { CodeBoxes, Keypad, PinDots } from '@/components/Keypad';
import { Note, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { api, ApiError } from '@/lib/api';
import { isTronAddress } from '@/lib/format';
import { useSession } from '@/state/session';
import { color, radius, spacing } from '@/theme/tokens';

type Step = 'address' | 'pin' | 'code' | 'done';

/** "24 hours" or "about 2 minutes", from how long the server will actually wait. */
function waitWords(startsAt?: string): string {
  const mins = startsAt ? Math.max(1, Math.round((new Date(startsAt).getTime() - Date.now()) / 60_000)) : 24 * 60;
  return mins >= 90 ? `${Math.round(mins / 60)} hours` : mins === 1 ? 'about a minute' : `about ${mins} minutes`;
}

/** Where the code went, with most of it hidden: +234 …1234, or a***@mail.com. */
const masked = (contact: string) => (contact.includes('@') ? contact.replace(/^(.).*(@.*)$/, '$1***$2') : `+${contact.slice(0, 3)} …${contact.slice(-4)}`);

// Change wallet: new address, then your PIN, then a code sent to you. The new wallet starts after a wait.
export default function ChangeWallet() {
  const { me, setMe, checkPin } = useSession();
  const [step, setStep] = useState<Step>('address');
  const [address, setAddress] = useState('');
  const [check, setCheck] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle');
  const [pin, setPin] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const next = address.trim();
  const shapeOk = isTronAddress(next);
  useEffect(() => {
    if (!shapeOk) return setCheck('idle');
    setCheck('checking');
    let stale = false;
    api.walletValid(next).then((r) => !stale && setCheck(r.valid ? 'ok' : 'bad')).catch(() => !stale && setCheck('ok'));
    return () => { stale = true; };
  }, [next, shapeOk]);
  if (!me) return null;

  const addressError = next.length > 0 && (!shapeOk || check === 'bad') ? 'This is not a valid TRON (TRC20) address. Check every character.' : next === me.wallet ? 'That is already your wallet.' : undefined;
  const addressOk = shapeOk && check === 'ok' && !addressError;

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');

  const enterPin = async (value: string) => {
    if (!(await checkPin(value))) { setPin(''); setError('That PIN is not right. Try again.'); return; }
    setError('');
    setBusy(true);
    try {
      setDevCode((await api.walletRequestCode()).devCode ?? '');
      setStep('code');
    } catch (e) {
      fail(e);
    } finally {
      setPin('');
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      setMe(await api.changeWallet(next, code));
      setStep('done');
    } catch (e) {
      setCode('');
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done') {
    return (
      <Screen title="Wallet change" noBack footer={<Button label="Done" onPress={() => router.replace('/my-wallet')} />}>
        <Text variant="h2">Change requested</Text>
        <Text tone="secondary">For your safety, the new wallet starts after a wait. You can cancel any time before then.</Text>
        <View style={styles.timeline}>
          <Text variant="bodyMedium">Now</Text>
          <Text variant="bodySmall" tone="secondary">Request received. We sent an alert to your phone.</Text>
          <Text variant="bodyMedium" style={{ marginTop: spacing.sm }}>In {waitWords(me.pendingWalletChange?.startsAt)}</Text>
          <Text variant="bodySmall" tone="secondary">Your new wallet starts. New payment links pay it.</Text>
          <Text variant="bodyMedium" style={{ marginTop: spacing.sm }}>Links already made</Text>
          <Text variant="bodySmall" tone="secondary">Keep paying your old wallet, so no payment is lost.</Text>
        </View>
        <Note icon="alert-triangle" tone="warning">If you did not ask for this, open Wallet and tap Cancel wallet change.</Note>
      </Screen>
    );
  }

  if (step === 'pin') {
    return (
      <Screen title="Confirm" footer={<Keypad onDigit={(d) => { if (busy || pin.length >= 6) return; const n = pin + d; setPin(n); if (n.length === 6) setTimeout(() => void enterPin(n), 200); }} onBackspace={() => setPin((p) => p.slice(0, -1))} />}>
        <Text variant="h2">Enter your PIN</Text>
        <Text tone="secondary">Changing your wallet is a protected action.</Text>
        <View style={{ paddingTop: spacing.xl, gap: spacing.md }}>
          <PinDots filled={pin.length} />
          {error ? <Text variant="bodySmall" tone="error" align="center">{error}</Text> : null}
        </View>
      </Screen>
    );
  }

  if (step === 'code') {
    return (
      <Screen
        title="Confirm"
        footer={
          <>
            <Button label={busy ? 'Checking…' : 'Confirm wallet change'} disabled={code.length < 6 || busy} onPress={confirm} />
            <Keypad onDigit={(d) => setCode((c) => (c.length < 6 ? c + d : c))} onBackspace={() => setCode((c) => c.slice(0, -1))} />
          </>
        }
      >
        <Text variant="h2">Enter the 6-digit code</Text>
        <Text tone="secondary">We sent it to {masked(me.contact)}.</Text>
        <CodeBoxes value={code} />
        {error ? <Note icon="alert-triangle" tone="error">{error}</Note> : null}
        {devCode ? <Note icon="terminal" tone="accent">Test mode: WhatsApp is not connected yet, so your code is {devCode}.</Note> : null}
      </Screen>
    );
  }

  return (
    <Screen title="Change wallet" footer={<Button label="Continue" disabled={!addressOk} onPress={() => { setError(''); setStep('pin'); }} />}>
      <Text variant="h2">New wallet</Text>
      <Text tone="secondary">Enter the TRON (TRC20) address that should receive your payments.</Text>
      <Input label="New wallet address" value={address} onChangeText={setAddress} autoCapitalize="none" autoCorrect={false} placeholder="T…" error={addressError} />
      <View style={styles.old}>
        <Text variant="caption" tone="tertiary">Current wallet</Text>
        <Text variant="bodySmall">{me.wallet}</Text>
      </View>
      <Note icon="alert-triangle" tone="warning">Only TRON (TRC20) addresses work. A wrong address means lost payments, and Ceenit cannot recover them.</Note>
    </Screen>
  );
}

const styles = StyleSheet.create({
  timeline: { gap: spacing.xxs, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: color.borderDefault },
  old: { gap: spacing.xxs, padding: spacing.md, borderRadius: radius.lg, backgroundColor: color.bgSurface },
});
