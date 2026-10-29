import { useCallback, useEffect, useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/Button';
import { StatusChip } from '@/components/Chips';
import { Note, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { api, ApiError, Invoice, InvoicePayment } from '@/lib/api';
import { useRate } from '@/lib/rate';
import { formatNaira, formatUsdt } from '@/lib/format';
import { statusOf, useLinks } from '@/state/links';
import { useStyles } from '@/theme/theme';
import { radius, spacing, Theme } from '@/theme/tokens';

type Detail = Invoice & { payments: InvoicePayment[] };

const stamp = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

const flagCopy = {
  late: 'Ceeneet did not mark this Paid because the link had expired. Check the payment, then decide.',
  underpaid: 'The amount is less than the invoice, so it is not marked Paid. Ceeneet cannot refund or move funds.',
  overpaid: 'The amount is more than the invoice, so it is not marked Paid. Any refund is arranged between you and the buyer, outside Ceeneet.',
} as const;

function Row({ k, v }: { k: string; v: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text tone="tertiary">{k}</Text>
      <Text variant="bodyMedium" style={{ flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  );
}

export default function InvoiceDetail() {
  const styles = useStyles(makeStyles);
  const rate = useRate();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useLinks();
  const [d, setD] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setD(await api.invoice(String(id)));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setMissing(true);
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  if (missing) {
    return (
      <Screen title="Payment" footer={<Button label="Back" onPress={() => router.back()} />}>
        <Text variant="h2">We could not find this payment</Text>
      </Screen>
    );
  }
  if (!d) return <Screen title="Payment"><Text tone="tertiary" align="center">Loading…</Text></Screen>;

  const status = statusOf(d);
  const amount = Number(d.amount);
  const flagged = d.status === 'late' || d.status === 'underpaid' || d.status === 'overpaid';
  const pay = d.payments.find((p) => p.outcome !== 'rejected') ?? d.payments[0];
  const canAccept = flagged && pay && pay.confirmed && !pay.resolved;

  const accept = async () => {
    if (!pay) return;
    setBusy(true);
    setError('');
    try {
      await api.resolvePayment(pay.txId);
      await Promise.all([load(), refresh()]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title={status === 'Needs attention' ? 'Needs attention' : status === 'Pending' ? 'Invoice' : 'Transaction'}
      footer={
        <>
          {canAccept ? <Button label={busy ? 'Accepting…' : 'Accept as paid'} disabled={busy} onPress={accept} /> : null}
          {status === 'Pending' ? <Button label="Share link again" onPress={() => Share.share({ message: d.url })} /> : null}
          {pay ? <Button variant="outline" label="View proof on Tronscan" onPress={() => Linking.openURL(`https://tronscan.org/#/transaction/${pay.txId}`)} /> : null}
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: spacing.xs, paddingTop: spacing.xs }}>
        <Text variant="bodySmall" tone="secondary">{d.item}</Text>
        <Text variant="h1" align="center">{formatUsdt(amount)} USDT</Text>
        <StatusChip status={status} />
        <Text variant="bodySmall" tone="tertiary" align="center">≈ {formatNaira(amount, rate)} · estimate</Text>
      </View>

      <View style={styles.card}>
        {d.reference ? <Row k="Buyer" v={d.reference} /> : null}
        <Row k="Network" v="TRON (TRC20)" />
        <Row k="Created" v={stamp(d.createdAt)} />
        {status === 'Paid' ? <Row k="Paid" v={stamp(d.paidAt ?? d.createdAt)} /> : <Row k="Expires" v={stamp(d.expiresAt)} />}
        {pay ? <Row k="Received" v={`${formatUsdt(Number(pay.amount))} USDT`} /> : null}
        {pay ? <Row k="Confirmations" v={pay.confirmed ? '20 of 20' : `${pay.confirmations} of 20`} /> : null}
        {pay ? <Row k="Transaction ID" v={`${pay.txId.slice(0, 4)}…${pay.txId.slice(-4)}`} /> : null}
      </View>

      {flagged ? <Note icon="alert-triangle" tone="warning">{flagCopy[d.status as keyof typeof flagCopy]}</Note> : null}
      {flagged && pay && !pay.confirmed ? <Note icon="clock" tone="accent">Waiting for the network to confirm this payment. You can accept it once it is confirmed.</Note> : null}
      {status === 'Pending' ? <Note icon="clock" tone="accent">This link is live and cannot be cancelled. It expires on its own, and you are alerted the moment the buyer pays.</Note> : null}
      {status === 'Paid' ? <Note icon="check" tone="success">Real USDT, right wallet, exact amount, successful, confirmed and not used before.</Note> : null}
      {error ? <Note icon="alert-triangle" tone="error">{error}</Note> : null}
    </Screen>
  );
}

const makeStyles = ({ color }: Theme) => StyleSheet.create({
  card: { borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.xxs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
});
