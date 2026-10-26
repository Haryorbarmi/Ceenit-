import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { color, radius, spacing, tone } from '@/theme/tokens';
import { useOnboarding } from '@/state/onboarding';

export default function Ready() {
  const { data } = useOnboarding();
  const link = `ceenit.app/${data.linkName || 'emeka-autos'}`;

  return (
    <Screen
      scroll={false}
      footer={
        <>
          <Button label="Create my first payment link" onPress={() => router.replace('/(tabs)/new')} />
          <Button variant="text" label="Go to dashboard" onPress={() => router.replace('/(tabs)/home')} />
        </>
      }
    >
      <View style={styles.center}>
        <View style={styles.check}><Icon name="check" size={48} tone="inverse" /></View>
        <Text variant="h1" align="center">You are all set</Text>
        <Text tone="secondary" align="center">Your payment link is live. Share it, or create a link for a sale.</Text>
        <View style={styles.link}>
          <Text variant="bodyMedium">{link}</Text>
          <Icon name="copy" size={20} />
        </View>
        <View style={styles.plan}>
          <Text variant="bodyMedium">Free plan · 5 transactions</Text>
          <Text variant="bodySmall" tone="tertiary">Your first 5 confirmed payments are free. Upgrade any time.</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'stretch', gap: spacing.md },
  check: { width: 96, height: 96, borderRadius: 48, backgroundColor: tone.success.solid, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  link: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: color.bgSurface,
    borderWidth: 1,
    borderColor: color.borderDefault,
  },
  plan: { gap: spacing.xxs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: color.borderDefault },
});
