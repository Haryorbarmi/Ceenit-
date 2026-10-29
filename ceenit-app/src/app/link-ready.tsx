import { useEffect, useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Button } from '@/components/Button';
import { StatusChip } from '@/components/Chips';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useSession } from '@/state/session';
import { formatCountdown, formatUsdt } from '@/lib/format';
import { statusOf, useLinks } from '@/state/links';
import { useStyles } from '@/theme/theme';
import { radius, spacing, Theme } from '@/theme/tokens';

export default function LinkReady() {
  const styles = useStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getInvoice } = useLinks();
  const { me } = useSession();
  const link = getInvoice(String(id));
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

  const status = statusOf(link);
  const remaining = status === 'Pending' ? formatCountdown(new Date(link.expiresAt).getTime(), now) : null;
  const message = `${me?.shopName}: please pay ${formatUsdt(Number(link.amount))} USDT (TRON TRC20) for ${link.item}.\n${link.url}`;

  const copy = async () => {
    await Clipboard.setStringAsync(link.url);
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
        <Text tone="secondary" align="center">{link.item} · {formatUsdt(Number(link.amount))} USDT</Text>
      </View>

      <View style={styles.linkCard}>
        <Text variant="bodyMedium">{link.url.replace(/^https?:\/\//, '')}</Text>
        <Icon name={copied ? 'check' : 'copy'} size={20} />
      </View>

      <View style={styles.status}>
        <StatusChip status={status} />
        <Text variant="bodySmall" tone="tertiary">{status === 'Paid' ? 'Payment confirmed on TRON' : status === 'Expired' ? 'This link has expired' : status === 'Needs attention' ? 'A payment needs your review' : remaining ? `Expires in ${remaining}` : 'Waiting for payment'}</Text>
      </View>

      <Text variant="bodySmall" tone="tertiary" align="center">
        Send it to anyone helping you sell. When they open it, they will see the moment it is Paid.
      </Text>
    </Screen>
  );
}

const makeStyles = ({ color, tone }: Theme) => StyleSheet.create({
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
