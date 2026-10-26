import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { LoadingScreen } from '@/components/LoadingScreen';
import { OnboardingProvider } from '@/state/onboarding';
import { LinksProvider } from '@/state/links';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    'Helvena-Bold': require('../../assets/fonts/Helvena-Bold.otf'),
    'Helvena-Semibold': require('../../assets/fonts/Helvena-Semibold.otf'),
  });

  const [booting, setBooting] = useState(true);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // Hold the loading screen briefly so the brand is seen, then reveal the app.
  useEffect(() => {
    if (!loaded && !error) return;
    const t = setTimeout(() => setBooting(false), 1600);
    return () => clearTimeout(t);
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <OnboardingProvider>
        <LinksProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
          {booting ? <LoadingScreen /> : null}
        </LinksProvider>
      </OnboardingProvider>
    </SafeAreaProvider>
  );
}
