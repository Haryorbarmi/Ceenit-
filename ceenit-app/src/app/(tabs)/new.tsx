import { View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { OptionChip } from '@/components/Chips';
import { Input } from '@/components/Input';
import { Note, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { parseAmount } from '@/lib/format';
import { expiryOptions, useLinks } from '@/state/links';
import { useSession } from '@/state/session';
import { spacing } from '@/theme/tokens';

export default function NewLink() {
  const { draft, setDraft } = useLinks();
  const { me } = useSession();
  const valid = draft.item.trim().length > 1 && parseAmount(draft.amount) > 0;

  const next = () => {
    // After the 5th confirmed transaction on the Free plan, creating links needs a subscription.
    if (me && me.plan === 'free' && me.freeUsed >= me.freeTotal) router.push('/free-limit');
    else router.push('/preview');
  };

  return (
    <Screen footer={<Button label="Preview link" disabled={!valid} onPress={next} />}>
      <Text variant="h2" style={{ paddingTop: spacing.xs }}>New payment link</Text>
      <Input label="What are you selling?" value={draft.item} onChangeText={(item) => setDraft({ item })} placeholder="Toyota Camry 2015" autoCapitalize="words" />
      <Input label="Amount in USDT" value={draft.amount} onChangeText={(amount) => setDraft({ amount })} placeholder="8,000" keyboardType="decimal-pad" />
      <Note icon="info" tone="accent">Ceenit adds a few cents (for example 8,000.37) so we can match the payment to this sale.</Note>
      <Input label="Buyer name or phone (optional)" value={draft.reference} onChangeText={(reference) => setDraft({ reference })} placeholder="For your own records" />
      <View style={{ gap: spacing.xs }}>
        <Text variant="label">Link expires in</Text>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {expiryOptions.map((e) => (
            <OptionChip key={e.label} label={e.label} selected={draft.expiry === e.label} onPress={() => setDraft({ expiry: e.label })} />
          ))}
        </View>
      </View>
    </Screen>
  );
}
