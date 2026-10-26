import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { openFromAlert } from '@/lib/push';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { LoadingScreen } from '@/components/LoadingScreen';
import { OnboardingProvider } from '@/state/onboarding';
import { LinksProvider } from '@/state/links';
import { SessionProvider, useSession } from '@/state/session';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    'Helvena-Bold': require('../../assets/fonts/Helvena-Bold.otf'),
    'Helvena-Semibold': require('../../assets/fonts/Helvena-Semibold.otf'),
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // Tapping a payment alert opens that payment (or the link request).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => openFromAlert(r.notification.request.content.data));
    return () => sub.remove();
  }, []);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <OnboardingProvider>
          <LinksProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
            <BootOverlay />
          </LinksProvider>
        </OnboardingProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

// The loading screen stays until the saved login has been checked, and for at least 1.6 seconds so the brand is seen.
function BootOverlay() {
  const { status } = useSession();
  const [minTime, setMinTime] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setMinTime(false), 1600);
    return () => clearTimeout(t);
  }, []);
  return minTime || status === 'loading' ? <LoadingScreen /> : null;
}
