import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, radius, spacing, tone as palette, ToneName } from '@/theme/tokens';
import { Button } from './Button';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

type Props = {
  visible: boolean;
  expiryLabel: string;
  onClose: () => void;
  onConfirm: () => void;
};

/** The "Before you create this link" sheet. A live link cannot be cancelled, so the seller must accept this first. */
export function DisclaimerSheet({ visible, expiryLabel, onClose, onConfirm }: Props) {
  const points: { icon: IconName; text: string; tone: ToneName }[] = [
    { icon: 'check-circle', tone: 'success', text: 'The link goes live right away.' },
    { icon: 'credit-card', tone: 'accent', text: 'The buyer pays straight to your wallet. Ceeneet never touches the money.' },
    { icon: 'lock', tone: 'accent', text: `Once live, a link cannot be cancelled. It expires on its own after ${expiryLabel}.` },
    { icon: 'alert-triangle', tone: 'warning', text: 'Late or wrong-amount payments are flagged for you to review.' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />
        <Text variant="h3">Before you create this link</Text>
        <View style={{ gap: spacing.md }}>
          {points.map((p) => (
            <View key={p.text} style={styles.point}>
              <View style={[styles.pointIcon, { backgroundColor: palette[p.tone].bg }]}><Icon name={p.icon} size={20} tone={p.tone} /></View>
              <Text variant="bodySmall" style={{ flex: 1 }}>{p.text}</Text>
            </View>
          ))}
        </View>
        <View style={{ gap: spacing.xs }}>
          <Button label="I understand, create link" onPress={onConfirm} />
          <Button variant="text" label="Go back" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: color.bgPage,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: color.borderStrong },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pointIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.bgSubtle, alignItems: 'center', justifyContent: 'center' },
});
