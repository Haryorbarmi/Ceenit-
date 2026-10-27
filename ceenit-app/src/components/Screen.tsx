import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, radius, spacing, tone as palette, ToneName } from '@/theme/tokens';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  children: ReactNode;
  /** Small centred title with a back button, like the Figma top bar. */
  title?: string;
  /** Pinned to the bottom, above the home indicator. Use for the main button. */
  footer?: ReactNode;
  background?: string;
  /** Hide the back button (first screens). */
  noBack?: boolean;
  scroll?: boolean;
  /** Pull-to-refresh, for list screens. */
  refreshControl?: React.ReactElement<any>;
  /** Stays put at the top while everything else scrolls underneath it. */
  header?: ReactNode;
};

export function TopBar({ title, light }: { title?: string; light?: boolean }) {
  return (
    <View style={styles.top}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => (router.canGoBack() ? router.back() : undefined)}
        style={[styles.back, light && { borderColor: color.textSecondary }]}
      >
        <Icon name="chevron-left" size={20} tone={light ? 'inverse' : 'primary'} />
      </Pressable>
      <Text variant="bodyMedium" tone={light ? 'inverse' : 'primary'} align="center" style={{ flex: 1 }}>
        {title ?? ''}
      </Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

export function Screen({ children, title, footer, background = color.bgPage, noBack, scroll = true, refreshControl, header }: Props) {
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: background }]} edges={['top', 'bottom']}>
      {title !== undefined && !noBack ? <TopBar title={title} /> : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {header ? <View style={styles.header}>{header}</View> : null}
        <Body
          style={{ flex: 1 }}
          {...(scroll
            ? { contentContainerStyle: styles.content, keyboardShouldPersistTaps: 'handled' as const, showsVerticalScrollIndicator: false, refreshControl }
            : {})}
        >
          {scroll ? children : <View style={styles.content}>{children}</View>}
        </Body>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Tinted box with an icon and short text. Tone picks the colour: accent for info, warning for risks, success for confirmations. Neutral when none. */
export function Note({ icon, children, tone }: { icon: React.ComponentProps<typeof Icon>['name']; children: ReactNode; tone?: ToneName; strong?: boolean }) {
  const p = tone ? palette[tone] : null;
  return (
    <View style={[styles.note, p ? { backgroundColor: p.bg, borderColor: p.border } : { borderColor: color.borderDefault }]}>
      <Icon name={icon} size={20} tone={tone} />
      <Text variant="bodySmall" tone="secondary" style={{ flex: 1 }}>{children}</Text>
    </View>
  );
}

/** Four-step progress bar used in sign up. */
export function Progress({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <View style={styles.progress}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.seg, { backgroundColor: i < step ? palette.accent.solid : color.borderDefault }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { height: 56, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center' },
  back: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs, paddingTop: spacing.xs, gap: spacing.xs },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: color.bgSurface,
    borderWidth: 1,
  },
  progress: { flexDirection: 'row', gap: spacing.xs },
  seg: { flex: 1, height: 4, borderRadius: 2 },
});
