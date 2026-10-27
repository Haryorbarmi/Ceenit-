import { StyleProp, TextStyle } from 'react-native';
import { fonts } from '@/theme/tokens';
import { Text } from './Text';

/** The Ceeneet wordmark, set in Helvena Bold. */
export function Wordmark({ size = 56, style }: { size?: number; style?: StyleProp<TextStyle> }) {
  return (
    <Text
      tone="inverse"
      style={[{ fontFamily: fonts.heading, fontSize: size, lineHeight: size * 1.05, letterSpacing: -size * 0.025 }, style]}
    >
      Ceeneet
    </Text>
  );
}
