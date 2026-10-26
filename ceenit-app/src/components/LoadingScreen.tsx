import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { color, hues, tone } from '@/theme/tokens';
import { Wordmark } from './Wordmark';

const TRACK = 120;
const SEGMENT = 48;

/** Shown while Ceenit opens: wordmark on black, a soft purple glow and a thin loader. */
export function LoadingScreen() {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(slide, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [slide]);

  return (
    <View style={styles.root} accessibilityRole="progressbar" accessibilityLabel="Loading Ceenit">
      <StatusBar style="light" />
      <Svg width={360} height={360} style={styles.glow} pointerEvents="none">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={tone.accent.solid} stopOpacity={0.5} />
            <Stop offset="1" stopColor={tone.accent.solid} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={360} height={360} fill="url(#glow)" />
      </Svg>
      <Wordmark size={56} />
      <View style={styles.track}>
        <Animated.View
          style={[styles.segment, { transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, TRACK - SEGMENT] }) }] }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: color.bgInverse, alignItems: 'center', justifyContent: 'center', gap: 28, zIndex: 10 },
  glow: { position: 'absolute' },
  track: { width: TRACK, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  segment: { width: SEGMENT, height: 4, borderRadius: 2, backgroundColor: hues.purple[500] },
});
