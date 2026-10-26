import { Pressable, StyleSheet, View } from 'react-native';
import { color, radius, spacing, tone } from '@/theme/tokens';
import { Icon } from './Icon';
import { Text } from './Text';

const rows = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'back']];

export function Keypad({ onDigit, onBackspace }: { onDigit: (d: string) => void; onBackspace: () => void }) {
  return (
    <View style={styles.pad}>
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((k, j) => {
            if (!k) return <View key={j} style={styles.key} />;
            const isBack = k === 'back';
            return (
              <Pressable
                key={j}
                accessibilityRole="button"
                accessibilityLabel={isBack ? 'Delete' : k}
                onPress={() => (isBack ? onBackspace() : onDigit(k))}
                style={({ pressed }) => [styles.key, !isBack && styles.filled, pressed && { opacity: 0.6 }]}
              >
                {isBack ? <Icon name="delete" size={22} /> : <Text variant="h3">{k}</Text>}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Row of dots for PIN entry. */
export function PinDots({ length = 6, filled }: { length?: number; filled: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length }).map((_, i) => (
        <View key={i} style={[styles.dot, i < filled ? styles.dotOn : styles.dotOff]} />
      ))}
    </View>
  );
}

/** Row of boxes for the 6-digit login code. */
export function CodeBoxes({ value, length = 6 }: { value: string; length?: number }) {
  return (
    <View style={styles.boxes}>
      {Array.from({ length }).map((_, i) => {
        const active = i === value.length;
        return (
          <View
            key={i}
            style={[styles.box, { borderColor: active ? tone.accent.solid : color.borderDefault, borderWidth: active ? 2 : 1 }]}
          >
            <Text variant="h3">{value[i] ?? ''}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.xs },
  key: { flex: 1, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  filled: { backgroundColor: color.bgSurface },
  dots: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8 },
  dotOn: { backgroundColor: tone.accent.solid },
  dotOff: { borderWidth: 2, borderColor: tone.accent.border },
  boxes: { flexDirection: 'row', gap: spacing.xs },
  box: { flex: 1, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
