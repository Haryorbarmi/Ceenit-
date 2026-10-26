import { View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { OptionChip } from '@/components/Chips';
import { Input } from '@/components/Input';
import { Progress, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { categories } from '@/data/mock';
import { spacing } from '@/theme/tokens';
import { useOnboarding } from '@/state/onboarding';

export default function Details() {
  const { data, update } = useOnboarding();
  const valid = data.fullName.trim().length > 1 && data.shopName.trim().length > 1 && data.city.trim().length > 1;

  return (
    <Screen
      title="Step 1 of 4"
      footer={<Button label="Continue" disabled={!valid} onPress={() => router.push('/link-name')} />}
    >
      <Progress step={1} />
      <Text variant="h2">Tell us about your shop</Text>
      <Text tone="secondary">Buyers see your shop name on every payment page and receipt.</Text>
      <Input label="Full name" value={data.fullName} onChangeText={(fullName) => update({ fullName })} autoCapitalize="words" placeholder="Emeka Okafor" />
      <Input label="Shop or business name" value={data.shopName} onChangeText={(shopName) => update({ shopName })} autoCapitalize="words" placeholder="Emeka Autos" />
      <View style={{ gap: spacing.xs }}>
        <Text variant="label">What do you sell?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {categories.map((c) => (
            <OptionChip key={c} label={c} selected={data.category === c} onPress={() => update({ category: c })} />
          ))}
        </View>
      </View>
      <Input label="City" value={data.city} onChangeText={(city) => update({ city })} autoCapitalize="words" />
    </Screen>
  );
}
