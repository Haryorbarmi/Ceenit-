import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Input } from '@/components/Input';
import { Progress, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { reservedLinkNames } from '@/data/mock';
import { color, radius, spacing, tone } from '@/theme/tokens';
import { useOnboarding } from '@/state/onboarding';

const rule = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;

export default function LinkName() {
  const { data, update } = useOnboarding();
  const name = data.linkName;
  const reserved = reservedLinkNames.includes(name);
  const valid = rule.test(name) && !reserved;
  const error = name && !valid ? (reserved ? 'That name is not available.' : 'Use 3 to 30 lowercase letters, numbers or hyphens.') : undefined;
  const initial = (data.shopName || 'E').trim()[0]?.toUpperCase() ?? 'E';

  return (
    <Screen
      title="Step 2 of 4"
      footer={<Button label="Continue" disabled={!valid} onPress={() => router.push('/wallet')} />}
    >
      <Progress step={2} />
      <Text variant="h2">Choose your link name</Text>
      <Text tone="secondary">This is your permanent Ceenit link. Buyers see it on every payment.</Text>
      <Input
        label="Your link"
        prefix="ceenit.app/"
        value={name}
        onChangeText={(t) => update({ linkName: t.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="emeka-autos"
        error={error}
        autoFocus
      />
      {valid ? (
        <View style={styles.avail}>
          <Icon name="check" size={18} tone="success" />
          <Text variant="label" tone="success">Available</Text>
        </View>
      ) : (
        <Text variant="bodySmall" tone="tertiary">Lowercase letters, numbers and hyphens. 3 to 30 characters.</Text>
      )}
      <View style={styles.preview}>
        <Text variant="caption" tone="tertiary">How buyers will see you</Text>
        <View style={styles.avatar}><Text variant="h2" tone="inverse">{initial}</Text></View>
        <Text variant="h3">{data.shopName || 'Your shop'}</Text>
        <Text variant="bodySmall" tone="secondary">ceenit.app/{name || 'your-name'}</Text>
        <Text variant="bodySmall" tone="tertiary">{data.city.split(',')[0]} · {data.category}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avail: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  preview: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: color.bgSurface,
    borderWidth: 1,
    borderColor: color.borderDefault,
  },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: tone.accent.solid, alignItems: 'center', justifyContent: 'center' },
});
