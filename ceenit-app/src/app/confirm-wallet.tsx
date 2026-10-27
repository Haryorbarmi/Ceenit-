import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Note, Progress, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { color, radius, spacing, tone } from '@/theme/tokens';
import { useOnboarding } from '@/state/onboarding';

function CheckRow({ checked, onPress, children }: { checked: boolean; onPress: () => void; children: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={styles.checkRow}>
      <View style={[styles.box, checked ? { backgroundColor: tone.accent.solid } : { borderWidth: 2, borderColor: color.borderStrong }]}>
        {checked ? <Icon name="check" size={16} tone="inverse" /> : null}
      </View>
      <Text variant="bodySmall" style={{ flex: 1 }}>{children}</Text>
    </Pressable>
  );
}

export default function ConfirmWallet() {
  const { data } = useOnboarding();
  const [terms, setTerms] = useState(false);
  const [understand, setUnderstand] = useState(false);
  const grouped = (data.wallet || 'TQn9Y2khDGZMt1r4pYvMwiJ3sdd5AU2gXc').match(/.{1,8}/g)?.join(' ');

  return (
    <Screen
      title="Step 3 of 4"
      footer={<Button label="Confirm and continue" disabled={!(terms && understand)} onPress={() => router.push('/pin')} />}
    >
      <Progress step={3} />
      <Text variant="h2">Check your wallet</Text>
      <Text tone="secondary">Make sure every character matches. Buyers pay this address directly.</Text>
      <View style={styles.card}>
        <Text variant="caption" tone="tertiary">Payments will go to</Text>
        <Text variant="h3">{grouped}</Text>
        <View style={styles.netRow}>
          <Icon name="shield" size={18} />
          <Text variant="bodySmall" tone="secondary">TRON · TRC20 · USDT</Text>
        </View>
      </View>
      <Note icon="info" tone="accent">You can change this later. A change needs your PIN and takes effect after 24 hours.</Note>
      <CheckRow checked={terms} onPress={() => setTerms((v) => !v)}>I agree to the Terms and Privacy Policy.</CheckRow>
      <CheckRow checked={understand} onPress={() => setUnderstand((v) => !v)}>
        I understand Ceeneet never holds my money and cannot reverse or recover payments.
      </CheckRow>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: color.bgSurface,
    borderWidth: 1,
    borderColor: color.borderDefault,
  },
  netRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  checkRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  box: { width: 24, height: 24, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
