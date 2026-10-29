import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Note, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/state/session';
import { useStyles, useTheme } from '@/theme/theme';
import { radius, spacing, Theme } from '@/theme/tokens';

const plans = [
  { key: 'seller', name: 'Seller', price: '₦5,000/month', features: 'Unlimited links, alerts, receipts, full history' },
  { key: 'business', name: 'Business', price: '₦15,000/month', features: 'Your logo on receipts, sales reports, export' },
] as const;

type Phase = 'choose' | 'paying' | 'done';

// Shown when the free plan runs out, or a subscription ends. Payment happens on Paystack's own page.
export default function FreeLimit() {
  const { color, tone } = useTheme();
  const styles = useStyles(makeStyles);
  const { me, refreshMe } = useSession();
  // A seller who already pays for a plan can only choose the other one here.
  const activePlan = me && me.plan !== 'free' && !me.planEnded && !me.cancelled ? me.plan : null;
  const [plan, setPlan] = useState<(typeof plans)[number]['key']>(activePlan === 'seller' ? 'business' : 'seller');
  const [phase, setPhase] = useState<Phase>('choose');
  const [error, setError] = useState('');
  const reference = useRef<string | null>(null);
  const stopped = useRef(false);
  const ended = me?.planEnded;

  useEffect(() => () => { stopped.current = true; }, []);

  // Asks the API whether Paystack has received the payment. Returns true once the plan is active.
  const check = async (): Promise<boolean> => {
    if (!reference.current) return false;
    try {
      if ((await api.verifyBilling(reference.current)).active) {
        await refreshMe();
        setPhase('done');
        return true;
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'We could not check your payment. Try again.');
    }
    return false;
  };

  const subscribe = async () => {
    setError('');
    try {
      const { url, reference: ref } = await api.checkout(plan);
      reference.current = ref;
      setPhase('paying');
      await WebBrowser.openBrowserAsync(url);
      // On iPhone this returns when the seller closes the page. Android returns at once, so keep checking for a while.
      for (let i = 0; i < 40 && !stopped.current; i++) {
        if (await check()) return;
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (e) {
      setPhase('choose');
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    }
  };

  if (phase === 'done') {
    return (
      <Screen scroll={false} footer={<Button label="Back to home" onPress={() => router.replace('/(tabs)/home')} />}>
        <View style={styles.center}>
          <View style={styles.check}><Icon name="check" size={40} tone="inverse" /></View>
          <Text variant="h2" align="center">Your plan is active</Text>
          <Text tone="secondary" align="center">Thank you. You can create payment links again.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          {phase === 'paying' ? (
            <Button variant="secondary" label="I have paid, check now" onPress={check} />
          ) : (
            <Button label={`${activePlan ? 'Switch' : 'Subscribe'} to ${plans.find((p) => p.key === plan)!.name}`} onPress={subscribe} />
          )}
          <Button variant="text" label={phase === 'paying' ? 'Close' : 'Not now'} onPress={() => router.back()} />
        </>
      }
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}>
        <Icon name="x" size={20} />
      </Pressable>
      {activePlan ? null : <View style={styles.lock}><RNText style={styles.emoji}>🥺</RNText></View>}
      <Text variant="h2">{activePlan ? 'Change your plan' : ended ? 'Your subscription has ended' : 'You have used your 5 free transactions'}</Text>
      <Text tone="secondary">
        {activePlan
          ? 'The days you have already paid for are kept. Your old monthly payment is stopped, and the new plan starts charging today.'
          : ended
            ? 'Renew to create new payment links. Everything you have already received stays visible.'
            : 'Subscribe to keep creating links and confirming payments. Your history stays available.'}
      </Text>
      {plans.map((p) => {
        const current = activePlan === p.key;
        const selected = plan === p.key && !current;
        return (
          <Pressable
            key={p.key}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => phase === 'choose' && !current && setPlan(p.key)}
            style={[styles.plan, current && { opacity: 0.55 }, { borderColor: selected ? tone.accent.solid : color.borderDefault, borderWidth: selected ? 2 : 1 }]}
          >
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'baseline' }}>
                <Text variant="h3">{p.name}</Text>
                <Text variant="bodyMedium">{p.price}</Text>
                {current ? <Text variant="caption" tone="success">Current plan</Text> : null}
              </View>
              <Text variant="bodySmall" tone="secondary">{p.features}</Text>
            </View>
            <View style={[styles.radio, selected ? { backgroundColor: tone.accent.solid } : { borderWidth: 2, borderColor: color.borderStrong }]} />
          </Pressable>
        );
      })}
      {phase === 'paying' ? <Note icon="clock" tone="accent">Finish paying on the Paystack page. This screen updates by itself when your payment arrives.</Note> : null}
      {error ? <Note icon="alert-triangle" tone="error">{error}</Note> : null}
      <Text variant="caption" tone="tertiary" align="center">Pay securely with Paystack. Ceeneet never sees your card details.</Text>
    </Screen>
  );
}

const makeStyles = ({ color, tone }: Theme) => StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  check: { width: 96, height: 96, borderRadius: 48, backgroundColor: tone.success.solid, alignItems: 'center', justifyContent: 'center' },
  close: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: color.borderDefault, alignItems: 'center', justifyContent: 'center' },
  lock: { width: 64, height: 64, borderRadius: 32, backgroundColor: tone.warning.bg, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 32 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg },
  radio: { width: 22, height: 22, borderRadius: 11 },
});
