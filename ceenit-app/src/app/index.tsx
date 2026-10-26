import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { Wordmark } from '@/components/Wordmark';
import { color, hues, palette, spacing } from '@/theme/tokens';

// The photo sits at the top, fades into black, and a purple glow rises behind the buttons.
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Image source={require('../../assets/welcome-photo.jpg')} style={{ position: 'absolute', top: 0, left: 0, width, height: height * 0.74 }} resizeMode="cover" />
      <LinearGradient pointerEvents="none" style={StyleSheet.absoluteFill} locations={[0.36, 0.6, 0.72]} colors={['#00000000', '#000000e0', '#000000']} />
      <LinearGradient
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        locations={[0.4, 0.72, 1]}
        colors={[`${hues.purple[700]}00`, `${hues.purple[700]}38`, `${hues.purple[600]}9e`]}
      />

      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={{ gap: spacing.xxs }}>
          <Wordmark size={60} />
          <Text variant="bodyLarge" style={{ color: palette.n400 }}>USDT payments, confirmed and seen.</Text>
        </View>
        <View style={styles.actions}>
          <Button inverse label="Continue with phone number" onPress={() => router.push('/phone')} />
          <Button inverse variant="outline" label="Continue with email" onPress={() => router.push('/phone')} />
          <Text variant="bodySmall" tone="inverse" align="center" style={{ paddingVertical: spacing.xs }} onPress={() => router.push('/(tabs)/home')}>
            Already have an account? Log in
          </Text>
          <Text variant="caption" align="center" style={{ color: palette.n300, opacity: 0.6 }}>
            By continuing you agree to the Terms and Privacy Policy.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bgInverse },
  content: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.lg, gap: spacing.lg },
  actions: { gap: spacing.sm },
});
