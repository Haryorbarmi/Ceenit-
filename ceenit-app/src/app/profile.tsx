import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Note, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/state/session';
import { color, radius, spacing, tone } from '@/theme/tokens';

// Edit profile. Only subscribed sellers can change their photo; they also get the verified tick and likes on their page.
export default function Profile() {
  const { me, setMe } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!me) return null;
  const locked = !me.subscribed;

  async function run(job: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await job();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const choose = () =>
    run(async () => {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
      if (r.canceled || !r.assets[0]) return;
      // Shrink to a small square so it uploads fast and loads fast on the buyer's page.
      const small = await ImageManipulator.manipulateAsync(r.assets[0].uri, [{ resize: { width: 400, height: 400 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      setMe(await api.setPhoto(`data:image/jpeg;base64,${small.base64}`));
    });

  const remove = () => run(async () => setMe(await api.setPhoto(null)));

  return (
    <Screen
      title="Edit profile"
      footer={
        locked ? (
          <Button label="Upgrade to edit" onPress={() => router.push('/free-limit')} />
        ) : (
          <Button label={busy ? 'Saving…' : me.photo ? 'Change photo' : 'Add photo'} disabled={busy} onPress={choose} />
        )
      }
    >
      <View style={styles.center}>
        {!locked && me.photo ? <Image source={{ uri: me.photo }} style={styles.avatar} /> : <View style={styles.avatar}><Text variant="h1" tone="inverse">{me.shopName[0]}</Text></View>}
        <View style={styles.nameRow}>
          <Text variant="h2">{me.shopName}</Text>
          {me.subscribed ? <VerifiedBadge size={24} /> : null}
        </View>
        <Text tone="secondary">{me.category} · {me.city}</Text>
        {me.subscribed ? (
          <View style={styles.likes}>
            <Icon name="heart" size={16} tone="error" />
            <Text variant="bodySmall" tone="secondary">{me.likes} {me.likes === 1 ? 'like' : 'likes'} from buyers</Text>
          </View>
        ) : null}
      </View>

      {locked ? (
        <View style={styles.lockCard}>
          <Icon name="lock" size={20} tone="accent" />
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <Text variant="bodyMedium">Photo, verified tick and likes</Text>
            <Text variant="bodySmall" tone="secondary">Subscribe to add a shop photo, get the blue verified tick next to your name, and let buyers like your page.</Text>
          </View>
        </View>
      ) : null}

      {!locked && me.photo ? <Button variant="text" label="Remove photo" disabled={busy} onPress={remove} /> : null}
      {me.planEnded ? <Note icon="alert-triangle" tone="warning">Your subscription has ended, so your tick, photo and likes are hidden from buyers. Renew to bring them back.</Note> : null}
      {error ? <Note icon="alert-triangle" tone="error">{error}</Note> : null}
      <Text variant="caption" tone="tertiary" align="center">Your link name ({me.slug}) cannot be changed, so old payment links keep working.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  avatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: tone.accent.solid, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  likes: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  lockCard: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: tone.accent.border, backgroundColor: tone.accent.bg },
});
