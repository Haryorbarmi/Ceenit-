import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button } from '@/components/Button';
import { Note, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { api, ApiError, BillingPayment } from '@/lib/api';
import { useSession } from '@/state/session';
import { useStyles } from '@/theme/theme';
import { radius, spacing, Theme } from '@/theme/tokens';

const names: Record<string, string> = { free: 'Free', seller: 'Seller', business: 'Business' };
const prices: Record<string, string> = { seller: '₦5,000 a month', business: '₦15,000 a month' };

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

function Row({ k, v }: { k: string; v: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text tone="tertiary">{k}</Text>
      <Text variant="bodyMedium">{v}</Text>
    </View>
  );
}

// Plan and billing: what the seller is on, when it runs to, and a way to cancel.
export default function Plan() {
  const styles = useStyles(makeStyles);
  const { me, refreshMe } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<BillingPayment[]>([]);
  useFocusEffect(useCallback(() => { api.billingHistory().then(setHistory).catch(() => undefined); }, []));
  if (!me) return null;

  const paid = me.plan !== 'free';

  const cancel = () =>
    Alert.alert(
      'Cancel subscription?',
      `You keep your ${names[me.plan]} plan until ${me.planUntil ? day(me.planUntil) : 'the end of the month'}. After that your account becomes read-only: you can see your payments but cannot create new links.`,
      [
        { text: 'Keep my plan', style: 'cancel' },
        {
          text: 'Cancel subscription',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setError('');
            try {
              await api.cancelBilling();
              await refreshMe();
            } catch (e) {
              setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );

  return (
    <Screen
      title="Plan and billing"
      footer={
        paid && !me.cancelled && !me.planEnded ? (
          <>
            <Button label={`Switch to ${me.plan === 'seller' ? 'Business' : 'Seller'}`} onPress={() => router.push('/free-limit')} />
            <Button variant="outline" label={busy ? 'Cancelling…' : 'Cancel subscription'} disabled={busy} onPress={cancel} />
          </>
        ) : (
          <Button label={me.planEnded ? 'Renew plan' : paid ? 'Subscribe again' : 'See plans'} onPress={() => router.push('/free-limit')} />
        )
      }
    >
      <View style={styles.card}>
        <Text variant="caption" tone="tertiary">Current plan</Text>
        <Text variant="h2">{names[me.plan] ?? me.plan}</Text>
        {paid ? <Text variant="bodySmall" tone="secondary">{prices[me.plan]}</Text> : <Text variant="bodySmall" tone="secondary">{me.freeUsed} of {me.freeTotal} free transactions used</Text>}
      </View>

      {paid && me.planUntil ? (
        <View style={styles.table}>
          <Row k={me.cancelled || me.planEnded ? 'Runs until' : 'Renews on'} v={day(me.planUntil)} />
          <Row k="Paid with" v="Paystack" />
        </View>
      ) : null}

      {history.length > 0 ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" tone="tertiary" style={{ letterSpacing: 0.6, paddingHorizontal: spacing.xs }}>PAYMENT HISTORY</Text>
          <View style={styles.table}>
            {history.map((p) => (
              <View key={p.reference} style={styles.row}>
                <View style={{ gap: spacing.xxs }}>
                  <Text variant="bodyMedium">{names[p.plan] ?? p.plan} plan</Text>
                  <Text variant="bodySmall" tone="tertiary">{day(p.at)}</Text>
                </View>
                <Text variant="bodyMedium">₦{(p.amountKobo / 100).toLocaleString('en-US')}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {me.planEnded ? <Note icon="alert-triangle" tone="warning">Your subscription has ended. Your payments stay visible, but you cannot create new links until you renew.</Note> : null}
      {me.cancelled && !me.planEnded ? <Note icon="info" tone="accent">Your subscription is cancelled and will not renew. You keep your plan until {me.planUntil ? day(me.planUntil) : 'the end of the month'}.</Note> : null}
      {error ? <Note icon="alert-triangle" tone="error">{error}</Note> : null}
      <Text variant="caption" tone="tertiary" align="center">Subscriptions are paid securely with Paystack.</Text>
    </Screen>
  );
}

const makeStyles = ({ color }: Theme) => StyleSheet.create({
  card: { gap: spacing.xxs, padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: color.borderDefault, backgroundColor: color.bgSurface },
  table: { borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
});
