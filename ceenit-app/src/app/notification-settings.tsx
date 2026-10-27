import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Note, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/state/session';
import { color, palette, radius, spacing, tone } from '@/theme/tokens';

type RowProps = { title: string; hint: string; value: boolean; locked?: boolean; disabled?: boolean; onChange?: (v: boolean) => void };

function Row({ title, hint, value, locked, disabled, onChange }: RowProps) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text variant="bodyMedium">{title}</Text>
        <Text variant="bodySmall" tone="tertiary">{hint}</Text>
      </View>
      {locked ? (
        <View style={styles.always}>
          <Icon name="lock" size={14} tone="tertiary" />
          <Text variant="caption" tone="tertiary">Always on</Text>
        </View>
      ) : (
        <Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: palette.n300, true: tone.accent.solid }} ios_backgroundColor={palette.n300} />
      )}
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="caption" tone="tertiary" style={styles.groupTitle}>{title.toUpperCase()}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

// Notification settings. Money alerts stay on so a seller never misses a payment; the others can be switched.
export default function NotificationSettings() {
  const { me, setMe } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!me) return null;

  const change = async (p: { detected?: boolean; expired?: boolean }) => {
    setBusy(true);
    setError('');
    try {
      setMe(await api.setNotifyPrefs(p));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Notifications">
      <Group title="Payments">
        <Row title="Payment confirmed" hint="When a payment is fully confirmed on TRON." value locked />
        <Row title="Late or wrong-amount payments" hint="When a payment is late, too small, too big or does not match a link." value locked />
        <Row title="Payment found, confirming" hint="The moment a payment is seen, before it is confirmed." value={me.notifyDetected} disabled={busy} onChange={(v) => change({ detected: v })} />
      </Group>
      <Group title="Links">
        <Row title="New link requests" hint="When a buyer asks for a fresh link." value locked />
        <Row title="Links that expire unpaid" hint="Shows in your bell inbox only, with no phone alert." value={me.notifyExpired} disabled={busy} onChange={(v) => change({ expired: v })} />
      </Group>
      {error ? <Note icon="alert-triangle" tone="error">{error}</Note> : null}
      <Text variant="caption" tone="tertiary" align="center">Alerts about money stay on so you never miss a payment.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  groupTitle: { letterSpacing: 0.6, paddingHorizontal: spacing.xs },
  card: { borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  always: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
});
