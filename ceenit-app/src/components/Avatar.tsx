import { Image, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { tone } from '@/theme/tokens';

type Me = { shopName: string; subscribed: boolean; photo: string | null };

/** The seller's round photo. Only subscribed sellers have one; everyone else gets their first letter on purple. */
export function Avatar({ me, size = 44 }: { me: Me | null; size?: number }) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (me?.subscribed && me.photo) return <Image source={{ uri: me.photo }} style={box} />;
  return (
    <View style={[styles.letter, box]}>
      <Text variant={size >= 56 ? 'h2' : 'bodyMedium'} tone="inverse">{(me?.shopName ?? 'C')[0]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ letter: { backgroundColor: tone.accent.solid, alignItems: 'center', justifyContent: 'center' } });
