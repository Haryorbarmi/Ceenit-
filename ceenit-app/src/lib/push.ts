import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { api } from '@/lib/api';

// Phone alerts. After login the app asks permission, gets this phone's alert address from Expo,
// and gives it to the Ceenit API. The API sends "you have been paid" to it.

// While the app is open, still show the alert as a banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let registered: string | null = null;

/** Returns the push token if alerts are allowed on this phone, otherwise null. Never throws. */
export async function registerForAlerts(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null; // simulators cannot receive alerts
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Payments', importance: Notifications.AndroidImportance.HIGH });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.registerPushToken(token);
    registered = token;
    return token;
  } catch (e) {
    console.log('[alerts] not registered:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Call before logging out, so this phone stops getting the old seller's alerts. */
export async function forgetAlerts(): Promise<void> {
  if (!registered) return;
  const token = registered;
  registered = null;
  await api.removePushToken(token).catch(() => undefined);
}

/** Opens the right screen when a seller taps an alert. */
export function openFromAlert(data: Record<string, unknown> | undefined) {
  const type = data?.type;
  const invoiceId = typeof data?.invoiceId === 'string' ? data.invoiceId : undefined;
  if (type === 'link_requested') router.push('/link-requests');
  else if (type === 'plan_ending' || type === 'plan_ended' || type === 'billing_failed') router.push('/plan');
  else if (type === 'new_device') router.push('/security');
  else if (type === 'wallet_change_requested' || type === 'wallet_changed') router.push('/my-wallet');
  else if (invoiceId) router.push({ pathname: '/invoice/[id]', params: { id: invoiceId } });
  else router.push('/(tabs)/home');
}
