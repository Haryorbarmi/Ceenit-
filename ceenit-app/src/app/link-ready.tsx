import { useEffect, useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Button } from '@/components/Button';
import { StatusChip } from '@/components/Chips';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { seller } from '@/data/mock';
import { formatCountdown, formatUsdt } from '@/lib/format';
import { useLinks } from '@/state/links';
import { color, radius, spacing, tone } from '@/theme/tokens';

export default function LinkReady() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getLink } = useLinks();
  const link = getLink(String(id));
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!link) {
    return (
      <Screen scroll={false} footer={<Button label="Back to home" onPress={() => router.replace('/(tabs)/home')} />}>
        <Text variant="h2">We could not find this link</Text>
      </Screen>
    );
  }

  const remaining = formatCountdown(link.expiresAt, now);
  const message = `${seller.shop}: please pay ${formatUsdt(link.total)} USDT (TRON TRC20) for ${link.item}.\nhttps://${link.url}`;

  const copy = async () => {
    await Clipboard.setStringAsync(`https://${link.url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsapp = async () => {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(url);
    } catch {
      await Share.share({ message });
    }
  };

  return (
    <Screen
      footer={
        <>
          <Button label="Share on WhatsApp" onPress={whatsapp} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button style={{ flex: 1 }} variant="secondary" label={copied ? 'Copied' : 'Copy link'} onPress={copy} />
            <Button style={{ flex: 1 }} variant="secondary" label="Show QR" onPress={() => router.push({ pathname: '/qr', params: { id: link.id } })} />
          </View>
          <Button variant="text" label="Done" onPress={() => router.replace('/(tabs)/home')} />
        </>
      }
    >
      <View style={styles.center}>
        <View style={styles.check}><Icon name="check" size={36} tone="inverse" /></View>
        <Text variant="h2" align="center">Share it with your buyer</Text>
        <Text tone="secondary" align="center">{link.item} · {formatUsdt(link.total)} USDT</Text>
      </View>

      <View style={styles.linkCard}>
        <Text variant="bodyMedium">{link.url}</Text>
        <Icon name={copied ? 'check' : 'copy'} size={20} />
      </View>

      <View style={styles.status}>
        {remaining ? <StatusChip status="Pending" /> : <StatusChip status="Expired" />}
        <Text variant="bodySmall" tone="tertiary">{remaining ? `Expires in ${remaining}` : 'This link has expired'}</Text>
      </View>

      <Text variant="bodySmall" tone="tertiary" align="center">
        Send it to anyone helping you sell. When they open it, they will see the moment it is Paid.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.md },
  check: { width: 72, height: 72, borderRadius: 36, backgroundColor: tone.success.solid, alignItems: 'center', justifyContent: 'center' },
  linkCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: color.bgSurface,
    borderWidth: 1,
    borderColor: color.borderDefault,
  },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
});
