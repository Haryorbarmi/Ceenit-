import { Share, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { formatUsdt } from '@/lib/format';
import { useLinks } from '@/state/links';
import { color, radius, spacing } from '@/theme/tokens';

export default function QrScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const link = useLinks().getInvoice(String(id));
  if (!link) return null;
  const url = link.url;

  return (
    <Screen
      title="QR code"
      footer={
        <>
          <Button label="Share link" onPress={() => Share.share({ message: url })} />
          <Button variant="text" label="Back to link" onPress={() => router.back()} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Text variant="h3" align="center">Let your buyer scan this</Text>
        <Text variant="bodySmall" tone="secondary" align="center">{link.item} · {formatUsdt(Number(link.amount))} USDT</Text>
      </View>
      <View style={styles.qrWrap}>
        <View style={styles.qr}>
          <QRCode value={url} size={220} color={color.textPrimary} backgroundColor={color.bgPage} />
        </View>
      </View>
      <Text variant="bodyMedium" align="center">{link.url.replace(/^https?:\/\//, '')}</Text>
      <Text variant="bodySmall" tone="tertiary" align="center">Opens the payment page. The buyer pays from their own wallet.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  qrWrap: { alignItems: 'center', paddingVertical: spacing.lg },
  qr: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: color.borderDefault, backgroundColor: color.bgPage },
});
