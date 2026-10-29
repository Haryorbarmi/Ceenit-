import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Switch, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Note, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { api, ApiError, DeviceSession } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useSession } from '@/state/session';
import { useStyles, useTheme } from '@/theme/theme';
import { palette, radius, spacing, Theme } from '@/theme/tokens';

// Security: change the PIN, unlock with Face ID, see which devices are logged in, and log them out.
export default function Security() {
  const { tone } = useTheme();
  const styles = useStyles(makeStyles);
  const { biometric, setBiometric, logout } = useSession();
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [canFace, setCanFace] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setDevices(await api.sessions()); } catch { /* keep what we have */ }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    (async () => setCanFace((await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())))();
  }, []);

  const toggleFace = async (on: boolean) => {
    setError('');
    if (!(await setBiometric(on)) && on) setError('Your phone did not confirm it was you, so Face ID stays off.');
  };

  const logOne = (d: DeviceSession) =>
    Alert.alert(`Log out ${d.device}?`, 'That device will need a new login code to get back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => { try { await api.revokeSession(d.id); await load(); } catch (e) { setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.'); } } },
    ]);

  const logAll = () =>
    Alert.alert('Log out of all devices?', 'Every phone and computer, including this one, will be logged out. You will need a new login code to get back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out everywhere', style: 'destructive', onPress: async () => { try { await api.logoutAll(); await logout(); router.replace('/'); } catch (e) { setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.'); } } },
    ]);

  return (
    <Screen title="Security" refreshControl={<RefreshControl refreshing={pulling} onRefresh={async () => { setPulling(true); await load(); setPulling(false); }} />}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" tone="tertiary" style={styles.groupTitle}>APP LOCK</Text>
        <View style={styles.card}>
          <Pressable onPress={() => router.push('/change-pin')} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
            <Icon name="lock" size={22} />
            <Text style={{ flex: 1 }}>Change PIN</Text>
            <Icon name="chevron-right" size={20} tone="tertiary" />
          </Pressable>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <Text>Unlock with Face ID or fingerprint</Text>
              {!canFace ? <Text variant="bodySmall" tone="tertiary">Set up Face ID or a fingerprint in your phone settings first.</Text> : null}
            </View>
            <Switch value={biometric} disabled={!canFace} onValueChange={toggleFace} trackColor={{ false: palette.n300, true: tone.accent.solid }} ios_backgroundColor={palette.n300} />
          </View>
        </View>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" tone="tertiary" style={styles.groupTitle}>DEVICES</Text>
        <View style={styles.card}>
          {devices.length === 0 ? <Text tone="tertiary" style={styles.row}>Loading…</Text> : null}
          {devices.map((d, i) => (
            <View key={d.id} style={[styles.row, i > 0 && styles.rowBorder]}>
              <Icon name="smartphone" size={22} />
              <View style={{ flex: 1, gap: spacing.xxs }}>
                <Text variant="bodyMedium">{d.device}</Text>
                <Text variant="bodySmall" tone={d.current ? 'success' : 'tertiary'}>{d.current ? 'This device · active now' : `Last active ${timeAgo(d.lastActive)}`}</Text>
              </View>
              {!d.current ? <Text variant="label" tone="error" onPress={() => logOne(d)}>Log out</Text> : null}
            </View>
          ))}
        </View>
      </View>

      <Note icon="bell" tone="accent">You get an alert on your phone whenever a new device logs in to your account.</Note>
      {error ? <Note icon="alert-triangle" tone="error">{error}</Note> : null}
      <Button variant="outline" label="Log out of all devices" onPress={logAll} />
    </Screen>
  );
}

const makeStyles = ({ color }: Theme) => StyleSheet.create({
  groupTitle: { letterSpacing: 0.6, paddingHorizontal: spacing.xs },
  card: { borderWidth: 1, borderColor: color.borderDefault, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: color.borderDefault },
});
