import { View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { OptionChip } from '@/components/Chips';
import { Input } from '@/components/Input';
import { Note, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { spacing } from '@/theme/tokens';
import { useOnboarding } from '@/state/onboarding';

export default function Phone() {
  const { data, update } = useOnboarding();
  const isPhone = data.method === 'phone';
  const valid = isPhone ? data.contact.replace(/\D/g, '').length >= 10 : /\S+@\S+\.\S+/.test(data.contact);

  return (
    <Screen
      title="Sign up"
      footer={
        <>
          <Button label={isPhone ? 'Send code on WhatsApp' : 'Send code to email'} disabled={!valid} onPress={() => router.push('/code')} />
          <Button
            variant="text"
            label={isPhone ? 'Use email instead' : 'Use phone number instead'}
            onPress={() => update({ method: isPhone ? 'email' : 'phone', contact: '' })}
          />
        </>
      }
    >
      <Text variant="h2">{isPhone ? 'Enter your phone number' : 'Enter your email'}</Text>
      <Text tone="secondary">
        {isPhone ? 'We will send a 6-digit code to your WhatsApp.' : 'We will send a 6-digit code to your inbox.'}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        <OptionChip label="Phone number" selected={isPhone} onPress={() => update({ method: 'phone', contact: '' })} />
        <OptionChip label="Email" selected={!isPhone} onPress={() => update({ method: 'email', contact: '' })} />
      </View>
      <Input
        label={isPhone ? 'Phone number' : 'Email'}
        prefix={isPhone ? '+234  ' : undefined}
        value={data.contact}
        onChangeText={(contact) => update({ contact })}
        keyboardType={isPhone ? 'phone-pad' : 'email-address'}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={isPhone ? '801 234 5678' : 'you@example.com'}
        autoFocus
      />
      {isPhone ? <Note icon="message-circle" tone="accent">The code comes by WhatsApp, not SMS. Make sure WhatsApp is active on this number.</Note> : null}
    </Screen>
  );
}
