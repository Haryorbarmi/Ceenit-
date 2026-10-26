import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { color, radius, spacing, tone } from '@/theme/tokens';

const plans = [
  { id: 'Seller', price: '₦5,000/month', features: 'Unlimited links, alerts, receipts, full history' },
  { id: 'Business', price: '₦15,000/month', features: 'Your logo on receipts, sales reports, export' },
] as const;

export default function FreeLimit() {
  const [plan, setPlan] = useState<(typeof plans)[number]['id']>('Seller');

  return (
    <Screen
      footer={
        <>
          <Button
            label={`Subscribe to ${plan}`}
            onPress={() => Alert.alert('Paystack', 'Paystack checkout is connected when the billing backend is built.')}
          />
          <Button variant="text" label="Not now" onPress={() => router.back()} />
        </>
      }
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}>
        <Icon name="x" size={20} />
      </Pressable>
      <View style={styles.lock}><RNText style={styles.emoji}>🥺</RNText></View>
      <Text variant="h2">You have used your 5 free transactions</Text>
      <Text tone="secondary">Subscribe to keep creating links and confirming payments. Your history stays available.</Text>
      {plans.map((p) => {
        const selected = plan === p.id;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => setPlan(p.id)}
            style={[styles.plan, { borderColor: selected ? tone.accent.solid : color.borderDefault, borderWidth: selected ? 2 : 1 }]}
          >
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'baseline' }}>
                <Text variant="h3">{p.id}</Text>
                <Text variant="bodyMedium">{p.price}</Text>
              </View>
              <Text variant="bodySmall" tone="secondary">{p.features}</Text>
            </View>
            <View style={[styles.radio, selected ? { backgroundColor: tone.accent.solid } : { borderWidth: 2, borderColor: color.borderStrong }]} />
          </Pressable>
        );
      })}
      <Text variant="caption" tone="tertiary" align="center">Pay securely with Paystack.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: color.borderDefault, alignItems: 'center', justifyContent: 'center' },
  lock: { width: 64, height: 64, borderRadius: 32, backgroundColor: tone.warning.bg, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 32 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg },
  radio: { width: 22, height: 22, borderRadius: 11 },
});
