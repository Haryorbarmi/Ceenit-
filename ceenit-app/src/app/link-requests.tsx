import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Note, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { api, ApiError, LinkRequest } from '@/lib/api';
import { formatUsdt } from '@/lib/format';
import { useLinks } from '@/state/links';
import { useStyles } from '@/theme/theme';
import { radius, spacing, Theme } from '@/theme/tokens';

function RequestCard({ q, onDone }: { q: LinkRequest; onDone: (newId?: string) => void }) {
  const styles = useStyles(makeStyles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const act = async (kind: 'approve' | 'decline') => {
    setBusy(true);
    setError('');
    try {
      if (kind === 'approve') onDone((await api.approveRequest(q.id)).id);
      else {
        await api.declineRequest(q.id);
        onDone();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.who}>
        <View style={styles.avatar}><Text variant="label" tone="inverse">{(q.buyerName || 'B')[0]!.toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium">{q.buyerName || 'A buyer'}</Text>
          <Text variant="bodySmall" tone="secondary">requested a new payment link</Text>
        </View>
      </View>
      <View>
        <View style={styles.row}><Text tone="tertiary">Item</Text><Text variant="bodyMedium">{q.item}</Text></View>
        <View style={styles.row}><Text tone="tertiary">Expired link</Text><Text variant="bodyMedium">{formatUsdt(Number(q.previousAmount))} USDT</Text></View>
        <View style={styles.row}><Text tone="tertiary">Requests</Text><Text variant="bodyMedium">{q.requestsMade} of 3</Text></View>
      </View>
      {error ? <Note icon="alert-triangle" tone="error">{error}</Note> : null}
      <Button label={busy ? 'Working…' : 'Approve and send new link'} disabled={busy} onPress={() => act('approve')} />
      <Button variant="text" label="Decline" disabled={busy} onPress={() => act('decline')} />
    </View>
  );
}

export default function LinkRequests() {
  const { requests, refresh } = useLinks();

  const done = async (newId?: string) => {
    await refresh();
    if (newId) router.replace({ pathname: '/link-ready', params: { id: newId } });
  };

  return (
    <Screen title="Link requests">
      {requests.length === 0 ? (
        <Text tone="secondary" align="center" style={{ paddingTop: spacing.xl }}>No requests right now.</Text>
      ) : (
        <>
          <Note icon="info" tone="accent">Same item, fresh amount with new cents, new expiry. The old link stays recorded as expired.</Note>
          {requests.map((q) => <RequestCard key={q.id} q={q} onDone={done} />)}
        </>
      )}
    </Screen>
  );
}

const makeStyles = ({ color, tone }: Theme) => StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: color.borderDefault },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: tone.accent.solid, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
});
