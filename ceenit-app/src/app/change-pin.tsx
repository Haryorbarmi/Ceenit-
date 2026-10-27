import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { Keypad, PinDots } from '@/components/Keypad';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useSession } from '@/state/session';
import { spacing } from '@/theme/tokens';

type Step = 'old' | 'new' | 'again';

const words: Record<Step, { title: string; hint: string }> = {
  old: { title: 'Enter your current PIN', hint: 'We need to know it is you.' },
  new: { title: 'Choose a new PIN', hint: 'Six digits you will remember. Do not use 123456.' },
  again: { title: 'Enter the new PIN again', hint: 'Type it once more to be sure.' },
};

// Change PIN: current PIN, then the new one twice. The PIN lives only on this phone.
export default function ChangePin() {
  const { checkPin, savePin } = useSession();
  const [step, setStep] = useState<Step>('old');
  const [pin, setPin] = useState('');
  const [fresh, setFresh] = useState('');
  const [problem, setProblem] = useState('');

  const done = async (value: string) => {
    if (step === 'old') {
      if (await checkPin(value)) { setStep('new'); setProblem(''); } else setProblem('That PIN is not right. Try again.');
    } else if (step === 'new') {
      if (value === '123456' || /^(\d)\1{5}$/.test(value)) setProblem('That PIN is too easy to guess. Choose another.');
      else { setFresh(value); setStep('again'); setProblem(''); }
    } else if (value === fresh) {
      await savePin(value);
      Alert.alert('PIN changed', 'Use your new PIN next time you open Ceenit.', [{ text: 'OK', onPress: () => router.back() }]);
    } else {
      setFresh('');
      setStep('new');
      setProblem('The two PINs did not match. Start again.');
    }
    setPin('');
  };

  const add = (d: string) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 6) setTimeout(() => void done(next), 200);
  };

  return (
    <Screen title="Change PIN" footer={<Keypad onDigit={add} onBackspace={() => setPin((p) => p.slice(0, -1))} />}>
      <Text variant="h2">{words[step].title}</Text>
      <Text tone="secondary">{words[step].hint}</Text>
      <View style={{ paddingTop: spacing.xl, gap: spacing.md }}>
        <PinDots filled={pin.length} />
        {problem ? <Text variant="bodySmall" tone="error" align="center">{problem}</Text> : null}
      </View>
    </Screen>
  );
}
